import { Request, Response } from 'express'
import { ZodError } from 'zod'
import {
  getMaintenances,
  getMaintenanceById,
  createMaintenance,
  updateMaintenance,
  completeMaintenance,
  createMaintenanceSchema,
  updateMaintenanceSchema,
  completeMaintenanceSchema,
  maintenanceFiltersSchema,
} from './maintenances.service'
import { createNotification } from '../notifications/notifications.service'
import { logAudit } from '../../lib/audit'
import { uploadEvidenceImage } from '../../lib/storage'
import { assertAssigneeRole } from '../../lib/assignment'
import supabase from '../../lib/supabase'

// Un mantenimiento es trabajo de campo: solo tiene sentido asignárselo a un TECNICO.
// ADMIN/SUPERVISOR asignan pero nunca son ellos quienes lo ejecutan.
const MAINTENANCE_ASSIGNEE_ROLES = ['TECNICO']

const handleError = (res: Response, error: unknown) => {
  if (error instanceof ZodError) {
    return res.status(422).json({ message: error.issues.map((i) => i.message).join(', ') })
  }
  if (error instanceof Error) {
    return res.status(400).json({ message: error.message })
  }
  return res.status(500).json({ message: 'Error interno del servidor' })
}

export const list = async (req: Request, res: Response) => {
  try {
    const filters = maintenanceFiltersSchema.parse(req.query)
    const result = await getMaintenances(filters)
    return res.json(result)
  } catch (error) {
    return handleError(res, error)
  }
}

export const getOne = async (req: Request, res: Response) => {
  try {
    const maintenance = await getMaintenanceById(req.params.id as string)
    return res.json(maintenance)
  } catch (error) {
    if (error instanceof Error && error.message === 'Mantenimiento no encontrado') {
      return res.status(404).json({ message: error.message })
    }
    return handleError(res, error)
  }
}

const CAN_ASSIGN_ROLES = ['ADMIN', 'SUPERVISOR']

export const create = async (req: Request, res: Response) => {
  try {
    const data = createMaintenanceSchema.parse(req.body)

    // Solo ADMIN/SUPERVISOR pueden asignar el mantenimiento a otro técnico distinto de ellos mismos.
    const canAssign = CAN_ASSIGN_ROLES.includes(req.user!.roleName ?? '')
    const assignedTo = canAssign && data.assigned_to ? data.assigned_to : req.user!.userId

    if (canAssign && data.assigned_to) {
      await assertAssigneeRole(assignedTo, MAINTENANCE_ASSIGNEE_ROLES, 'Un mantenimiento')
    }

    const maintenance = await createMaintenance(data, assignedTo)

    void logAudit({ userId: req.user!.userId, action: 'CREATE', tableName: 'maintenances', recordId: maintenance.id, newData: maintenance })

    // Notifica al técnico solo si un ADMIN/SUPERVISOR le asignó el mantenimiento a otra persona.
    // El mensaje queda en tercera persona (quién asignó a quién) porque ADMIN/SUPERVISOR ven
    // todas las notificaciones, no solo las propias, y necesitan saber de quién es cada una.
    if (canAssign && assignedTo !== req.user!.userId) {
      const { data: assigner } = await supabase.from('users').select('full_name').eq('id', req.user!.userId).maybeSingle()
      const signalCode = (maintenance as { signals?: { signal_code?: string } | null }).signals?.signal_code ?? ''
      const assigneeName = (maintenance as { users?: { full_name?: string } | null }).users?.full_name ?? 'un técnico'

      await createNotification({
        type: 'ASSIGNMENT',
        title: 'Nuevo mantenimiento asignado',
        message: `${assigner?.full_name ?? 'Alguien'} le asignó a ${assigneeName} el mantenimiento de la señal ${signalCode}.`,
        target_user_id: assignedTo,
        maintenance_id: maintenance.id,
      })
    }

    return res.status(201).json(maintenance)
  } catch (error) {
    return handleError(res, error)
  }
}

export const update = async (req: Request, res: Response) => {
  try {
    const data = updateMaintenanceSchema.parse(req.body)

    if (data.assigned_to) {
      await assertAssigneeRole(data.assigned_to, MAINTENANCE_ASSIGNEE_ROLES, 'Un mantenimiento')
    }

    const previous = await getMaintenanceById(req.params.id as string).catch(() => null)
    const maintenance = await updateMaintenance(req.params.id as string, data)
    void logAudit({ userId: req.user!.userId, action: 'UPDATE', tableName: 'maintenances', recordId: maintenance.id, oldData: previous, newData: maintenance })
    return res.json(maintenance)
  } catch (error) {
    if (error instanceof Error && error.message === 'Mantenimiento no encontrado') {
      return res.status(404).json({ message: error.message })
    }
    return handleError(res, error)
  }
}

// El técnico (dueño de la asignación) o ADMIN/SUPERVISOR marcan el mantenimiento
// como realizado: requiere foto de evidencia (multer ya la deja en req.file).
export const complete = async (req: Request, res: Response) => {
  try {
    const previous = await getMaintenanceById(req.params.id as string)

    const isOwner = (previous as { assigned_to?: string | null }).assigned_to === req.user!.userId
    const isManager = CAN_ASSIGN_ROLES.includes(req.user!.roleName ?? '')
    if (!isOwner && !isManager) {
      return res.status(403).json({ message: 'No puedes completar un mantenimiento que no te fue asignado' })
    }

    if (!req.file) {
      return res.status(422).json({ message: 'Debes adjuntar una foto como evidencia' })
    }

    const body = Object.fromEntries(Object.entries(req.body).filter(([, v]) => v !== ''))
    const data = completeMaintenanceSchema.parse(body)

    const evidenceImageUrl = await uploadEvidenceImage(req.file, `maintenances/${req.params.id}`)
    const maintenance = await completeMaintenance(req.params.id as string, data, evidenceImageUrl, req.user!.userId)

    void logAudit({ userId: req.user!.userId, action: 'UPDATE', tableName: 'maintenances', recordId: maintenance.id, oldData: previous, newData: maintenance })

    return res.json(maintenance)
  } catch (error) {
    if (error instanceof Error && error.message === 'Mantenimiento no encontrado') {
      return res.status(404).json({ message: error.message })
    }
    return handleError(res, error)
  }
}
