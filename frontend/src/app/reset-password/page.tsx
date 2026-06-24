'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!token) {
      setError('Enlace inválido o incompleto')
      return
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)

    try {
      await api.post('/api/auth/reset-password', { token, password }, false)
      setSuccess(true)
      setTimeout(() => router.push('/login'), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al restablecer la contraseña')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100 p-4">
      <div className="flex w-full max-w-[400px] flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">
            Inventario vial
          </p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-950">SIGSEV</h1>
          <p className="mt-2 text-sm text-zinc-500">Define tu nueva contraseña.</p>
        </div>

        {error && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        {success ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Contraseña actualizada. Redirigiendo al inicio de sesión...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="password"
              placeholder="Nueva contraseña"
              className="rounded-md border border-zinc-300 p-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />

            <input
              type="password"
              placeholder="Confirmar contraseña"
              className="rounded-md border border-zinc-300 p-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={6}
              required
            />

            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-emerald-600 p-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {loading ? 'Guardando...' : 'Restablecer contraseña'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-zinc-500">
          <a href="/login" className="text-emerald-600 hover:underline">
            Volver a iniciar sesión
          </a>
        </p>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  )
}
