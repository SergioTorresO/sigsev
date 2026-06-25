import 'dotenv/config'
import express, { NextFunction, Request, Response } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import multer from 'multer'
import pinoHttp from 'pino-http'
import { randomUUID } from 'crypto'
import logger from './lib/logger'

import authRoutes from './modules/auth/auth.routes'
import signalRoutes from './modules/signals/signals.routes'
import inspectionRoutes from './modules/inspections/inspections.routes'
import maintenanceRoutes from './modules/maintenances/maintenances.routes'
import referencesRoutes from './modules/references/references.routes'
import usersRoutes from './modules/users/users.routes'
import profileRoutes from './modules/profile/profile.routes'
import reportsRoutes from './modules/reports/reports.routes'
import notificationsRoutes from './modules/notifications/notifications.routes'
import dashboardRoutes from './modules/dashboard/dashboard.routes'
import auditRoutes from './modules/audit/audit.routes'
import zonesRoutes from './modules/zones/zones.routes'
import { startOverdueMaintenanceJob } from './modules/maintenances/maintenances.service'
import supabase from './lib/supabase'

const app = express()
const isProduction = process.env.NODE_ENV === 'production'

app.set('trust proxy', 1) // Vercel/proxies en producción — necesario para que express-rate-limit identifique IPs reales

// API pura sin vistas HTML: desactivamos el CSP por defecto de Helmet (pensado
// para servir HTML) y dejamos las cabeceras de seguridad que sí aplican a una
// API JSON (noSniff, frameguard, hidePoweredBy, HSTS, etc).
app.use(helmet({ contentSecurityPolicy: false }))

// Logging estructurado por request: cada línea es JSON (nivel, método, ruta,
// status, duración, reqId) en vez de console.log de texto libre. El reqId se
// genera por request y se devuelve en el header `X-Request-Id`, así un error
// reportado por el frontend se puede cruzar con la línea exacta del log.
app.use(pinoHttp({
  logger,
  genReqId: (req: Request, res: Response) => {
    const existing = req.headers['x-request-id']
    const id = (typeof existing === 'string' && existing) || randomUUID()
    res.setHeader('X-Request-Id', id)
    return id
  },
}))

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
app.use('/api/reports', reportsRoutes)
app.use('/api/notifications', notificationsRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/audit-logs', auditRoutes)
app.use('/api/zones', zonesRoutes)

app.get('/', (req, res) => {
  res.send('SIGSEV API RUNNING')
})

// Healthcheck real: además de confirmar que el proceso responde, hace una
// consulta mínima a Supabase para detectar caídas/cortes de conectividad
// (p.ej. red universitaria bloqueando el endpoint HTTPS, credencial rotada,
// proyecto pausado). Usado por el orquestador de despliegue para saber si la
// instancia está realmente lista para recibir tráfico, no solo "viva".
app.get('/health', async (_req, res) => {
  try {
    const { error } = await supabase.from('roles').select('id', { head: true, count: 'exact' })
    if (error) throw new Error(error.message)
    res.status(200).json({ status: 'ok', supabase: 'up', timestamp: new Date().toISOString() })
  } catch (err) {
    res.status(503).json({
      status: 'error',
      supabase: 'down',
      message: err instanceof Error ? err.message : 'Error desconocido',
      timestamp: new Date().toISOString(),
    })
  }
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

const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`)
  // Revisión periódica de mantenimientos vencidos (notificaciones).
  // No hay cron nativo en este setup; un intervalo en proceso es suficiente
  // a esta escala (un solo servidor, sin múltiples instancias).
  startOverdueMaintenanceJob()
})

// Graceful shutdown: al desplegar (o al reiniciar el proceso), Vercel/el
// orquestador envía SIGTERM antes de matar el proceso. Sin esto, Express
// corta las conexiones en curso de inmediato; con server.close() se deja de
// aceptar conexiones nuevas pero las requests ya en vuelo terminan antes de
// salir del proceso. Un timeout de seguridad evita quedarse colgado si algo
// no cierra (p.ej. el intervalo del job de mantenimientos vencidos).
const shutdown = (signal: string) => {
  logger.info(`${signal} recibido, cerrando servidor...`)
  server.close(() => {
    logger.info('Servidor cerrado, sin conexiones activas.')
    process.exit(0)
  })
  setTimeout(() => {
    logger.error('Cierre forzado: el servidor no cerró a tiempo.')
    process.exit(1)
  }, 10_000)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
