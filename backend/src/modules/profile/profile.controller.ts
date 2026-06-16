import { Request, Response } from 'express'
import {
  getMyProfile,
  updateMyProfile,
  changeMyPassword,
  updateProfileSchema,
  changePasswordSchema,
} from './profile.service'

export const handleGetMyProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) return res.status(401).json({ message: 'No autenticado' })

    const profile = await getMyProfile(userId)
    res.json(profile)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error'
    res.status(msg === 'Usuario no encontrado' ? 404 : 500).json({ message: msg })
  }
}

export const handleUpdateMyProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) return res.status(401).json({ message: 'No autenticado' })

    const dto = updateProfileSchema.parse(req.body)
    const profile = await updateMyProfile(userId, dto)
    res.json(profile)
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : 'Error' })
  }
}

export const handleChangeMyPassword = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) return res.status(401).json({ message: 'No autenticado' })

    const dto = changePasswordSchema.parse(req.body)
    const result = await changeMyPassword(userId, dto)
    res.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error'
    res.status(msg === 'La contraseña actual es incorrecta' ? 401 : 400).json({ message: msg })
  }
}
