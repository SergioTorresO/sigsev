'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'

interface RefItem { id: string; name: string }
interface SignalType extends RefItem { code: string | null; category_id: string }

export default function EditSignalPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const { user } = useAuth()
  const canWrite = user?.roles?.name === 'ADMIN' || user?.roles?.name === 'SUPERVISOR'

  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user && !canWrite) router.replace('/dashboard/signals')
  }, [user, canWrite, router])

  const [categories, setCategories] = useState<RefItem[]>([])
  const [signalTypes, setSignalTypes] = useState<SignalType[]>([])
  const [departments, setDepartments] = useState<RefItem[]>([])
  const [municipalities, setMunicipalities] = useState<RefItem[]>([])
  const [zones, setZones] = useState<RefItem[]>([])

  const [form, setForm] = useState({
    signal_code: '',
    category_id: '',
    signal_type_id: '',
    department_id: '',
    municipality_id: '',
    zone_id: '',
    status: 'BUENO',
    address: '',
    description: '',
    observations: '',
    installation_date: '',
    latitude: '',
    longitude: '',
  })

  useEffect(() => {
    Promise.all([
      api.get<RefItem[]>('/api/ref/categories'),
      api.get<RefItem[]>('/api/ref/departments'),
      api.get<{ id: string; department_id: string | null }[]>('/api/ref/municipalities'),
      api.get<Record<string, unknown>>(`/api/signals/${id}`),
    ]).then(([cats, deps, allMunis, signal]) => {
      setCategories(cats)
      setDepartments(deps)
      const municipalityId = (signal.municipality_id as string) ?? ''
      const departmentId = allMunis.find((m) => m.id === municipalityId)?.department_id ?? ''
      setForm({
        signal_code: (signal.signal_code as string) ?? '',
        category_id: (signal.category_id as string) ?? '',
        signal_type_id: (signal.signal_type_id as string) ?? '',
        department_id: departmentId,
        municipality_id: municipalityId,
        zone_id: (signal.zone_id as string) ?? '',
        status: (signal.status as string) ?? 'BUENO',
        address: (signal.address as string) ?? '',
        description: (signal.description as string) ?? '',
        observations: (signal.observations as string) ?? '',
        installation_date: signal.installation_date
          ? (signal.installation_date as string).split('T')[0]
          : '',
        latitude: String(signal.latitude ?? ''),
        longitude: String(signal.longitude ?? ''),
      })
    }).finally(() => setFetching(false))
  }, [id])

  useEffect(() => {
    if (!form.category_id) { setSignalTypes([]); return }
    api.get<SignalType[]>(`/api/ref/signal-types?category_id=${form.category_id}`)
      .then(setSignalTypes)
  }, [form.category_id])

  useEffect(() => {
    if (!form.department_id) { setMunicipalities([]); return }
    api.get<RefItem[]>(`/api/ref/municipalities?department_id=${form.department_id}`)
      .then(setMunicipalities)
  }, [form.department_id])

  useEffect(() => {
    if (!form.municipality_id) { setZones([]); return }
    api.get<RefItem[]>(`/api/ref/zones?municipality_id=${form.municipality_id}`)
      .then(setZones)
  }, [form.municipality_id])

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { department_id: _department_id, ...rest } = form
      await api.put(`/api/signals/${id}`, {
        ...rest,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        category_id: form.category_id || undefined,
        signal_type_id: form.signal_type_id || undefined,
        municipality_id: form.municipality_id || undefined,
        zone_id: form.zone_id || undefined,
        installation_date: form.installation_date || undefined,
      })
      router.push('/dashboard/signals')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar señal')
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <DashboardLayout title="Editar señal" subtitle="Señales">
        <div className="flex h-40 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout
      title={`Editar: ${form.signal_code}`}
      subtitle="Señales"
      actions={
        <a href="/dashboard/signals" className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
          ← Volver
        </a>
      }
    >
      <div className="max-w-3xl">
        <form onSubmit={handleSubmit} className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm space-y-5">
          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Código *</label>
              <input required value={form.signal_code} onChange={(e) => set('signal_code', e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Estado</label>
              <select value={form.status} onChange={(e) => set('status', e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none">
                <option value="BUENO">Bueno</option>
                <option value="REGULAR">Regular</option>
                <option value="DETERIORADO">Deteriorado</option>
                <option value="CAIDO">Caído</option>
                <option value="DESAPARECIDO">Desaparecido</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Categoría</label>
              <select value={form.category_id} onChange={(e) => { set('category_id', e.target.value); set('signal_type_id', '') }}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none">
                <option value="">Sin categoría</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Tipo de señal</label>
              <select value={form.signal_type_id} onChange={(e) => set('signal_type_id', e.target.value)}
                disabled={!form.category_id}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none disabled:opacity-50">
                <option value="">Sin tipo</option>
                {signalTypes.map((t) => <option key={t.id} value={t.id}>{t.name}{t.code ? ` (${t.code})` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Departamento</label>
              <select value={form.department_id} onChange={(e) => { set('department_id', e.target.value); set('municipality_id', ''); set('zone_id', '') }}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none">
                <option value="">Sin departamento</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Municipio</label>
              <select value={form.municipality_id} onChange={(e) => { set('municipality_id', e.target.value); set('zone_id', '') }}
                disabled={!form.department_id}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none disabled:opacity-50">
                <option value="">Sin municipio</option>
                {municipalities.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Zona</label>
              <select value={form.zone_id} onChange={(e) => set('zone_id', e.target.value)}
                disabled={!form.municipality_id}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none disabled:opacity-50">
                <option value="">Sin zona</option>
                {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Latitud *</label>
              <input required type="number" step="any" value={form.latitude} onChange={(e) => set('latitude', e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Longitud *</label>
              <input required type="number" step="any" value={form.longitude} onChange={(e) => set('longitude', e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Dirección</label>
            <input value={form.address} onChange={(e) => set('address', e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Descripción</label>
            <textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Observaciones</label>
            <textarea rows={2} value={form.observations} onChange={(e) => set('observations', e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          </div>
          <div className="max-w-xs">
            <label className="mb-1 block text-sm font-medium text-zinc-700">Fecha de instalación</label>
            <input type="date" value={form.installation_date} onChange={(e) => set('installation_date', e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading}
              className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
              {loading ? 'Guardando…' : 'Guardar cambios'}
            </button>
            <a href="/dashboard/signals"
              className="rounded-md border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
              Cancelar
            </a>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
