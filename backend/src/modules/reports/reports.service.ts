import supabase from '../../lib/supabase'
import { z } from 'zod'

// PostgREST limita cada respuesta a 1000 filas por defecto. Los reportes
// necesitan exportar TODAS las filas que cumplan el filtro (no es una vista
// paginada en pantalla, es un Excel/PDF completo), así que sin esto cualquier
// reporte de más de 1000 señales/inspecciones/mantenimientos se truncaría en
// silencio. Esta función pagina internamente con `.range()` en lotes de 1000
// hasta agotar los resultados, y al final entrega el array completo.
const PAGE_SIZE = 1000

interface Rangeable<T> {
  range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
}

const fetchAllRows = async <T>(buildQuery: () => Rangeable<T>): Promise<T[]> => {
  const rows: T[] = []
  let from = 0
  while (true) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    const page = data ?? []
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return rows
}

// Filtros comunes a los 4 reportes. Todos opcionales — sin filtros, se reporta todo.
export const reportFiltersSchema = z.object({
  date_from: z.string().optional(), // aplica a inspection_date / maintenance_date según el reporte
  date_to: z.string().optional(),
  municipality_id: z.string().uuid().optional(),
  zone_id: z.string().uuid().optional(),
  status: z.string().optional(), // estado de señal (BUENO/REGULAR/DETERIORADO/CAIDO/DESAPARECIDO) o de mantenimiento (PENDIENTE/EN_PROCESO/COMPLETADO) según el reporte
})

export type ReportFilters = z.infer<typeof reportFiltersSchema>

// --- Señales por estado ---

type SignalReportRow = {
  signal_code: string
  address: string | null
  status: string
  installation_date: string | null
  is_active: boolean
  municipalities: { name: string } | null
  zones: { name: string } | null
  signal_categories: { name: string } | null
  signal_types: { name: string } | null
}

export const getSignalsReportData = async (filters: ReportFilters) => {
  const buildQuery = () => {
    let query = supabase
      .from('signals')
      .select(`
        signal_code, address, status, installation_date, is_active,
        municipalities(name), zones(name), signal_categories(name), signal_types(name)
      `)
      .order('signal_code', { ascending: true })

    if (filters.municipality_id) query = query.eq('municipality_id', filters.municipality_id)
    if (filters.zone_id) query = query.eq('zone_id', filters.zone_id)
    if (filters.status) query = query.eq('status', filters.status)

    return query
  }

  const data = await fetchAllRows<unknown>(buildQuery as () => Rangeable<unknown>)

  return (data as SignalReportRow[]).map((s) => ({
    'Código': s.signal_code,
    'Dirección': s.address ?? '',
    'Estado': s.status,
    'Municipio': (s.municipalities as unknown as { name: string } | null)?.name ?? '',
    'Zona': (s.zones as unknown as { name: string } | null)?.name ?? '',
    'Categoría': (s.signal_categories as unknown as { name: string } | null)?.name ?? '',
    'Tipo': (s.signal_types as unknown as { name: string } | null)?.name ?? '',
    'Fecha instalación': s.installation_date ?? '',
    'Activa': s.is_active ? 'Sí' : 'No',
  }))
}

// --- Inspecciones por período ---

type InspectionReportRow = {
  status: string
  observations: string | null
  inspection_date: string | null
  signals: unknown
  users: unknown
}

