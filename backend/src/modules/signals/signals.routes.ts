import { Router } from 'express'
import { verifyToken } from '../../middlewares/auth.middleware'
import { list, getOne, create, update, remove } from './signals.controller'

const router = Router()

router.use(verifyToken) // todas las rutas de señales requieren autenticación

router.get('/', list)
router.get('/:id', getOne)
router.post('/', create)
router.put('/:id', update)
router.delete('/:id', remove)

export default router
