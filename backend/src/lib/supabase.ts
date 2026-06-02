import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridos en .env')
}

// Service role client — bypasses RLS, only use on the server
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
})

export default supabase
