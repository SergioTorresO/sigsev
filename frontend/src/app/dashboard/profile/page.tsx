'use client'

import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'

interface Profile {
  id: string
  full_name: string
  email: string
  phone: string | null
  municipality: string | null
  position: string | null
  roles: { name: string } | null
}

export default function ProfilePage() {
  const { updateUser } = useAuth()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [fetching, setFetching] = useState(true)
  const [fetchError, setFetchError] = useState('')

  const [infoForm, setInfoForm] = useState({ full_name: '', phone: '', municipality: '', position: '' })
  const [infoLoading, setInfoLoading] = useState(false)
  const [infoError, setInfoError] = useState('')
  const [infoSuccess, setInfoSuccess] = useState('')

  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState('')

  useEffect(() => {
    api.get<Profile>('/api/profile')
      .then((p) => {
        setProfile(p)
        setInfoForm({
          full_name: p.full_name,
          phone: p.phone ?? '',
          municipality: p.municipality ?? '',
          position: p.position ?? '',
        })
      })
      .catch((err) => setFetchError(err instanceof Error ? err.message : 'Error al cargar perfil'))
      .finally(() => setFetching(false))
  }, [])

  const handleInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setInfoError('')
    setInfoSuccess('')
    setInfoLoading(true)
    try {
      const updated = await api.put<Profile>('/api/profile', {
        full_name: infoForm.full_name,
        phone: infoForm.phone || undefined,
        municipality: infoForm.municipality || undefined,
        position: infoForm.position || undefined,
      })
      setProfile(updated)
      updateUser({ full_name: updated.full_name, phone: updated.phone, municipality: updated.municipality, position: updated.position })
      setInfoSuccess('Datos actualizados correctamente')
    } catch (err) {
      setInfoError(err instanceof Error ? err.message : 'Error al actualizar datos')
    } finally {
      setInfoLoading(false)
    }
  }

  const handlePwSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwError('')
    setPwSuccess('')

    if (pwForm.new_password !== pwForm.confirm_password) {
      setPwError('Las contraseñas no coinciden')
      return
    }

    setPwLoading(true)
    try {
      await api.put('/api/profile/password', {
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      })
      setPwSuccess('Contraseña actualizada correctamente')
      setPwForm({ current_password: '', new_password: '', confirm_password: '' })
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Error al cambiar contraseña')
    } finally {
      setPwLoading(false)
    }
  }

  if (fetching) {
    return (
      <DashboardLayout title="Mi perfil" subtitle="Cuenta">
        <div className="flex h-40 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Mi perfil" subtitle="Cuenta">
      {fetchError && (
        <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{fetchError}</div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Datos personales */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h3 className="mb-1 text-base font-semibold text-zinc-950">Datos personales</h3>
          <p className="mb-4 text-sm text-zinc-500">
            {profile?.email} · <span className="font-medium text-emerald-700">{profile?.roles?.name ?? 'Sin rol'}</span>
          </p>

          <form onSubmit={handleInfoSubmit} className="space-y-4">
            {infoError && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{infoError}</div>
            )}
            {infoSuccess && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{infoSuccess}</div>
            )}

            <div>
              <label htmlFor="profile-full-name" className="mb-1 block text-sm font-medium text-zinc-700">Nombre completo *</label>
              <input id="profile-full-name" required value={infoForm.full_name} onChange={(e) => setInfoForm((f) => ({ ...f, full_name: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            </div>
            <div>
              <label htmlFor="profile-phone" className="mb-1 block text-sm font-medium text-zinc-700">Teléfono</label>
              <input id="profile-phone" value={infoForm.phone} onChange={(e) => setInfoForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" placeholder="Opcional" />
            </div>
            <div>
              <label htmlFor="profile-municipality" className="mb-1 block text-sm font-medium text-zinc-700">Municipio</label>
              <input id="profile-municipality" value={infoForm.municipality} onChange={(e) => setInfoForm((f) => ({ ...f, municipality: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" placeholder="Opcional" />
            </div>
            <div>
              <label htmlFor="profile-position" className="mb-1 block text-sm font-medium text-zinc-700">Cargo</label>
              <input id="profile-position" value={infoForm.position} onChange={(e) => setInfoForm((f) => ({ ...f, position: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" placeholder="Opcional" />
            </div>

            <button type="submit" disabled={infoLoading}
              className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
              {infoLoading ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </form>
        </div>

        {/* Cambiar contraseña */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h3 className="mb-1 text-base font-semibold text-zinc-950">Cambiar contraseña</h3>
          <p className="mb-4 text-sm text-zinc-500">Asegúrate de usar una contraseña segura.</p>

          <form onSubmit={handlePwSubmit} className="space-y-4">
            {pwError && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{pwError}</div>
            )}
            {pwSuccess && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{pwSuccess}</div>
            )}

            <div>
              <label htmlFor="profile-current-password" className="mb-1 block text-sm font-medium text-zinc-700">Contraseña actual *</label>
              <input id="profile-current-password" required type="password" value={pwForm.current_password}
                onChange={(e) => setPwForm((f) => ({ ...f, current_password: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            </div>
            <div>
              <label htmlFor="profile-new-password" className="mb-1 block text-sm font-medium text-zinc-700">Nueva contraseña *</label>
              <input id="profile-new-password" required type="password" minLength={6} value={pwForm.new_password}
                onChange={(e) => setPwForm((f) => ({ ...f, new_password: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            </div>
            <div>
              <label htmlFor="profile-confirm-password" className="mb-1 block text-sm font-medium text-zinc-700">Confirmar nueva contraseña *</label>
              <input id="profile-confirm-password" required type="password" minLength={6} value={pwForm.confirm_password}
                onChange={(e) => setPwForm((f) => ({ ...f, confirm_password: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            </div>

            <button type="submit" disabled={pwLoading}
              className="rounded-md bg-zinc-900 px-5 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60">
              {pwLoading ? 'Actualizando…' : 'Actualizar contraseña'}
            </button>
          </form>
        </div>
      </div>
    </DashboardLayout>
  )
}
