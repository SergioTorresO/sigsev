import { Router } from 'express'
import { verifyToken } from '../../middlewares/auth.middleware'
import { requireRole } from '../../middlewares/requireRole.middleware'
import { list, getOne, create, update, remove, toggleActive, bulkImport, upload } from './cameras.controller'

const router = Router()

router.use(verifyToken) // todas las rutas de cámaras requieren autenticación

// Lectura: cualquier usuario autenticado
router.get('/', list)
router.get('/:id', getOne)

// Escritura: solo ADMIN y SUPERVISOR gestionan el catálogo de cámaras (sin
// nivel TECNICO, a diferencia de señales — mismo criterio que zonas).
router.post('/', requireRole('ADMIN', 'SUPERVISOR'), create)
router.post('/bulk-import', requireRole('ADMIN', 'SUPERVISOR'), upload.single('file'), bulkImport)
router.put('/:id', requireRole('ADMIN', 'SUPERVISOR'), update)
router.patch('/:id/toggle-active', requireRole('ADMIN', 'SUPERVISOR'), toggleActive)
router.delete('/:id', requireRole('ADMIN', 'SUPERVISOR'), remove)

export default router
