import { Router } from 'express'
import { verifyToken } from '../../middlewares/auth.middleware'
import { requireRole } from '../../middlewares/requireRole.middleware'
import {
  getCategories,
  postCategory,
  putCategory,
  removeCategory,
  getSignalTypes,
  postSignalType,
  putSignalType,
  removeSignalType,
} from './catalog.controller'

const router = Router()

// Todas las rutas requieren autenticación
router.use(verifyToken)

// ── Categorías ─────────────────────────────────────────────────────────────
router.get('/categories', getCategories)
router.post('/categories', requireRole('ADMIN'), postCategory)
router.put('/categories/:id', requireRole('ADMIN'), putCategory)
router.delete('/categories/:id', requireRole('ADMIN'), removeCategory)

// ── Tipos de señal ─────────────────────────────────────────────────────────
router.get('/signal-types', getSignalTypes)
router.post('/signal-types', requireRole('ADMIN'), postSignalType)
router.put('/signal-types/:id', requireRole('ADMIN'), putSignalType)
router.delete('/signal-types/:id', requireRole('ADMIN'), removeSignalType)

export default router
