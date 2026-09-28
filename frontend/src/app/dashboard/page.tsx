'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  PieChart, Pie, Cell, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconAlertCircle,
  IconClipboardCheck,
  IconCamera,
  IconRefresh,
  IconPlus,
  type Icon as TablerIcon,
} from '@tabler/icons-react'
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

interface CamerasResponse {
  total: number
}

type CameraStatus = 'EN_SERVICIO' | 'FUERA_DE_SERVICIO' | 'EN_MANTENIMIENTO' | 'DESCALIBRADA'

interface DashboardStats {
  signalsByStatus: Record<string, number>
  camerasByStatus: Record<CameraStatus, number>
  inspectionsByMonth: { month: string; count: number }[]
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

// Colores hex (recharts no soporta clases de Tailwind) alineados con STATUS_COLORS
const STATUS_HEX: Record<string, string> = {
  BUENO: '#10b981',
  REGULAR: '#f59e0b',
  DETERIORADO: '#f97316',
  CAIDO: '#f43f5e',
  DESAPARECIDO: '#a1a1aa',
}

// Mismos colores usados en la leyenda de cámaras del Mapa GIS (MapView.tsx) —
// para que un mismo estado se lea con el mismo color en todo el dashboard.
const CAMERA_STATUS_COLORS: Record<CameraStatus, string> = {
  EN_SERVICIO: 'bg-blue-600',
  FUERA_DE_SERVICIO: 'bg-rose-500',
  EN_MANTENIMIENTO: 'bg-amber-500',
  DESCALIBRADA: 'bg-violet-500',
}

const CAMERA_STATUS_LABELS: Record<CameraStatus, string> = {
  EN_SERVICIO: 'En servicio',
  FUERA_DE_SERVICIO: 'Fuera de servicio',
  EN_MANTENIMIENTO: 'En mantenimiento',
  DESCALIBRADA: 'Descalibrada',
}

// --- Component ---
export default function DashboardPage() {
  const { user, isLoading } = useAuth()

  const [signals, setSignals] = useState<SignalsResponse | null>(null)
  const [inspections, setInspections] = useState<InspectionsResponse | null>(null)
  const [cameras, setCameras] = useState<CamerasResponse | null>(null)
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoadingData(true)
      setError(null)

      const [signalsData, inspectionsData, camerasData, statsData] = await Promise.all([
        api.get<SignalsResponse>('/api/signals?limit=100'),
        api.get<InspectionsResponse>('/api/inspections?limit=5'),
        api.get<CamerasResponse>('/api/cameras?limit=1&is_active=true'),
        api.get<DashboardStats>('/api/dashboard/stats'),
      ])

      setSignals(signalsData)
      setInspections(inspectionsData)
      setCameras(camerasData)
      setDashboardStats(statsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos')
    } finally {
      setLoadingData(false)
    }
  }, [])

  useEffect(() => {
    if (!isLoading) fetchDashboardData()
  }, [isLoading, fetchDashboardData])

  // Conteos por estado: usamos /api/dashboard/stats (cubre todo el inventario,
  // no solo los primeros 100 registros que trae /api/signals para la tabla).
  const statusCounts = dashboardStats?.signalsByStatus ?? {}
  const cameraStatusCounts = dashboardStats?.camerasByStatus ?? ({} as Record<CameraStatus, number>)

  const total = signals?.total ?? 0
  const bueno = statusCounts['BUENO'] ?? 0
  const requierenAtencion =
    (statusCounts['DETERIORADO'] ?? 0) +
    (statusCounts['CAIDO'] ?? 0) +
    (statusCounts['DESAPARECIDO'] ?? 0)
  const camerasTotal = cameras?.total ?? 0

  const stats: {
    label: string
    value: string
    detail: string
    icon: TablerIcon
    iconClass: string
  }[] = [
    {
      label: 'Señales registradas',
      value: total.toLocaleString('es-CO'),
      detail: 'Total en inventario',
      icon: IconAlertTriangle,
      iconClass: 'bg-blue-100 text-blue-600',
    },
    {
      label: 'En buen estado',
      value: bueno.toLocaleString('es-CO'),
      detail: total > 0 ? `${Math.round((bueno / total) * 100)}% del inventario` : '—',
      icon: IconCircleCheck,
      iconClass: 'bg-emerald-100 text-emerald-600',
    },
    {
      label: 'Requieren atención',
      value: requierenAtencion.toLocaleString('es-CO'),
      detail: 'Deterioradas, caídas o desaparecidas',
      icon: IconAlertCircle,
      iconClass: 'bg-rose-100 text-rose-600',
    },
    {
      label: 'Inspecciones totales',
      value: (inspections?.total ?? 0).toLocaleString('es-CO'),
      detail: 'Registradas en el sistema',
      icon: IconClipboardCheck,
      iconClass: 'bg-sky-100 text-sky-600',
    },
    {
      label: 'Cámaras registradas',
      value: camerasTotal.toLocaleString('es-CO'),
      detail: 'Fotodetección activa',
      icon: IconCamera,
      iconClass: 'bg-violet-100 text-violet-600',
    },
  ]

  const statusSummary = [
    { label: 'Bueno', count: statusCounts['BUENO'] ?? 0, color: 'bg-emerald-500' },
    { label: 'Regular', count: statusCounts['REGULAR'] ?? 0, color: 'bg-amber-500' },
    { label: 'Deteriorado', count: statusCounts['DETERIORADO'] ?? 0, color: 'bg-orange-500' },
    { label: 'Caído / Desaparecido', count: (statusCounts['CAIDO'] ?? 0) + (statusCounts['DESAPARECIDO'] ?? 0), color: 'bg-rose-500' },
  ]

  const cameraStatusList = (Object.keys(CAMERA_STATUS_LABELS) as CameraStatus[]).map((status) => ({
    label: CAMERA_STATUS_LABELS[status],
    count: cameraStatusCounts[status] ?? 0,
    color: CAMERA_STATUS_COLORS[status],
  }))

  const pieData = Object.entries(statusCounts)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({
      name: STATUS_LABELS[status] ?? status,
      value: count,
      color: STATUS_HEX[status] ?? '#a1a1aa',
    }))

  const inspectionsByMonth = dashboardStats?.inspectionsByMonth ?? []

  return (
    <DashboardLayout
      title="Gestión de señalización vial"
      subtitle="Panel administrativo"
      actions={
        <>
          <button
            onClick={fetchDashboardData}
            className="flex items-center gap-1.5 rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-100"
          >
            <IconRefresh size={16} className={loadingData ? 'animate-spin' : ''} />
            Actualizar
          </button>
          {(user?.roles?.name === 'ADMIN' || user?.roles?.name === 'SUPERVISOR') && (
            <a
              href="/dashboard/signals/new"
              className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <IconPlus size={16} />
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
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {stats.map((stat) => (
              <article
                key={stat.label}
                className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
              >
                <div className={`inline-flex rounded-lg p-2 ${stat.iconClass}`}>
                  <stat.icon size={20} />
                </div>
                <p className="mt-3 text-sm font-medium text-zinc-500">{stat.label}</p>
                {loadingData ? (
                  <div className="mt-2 h-8 w-20 animate-pulse rounded bg-zinc-100" />
                ) : (
                  <p className="mt-1 text-3xl font-bold text-zinc-950">{stat.value}</p>
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

              {loadingData ? (
                <div className="mt-5 h-48 animate-pulse rounded bg-zinc-100" />
              ) : pieData.length === 0 ? (
                <p className="mt-5 text-sm text-zinc-400">Sin datos de señales.</p>
              ) : (
                <div className="mt-3 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={2}
                      >
                        {pieData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={24} wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

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

              {/* Cámaras por estado */}
              <div className="mt-6 border-t border-zinc-100 pt-5">
                <div className="mb-4 flex items-center justify-between">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-zinc-800">
                    <IconCamera size={16} className="text-violet-600" />
                    Cámaras por estado
                  </h4>
                  <span className="text-sm text-zinc-500">
                    {loadingData ? '—' : camerasTotal.toLocaleString('es-CO')}
                  </span>
                </div>
                <div className="space-y-3">
                  {cameraStatusList.map((item) => {
                    const pct = camerasTotal > 0 ? Math.round((item.count / camerasTotal) * 100) : 0
                    return (
                      <div key={item.label}>
                        <div className="mb-1.5 flex items-center justify-between text-xs">
                          <span className="font-medium text-zinc-600">{item.label}</span>
                          <span className="text-zinc-400">
                            {loadingData ? '—' : `${pct}% (${item.count})`}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-zinc-100">
                          <div
                            className={`h-1.5 rounded-full transition-all ${item.color}`}
                            style={{ width: loadingData ? '0%' : `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </section>
          </div>

          {/* Inspecciones por mes */}
          <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold">Inspecciones por mes</h3>
            <p className="text-sm text-zinc-500">Últimos 6 meses</p>

            {loadingData ? (
              <div className="mt-4 h-64 animate-pulse rounded bg-zinc-100" />
            ) : (
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={inspectionsByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#a1a1aa" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#a1a1aa" />
                    <Tooltip />
                    <Bar dataKey="count" name="Inspecciones" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>
    </DashboardLayout>
  )
}
