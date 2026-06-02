import 'dotenv/config'
import express from 'express'
import cors from 'cors'

import authRoutes from './modules/auth/auth.routes'
import signalRoutes from './modules/signals/signals.routes'
import inspectionRoutes from './modules/inspections/inspections.routes'
import maintenanceRoutes from './modules/maintenances/maintenances.routes'
import referencesRoutes from './modules/references/references.routes'
import usersRoutes from './modules/users/users.routes'

const app = express()

app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
}))
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/signals', signalRoutes)
app.use('/api/inspections', inspectionRoutes)
app.use('/api/maintenances', maintenanceRoutes)
app.use('/api/ref', referencesRoutes)
app.use('/api/users', usersRoutes)

app.get('/', (req, res) => {
  res.send('SIGSEV API RUNNING')
})

const PORT = Number(process.env.PORT) || 4000

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
