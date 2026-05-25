import prisma from '../../lib/prisma'
import bcrypt from 'bcryptjs'
import * as jwt from 'jsonwebtoken'
import { z } from 'zod'

export const registerSchema = z.object({
  full_name: z.string().trim().min(3, 'El nombre debe tener al menos 3 caracteres'),
  email: z.string().trim().email('Correo electronico invalido').toLowerCase(),
  password: z.string().min(8, 'La contrasena debe tener al menos 8 caracteres'),
})

export const loginSchema = z.object({
  email: z.string().trim().email('Correo electronico invalido').toLowerCase(),
  password: z.string().min(1, 'La contrasena es obligatoria'),
})

type RegisterDTO = z.infer<typeof registerSchema>
type LoginDTO = z.infer<typeof loginSchema>

const safeUserSelect = {
  id: true,
  full_name: true,
  email: true,
  phone: true,
  is_active: true,
  role_id: true,
  created_at: true,
  roles: {
    select: {
      id: true,
      name: true,
      description: true,
    },
  },
}

const loginUserSelect = {
  ...safeUserSelect,
  password: true,
}

export const registerUser = async ({
  full_name,
  email,
  password,
}: RegisterDTO) => {

  const userExists = await prisma.users.findUnique({
    where: {
      email,
    },
  })

  if (userExists) {
    throw new Error('El usuario ya existe')
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  const userRole = await prisma.roles.findFirst({
    where: {
      name: 'CONSULTA',
    },
  })

  if (!userRole) {
    throw new Error('Rol CONSULTA no encontrado')
  }

  const user = await prisma.users.create({
    data: {
      full_name,
      email,
      password: hashedPassword,
      role_id: userRole.id,
    },
    select: safeUserSelect,
  })

  return user
}

export const loginUser = async ({
  email,
  password,
}: LoginDTO) => {

  const user = await prisma.users.findUnique({
    where: {
      email,
    },
    select: loginUserSelect,
  })

  if (!user) {
    throw new Error('Usuario no encontrado')
  }

  const passwordMatch = await bcrypt.compare(
    password,
    user.password
  )

  if (!passwordMatch) {
    throw new Error('Contrasena incorrecta')
  }

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role_id: user.role_id,
    },
    getJwtSecret(),
    {
      expiresIn: '1d',
    }
  )

  const { password: _password, ...safeUser } = user

  return {
    token,
    user: safeUser,
  }

}

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET no configurado')
  }

  return process.env.JWT_SECRET
}
