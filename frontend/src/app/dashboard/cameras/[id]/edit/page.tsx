'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'

interface RefItem { id: string; name: string }

// Mismo umbral que el backend (cameras.service.ts, CALIBRATION_VALIDITY_DAYS):
// una cámara debe recalibrarse cada año. Aviso puramente informativo en el
// formulario — quien categoriza de verdad como DESCALIBRADA es el backend.
const isCalibrationOverdue = (dateStr: string) => {
  if (!dateStr) return false
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return false
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 365)
  return date < cutoff
}

export default function EditCameraPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const { user } = useAuth()
  const toast = useToast()
  const canWrite = user?.roles?.name === 'ADMIN' || user?.roles?.name === 'SUPERVISOR'

  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')

  const [certificateUrl, setCertificateUrl] = useState<string | null>(null)
  const [certificateFile, setCertificateFile] = useState<File | null>(null)
  const [uploadingCertificate, setUploadingCertificate] = useState(false)

  useEffect(() => {
    if (user && !canWrite) router.replace('/dashboard/cameras')
  }, [user, canWrite, router])

  const [departments, setDepartments] = useState<RefItem[]>([])
  const [municipalities, setMunicipalities] = useState<RefItem[]>([])
  const [zones, setZones] = useState<RefItem[]>([])

  const [form, setForm] = useState({
    camera_code: '',
    camera_type: 'FIJA',
    status: 'EN_SERVICIO',
    serial_number: '',
    brand: '',
    model: '',
    department_id: '',
    municipality_id: '',
    zone_id: '',
    address: '',
    speed_limit_kmh: '',
    lane_direction: '',
    radar_code: '',
    operator_entity: '',
    installation_date: '',
    last_calibration_date: '',
    description: '',
    observations: '',
    latitude: '',
    longitude: '',
  })

  useEffect(() => {
    Promise.all([
      api.get<RefItem[]>('/api/ref/departments'),
      api.get<{ id: string; department_id: string | null }[]>('/api/ref/municipalities'),
      api.get<Record<string, unknown>>(`/api/cameras/${id}`),
    ]).then(([deps, allMunis, camera]) => {
      setDepartments(deps)
      const municipalityId = (camera.municipality_id as string) ?? ''
      const departmentId = allMunis.find((m) => m.id === municipalityId)?.department_id ?? ''
      setForm({
        camera_code: (camera.camera_code as string) ?? '',
        camera_type: (camera.camera_type as string) ?? 'FIJA',
        status: (camera.status as string) ?? 'EN_SERVICIO',
        serial_number: (camera.serial_number as string) ?? '',
        brand: (camera.brand as string) ?? '',
        model: (camera.model as string) ?? '',
        department_id: departmentId,
        municipality_id: municipalityId,
        zone_id: (camera.zone_id as string) ?? '',
        address: (camera.address as string) ?? '',
        speed_limit_kmh: camera.speed_limit_kmh != null ? String(camera.speed_limit_kmh) : '',
        lane_direction: (camera.lane_direction as string) ?? '',
        radar_code: (camera.radar_code as string) ?? '',
        operator_entity: (camera.operator_entity as string) ?? '',
        installation_date: camera.installation_date
          ? (camera.installation_date as string).split('T')[0]
          : '',
        last_calibration_date: camera.last_calibration_date
          ? (camera.last_calibration_date as string).split('T')[0]
          : '',
        description: (camera.description as string) ?? '',
        observations: (camera.observations as string) ?? '',
        latitude: String(camera.latitude ?? ''),
        longitude: String(camera.longitude ?? ''),
      })
      setCertificateUrl((camera.calibration_certificate_url as string) ?? null)
    }).finally(() => setFetching(false))
  }, [id])

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

  const handleUploadCertificate = async () => {
    if (!certificateFile) return
    setUploadingCertificate(true)
    try {
      const formData = new FormData()
      formData.append('certificate', certificateFile)
      const camera = await api.postForm<{ calibration_certificate_url: string }>(
        `/api/cameras/${id}/certificate`,
        formData
      )
      setCertificateUrl(camera.calibration_certificate_url)
      setCertificateFile(null)
      toast.success('Certificado subido correctamente')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al subir el certificado')
    } finally {
      setUploadingCertificate(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { department_id: _department_id, ...rest } = form
      await api.put(`/api/cameras/${id}`, {
        ...rest,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        speed_limit_kmh: form.speed_limit_kmh ? parseInt(form.speed_limit_kmh, 10) : undefined,
        municipality_id: form.municipality_id || undefined,
        zone_id: form.zone_id || undefined,
        installation_date: form.installation_date || undefined,
        last_calibration_date: form.last_calibration_date || undefined,
      })
      router.push('/dashboard/cameras')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar cámara')
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <DashboardLayout title="Editar cámara" subtitle="Cámaras">
        <div className="flex h-40 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout
      title={`Editar: ${form.camera_code}`}
      subtitle="Cámaras"
      actions={
        <a href="/dashboard/cameras" className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
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
              <label htmlFor="camera-code" className="mb-1 block text-sm font-medium text-zinc-700">Código *</label>
              <input id="camera-code" required value={form.camera_code} onChange={(e) => set('camera_code', e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>

            <div>
              <span id="camera-type-label" className="mb-1 block text-sm font-medium text-zinc-700">Tipo</span>
              <div role="group" aria-labelledby="camera-type-label" className="flex gap-2">
                {(['FIJA', 'MOVIL'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={form.camera_type === t}
                    onClick={() => set('camera_type', t)}
                    className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
                      form.camera_type === t ? 'bg-zinc-950 text-white' : 'border border-zinc-300 text-zinc-700 hover:bg-zinc-50'
                    }`}
                  >
                    {t === 'FIJA' ? 'Fija' : 'Móvil'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="camera-status" className="mb-1 block text-sm font-medium text-zinc-700">Estado operativo</label>
              <select id="camera-status" value={form.status} onChange={(e) => set('status', e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                <option value="EN_SERVICIO">En servicio</option>
                <option value="FUERA_DE_SERVICIO">Fuera de servicio</option>
                <option value="EN_MANTENIMIENTO">En mantenimiento</option>
                <option value="DESCALIBRADA">Descalibrada</option>
              </select>
            </div>

            <div>
              <label htmlFor="camera-serial" className="mb-1 block text-sm font-medium text-zinc-700">Número de serie</label>
              <input id="camera-serial" value={form.serial_number} onChange={(e) => set('serial_number', e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>

            <div>
              <label htmlFor="camera-brand" className="mb-1 block text-sm font-medium text-zinc-700">Marca</label>
              <input id="camera-brand" value={form.brand} onChange={(e) => set('brand', e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>

            <div>
              <label htmlFor="camera-model" className="mb-1 block text-sm font-medium text-zinc-700">Modelo</label>
              <input id="camera-model" value={form.model} onChange={(e) => set('model', e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>

            <div>
              <label htmlFor="camera-department" className="mb-1 block text-sm font-medium text-zinc-700">Departamento</label>
              <select id="camera-department" value={form.department_id} onChange={(e) => { set('department_id', e.target.value); set('municipality_id', ''); set('zone_id', '') }}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                <option value="">Sin departamento</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="camera-municipality" className="mb-1 block text-sm font-medium text-zinc-700">Municipio</label>
              <select id="camera-municipality" value={form.municipality_id} onChange={(e) => { set('municipality_id', e.target.value); set('zone_id', '') }}
                disabled={!form.department_id}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50">
                <option value="">Sin municipio</option>
                {municipalities.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="camera-zone" className="mb-1 block text-sm font-medium text-zinc-700">Zona</label>
              <select id="camera-zone" value={form.zone_id} onChange={(e) => set('zone_id', e.target.value)}
                disabled={!form.municipality_id}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50">
                <option value="">Sin zona</option>
                {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="camera-latitude" className="mb-1 block text-sm font-medium text-zinc-700">Latitud *</label>
              <input id="camera-latitude" required type="number" step="any" value={form.latitude} onChange={(e) => set('latitude', e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>

            <div>
              <label htmlFor="camera-longitude" className="mb-1 block text-sm font-medium text-zinc-700">Longitud *</label>
              <input id="camera-longitude" required type="number" step="any" value={form.longitude} onChange={(e) => set('longitude', e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>

            <div>
              <label htmlFor="camera-speed-limit" className="mb-1 block text-sm font-medium text-zinc-700">Límite de velocidad (km/h)</label>
              <input id="camera-speed-limit" type="number" min="1" value={form.speed_limit_kmh} onChange={(e) => set('speed_limit_kmh', e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>

            <div>
              <label htmlFor="camera-lane-direction" className="mb-1 block text-sm font-medium text-zinc-700">Sentido de vía</label>
              <input id="camera-lane-direction" value={form.lane_direction} onChange={(e) => set('lane_direction', e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>

            <div>
              <label htmlFor="camera-radar" className="mb-1 block text-sm font-medium text-zinc-700">Radar asociado</label>
              <input id="camera-radar" value={form.radar_code} onChange={(e) => set('radar_code', e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>

            <div>
              <label htmlFor="camera-operator" className="mb-1 block text-sm font-medium text-zinc-700">Entidad operadora</label>
              <input id="camera-operator" value={form.operator_entity} onChange={(e) => set('operator_entity', e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>

            <div>
              <label htmlFor="camera-install-date" className="mb-1 block text-sm font-medium text-zinc-700">Fecha de instalación</label>
              <input id="camera-install-date" type="date" value={form.installation_date} onChange={(e) => set('installation_date', e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
            </div>

            <div>
              <label htmlFor="camera-calibration-date" className="mb-1 block text-sm font-medium text-zinc-700">Última calibración</label>
              <input id="camera-calibration-date" type="date" value={form.last_calibration_date} onChange={(e) => set('last_calibration_date', e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              {isCalibrationOverdue(form.last_calibration_date) && (
                <p className="mt-1 text-xs text-orange-600">
                  Supera el año de vigencia: al guardar, el sistema la categorizará como &quot;Descalibrada&quot; automáticamente (a menos que elijas otro estado manualmente).
                </p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="camera-address" className="mb-1 block text-sm font-medium text-zinc-700">Dirección</label>
            <input id="camera-address" value={form.address} onChange={(e) => set('address', e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label htmlFor="camera-description" className="mb-1 block text-sm font-medium text-zinc-700">Descripción</label>
            <textarea id="camera-description" rows={2} value={form.description} onChange={(e) => set('description', e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label htmlFor="camera-observations" className="mb-1 block text-sm font-medium text-zinc-700">Observaciones</label>
            <textarea id="camera-observations" rows={2} value={form.observations} onChange={(e) => set('observations', e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading}
              className="rounded-md bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
              {loading ? 'Guardando…' : 'Guardar cambios'}
            </button>
            <a href="/dashboard/cameras"
              className="rounded-md border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
              Cancelar
            </a>
          </div>
        </form>

        <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-sm font-semibold text-zinc-900">Certificado de calibración</h2>
          <p className="mb-4 text-xs text-zinc-500">PDF, JPG, PNG o WEBP, máx. 10MB.</p>

          {certificateUrl && (
            <a
              href={certificateUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-4 inline-block text-sm font-medium text-blue-600 hover:underline"
            >
              Ver certificado actual ↗
            </a>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              aria-label="Certificado de calibración"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={(e) => setCertificateFile(e.target.files?.[0] ?? null)}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 file:mr-3 file:rounded file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200"
            />
            <button
              type="button"
              onClick={handleUploadCertificate}
              disabled={!certificateFile || uploadingCertificate}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {uploadingCertificate ? 'Subiendo…' : certificateUrl ? 'Reemplazar certificado' : 'Subir certificado'}
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
