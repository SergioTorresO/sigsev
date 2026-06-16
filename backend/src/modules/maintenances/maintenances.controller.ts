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
    return res.status(201).json(maintenance)
  } catch (error) {
    return handleError(res, error)
  }
}

export const update = async (req: Request, res: Response) => {
  try {
    const data = updateMaintenanceSchema.parse(req.body)
    const maintenance = await updateMaintenance(req.params.id as string, data)
    return res.json(maintenance)
  } catch (error) {
    if (error instanceof Error && error.message === 'Mantenimiento no encontrado') {
      return res.status(404).json({ message: error.message })
    }
    return handleError(res, error)
  }
}
