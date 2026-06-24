'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'

type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'TOGGLE_ACTIVE' | 'BULK_IMPORT'

interface AuditLog {
  id: string
  action: AuditAction
  table_name: string
  record_id: string | null
  old_data: unknown
  new_data: unknown
  created_at: string
  users: { id: string; full_name: string; email: string } | null
}

interface AuditResponse { data: AuditLog[]; total: number; page: number; limit: number }

const LIMIT = 20

const ACTION_LABELS: Record<AuditAction, string> = {
  CREATE: 'Creación',
  UPDATE: 'Edición',
  DELETE: 'Eliminación',
  TOGGLE_ACTIVE: 'Cambio de estado',
  BULK_IMPORT: 'Carga masiva',
}

const ACTION_COLORS: Record<AuditAction, string> = {
  CREATE: 'bg-emerald-100 text-emerald-700',
  UPDATE: 'bg-amber-100 text-amber-700',
  DELETE: 'bg-rose-100 text-rose-700',
  TOGGLE_ACTIVE: 'bg-sky-100 text-sky-700',
  BULK_IMPORT: 'bg-violet-100 text-violet-700',
}

const TABLE_LABELS: Record<string, string> = {
  signals: 'Señales',
  inspections: 'Inspecciones',
  maintenances: 'Mantenimientos',
  users: 'Usuarios',
  zones: 'Zonas',
}

export default function AdminAuditPage() {
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user && user.roles?.name !== 'ADMIN') router.replace('/dashboard')
  }, [user, router])

  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [tableFilter, setTableFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<AuditLog | null>(null)

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
      if (tableFilter) params.set('table_name', tableFilter)
      if (actionFilter) params.set('action', actionFilter)
      const res = await api.get<AuditResponse>(`/api/audit-logs?${params}`)
      setLogs(res.data)
      setTotal(res.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el registro de auditoría')
    } finally {
      setLoading(false)
    }
  }, [page, tableFilter, actionFilter])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <DashboardLayout title="Auditoría" subtitle="Administración">
      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={tableFilter}
          onChange={(e) => { setTableFilter(e.target.value); setPage(1) }}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none sm:w-auto"
        >
          <option value="">Todas las tablas</option>
          <option value="signals">Señales</option>
          <option value="inspections">Inspecciones</option>
          <option value="maintenances">Mantenimientos</option>
          <option value="users">Usuarios</option>
          <option value="zones">Zonas</option>
        </select>
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1) }}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none sm:w-auto"
        >
          <option value="">Todas las acciones</option>
          {Object.entries(ACTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-5 py-3">
          <span className="text-sm font-medium text-zinc-600">
            {loading ? 'Cargando…' : `${total} registro${total !== 1 ? 's' : ''}`}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Fecha</th>
                <th className="px-5 py-3 font-semibold">Usuario</th>
                <th className="px-5 py-3 font-semibold">Acción</th>
                <th className="px-5 py-3 font-semibold">Tabla</th>
                <th className="px-5 py-3 font-semibold">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-5 py-4"><div className="h-4 animate-pulse rounded bg-zinc-100" /></td>
                  ))}</tr>
                ))
              ) : logs.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-zinc-400">No hay registros</td></tr>
              ) : logs.map((log) => (
                <tr key={log.id} className="hover:bg-zinc-50">
                  <td className="px-5 py-4 text-zinc-600">
                    {new Date(log.created_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="px-5 py-4 text-zinc-700">{log.users?.full_name ?? 'Sistema'}</td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${ACTION_COLORS[log.action]}`}>
                      {ACTION_LABELS[log.action]}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-zinc-600">{TABLE_LABELS[log.table_name] ?? log.table_name}</td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => setSelected(log)}
                      className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                    >
                      Ver detalle
                    </button>
                  </td>
                </tr>
              ))}
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

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-zinc-200 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-zinc-950">
                Detalle — {ACTION_LABELS[selected.action]} en {TABLE_LABELS[selected.table_name] ?? selected.table_name}
              </h3>
              <button onClick={() => setSelected(null)} className="text-zinc-400 hover:text-zinc-700">✕</button>
            </div>
            <p className="mb-4 text-sm text-zinc-500">
              {selected.users?.full_name ?? 'Sistema'} · {new Date(selected.created_at).toLocaleString('es-CO')}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-zinc-500">Antes</p>
                <pre className="max-h-72 overflow-auto rounded-md bg-zinc-50 p-3 text-xs text-zinc-700">
                  {selected.old_data ? JSON.stringify(selected.old_data, null, 2) : '—'}
                </pre>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-zinc-500">Después</p>
                <pre className="max-h-72 overflow-auto rounded-md bg-zinc-50 p-3 text-xs text-zinc-700">
                  {selected.new_data ? JSON.stringify(selected.new_data, null, 2) : '—'}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
