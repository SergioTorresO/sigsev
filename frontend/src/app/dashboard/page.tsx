'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import DashboardLayout from '@/components/DashboardLayout'

// --- Types ---
interface Signal {
  id: string
  signal_code: string
  address: string | null
  status: 'BUENO' | 'REGULAR' | 'DETERIORADO' | 'CAIDO' | 'DESAPARECIDO'
  municipalities: { name: string } | null
  zones: { name: string; zone_type: string } | null
}

interface Inspection {
  id: string
  inspection_date: string | null
  status: 'BUENO' | 'REGULAR' | 'DETERIORADO' | 'CAIDO' | 'DESAPARECIDO'
  observations: string | null
  signals: {
    signal_code: string
    address: string | null
  } | null
  users: { full_name: string } | null
}

interface SignalsResponse {
  data: Signal[]
  total: number
}

interface InspectionsResponse {
  data: Inspection[]
  total: number
}

// --- Helpers ---
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

// --- Component ---
export default function DashboardPage() {
  const { user, isLoading } = useAuth()

  const [signals, setSignals] = useState<SignalsResponse | null>(null)
  const [inspections, setInspections] = useState<InspectionsResponse | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoadingData(true)
      setError(null)

      const [signalsData, inspectionsData] = await Promise.all([
        api.get<SignalsResponse>('/api/signals?limit=100'),
        api.get<InspectionsResponse>('/api/inspections?limit=5'),
      ])

      setSignals(signalsData)
      setInspections(inspectionsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos')
    } finally {
      setLoadingData(false)
    }
  }, [])

  useEffect(() => {
    if (!isLoading) fetchDashboardData()
  }, [isLoading, fetchDashboardData])

  // Compute stats from real data
  const statusCounts = signals?.data.reduce(
    (acc, s) => {
      acc[s.status] = (acc[s.status] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>
  ) ?? {}

  const total = signals?.total ?? 0
  const bueno = statusCounts['BUENO'] ?? 0
  const requierenAtencion =
    (statusCounts['DETERIORADO'] ?? 0) +
    (statusCounts['CAIDO'] ?? 0) +
    (statusCounts['DESAPARECIDO'] ?? 0)

  const stats = [
    {
      label: 'Señales registradas',
      value: total.toLocaleString('es-CO'),
      detail: 'Total en inventario',
    },
    {
      label: 'En buen estado',
      value: bueno.toLocaleString('es-CO'),
      detail: total > 0 ? `${Math.round((bueno / total) * 100)}% del inventario` : '—',
    },
    {
      label: 'Requieren atención',
      value: requierenAtencion.toLocaleString('es-CO'),
      detail: 'Deterioradas, caídas o desaparecidas',
    },
    {
      label: 'Inspecciones totales',
      value: (inspections?.total ?? 0).toLocaleString('es-CO'),
      detail: 'Registradas en el sistema',
    },
  ]

  const statusSummary = [
    { label: 'Bueno', count: statusCounts['BUENO'] ?? 0, color: 'bg-emerald-500' },
    { label: 'Regular', count: statusCounts['REGULAR'] ?? 0, color: 'bg-amber-500' },
    { label: 'Deteriorado', count: statusCounts['DETERIORADO'] ?? 0, color: 'bg-orange-500' },
    { label: 'Caído / Desaparecido', count: (statusCounts['CAIDO'] ?? 0) + (statusCounts['DESAPARECIDO'] ?? 0), color: 'bg-rose-500' },
  ]

  return (
    <DashboardLayout
      title="Gestión de señalización vial"
      subtitle="Panel administrativo"
      actions={
        <>
          <button
            onClick={fetchDashboardData}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-100"
          >
            Actualizar
          </button>
          {(user?.roles?.name === 'ADMIN' || user?.roles?.name === 'SUPERVISOR') && (
            <a
              href="/dashboard/signals/new"
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Nueva señal
            </a>
          )}
        </>
      }
    >
      {error && (
            <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error} —{' '}
              <button
                onClick={fetchDashboardData}
                className="underline hover:no-underline"
              >
                Reintentar
              </button>
            </div>
          )}

          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <article
                key={stat.label}
                className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
              >
                <p className="text-sm font-medium text-zinc-500">{stat.label}</p>
                {loadingData ? (
                  <div className="mt-3 h-8 w-20 animate-pulse rounded bg-zinc-100" />
                ) : (
                  <p className="mt-3 text-3xl font-bold text-zinc-950">{stat.value}</p>
                )}
                <p className="mt-2 text-sm text-zinc-600">{stat.detail}</p>
              </article>
            ))}
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px]">
            {/* Recent inspections */}
            <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-200 px-5 py-4">
                <h3 className="text-base font-semibold">Inspecciones recientes</h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Código</th>
                      <th className="px-5 py-3 font-semibold">Ubicación</th>
                      <th className="px-5 py-3 font-semibold">Estado</th>
                      <th className="px-5 py-3 font-semibold">Técnico</th>
                      <th className="px-5 py-3 font-semibold">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {loadingData ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <tr key={i}>
                          {Array.from({ length: 5 }).map((_, j) => (
                            <td key={j} className="px-5 py-4">
                              <div className="h-4 animate-pulse rounded bg-zinc-100" />
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : inspections?.data.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-8 text-center text-zinc-400">
                          No hay inspecciones registradas
                        </td>
                      </tr>
                    ) : (
                      inspections?.data.map((insp) => (
                        <tr key={insp.id}>
                          <td className="px-5 py-4 font-semibold text-zinc-950">
                            {insp.signals?.signal_code ?? '—'}
                          </td>
                          <td className="px-5 py-4 text-zinc-700">
                            {insp.signals?.address ?? '—'}
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`rounded-md px-2 py-1 text-xs font-semibold ${STATUS_COLORS[insp.status]}`}
                            >
                              {STATUS_LABELS[insp.status]}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-zinc-700">
                            {insp.users?.full_name ?? '—'}
                          </td>
                          <td className="px-5 py-4 text-zinc-500">
                            {insp.inspection_date
                              ? new Date(insp.inspection_date).toLocaleDateString('es-CO', {
                                  day: 'numeric',
                                  month: 'short',
                                })
                              : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Status summary */}
            <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold">Estado del inventario</h3>
              <div className="mt-5 space-y-4">
                {statusSummary.map((item) => {
                  const pct = total > 0 ? Math.round((item.count / total) * 100) : 0
                  return (
                    <div key={item.label}>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium text-zinc-700">{item.label}</span>
                        <span className="text-zinc-500">
                          {loadingData ? '—' : `${pct}% (${item.count})`}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-zinc-100">
                        <div
                          className={`h-2 rounded-full transition-all ${item.color}`}
                          style={{ width: loadingData ? '0%' : `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-6 rounded-lg bg-zinc-950 p-4 text-white">
                <p className="text-sm font-semibold text-emerald-300">
                  Bienvenido, {user?.full_name?.split(' ')[0]}
                </p>
                <p className="mt-2 text-sm text-zinc-200">
                  Sesión activa como{' '}
                  <span className="font-semibold">{user?.roles?.name ?? 'usuario'}</span>.
                  Los datos se cargan en tiempo real desde la base de datos.
                </p>
              </div>
            </section>
          </div>
    </DashboardLayout>
  )
}
