import { Request, Response } from 'express'
import { ZodError } from 'zod'
import {
  getZones,
  getZoneById,
  createZone,
  updateZone,
  deleteZone,
  createZoneSchema,
  updateZoneSchema,
  zoneFiltersSchema,
} from './zones.service'
import { logAudit } from '../../lib/audit'

const handleError = (res: Response, error: unknown) => {
  if (error instanceof ZodError) {
    const msgs = error.issues.map((i) => i.message).join(', ')
    return res.status(422).json({ message: msgs })
  }
  if (error instanceof Error) {
    return res.status(400).json({ message: error.message })
  }
  return res.status(500).json({ message: 'Error interno del servidor' })
}

export const list = async (req: Request, res: Response) => {
  try {
    const filters = zoneFiltersSchema.parse(req.query)
    const result = await getZones(filters)
    return res.json(result)
  } catch (error) {
    return handleError(res, error)
  }
}

export const getOne = async (req: Request, res: Response) => {
  try {
    const zone = await getZoneById(req.params.id as string)
    return res.json(zone)
  } catch (error) {
    if (error instanceof Error && error.message === 'Zona no encontrada') {
      return res.status(404).json({ message: error.message })
    }
    return handleError(res, error)
  }
}

export const create = async (req: Request, res: Response) => {
  try {
    const data = createZoneSchema.parse(req.body)
    const zone = await createZone(data)
    void logAudit({ userId: req.user!.userId, action: 'CREATE', tableName: 'zones', recordId: zone.id, newData: zone })
    return res.status(201).json(zone)
  } catch (error) {
    return handleError(res, error)
  }
}

export const update = async (req: Request, res: Response) => {
  try {
    const data = updateZoneSchema.parse(req.body)
    const previous = await getZoneById(req.params.id as string).catch(() => null)
    const zone = await updateZone(req.params.id as string, data)
    void logAudit({ userId: req.user!.userId, action: 'UPDATE', tableName: 'zones', recordId: zone.id, oldData: previous, newData: zone })
    return res.json(zone)
  } catch (error) {
    if (error instanceof Error && error.message === 'Zona no encontrada') {
      return res.status(404).json({ message: error.message })
    }
    return handleError(res, error)
  }
}

export const remove = async (req: Request, res: Response) => {
  try {
    const previous = await getZoneById(req.params.id as string).catch(() => null)
    await deleteZone(req.params.id as string)
    void logAudit({ userId: req.user!.userId, action: 'DELETE', tableName: 'zones', recordId: req.params.id as string, oldData: previous })
    return res.json({ message: 'Zona eliminada' })
  } catch (error) {
    if (error instanceof Error && error.message === 'Zona no encontrada') {
      return res.status(404).json({ message: error.message })
    }
    return handleError(res, error)
  }
}
