import supabase from '../../lib/supabase'

const SIGNAL_STATUSES = ['BUENO', 'REGULAR', 'DETERIORADO', 'CAIDO', 'DESAPARECIDO'] as const

// --- Señales por estado ---
//
// Solo señales activas (is_active = true): las desactivadas (soft delete) no
// representan el inventario vigente y distorsionarían el gráfico.
//
// Antes esto traía TODAS las filas (columna status) a memoria solo para
// contarlas en JS — con el inventario completo de un municipio eso es una
// tabla entera por cada render del dashboard, y además PostgREST limita cada
// respuesta a 1000 filas por defecto, así que pasado ese umbral el conteo
// quedaría silenciosamente truncado. En su lugar se pide a Postgres un count
// exacto por estado (`head: true` no descarga filas, solo el total).
export const getSignalsByStatus = async () => {
  const results = await Promise.all(
    SIGNAL_STATUSES.map((status) =>
      supabase
        .from('signals')
        .select('id', { head: true, count: 'exact' })
        .eq('is_active', true)
        .eq('status', status)
    )
  )

  const counts: Record<string, number> = {}
  results.forEach((res, i) => {
    if (res.error) throw new Error(res.error.message)
    if (res.count) counts[SIGNAL_STATUSES[i]] = res.count
  })
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
