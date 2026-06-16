import { Request, Response } from 'express'
import { ZodError } from 'zod'
import {
  getInspections,
  getInspectionById,
  createInspection,
  updateInspection,
  createInspectionSchema,
  updateInspectionSchema,
  inspectionFiltersSchema,
} from './inspections.service'

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
    const filters = inspectionFiltersSchema.parse(req.query)
    const result = await getInspections(filters)
    return res.json(result)
  } catch (error) {
    return handleError(res, error)
  }
}

export const getOne = async (req: Request, res: Response) => {
  try {
    const inspection = await getInspectionById(req.params.id as string)
    return res.json(inspection)
  } catch (error) {
    if (error instanceof Error && error.message === 'Inspección no encontrada') {
      return res.status(404).json({ message: error.message })
    }
    return handleError(res, error)
  }
}

const CAN_ASSIGN_ROLES = ['ADMIN', 'SUPERVISOR']

export const create = async (req: Request, res: Response) => {
  try {
    const data = createInspectionSchema.parse(req.body)

    // Solo ADMIN/SUPERVISOR pueden asignar la inspección a otro técnico distinto de ellos mismos.
    const canAssign = CAN_ASSIGN_ROLES.includes(req.user!.roleName ?? '')
    const technicianId = canAssign && data.technician_id ? data.technician_id : req.user!.userId

    const inspection = await createInspection(data, technicianId)
    return res.status(201).json(inspection)
  } catch (error) {
    return handleError(res, error)
  }
}

export const update = async (req: Request, res: Response) => {
  try {
    const data = updateInspectionSchema.parse(req.body)
    const inspection = await updateInspection(req.params.id as string, data)
    return res.json(inspection)
  } catch (error) {
    if (error instanceof Error && error.message === 'Inspección no encontrada') {
      return res.status(404).json({ message: error.message })
    }
    return handleError(res, error)
  }
}
