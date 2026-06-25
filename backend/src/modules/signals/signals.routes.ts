import { Router } from 'express'
import { verifyToken } from '../../middlewares/auth.middleware'
import { requireRole } from '../../middlewares/requireRole.middleware'
import { list, getOne, create, update, remove, toggleActive, bulkImport, upload } from './signals.controller'

const router = Router()

router.use(verifyToken) // todas las rutas de señales requieren autenticación

// Lectura: cualquier usuario autenticado (incluye CONSULTA)
router.get('/', list)
router.get('/:id', getOne)

// Escritura: ADMIN y SUPERVISOR gestionan el catálogo completo; TECNICO puede
// registrar/editar señales en campo, pero no desactivarlas, borrarlas ni
// hacer carga masiva (eso sigue exclusivo de ADMIN/SUPERVISOR).
router.post('/', requireRole('ADMIN', 'SUPERVISOR', 'TECNICO'), create)
router.post('/bulk-import', requireRole('ADMIN', 'SUPERVISOR'), upload.single('file'), bulkImport)
router.put('/:id', requireRole('ADMIN', 'SUPERVISOR', 'TECNICO'), update)
router.patch('/:id/toggle-active', requireRole('ADMIN', 'SUPERVISOR'), toggleActive)
router.delete('/:id', requireRole('ADMIN', 'SUPERVISOR'), remove)

export default router
