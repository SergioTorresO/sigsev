import { Router } from 'express'
import { verifyToken } from '../../middlewares/auth.middleware'
import { requireRole } from '../../middlewares/requireRole.middleware'
import { list, getOne, create, update } from './maintenances.controller'

const router = Router()

router.use(verifyToken)

// Lectura: cualquier usuario autenticado (incluye CONSULTA)
router.get('/', list)
router.get('/:id', getOne)

// Escritura: solo ADMIN y SUPERVISOR (TECNICO ya no gestiona mantenimientos)
router.post('/', requireRole('ADMIN', 'SUPERVISOR'), create)
router.put('/:id', requireRole('ADMIN', 'SUPERVISOR'), update)

export default router
