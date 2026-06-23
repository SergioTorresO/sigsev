'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'

interface Inspection {
  id: string
  status: string
  observations: string | null
  inspection_date: string | null
  users: { id: string; full_name: string } | null
}

interface Maintenance {
  id: string
  status: string
  description: string | null
  maintenance_date: string | null
  cost: number | null
}

interface SignalDetail {
  id: string
  signal_code: string
  address: string | null
  status: 'BUENO' | 'REGULAR' | 'DETERIORADO' | 'CAIDO' | 'DESAPARECIDO'
  description: string | null
  observations: string | null
  installation_date: string | null
  last_maintenance_date: string | null
  image_url: string | null
  latitude: number
  longitude: number
  is_active: boolean
  created_at: string | null
  updated_at: string | null
  signal_categories: { id: string; name: string } | null
  signal_types: { id: string; name: string; code: string | null } | null
  municipalities: { id: string; name: string } | null
  zones: { id: string; name: string; zone_type: string | null } | null
  users: { id: string; full_name: string } | null
  inspections: Inspection[]
  maintenances: Maintenance[]
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

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('es-CO') : '—')

export default function SignalDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const { user } = useAuth()
  const canWrite = user?.roles?.name === 'ADMIN' || user?.roles?.name === 'SUPERVISOR'

  const [signal, setSignal] = useState<SignalDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    api.get<SignalDetail>(`/api/signals/${id}`)
      .then(setSignal)
      .catch((err) => setError(err instanceof Error ? err.message : 'Error al cargar la señal'))
      .finally(() => setLoading(false))
  }, [id])

  const [toggling, setToggling] = useState(false)

  const handleToggleActive = async () => {
    setToggling(true)
    try {
      const updated = await api.patch<SignalDetail>(`/api/signals/${id}/toggle-active`, {})
      setSignal(updated)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error')
    } finally {
      setToggling(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout title="Señal" subtitle="Señales">
        <div className="flex h-40 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
        </div>
      </DashboardLayout>
    )
  }

  if (error || !signal) {
    return (
      <DashboardLayout title="Señal" subtitle="Señales">
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error || 'Señal no encontrada'}
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout
      title={signal.signal_code}
      subtitle="Señales"
      actions={
        <div className="flex gap-2">
          <a
            href="/dashboard/signals"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            ← Volver
          </a>
          {canWrite && (
            <a
              href={`/dashboard/signals/${id}/edit`}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Editar
            </a>
          )}
          {canWrite && (
            <button
              type="button"
              role="switch"
              aria-checked={signal.is_active}
              disabled={toggling}
              onClick={handleToggleActive}
              className="flex items-center gap-2 rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              <span
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  signal.is_active ? 'bg-emerald-600' : 'bg-zinc-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    signal.is_active ? 'translate-x-4' : 'translate-x-1'
                  }`}
                />
              </span>
              {signal.is_active ? 'Activa' : 'Inactiva'}
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Ficha principal */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[signal.status]}`}>
              {STATUS_LABELS[signal.status]}
            </span>
            {!signal.is_active && (
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-500">
                Inactiva
              </span>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Dirección" value={signal.address ?? '—'} />
            <Field label="Municipio" value={signal.municipalities?.name ?? '—'} />
            <Field label="Zona" value={signal.zones?.name ?? '—'} />
            <Field label="Categoría" value={signal.signal_categories?.name ?? '—'} />
            <Field label="Tipo de señal" value={signal.signal_types?.name ?? '—'} />
            <Field label="Instalada por" value={signal.users?.full_name ?? '—'} />
            <Field label="Fecha de instalación" value={fmtDate(signal.installation_date)} />
            <Field label="Último mantenimiento" value={fmtDate(signal.last_maintenance_date)} />
            <Field label="Coordenadas" value={`${signal.latitude}, ${signal.longitude}`} />
          </div>

          {signal.description && (
            <div className="mt-4">
              <span className="mb-1 block text-xs font-semibold uppercase text-zinc-500">Descripción</span>
              <p className="text-sm text-zinc-700">{signal.description}</p>
            </div>
          )}
          {signal.observations && (
            <div className="mt-4">
              <span className="mb-1 block text-xs font-semibold uppercase text-zinc-500">Observaciones</span>
              <p className="text-sm text-zinc-700">{signal.observations}</p>
            </div>
          )}
        </div>

        {/* Inspecciones */}
        <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Inspecciones</h2>
          </div>
          {signal.inspections.length === 0 ? (
            <p className="px-5 py-4 text-sm text-zinc-400">No hay inspecciones registradas</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {signal.inspections.map((insp) => (
                <li key={insp.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <div>
                    <span className="font-medium text-zinc-800">{fmtDate(insp.inspection_date)}</span>
                    {insp.users?.full_name && (
                      <span className="ml-2 text-zinc-500">por {insp.users.full_name}</span>
                    )}
                    {insp.observations && <p className="text-zinc-500">{insp.observations}</p>}
                  </div>
                  <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600">
                    {insp.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Mantenimientos */}
        <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Mantenimientos</h2>
          </div>
          {signal.maintenances.length === 0 ? (
            <p className="px-5 py-4 text-sm text-zinc-400">No hay mantenimientos registrados</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {signal.maintenances.map((m) => (
                <li key={m.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <div>
                    <span className="font-medium text-zinc-800">{fmtDate(m.maintenance_date)}</span>
                    {m.description && <p className="text-zinc-500">{m.description}</p>}
                    {m.cost != null && <p className="text-zinc-500">Costo: {m.cost}</p>}
                  </div>
                  <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600">
                    {m.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="mb-1 block text-xs font-semibold uppercase text-zinc-500">{label}</span>
      <span className="text-sm text-zinc-800">{value}</span>
    </div>
  )
}
