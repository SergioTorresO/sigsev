'use client'

import { useEffect, useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { api } from '@/lib/api'
import type { MapSignal, SignalStatus } from '@/components/MapView'
import Sidebar from '@/components/Sidebar'
import NotificationBell from '@/components/NotificationBell'

// Load Leaflet only on the client (it uses `window`)
const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-zinc-100">
      <p className="text-sm text-zinc-500">Cargando mapa…</p>
    </div>
  ),
})

interface SignalsResponse {
  data: MapSignal[]
  total: number
}

interface RefItem { id: string; name: string }
interface MunicipalityRef extends RefItem { department_id: string }

const STATUS_OPTIONS: { value: SignalStatus | ''; label: string; color: string }[] = [
  { value: '', label: 'Todos los estados', color: 'bg-zinc-200 text-zinc-700' },
  { value: 'BUENO', label: 'Bueno', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'REGULAR', label: 'Regular', color: 'bg-amber-100 text-amber-700' },
  { value: 'DETERIORADO', label: 'Deteriorado', color: 'bg-orange-100 text-orange-700' },
  { value: 'CAIDO', label: 'Caído', color: 'bg-rose-100 text-rose-700' },
  { value: 'DESAPARECIDO', label: 'Desaparecido', color: 'bg-zinc-200 text-zinc-600' },
]

