'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'

interface Maintenance {
  id: string
  status: 'PENDIENTE' | 'EN_PROCESO' | 'COMPLETADO'
  description: string | null
  cost: number | null
  maintenance_date: string | null
  completed_at: string | null
  signals: { signal_code: string; address: string | null } | null
  users: { full_name: string } | null
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
  const { user } = useAuth()
  const router = useRouter()
  const toast = useToast()
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
  const [showForm, setShowForm] = useState(false)
  const LIMIT = 15

  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [signals, setSignals] = useState<{ id: string; signal_code: string }[]>([])
  const [technicians, setTechnicians] = useState<{ id: string; full_name: string }[]>([])
  const [form, setForm] = useState({ signal_id: '', description: '', cost: '', maintenance_date: '', assigned_to: '' })

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
    if (showForm && canAssign && technicians.length === 0) {
      api.get<{ data: { id: string; full_name: string }[] }>('/api/users?limit=200&is_active=true')
        .then((res) => setTechnicians(res.data))
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

  const handleStatusChange = async (id: string, newStatus: string) => {
    // Marcar como completado es irreversible desde la UI (el select desaparece
    // y ya no se puede volver a "Pendiente"/"En proceso"), así que se confirma antes.
    if (newStatus === 'COMPLETADO' && !window.confirm('¿Marcar este mantenimiento como completado? No podrás cambiar su estado después.')) {
      return
    }

    try {
      await api.put(`/api/maintenances/${id}`, { status: newStatus })
      fetchMaintenances()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar estado')
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
              <label className="mb-1 block text-sm font-medium text-zinc-700">Señal *</label>
              <select required value={form.signal_id} onChange={(e) => setForm((f) => ({ ...f, signal_id: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none">
                <option value="">Seleccionar señal…</option>
                {signals.map((s) => <option key={s.id} value={s.id}>{s.signal_code}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Fecha programada</label>
              <input type="date" value={form.maintenance_date} onChange={(e) => setForm((f) => ({ ...f, maintenance_date: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" />
            </div>
            {canAssign && (
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Asignar a *</label>
                <select required value={form.assigned_to} onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none">
                  <option value="">Seleccionar técnico…</option>
                  {technicians.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Costo estimado (COP)</label>
              <input type="number" min="0" step="1000" value={form.cost} onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" placeholder="Opcional" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-zinc-700">Descripción *</label>
              <textarea required rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
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
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
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
                <th className="px-5 py-3 font-semibold">Cambiar estado</th>
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
                      {canWrite && m.status !== 'COMPLETADO' && (
                        <select
                          value={m.status}
                          onChange={(e) => handleStatusChange(m.id, e.target.value)}
                          className="rounded-md border border-zinc-300 px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none"
                        >
                          <option value="PENDIENTE">Pendiente</option>
                          <option value="EN_PROCESO">En proceso</option>
                          <option value="COMPLETADO">Completado</option>
                        </select>
                      )}
                      {(!canWrite || m.status === 'COMPLETADO') && (
                        <span className="text-xs text-zinc-400">
                          {m.status === 'COMPLETADO'
                            ? (m.completed_at
                                ? new Date(m.completed_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
                                : 'Completado')
                            : STATUS_LABELS[m.status]}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-zinc-100 px-5 py-3">
            <span className="text-xs text-zinc-500">Página {page} de {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium disabled:opacity-40 hover:bg-zinc-50">Anterior</button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium disabled:opacity-40 hover:bg-zinc-50">Siguiente</button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
