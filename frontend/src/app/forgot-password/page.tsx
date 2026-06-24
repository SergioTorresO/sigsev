'use client'

import { useState } from 'react'
import { api } from '@/lib/api'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await api.post<{ message: string }>(
        '/api/auth/forgot-password',
        { email },
        false
      )
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al solicitar el restablecimiento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100">
      <div className="flex w-[400px] flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">
            Inventario vial
          </p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-950">SIGSEV</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Ingresa tu correo y te enviaremos instrucciones para restablecer tu contraseña.
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        {sent ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
            <p>Si el correo existe en el sistema, se generó un enlace de recuperación.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="email"
              placeholder="Correo electrónico"
              className="rounded-md border border-zinc-300 p-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-emerald-600 p-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
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
