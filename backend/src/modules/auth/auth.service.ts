import prisma from '../../lib/prisma'
import bcrypt from 'bcryptjs'
import * as jwt from 'jsonwebtoken'
import { z } from 'zod'

export const registerSchema = z.object({
  full_name: z.string().trim().min(3, 'El nombre es muy corto'),
  email: z.string().trim().email('Correo electronico invalido').toLowerCase(),
  password: z.string().min(6, 'La contrasena debe tener al menos 6 caracteres'),
  // Use a single regex to validate phone format and length to avoid duplicate errors
  phone: z.string().trim().regex(/^[0-9+\-()\s]{7,20}$/, 'Telefono invalido'),
  role_id: z.string().uuid('role_id debe ser un UUID').optional(),
  municipality: z.string().trim().min(2, 'Municipio invalido'),
})

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Correo invalido')
    .toLowerCase(),

  password: z
    .string()
    .min(6, 'Contraseña invalida'),
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
  phone,
  role_id,
  municipality,
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

  // Determine role: use provided role_id if valid, otherwise fallback to default 'CONSULTA'
  let finalRoleId: string | null = null

  if (role_id) {
    const providedRole = await prisma.roles.findUnique({
      where: { id: role_id },
    })

    if (!providedRole) {
      throw new Error('Rol no encontrado')
    }

    finalRoleId = providedRole.id
  } else {
    const defaultRole = await prisma.roles.findFirst({ where: { name: 'CONSULTA' } })
    if (!defaultRole) {
      throw new Error('Rol CONSULTA no encontrado')
    }
    finalRoleId = defaultRole.id
  }

  // Validate municipality exists in the system
  const municipalityExists = await prisma.municipalities.findFirst({
    where: { name: municipality },
  })

 // if (!municipalityExists) {
 //   throw new Error('Municipio no encontrado')
 // }

  const user = await prisma.users.create({
    data: {
      full_name,
      email,
      password: hashedPassword,
      phone,
      role_id: finalRoleId,
      municipality,
    },
    select: safeUserSelect,
  })

  return user
}

export const loginUser = async ({
  email,
  password,
}: LoginDTO) => {

  const user = await prisma.users.findFirst({
    where: {
      email: email.toLowerCase(),
    },
    select: loginUserSelect,
  })

  if (!user) {
    throw new Error(
      'Usuario no encontrado'
    )
  }

  const passwordMatch =
    await bcrypt.compare(
      password,
      user.password
    )

  if (!passwordMatch) {
    throw new Error(
      'Contraseña incorrecta'
    )
  }

  const token = jwt.sign(
    {
      userId: user.id,
      role_id: user.role_id,
    },
    process.env.JWT_SECRET as string,
    {
      expiresIn: '1d',
    }
  )

  return {
    token,
    user: {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role_id: user.role_id,
      roles: user.roles,
    },
  }

}

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET no configurado')
  }

  return process.env.JWT_SECRET
}
