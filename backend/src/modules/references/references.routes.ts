import { Router, Request, Response } from 'express'
import supabase from '../../lib/supabase'
import { verifyToken } from '../../middlewares/auth.middleware'

const router = Router()
router.use(verifyToken)

router.get('/departments', async (_req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('departments').select('id, name').order('name')
  if (error) return res.status(500).json({ message: error.message })
  return res.json(data)
})

router.get('/municipalities', async (req: Request, res: Response) => {
  const departmentId = req.query.department_id as string | undefined

  if (departmentId) {
    const { data, error } = await supabase
      .from('municipalities').select('id, name, department_id')
      .eq('department_id', departmentId).order('name')
    if (error) return res.status(500).json({ message: error.message })
    return res.json(data)
  }

  // Sin filtro de departamento: PostgREST limita cada respuesta a max_rows
  // (1000 por defecto), pero el catálogo tiene 1119 municipios — sin paginar
  // aquí, la mitad final alfabética (Tenza en adelante) se pierde en
  // silencio para quien consuma el catálogo completo (p.ej. el cascada
  // Departamento→Municipio de /dashboard/zonas).
  const PAGE_SIZE = 1000
  const all: { id: string; name: string; department_id: string }[] = []
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from('municipalities').select('id, name, department_id')
      .order('name').range(from, from + PAGE_SIZE - 1)
    if (error) return res.status(500).json({ message: error.message })
    all.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return res.json(all)
})

router.get('/zones', async (req: Request, res: Response) => {
  let query = supabase.from('zones').select('id, name, zone_type, municipality_id').order('name')
  if (req.query.municipality_id) {
    query = query.eq('municipality_id', req.query.municipality_id as string)
  }
  const { data, error } = await query
  if (error) return res.status(500).json({ message: error.message })
  return res.json(data)
})

router.get('/categories', async (_req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('signal_categories').select('id, name').order('name')
  if (error) return res.status(500).json({ message: error.message })
  return res.json(data)
})

router.get('/signal-types', async (req: Request, res: Response) => {
  let query = supabase
    .from('signal_types').select('id, name, code, category_id').order('name')
  if (req.query.category_id) {
    query = query.eq('category_id', req.query.category_id as string)
  }
  const { data, error } = await query
  if (error) return res.status(500).json({ message: error.message })
  return res.json(data)
})

export default router
