import { Router, Request, Response } from 'express'
import supabase from '../../lib/supabase'
import { verifyToken } from '../../middlewares/auth.middleware'

const router = Router()
router.use(verifyToken)

router.get('/municipalities', async (_req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('municipalities').select('id, name').order('name')
  if (error) return res.status(500).json({ message: error.message })
  return res.json(data)
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