export default function MapaPage() {
  const [allSignals, setAllSignals] = useState<MapSignal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [filtersOpen, setFiltersOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<SignalStatus | ''>('')
  const [searchText, setSearchText] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [municipalityFilter, setMunicipalityFilter] = useState('')
  const [zoneFilter, setZoneFilter] = useState('')

  const [departments, setDepartments] = useState<RefItem[]>([])
  const [municipalitiesRef, setMunicipalitiesRef] = useState<MunicipalityRef[]>([])

  useEffect(() => {
    const fetchSignals = async () => {
      try {
        setLoading(true)
        // Fetch all active signals — limit high to get them all for the map
        const res = await api.get<SignalsResponse>('/api/signals?limit=500&is_active=true')
        setAllSignals(res.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar señales')
      } finally {
        setLoading(false)
      }
    }
    fetchSignals()

    // Catálogo completo (no depende de las señales) solo para poder ubicar
    // a qué departamento pertenece cada municipio que sí tiene señales.
    Promise.all([
      api.get<RefItem[]>('/api/ref/departments'),
      api.get<MunicipalityRef[]>('/api/ref/municipalities'),
    ]).then(([deps, munis]) => {
      setDepartments(deps)
      setMunicipalitiesRef(munis)
    }).catch(() => {})
  }, [])

  const departmentByMunicipalityId = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of municipalitiesRef) map.set(m.id, m.department_id)
    return map
  }, [municipalitiesRef])

  const departmentNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const d of departments) map.set(d.id, d.name)
    return map
  }, [departments])

  // Listas de departamentos/municipios/zonas derivadas de las señales ya
  // cargadas (no de la tabla completa de 1119 municipios de Colombia): solo
  // interesa filtrar por lo que realmente tiene señales en el mapa.
  const departmentOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of allSignals) {
      const muniId = s.municipalities?.id
      if (!muniId) continue
      const depId = departmentByMunicipalityId.get(muniId)
      if (!depId) continue
      const depName = departmentNameById.get(depId)
      if (depName) map.set(depId, depName)
    }
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [allSignals, departmentByMunicipalityId, departmentNameById])

  const municipalityOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of allSignals) {
      if (!s.municipalities) continue
      if (departmentFilter && departmentByMunicipalityId.get(s.municipalities.id) !== departmentFilter) continue
      map.set(s.municipalities.id, s.municipalities.name)
    }
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [allSignals, departmentFilter, departmentByMunicipalityId])

  const zoneOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of allSignals) {
      if (!s.zones) continue
      if (municipalityFilter && s.municipalities?.id !== municipalityFilter) continue
      map.set(s.zones.id, s.zones.name)
    }
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [allSignals, municipalityFilter])

  // Si cambia el departamento y el municipio elegido ya no aplica, se limpia.
  useEffect(() => {
    if (municipalityFilter && !municipalityOptions.some((m) => m.id === municipalityFilter)) {
      setMunicipalityFilter('')
    }
  }, [municipalityOptions, municipalityFilter])

  // Si cambia el municipio y la zona elegida ya no aplica, se limpia.
  useEffect(() => {
    if (zoneFilter && !zoneOptions.some((z) => z.id === zoneFilter)) {
      setZoneFilter('')
    }
  }, [zoneOptions, zoneFilter])

  const filteredSignals = useMemo(() => {
    return allSignals.filter((s) => {
      const matchStatus = statusFilter === '' || s.status === statusFilter
      const matchDepartment =
        departmentFilter === '' ||
        (s.municipalities ? departmentByMunicipalityId.get(s.municipalities.id) === departmentFilter : false)
      const matchMunicipality = municipalityFilter === '' || s.municipalities?.id === municipalityFilter
      const matchZone = zoneFilter === '' || s.zones?.id === zoneFilter
      const matchSearch =
        searchText === '' ||
        s.signal_code.toLowerCase().includes(searchText.toLowerCase()) ||
        (s.address ?? '').toLowerCase().includes(searchText.toLowerCase()) ||
        (s.municipalities?.name ?? '').toLowerCase().includes(searchText.toLowerCase())
      return matchStatus && matchDepartment && matchMunicipality && matchZone && matchSearch
    })
  }, [allSignals, statusFilter, departmentFilter, municipalityFilter, zoneFilter, searchText, departmentByMunicipalityId])

  const countByStatus = useMemo(() => {
    return allSignals.reduce((acc, s) => {
      acc[s.status] = (acc[s.status] ?? 0) + 1
      return acc
    }, {} as Record<string, number>)
  }, [allSignals])

  return (
    <div className="flex min-h-screen bg-zinc-100">
      <Sidebar />

      {/* Content */}
      <div className="flex flex-1 flex-col pt-14 lg:pl-20 lg:pt-0">
        <header className="border-b border-zinc-200 bg-white px-4 py-4 sm:px-5 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-emerald-700">Mapa GIS</p>
              <h2 className="text-xl font-bold text-zinc-950">Señales en mapa</h2>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-xs text-zinc-500 sm:text-sm">
                {loading ? 'Cargando…' : `${filteredSignals.length} señal${filteredSignals.length !== 1 ? 'es' : ''} visibles`}
              </span>
              <button
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 lg:hidden"
              >
                {filtersOpen ? 'Ocultar filtros' : 'Filtros'}
              </button>
              <NotificationBell />
            </div>
          </div>
        </header>

        <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
          {/* Filters panel */}
          <aside
            className={`${filtersOpen ? 'block' : 'hidden'} max-h-[55vh] w-full shrink-0 overflow-y-auto border-b border-zinc-200 bg-white p-4 lg:block lg:max-h-none lg:w-72 lg:border-b-0 lg:border-r`}
          >
            {/* Search */}
            <div className="mb-4">
              <label className="mb-1 block text-xs font-semibold uppercase text-zinc-500">
                Buscar
              </label>
              <input
                type="text"
                placeholder="Código, dirección, municipio…"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>

            {/* Department filter */}
            <div className="mb-4">
              <label className="mb-1 block text-xs font-semibold uppercase text-zinc-500">
                Departamento
              </label>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">Todos los departamentos</option>
                {departmentOptions.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Municipality filter */}
            <div className="mb-4">
              <label className="mb-1 block text-xs font-semibold uppercase text-zinc-500">
                Municipio
              </label>
              <select
                value={municipalityFilter}
                onChange={(e) => setMunicipalityFilter(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">Todos los municipios</option>
                {municipalityOptions.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            {/* Zone filter */}
            <div className="mb-4">
              <label className="mb-1 block text-xs font-semibold uppercase text-zinc-500">
                Zona
              </label>
              <select
                value={zoneFilter}
                onChange={(e) => setZoneFilter(e.target.value)}
                disabled={zoneOptions.length === 0}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:bg-zinc-50 disabled:text-zinc-400"
              >
                <option value="">Todas las zonas</option>
                {zoneOptions.map((z) => (
                  <option key={z.id} value={z.id}>{z.name}</option>
                ))}
              </select>
            </div>

            {/* Status filter */}
            <div className="mb-6">
              <label className="mb-2 block text-xs font-semibold uppercase text-zinc-500">
                Estado
              </label>
              <div className="space-y-1">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setStatusFilter(opt.value)}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      statusFilter === opt.value
                        ? 'bg-zinc-950 text-white'
                        : 'text-zinc-700 hover:bg-zinc-50'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {opt.value !== '' && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          statusFilter === opt.value ? 'bg-white/20 text-white' : opt.color
                        }`}
                      >
                        {countByStatus[opt.value] ?? 0}
                      </span>
                    )}
                    {opt.value === '' && (
                      <span className="text-xs text-zinc-400">{allSignals.length}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="border-t border-zinc-100 pt-4">
              <p className="mb-3 text-xs font-semibold uppercase text-zinc-500">Leyenda</p>
              <div className="space-y-2">
                {[
                  { color: '#10b981', label: 'Bueno' },
                  { color: '#f59e0b', label: 'Regular' },
                  { color: '#f97316', label: 'Deteriorado' },
                  { color: '#f43f5e', label: 'Caído' },
                  { color: '#71717a', label: 'Desaparecido' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <svg width="14" height="18" viewBox="0 0 28 36">
                      <path
                        d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 22 14 22S28 23.333 28 14C28 6.268 21.732 0 14 0z"
                        fill={item.color}
                      />
                    </svg>
                    <span className="text-sm text-zinc-600">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* Map */}
          <div className="relative min-h-[400px] flex-1">
            {error && (
              <div className="absolute inset-x-0 top-4 z-10 mx-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow">
                {error}
              </div>
            )}
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
                  <p className="text-sm text-zinc-500">Cargando señales…</p>
                </div>
              </div>
            ) : (
              <MapView signals={filteredSignals} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
