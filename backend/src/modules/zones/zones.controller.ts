import { Request, Response } from 'express'
import { ZodError } from 'zod'
import multer from 'multer'
import * as XLSX from 'xlsx'
import {
  getZones,
  getZoneById,
  createZone,
  updateZone,
  deleteZone,
  bulkImportZones,
  BulkImportError,
  createZoneSchema,
  updateZoneSchema,
  zoneFiltersSchema,
} from './zones.service'
import { logAudit } from '../../lib/audit'

const ALLOWED_IMPORT_EXTENSIONS = ['.csv', '.xlsx', '.xls']
const ALLOWED_IMPORT_MIME_TYPES = [
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
]

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1,
  },
  // Mismas restricciones que signals.controller.ts (ver comentario allí sobre
  // vulnerabilidades conocidas de la librería xlsx/SheetJS).
  fileFilter: (_req, file, cb) => {
    const name = (file.originalname ?? '').toLowerCase()
    const hasAllowedExtension = ALLOWED_IMPORT_EXTENSIONS.some((ext) => name.endsWith(ext))
    const hasAllowedMimeType = ALLOWED_IMPORT_MIME_TYPES.includes(file.mimetype)
    if (!hasAllowedExtension || !hasAllowedMimeType) {
      return cb(new Error('Solo se permiten archivos .csv, .xlsx o .xls'))
    }
    cb(null, true)
  },
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

export const bulkImport = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Debes adjuntar un archivo CSV o Excel (.xlsx)' })
    }

    const isCsv = (req.file.originalname ?? '').toLowerCase().endsWith('.csv')
    const readOptions = { bookVBA: false, bookFiles: false }
    const workbook = isCsv
      ? XLSX.read(req.file.buffer.toString('utf-8').replace(/^﻿/, ''), { type: 'string', ...readOptions })
      : XLSX.read(req.file.buffer, { type: 'buffer', ...readOptions })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      return res.status(400).json({ message: 'El archivo no contiene hojas' })
    }
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

    const result = await bulkImportZones(rows)
    void logAudit({
      userId: req.user!.userId,
      action: 'BULK_IMPORT',
      tableName: 'zones',
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
