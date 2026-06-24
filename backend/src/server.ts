import 'dotenv/config'
import express, { NextFunction, Request, Response } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import multer from 'multer'

import authRoutes from './modules/auth/auth.routes'
import signalRoutes from './modules/signals/signals.routes'
import inspectionRoutes from './modules/inspections/inspections.routes'
import maintenanceRoutes from './modules/maintenances/maintenances.routes'
import referencesRoutes from './modules/references/references.routes'
import usersRoutes from './modules/users/users.routes'
import profileRoutes from './modules/profile/profile.routes'

const app = express()
const isProduction = process.env.NODE_ENV === 'production'

app.set('trust proxy', 1) // Vercel/proxies en producción — necesario para que express-rate-limit identifique IPs reales

// API pura sin vistas HTML: desactivamos el CSP por defecto de Helmet (pensado
// para servir HTML) y dejamos las cabeceras de seguridad que sí aplican a una
// API JSON (noSniff, frameguard, hidePoweredBy, HSTS, etc).
app.use(helmet({ contentSecurityPolicy: false }))

// FRONTEND_URL admite una lista separada por comas para soportar varios
// dominios de producción (p.ej. dominio propio + preview de Vercel).
const productionOrigins = (process.env.FRONTEND_URL ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true)

    if (productionOrigins.includes(origin)) return callback(null, true)

    if (!isProduction) {
      const devAllowed = ['http://localhost:3000']
      if (devAllowed.includes(origin)) return callback(null, true)
      // Solo en desarrollo: cualquier IP de red local (LAN universitaria)
      if (/^http:\/\/192\.168\.\d+\.\d+:\d+$/.test(origin)) return callback(null, true)
    }

    callback(new Error(`CORS bloqueado: ${origin}`))
  },
  credentials: true,
}))
// Límite de tamaño del body: evita payloads JSON enormes como vector de DoS
// (la carga masiva de señales va por multipart/multer, no por aquí).
app.use(express.json({ limit: '1mb' }))

// Rate limiting general — protege toda la API de abuso/DoS básico
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
}))

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

// Manejador de errores global: evita que Express devuelva HTML con stack
// traces (por defecto) y normaliza errores de Multer (archivo inválido,
// demasiado grande) a respuestas JSON consistentes con el resto del API.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: err.message })
  }
  if (err instanceof Error) {
    return res.status(400).json({ message: err.message })
  }
  return res.status(500).json({ message: 'Error interno del servidor' })
})

const PORT = Number(process.env.PORT) || 4000

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
