'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { api } from '@/lib/api'

interface Signal {
  id: string
  signal_code: string
  address: string | null
  status: 'BUENO' | 'REGULAR' | 'DETERIORADO' | 'CAIDO' | 'DESAPARECIDO'
  is_active: boolean
  latitude: number
  longitude: number
  municipalities: { name: string } | null
  zones: { name: string } | null
  signal_categories: { name: string } | null
  signal_types: { name: string } | null
  created_at: string | null
}

interface SignalsResponse {
  data: Signal[]
  total: number
  page: number
  limit: number
}

const STATUS_COLORS: Record<string, string> = {
  BUENO: 'bg-emerald-100 text-emerald-700',
  REGULAR: 'bg-amber-100 text-amber-700',
  DETERIORADO: 'bg-orange-100 text-orange-700',
  CAIDO: 'bg-rose-100 text-rose-700',
  DESAPARECIDO: 'bg-zinc-200 text-zinc-600',
}

const STATUS_LABELS: Record<string, string> = {
  BUENO: 'Bueno',
  REGULAR: 'Regular',
  DETERIORADO: 'Deteriorado',
  CAIDO: 'Caído',
  DESAPARECIDO: 'Desaparecido',
}

export default function SignalsPage() {
  const router = useRouter()
  const [signals, setSignals] = useState<Signal[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const LIMIT = 15

  const fetchSignals = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
      })
      if (statusFilter) params.set('status', statusFilter)

      const res = await api.get<SignalsResponse>(`/api/signals?${params}`)
      setSignals(res.data)
      setTotal(res.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar señales')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  useEffect(() => { fetchSignals() }, [fetchSignals])

  const handleDeactivate = async (id: string) => {
    if (!confirm('¿Desactivar esta señal?')) return
    try {
      await api.delete(`/api/signals/${id}`)
      fetchSignals()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error')
    }
  }

  const filtered = search
    ? signals.filter(
        (s) =>
          s.signal_code.toLowerCase().includes(search.toLowerCase()) ||
          (s.address ?? '').toLowerCase().includes(search.toLowerCase()) ||
          (s.municipalities?.name ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : signals

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <DashboardLayout
      title="Señales"
      subtitle="Inventario vial"
      actions={
        <a
          href="/dashboard/signals/new"
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          + Nueva señal
        </a>
      }
    >
      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Buscar por código, dirección, municipio…"
          className="w-72 rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
        >
          <option value="">Todos los estados</option>
          <option value="BUENO">Bueno</option>
          <option value="REGULAR">Regular</option>
          <option value="DETERIORADO">Deteriorado</option>
          <option value="CAIDO">Caído</option>
          <option value="DESAPARECIDO">Desaparecido</option>
        </select>
        <button
          onClick={() => { setPage(1); fetchSignals() }}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Actualizar
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-5 py-3 flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-600">
            {loading ? 'Cargando…' : `${total} señal${total !== 1 ? 'es' : ''} en total`}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Código</th>
                <th className="px-5 py-3 font-semibold">Dirección</th>
                <th className="px-5 py-3 font-semibold">Municipio</th>
                <th className="px-5 py-3 font-semibold">Categoría</th>
                <th className="px-5 py-3 font-semibold">Estado</th>
                <th className="px-5 py-3 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 animate-pulse rounded bg-zinc-100" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-zinc-400">
                    No hay señales registradas
                  </td>
                </tr>
              ) : (
                filtered.map((signal) => (
                  <tr key={signal.id} className="hover:bg-zinc-50">
                    <td className="px-5 py-4 font-semibold text-zinc-950">
                      {signal.signal_code}
                    </td>
                    <td className="px-5 py-4 text-zinc-600 max-w-[200px] truncate">
                      {signal.address ?? '—'}
                    </td>
                    <td className="px-5 py-4 text-zinc-600">
                      {signal.municipalities?.name ?? '—'}
                    </td>
                    <td className="px-5 py-4 text-zinc-600">
                      {signal.signal_categories?.name ?? '—'}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_COLORS[signal.status]}`}>
                        {STATUS_LABELS[signal.status]}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-3">
                        <button
                          onClick={() => router.push(`/dashboard/signals/${signal.id}`)}
                          className="text-emerald-600 hover:underline text-xs font-medium"
                        >
                          Ver
                        </button>
                        <button
                          onClick={() => router.push(`/dashboard/signals/${signal.id}/edit`)}
                          className="text-zinc-600 hover:underline text-xs font-medium"
                        >
                          Editar
                        </button>
                        {signal.is_active && (
                          <button
                            onClick={() => handleDeactivate(signal.id)}
                            className="text-rose-500 hover:underline text-xs font-medium"
                          >
                            Desactivar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-zinc-100 px-5 py-3">
            <span className="text-xs text-zinc-500">
              Página {page} de {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium disabled:opacity-40 hover:bg-zinc-50"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium disabled:opacity-40 hover:bg-zinc-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
