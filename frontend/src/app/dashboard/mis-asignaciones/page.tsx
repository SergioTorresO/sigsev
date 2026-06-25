'use client'

import { useEffect, useState, useCallback } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import Modal from '@/components/Modal'

type SignalStatus = 'BUENO' | 'REGULAR' | 'DETERIORADO' | 'CAIDO' | 'DESAPARECIDO'
type MaintenanceStatus = 'PENDIENTE' | 'EN_PROCESO' | 'COMPLETADO'

interface Inspection {
  id: string
  status: SignalStatus
  observations: string | null
  inspection_date: string
  needs_maintenance?: boolean
  completed_at: string | null
  signals: { id: string; signal_code: string; address: string | null } | null
}

interface Maintenance {
  id: string
  status: MaintenanceStatus
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

type CompleteTarget =
  | { kind: 'inspection'; item: Inspection }
  | { kind: 'maintenance'; item: Maintenance }

export default function MisAsignacionesPage() {
  const { user } = useAuth()
  const toast = useToast()

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

  const [target, setTarget] = useState<CompleteTarget | null>(null)

  const isInspectionDone = (insp: Inspection) => insp.completed_at != null
  const isMaintenanceDone = (maint: Maintenance) => maint.status === 'COMPLETADO'

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
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Señal</th>
                <th className="px-5 py-3 font-semibold">Dirección</th>
                <th className="px-5 py-3 font-semibold">Estado</th>
                <th className="px-5 py-3 font-semibold">Fecha</th>
                <th className="px-5 py-3 font-semibold">Observaciones</th>
                <th className="px-5 py-3 font-semibold">Tarea realizada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 animate-pulse rounded bg-zinc-100" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : inspections.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-zinc-400">
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
                      {insp.inspection_date ? new Date(insp.inspection_date).toLocaleDateString('es-CO') : '—'}
                    </td>
                    <td className="px-5 py-4 text-zinc-500 max-w-[240px] truncate">
                      {insp.observations || '—'}
                    </td>
                    <td className="px-5 py-4">
                      <label className="flex items-center gap-2 text-xs font-medium text-zinc-600">
                        <input
                          type="checkbox"
                          checked={isInspectionDone(insp)}
                          disabled={isInspectionDone(insp)}
                          onChange={() => setTarget({ kind: 'inspection', item: insp })}
                          className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-60"
                        />
                        {isInspectionDone(insp) ? 'Realizada' : 'Marcar'}
                      </label>
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
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Señal</th>
                <th className="px-5 py-3 font-semibold">Descripción</th>
                <th className="px-5 py-3 font-semibold">Estado</th>
                <th className="px-5 py-3 font-semibold">Fecha programada</th>
                <th className="px-5 py-3 font-semibold">Completado</th>
                <th className="px-5 py-3 font-semibold">Tarea realizada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 animate-pulse rounded bg-zinc-100" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : maintenances.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-zinc-400">
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
                      {maint.maintenance_date ? new Date(maint.maintenance_date).toLocaleDateString('es-CO') : '—'}
                    </td>
                    <td className="px-5 py-4 text-zinc-500">
                      {maint.completed_at ? new Date(maint.completed_at).toLocaleDateString('es-CO') : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <label className="flex items-center gap-2 text-xs font-medium text-zinc-600">
                        <input
                          type="checkbox"
                          checked={isMaintenanceDone(maint)}
                          disabled={isMaintenanceDone(maint)}
                          onChange={() => setTarget({ kind: 'maintenance', item: maint })}
                          className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-60"
                        />
                        {isMaintenanceDone(maint) ? 'Realizada' : 'Marcar'}
                      </label>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {target && (
        <CompleteTaskModal
          target={target}
          onClose={() => setTarget(null)}
          onSuccess={() => {
            setTarget(null)
            toast.success('Tarea marcada como realizada')
            fetchData()
          }}
        />
      )}
    </DashboardLayout>
  )
}

function CompleteTaskModal({
  target,
  onClose,
  onSuccess,
}: {
  target: CompleteTarget
  onClose: () => void
  onSuccess: () => void
}) {
  const toast = useToast()
  const isInspection = target.kind === 'inspection'
  const signalCode = target.item.signals?.signal_code ?? '—'

  const [status, setStatus] = useState<string>(isInspection ? 'BUENO' : 'COMPLETADO')
  const [signalStatus, setSignalStatus] = useState<string>('BUENO')
  const [observations, setObservations] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [needsMaintenance, setNeedsMaintenance] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!observations.trim()) {
      setFormError('Las observaciones son obligatorias')
      return
    }
    if (!photo) {
      setFormError('Debes adjuntar una foto como evidencia')
      return
    }

    setSubmitting(true)
    setFormError(null)

    try {
      const formData = new FormData()
      formData.append('status', status)
      formData.append('observations', observations.trim())
      formData.append('photo', photo)

      if (isInspection) {
        formData.append('needs_maintenance', String(needsMaintenance))
        await api.postForm(`/api/inspections/${target.item.id}/complete`, formData)
      } else {
        if (status === 'COMPLETADO') {
          formData.append('signal_status', signalStatus)
        }
        await api.postForm(`/api/maintenances/${target.item.id}/complete`, formData)
      }

      onSuccess()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Error al completar la tarea'
      setFormError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      titleId="complete-task-title"
      title={
        <>
          Completar {isInspection ? 'inspección' : 'mantenimiento'}
          <span className="ml-2 block text-sm font-normal text-zinc-500 sm:inline">Señal {signalCode}</span>
        </>
      }
    >
        {formError && (
          <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="complete-status" className="mb-1 block text-sm font-medium text-zinc-700">
              {isInspection ? 'Estado de la señal' : 'Estado del mantenimiento'}
            </label>
            <select
              id="complete-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            >
              {isInspection ? (
                <>
                  <option value="BUENO">Bueno</option>
                  <option value="REGULAR">Regular</option>
                  <option value="DETERIORADO">Deteriorado</option>
                  <option value="CAIDO">Caído</option>
                  <option value="DESAPARECIDO">Desaparecido</option>
                </>
              ) : (
                <>
                  <option value="EN_PROCESO">En proceso</option>
                  <option value="COMPLETADO">Completado</option>
                </>
              )}
            </select>
          </div>

          {isInspection && (
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
                <input
                  type="checkbox"
                  checked={needsMaintenance}
                  onChange={(e) => setNeedsMaintenance(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                />
                La señal necesita mantenimiento
              </label>
              <p className="mt-1 text-xs text-zinc-500">
                Si la marcas, se notificará al supervisor/administrador para que asigne un mantenimiento.
              </p>
            </div>
          )}

          {!isInspection && status === 'COMPLETADO' && (
            <div>
              <label htmlFor="complete-signal-status" className="mb-1 block text-sm font-medium text-zinc-700">
                Estado de la señal tras el mantenimiento
              </label>
              <select
                id="complete-signal-status"
                value={signalStatus}
                onChange={(e) => setSignalStatus(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              >
                <option value="BUENO">Bueno</option>
                <option value="REGULAR">Regular</option>
                <option value="DETERIORADO">Deteriorado</option>
                <option value="CAIDO">Caído</option>
                <option value="DESAPARECIDO">Desaparecido</option>
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Observaciones</label>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={3}
              required
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              placeholder="Describe lo realizado…"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Foto de evidencia</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              className="w-full rounded-md border border-zinc-300 p-2 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {submitting ? 'Guardando...' : 'Marcar como realizada'}
            </button>
          </div>
        </form>
    </Modal>
  )
}
