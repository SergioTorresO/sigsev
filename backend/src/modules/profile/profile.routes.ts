import { Router } from 'express'
import { verifyToken } from '../../middlewares/auth.middleware'
import {
  handleGetMyProfile,
  handleUpdateMyProfile,
  handleChangeMyPassword,
} from './profile.controller'

const router = Router()

// Cualquier usuario autenticado puede ver/editar su propio perfil
router.use(verifyToken)

router.get('/', handleGetMyProfile)
router.put('/', handleUpdateMyProfile)
router.put('/password', handleChangeMyPassword)

export default router
