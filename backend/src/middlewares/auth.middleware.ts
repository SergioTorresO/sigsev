import { Request, Response, NextFunction } from 'express'
import * as jwt from 'jsonwebtoken'

// Extend Express Request to carry the decoded token
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

export interface JwtPayload {
  userId: string
  role_id: string | null
}


export const verifyToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token no proporcionado' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const secret = process.env.JWT_SECRET
    if (!secret) throw new Error('JWT_SECRET no configurado')

    const decoded = jwt.verify(token, secret) as JwtPayload
    req.user = decoded
    next()
  } catch {
    return res.status(401).json({ message: 'Token inválido o expirado' })
  }
}
