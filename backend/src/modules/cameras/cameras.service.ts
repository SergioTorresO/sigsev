import supabase from '../../lib/supabase'
import { z } from 'zod'
import { BulkImportError, BulkImportRowError, normalizeHeader, rawToText } from '../../lib/bulkImport'
import { logAudit } from '../../lib/audit'
import logger from '../../lib/logger'

const CAMERA_TYPES = ['FIJA', 'MOVIL'] as const
const CAMERA_STATUSES = ['EN_SERVICIO', 'FUERA_DE_SERVICIO', 'EN_MANTENIMIENTO', 'DESCALIBRADA'] as const

// --- Categorización automática por vigencia de calibración ---
//
// Una cámara de fotodetección debe recalibrarse cada año. `calibration_overdue`
// es un campo calculado (no una columna) que se agrega en JS a cada fila leída,
// para que el frontend pueda mostrar la advertencia incluso si el status
// manual no es DESCALIBRADA (p.ej. está FUERA_DE_SERVICIO por otra razón pero
// además tiene la calibración vencida). Cámaras sin `last_calibration_date`
// nunca se marcan como vencidas automáticamente: no hay fecha con la cual
// calcular el vencimiento, así que se deja en manos del registro manual.
const CALIBRATION_VALIDITY_DAYS = 365

const isCalibrationOverdue = (dateStr?: string | null): boolean => {
  if (!dateStr) return false
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return false
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - CALIBRATION_VALIDITY_DAYS)
  return date < cutoff
}

const withCalibrationOverdue = <T extends { last_calibration_date?: string | null }>(camera: T) => ({
  ...camera,
  calibration_overdue: isCalibrationOverdue(camera.last_calibration_date),
})

export const createCameraSchema = z.object({
  camera_code: z.string().trim().min(1, 'Código requerido'),
  camera_type: z.enum(CAMERA_TYPES).optional().default('FIJA'),
  status: z.enum(CAMERA_STATUSES).optional(),
  serial_number: z.string().trim().optional(),
  brand: z.string().trim().optional(),
  model: z.string().trim().optional(),
  installation_date: z.string().optional(),
  last_calibration_date: z.string().optional(),
  speed_limit_kmh: z.number().int().positive().optional(),
  lane_direction: z.string().trim().optional(),
  radar_code: z.string().trim().optional(),
  operator_entity: z.string().trim().optional(),
  municipality_id: z.string().uuid().optional(),
  zone_id: z.string().uuid().optional(),
  address: z.string().trim().optional(),
  description: z.string().trim().optional(),
  observations: z.string().trim().optional(),
  image_url: z.string().url().optional(),
  latitude: z.number(),
  longitude: z.number(),
})

export const updateCameraSchema = createCameraSchema.partial()

export const cameraFiltersSchema = z.object({
  status: z.enum(CAMERA_STATUSES).optional(),
  camera_type: z.enum(CAMERA_TYPES).optional(),
  municipality_id: z.string().uuid().optional(),
  zone_id: z.string().uuid().optional(),
  is_active: z.string().transform((v) => v === 'true').optional(),
  search: z.string().trim().optional(),
  page: z.string().transform(Number).optional(),
  limit: z.string().transform(Number).optional(),
})

type CreateCameraDTO = z.infer<typeof createCameraSchema>
type UpdateCameraDTO = z.infer<typeof updateCameraSchema>
type CameraFilters = z.infer<typeof cameraFiltersSchema>

const CAMERA_SELECT = `
  id, camera_code, camera_type, status, serial_number, brand, model,
  installation_date, last_calibration_date, speed_limit_kmh, lane_direction,
  radar_code, operator_entity, address, description, observations, image_url,
  calibration_certificate_url, latitude, longitude, is_active, created_at, updated_at,
  municipalities(id, name),
  zones(id, name, zone_type),
  users(id, full_name)
`

// Mismo escape que signals.service.ts: evita que una coma/paréntesis/% en el
// término de búsqueda del usuario rompa la sintaxis del filtro `.or()`.
const escapeOrFilterValue = (value: string) => value.replace(/[,()%]/g, (c) => `\\${c}`)

