import supabase from '../../lib/supabase'
import bcrypt from 'bcryptjs'
import * as jwt from 'jsonwebtoken'
import * as crypto from 'crypto'
import { z } from 'zod'
import { isEmailConfigured, sendPasswordResetEmail } from '../../lib/email'

export const registerSchema = z.object({
  full_name: z.string().trim().min(3, 'El nombre es muy corto'),
  email: z.string().trim().email('Correo electronico invalido').toLowerCase(),
  password: z.string().min(6, 'La contrasena debe tener al menos 6 caracteres'),
  phone: z.string().trim().regex(/^[0-9+\-()\s]{7,20}$/, 'Telefono invalido'),
  // NOTA DE SEGURIDAD: el registro público NUNCA acepta role_id del cliente.
  // Todo usuario que se registra por su cuenta recibe el rol CONSULTA por
  // defecto (ver registerUser). Asignar roles con más privilegios (ADMIN,
  // SUPERVISOR, TECNICO) es exclusivo de un ADMIN autenticado a través de
  // POST /api/users.
  municipality: z.string().trim().min(2, 'Municipio invalido'),
})

export const loginSchema = z.object({
  email: z.string().trim().email('Correo invalido').toLowerCase(),
  password: z.string().min(6, 'Contraseña invalida'),
})

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Correo invalido').toLowerCase(),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token requerido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

type RegisterDTO = z.infer<typeof registerSchema>
type LoginDTO = z.infer<typeof loginSchema>
type ForgotPasswordDTO = z.infer<typeof forgotPasswordSchema>
type ResetPasswordDTO = z.infer<typeof resetPasswordSchema>

export const registerUser = async ({
  full_name, email, password, phone, municipality,
}: RegisterDTO) => {

  // Check duplicate email
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existing) throw new Error('El usuario ya existe')

  const hashedPassword = await bcrypt.hash(password, 10)

  // El registro público siempre asigna el rol CONSULTA. No se acepta
  // role_id desde el cliente (ver nota de seguridad en registerSchema).
  const { data: defaultRole } = await supabase
    .from('roles').select('id').eq('name', 'CONSULTA').maybeSingle()
  if (!defaultRole) throw new Error('Rol CONSULTA no encontrado')
  const finalRoleId: string = defaultRole.id

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

export const requestPasswordReset = async ({ email }: ForgotPasswordDTO) => {
  const { data: user, error } = await supabase
    .from('users')
    .select('id, is_active')
    .eq('email', email)
    .maybeSingle()

  if (error) throw new Error(error.message)

  // No revelamos si el correo existe o no (evita enumeración de usuarios).
  if (!user || !user.is_active) {
    return { message: 'Si el correo existe, se generó un enlace de recuperación' }
  }

  const rawToken = crypto.randomBytes(32).toString('hex')
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex')
  const expires = new Date(Date.now() + 1000 * 60 * 60) // 1 hora

  const { error: updateError } = await supabase
    .from('users')
    .update({ reset_token: hashedToken, reset_token_expires: expires.toISOString() })
    .eq('id', user.id)

  if (updateError) throw new Error(updateError.message)

  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000'
  const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`

  if (isEmailConfigured()) {
    await sendPasswordResetEmail(email, resetLink)
    return { message: 'Si el correo existe, se envió un enlace de recuperación' }
  }

  // SEGURIDAD: sin RESEND_API_KEY configurada nunca devolvemos el token en
  // la respuesta del API — eso permitiría a cualquiera tomar el control de
  // cualquier cuenta (incluida un ADMIN) solo con su correo. En producción
  // simplemente no hay flujo de recuperación funcional hasta configurar el
  // email. En desarrollo local, el enlace se imprime en la consola del
  // servidor para poder probar el flujo sin enviar un correo real.
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.log(`[DEV] Enlace de recuperación de contraseña para ${email}: ${resetLink}`)
  }

  return {
    message: 'Si el correo existe, se generó un enlace de recuperación',
  }
}

export const resetPassword = async ({ token, password }: ResetPasswordDTO) => {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

  const { data: user, error } = await supabase
    .from('users')
    .select('id, reset_token_expires')
    .eq('reset_token', hashedToken)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!user) throw new Error('Token inválido o expirado')

  const expires = user.reset_token_expires ? new Date(user.reset_token_expires as string) : null
  if (!expires || expires.getTime() < Date.now()) {
    throw new Error('Token inválido o expirado')
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  const { error: updateError } = await supabase
    .from('users')
    .update({
      password: hashedPassword,
      reset_token: null,
      reset_token_expires: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (updateError) throw new Error(updateError.message)

  return { message: 'Contraseña actualizada correctamente' }
}
