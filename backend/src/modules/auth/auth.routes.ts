import { Router } from 'express'
import rateLimit from 'express-rate-limit'

import {
  register,
  login,
  forgotPassword,
  resetPasswordHandler,
} from './auth.controller'

const router = Router()

// Fuerza bruta de contraseñas: pocos intentos por IP en una ventana corta.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Demasiados intentos. Intenta de nuevo en unos minutos.' },
})

// Registro y recuperación de contraseña: limita abuso/spam sin bloquear uso normal.
const sensitiveActionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Demasiadas solicitudes. Intenta de nuevo más tarde.' },
})

router.post('/register', sensitiveActionLimiter, register)

router.post('/login', loginLimiter, login)

router.post('/forgot-password', sensitiveActionLimiter, forgotPassword)

router.post('/reset-password', sensitiveActionLimiter, resetPasswordHandler)

export default router