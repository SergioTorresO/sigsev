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
    return error.issues.map((issue) => issue.message).join(', ')
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

    const { full_name, email, password } = registerSchema.parse(req.body)

    const user = await registerUser({
      full_name,
      email,
      password,
    })

    return res.status(201).json({
      message: 'Usuario registrado',
      user,
    })

  } catch (error) {

    return res.status(400).json({
      message: getErrorMessage(error),
    })

  }

}

export const login = async (
  req: Request,
  res: Response
) => {

  try {

    const { email, password } = loginSchema.parse(req.body)

    const result = await loginUser({
      email,
      password,
    })

    return res.status(200).json({
      message: 'Login exitoso',
      token: result.token,
      user: result.user,
    })

  } catch (error) {

    return res.status(400).json({
      message: getErrorMessage(error),
    })

  }

}
