import supabase from '../../lib/supabase'
import { z } from 'zod'

export const auditFiltersSchema = z.object({
  table_name: z.string().optional(),
  action: z.enum(['CREATE', 'UPDATE', 'DELETE', 'TOGGLE_ACTIVE', 'BULK_IMPORT']).optional(),
  user_id: z.string().uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  page: z.string().transform(Number).optional(),
  limit: z.string().transform(Number).optional(),
})

export type AuditFilters = z.infer<typeof auditFiltersSchema>

const AUDIT_SELECT = `
  id, action, table_name, record_id, old_data, new_data, created_at,
  users(id, full_name, email)
`

export const getAuditLogs = async (filters: AuditFilters) => {
  const { table_name, action, user_id, date_from, date_to, page = 1, limit = 30 } = filters

  let query = supabase
    .from('audit_logs')
    .select(AUDIT_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (table_name) query = query.eq('table_name', table_name)
  if (action) query = query.eq('action', action)
  if (user_id) query = query.eq('user_id', user_id)
  if (date_from) query = query.gte('created_at', date_from)
  if (date_to) query = query.lte('created_at', date_to)

  const { data, error, count } = await query
  if (error) throw new Error(error.message)

  return { data: data ?? [], total: count ?? 0, page, limit }
}
