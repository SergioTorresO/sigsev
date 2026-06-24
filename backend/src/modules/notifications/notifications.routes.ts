import { Router } from 'express'
import { verifyToken } from '../../middlewares/auth.middleware'
import { requireRole } from '../../middlewares/requireRole.middleware'
import { list, unreadCount, markRead, markAllRead } from './notifications.controller'

const router = Router()

router.use(verifyToken)
// Accesible para cualquier rol autenticado — requireRole con los 4 roles solo
// se usa aquí para cachear req.user.roleName (necesario para filtrar
// visibilidad: ADMIN/SUPERVISOR ven todo, TECNICO/CONSULTA solo lo suyo).
router.use(requireRole('ADMIN', 'SUPERVISOR', 'TECNICO', 'CONSULTA'))

router.get('/', list)
router.get('/unread-count', unreadCount)
router.patch('/:id/read', markRead)
router.patch('/read-all', markAllRead)

export default router
