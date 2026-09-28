'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import Modal from '@/components/Modal'
import Pagination from '@/components/Pagination'

type CameraType = 'FIJA' | 'MOVIL'
type CameraStatus = 'EN_SERVICIO' | 'FUERA_DE_SERVICIO' | 'EN_MANTENIMIENTO' | 'DESCALIBRADA'

interface Camera {
  id: string
  camera_code: string
  camera_type: CameraType
  status: CameraStatus
  speed_limit_kmh: number | null
  is_active: boolean
  municipalities: { name: string } | null
  zones: { name: string } | null
}

interface CamerasResponse {
  data: Camera[]
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

const TEMPLATE_CSV = `codigo,tipo,estado,serie,marca,modelo,municipio,zona,direccion,limite_velocidad,sentido,radar,operador,fecha_instalacion,fecha_calibracion,latitud,longitud
CAM-0001,FIJA,EN_SERVICIO,SN-12345,Kria,K-500,Itagüí,Urbana,Calle 10 # 5-20,60,Norte-Sur,RAD-01,Concesión Vial,2024-01-15,2024-06-01,6.1719,-75.6062
`

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'plantilla_camaras.csv'
  a.click()
  URL.revokeObjectURL(url)
}

const STATUS_COLORS: Record<CameraStatus, string> = {
  EN_SERVICIO: 'bg-emerald-100 text-emerald-700',
  FUERA_DE_SERVICIO: 'bg-rose-100 text-rose-700',
  EN_MANTENIMIENTO: 'bg-amber-100 text-amber-700',
  DESCALIBRADA: 'bg-orange-100 text-orange-700',
}

const STATUS_LABELS: Record<CameraStatus, string> = {
  EN_SERVICIO: 'En servicio',
  FUERA_DE_SERVICIO: 'Fuera de servicio',
  EN_MANTENIMIENTO: 'En mantenimiento',
  DESCALIBRADA: 'Descalibrada',
}

const TYPE_LABELS: Record<CameraType, string> = {
  FIJA: 'Fija',
  MOVIL: 'Móvil',
}