export const getInspectionsReportData = async (filters: ReportFilters) => {
  // signals!inner permite filtrar por columnas de la tabla relacionada (municipality_id/zone_id)
  const buildQuery = () => {
    let query = supabase
      .from('inspections')
      .select(`
        status, observations, inspection_date,
        signals!inner(signal_code, address, municipality_id, zone_id, municipalities(name), zones(name)),
        users(full_name)
      `)
      .order('inspection_date', { ascending: false })

    if (filters.date_from) query = query.gte('inspection_date', filters.date_from)
    if (filters.date_to) query = query.lte('inspection_date', filters.date_to)
    if (filters.status) query = query.eq('status', filters.status)
    if (filters.municipality_id) query = query.eq('signals.municipality_id', filters.municipality_id)
    if (filters.zone_id) query = query.eq('signals.zone_id', filters.zone_id)

    return query
  }

  const data = await fetchAllRows<InspectionReportRow>(buildQuery as () => Rangeable<InspectionReportRow>)

  return data.map((r) => {
    const signal = r.signals as unknown as {
      signal_code: string
      address: string | null
      municipalities: { name: string } | null
      zones: { name: string } | null
    } | null
    return {
      'Señal': signal?.signal_code ?? '',
      'Dirección': signal?.address ?? '',
      'Municipio': signal?.municipalities?.name ?? '',
      'Zona': signal?.zones?.name ?? '',
      'Estado reportado': r.status,
      'Técnico': (r.users as unknown as { full_name: string } | null)?.full_name ?? '',
      'Fecha inspección': r.inspection_date ?? '',
      'Observaciones': r.observations ?? '',
    }
  })
}

// --- Mantenimientos por período ---

type MaintenanceReportRow = {
  status: string
  description: string | null
  cost: number | null
  maintenance_date: string | null
  completed_at: string | null
  signals: unknown
  users: unknown
}

export const getMaintenancesReportData = async (filters: ReportFilters) => {
  const buildQuery = () => {
    let query = supabase
      .from('maintenances')
      .select(`
        status, description, cost, maintenance_date, completed_at,
        signals!inner(signal_code, address, municipality_id, zone_id),
        users(full_name)
      `)
      .order('maintenance_date', { ascending: false })

    if (filters.date_from) query = query.gte('maintenance_date', filters.date_from)
    if (filters.date_to) query = query.lte('maintenance_date', filters.date_to)
    if (filters.status) query = query.eq('status', filters.status)
    if (filters.municipality_id) query = query.eq('signals.municipality_id', filters.municipality_id)
    if (filters.zone_id) query = query.eq('signals.zone_id', filters.zone_id)

    return query
  }

  const data = await fetchAllRows<MaintenanceReportRow>(buildQuery as () => Rangeable<MaintenanceReportRow>)

  return data.map((m) => ({
    'Señal': (m.signals as unknown as { signal_code: string } | null)?.signal_code ?? '',
    'Dirección': (m.signals as unknown as { address: string | null } | null)?.address ?? '',
    'Descripción': m.description ?? '',
    'Estado': m.status,
    'Asignado a': (m.users as unknown as { full_name: string } | null)?.full_name ?? '',
    'Fecha programada': m.maintenance_date ?? '',
    'Fecha completado': m.completed_at ?? '',
    'Costo': m.cost ?? '',
  }))
}

// --- Resumen general (consolidado para el dashboard de reportes) ---
//
// Nota de diseño: señales y mantenimientos son totales de estado actual, así
// que el filtro de municipio/zona sí les aplica de forma natural (cuántas
// señales/mantenimientos hay en esa zona, ahora). El filtro de fecha en
// cambio solo tiene sentido para inspecciones (eventos puntuales en el
// tiempo) — aplicarlo a señales/mantenimientos sería ambiguo ("¿señales
// instaladas en ese rango?" no es lo que se está pidiendo aquí). Por eso
// cada filtro se aplica solo donde tiene semántica clara, y se deja
// explícito en las filas de resultado para que no se preste a confusión.

