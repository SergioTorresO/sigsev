import supabase from '../../lib/supabase'
import { z } from 'zod'

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

export const getSignalsReportData = async (filters: ReportFilters) => {
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

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? []).map((s) => ({
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

export const getInspectionsReportData = async (filters: ReportFilters) => {
  // signals!inner permite filtrar por columnas de la tabla relacionada (municipality_id/zone_id)
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

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? []).map((r) => {
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

export const getMaintenancesReportData = async (filters: ReportFilters) => {
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

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? []).map((m) => ({
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

  const signalsQuery = (() => {
    let q = supabase.from('signals').select('status', { count: 'exact', head: false })
    if (filters.municipality_id) q = q.eq('municipality_id', filters.municipality_id)
    if (filters.zone_id) q = q.eq('zone_id', filters.zone_id)
    return q
  })()

  const inspectionsQuery = (() => {
    let q = supabase.from('inspections').select('id', { count: 'exact', head: true })
    if (filters.date_from) q = q.gte('inspection_date', filters.date_from)
    if (filters.date_to) q = q.lte('inspection_date', filters.date_to)
    return q
  })()

  // signals!inner: maintenances no tiene municipality_id propio, se filtra a través de la señal asociada
  const maintenancesQuery = (() => {
    let q = supabase
      .from('maintenances')
      .select('status, signals!inner(municipality_id, zone_id)', { count: 'exact', head: false })
    if (filters.municipality_id) q = q.eq('signals.municipality_id', filters.municipality_id)
    if (filters.zone_id) q = q.eq('signals.zone_id', filters.zone_id)
    return q
  })()

  const [signalsByStatus, inspectionsTotal, maintenancesByStatus] = await Promise.all([
    signalsQuery,
    inspectionsQuery,
    maintenancesQuery,
  ])

  if (signalsByStatus.error) throw new Error(signalsByStatus.error.message)
  if (inspectionsTotal.error) throw new Error(inspectionsTotal.error.message)
  if (maintenancesByStatus.error) throw new Error(maintenancesByStatus.error.message)

  const countBy = (rows: { status: string }[] | null) => {
    const counts: Record<string, number> = {}
    for (const row of rows ?? []) counts[row.status] = (counts[row.status] ?? 0) + 1
    return counts
  }

  const signalCounts = countBy(signalsByStatus.data)
  const maintenanceCounts = countBy(maintenancesByStatus.data)

  const locationLabel = [municipalityName.data?.name, zoneName.data?.name].filter(Boolean).join(' / ') || 'Todas'
  const periodLabel = filters.date_from || filters.date_to
    ? `${filters.date_from ?? '…'} a ${filters.date_to ?? '…'}`
    : 'Todo el historial'

  return [
    { 'Categoría': 'Filtros aplicados', 'Indicador': 'Ubicación (señales y mantenimientos)', 'Valor': locationLabel },
    { 'Categoría': 'Filtros aplicados', 'Indicador': 'Período (solo inspecciones)', 'Valor': periodLabel },
    { 'Categoría': 'Señales', 'Indicador': 'Total', 'Valor': signalsByStatus.data?.length ?? 0 },
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
