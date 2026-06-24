import { Router } from 'express'
import { verifyToken } from '../../middlewares/auth.middleware'
import { requireRole } from '../../middlewares/requireRole.middleware'
import { signalsReport, inspectionsReport, maintenancesReport, summaryReport } from './reports.controller'

const router = Router()

router.use(verifyToken)
// Reportes: exclusivo ADMIN/SUPERVISOR (igual que Inspecciones/Mantenimientos)
router.use(requireRole('ADMIN', 'SUPERVISOR'))

router.get('/signals', signalsReport)
router.get('/inspections', inspectionsReport)
router.get('/maintenances', maintenancesReport)
router.get('/summary', summaryReport)

export default router