export const getSummaryReportData = async (filters: ReportFilters) => {
  const [municipalityName, zoneName] = await Promise.all([
    filters.municipality_id
      ? supabase.from('municipalities').select('name').eq('id', filters.municipality_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    filters.zone_id
      ? supabase.from('zones').select('name').eq('id', filters.zone_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  // Antes esto traía TODAS las filas de señales/mantenimientos (con head:
  // false) solo para contarlas por estado en JS — el mismo anti-patrón que
  // en dashboard.service.ts, con el mismo riesgo de truncarse en silencio
  // pasadas las 1000 filas que devuelve PostgREST por defecto. Se reemplaza
  // por un count exacto (`head: true`) por cada estado posible, en paralelo.
  const SIGNAL_STATUSES = ['BUENO', 'REGULAR', 'DETERIORADO', 'CAIDO', 'DESAPARECIDO'] as const
  const MAINTENANCE_STATUSES = ['PENDIENTE', 'EN_PROCESO', 'COMPLETADO'] as const

  const signalCountQueries = SIGNAL_STATUSES.map((status) => {
    let q = supabase.from('signals').select('id', { count: 'exact', head: true }).eq('status', status)
    if (filters.municipality_id) q = q.eq('municipality_id', filters.municipality_id)
    if (filters.zone_id) q = q.eq('zone_id', filters.zone_id)
    return q
  })

  const inspectionsQuery = (() => {
    let q = supabase.from('inspections').select('id', { count: 'exact', head: true })
    if (filters.date_from) q = q.gte('inspection_date', filters.date_from)
    if (filters.date_to) q = q.lte('inspection_date', filters.date_to)
    return q
  })()

  // signals!inner: maintenances no tiene municipality_id propio, se filtra a través de la señal asociada
  const maintenanceCountQueries = MAINTENANCE_STATUSES.map((status) => {
    let q = supabase
      .from('maintenances')
      .select('id, signals!inner(municipality_id, zone_id)', { count: 'exact', head: true })
      .eq('status', status)
    if (filters.municipality_id) q = q.eq('signals.municipality_id', filters.municipality_id)
    if (filters.zone_id) q = q.eq('signals.zone_id', filters.zone_id)
    return q
  })

  const [signalResults, inspectionsTotal, maintenanceResults] = await Promise.all([
    Promise.all(signalCountQueries),
    inspectionsQuery,
    Promise.all(maintenanceCountQueries),
  ])

  if (inspectionsTotal.error) throw new Error(inspectionsTotal.error.message)

  const signalCounts: Record<string, number> = {}
  signalResults.forEach((res, i) => {
    if (res.error) throw new Error(res.error.message)
    if (res.count) signalCounts[SIGNAL_STATUSES[i]] = res.count
  })

  const maintenanceCounts: Record<string, number> = {}
  maintenanceResults.forEach((res, i) => {
    if (res.error) throw new Error(res.error.message)
    if (res.count) maintenanceCounts[MAINTENANCE_STATUSES[i]] = res.count
  })

  const signalsTotal = Object.values(signalCounts).reduce((a, b) => a + b, 0)

  const locationLabel = [municipalityName.data?.name, zoneName.data?.name].filter(Boolean).join(' / ') || 'Todas'
  const periodLabel = filters.date_from || filters.date_to
    ? `${filters.date_from ?? '…'} a ${filters.date_to ?? '…'}`
    : 'Todo el historial'

  return [
    { 'Categoría': 'Filtros aplicados', 'Indicador': 'Ubicación (señales y mantenimientos)', 'Valor': locationLabel },
    { 'Categoría': 'Filtros aplicados', 'Indicador': 'Período (solo inspecciones)', 'Valor': periodLabel },
    { 'Categoría': 'Señales', 'Indicador': 'Total', 'Valor': signalsTotal },
    ...Object.entries(signalCounts).map(([status, count]) => ({
      'Categoría': 'Señales', 'Indicador': `Estado: ${status}`, 'Valor': count,
    })),
    { 'Categoría': 'Inspecciones', 'Indicador': 'Total en el período', 'Valor': inspectionsTotal.count ?? 0 },
    { 'Categoría': 'Mantenimientos', 'Indicador': 'Total', 'Valor': Object.values(maintenanceCounts).reduce((a, b) => a + b, 0) },
    ...Object.entries(maintenanceCounts).map(([status, count]) => ({
      'Categoría': 'Mantenimientos', 'Indicador': `Estado: ${status}`, 'Valor': count,
    })),
  ]
}
