import { Request, Response } from 'express'
import { ZodError } from 'zod'
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listSignalTypes,
  createSignalType,
  updateSignalType,
  deleteSignalType,
  categorySchema,
  signalTypeSchema,
} from './catalog.service'

const handleError = (res: Response, error: unknown) => {
  if (error instanceof ZodError) {
    const msgs = Array.from(new Set(error.issues.map((i) => i.message)))
    return res.status(422).json({ message: msgs.join(', ') })
  }
  if (error instanceof Error) {
    return res.status(400).json({ message: error.message })
  }
  return res.status(500).json({ message: 'Error interno del servidor' })
}

// ── Categorías ─────────────────────────────────────────────────────────────
export const getCategories = async (_req: Request, res: Response) => {
  try {
    const data = await listCategories()
    return res.json(data)
  } catch (error) {
    return handleError(res, error)
  }
}

export const postCategory = async (req: Request, res: Response) => {
  try {
    const payload = categorySchema.parse(req.body)
    const data = await createCategory(payload)
    return res.status(201).json(data)
  } catch (error) {
    return handleError(res, error)
  }
}

export const putCategory = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const payload = categorySchema.parse(req.body)
    const data = await updateCategory(id, payload)
    return res.json(data)
  } catch (error) {
    return handleError(res, error)
  }
}

export const removeCategory = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    await deleteCategory(id)
    return res.json({ message: 'Categoría eliminada' })
  } catch (error) {
    return handleError(res, error)
  }
}

// ── Tipos de señal ─────────────────────────────────────────────────────────
export const getSignalTypes = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20))
    const category_id = req.query.category_id as string | undefined
    const search = req.query.search as string | undefined
    const data = await listSignalTypes({ category_id, search, page, limit })
    return res.json(data)
  } catch (error) {
    return handleError(res, error)
  }
}

export const postSignalType = async (req: Request, res: Response) => {
  try {
    const payload = signalTypeSchema.parse(req.body)
    const data = await createSignalType(payload)
    return res.status(201).json(data)
  } catch (error) {
    return handleError(res, error)
  }
}

export const putSignalType = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const payload = signalTypeSchema.parse(req.body)
    const data = await updateSignalType(id, payload)
    return res.json(data)
  } catch (error) {
    return handleError(res, error)
  }
}

export const removeSignalType = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    await deleteSignalType(id)
    return res.json({ message: 'Tipo de señal eliminado' })
  } catch (error) {
    return handleError(res, error)
  }
}
