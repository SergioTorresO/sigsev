import supabase from '../../lib/supabase'
import { z } from 'zod'

export const createSignalSchema = z.object({
  signal_code: z.string().trim().min(1, 'Código requerido'),
  category_id: z.string().uuid().optional(),
  signal_type_id: z.string().uuid().optional(),
  municipality_id: z.string().uuid().optional(),
  zone_id: z.string().uuid().optional(),
  status: z.enum(['BUENO', 'REGULAR', 'DETERIORADO', 'CAIDO', 'DESAPARECIDO']).optional(),
  address: z.string().trim().optional(),
  description: z.string().trim().optional(),
  observations: z.string().trim().optional(),
  installation_date: z.string().optional(),
  image_url: z.string().url().optional(),
  latitude: z.number(),
  longitude: z.number(),
})

export const updateSignalSchema = createSignalSchema.partial()

export const signalFiltersSchema = z.object({
  status: z.enum(['BUENO', 'REGULAR', 'DETERIORADO', 'CAIDO', 'DESAPARECIDO']).optional(),
  municipality_id: z.string().uuid().optional(),
  zone_id: z.string().uuid().optional(),
  category_id: z.string().uuid().optional(),
  is_active: z.string().transform((v) => v === 'true').optional(),
  page: z.string().transform(Number).optional(),
  limit: z.string().transform(Number).optional(),
})

type CreateSignalDTO = z.infer<typeof createSignalSchema>
type UpdateSignalDTO = z.infer<typeof updateSignalSchema>
type SignalFilters = z.infer<typeof signalFiltersSchema>

const SIGNAL_SELECT = `
  id, signal_code, address, status, description, observations,
  installation_date, last_maintenance_date, image_url, latitude, longitude,
  is_active, created_at, updated_at,
  signal_categories(id, name),
  signal_types(id, name, code),
  municipalities(id, name),
  zones(id, name, zone_type),
  users(id, full_name)
`

export const getSignals = async (filters: SignalFilters) => {
  const { status, municipality_id, zone_id, category_id, is_active, page = 1, limit = 20 } = filters

  let query = supabase
    .from('signals')
    .select(SIGNAL_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (status) query = query.eq('status', status)
  if (municipality_id) query = query.eq('municipality_id', municipality_id)
  if (zone_id) query = query.eq('zone_id', zone_id)
  if (category_id) query = query.eq('category_id', category_id)
  if (is_active !== undefined) query = query.eq('is_active', is_active)

  const { data, error, count } = await query
  if (error) throw new Error(error.message)

  return { data: data ?? [], total: count ?? 0, page, limit }
}

export const getSignalById = async (id: string) => {
  const { data, error } = await supabase
    .from('signals')
    .select(`
      ${SIGNAL_SELECT},
      inspections(
        id, status, observations, inspection_date,
        users(id, full_name)
      ),
      maintenances(
        id, status, description, maintenance_date, cost
      )
    `)
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Señal no encontrada')
  return data
}

export const createSignal = async (data: CreateSignalDTO, installedBy: string) => {
  const { data: existing } = await supabase
    .from('signals').select('id').eq('signal_code', data.signal_code).maybeSingle()
  if (existing) throw new Error('Ya existe una señal con ese código')

  const { data: signal, error } = await supabase
    .from('signals')
    .insert({ ...data, installed_by: installedBy })
    .select(SIGNAL_SELECT)
    .single()

  if (error) throw new Error(error.message)
  return signal
}

export const updateSignal = async (id: string, data: UpdateSignalDTO) => {
  await getSignalById(id)

  const { data: signal, error } = await supabase
    .from('signals')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(SIGNAL_SELECT)
    .single()

  if (error) throw new Error(error.message)
  return signal
}

export const deleteSignal = async (id: string) => {
  await getSignalById(id)

  const { error } = await supabase
    .from('signals')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)
  return { message: 'Señal desactivada' }
}
