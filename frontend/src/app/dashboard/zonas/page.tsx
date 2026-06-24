'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'

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

  if (!canManage) return null

  return (
    <DashboardLayout title="Zonas" subtitle="Catálogo">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Buscar por nombre…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
          <select
            value={municipalityFilter}
            onChange={(e) => { setMunicipalityFilter(e.target.value); setPage(1) }}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          >
            <option value="">Todos los municipios</option>
            {municipalityOptionsForFilter.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={openCreate}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          + Nueva zona
        </button>
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

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-zinc-950">
                {editing ? 'Editar zona' : 'Nueva zona'}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-zinc-400 hover:text-zinc-700">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-zinc-500">Departamento</label>
                <select
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
                <label className="mb-1 block text-xs font-semibold uppercase text-zinc-500">Municipio</label>
                <select
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
                <label className="mb-1 block text-xs font-semibold uppercase text-zinc-500">Nombre</label>
                <input
                  type="text"
                  placeholder="Ej. Comuna 1, Vereda La Esperanza…"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-zinc-500">Tipo</label>
                <div className="flex gap-2">
                  {(['URBANA', 'RURAL'] as ZoneType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
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
                <label className="mb-1 block text-xs font-semibold uppercase text-zinc-500">Descripción (opcional)</label>
                <textarea
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
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-base font-semibold text-zinc-950">Eliminar zona</h3>
            <p className="mb-4 text-sm text-zinc-600">
              ¿Seguro que quieres eliminar la zona <strong>{deleteTarget.name}</strong>? Esta acción no se puede deshacer.
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
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
