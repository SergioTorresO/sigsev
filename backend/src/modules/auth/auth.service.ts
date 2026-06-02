import supabase from '../../lib/supabase'
import bcrypt from 'bcryptjs'
import * as jwt from 'jsonwebtoken'
import { z } from 'zod'

export const registerSchema = z.object({
  full_name: z.string().trim().min(3, 'El nombre es muy corto'),
  email: z.string().trim().email('Correo electronico invalido').toLowerCase(),
  password: z.string().min(6, 'La contrasena debe tener al menos 6 caracteres'),
  phone: z.string().trim().regex(/^[0-9+\-()\s]{7,20}$/, 'Telefono invalido'),
  role_id: z.string().uuid('role_id debe ser un UUID').optional(),
  municipality: z.string().trim().min(2, 'Municipio invalido'),
})

export const loginSchema = z.object({
  email: z.string().trim().email('Correo invalido').toLowerCase(),
  password: z.string().min(6, 'Contraseña invalida'),
})

type RegisterDTO = z.infer<typeof registerSchema>
type LoginDTO = z.infer<typeof loginSchema>

export const registerUser = async ({
  full_name, email, password, phone, role_id, municipality,
}: RegisterDTO) => {

  // Check duplicate email
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existing) throw new Error('El usuario ya existe')

  const hashedPassword = await bcrypt.hash(password, 10)

  // Resolve role
  let finalRoleId: string | null = null
  if (role_id) {
    const { data: role } = await supabase
      .from('roles').select('id').eq('id', role_id).maybeSingle()
    if (!role) throw new Error('Rol no encontrado')
    finalRoleId = role.id
  } else {
    const { data: defaultRole } = await supabase
      .from('roles').select('id').eq('name', 'CONSULTA').maybeSingle()
    if (!defaultRole) throw new Error('Rol CONSULTA no encontrado')
    finalRoleId = defaultRole.id
  }

  const { data: user, error } = await supabase
    .from('users')
    .insert({ full_name, email, password: hashedPassword, phone, role_id: finalRoleId, municipality })
    .select('id, full_name, email, phone, is_active, role_id, created_at, roles(id, name, description)')
    .single()

  if (error) throw new Error(error.message)
  return user
}

export const loginUser = async ({ email, password }: LoginDTO) => {
  const { data: user, error } = await supabase
    .from('users')
    .select('id, full_name, email, phone, is_active, role_id, password, created_at, roles(id, name, description)')
    .eq('email', email)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!user) throw new Error('Usuario no encontrado')

  const passwordMatch = await bcrypt.compare(password, user.password as string)
  if (!passwordMatch) throw new Error('Contraseña incorrecta')

  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET no configurado')

  const token = jwt.sign(
    { userId: user.id, role_id: user.role_id },
    secret,
    { expiresIn: '1d' }
  )

  const { password: _pw, ...safeUser } = user
  return { token, user: safeUser }
}
