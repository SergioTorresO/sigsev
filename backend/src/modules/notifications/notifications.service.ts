import supabase from '../../lib/supabase'
import { z } from 'zod'
import { sendNotificationEmail, isEmailConfigured } from '../../lib/email'
import logger from '../../lib/logger'

const ADMIN_ROLES = ['ADMIN', 'SUPERVISOR']

export type NotificationType = 'SIGNAL_BAD_STATUS' | 'MAINTENANCE_OVERDUE' | 'ASSIGNMENT' | 'MAINTENANCE_NEEDED'

export const notificationFiltersSchema = z.object({
  unread_only: z.string().transform((v) => v === 'true').optional(),
  page: z.string().transform(Number).optional(),
  limit: z.string().transform(Number).optional(),
})

type NotificationFilters = z.infer<typeof notificationFiltersSchema>

const NOTIFICATION_SELECT = `
  id, type, title, message, user_id, is_read, created_at,
  signal_id, inspection_id, maintenance_id,
  signals(id, signal_code, address),
  maintenances(id, description)
`

// user_id = null  -> notificación "broadcast", visible solo para ADMIN/SUPERVISOR
//                    (ej. una señal cualquiera entró en mal estado).
// user_id = <uuid> -> visible para ese técnico específico Y para ADMIN/SUPERVISOR
//                    (que ven todo sin importar la asignación).
const isAdminRole = (roleName: string) => ADMIN_ROLES.includes(roleName)

export const getNotificationsForUser = async (
  userId: string,
  roleName: string,
  filters: NotificationFilters
) => {
  const { unread_only, page = 1, limit = 20 } = filters

  let query = supabase
    .from('notifications')
    .select(NOTIFICATION_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (!isAdminRole(roleName)) {
    query = query.eq('user_id', userId)
  }
  if (unread_only) query = query.eq('is_read', false)

  const { data, error, count } = await query
  if (error) throw new Error(error.message)

  return { data: data ?? [], total: count ?? 0, page, limit }
}

export const getUnreadCount = async (userId: string, roleName: string) => {
  let query = supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false)

  if (!isAdminRole(roleName)) {
    query = query.eq('user_id', userId)
  }

  const { count, error } = await query
  if (error) throw new Error(error.message)
  return { count: count ?? 0 }
}

export const markNotificationRead = async (id: string, userId: string, roleName: string) => {
  const { data: existing, error: fetchError } = await supabase
    .from('notifications')
    .select('id, user_id')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) throw new Error(fetchError.message)
  if (!existing) throw new Error('Notificación no encontrada')

  // Un técnico solo puede marcar como leídas sus propias notificaciones;
  // ADMIN/SUPERVISOR pueden marcar cualquiera (ven todas igual).
  if (!isAdminRole(roleName) && existing.user_id !== userId) {
    throw new Error('No tienes permiso sobre esta notificación')
  }

  const { data, error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
    .select(NOTIFICATION_SELECT)
    .single()

  if (error) throw new Error(error.message)
  return data
}

export const markAllNotificationsRead = async (userId: string, roleName: string) => {
  let query = supabase.from('notifications').update({ is_read: true }).eq('is_read', false)

  if (!isAdminRole(roleName)) {
    query = query.eq('user_id', userId)
  }

  const { error } = await query
  if (error) throw new Error(error.message)
  return { message: 'Notificaciones marcadas como leídas' }
}

// Vacía la bandeja: borra físicamente las notificaciones visibles para el usuario.
// Mismo alcance que getNotificationsForUser: TECNICO/CONSULTA solo ven (y borran)
// las suyas (user_id = userId); ADMIN/SUPERVISOR ven todas sin filtro, así que
// vaciar su bandeja borra todas las notificaciones de la tabla — son compartidas
// entre todos los admins, igual que ya ocurre con "marcar todas como leídas".
export const clearAllNotifications = async (userId: string, roleName: string) => {
  let query = supabase.from('notifications').delete().not('id', 'is', null)

  if (!isAdminRole(roleName)) {
    query = query.eq('user_id', userId)
  }

  const { error } = await query
  if (error) throw new Error(error.message)
  return { message: 'Bandeja de notificaciones vaciada' }
}

interface CreateNotificationInput {
  type: NotificationType
  title: string
  message: string
  // null = broadcast para ADMIN/SUPERVISOR; con valor = ese técnico específico
  target_user_id?: string | null
  signal_id?: string
  inspection_id?: string
  maintenance_id?: string
}

// Crea la notificación en BD y, en paralelo, intenta enviar el correo
// correspondiente. El envío de correo nunca debe tumbar la operación principal
// (crear una inspección, asignar un mantenimiento, etc.) — se loguea y se sigue.
export const createNotification = async (input: CreateNotificationInput) => {
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      type: input.type,
      title: input.title,
      message: input.message,
      user_id: input.target_user_id ?? null,
      signal_id: input.signal_id ?? null,
      inspection_id: input.inspection_id ?? null,
      maintenance_id: input.maintenance_id ?? null,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  void notifyByEmail(input).catch((err) => {
    logger.error({ err, module: 'notifications' }, 'error enviando correo de notificación')
  })

  return data
}

const notifyByEmail = async (input: CreateNotificationInput) => {
  if (!isEmailConfigured()) return

  const recipients = await getEmailRecipients(input.target_user_id ?? null)
  if (recipients.length === 0) return

  await Promise.all(
    recipients.map((email) => sendNotificationEmail(email, input.title, input.message))
  )
}

// Sin target_user_id (broadcast): correo a todos los ADMIN/SUPERVISOR activos.
// Con target_user_id: correo solo a ese técnico (los admins ya ven todo en la
// campanita; no se les saturan los correos con asignaciones de otros).
const getEmailRecipients = async (targetUserId: string | null): Promise<string[]> => {
  if (targetUserId) {
    const { data } = await supabase
      .from('users')
      .select('email, is_active')
      .eq('id', targetUserId)
      .maybeSingle()
    return data && data.is_active ? [data.email as string] : []
  }

  const { data } = await supabase
    .from('users')
    .select('email, is_active, roles(name)')
    .eq('is_active', true)

  return (data ?? [])
    .filter((u) => {
      const rolesData = u.roles as unknown as { name: string } | { name: string }[] | null
      const roleName = (Array.isArray(rolesData) ? rolesData[0]?.name : rolesData?.name) ?? ''
      return ADMIN_ROLES.includes(roleName)
    })
    .map((u) => u.email as string)
}
