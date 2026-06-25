import supabase from '../../lib/supabase'
import { z } from 'zod'
import { createNotification } from '../notifications/notifications.service'
import logger from '../../lib/logger'

export const createMaintenanceSchema = z.object({
  signal_id: z.string().uuid('signal_id debe ser UUID'),
  description: z.string().trim().min(1, 'Descripción requerida'),
  cost: z.number().positive().optional(),
  maintenance_date: z.string().optional(),
  // Solo ADMIN/SUPERVISOR pueden usar este campo para asignar el mantenimiento a otro técnico
  // (ver maintenances.controller.ts). Si no se envía o el rol no califica, se asigna al creador.
  assigned_to: z.string().uuid().optional(),
})

export const updateMaintenanceSchema = z.object({
  status: z.enum(['PENDIENTE', 'EN_PROCESO', 'COMPLETADO']).optional(),
  description: z.string().trim().optional(),
  cost: z.number().positive().optional(),
  maintenance_date: z.string().optional(),
  assigned_to: z.string().uuid().optional(),
})

export const maintenanceFiltersSchema = z.object({
  signal_id: z.string().uuid().optional(),
  assigned_to: z.string().uuid().optional(),
  status: z.enum(['PENDIENTE', 'EN_PROCESO', 'COMPLETADO']).optional(),
  page: z.string().transform(Number).optional(),
  limit: z.string().transform(Number).optional(),
})

type CreateMaintenanceDTO = z.infer<typeof createMaintenanceSchema>
type UpdateMaintenanceDTO = z.infer<typeof updateMaintenanceSchema>
type MaintenanceFilters = z.infer<typeof maintenanceFiltersSchema>

const MAINTENANCE_SELECT = `
  id, status, description, cost, maintenance_date, completed_at, created_at,
  signals(id, signal_code, address),
  users(id, full_name)
`

export const getMaintenances = async (filters: MaintenanceFilters) => {
  const { signal_id, assigned_to, status, page = 1, limit = 20 } = filters

  let query = supabase
    .from('maintenances')
    .select(MAINTENANCE_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (signal_id) query = query.eq('signal_id', signal_id)
  if (assigned_to) query = query.eq('assigned_to', assigned_to)
  if (status) query = query.eq('status', status)

  const { data, error, count } = await query
  if (error) throw new Error(error.message)

  return { data: data ?? [], total: count ?? 0, page, limit }
}

export const getMaintenanceById = async (id: string) => {
  const { data, error } = await supabase
    .from('maintenances')
    .select(MAINTENANCE_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Mantenimiento no encontrado')
  return data
}

export const createMaintenance = async (data: CreateMaintenanceDTO, assignedTo: string) => {
  const { data: signal } = await supabase
    .from('signals').select('id').eq('id', data.signal_id).maybeSingle()
  if (!signal) throw new Error('Señal no encontrada')

  const { data: maintenance, error } = await supabase
    .from('maintenances')
    .insert({ ...data, assigned_to: assignedTo, status: 'PENDIENTE' })
    .select(MAINTENANCE_SELECT)
    .single()

  if (error) throw new Error(error.message)
  return maintenance
}

export const updateMaintenance = async (id: string, data: UpdateMaintenanceDTO) => {
  await getMaintenanceById(id)

  const updateData: Record<string, unknown> = { ...data }
  if (data.status === 'COMPLETADO') {
    updateData.completed_at = new Date().toISOString()
  }

  const { data: maintenance, error } = await supabase
    .from('maintenances')
    .update(updateData)
    .eq('id', id)
    .select(MAINTENANCE_SELECT)
    .single()

  if (error) throw new Error(error.message)
  return maintenance
}

// --- Notificación de mantenimientos vencidos ---
//
// No hay cron nativo en este Express plano, así que usamos un setInterval en
// proceso. `overdue_notified` evita notificar el mismo mantenimiento vencido
// más de una vez (si se reactiva — vuelve a PENDIENTE/EN_PROCESO con fecha
// pasada — sí se vuelve a notificar, porque eso es una situación nueva).
const OVERDUE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000 // cada 6 horas

export const checkOverdueMaintenances = async () => {
  const today = new Date().toISOString().slice(0, 10)

  const { data: overdue, error } = await supabase
    .from('maintenances')
    .select('id, description, maintenance_date, assigned_to, signals(signal_code)')
    .in('status', ['PENDIENTE', 'EN_PROCESO'])
    .lt('maintenance_date', today)
    .eq('overdue_notified', false)

  if (error) {
    logger.error({ err: error, module: 'maintenances' }, 'error revisando mantenimientos vencidos')
    return
  }

  for (const m of overdue ?? []) {
    const signalCode = (m as { signals?: { signal_code?: string } | null }).signals?.signal_code ?? ''
    try {
      await createNotification({
        type: 'MAINTENANCE_OVERDUE',
        title: 'Mantenimiento vencido',
        message: `El mantenimiento de la señal ${signalCode} programado para ${m.maintenance_date} sigue pendiente.`,
        target_user_id: m.assigned_to as string | null,
        maintenance_id: m.id as string,
      })

      await supabase.from('maintenances').update({ overdue_notified: true }).eq('id', m.id)
    } catch (err) {
      logger.error({ err, module: 'maintenances', maintenanceId: m.id }, 'error notificando mantenimiento vencido')
    }
  }
}

export const startOverdueMaintenanceJob = () => {
  // Primera corrida poco después del arranque (da tiempo a que el server esté listo)
  setTimeout(() => void checkOverdueMaintenances(), 30 * 1000)
  setInterval(() => void checkOverdueMaintenances(), OVERDUE_CHECK_INTERVAL_MS)
}
