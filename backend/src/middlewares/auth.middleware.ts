import { Request, Response, NextFunction } from 'express'
import * as jwt from 'jsonwebtoken'
import supabase from '../lib/supabase'

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
  roleName?: string
}


export const verifyToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token no proporcionado' })
  }

  const token = authHeader.split(' ')[1]

  let decoded: JwtPayload
  try {
    const secret = process.env.JWT_SECRET
    if (!secret) throw new Error('JWT_SECRET no configurado')

    decoded = jwt.verify(token, secret) as JwtPayload
  } catch {
    return res.status(401).json({ message: 'Token invalido o expirado' })
  }

  // La firma del JWT puede seguir siendo valida hasta por 24h aunque un ADMIN
  // haya desactivado al usuario mientras tanto. Revalidamos is_active en cada
  // request para que la desactivacion tenga efecto inmediato.
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('is_active')
      .eq('id', decoded.userId)
      .maybeSingle()

    if (error || !user || user.is_active === false) {
      return res.status(401).json({ message: 'Usuario inactivo o no encontrado' })
    }
  } catch {
    return res.status(500).json({ message: 'Error verificando el usuario' })
  }

  req.user = decoded
  next()
}
