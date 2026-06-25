import { Router } from 'express'
import { verifyToken } from '../../middlewares/auth.middleware'
import { requireRole } from '../../middlewares/requireRole.middleware'
import { imageUpload } from '../../lib/imageUpload'
import { list, getOne, create, update, complete } from './inspections.controller'

const router = Router()

router.use(verifyToken)

// Lectura: cualquier usuario autenticado (incluye CONSULTA)
router.get('/', list)
router.get('/:id', getOne)

// Escritura: solo ADMIN y SUPERVISOR pueden crear/editar inspecciones (asignar a técnicos, etc.)
router.post('/', requireRole('ADMIN', 'SUPERVISOR'), create)
router.put('/:id', requireRole('ADMIN', 'SUPERVISOR'), update)

// Completar: el TECNICO marca su propia asignación como realizada (estado +
// observaciones + foto obligatoria); ADMIN/SUPERVISOR también pueden hacerlo.
// La verificación de "es el técnico dueño de la asignación" vive en el controller.
router.post('/:id/complete', requireRole('ADMIN', 'SUPERVISOR', 'TECNICO'), imageUpload.single('photo'), complete)

export default router