export default function CamerasPage() {
  const router = useRouter()
  const { user } = useAuth()
  const toast = useToast()
  // Igual matriz de permisos que Zonas: CRUD completo exclusivo ADMIN/SUPERVISOR, sin nivel TECNICO.
  const canWrite = user?.roles?.name === 'ADMIN' || user?.roles?.name === 'SUPERVISOR'

  useEffect(() => {
    if (user && !canWrite) router.replace('/dashboard')
  }, [user, canWrite, router])

  const [cameras, setCameras] = useState<Camera[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [search, setSearch] = useState('')
  const LIMIT = 15

  const [showImport, setShowImport] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importErrors, setImportErrors] = useState<BulkImportRowError[]>([])
  const [importSuccess, setImportSuccess] = useState<string | null>(null)

  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => { setPage(1) }, [debouncedSearch, statusFilter, typeFilter])

  const fetchCameras = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
      })
      if (statusFilter) params.set('status', statusFilter)
      if (typeFilter) params.set('camera_type', typeFilter)
      if (debouncedSearch) params.set('search', debouncedSearch)

      const res = await api.get<CamerasResponse>(`/api/cameras?${params}`)
      setCameras(res.data)
      setTotal(res.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar cámaras')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, typeFilter, debouncedSearch])

  useEffect(() => { fetchCameras() }, [fetchCameras])

  const [togglingId, setTogglingId] = useState<string | null>(null)

  const handleToggleActive = async (camera: Camera) => {
    if (camera.is_active && !window.confirm(`¿Desactivar la cámara "${camera.camera_code}"? Dejará de aparecer en el mapa y en las vistas operativas.`)) {
      return
    }

    setTogglingId(camera.id)
    try {
      await api.patch(`/api/cameras/${camera.id}/toggle-active`, {})
      setCameras((prev) =>
        prev.map((c) => (c.id === camera.id ? { ...c, is_active: !c.is_active } : c))
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
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
      const res = await api.postForm<BulkImportResponse>('/api/cameras/bulk-import', formData)
      setImportSuccess(`Se importaron ${res.inserted ?? 0} cámaras correctamente.`)
      setImportFile(null)
      fetchCameras()
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

  const totalPages = Math.ceil(total / LIMIT)

  if (!canWrite) return null

  return (
    <DashboardLayout
      title="Cámaras"
      subtitle="Fotodetección"
      actions={
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 sm:px-4"
          >
            Importar CSV/Excel
          </button>
          <a
            href="/dashboard/cameras/new"
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 sm:px-4"
          >
            + Nueva cámara
          </a>
        </div>
      }
    >
      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          aria-label="Buscar por código, serie o dirección"
          placeholder="Buscar por código, serie o dirección…"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:w-72"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Filtrar por tipo"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-500 sm:w-auto"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">Todos los tipos</option>
          <option value="FIJA">Fija</option>
          <option value="MOVIL">Móvil</option>
        </select>
        <select
          aria-label="Filtrar por estado"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-500 sm:w-auto"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="EN_SERVICIO">En servicio</option>
          <option value="FUERA_DE_SERVICIO">Fuera de servicio</option>
          <option value="EN_MANTENIMIENTO">En mantenimiento</option>
          <option value="DESCALIBRADA">Descalibrada</option>
        </select>
        <button
          onClick={() => fetchCameras()}
          className="w-full rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 sm:w-auto"
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
            {loading ? 'Cargando…' : `${total} cámara${total !== 1 ? 's' : ''} en total`}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Código</th>
                <th className="px-5 py-3 font-semibold">Tipo</th>
                <th className="px-5 py-3 font-semibold">Municipio</th>
                <th className="px-5 py-3 font-semibold">Límite (km/h)</th>
                <th className="px-5 py-3 font-semibold">Estado</th>
                <th className="px-5 py-3 font-semibold">Activa</th>
                <th className="px-5 py-3 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 animate-pulse rounded bg-zinc-100" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : cameras.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-zinc-400">
                    No hay cámaras que coincidan con la búsqueda
                  </td>
                </tr>
              ) : (
                cameras.map((camera) => (
                  <tr key={camera.id} className={`hover:bg-zinc-50 ${!camera.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-4 font-semibold text-zinc-950">
                      {camera.camera_code}
                    </td>
                    <td className="px-5 py-4 text-zinc-600">
                      {TYPE_LABELS[camera.camera_type]}
                    </td>
                    <td className="px-5 py-4 text-zinc-600">
                      {camera.municipalities?.name ?? '—'}
                    </td>
                    <td className="px-5 py-4 text-zinc-600">
                      {camera.speed_limit_kmh ?? '—'}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_COLORS[camera.status]}`}>
                        {STATUS_LABELS[camera.status]}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={camera.is_active}
                        disabled={togglingId === camera.id}
                        onClick={() => handleToggleActive(camera)}
                        title={camera.is_active ? 'Desactivar cámara' : 'Activar cámara'}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
                          camera.is_active ? 'bg-emerald-600' : 'bg-zinc-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            camera.is_active ? 'translate-x-4' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => router.push(`/dashboard/cameras/${camera.id}/edit`)}
                        className="text-zinc-600 hover:underline text-xs font-medium"
                      >
                        Editar
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

      <Modal isOpen={showImport} onClose={closeImport} titleId="import-cameras-title" title="Importar cámaras">
        <p className="mb-4 text-sm text-zinc-500">
          Sube un archivo CSV o Excel (.xlsx). Si alguna fila tiene un error, no se
          importa ninguna cámara del archivo.
        </p>

        <button
          type="button"
          onClick={downloadTemplate}
          className="mb-4 text-sm font-medium text-blue-600 hover:underline"
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
            aria-label="Archivo CSV o Excel a importar"
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
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {importing ? 'Importando...' : 'Importar'}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  )
}
