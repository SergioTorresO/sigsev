import { Request, Response } from 'express'
import { getDashboardStats } from './dashboard.service'

export const stats = async (_req: Request, res: Response) => {
  try {
    const data = await getDashboardStats()
    return res.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return res.status(400).json({ message })
  }
}
