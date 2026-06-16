import supabase from '../../lib/supabase'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

export const updateProfileSchema = z.object({
  full_name: z.string().trim().min(3, 'Nombre muy corto').optional(),
  phone: z.string().trim().regex(/^[0-9+\-()\s]{7,20}$/, 'Teléfono inválido').optional(),
  municipality: z.string().trim().optional(),
  position: z.string().trim().optional(),
})

export const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Ingresa tu contraseña actual'),
  new_password: z.string().min(6, 'La nueva contraseña debe tener al menos 6 caracteres'),
})

type UpdateProfileDTO = z.infer<typeof updateProfileSchema>
type ChangePasswordDTO = z.infer<typeof changePasswordSchema>

const PROFILE_SELECT = `
  id, full_name, email, phone, is_active, municipality, position,
  created_at, updated_at, role_id,
  roles(id, name, description)
`

export const getMyProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('users')
    .select(PROFILE_SELECT)
    .eq('id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Usuario no encontrado')
  return data
}

export const updateMyProfile = async (userId: string, dto: UpdateProfileDTO) => {
  const { data, error } = await supabase
    .from('users')
    .update({ ...dto, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select(PROFILE_SELECT)
    .single()

  if (error) throw new Error(error.message)
  return data
}

export const changeMyPassword = async (userId: string, dto: ChangePasswordDTO) => {
  const { data: user, error } = await supabase
    .from('users')
    .select('id, password')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!user) throw new Error('Usuario no encontrado')

  const match = await bcrypt.compare(dto.current_password, user.password as string)
  if (!match) throw new Error('La contraseña actual es incorrecta')

  const hashed = await bcrypt.hash(dto.new_password, 10)

  const { error: updateError } = await supabase
    .from('users')
    .update({ password: hashed, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (updateError) throw new Error(updateError.message)
  return { message: 'Contraseña actualizada correctamente' }
}
