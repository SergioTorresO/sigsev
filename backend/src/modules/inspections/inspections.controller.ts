import { Request, Response } from 'express'
import { ZodError } from 'zod'
import {
  getInspections,
  getInspectionById,
  createInspection,
  updateInspection,
  completeInspection,
  createInspectionSchema,
  updateInspectionSchema,
  completeInspectionSchema,
  inspectionFiltersSchema,
} from './inspections.service'
import { createNotification } from '../notifications/notifications.service'
import { logAudit } from '../../lib/audit'
import { uploadEvidenceImage } from '../../lib/storage'
import { assertAssigneeRole } from '../../lib/assignment'
import supabase from '../../lib/supabase'

// Una inspección la puede ejecutar un SUPERVISOR o un TECNICO, pero nunca el ADMIN.
const INSPECTION_ASSIGNEE_ROLES = ['SUPERVISOR', 'TECNICO']

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

    if (canAssign && data.technician_id) {
      await assertAssigneeRole(technicianId, INSPECTION_ASSIGNEE_ROLES, 'Una inspección')
    }

    const inspection = await createInspection(data, technicianId)

    void logAudit({ userId: req.user!.userId, action: 'CREATE', tableName: 'inspections', recordId: inspection.id, newData: inspection })

    // Notifica al técnico solo si un ADMIN/SUPERVISOR le asignó la inspección a otra persona.
    // El mensaje queda en tercera persona (quién asignó a quién) porque ADMIN/SUPERVISOR ven
    // todas las notificaciones, no solo las propias, y necesitan saber de quién es cada una.
    if (canAssign && technicianId !== req.user!.userId) {
      const { data: assigner } = await supabase.from('users').select('full_name').eq('id', req.user!.userId).maybeSingle()
      const signalCode = (inspection as { signals?: { signal_code?: string } | null }).signals?.signal_code ?? ''
      const assigneeName = (inspection as { users?: { full_name?: string } | null }).users?.full_name ?? 'un técnico'

      await createNotification({
        type: 'ASSIGNMENT',
        title: 'Nueva inspección asignada',
        message: `${assigner?.full_name ?? 'Alguien'} le asignó a ${assigneeName} la inspección de la señal ${signalCode}.`,
        target_user_id: technicianId,
        inspection_id: inspection.id,
      })
    }

    return res.status(201).json(inspection)
  } catch (error) {
    return handleError(res, error)
  }
}

export const update = async (req: Request, res: Response) => {
  try {
    const data = updateInspectionSchema.parse(req.body)

    if (data.technician_id) {
      await assertAssigneeRole(data.technician_id, INSPECTION_ASSIGNEE_ROLES, 'Una inspección')
    }

    const previous = await getInspectionById(req.params.id as string).catch(() => null)
    const inspection = await updateInspection(req.params.id as string, data)
    void logAudit({ userId: req.user!.userId, action: 'UPDATE', tableName: 'inspections', recordId: inspection.id, oldData: previous, newData: inspection })
    return res.json(inspection)
  } catch (error) {
    if (error instanceof Error && error.message === 'Inspección no encontrada') {
      return res.status(404).json({ message: error.message })
    }
    return handleError(res, error)
  }
}

// El técnico (dueño de la asignación) o ADMIN/SUPERVISOR marcan la inspección
// como realizada: requiere foto de evidencia (multer ya la deja en req.file).
export const complete = async (req: Request, res: Response) => {
  try {
    const previous = await getInspectionById(req.params.id as string)

    const isOwner = (previous as { technician_id?: string | null }).technician_id === req.user!.userId
    const isManager = CAN_ASSIGN_ROLES.includes(req.user!.roleName ?? '')
    if (!isOwner && !isManager) {
      return res.status(403).json({ message: 'No puedes completar una inspección que no te fue asignada' })
    }

    if (!req.file) {
      return res.status(422).json({ message: 'Debes adjuntar una foto como evidencia' })
    }

    const body = Object.fromEntries(Object.entries(req.body).filter(([, v]) => v !== ''))
    const data = completeInspectionSchema.parse(body)

    const evidenceImageUrl = await uploadEvidenceImage(req.file, `inspections/${req.params.id}`)
    const inspection = await completeInspection(req.params.id as string, data, evidenceImageUrl, req.user!.userId)

    void logAudit({ userId: req.user!.userId, action: 'UPDATE', tableName: 'inspections', recordId: inspection.id, oldData: previous, newData: inspection })

    return res.json(inspection)
  } catch (error) {
    if (error instanceof Error && error.message === 'Inspección no encontrada') {
      return res.status(404).json({ message: error.message })
    }
    return handleError(res, error)
  }
}
