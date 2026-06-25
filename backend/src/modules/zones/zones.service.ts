import supabase from '../../lib/supabase'
import { z } from 'zod'
import { BulkImportError, BulkImportRowError, normalizeHeader, rawToText } from '../../lib/bulkImport'

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

// --- Carga masiva (CSV/Excel) ---
// normalizeHeader, BulkImportError y el middleware de multer/lectura de XLSX
// viven en lib/bulkImport.ts (compartidos con signals.service.ts).

const HEADER_ALIASES: Record<string, string> = {
  municipio: 'municipality',
  municipality: 'municipality',
  nombre: 'name',
  name: 'name',
  tipo: 'zone_type',
  tipo_de_zona: 'zone_type',
  zone_type: 'zone_type',
  descripcion: 'description',
  description: 'description',
}

const VALID_ZONE_TYPES = ['URBANA', 'RURAL']

const requiredTextField = (msg: string) =>
  z.preprocess(rawToText, z.string().trim().min(1, msg))

const optionalTextField = () =>
  z.preprocess(rawToText, z.string().trim().optional().or(z.literal('')))

const bulkZoneRowSchema = z.object({
  municipality: requiredTextField('Municipio requerido'),
  name: requiredTextField('Nombre requerido'),
  zone_type: optionalTextField(),
  description: optionalTextField(),
})

export const bulkImportZones = async (rawRows: Record<string, unknown>[]) => {
  if (!rawRows || rawRows.length === 0) {
    throw new Error('El archivo no tiene filas para importar')
  }

  const REQUIRED_FIELDS = ['municipality', 'name']
  const rows = rawRows.map((raw) => {
    const normalized: Record<string, unknown> = {}
    for (const field of REQUIRED_FIELDS) normalized[field] = ''
    for (const [key, value] of Object.entries(raw)) {
      const normKey = normalizeHeader(key)
      const field = HEADER_ALIASES[normKey] ?? normKey
      normalized[field] = value
    }
    return normalized
  })

  const { data: municipalities } = await supabase.from('municipalities').select('id, name')
  const municipalityMap = new Map<string, string>()
  for (const m of municipalities ?? []) municipalityMap.set(m.name.trim().toLowerCase(), m.id)

  const errors: BulkImportRowError[] = []
  const toInsert: Record<string, unknown>[] = []
  const seenKeys = new Set<string>()

  rows.forEach((row, idx) => {
    const rowNumber = idx + 2
    const parsed = bulkZoneRowSchema.safeParse(row)

    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(', ')
      errors.push({ row: rowNumber, message: msg })
      return
    }

    const data = parsed.data

    const municipalityId = municipalityMap.get(data.municipality.toLowerCase())
    if (!municipalityId) {
      errors.push({ row: rowNumber, message: `Municipio no encontrado: "${data.municipality}"` })
      return
    }

    let zoneType = 'URBANA'
    if (data.zone_type) {
      const upper = data.zone_type.toUpperCase()
      if (!VALID_ZONE_TYPES.includes(upper)) {
        errors.push({ row: rowNumber, message: `Tipo inválido: "${data.zone_type}" (use URBANA o RURAL)` })
        return
      }
      zoneType = upper
    }

    const dedupeKey = `${municipalityId}|${data.name.toLowerCase()}`
    if (seenKeys.has(dedupeKey)) {
      errors.push({ row: rowNumber, message: `Zona duplicada dentro del archivo: "${data.name}" en ese municipio` })
      return
    }
    seenKeys.add(dedupeKey)

    toInsert.push({
      municipality_id: municipalityId,
      name: data.name,
      zone_type: zoneType,
      description: data.description || null,
    })
  })

  if (errors.length > 0) {
    throw new BulkImportError(errors)
  }

  // Todo-o-nada: rechaza el archivo completo si alguna zona ya existe en ese municipio
  for (const row of toInsert) {
    const { data: existing } = await supabase
      .from('zones')
      .select('id')
      .eq('municipality_id', row.municipality_id as string)
      .ilike('name', row.name as string)
      .maybeSingle()
    if (existing) {
      errors.push({ row: 0, message: `Ya existe una zona "${row.name}" en ese municipio` })
    }
  }

  if (errors.length > 0) {
    throw new BulkImportError(errors)
  }

  const { data: inserted, error } = await supabase
    .from('zones')
    .insert(toInsert)
    .select('id')

  if (error) throw new Error(error.message)

  return { inserted: inserted?.length ?? 0 }
}
