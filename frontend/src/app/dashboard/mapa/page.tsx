'use client'

import { useEffect, useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { api } from '@/lib/api'
import type { MapSignal, SignalStatus } from '@/components/MapView'

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

const STATUS_OPTIONS: { value: SignalStatus | ''; label: string; color: string }[] = [
  { value: '', label: 'Todos los estados', color: 'bg-zinc-200 text-zinc-700' },
  { value: 'BUENO', label: 'Bueno', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'REGULAR', label: 'Regular', color: 'bg-amber-100 text-amber-700' },
  { value: 'DETERIORADO', label: 'Deteriorado', color: 'bg-orange-100 text-orange-700' },
  { value: 'CAIDO', label: 'Caído', color: 'bg-rose-100 text-rose-700' },
  { value: 'DESAPARECIDO', label: 'Desaparecido', color: 'bg-zinc-200 text-zinc-600' },
]

const navItems = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Mapa GIS', href: '/dashboard/mapa' },
  { label: 'Señales', href: '/dashboard/signals' },
  { label: 'Inspecciones', href: '/dashboard/inspections' },
  { label: 'Mantenimientos', href: '/dashboard/maintenances' },
  { label: 'Reportes', href: '/dashboard/reportes' },
]

export default function MapaPage() {
  const [allSignals, setAllSignals] = useState<MapSignal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<SignalStatus | ''>('')
  const [searchText, setSearchText] = useState('')

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
  }, [])

  const filteredSignals = useMemo(() => {
    return allSignals.filter((s) => {
      const matchStatus = statusFilter === '' || s.status === statusFilter
      const matchSearch =
        searchText === '' ||
        s.signal_code.toLowerCase().includes(searchText.toLowerCase()) ||
        (s.address ?? '').toLowerCase().includes(searchText.toLowerCase()) ||
        (s.municipalities?.name ?? '').toLowerCase().includes(searchText.toLowerCase())
      return matchStatus && matchSearch
    })
  }, [allSignals, statusFilter, searchText])

  const countByStatus = useMemo(() => {
    return allSignals.reduce((acc, s) => {
      acc[s.status] = (acc[s.status] ?? 0) + 1
      return acc
    }, {} as Record<string, number>)
  }, [allSignals])

  return (
    <div className="flex min-h-screen bg-zinc-100">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-zinc-200 bg-zinc-950 px-5 py-6 text-white lg:flex lg:flex-col">
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">
            Inventario vial
          </p>
          <h1 className="mt-2 text-2xl font-bold">SIGSEV</h1>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className={`block rounded-md px-3 py-2 text-sm font-medium ${
                item.href === '/dashboard/mapa'
                  ? 'bg-white text-zinc-950'
                  : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <div className="flex flex-1 flex-col lg:pl-64">
        <header className="border-b border-zinc-200 bg-white px-5 py-4 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-700">Mapa GIS</p>
              <h2 className="text-xl font-bold text-zinc-950">Señales en mapa</h2>
            </div>
            <span className="text-sm text-zinc-500">
              {loading ? 'Cargando…' : `${filteredSignals.length} señal${filteredSignals.length !== 1 ? 'es' : ''} visibles`}
            </span>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Filters panel */}
          <aside className="w-72 shrink-0 overflow-y-auto border-r border-zinc-200 bg-white p-4">
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
          <div className="relative flex-1">
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
