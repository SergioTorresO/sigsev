import supabase from '../../lib/supabase'
import { z } from 'zod'

export const createZoneSchema = z.object({
  municipality_id: z.string().uuid('Municipio inválido'),
  name: z.string().trim().min(1, 'Nombre requerido'),
  zone_type: z.enum(['URBANA', 'RURAL']).optional().default('URBANA'),
  description: z.string().trim().optional(),
})

export const updateZoneSchema = createZoneSchema.partial()

export const zoneFiltersSchema = z.object({
  municipality_id: z.string().uuid().optional(),
  search: z.string().trim().optional(),
  page: z.string().transform(Number).optional(),
  limit: z.string().transform(Number).optional(),
})

type CreateZoneDTO = z.infer<typeof createZoneSchema>
type UpdateZoneDTO = z.infer<typeof updateZoneSchema>
type ZoneFilters = z.infer<typeof zoneFiltersSchema>

const ZONE_SELECT = `
  id, name, zone_type, description, created_at, municipality_id,
  municipalities(id, name)
`

export const getZones = async (filters: ZoneFilters) => {
  const { municipality_id, search, page = 1, limit = 20 } = filters

  let query = supabase
    .from('zones')
    .select(ZONE_SELECT, { count: 'exact' })
    .order('name')
    .range((page - 1) * limit, page * limit - 1)

  if (municipality_id) query = query.eq('municipality_id', municipality_id)
  if (search) query = query.ilike('name', `%${search}%`)

  const { data, error, count } = await query
  if (error) throw new Error(error.message)

  return { data: data ?? [], total: count ?? 0, page, limit }
}

export const getZoneById = async (id: string) => {
  const { data, error } = await supabase
    .from('zones')
    .select(ZONE_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Zona no encontrada')
  return data
}

export const createZone = async (data: CreateZoneDTO) => {
  const { data: existing } = await supabase
    .from('zones')
    .select('id')
    .eq('municipality_id', data.municipality_id)
    .ilike('name', data.name)
    .maybeSingle()
  if (existing) throw new Error('Ya existe una zona con ese nombre en ese municipio')

  const { data: zone, error } = await supabase
    .from('zones')
    .insert(data)
    .select(ZONE_SELECT)
    .single()

  if (error) throw new Error(error.message)
  return zone
}

export const updateZone = async (id: string, data: UpdateZoneDTO) => {
  await getZoneById(id)

  const { data: zone, error } = await supabase
    .from('zones')
    .update(data)
    .eq('id', id)
    .select(ZONE_SELECT)
    .single()

  if (error) throw new Error(error.message)
  return zone
}

export const deleteZone = async (id: string) => {
  await getZoneById(id)

  const { error } = await supabase
    .from('zones')
    .delete()
    .eq('id', id)

  if (error) {
    // 23503 = foreign_key_violation (Postgres) — hay señales que referencian esta zona
    if (error.code === '23503') {
      throw new Error('No se puede eliminar: hay señales asociadas a esta zona')
    }
    throw new Error(error.message)
  }
  return { message: 'Zona eliminada' }
}
