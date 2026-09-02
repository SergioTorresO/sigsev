import { z } from 'zod'
import supabase from '../../lib/supabase'

// ── Schemas ────────────────────────────────────────────────────────────────
export const categorySchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido').max(100),
  description: z.string().trim().max(255).optional(),
})

export const signalTypeSchema = z.object({
  category_id: z.string().uuid('Categoría inválida'),
  code: z.string().trim().min(1, 'El código es requerido').max(20),
  name: z.string().trim().min(1, 'El nombre es requerido').max(150),
  description: z.string().trim().max(500).optional(),
})

// ── Categorías ─────────────────────────────────────────────────────────────
export const listCategories = async () => {
  const { data, error } = await supabase
    .from('signal_categories')
    .select('id, name, description, signal_types(count)')
    .order('name')
  if (error) throw new Error(error.message)
  return data
}

export const createCategory = async (payload: z.infer<typeof categorySchema>) => {
  const { data, error } = await supabase
    .from('signal_categories')
    .insert({ name: payload.name, description: payload.description ?? null })
    .select('id, name, description')
    .single()
  if (error) throw new Error(error.message)
  return data
}

export const updateCategory = async (id: string, payload: z.infer<typeof categorySchema>) => {
  const { data, error } = await supabase
    .from('signal_categories')
    .update({ name: payload.name, description: payload.description ?? null })
    .eq('id', id)
    .select('id, name, description')
    .single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Categoría no encontrada')
  return data
}

export const deleteCategory = async (id: string) => {
  // Verificar que no tenga tipos asociados
  const { count } = await supabase
    .from('signal_types')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', id)
  if ((count ?? 0) > 0)
    throw new Error('No se puede eliminar: hay tipos de señal asociados a esta categoría')

  const { error } = await supabase.from('signal_categories').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ── Tipos de señal ─────────────────────────────────────────────────────────
export const listSignalTypes = async (params: {
  category_id?: string
  search?: string
  page: number
  limit: number
}) => {
  const { category_id, search, page, limit } = params
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase
    .from('signal_types')
    .select('id, code, name, description, category_id, signal_categories(id, name)', { count: 'exact' })
    .order('code')
    .range(from, to)

  if (category_id) query = query.eq('category_id', category_id)
  if (search) query = query.or(`code.ilike.%${search}%,name.ilike.%${search}%`)

  const { data, error, count } = await query
  if (error) throw new Error(error.message)
  return { data, total: count ?? 0, page, limit }
}

export const createSignalType = async (payload: z.infer<typeof signalTypeSchema>) => {
  // Verificar código único
  const { count } = await supabase
    .from('signal_types')
    .select('id', { count: 'exact', head: true })
    .eq('code', payload.code.toUpperCase())
  if ((count ?? 0) > 0) throw new Error(`Ya existe un tipo de señal con el código ${payload.code.toUpperCase()}`)

  const { data, error } = await supabase
    .from('signal_types')
    .insert({
      category_id: payload.category_id,
      code: payload.code.toUpperCase(),
      name: payload.name,
      description: payload.description ?? null,
    })
    .select('id, code, name, description, category_id')
    .single()
  if (error) throw new Error(error.message)
  return data
}

export const updateSignalType = async (id: string, payload: z.infer<typeof signalTypeSchema>) => {
  // Verificar código único (excluyendo el propio)
  const { count } = await supabase
    .from('signal_types')
    .select('id', { count: 'exact', head: true })
    .eq('code', payload.code.toUpperCase())
    .neq('id', id)
  if ((count ?? 0) > 0) throw new Error(`Ya existe un tipo de señal con el código ${payload.code.toUpperCase()}`)

  const { data, error } = await supabase
    .from('signal_types')
    .update({
      category_id: payload.category_id,
      code: payload.code.toUpperCase(),
      name: payload.name,
      description: payload.description ?? null,
    })
    .eq('id', id)
    .select('id, code, name, description, category_id')
    .single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Tipo de señal no encontrado')
  return data
}

export const deleteSignalType = async (id: string) => {
  // Verificar que no esté en uso por señales
  const { count } = await supabase
    .from('signals')
    .select('id', { count: 'exact', head: true })
    .eq('signal_type_id', id)
  if ((count ?? 0) > 0)
    throw new Error('No se puede eliminar: hay señales usando este tipo')

  const { error } = await supabase.from('signal_types').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