export const getCameras = async (filters: CameraFilters) => {
  const { status, camera_type, municipality_id, zone_id, is_active, search, page = 1, limit = 20 } = filters

  let query = supabase
    .from('cameras')
    .select(CAMERA_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (status) query = query.eq('status', status)
  if (camera_type) query = query.eq('camera_type', camera_type)
  if (municipality_id) query = query.eq('municipality_id', municipality_id)
  if (zone_id) query = query.eq('zone_id', zone_id)
  if (is_active !== undefined) query = query.eq('is_active', is_active)
  if (search) {
    const term = escapeOrFilterValue(search)
    query = query.or(`camera_code.ilike.%${term}%,serial_number.ilike.%${term}%,address.ilike.%${term}%`)
  }

  const { data, error, count } = await query
  if (error) throw new Error(error.message)

  return { data: (data ?? []).map(withCalibrationOverdue), total: count ?? 0, page, limit }
}

export const getCameraById = async (id: string) => {
  const { data, error } = await supabase
    .from('cameras')
    .select(CAMERA_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Cámara no encontrada')
  return withCalibrationOverdue(data)
}

export const createCamera = async (data: CreateCameraDTO, installedBy: string) => {
  const { data: existing } = await supabase
    .from('cameras').select('id').eq('camera_code', data.camera_code).maybeSingle()
  if (existing) throw new Error('Ya existe una cámara con ese código')

  // Categorización automática al registrar: si la fecha de última
  // calibración ya venció y no se eligió explícitamente otro estado, se
  // guarda directamente como DESCALIBRADA en vez de esperar la siguiente
  // corrida del job periódico (ver checkCameraCalibrations más abajo).
  const insertData: CreateCameraDTO = { ...data }
  if (isCalibrationOverdue(data.last_calibration_date) && (data.status === undefined || data.status === 'EN_SERVICIO')) {
    insertData.status = 'DESCALIBRADA'
  }

  const { data: camera, error } = await supabase
    .from('cameras')
    .insert({ ...insertData, installed_by: installedBy })
    .select(CAMERA_SELECT)
    .single()

  if (error) throw new Error(error.message)
  return withCalibrationOverdue(camera)
}

export const updateCamera = async (id: string, data: UpdateCameraDTO) => {
  const existing = await getCameraById(id)

  // Misma categorización automática que createCamera, en ambos sentidos:
  // - si la fecha (nueva o la que ya tenía) está vencida y el estado
  //   resultante sería EN_SERVICIO (explícito o heredado), pasa a DESCALIBRADA.
  // - si se acaba de recalibrar (fecha ya no vencida) y el estado seguía en
  //   DESCALIBRADA sin que el usuario haya elegido otro manualmente, vuelve a
  //   EN_SERVICIO — recalibrar es justamente lo que limpia esa marca.
  const payload: UpdateCameraDTO = { ...data }
  const nextCalibrationDate = data.last_calibration_date !== undefined ? data.last_calibration_date : existing.last_calibration_date
  const overdue = isCalibrationOverdue(nextCalibrationDate)

  if (overdue && (data.status === undefined ? existing.status === 'EN_SERVICIO' : data.status === 'EN_SERVICIO')) {
    payload.status = 'DESCALIBRADA'
  } else if (!overdue && existing.status === 'DESCALIBRADA' && (data.status === undefined || data.status === 'DESCALIBRADA')) {
    payload.status = 'EN_SERVICIO'
  }

  const { data: camera, error } = await supabase
    .from('cameras')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(CAMERA_SELECT)
    .single()

  if (error) throw new Error(error.message)
  return withCalibrationOverdue(camera)
}

// Soft delete (igual que signals): una cámara retirada temporalmente o en
// mantenimiento es un caso de uso frecuente, y un borrado físico rompería la
// trazabilidad si en el futuro se referencia desde reportes/inspecciones.
export const deleteCamera = async (id: string) => {
  await getCameraById(id)

  const { error } = await supabase
    .from('cameras')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)
  return { message: 'Cámara desactivada' }
}

// Se actualiza por separado del PUT genérico porque llega vía multipart/form-data
// (certificateUpload en la ruta dedicada), no como parte del JSON de create/update.
export const updateCameraCertificate = async (id: string, url: string) => {
  await getCameraById(id)

  const { data, error } = await supabase
    .from('cameras')
    .update({ calibration_certificate_url: url, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(CAMERA_SELECT)
    .single()

  if (error) throw new Error(error.message)
  return withCalibrationOverdue(data)
}

export const toggleCameraActive = async (id: string) => {
  const camera = await getCameraById(id)
  const newStatus = !camera.is_active

  const { data, error } = await supabase
    .from('cameras')
    .update({ is_active: newStatus, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(CAMERA_SELECT)
    .single()

  if (error) throw new Error(error.message)
  return withCalibrationOverdue(data)
}

// --- Carga masiva (CSV/Excel) ---
// Mismo esqueleto todo-o-nada que signals/zones, sobre los helpers
// compartidos de lib/bulkImport.ts.

const HEADER_ALIASES: Record<string, string> = {
  codigo: 'camera_code',
  camera_code: 'camera_code',
  tipo: 'camera_type',
  camera_type: 'camera_type',
  estado: 'status',
  status: 'status',
  serie: 'serial_number',
  numero_de_serie: 'serial_number',
  serial_number: 'serial_number',
  marca: 'brand',
  brand: 'brand',
  modelo: 'model',
  model: 'model',
  municipio: 'municipality',
  municipality: 'municipality',
  zona: 'zone',
  zone: 'zone',
  direccion: 'address',
  address: 'address',
  limite_velocidad: 'speed_limit_kmh',
  speed_limit_kmh: 'speed_limit_kmh',
  sentido: 'lane_direction',
  sentido_de_via: 'lane_direction',
  lane_direction: 'lane_direction',
  radar: 'radar_code',
  radar_code: 'radar_code',
  operador: 'operator_entity',
  concesionario: 'operator_entity',
  operator_entity: 'operator_entity',
  fecha_instalacion: 'installation_date',
  installation_date: 'installation_date',
  fecha_calibracion: 'last_calibration_date',
  ultima_calibracion: 'last_calibration_date',
  last_calibration_date: 'last_calibration_date',
  descripcion: 'description',
  description: 'description',
  observaciones: 'observations',
  observations: 'observations',
  latitud: 'latitude',
  latitude: 'latitude',
  longitud: 'longitude',
  longitude: 'longitude',
}

// Admite "6.1719" y "6,1719" (Excel en español), igual que signals.service.ts.
const coordinateSchema = z.preprocess((val) => {
  if (typeof val === 'number') return val
  if (typeof val === 'string') {
    const cleaned = val.trim().replace(',', '.')
    if (cleaned === '') return NaN
    return Number(cleaned)
  }
  return NaN
}, z.number({ message: 'Debe ser un número (use punto para decimales, ej. 6.1719)' }))

const optionalNumberField = () =>
  z.preprocess((val) => {
    if (val === undefined || val === null || val === '') return undefined
    if (typeof val === 'number') return val
    const cleaned = String(val).trim().replace(',', '.')
    return cleaned === '' ? undefined : Number(cleaned)
  }, z.number().int().positive().optional())

const requiredTextField = (msg: string) =>
  z.preprocess(rawToText, z.string().trim().min(1, msg))

const optionalTextField = () =>
  z.preprocess(rawToText, z.string().trim().optional().or(z.literal('')))

const bulkCameraRowSchema = z.object({
  camera_code: requiredTextField('Código requerido'),
  camera_type: optionalTextField(),
  status: optionalTextField(),
  serial_number: optionalTextField(),
  brand: optionalTextField(),
  model: optionalTextField(),
  municipality: requiredTextField('Municipio requerido'),
  zone: optionalTextField(),
  address: optionalTextField(),
  speed_limit_kmh: optionalNumberField(),
  lane_direction: optionalTextField(),
  radar_code: optionalTextField(),
  operator_entity: optionalTextField(),
  installation_date: optionalTextField(),
  last_calibration_date: optionalTextField(),
  description: optionalTextField(),
  observations: optionalTextField(),
  latitude: coordinateSchema,
  longitude: coordinateSchema,
})

export const bulkImportCameras = async (
  rawRows: Record<string, unknown>[],
  installedBy: string
) => {
  if (!rawRows || rawRows.length === 0) {
    throw new Error('El archivo no tiene filas para importar')
  }

  const REQUIRED_FIELDS = ['camera_code', 'municipality']
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

  const [{ data: municipalities }, { data: zones }] = await Promise.all([
    supabase.from('municipalities').select('id, name'),
    supabase.from('zones').select('id, name'),
  ])

  const byName = (list: { id: string; name: string }[] | null) => {
    const map = new Map<string, string>()
    for (const item of list ?? []) map.set(item.name.trim().toLowerCase(), item.id)
    return map
  }

  const municipalityMap = byName(municipalities)
  const zoneMap = byName(zones)

  const errors: BulkImportRowError[] = []
  const toInsert: Record<string, unknown>[] = []
  const seenCodes = new Set<string>()

  rows.forEach((row, idx) => {
    const rowNumber = idx + 2
    const parsed = bulkCameraRowSchema.safeParse(row)

    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(', ')
      errors.push({ row: rowNumber, message: msg })
      return
    }

    const data = parsed.data
    const codeKey = data.camera_code.toLowerCase()

    if (seenCodes.has(codeKey)) {
      errors.push({ row: rowNumber, message: `Código duplicado dentro del archivo: "${data.camera_code}"` })
      return
    }
    seenCodes.add(codeKey)

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

    let cameraType = 'FIJA'
    if (data.camera_type) {
      const upper = data.camera_type.toUpperCase()
      if (!CAMERA_TYPES.includes(upper as (typeof CAMERA_TYPES)[number])) {
        errors.push({ row: rowNumber, message: `Tipo inválido: "${data.camera_type}" (use FIJA o MOVIL)` })
        return
      }
      cameraType = upper
    }

    let status = 'EN_SERVICIO'
    if (data.status) {
      const upper = data.status.toUpperCase()
      if (!CAMERA_STATUSES.includes(upper as (typeof CAMERA_STATUSES)[number])) {
        errors.push({ row: rowNumber, message: `Estado inválido: "${data.status}" (use EN_SERVICIO, FUERA_DE_SERVICIO, EN_MANTENIMIENTO o DESCALIBRADA)` })
        return
      }
      status = upper
    }

    // Misma categorización automática que createCamera/updateCamera: una fila
    // sin estado explícito (o con EN_SERVICIO) pero con calibración ya vencida
    // entra directamente como DESCALIBRADA.
    if (status === 'EN_SERVICIO' && isCalibrationOverdue(data.last_calibration_date || null)) {
      status = 'DESCALIBRADA'
    }

    if (Number.isNaN(data.latitude) || Number.isNaN(data.longitude)) {
      errors.push({ row: rowNumber, message: 'Latitud/longitud inválida' })
      return
    }

    toInsert.push({
      camera_code: data.camera_code,
      camera_type: cameraType,
      status,
      serial_number: data.serial_number || null,
      brand: data.brand || null,
      model: data.model || null,
      municipality_id: municipalityId,
      zone_id: zoneId,
      address: data.address || null,
      speed_limit_kmh: data.speed_limit_kmh ?? null,
      lane_direction: data.lane_direction || null,
      radar_code: data.radar_code || null,
      operator_entity: data.operator_entity || null,
      installation_date: data.installation_date || null,
      last_calibration_date: data.last_calibration_date || null,
      description: data.description || null,
      observations: data.observations || null,
      latitude: data.latitude,
      longitude: data.longitude,
      installed_by: installedBy,
    })
  })

  if (errors.length > 0) {
    throw new BulkImportError(errors)
  }

  const codes = toInsert.map((r) => r.camera_code as string)
  const { data: existing, error: existingError } = await supabase
    .from('cameras')
    .select('camera_code')
    .in('camera_code', codes)

  if (existingError) throw new Error(existingError.message)

  if (existing && existing.length > 0) {
    throw new BulkImportError(
      existing.map((e) => ({ row: 0, message: `El código "${e.camera_code}" ya existe en el sistema` }))
    )
  }

  const { data: inserted, error } = await supabase
    .from('cameras')
    .insert(toInsert)
    .select('id')

  if (error) throw new Error(error.message)

  return { inserted: inserted?.length ?? 0 }
}

// --- Job periódico: cámaras que vencen su calibración sin que nadie las edite ---
//
// createCamera/updateCamera/bulkImportCameras ya categorizan automáticamente
// en el momento en que se crea o edita una cámara, pero una cámara que se
// deja quieta (nadie la toca) igual debe pasar a DESCALIBRADA el día que se
// cumple el año desde su última calibración. Solo se tocan cámaras activas
// que siguen en EN_SERVICIO — si ya están en FUERA_DE_SERVICIO o
// EN_MANTENIMIENTO se respeta esa decisión manual en vez de pisarla.
// Mismo patrón de setInterval en proceso que startOverdueMaintenanceJob
// (maintenances.service.ts): no hay cron nativo en este Express plano y
// basta a esta escala (un solo servidor, sin múltiples instancias).
const CALIBRATION_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000 // cada 6 horas

export const checkCameraCalibrations = async () => {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - CALIBRATION_VALIDITY_DAYS)
  const cutoffIso = cutoff.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('cameras')
    .select('id')
    .eq('is_active', true)
    .eq('status', 'EN_SERVICIO')
    .lt('last_calibration_date', cutoffIso)

  if (error) {
    logger.error({ err: error, module: 'cameras' }, 'error revisando calibración de cámaras')
    return
  }

  for (const cam of data ?? []) {
    try {
      const { error: updateError } = await supabase
        .from('cameras')
        .update({ status: 'DESCALIBRADA', updated_at: new Date().toISOString() })
        .eq('id', cam.id)

      if (updateError) throw new Error(updateError.message)

      void logAudit({
        userId: null,
        action: 'UPDATE',
        tableName: 'cameras',
        recordId: cam.id as string,
        oldData: { status: 'EN_SERVICIO' },
        newData: { status: 'DESCALIBRADA', reason: 'calibración vencida (automático)' },
      })
    } catch (err) {
      logger.error({ err, module: 'cameras', cameraId: cam.id }, 'error marcando cámara como descalibrada')
    }
  }
}

export const startCameraCalibrationJob = () => {
  setTimeout(() => void checkCameraCalibrations(), 45 * 1000)
  setInterval(() => void checkCameraCalibrations(), CALIBRATION_CHECK_INTERVAL_MS)
}
