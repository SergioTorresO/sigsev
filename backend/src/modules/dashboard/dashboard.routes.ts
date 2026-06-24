import { Router } from 'express'
import { verifyToken } from '../../middlewares/auth.middleware'
import { stats } from './dashboard.controller'

const router = Router()

router.use(verifyToken)

// Estadísticas del dashboard: visibles para cualquier rol autenticado
// (el propio Dashboard ya es accesible a ADMIN/SUPERVISOR/TECNICO/CONSULTA).
router.get('/stats', stats)

export default router
