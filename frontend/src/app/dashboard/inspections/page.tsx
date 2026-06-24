'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'

interface Inspection {
  id: string
  status: 'BUENO' | 'REGULAR' | 'DETERIORADO' | 'CAIDO' | 'DESAPARECIDO'
  observations: string | null
  inspection_date: string | null
  signals: { signal_code: string; address: string | null } | null
  users: { full_name: string } | null
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
              <label className="mb-1 block text-sm font-medium text-zinc-700">Señal *</label>
              <select required value={form.signal_id} onChange={(e) => setForm((f) => ({ ...f, signal_id: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none">
                <option value="">Seleccionar señal…</option>
                {signals.map((s) => <option key={s.id} value={s.id}>{s.signal_code}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Estado observado *</label>
              <select required value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
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
                <label className="mb-1 block text-sm font-medium text-zinc-700">Asignar a *</label>
                <select required value={form.technician_id} onChange={(e) => setForm((f) => ({ ...f, technician_id: e.target.value }))}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none">
                  <option value="">Seleccionar técnico…</option>
                  {technicians.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Latitud GPS</label>
              <input type="number" step="any" value={form.latitude} onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" placeholder="Opcional" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Longitud GPS</label>
              <input type="number" step="any" value={form.longitude} onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" placeholder="Opcional" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-zinc-700">Observaciones</label>
              <textarea rows={2} value={form.observations} onChange={(e) => setForm((f) => ({ ...f, observations: e.target.value }))}
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
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
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
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-5 py-4"><div className="h-4 animate-pulse rounded bg-zinc-100" /></td>
                  ))}</tr>
                ))
              ) : inspections.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-zinc-400">No hay inspecciones registradas</td></tr>
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
