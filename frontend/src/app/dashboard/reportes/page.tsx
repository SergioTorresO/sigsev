'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'

type ReportType = 'signals' | 'inspections' | 'maintenances' | 'summary'

const REPORT_OPTIONS: { value: ReportType; label: string; description: string }[] = [
  { value: 'signals', label: 'Señales por estado', description: 'Listado de señales filtrado por estado, municipio y zona.' },
  { value: 'inspections', label: 'Inspecciones por período', description: 'Inspecciones realizadas en un rango de fechas.' },
  { value: 'maintenances', label: 'Mantenimientos por período', description: 'Mantenimientos en un rango de fechas y su estado.' },
  { value: 'summary', label: 'Resumen general', description: 'Totales consolidados de señales, inspecciones y mantenimientos.' },
]

const SIGNAL_STATUSES = ['BUENO', 'REGULAR', 'DETERIORADO', 'CAIDO', 'DESAPARECIDO']
const MAINTENANCE_STATUSES = ['PENDIENTE', 'EN_PROCESO', 'COMPLETADO']

const REPORT_ENDPOINT: Record<ReportType, string> = {
  signals: '/api/reports/signals',
  inspections: '/api/reports/inspections',
  maintenances: '/api/reports/maintenances',
  summary: '/api/reports/summary',
}

interface Department { id: string; name: string }
interface Municipality { id: string; name: string; department_id: string }
interface Zone { id: string; name: string }

export default function ReportesPage() {
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user && user.roles?.name !== 'ADMIN' && user.roles?.name !== 'SUPERVISOR') router.replace('/dashboard')
  }, [user, router])

  const [reportType, setReportType] = useState<ReportType>('signals')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [municipalityId, setMunicipalityId] = useState('')
  const [zoneId, setZoneId] = useState('')
  const [status, setStatus] = useState('')
  const [departments, setDepartments] = useState<Department[]>([])
  const [municipalities, setMunicipalities] = useState<Municipality[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [downloading, setDownloading] = useState<'xlsx' | 'pdf' | null>(null)
  const [error, setError] = useState('')

  const showDateFilters = reportType === 'inspections' || reportType === 'maintenances' || reportType === 'summary'
  const showLocationFilters = reportType === 'signals' || reportType === 'inspections' || reportType === 'maintenances' || reportType === 'summary'
  const showStatusFilter = reportType === 'signals' || reportType === 'maintenances'
  const statusOptions = reportType === 'maintenances' ? MAINTENANCE_STATUSES : SIGNAL_STATUSES
  // En el resumen general, el rango de fecha solo acota a Inspecciones y la
  // ubicación solo acota a Señales/Mantenimientos (ver nota en reports.service.ts)
  const dateFilterHint = reportType === 'summary' ? 'Aplica solo a Inspecciones' : undefined
  const locationFilterHint = reportType === 'summary' ? 'Aplica solo a Señales y Mantenimientos' : undefined

  useEffect(() => {
    api.get<Department[]>('/api/ref/departments').then(setDepartments).catch(() => {})
  }, [])

  useEffect(() => {
    setMunicipalityId('')
    const params = departmentId ? `?department_id=${departmentId}` : ''
    api.get<Municipality[]>(`/api/ref/municipalities${params}`).then(setMunicipalities).catch(() => {})
  }, [departmentId])

  useEffect(() => {
    setZoneId('')
    if (!municipalityId) { setZones([]); return }
    api.get<Zone[]>(`/api/ref/zones?municipality_id=${municipalityId}`).then(setZones).catch(() => {})
  }, [municipalityId])

  // Resetear filtros que no aplican al cambiar de tipo de reporte
  useEffect(() => {
    setStatus('')
  }, [reportType])

  const handleDownload = async (format: 'xlsx' | 'pdf') => {
    setError('')
    setDownloading(format)
    try {
      const params = new URLSearchParams({ format })
      if (showDateFilters && dateFrom) params.set('date_from', dateFrom)
      if (showDateFilters && dateTo) params.set('date_to', dateTo)
      if (showLocationFilters && municipalityId) params.set('municipality_id', municipalityId)
      if (showLocationFilters && zoneId) params.set('zone_id', zoneId)
      if (showStatusFilter && status) params.set('status', status)

      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
      const res = await fetch(`${base}${REPORT_ENDPOINT[reportType]}?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message ?? `Error ${res.status} al generar el reporte`)
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${reportType}-${new Date().toISOString().slice(0, 10)}.${format}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al descargar el reporte')
    } finally {
      setDownloading(null)
    }
  }

  return (
    <DashboardLayout title="Reportes" subtitle="Inventario vial">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Selector de tipo de reporte */}
        <div className="lg:col-span-1">
          <h3 className="mb-3 text-sm font-semibold text-zinc-700">Tipo de reporte</h3>
          <div className="space-y-2">
            {REPORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setReportType(opt.value)}
                className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                  reportType === opt.value
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-zinc-200 bg-white hover:bg-zinc-50'
                }`}
              >
                <p className="text-sm font-semibold text-zinc-950">{opt.label}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{opt.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Filtros + descarga */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-zinc-700">Filtros</h3>

            {error && (
              <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              {showDateFilters && (
                <>
                  {dateFilterHint && (
                    <p className="sm:col-span-2 -mb-1 text-xs text-zinc-400">{dateFilterHint}</p>
                  )}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700">Desde</label>
                    <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700">Hasta</label>
                    <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" />
                  </div>
                </>
              )}

              {showLocationFilters && (
                <>
                  {locationFilterHint && (
                    <p className="sm:col-span-2 -mb-1 text-xs text-zinc-400">{locationFilterHint}</p>
                  )}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700">Departamento</label>
                    <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none">
                      <option value="">Todos</option>
                      {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700">Municipio</label>
                    <select value={municipalityId} onChange={(e) => setMunicipalityId(e.target.value)}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none">
                      <option value="">Todos</option>
                      {municipalities.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700">Zona</label>
                    <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} disabled={!municipalityId}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none disabled:bg-zinc-50">
                      <option value="">Todas</option>
                      {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
                    </select>
                  </div>
                </>
              )}

              {showStatusFilter && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Estado</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none">
                    <option value="">Todos</option>
                    {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}

              {!showDateFilters && !showLocationFilters && !showStatusFilter && (
                <p className="sm:col-span-2 text-sm text-zinc-500">Este reporte no tiene filtros adicionales.</p>
              )}
            </div>

            <div className="mt-6 flex gap-3 border-t border-zinc-100 pt-4">
              <button
                onClick={() => handleDownload('xlsx')}
                disabled={downloading !== null}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {downloading === 'xlsx' ? 'Generando…' : 'Descargar Excel'}
              </button>
              <button
                onClick={() => handleDownload('pdf')}
                disabled={downloading !== null}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
              >
                {downloading === 'pdf' ? 'Generando…' : 'Descargar PDF'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
