import 'dotenv/config'
import express from 'express'
import cors from 'cors'

import authRoutes from './modules/auth/auth.routes'
import signalRoutes from './modules/signals/signals.routes'
import inspectionRoutes from './modules/inspections/inspections.routes'
import maintenanceRoutes from './modules/maintenances/maintenances.routes'
import referencesRoutes from './modules/references/references.routes'
import usersRoutes from './modules/users/users.routes'
import profileRoutes from './modules/profile/profile.routes'

const app = express()

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true)
    const allowed = [
      process.env.FRONTEND_URL ?? 'http://localhost:3000',
      'http://localhost:3000',
      'http://192.168.1.8:3000',
    ]
    if (allowed.includes(origin)) return callback(null, true)
    // Also allow any local network IP (192.168.x.x)
    if (/^http:\/\/192\.168\.\d+\.\d+:\d+$/.test(origin)) return callback(null, true)
    callback(new Error(`CORS bloqueado: ${origin}`))
  },
  credentials: true,
}))
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/signals', signalRoutes)
app.use('/api/inspections', inspectionRoutes)
app.use('/api/maintenances', maintenanceRoutes)
app.use('/api/ref', referencesRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/profile', profileRoutes)

app.get('/', (req, res) => {
  res.send('SIGSEV API RUNNING')
})

const PORT = Number(process.env.PORT) || 4000

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
