import { Request, Response } from 'express'
import { ZodError } from 'zod'
import {
  getSignals,
  getSignalById,
  createSignal,
  updateSignal,
  deleteSignal,
  createSignalSchema,
  updateSignalSchema,
  signalFiltersSchema,
} from './signals.service'

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
    const filters = signalFiltersSchema.parse(req.query)
    const result = await getSignals(filters)
    return res.json(result)
  } catch (error) {
    return handleError(res, error)
  }
}

export const getOne = async (req: Request, res: Response) => {
  try {
    const signal = await getSignalById(req.params.id as string)
    return res.json(signal)
  } catch (error) {
    if (error instanceof Error && error.message === 'Señal no encontrada') {
      return res.status(404).json({ message: error.message })
    }
    return handleError(res, error)
  }
}

export const create = async (req: Request, res: Response) => {
  try {
    const data = createSignalSchema.parse(req.body)
    const signal = await createSignal(data, req.user!.userId)
    return res.status(201).json(signal)
  } catch (error) {
    return handleError(res, error)
  }
}

export const update = async (req: Request, res: Response) => {
  try {
    const data = updateSignalSchema.parse(req.body)
    const signal = await updateSignal(req.params.id as string, data)
    return res.json(signal)
  } catch (error) {
    if (error instanceof Error && error.message === 'Señal no encontrada') {
      return res.status(404).json({ message: error.message })
    }
    return handleError(res, error)
  }
}

export const remove = async (req: Request, res: Response) => {
  try {
    await deleteSignal(req.params.id as string)
    return res.json({ message: 'Señal desactivada' })
  } catch (error) {
    if (error instanceof Error && error.message === 'Señal no encontrada') {
      return res.status(404).json({ message: error.message })
    }
    return handleError(res, error)
  }
}
