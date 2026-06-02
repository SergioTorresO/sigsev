import { Request, Response } from 'express'
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  toggleUserActive,
  deleteUser,
  getRoles,
  createUserSchema,
  updateUserSchema,
  usersFiltersSchema,
} from './users.service'

export const handleGetUsers = async (req: Request, res: Response) => {
  try {
    const filters = usersFiltersSchema.parse(req.query)
    const result = await getUsers(filters)
    res.json(result)
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : 'Error' })
  }
}

export const handleGetUserById = async (req: Request, res: Response) => {
  try {
    const user = await getUserById(req.params.id as string)
    res.json(user)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error'
    res.status(msg === 'Usuario no encontrado' ? 404 : 500).json({ message: msg })
  }
}

export const handleCreateUser = async (req: Request, res: Response) => {
  try {
    const dto = createUserSchema.parse(req.body)
    const user = await createUser(dto)
    res.status(201).json(user)
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : 'Error' })
  }
}

export const handleUpdateUser = async (req: Request, res: Response) => {
  try {
    const dto = updateUserSchema.parse(req.body)
    const user = await updateUser(req.params.id as string, dto)
    res.json(user)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error'
    res.status(msg === 'Usuario no encontrado' ? 404 : 400).json({ message: msg })
  }
}

export const handleToggleActive = async (req: Request, res: Response) => {
  try {
    const user = await toggleUserActive(req.params.id as string)
    res.json(user)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error'
    res.status(msg === 'Usuario no encontrado' ? 404 : 500).json({ message: msg })
  }
}

export const handleDeleteUser = async (req: Request, res: Response) => {
  try {
    const result = await deleteUser(req.params.id as string)
    res.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error'
    res.status(msg === 'Usuario no encontrado' ? 404 : 500).json({ message: msg })
  }
}

export const handleGetRoles = async (_req: Request, res: Response) => {
  try {
    const roles = await getRoles()
    res.json(roles)
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Error' })
  }
}
