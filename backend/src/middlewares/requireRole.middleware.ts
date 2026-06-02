import { Request, Response, NextFunction } from 'express'
import supabase from '../lib/supabase'
import { JwtPayload } from './auth.middleware'

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

/**
 * Middleware factory — verifica que el usuario autenticado tenga uno de los roles permitidos.
 * Debe usarse DESPUÉS de verifyToken.
 */
export const requireRole = (...allowedRoleNames: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.userId

    if (!userId) {
      return res.status(401).json({ message: 'No autenticado' })
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('roles(name)')
      .eq('id', userId)
      .maybeSingle()

    if (error || !user) {
      return res.status(401).json({ message: 'Usuario no encontrado' })
    }

    const rolesData = user.roles as unknown as { name: string } | { name: string }[] | null
    const roleName = (Array.isArray(rolesData) ? rolesData[0]?.name : rolesData?.name) ?? ''

    if (!allowedRoleNames.includes(roleName)) {
      return res.status(403).json({ message: 'No tienes permiso para esta acción' })
    }

    next()
  }
}
