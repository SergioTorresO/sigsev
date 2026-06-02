import supabase from '../../lib/supabase'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

export const createUserSchema = z.object({
  full_name: z.string().trim().min(3, 'Nombre muy corto'),
  email: z.string().trim().email('Correo inválido').toLowerCase(),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  phone: z.string().trim().regex(/^[0-9+\-()\s]{7,20}$/, 'Teléfono inválido').optional(),
  role_id: z.string().uuid('role_id inválido').optional(),
  municipality: z.string().trim().optional(),
  position: z.string().trim().optional(),
})

export const updateUserSchema = z.object({
  full_name: z.string().trim().min(3).optional(),
  phone: z.string().trim().regex(/^[0-9+\-()\s]{7,20}$/).optional(),
  role_id: z.string().uuid().optional(),
  municipality: z.string().trim().optional(),
  position: z.string().trim().optional(),
  is_active: z.boolean().optional(),
})

export const usersFiltersSchema = z.object({
  search: z.string().optional(),
  role_id: z.string().uuid().optional(),
  is_active: z.string().transform((v) => v === 'true').optional(),
  page: z.string().transform(Number).optional(),
  limit: z.string().transform(Number).optional(),
})

type CreateUserDTO = z.infer<typeof createUserSchema>
type UpdateUserDTO = z.infer<typeof updateUserSchema>
type UsersFilters = z.infer<typeof usersFiltersSchema>

const USER_SELECT = `
  id, full_name, email, phone, is_active, municipality, position,
  created_at, updated_at, role_id,
  roles(id, name, description)
`

export const getUsers = async (filters: UsersFilters) => {
  const { search, role_id, is_active, page = 1, limit = 20 } = filters

  let query = supabase
    .from('users')
    .select(USER_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (role_id) query = query.eq('role_id', role_id)
  if (is_active !== undefined) query = query.eq('is_active', is_active)
  if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)

  const { data, error, count } = await query
  if (error) throw new Error(error.message)
  return { data: data ?? [], total: count ?? 0, page, limit }
}

export const getUserById = async (id: string) => {
  const { data, error } = await supabase
    .from('users')
    .select(USER_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Usuario no encontrado')
  return data
}

export const createUser = async (dto: CreateUserDTO) => {
  const { data: existing } = await supabase
    .from('users').select('id').eq('email', dto.email).maybeSingle()
  if (existing) throw new Error('El correo ya está registrado')

  // Resolve role
  let finalRoleId: string | null = null
  if (dto.role_id) {
    const { data: role } = await supabase
      .from('roles').select('id').eq('id', dto.role_id).maybeSingle()
    if (!role) throw new Error('Rol no encontrado')
    finalRoleId = role.id
  } else {
    const { data: defaultRole } = await supabase
      .from('roles').select('id').eq('name', 'CONSULTA').maybeSingle()
    finalRoleId = defaultRole?.id ?? null
  }

  const hashedPassword = await bcrypt.hash(dto.password, 10)

  const { data, error } = await supabase
    .from('users')
    .insert({
      full_name: dto.full_name,
      email: dto.email,
      password: hashedPassword,
      phone: dto.phone,
      role_id: finalRoleId,
      municipality: dto.municipality,
      position: dto.position,
    })
    .select(USER_SELECT)
    .single()

  if (error) throw new Error(error.message)
  return data
}

export const updateUser = async (id: string, dto: UpdateUserDTO) => {
  await getUserById(id)

  const { data, error } = await supabase
    .from('users')
    .update({ ...dto, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(USER_SELECT)
    .single()

  if (error) throw new Error(error.message)
  return data
}

export const toggleUserActive = async (id: string) => {
  const user = await getUserById(id)
  const newStatus = !user.is_active

  const { data, error } = await supabase
    .from('users')
    .update({ is_active: newStatus, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(USER_SELECT)
    .single()

  if (error) throw new Error(error.message)
  return data
}

export const deleteUser = async (id: string) => {
  await getUserById(id)

  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
  return { message: 'Usuario eliminado' }
}

export const getRoles = async () => {
  const { data, error } = await supabase
    .from('roles').select('id, name, description').order('name')
  if (error) throw new Error(error.message)
  return data ?? []
}
