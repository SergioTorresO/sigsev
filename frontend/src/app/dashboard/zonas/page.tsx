'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import Modal from '@/components/Modal'
import Pagination from '@/components/Pagination'

type ZoneType = 'URBANA' | 'RURAL'

interface Zone {
  id: string
  name: string
  zone_type: ZoneType
  description: string | null
  created_at: string
  municipality_id: string
  municipalities: { id: string; name: string } | null
}

interface ZonesResponse { data: Zone[]; total: number; page: number; limit: number }
interface RefItem { id: string; name: string }
interface MunicipalityRef extends RefItem { department_id: string }

interface FormState {
  department_id: string
  municipality_id: string
  name: string
  zone_type: ZoneType
  description: string
}

const EMPTY_FORM: FormState = { department_id: '', municipality_id: '', name: '', zone_type: 'URBANA', description: '' }

const LIMIT = 20

interface BulkImportRowError {
  row: number
  message: string
}

interface BulkImportResponse {
  inserted?: number
  message?: string
  errors?: BulkImportRowError[]
}

const TEMPLATE_CSV = `municipio,nombre,tipo,descripcion
Itagüí,Comuna 1,URBANA,
`

function downloadZonesTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'plantilla_zonas.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function ZonasPage() {
  const { user } = useAuth()
  const router = useRouter()

  const canManage = user?.roles?.name === 'ADMIN' || user?.roles?.name === 'SUPERVISOR'

  useEffect(() => {
    if (user && !canManage) router.replace('/dashboard')
  }, [user, canManage, router])

  const [zones, setZones] = useState<Zone[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [municipalityFilter, setMunicipalityFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [departments, setDepartments] = useState<RefItem[]>([])
  const [municipalitiesRef, setMunicipalitiesRef] = useState<MunicipalityRef[]>([])

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Zone | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Zone | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [showImport, setShowImport] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importErrors, setImportErrors] = useState<BulkImportRowError[]>([])
  const [importSuccess, setImportSuccess] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      api.get<RefItem[]>('/api/ref/departments'),
      api.get<MunicipalityRef[]>('/api/ref/municipalities'),
    ]).then(([deps, munis]) => {
      setDepartments(deps)
      setMunicipalitiesRef(munis)
    }).catch(() => {})
  }, [])

  const fetchZones = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
      if (search) params.set('search', search)
      if (municipalityFilter) params.set('municipality_id', municipalityFilter)
      const res = await api.get<ZonesResponse>(`/api/zones?${params}`)
      setZones(res.data)
      setTotal(res.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar zonas')
    } finally {
      setLoading(false)
    }
  }, [page, search, municipalityFilter])

  useEffect(() => { fetchZones() }, [fetchZones])

  const totalPages = Math.ceil(total / LIMIT)

  const municipalityOptionsForFilter = useMemo(
    () => [...municipalitiesRef].sort((a, b) => a.name.localeCompare(b.name)),
    [municipalitiesRef]
  )

  // Municipios disponibles en el formulario, filtrados por el departamento elegido
  const formMunicipalityOptions = useMemo(() => {
    if (!form.department_id) return []
    return municipalitiesRef
      .filter((m) => m.department_id === form.department_id)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [municipalitiesRef, form.department_id])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setShowForm(true)
  }

  const openEdit = (zone: Zone) => {
    const muniRef = municipalitiesRef.find((m) => m.id === zone.municipality_id)
    setEditing(zone)
    setForm({
      department_id: muniRef?.department_id ?? '',
      municipality_id: zone.municipality_id,
      name: zone.name,
      zone_type: zone.zone_type,
      description: zone.description ?? '',
    })
    setFormError(null)
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!form.municipality_id) {
      setFormError('Selecciona un municipio')
      return
    }
    if (!form.name.trim()) {
      setFormError('El nombre es requerido')
      return
    }
    try {
      setSaving(true)
      const payload = {
        municipality_id: form.municipality_id,
        name: form.name.trim(),
        zone_type: form.zone_type,
        description: form.description.trim() || undefined,
      }
      if (editing) {
        await api.put(`/api/zones/${editing.id}`, payload)
      } else {
        await api.post('/api/zones', payload)
      }
      setShowForm(false)
      await fetchZones()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar la zona')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      setDeleteError(null)
      await api.delete(`/api/zones/${deleteTarget.id}`)
      setDeleteTarget(null)
      await fetchZones()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Error al eliminar la zona')
    } finally {
      setDeleting(false)
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
      const res = await api.postForm<BulkImportResponse>('/api/zones/bulk-import', formData)
      setImportSuccess(`Se importaron ${res.inserted ?? 0} zonas correctamente.`)
      setImportFile(null)
      fetchZones()
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

  if (!canManage) return null

  return (
    <DashboardLayout title="Zonas" subtitle="Catálogo">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <input
            type="text"
            aria-label="Buscar por nombre"
            placeholder="Buscar por nombre…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none sm:w-auto"
          />
          <select
            aria-label="Filtrar por municipio"
            value={municipalityFilter}
            onChange={(e) => { setMunicipalityFilter(e.target.value); setPage(1) }}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none sm:w-auto"
          >
            <option value="">Todos los municipios</option>
            {municipalityOptionsForFilter.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            Importar CSV/Excel
          </button>
          <button
            onClick={openCreate}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            + Nueva zona
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-5 py-3">
          <span className="text-sm font-medium text-zinc-600">
            {loading ? 'Cargando…' : `${total} zona${total !== 1 ? 's' : ''}`}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Nombre</th>
                <th className="px-5 py-3 font-semibold">Municipio</th>
                <th className="px-5 py-3 font-semibold">Tipo</th>
                <th className="px-5 py-3 font-semibold">Descripción</th>
                <th className="px-5 py-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-5 py-4"><div className="h-4 animate-pulse rounded bg-zinc-100" /></td>
                  ))}</tr>
                ))
              ) : zones.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-zinc-400">No hay zonas registradas</td></tr>
              ) : zones.map((zone) => (
                <tr key={zone.id} className="hover:bg-zinc-50">
                  <td className="px-5 py-4 font-medium text-zinc-800">{zone.name}</td>
                  <td className="px-5 py-4 text-zinc-600">{zone.municipalities?.name ?? '—'}</td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      zone.zone_type === 'URBANA' ? 'bg-sky-100 text-sky-700' : 'bg-lime-100 text-lime-700'
                    }`}>
                      {zone.zone_type === 'URBANA' ? 'Urbana' : 'Rural'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-zinc-500">{zone.description || '—'}</td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEdit(zone)}
                        className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => { setDeleteTarget(zone); setDeleteError(null) }}
                        className="rounded-md border border-rose-200 px-3 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        titleId="zone-form-title"
        title={editing ? 'Editar zona' : 'Nueva zona'}
      >
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="zone-department" className="mb-1 block text-xs font-semibold uppercase text-zinc-500">Departamento</label>
                <select
                  id="zone-department"
                  value={form.department_id}
                  onChange={(e) => setForm((f) => ({ ...f, department_id: e.target.value, municipality_id: '' }))}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">Selecciona un departamento</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="zone-municipality" className="mb-1 block text-xs font-semibold uppercase text-zinc-500">Municipio</label>
                <select
                  id="zone-municipality"
                  value={form.municipality_id}
                  onChange={(e) => setForm((f) => ({ ...f, municipality_id: e.target.value }))}
                  disabled={!form.department_id}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:bg-zinc-50 disabled:text-zinc-400"
                >
                  <option value="">Selecciona un municipio</option>
                  {formMunicipalityOptions.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="zone-name" className="mb-1 block text-xs font-semibold uppercase text-zinc-500">Nombre</label>
                <input
                  id="zone-name"
                  type="text"
                  placeholder="Ej. Comuna 1, Vereda La Esperanza…"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <span id="zone-type-label" className="mb-1 block text-xs font-semibold uppercase text-zinc-500">Tipo</span>
                <div role="group" aria-labelledby="zone-type-label" className="flex gap-2">
                  {(['URBANA', 'RURAL'] as ZoneType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={form.zone_type === t}
                      onClick={() => setForm((f) => ({ ...f, zone_type: t }))}
                      className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
                        form.zone_type === t ? 'bg-zinc-950 text-white' : 'border border-zinc-300 text-zinc-700 hover:bg-zinc-50'
                      }`}
                    >
                      {t === 'URBANA' ? 'Urbana' : 'Rural'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="zone-description" className="mb-1 block text-xs font-semibold uppercase text-zinc-500">Descripción (opcional)</label>
                <textarea
                  id="zone-description"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {formError && (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </form>
      </Modal>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        titleId="zone-delete-title"
        title="Eliminar zona"
        maxWidthClassName="max-w-sm"
        showCloseButton={false}
      >
        <p className="mb-4 text-sm text-zinc-600">
          ¿Seguro que quieres eliminar la zona <strong>{deleteTarget?.name}</strong>? Esta acción no se puede deshacer.
        </p>
        {deleteError && (
          <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{deleteError}</div>
        )}
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setDeleteTarget(null)}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
          >
            {deleting ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      </Modal>

      <Modal isOpen={showImport} onClose={closeImport} titleId="import-zones-title" title="Importar zonas">
        <p className="mb-4 text-sm text-zinc-500">
          Sube un archivo CSV o Excel (.xlsx). Si alguna fila tiene un error, no se
          importa ninguna zona del archivo.
        </p>

        <button
          type="button"
          onClick={downloadZonesTemplate}
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
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {importing ? 'Importando...' : 'Importar'}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  )
}
