'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import Modal from '@/components/Modal'
import Pagination from '@/components/Pagination'

interface Maintenance {
  id: string
  status: 'PENDIENTE' | 'EN_PROCESO' | 'COMPLETADO'
  description: string | null
  cost: number | null
  maintenance_date: string | null
  completed_at: string | null
  observations?: string | null
  signals: { signal_code: string; address: string | null } | null
  users: { full_name: string } | null
  evidences?: { id: string; image_url: string; description: string | null; created_at: string }[]
}

interface MaintenancesResponse {
  data: Maintenance[]
  total: number
}

const STATUS_COLORS: Record<string, string> = {
  PENDIENTE: 'bg-amber-100 text-amber-700',
  EN_PROCESO: 'bg-blue-100 text-blue-700',
  COMPLETADO: 'bg-emerald-100 text-emerald-700',
}

const STATUS_LABELS: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso',
  COMPLETADO: 'Completado',
}

export default function MaintenancesPage() {
  return (
    <Suspense fallback={null}>
      <MaintenancesPageInner />
    </Suspense>
  )
}

function MaintenancesPageInner() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const prefillSignalId = searchParams.get('signal_id') ?? ''
  const canAssign = user?.roles?.name === 'ADMIN' || user?.roles?.name === 'SUPERVISOR'
  const canWrite = user?.roles?.name === 'ADMIN' || user?.roles?.name === 'SUPERVISOR'

  // Solo ADMIN/SUPERVISOR tienen este módulo (CONSULTA y TECNICO ya no)
  useEffect(() => {
    if (user && user.roles?.name !== 'ADMIN' && user.roles?.name !== 'SUPERVISOR') router.replace('/dashboard')
  }, [user, router])

  const [maintenances, setMaintenances] = useState<Maintenance[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm] = useState(!!prefillSignalId)
  const LIMIT = 15

  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [signals, setSignals] = useState<{ id: string; signal_code: string }[]>([])
  const [technicians, setTechnicians] = useState<{ id: string; full_name: string }[]>([])
  const [form, setForm] = useState({ signal_id: prefillSignalId, description: '', cost: '', maintenance_date: '', assigned_to: '' })
  const [detailTarget, setDetailTarget] = useState<Maintenance | null>(null)

  const fetchMaintenances = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
      if (statusFilter) params.set('status', statusFilter)
      const res = await api.get<MaintenancesResponse>(`/api/maintenances?${params}`)
      setMaintenances(res.data)
      setTotal(res.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar mantenimientos')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  useEffect(() => { fetchMaintenances() }, [fetchMaintenances])

  useEffect(() => {
    if (showForm && signals.length === 0) {
      api.get<{ data: { id: string; signal_code: string }[] }>('/api/signals?limit=200&is_active=true')
        .then((res) => setSignals(res.data))
    }
  }, [showForm, signals.length])

  useEffect(() => {
    // Un mantenimiento es trabajo de campo: solo se le puede asignar a un TECNICO
    // (nunca a ADMIN/SUPERVISOR, que son quienes asignan).
    if (showForm && canAssign && technicians.length === 0) {
      api.get<{ data: { id: string; full_name: string; roles?: { name: string } | null }[] }>('/api/users?limit=200&is_active=true')
        .then((res) => setTechnicians(res.data.filter((u) => u.roles?.name === 'TECNICO')))
    }
  }, [showForm, canAssign, technicians.length])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    setFormLoading(true)
    try {
      await api.post('/api/maintenances', {
        ...form,
        cost: form.cost ? parseFloat(form.cost) : undefined,
        maintenance_date: form.maintenance_date || undefined,
        assigned_to: canAssign && form.assigned_to ? form.assigned_to : undefined,
      })
      setShowForm(false)
      setForm({ signal_id: '', description: '', cost: '', maintenance_date: '', assigned_to: '' })
      fetchMaintenances()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al crear mantenimiento')
    } finally {
      setFormLoading(false)
    }
  }

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <DashboardLayout
      title="Mantenimientos"
      subtitle="Inventario vial"
      actions={
        canWrite ? (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            {showForm ? 'Cancelar' : '+ Nuevo mantenimiento'}
          </button>
        ) : undefined
      }
    >
      {/* Inline form */}
      {showForm && (
        <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-zinc-950">Registrar mantenimiento</h3>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            {formError && (
              <div className="sm:col-span-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {formError}
              </div>
            )}
            <div>
              <label htmlFor="maintenance-signal" className="mb-1 block text-sm font-medium text-zinc-700">Señal *</label>
              <select id="maintenance-signal" required value={form.signal_id} onChange={(e) => setForm((f) => ({ ...f, signal_id: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none">
                <option value="">Seleccionar señal…</option>
                {signals.map((s) => <option key={s.id} value={s.id}>{s.signal_code}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="maintenance-date" className="mb-1 block text-sm font-medium text-zinc-700">Fecha programada</label>
              <input id="maintenance-date" type="date" value={form.maintenance_date} onChange={(e) => setForm((f) => ({ ...f, maintenance_date: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" />
            </div>
            {canAssign && (
              <div>
                <label htmlFor="maintenance-assigned-to" className="mb-1 block text-sm font-medium text-zinc-700">Asignar a *</label>
                <select id="maintenance-assigned-to" required value={form.assigned_to} onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none">
                  <option value="">Seleccionar técnico…</option>
                  {technicians.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label htmlFor="maintenance-cost" className="mb-1 block text-sm font-medium text-zinc-700">Costo estimado (COP)</label>
              <input id="maintenance-cost" type="number" min="0" step="1000" value={form.cost} onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" placeholder="Opcional" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="maintenance-description" className="mb-1 block text-sm font-medium text-zinc-700">Descripción *</label>
              <textarea id="maintenance-description" required rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" disabled={formLoading}
                className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                {formLoading ? 'Guardando…' : 'Crear mantenimiento'}
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
          <option value="PENDIENTE">Pendiente</option>
          <option value="EN_PROCESO">En proceso</option>
          <option value="COMPLETADO">Completado</option>
        </select>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-5 py-3">
          <span className="text-sm font-medium text-zinc-600">
            {loading ? 'Cargando…' : `${total} mantenimiento${total !== 1 ? 's' : ''}`}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[750px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Señal</th>
                <th className="px-5 py-3 font-semibold">Descripción</th>
                <th className="px-5 py-3 font-semibold">Estado</th>
                <th className="px-5 py-3 font-semibold">Asignado a</th>
                <th className="px-5 py-3 font-semibold">Fecha</th>
                <th className="px-5 py-3 font-semibold">Costo</th>
                <th className="px-5 py-3 font-semibold">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-5 py-4"><div className="h-4 animate-pulse rounded bg-zinc-100" /></td>
                  ))}</tr>
                ))
              ) : maintenances.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-zinc-400">No hay mantenimientos registrados</td></tr>
              ) : (
                maintenances.map((m) => (
                  <tr key={m.id} className="hover:bg-zinc-50">
                    <td className="px-5 py-4 font-semibold text-zinc-950">{m.signals?.signal_code ?? '—'}</td>
                    <td className="px-5 py-4 text-zinc-600 max-w-[180px] truncate">{m.description ?? '—'}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_COLORS[m.status]}`}>
                        {STATUS_LABELS[m.status]}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-zinc-600">{m.users?.full_name ?? '—'}</td>
                    <td className="px-5 py-4 text-zinc-500">
                      {m.maintenance_date
                        ? new Date(m.maintenance_date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                    <td className="px-5 py-4 text-zinc-600">
                      {m.cost ? `$${Number(m.cost).toLocaleString('es-CO')}` : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => setDetailTarget(m)}
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
        <MaintenanceDetailModal maintenance={detailTarget} onClose={() => setDetailTarget(null)} />
      )}
    </DashboardLayout>
  )
}

function MaintenanceDetailModal({ maintenance, onClose }: { maintenance: Maintenance; onClose: () => void }) {
  const photoUrl = maintenance.evidences?.[0]?.image_url ?? null

  return (
    <Modal
      isOpen
      onClose={onClose}
      titleId="maintenance-detail-title"
      title={
        <>
          Detalle del mantenimiento
          <span className="ml-2 block text-sm font-normal text-zinc-500 sm:inline">
            Señal {maintenance.signals?.signal_code ?? '—'} · {maintenance.users?.full_name ?? '—'}
          </span>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_COLORS[maintenance.status]}`}>
            {STATUS_LABELS[maintenance.status]}
          </span>
          {maintenance.completed_at && (
            <span className="ml-2 text-xs text-zinc-500">
              Completado el {new Date(maintenance.completed_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          )}
        </div>

        <div>
          <p className="mb-1 text-sm font-medium text-zinc-700">Descripción</p>
          <p className="whitespace-pre-wrap rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
            {maintenance.description || 'Sin descripción'}
          </p>
        </div>

        <div>
          <p className="mb-1 text-sm font-medium text-zinc-700">Observaciones del técnico</p>
          <p className="whitespace-pre-wrap rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
            {maintenance.observations || 'Sin observaciones'}
          </p>
        </div>

        <div>
          <p className="mb-1 text-sm font-medium text-zinc-700">Foto de evidencia</p>
          {photoUrl ? (
            <a href={photoUrl} target="_blank" rel="noopener noreferrer">
              <img src={photoUrl} alt="Evidencia del mantenimiento" className="max-h-80 w-full rounded-md border border-zinc-200 object-contain" />
            </a>
          ) : (
            <p className="text-sm text-zinc-400">No hay foto registrada</p>
          )}
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <button onClick={onClose} className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
          Cerrar
        </button>
      </div>
    </Modal>
  )
}
