import { Request, Response } from 'express'
import { ZodError } from 'zod'
import {
  getNotificationsForUser,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  notificationFiltersSchema,
} from './notifications.service'

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
    const filters = notificationFiltersSchema.parse(req.query)
    const result = await getNotificationsForUser(req.user!.userId, req.user!.roleName ?? '', filters)
    return res.json(result)
  } catch (error) {
    return handleError(res, error)
  }
}

export const unreadCount = async (req: Request, res: Response) => {
  try {
    const result = await getUnreadCount(req.user!.userId, req.user!.roleName ?? '')
    return res.json(result)
  } catch (error) {
    return handleError(res, error)
  }
}

export const markRead = async (req: Request, res: Response) => {
  try {
    const notification = await markNotificationRead(req.params.id as string, req.user!.userId, req.user!.roleName ?? '')
    return res.json(notification)
  } catch (error) {
    if (error instanceof Error && error.message === 'Notificación no encontrada') {
      return res.status(404).json({ message: error.message })
    }
    if (error instanceof Error && error.message === 'No tienes permiso sobre esta notificación') {
      return res.status(403).json({ message: error.message })
    }
    return handleError(res, error)
  }
}

export const markAllRead = async (req: Request, res: Response) => {
  try {
    const result = await markAllNotificationsRead(req.user!.userId, req.user!.roleName ?? '')
    return res.json(result)
  } catch (error) {
    return handleError(res, error)
  }
}
