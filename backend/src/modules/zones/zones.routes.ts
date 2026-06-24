import { Router } from 'express'
import { verifyToken } from '../../middlewares/auth.middleware'
import { requireRole } from '../../middlewares/requireRole.middleware'
import { list, getOne, create, update, remove } from './zones.controller'

const router = Router()

router.use(verifyToken) // todas las rutas de zonas requieren autenticación

// Lectura: cualquier usuario autenticado
router.get('/', list)
router.get('/:id', getOne)

// Escritura: solo ADMIN y SUPERVISOR pueden gestionar el catálogo de zonas
router.post('/', requireRole('ADMIN', 'SUPERVISOR'), create)
router.put('/:id', requireRole('ADMIN', 'SUPERVISOR'), update)
router.delete('/:id', requireRole('ADMIN', 'SUPERVISOR'), remove)

export default router
