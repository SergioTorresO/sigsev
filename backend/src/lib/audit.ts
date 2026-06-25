import supabase from './supabase'
import logger from './logger'

// Acciones auditadas. La tabla audit_logs ya existía en el esquema de Supabase
// (sin uso hasta ahora) — la reutilizamos en vez de crear una nueva.
export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'TOGGLE_ACTIVE' | 'BULK_IMPORT'

interface LogAuditParams {
  userId: string | null | undefined
  action: AuditAction
  tableName: string
  recordId?: string | null
  oldData?: unknown
  newData?: unknown
}

// Igual que con los correos de notificación: registrar un log de auditoría
// nunca debe romper la operación principal (crear/editar/eliminar). Si falla
// la inserción, solo se loggea en consola.
export const logAudit = async ({ userId, action, tableName, recordId, oldData, newData }: LogAuditParams) => {
  try {
    const { error } = await supabase.from('audit_logs').insert({
      user_id: userId ?? null,
      action,
      table_name: tableName,
      record_id: recordId ?? null,
      old_data: oldData ?? null,
      new_data: newData ?? null,
    })
    if (error) throw new Error(error.message)
  } catch (err) {
    logger.error({ err, module: 'audit', tableName, action }, 'error registrando log de auditoría')
  }
}
