'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'

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

interface BulkImportRowError {
  row: number
  message: string
}

interface BulkImportResponse {
  inserted?: number
  message?: string
  errors?: BulkImportRowError[]
}

const TEMPLATE_CSV = `codigo,direccion,categoria,tipo_senal,municipio,zona,estado,descripcion,observaciones,fecha_instalacion,latitud,longitud
SE-0001,Calle 10 # 5-20,Preventivas,Curva peligrosa,Itagüí,Urbana,BUENO,,,2024-01-15,6.1719,-75.6062
`

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'plantilla_señales.csv'
  a.click()
  URL.revokeObjectURL(url)
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
  const { user } = useAuth()
  const canWrite = user?.roles?.name === 'ADMIN' || user?.roles?.name === 'SUPERVISOR'

  useEffect(() => {
    if (user && user.roles?.name === 'CONSULTA') router.replace('/dashboard')
  }, [user, router])

  const [signals, setSignals] = useState<Signal[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const LIMIT = 15

  const [showImport, setShowImport] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importErrors, setImportErrors] = useState<BulkImportRowError[]>([])
  const [importSuccess, setImportSuccess] = useState<string | null>(null)

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

  const [togglingId, setTogglingId] = useState<string | null>(null)

  const handleToggleActive = async (signal: Signal) => {
    setTogglingId(signal.id)
    try {
      await api.patch(`/api/signals/${signal.id}/toggle-active`, {})
      setSignals((prev) =>
        prev.map((s) => (s.id === signal.id ? { ...s, is_active: !s.is_active } : s))
      )
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error')
    } finally {
      setTogglingId(null)
    }
  }

  const closeImport = () => {
    setShowImport(false)
    setImportFile(null)
    setImportErrors([])
    setImportSuccess(null)
  }

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!importFile) return

    setImporting(true)
    setImportErrors([])
    setImportSuccess(null)

    try {
      const formData = new FormData()
      formData.append('file', importFile)
      const res = await api.postForm<BulkImportResponse>('/api/signals/bulk-import', formData)
      setImportSuccess(`Se importaron ${res.inserted ?? 0} señales correctamente.`)
      setImportFile(null)
      fetchSignals()
    } catch (err) {
      if (err instanceof ApiError) {
        const details = err.details as { errors?: BulkImportRowError[] }
        if (details.errors && details.errors.length > 0) {
          setImportErrors(details.errors)
        } else {
          setImportErrors([{ row: 0, message: err.message }])
        }
      } else if (err instanceof Error) {
        setImportErrors([{ row: 0, message: err.message }])
      }
    } finally {
      setImporting(false)
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
        canWrite ? (
          <div className="flex gap-2">
            <button
              onClick={() => setShowImport(true)}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Importar CSV/Excel
            </button>
            <a
              href="/dashboard/signals/new"
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              + Nueva señal
            </a>
          </div>
        ) : undefined
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
                {canWrite && <th className="px-5 py-3 font-semibold">Activa</th>}
                <th className="px-5 py-3 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: canWrite ? 7 : 6 }).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 animate-pulse rounded bg-zinc-100" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={canWrite ? 7 : 6} className="px-5 py-10 text-center text-zinc-400">
                    No hay señales registradas
                  </td>
                </tr>
              ) : (
                filtered.map((signal) => (
                  <tr key={signal.id} className={`hover:bg-zinc-50 ${!signal.is_active ? 'opacity-50' : ''}`}>
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
                    {canWrite && (
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={signal.is_active}
                          disabled={togglingId === signal.id}
                          onClick={() => handleToggleActive(signal)}
                          title={signal.is_active ? 'Desactivar señal' : 'Activar señal'}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
                            signal.is_active ? 'bg-emerald-600' : 'bg-zinc-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                              signal.is_active ? 'translate-x-4' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </td>
                    )}
                    <td className="px-5 py-4">
                      <div className="flex gap-3">
                        <button
                          onClick={() => router.push(`/dashboard/signals/${signal.id}`)}
                          className="text-emerald-600 hover:underline text-xs font-medium"
                        >
                          Ver
                        </button>
                        {canWrite && (
                          <button
                            onClick={() => router.push(`/dashboard/signals/${signal.id}/edit`)}
                            className="text-zinc-600 hover:underline text-xs font-medium"
                          >
                            Editar
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

      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-zinc-950">Importar señales</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Sube un archivo CSV o Excel (.xlsx). Si alguna fila tiene un error, no se
                  importa ninguna señal del archivo.
                </p>
              </div>
              <button onClick={closeImport} className="text-zinc-400 hover:text-zinc-600">
                ✕
              </button>
            </div>

            <button
              type="button"
              onClick={downloadTemplate}
              className="mb-4 text-sm font-medium text-emerald-600 hover:underline"
            >
              Descargar plantilla de ejemplo (.csv)
            </button>

            {importSuccess && (
              <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {importSuccess}
              </div>
            )}

            {importErrors.length > 0 && (
              <div className="mb-4 max-h-56 overflow-y-auto rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                <p className="mb-1 font-semibold">
                  No se importó nada. Corrige estas filas e inténtalo de nuevo:
                </p>
                <ul className="list-inside list-disc space-y-1">
                  {importErrors.map((e, i) => (
                    <li key={i}>
                      {e.row > 0 ? `Fila ${e.row}: ` : ''}
                      {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <form onSubmit={handleImportSubmit} className="flex flex-col gap-4">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                className="rounded-md border border-zinc-300 p-2 text-sm"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeImport}
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={!importFile || importing}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {importing ? 'Importando...' : 'Importar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
