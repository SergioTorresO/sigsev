import { Request, Response } from 'express'
import { ZodError } from 'zod'
import {
  getMaintenances,
  getMaintenanceById,
  createMaintenance,
  updateMaintenance,
  createMaintenanceSchema,
  updateMaintenanceSchema,
  maintenanceFiltersSchema,
} from './maintenances.service'
import { createNotification } from '../notifications/notifications.service'
import { logAudit } from '../../lib/audit'

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

    const maintenance = await createMaintenance(data, assignedTo)

    void logAudit({ userId: req.user!.userId, action: 'CREATE', tableName: 'maintenances', recordId: maintenance.id, newData: maintenance })

    // Notifica al técnico solo si un ADMIN/SUPERVISOR le asignó el mantenimiento a otra persona
    if (canAssign && assignedTo !== req.user!.userId) {
      await createNotification({
        type: 'ASSIGNMENT',
        title: 'Nuevo mantenimiento asignado',
        message: `Se te asignó un mantenimiento de la señal ${(maintenance as { signals?: { signal_code?: string } | null }).signals?.signal_code ?? ''}.`,
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
