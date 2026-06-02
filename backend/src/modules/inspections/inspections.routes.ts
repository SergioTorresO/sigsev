import { Router } from 'express'
import { verifyToken } from '../../middlewares/auth.middleware'
import { list, getOne, create, update } from './inspections.controller'

const router = Router()

router.use(verifyToken)

router.get('/', list)
router.get('/:id', getOne)
router.post('/', create)
router.put('/:id', update)

export default router
