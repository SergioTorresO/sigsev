import { Router } from 'express'
import { verifyToken } from '../../middlewares/auth.middleware'
import { requireRole } from '../../middlewares/requireRole.middleware'
import { list } from './audit.controller'

const router = Router()

router.use(verifyToken)
// Auditoría: información sensible (quién cambió qué) — exclusivo ADMIN, igual que /api/users de escritura.
router.use(requireRole('ADMIN'))

router.get('/', list)

export default router
