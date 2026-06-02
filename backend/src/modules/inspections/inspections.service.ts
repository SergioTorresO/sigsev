import supabase from '../../lib/supabase'
import { z } from 'zod'

export const createInspectionSchema = z.object({
  signal_id: z.string().uuid('signal_id debe ser UUID'),
  status: z.enum(['BUENO', 'REGULAR', 'DETERIORADO', 'CAIDO', 'DESAPARECIDO']),
  observations: z.string().trim().optional(),
  evidence_image: z.string().url().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
})

export const updateInspectionSchema = createInspectionSchema.partial().omit({ signal_id: true })

export const inspectionFiltersSchema = z.object({
  signal_id: z.string().uuid().optional(),
  technician_id: z.string().uuid().optional(),
  status: z.enum(['BUENO', 'REGULAR', 'DETERIORADO', 'CAIDO', 'DESAPARECIDO']).optional(),
  page: z.string().transform(Number).optional(),
  limit: z.string().transform(Number).optional(),
})

type CreateInspectionDTO = z.infer<typeof createInspectionSchema>
type UpdateInspectionDTO = z.infer<typeof updateInspectionSchema>
type InspectionFilters = z.infer<typeof inspectionFiltersSchema>

const INSPECTION_SELECT = `
  id, status, observations, evidence_image, latitude, longitude,
  inspection_date, created_at,
  signals(id, signal_code, address, latitude, longitude),
  users(id, full_name),
  evidences(id, image_url, description, created_at)
`

export const getInspections = async (filters: InspectionFilters) => {
  const { signal_id, technician_id, status, page = 1, limit = 20 } = filters

  let query = supabase
    .from('inspections')
    .select(INSPECTION_SELECT, { count: 'exact' })
    .order('inspection_date', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (signal_id) query = query.eq('signal_id', signal_id)
  if (technician_id) query = query.eq('technician_id', technician_id)
  if (status) query = query.eq('status', status)

  const { data, error, count } = await query
  if (error) throw new Error(error.message)

  return { data: data ?? [], total: count ?? 0, page, limit }
}

export const getInspectionById = async (id: string) => {
  const { data, error } = await supabase
    .from('inspections')
    .select(INSPECTION_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Inspección no encontrada')
  return data
}

export const createInspection = async (data: CreateInspectionDTO, technicianId: string) => {
  const { data: signal } = await supabase
    .from('signals').select('id').eq('id', data.signal_id).maybeSingle()
  if (!signal) throw new Error('Señal no encontrada')

  const { data: inspection, error } = await supabase
    .from('inspections')
    .insert({ ...data, technician_id: technicianId })
    .select(INSPECTION_SELECT)
    .single()

  if (error) throw new Error(error.message)

  // Update signal status
  await supabase
    .from('signals')
    .update({ status: data.status, updated_at: new Date().toISOString() })
    .eq('id', data.signal_id)

  return inspection
}

export const updateInspection = async (id: string, data: UpdateInspectionDTO) => {
  await getInspectionById(id)

  const { data: inspection, error } = await supabase
    .from('inspections')
    .update(data)
    .eq('id', id)
    .select(INSPECTION_SELECT)
    .single()

  if (error) throw new Error(error.message)
  return inspection
}
