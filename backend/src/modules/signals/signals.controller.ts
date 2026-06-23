import { Request, Response } from 'express'
import { ZodError } from 'zod'
import multer from 'multer'
import * as XLSX from 'xlsx'
import {
  getSignals,
  getSignalById,
  createSignal,
  updateSignal,
  deleteSignal,
  toggleSignalActive,
  bulkImportSignals,
  BulkImportError,
  createSignalSchema,
  updateSignalSchema,
  signalFiltersSchema,
} from './signals.service'

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
})

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

export const toggleActive = async (req: Request, res: Response) => {
  try {
    const signal = await toggleSignalActive(req.params.id as string)
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

    // Los .csv los decodificamos manualmente como UTF-8 antes de pasarlos a
    // XLSX; si se leen directo del buffer, XLSX adivina el codepage y con
    // acentos/ñ produce caracteres corruptos (mojibake), p.ej. "Itagüí" ->
    // "ItagÃ¼Ã­". Los .xlsx/.xls (binarios) sí se leen como buffer normal.
    const isCsv = (req.file.originalname ?? '').toLowerCase().endsWith('.csv')
    const workbook = isCsv
      ? XLSX.read(req.file.buffer.toString('utf-8').replace(/^﻿/, ''), { type: 'string' })
      : XLSX.read(req.file.buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      return res.status(400).json({ message: 'El archivo no contiene hojas' })
    }
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

    const result = await bulkImportSignals(rows, req.user!.userId)
    return res.status(201).json(result)
  } catch (error) {
    if (error instanceof BulkImportError) {
      return res.status(422).json({ message: error.message, errors: error.errors })
    }
    return handleError(res, error)
  }
}
