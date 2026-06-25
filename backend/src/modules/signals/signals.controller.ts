import { Request, Response } from 'express'
import { ZodError } from 'zod'
import {
  getSignals,
  getSignalById,
  createSignal,
  updateSignal,
  deleteSignal,
  toggleSignalActive,
  bulkImportSignals,
  createSignalSchema,
  updateSignalSchema,
  signalFiltersSchema,
} from './signals.service'
import { logAudit } from '../../lib/audit'
import { BulkImportError, createBulkImportUpload, parseSpreadsheetRows } from '../../lib/bulkImport'

// Middleware de multer compartido (ver lib/bulkImport.ts): memoria, máx. 5MB,
// solo .csv/.xlsx/.xls.
export const upload = createBulkImportUpload()

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
    void logAudit({ userId: req.user!.userId, action: 'CREATE', tableName: 'signals', recordId: signal.id, newData: signal })
    return res.status(201).json(signal)
  } catch (error) {
    return handleError(res, error)
  }
}

export const update = async (req: Request, res: Response) => {
  try {
    const data = updateSignalSchema.parse(req.body)
    const previous = await getSignalById(req.params.id as string).catch(() => null)
    const signal = await updateSignal(req.params.id as string, data)
    void logAudit({ userId: req.user!.userId, action: 'UPDATE', tableName: 'signals', recordId: signal.id, oldData: previous, newData: signal })
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
    const previous = await getSignalById(req.params.id as string).catch(() => null)
    await deleteSignal(req.params.id as string)
    void logAudit({ userId: req.user!.userId, action: 'DELETE', tableName: 'signals', recordId: req.params.id as string, oldData: previous, newData: { is_active: false } })
    return res.json({ message: 'Señal desactivada' })
  } catch (error) {
    if (error instanceof Error && error.message === 'Señal no encontrada') {
      return res.status(404).json({ message: error.message })
    }
    return handleError(res, error)
  }
}

export const toggleActive = async (req: Request, res: Response) => {
  try {
    const previous = await getSignalById(req.params.id as string).catch(() => null)
    const signal = await toggleSignalActive(req.params.id as string)
    void logAudit({ userId: req.user!.userId, action: 'TOGGLE_ACTIVE', tableName: 'signals', recordId: signal.id, oldData: previous, newData: signal })
    return res.json(signal)
  } catch (error) {
    if (error instanceof Error && error.message === 'Señal no encontrada') {
      return res.status(404).json({ message: error.message })
    }
    return handleError(res, error)
  }
}

export const bulkImport = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Debes adjuntar un archivo CSV o Excel (.xlsx)' })
    }

    const rows = parseSpreadsheetRows(req.file)

    const result = await bulkImportSignals(rows, req.user!.userId)
    void logAudit({
      userId: req.user!.userId,
      action: 'BULK_IMPORT',
      tableName: 'signals',
      newData: { insertedCount: result.inserted, fileName: req.file.originalname },
    })
    return res.status(201).json(result)
  } catch (error) {
    if (error instanceof BulkImportError) {
      return res.status(422).json({ message: error.message, errors: error.errors })
    }
    return handleError(res, error)
  }
}
