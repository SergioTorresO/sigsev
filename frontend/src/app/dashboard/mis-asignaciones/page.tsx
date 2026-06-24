'use client'

import { useEffect, useState, useCallback } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'

interface Inspection {
  id: string
  status: 'BUENO' | 'REGULAR' | 'DETERIORADO' | 'CAIDO' | 'DESAPARECIDO'
  observations: string | null
  inspection_date: string
  signals: { id: string; signal_code: string; address: string | null } | null
}

interface Maintenance {
  id: string
  status: 'PENDIENTE' | 'EN_PROCESO' | 'COMPLETADO'
  description: string
  maintenance_date: string | null
  completed_at: string | null
  signals: { id: string; signal_code: string; address: string | null } | null
}

interface InspectionsResponse { data: Inspection[]; total: number }
interface MaintenancesResponse { data: Maintenance[]; total: number }

const INSPECTION_STATUS_COLORS: Record<string, string> = {
  BUENO: 'bg-emerald-100 text-emerald-700',
  REGULAR: 'bg-amber-100 text-amber-700',
  DETERIORADO: 'bg-orange-100 text-orange-700',
  CAIDO: 'bg-rose-100 text-rose-700',
  DESAPARECIDO: 'bg-zinc-200 text-zinc-600',
}

const INSPECTION_STATUS_LABELS: Record<string, string> = {
  BUENO: 'Bueno',
  REGULAR: 'Regular',
  DETERIORADO: 'Deteriorado',
  CAIDO: 'Caído',
  DESAPARECIDO: 'Desaparecido',
}

const MAINTENANCE_STATUS_COLORS: Record<string, string> = {
  PENDIENTE: 'bg-amber-100 text-amber-700',
  EN_PROCESO: 'bg-sky-100 text-sky-700',
  COMPLETADO: 'bg-emerald-100 text-emerald-700',
}

const MAINTENANCE_STATUS_LABELS: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso',
  COMPLETADO: 'Completado',
}

export default function MisAsignacionesPage() {
  const { user } = useAuth()

  const [inspections, setInspections] = useState<Inspection[]>([])
  const [maintenances, setMaintenances] = useState<Maintenance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)
      setError(null)
      const [inspRes, maintRes] = await Promise.all([
        api.get<InspectionsResponse>(`/api/inspections?technician_id=${user.id}&limit=50`),
        api.get<MaintenancesResponse>(`/api/maintenances?assigned_to=${user.id}&limit=50`),
      ])
      setInspections(inspRes.data)
      setMaintenances(maintRes.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar tus asignaciones')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <DashboardLayout title="Mis asignaciones" subtitle="Trabajo asignado a mí">
      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Inspecciones */}
      <div className="mb-6 rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-5 py-3">
          <h3 className="text-sm font-semibold text-zinc-800">
            Inspecciones {loading ? '' : `(${inspections.length})`}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Señal</th>
                <th className="px-5 py-3 font-semibold">Dirección</th>
                <th className="px-5 py-3 font-semibold">Estado</th>
                <th className="px-5 py-3 font-semibold">Fecha</th>
                <th className="px-5 py-3 font-semibold">Observaciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 animate-pulse rounded bg-zinc-100" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : inspections.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-zinc-400">
                    No tienes inspecciones asignadas
                  </td>
                </tr>
              ) : (
                inspections.map((insp) => (
                  <tr key={insp.id} className="hover:bg-zinc-50">
                    <td className="px-5 py-4 font-semibold text-zinc-950">
                      {insp.signals?.signal_code ?? '—'}
                    </td>
                    <td className="px-5 py-4 text-zinc-600 max-w-[200px] truncate">
                      {insp.signals?.address ?? '—'}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${INSPECTION_STATUS_COLORS[insp.status]}`}>
                        {INSPECTION_STATUS_LABELS[insp.status]}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-zinc-500">
                      {insp.inspection_date ? new Date(insp.inspection_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-4 text-zinc-500 max-w-[240px] truncate">
                      {insp.observations || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mantenimientos */}
      <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-5 py-3">
          <h3 className="text-sm font-semibold text-zinc-800">
            Mantenimientos {loading ? '' : `(${maintenances.length})`}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Señal</th>
                <th className="px-5 py-3 font-semibold">Descripción</th>
                <th className="px-5 py-3 font-semibold">Estado</th>
                <th className="px-5 py-3 font-semibold">Fecha programada</th>
                <th className="px-5 py-3 font-semibold">Completado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 animate-pulse rounded bg-zinc-100" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : maintenances.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-zinc-400">
                    No tienes mantenimientos asignados
                  </td>
                </tr>
              ) : (
                maintenances.map((maint) => (
                  <tr key={maint.id} className="hover:bg-zinc-50">
                    <td className="px-5 py-4 font-semibold text-zinc-950">
                      {maint.signals?.signal_code ?? '—'}
                    </td>
                    <td className="px-5 py-4 text-zinc-600 max-w-[240px] truncate">
                      {maint.description}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${MAINTENANCE_STATUS_COLORS[maint.status]}`}>
                        {MAINTENANCE_STATUS_LABELS[maint.status]}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-zinc-500">
                      {maint.maintenance_date ? new Date(maint.maintenance_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-4 text-zinc-500">
                      {maint.completed_at ? new Date(maint.completed_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  )
}
