'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import Modal from '@/components/Modal'
import Pagination from '@/components/Pagination'

interface Inspection {
  id: string
  signal_id: string
  status: 'BUENO' | 'REGULAR' | 'DETERIORADO' | 'CAIDO' | 'DESAPARECIDO'
  observations: string | null
  evidence_image?: string | null
  inspection_date: string | null
  needs_maintenance?: boolean
  signals: { signal_code: string; address: string | null } | null
  users: { full_name: string } | null
  evidences?: { id: string; image_url: string; description: string | null; created_at: string }[]
}

interface InspectionsResponse {
  data: Inspection[]
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
  BUENO: 'Bueno', REGULAR: 'Regular', DETERIORADO: 'Deteriorado',
  CAIDO: 'Caído', DESAPARECIDO: 'Desaparecido',
}

export default function InspectionsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const canAssign = user?.roles?.name === 'ADMIN' || user?.roles?.name === 'SUPERVISOR'
  const canWrite = user?.roles?.name === 'ADMIN' || user?.roles?.name === 'SUPERVISOR'

  // Solo ADMIN/SUPERVISOR tienen este módulo (CONSULTA y TECNICO ya no)
  useEffect(() => {
    if (user && user.roles?.name !== 'ADMIN' && user.roles?.name !== 'SUPERVISOR') router.replace('/dashboard')
  }, [user, router])

  const [inspections, setInspections] = useState<Inspection[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const LIMIT = 15

  // New inspection form state
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [signals, setSignals] = useState<{ id: string; signal_code: string }[]>([])
  const [technicians, setTechnicians] = useState<{ id: string; full_name: string }[]>([])
  const [form, setForm] = useState({ signal_id: '', status: 'BUENO', observations: '', latitude: '', longitude: '', technician_id: '' })
  const [detailTarget, setDetailTarget] = useState<Inspection | null>(null)

  const fetchInspections = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
      if (statusFilter) params.set('status', statusFilter)
      const res = await api.get<InspectionsResponse>(`/api/inspections?${params}`)
      setInspections(res.data)
      setTotal(res.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar inspecciones')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  useEffect(() => { fetchInspections() }, [fetchInspections])

  useEffect(() => {
    if (showForm && signals.length === 0) {
      api.get<{ data: { id: string; signal_code: string }[] }>('/api/signals?limit=200&is_active=true')
        .then((res) => setSignals(res.data))
    }
  }, [showForm, signals.length])

  useEffect(() => {
    // Una inspección la puede ejecutar un SUPERVISOR o un TECNICO, pero nunca el ADMIN.
    if (showForm && canAssign && technicians.length === 0) {
      api.get<{ data: { id: string; full_name: string; roles?: { name: string } | null }[] }>('/api/users?limit=200&is_active=true')
        .then((res) => setTechnicians(res.data.filter((u) => u.roles?.name === 'SUPERVISOR' || u.roles?.name === 'TECNICO')))
    }
  }, [showForm, canAssign, technicians.length])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    setFormLoading(true)
    try {
      await api.post('/api/inspections', {
        ...form,
        latitude: form.latitude ? parseFloat(form.latitude) : undefined,
        longitude: form.longitude ? parseFloat(form.longitude) : undefined,
        technician_id: canAssign && form.technician_id ? form.technician_id : undefined,
      })
      setShowForm(false)
      setForm({ signal_id: '', status: 'BUENO', observations: '', latitude: '', longitude: '', technician_id: '' })
      fetchInspections()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al crear inspección')
    } finally {
      setFormLoading(false)
    }
  }

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <DashboardLayout
      title="Inspecciones"
      subtitle="Inventario vial"
      actions={
        canWrite ? (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            {showForm ? 'Cancelar' : '+ Nueva inspección'}
          </button>
        ) : undefined
      }
    >
      {/* Inline form */}
      {showForm && (
        <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-zinc-950">Registrar inspección</h3>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            {formError && (
              <div className="sm:col-span-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {formError}
              </div>
            )}
            <div>
              <label htmlFor="inspection-signal" className="mb-1 block text-sm font-medium text-zinc-700">Señal *</label>
              <select id="inspection-signal" required value={form.signal_id} onChange={(e) => setForm((f) => ({ ...f, signal_id: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none">
                <option value="">Seleccionar señal…</option>
                {signals.map((s) => <option key={s.id} value={s.id}>{s.signal_code}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="inspection-status" className="mb-1 block text-sm font-medium text-zinc-700">Estado observado *</label>
              <select id="inspection-status" required value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none">
                <option value="BUENO">Bueno</option>
                <option value="REGULAR">Regular</option>
                <option value="DETERIORADO">Deteriorado</option>
                <option value="CAIDO">Caído</option>
                <option value="DESAPARECIDO">Desaparecido</option>
              </select>
            </div>
            {canAssign && (
              <div>
                <label htmlFor="inspection-technician" className="mb-1 block text-sm font-medium text-zinc-700">Asignar a *</label>
                <select id="inspection-technician" required value={form.technician_id} onChange={(e) => setForm((f) => ({ ...f, technician_id: e.target.value }))}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none">
                  <option value="">Seleccionar técnico…</option>
                  {technicians.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label htmlFor="inspection-latitude" className="mb-1 block text-sm font-medium text-zinc-700">Latitud GPS</label>
              <input id="inspection-latitude" type="number" step="any" value={form.latitude} onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" placeholder="Opcional" />
            </div>
            <div>
              <label htmlFor="inspection-longitude" className="mb-1 block text-sm font-medium text-zinc-700">Longitud GPS</label>
              <input id="inspection-longitude" type="number" step="any" value={form.longitude} onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" placeholder="Opcional" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="inspection-observations" className="mb-1 block text-sm font-medium text-zinc-700">Observaciones</label>
              <textarea id="inspection-observations" rows={2} value={form.observations} onChange={(e) => setForm((f) => ({ ...f, observations: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" />
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" disabled={formLoading}
                className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                {formLoading ? 'Guardando…' : 'Registrar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex gap-3">
        <select aria-label="Filtrar por estado" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none sm:w-auto">
          <option value="">Todos los estados</option>
          <option value="BUENO">Bueno</option>
          <option value="REGULAR">Regular</option>
          <option value="DETERIORADO">Deteriorado</option>
          <option value="CAIDO">Caído</option>
          <option value="DESAPARECIDO">Desaparecido</option>
        </select>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-5 py-3">
          <span className="text-sm font-medium text-zinc-600">
            {loading ? 'Cargando…' : `${total} inspección${total !== 1 ? 'es' : ''}`}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Señal</th>
                <th className="px-5 py-3 font-semibold">Dirección</th>
                <th className="px-5 py-3 font-semibold">Estado</th>
                <th className="px-5 py-3 font-semibold">Técnico</th>
                <th className="px-5 py-3 font-semibold">Fecha</th>
                <th className="px-5 py-3 font-semibold">Observaciones</th>
                <th className="px-5 py-3 font-semibold">Mantenimiento</th>
                <th className="px-5 py-3 font-semibold">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-5 py-4"><div className="h-4 animate-pulse rounded bg-zinc-100" /></td>
                  ))}</tr>
                ))
              ) : inspections.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-zinc-400">No hay inspecciones registradas</td></tr>
              ) : (
                inspections.map((insp) => (
                  <tr key={insp.id} className="hover:bg-zinc-50">
                    <td className="px-5 py-4 font-semibold text-zinc-950">{insp.signals?.signal_code ?? '—'}</td>
                    <td className="px-5 py-4 text-zinc-600 max-w-[180px] truncate">{insp.signals?.address ?? '—'}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_COLORS[insp.status]}`}>
                        {STATUS_LABELS[insp.status]}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-zinc-600">{insp.users?.full_name ?? '—'}</td>
                    <td className="px-5 py-4 text-zinc-500">
                      {insp.inspection_date
                        ? new Date(insp.inspection_date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                    <td className="px-5 py-4 text-zinc-600 max-w-[200px] truncate">{insp.observations ?? '—'}</td>
                    <td className="px-5 py-4">
                      {insp.needs_maintenance ? (
                        <button
                          onClick={() => router.push(`/dashboard/maintenances?signal_id=${insp.signal_id}`)}
                          className="rounded-full bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-200"
                          title="El técnico reportó que esta señal necesita mantenimiento"
                        >
                          Necesita · Asignar
                        </button>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => setDetailTarget(insp)}
                        className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      {detailTarget && (
        <InspectionDetailModal inspection={detailTarget} onClose={() => setDetailTarget(null)} />
      )}
    </DashboardLayout>
  )
}

function InspectionDetailModal({ inspection, onClose }: { inspection: Inspection; onClose: () => void }) {
  // La foto puede venir como evidence_image directo en la inspección o, si hay
  // varias evidencias asociadas, en el arreglo evidences (mismo patrón que mantenimientos).
  const photoUrl = inspection.evidence_image ?? inspection.evidences?.[0]?.image_url ?? null

  return (
    <Modal
      isOpen
      onClose={onClose}
      titleId="inspection-detail-title"
      title={
        <>
          Detalle de la inspección
          <span className="ml-2 block text-sm font-normal text-zinc-500 sm:inline">
            Señal {inspection.signals?.signal_code ?? '—'} · {inspection.users?.full_name ?? '—'}
          </span>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_COLORS[inspection.status]}`}>
            {STATUS_LABELS[inspection.status]}
          </span>
          {inspection.inspection_date && (
            <span className="ml-2 text-xs text-zinc-500">
              {new Date(inspection.inspection_date).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          )}
        </div>

        <div>
          <p className="mb-1 text-sm font-medium text-zinc-700">Observaciones del técnico</p>
          <p className="whitespace-pre-wrap rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
            {inspection.observations || 'Sin observaciones'}
          </p>
        </div>

        <div>
          <p className="mb-1 text-sm font-medium text-zinc-700">Foto de evidencia</p>
          {photoUrl ? (
            <a href={photoUrl} target="_blank" rel="noopener noreferrer">
              <img
                src={photoUrl}
                alt="Evidencia de la inspección"
                className="max-h-80 w-full rounded-md border border-zinc-200 object-contain"
              />
            </a>
          ) : (
            <p className="text-sm text-zinc-400">No hay foto registrada</p>
          )}
        </div>

        {inspection.needs_maintenance && (
          <p className="rounded-md bg-sky-50 px-3 py-2 text-xs font-medium text-sky-700">
            El técnico reportó que esta señal necesita mantenimiento.
          </p>
        )}
      </div>

      <div className="mt-5 flex justify-end">
        <button
          onClick={onClose}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Cerrar
        </button>
      </div>
    </Modal>
  )
}
