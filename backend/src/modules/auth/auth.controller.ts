import { Request, Response } from 'express'
import { ZodError } from 'zod'

import {
  registerUser,
  loginUser,
  registerSchema,
  loginSchema,
} from './auth.service'

const getErrorMessage = (error: unknown) => {
  if (error instanceof ZodError) {
    const msgs = error.issues.map((issue) => issue.message)
    const unique = Array.from(new Set(msgs))
    return unique.join(', ')
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Error interno del servidor'
}

export const register = async (
  req: Request,
  res: Response
) => {

  try {

    const { full_name, email, password, phone, role_id, municipality } = registerSchema.parse(req.body)

    const user = await registerUser({
      full_name,
      email,
      password,
      phone,
      role_id,
      municipality,
    })

    return res.status(201).json({
      message: 'Usuario registrado',
      user,
    })

  } catch (error) {

    if (error instanceof ZodError) {
      return res.status(422).json({ message: getErrorMessage(error) })
    }

    if (error instanceof Error) {
      return res.status(400).json({ message: error.message })
    }

    return res.status(500).json({ message: 'Error interno del servidor' })

  }

}

export const login = async (
  req: Request,
  res: Response
) => {

  try {

    const {
      email,
      password,
    } = loginSchema.parse(req.body)

    const data = await loginUser({
      email,
      password,
    })

    return res.status(200).json({
      message: 'Login exitoso',
      ...data,
    })

  } catch (error) {

    return res.status(400).json({
      message:
        error instanceof Error
          ? error.message
          : 'Error interno',
    })
  }
}
