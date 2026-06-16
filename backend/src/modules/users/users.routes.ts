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

router.use(verifyToken)

// Lectura: ADMIN y SUPERVISOR (el supervisor necesita ver técnicos para asignarles trabajo)
router.get('/', requireRole('ADMIN', 'SUPERVISOR'), handleGetUsers)
router.get('/roles', requireRole('ADMIN', 'SUPERVISOR'), handleGetRoles)
router.get('/:id', requireRole('ADMIN', 'SUPERVISOR'), handleGetUserById)

// Escritura (crear/editar/activar/eliminar usuarios): solo ADMIN
router.post('/', requireRole('ADMIN'), handleCreateUser)
router.put('/:id', requireRole('ADMIN'), handleUpdateUser)
router.patch('/:id/toggle-active', requireRole('ADMIN'), handleToggleActive)
router.delete('/:id', requireRole('ADMIN'), handleDeleteUser)

export default router
