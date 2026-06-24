import supabase from '../../lib/supabase'

// --- Señales por estado ---
//
// Solo señales activas (is_active = true): las desactivadas (soft delete) no
// representan el inventario vigente y distorsionarían el gráfico.
export const getSignalsByStatus = async () => {
  const { data, error } = await supabase
    .from('signals')
    .select('status')
    .eq('is_active', true)

  if (error) throw new Error(error.message)

  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    counts[row.status] = (counts[row.status] ?? 0) + 1
  }
  return counts
}

// --- Inspecciones por mes (últimos 6 meses, incluyendo el actual) ---
const MONTH_LABELS = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
]

export const getInspectionsByMonth = async () => {
  const now = new Date()
  // Primer día del mes hace 5 meses (6 meses en total incluyendo el actual)
  const start = new Date(now.getFullYear(), now.getMonth() - 5, 1)
  const startIso = start.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('inspections')
    .select('inspection_date')
    .gte('inspection_date', startIso)

  if (error) throw new Error(error.message)

  // Inicializamos los 6 buckets en orden cronológico para que el gráfico
  // siempre muestre los últimos 6 meses, incluso si algún mes tuvo 0 inspecciones.
  const buckets: { key: string; label: string; count: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    buckets.push({ key, label: `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`, count: 0 })
  }

  const bucketByKey = new Map(buckets.map((b) => [b.key, b]))

  for (const row of data ?? []) {
    if (!row.inspection_date) continue
    const key = row.inspection_date.slice(0, 7) // 'YYYY-MM'
    const bucket = bucketByKey.get(key)
    if (bucket) bucket.count += 1
  }

  return buckets.map(({ label, count }) => ({ month: label, count }))
}

export const getDashboardStats = async () => {
  const [signalsByStatus, inspectionsByMonth] = await Promise.all([
    getSignalsByStatus(),
    getInspectionsByMonth(),
  ])
  return { signalsByStatus, inspectionsByMonth }
}
