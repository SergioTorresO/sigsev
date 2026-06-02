import { Router } from 'express'
import { verifyToken } from '../../middlewares/auth.middleware'
import { requireRole } from '../../middlewares/requireRole.middleware'
import {
  handleGetUsers,
  handleGetUserById,
  handleCreateUser,
  handleUpdateUser,
  handleToggleActive,
  handleDeleteUser,
  handleGetRoles,
} from './users.controller'

const router = Router()

// All routes require authentication + ADMIN role
router.use(verifyToken, requireRole('ADMIN'))

router.get('/', handleGetUsers)
router.get('/roles', handleGetRoles)
router.get('/:id', handleGetUserById)
router.post('/', handleCreateUser)
router.put('/:id', handleUpdateUser)
router.patch('/:id/toggle-active', handleToggleActive)
router.delete('/:id', handleDeleteUser)

export default router
