import supabase from '../../lib/supabase'
import { z } from 'zod'
import * as XLSX from 'xlsx'
import { createNotification } from '../notifications/notifications.service'

const BAD_STATUSES = ['DETERIORADO', 'CAIDO', 'DESAPARECIDO']

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
  search: z.string().trim().optional(),
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

// Caracteres especiales de PostgREST que podrían alterar el filtro `.or()`
// si vinieran tal cual del término de búsqueda del usuario (p.ej. una coma
// cerraría el primer término antes de tiempo, un paréntesis rompería la
// sintaxis). Se escapan para que el término se trate siempre como texto literal.
const escapeOrFilterValue = (value: string) => value.replace(/[,()%]/g, (c) => `\\${c}`)

export const getSignals = async (filters: SignalFilters) => {
  const { status, municipality_id, zone_id, category_id, is_active, search, page = 1, limit = 20 } = filters

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
  if (search) {
    // Búsqueda en servidor por código o dirección (los únicos campos de texto
    // libre relevantes en signals) — antes el filtro de texto solo se aplicaba
    // sobre la página ya cargada en el cliente, así que no encontraba nada
    // fuera de esa página.
    const term = escapeOrFilterValue(search)
    query = query.or(`signal_code.ilike.%${term}%,address.ilike.%${term}%`)
  }

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
  const previous = await getSignalById(id)

  const { data: signal, error } = await supabase
    .from('signals')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(SIGNAL_SELECT)
    .single()

  if (error) throw new Error(error.message)

  // Solo notifica si el estado cambió a uno malo (editar otro campo, o
  // mantenerse en el mismo estado malo, no debe disparar notificaciones repetidas).
  if (data.status && data.status !== previous.status && BAD_STATUSES.includes(data.status)) {
    await createNotification({
      type: 'SIGNAL_BAD_STATUS',
      title: 'Señal en mal estado',
      message: `La señal ${signal.signal_code} fue actualizada al estado ${data.status}.`,
      target_user_id: null,
      signal_id: id,
    })
  }

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

export const toggleSignalActive = async (id: string) => {
  const signal = await getSignalById(id)
  const newStatus = !signal.is_active

  const { data, error } = await supabase
    .from('signals')
    .update({ is_active: newStatus, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(SIGNAL_SELECT)
    .single()

  if (error) throw new Error(error.message)
  return data
}

// --- Carga masiva (CSV/Excel) ---

export interface BulkImportRowError {
  row: number
  message: string
}

export class BulkImportError extends Error {
  errors: BulkImportRowError[]
  constructor(errors: BulkImportRowError[]) {
    super('Errores de validación en el archivo')
    this.errors = errors
  }
}

const DIACRITICS_REGEX = new RegExp('[̀-ͯ]', 'g')

const normalizeHeader = (h: string) =>
  h
    .toString()
    .replace(/^﻿/, '') // BOM que algunos editores/Excel agregan al primer encabezado
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS_REGEX, '')
    .replace(/\s+/g, '_')

// Encabezados aceptados (en español, sin tildes) -> campo interno
const HEADER_ALIASES: Record<string, string> = {
  codigo: 'signal_code',
  signal_code: 'signal_code',
  direccion: 'address',
  address: 'address',
  categoria: 'category',
  category: 'category',
  tipo_senal: 'signal_type',
  tipo_de_senal: 'signal_type',
  signal_type: 'signal_type',
  municipio: 'municipality',
  municipality: 'municipality',
  zona: 'zone',
  zone: 'zone',
  estado: 'status',
  status: 'status',
  descripcion: 'description',
  description: 'description',
  observaciones: 'observations',
  observations: 'observations',
  fecha_instalacion: 'installation_date',
  installation_date: 'installation_date',
  latitud: 'latitude',
  latitude: 'latitude',
  longitud: 'longitude',
  longitude: 'longitude',
}

const VALID_STATUSES = ['BUENO', 'REGULAR', 'DETERIORADO', 'CAIDO', 'DESAPARECIDO']

// Admite tanto "6.1719" como "6,1719" (Excel en español a veces exporta
// los decimales con coma) y reporta un mensaje claro si no es numérico.
const coordinateSchema = z.preprocess((val) => {
  if (typeof val === 'number') return val
  if (typeof val === 'string') {
    const cleaned = val.trim().replace(',', '.')
    if (cleaned === '') return NaN
    return Number(cleaned)
  }
  return NaN
}, z.number({ message: 'Debe ser un número (use punto para decimales, ej. 6.1719)' }))

// Excel/CSV a veces interpreta una celda con pinta de fecha ("2024-03-10")
// y SheetJS la entrega como número de serie (p.ej. 45361) en vez de texto.
// Lo normalizamos de vuelta a un string "YYYY-MM-DD".
const rawToText = (val: unknown): string => {
  if (val === undefined || val === null) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'number') {
    const parsed = XLSX.SSF.parse_date_code(val)
    if (parsed && parsed.y) {
      const mm = String(parsed.m).padStart(2, '0')
      const dd = String(parsed.d).padStart(2, '0')
      return `${parsed.y}-${mm}-${dd}`
    }
    return String(val)
  }
  return String(val)
}

const requiredTextField = (msg: string) =>
  z.preprocess(rawToText, z.string().trim().min(1, msg))

const optionalTextField = () =>
  z.preprocess(rawToText, z.string().trim().optional().or(z.literal('')))

const bulkRowSchema = z.object({
  signal_code: requiredTextField('Código requerido'),
  address: optionalTextField(),
  category: requiredTextField('Categoría requerida'),
  signal_type: requiredTextField('Tipo de señal requerido'),
  municipality: requiredTextField('Municipio requerido'),
  zone: optionalTextField(),
  status: optionalTextField(),
  description: optionalTextField(),
  observations: optionalTextField(),
  installation_date: optionalTextField(),
  latitude: coordinateSchema,
  longitude: coordinateSchema,
})

export const bulkImportSignals = async (
  rawRows: Record<string, unknown>[],
  installedBy: string
) => {
  if (!rawRows || rawRows.length === 0) {
    throw new Error('El archivo no tiene filas para importar')
  }

  // Normalizar encabezados de cada fila a los nombres de campo internos.
  // Los campos requeridos que no aparezcan en el archivo se rellenan con ''
  // para que el zod schema reporte "X requerido" en vez de un error genérico.
  const REQUIRED_FIELDS = ['signal_code', 'category', 'signal_type', 'municipality']
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

  // Cargar catálogos de referencia una sola vez
  const [
    { data: categories },
    { data: types },
    { data: municipalities },
    { data: zones },
  ] = await Promise.all([
    supabase.from('signal_categories').select('id, name'),
    supabase.from('signal_types').select('id, name'),
    supabase.from('municipalities').select('id, name'),
    supabase.from('zones').select('id, name'),
  ])

  const byName = (list: { id: string; name: string }[] | null) => {
    const map = new Map<string, string>()
    for (const item of list ?? []) map.set(item.name.trim().toLowerCase(), item.id)
    return map
  }

  const categoryMap = byName(categories)
  const typeMap = byName(types)
  const municipalityMap = byName(municipalities)
  const zoneMap = byName(zones)

  const errors: BulkImportRowError[] = []
  const toInsert: Record<string, unknown>[] = []
  const seenCodes = new Set<string>()

  rows.forEach((row, idx) => {
    const rowNumber = idx + 2 // la fila 1 del archivo es el encabezado
    const parsed = bulkRowSchema.safeParse(row)

    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(', ')
      errors.push({ row: rowNumber, message: msg })
      return
    }

    const data = parsed.data
    const codeKey = data.signal_code.toLowerCase()

    if (seenCodes.has(codeKey)) {
      errors.push({ row: rowNumber, message: `Código duplicado dentro del archivo: "${data.signal_code}"` })
      return
    }
    seenCodes.add(codeKey)

    const categoryId = categoryMap.get(data.category.toLowerCase())
    if (!categoryId) {
      errors.push({ row: rowNumber, message: `Categoría no encontrada: "${data.category}"` })
      return
    }

    const typeId = typeMap.get(data.signal_type.toLowerCase())
    if (!typeId) {
      errors.push({ row: rowNumber, message: `Tipo de señal no encontrado: "${data.signal_type}"` })
      return
    }

    const municipalityId = municipalityMap.get(data.municipality.toLowerCase())
    if (!municipalityId) {
      errors.push({ row: rowNumber, message: `Municipio no encontrado: "${data.municipality}"` })
      return
    }

    let zoneId: string | null = null
    if (data.zone) {
      const found = zoneMap.get(data.zone.toLowerCase())
      if (!found) {
        errors.push({ row: rowNumber, message: `Zona no encontrada: "${data.zone}"` })
        return
      }
      zoneId = found
    }

    let status = 'BUENO'
    if (data.status) {
      const upper = data.status.toUpperCase()
      if (!VALID_STATUSES.includes(upper)) {
        errors.push({ row: rowNumber, message: `Estado inválido: "${data.status}" (use BUENO, REGULAR, DETERIORADO, CAIDO o DESAPARECIDO)` })
        return
      }
      status = upper
    }

    if (Number.isNaN(data.latitude) || Number.isNaN(data.longitude)) {
      errors.push({ row: rowNumber, message: 'Latitud/longitud inválida' })
      return
    }

    toInsert.push({
      signal_code: data.signal_code,
      address: data.address || null,
      category_id: categoryId,
      signal_type_id: typeId,
      municipality_id: municipalityId,
      zone_id: zoneId,
      status,
      description: data.description || null,
      observations: data.observations || null,
      installation_date: data.installation_date || null,
      latitude: data.latitude,
      longitude: data.longitude,
      installed_by: installedBy,
    })
  })

  if (errors.length > 0) {
    throw new BulkImportError(errors)
  }

  // Todo-o-nada: si algún código ya existe en la base, se rechaza el archivo completo
  const codes = toInsert.map((r) => r.signal_code as string)
  const { data: existing, error: existingError } = await supabase
    .from('signals')
    .select('signal_code')
    .in('signal_code', codes)

  if (existingError) throw new Error(existingError.message)

  if (existing && existing.length > 0) {
    throw new BulkImportError(
      existing.map((e) => ({ row: 0, message: `El código "${e.signal_code}" ya existe en el sistema` }))
    )
  }

  // Inserción atómica: una sola sentencia INSERT con todas las filas.
  // Si la base de datos rechaza alguna (p.ej. restricción no contemplada
  // arriba), Postgres no inserta ninguna — comportamiento todo-o-nada.
  const { data: inserted, error } = await supabase
    .from('signals')
    .insert(toInsert)
    .select('id')

  if (error) throw new Error(error.message)

  return { inserted: inserted?.length ?? 0 }
}
