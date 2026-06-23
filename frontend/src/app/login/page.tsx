'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(email, password)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100">
      <form
        onSubmit={handleLogin}
        className="flex w-[400px] flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-8 shadow-sm"
      >
        <div className="mb-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">
            Inventario vial
          </p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-950">SIGSEV</h1>
        </div>

        {error && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        <input
          type="email"
          placeholder="Correo electrónico"
          className="rounded-md border border-zinc-300 p-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Contraseña"
          className="rounded-md border border-zinc-300 p-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-emerald-600 p-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>

        <p className="text-center text-sm text-zinc-500">
          <a href="/forgot-password" className="text-emerald-600 hover:underline">
            ¿Olvidaste tu contraseña?
          </a>
        </p>
      </form>
    </div>
  )
}
