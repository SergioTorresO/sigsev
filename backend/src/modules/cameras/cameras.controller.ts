import { Request, Response } from 'express'
import { ZodError } from 'zod'
import {
  getCameras,
  getCameraById,
  createCamera,
  updateCamera,
  deleteCamera,
  toggleCameraActive,
  updateCameraCertificate,
  bulkImportCameras,
  createCameraSchema,
  updateCameraSchema,
  cameraFiltersSchema,
} from './cameras.service'
import { logAudit } from '../../lib/audit'
import { BulkImportError, createBulkImportUpload, parseSpreadsheetRows } from '../../lib/bulkImport'
import { uploadCameraCertificate } from '../../lib/storage'

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
    const filters = cameraFiltersSchema.parse(req.query)
    const result = await getCameras(filters)
    return res.json(result)
  } catch (error) {
    return handleError(res, error)
  }
}

export const getOne = async (req: Request, res: Response) => {
  try {
    const camera = await getCameraById(req.params.id as string)
    return res.json(camera)
  } catch (error) {
    if (error instanceof Error && error.message === 'Cámara no encontrada') {
      return res.status(404).json({ message: error.message })
    }
    return handleError(res, error)
  }
}

export const create = async (req: Request, res: Response) => {
  try {
    const data = createCameraSchema.parse(req.body)
    const camera = await createCamera(data, req.user!.userId)
    void logAudit({ userId: req.user!.userId, action: 'CREATE', tableName: 'cameras', recordId: camera.id, newData: camera })
    return res.status(201).json(camera)
  } catch (error) {
    return handleError(res, error)
  }
}

export const update = async (req: Request, res: Response) => {
  try {
    const data = updateCameraSchema.parse(req.body)
    const previous = await getCameraById(req.params.id as string).catch(() => null)
    const camera = await updateCamera(req.params.id as string, data)
    void logAudit({ userId: req.user!.userId, action: 'UPDATE', tableName: 'cameras', recordId: camera.id, oldData: previous, newData: camera })
    return res.json(camera)
  } catch (error) {
    if (error instanceof Error && error.message === 'Cámara no encontrada') {
      return res.status(404).json({ message: error.message })
    }
    return handleError(res, error)
  }
}

export const remove = async (req: Request, res: Response) => {
  try {
    const previous = await getCameraById(req.params.id as string).catch(() => null)
    await deleteCamera(req.params.id as string)
    void logAudit({ userId: req.user!.userId, action: 'DELETE', tableName: 'cameras', recordId: req.params.id as string, oldData: previous, newData: { is_active: false } })
    return res.json({ message: 'Cámara desactivada' })
  } catch (error) {
    if (error instanceof Error && error.message === 'Cámara no encontrada') {
      return res.status(404).json({ message: error.message })
    }
    return handleError(res, error)
  }
}

export const toggleActive = async (req: Request, res: Response) => {
  try {
    const previous = await getCameraById(req.params.id as string).catch(() => null)
    const camera = await toggleCameraActive(req.params.id as string)
    void logAudit({ userId: req.user!.userId, action: 'TOGGLE_ACTIVE', tableName: 'cameras', recordId: camera.id, oldData: previous, newData: camera })
    return res.json(camera)
  } catch (error) {
    if (error instanceof Error && error.message === 'Cámara no encontrada') {
      return res.status(404).json({ message: error.message })
    }
    return handleError(res, error)
  }
}

export const uploadCertificate = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Debes adjuntar un archivo PDF o imagen' })
    }

    const id = req.params.id as string
    const previous = await getCameraById(id).catch(() => null)
    const url = await uploadCameraCertificate(req.file, `camera-certificates/${id}`)
    const camera = await updateCameraCertificate(id, url)
    void logAudit({ userId: req.user!.userId, action: 'UPDATE', tableName: 'cameras', recordId: id, oldData: previous, newData: camera })
    return res.json(camera)
  } catch (error) {
    if (error instanceof Error && error.message === 'Cámara no encontrada') {
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

    const result = await bulkImportCameras(rows, req.user!.userId)
    void logAudit({
      userId: req.user!.userId,
      action: 'BULK_IMPORT',
      tableName: 'cameras',
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
