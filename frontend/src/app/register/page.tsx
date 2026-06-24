'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, ApiError } from '@/lib/api'

export default function RegisterPage() {
  const router = useRouter()
  const [full_name, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [municipality, setMunicipality] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Nota de seguridad: el registro público SIEMPRE crea el usuario con el
  // rol CONSULTA (el backend ignora cualquier role_id que se intente enviar
  // desde este formulario). Asignar roles con más privilegios es exclusivo
  // de un ADMIN autenticado desde /dashboard/admin/users.
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const data = await api.post<{ message: string }>(
        '/api/auth/register',
        { full_name, email, password, phone, municipality },
        false
      )

      alert(data.message)
      router.push('/login')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al registrar usuario')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <form
        onSubmit={handleRegister}
        className="flex w-[400px] flex-col gap-4 rounded-lg border p-8"
      >
        <h1 className="text-2xl font-bold">
          Registro SIGSEV
        </h1>

        {error && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        <input
          type="text"
          placeholder="Nombre completo"
          className="border p-3 rounded"
          value={full_name}
          onChange={(e) =>
            setFullName(e.target.value)
          }
        />

        <input
          type="email"
          placeholder="Correo"
          className="border p-3 rounded"
          value={email}
          onChange={(e) =>
            setEmail(e.target.value)
          }
        />

        <input
          type="password"
          placeholder="Contraseña"
          className="border p-3 rounded"
          value={password}
          onChange={(e) =>
            setPassword(e.target.value)
          }
        />

        <input
          type="text"
          placeholder="Teléfono"
          className="border p-3 rounded"
          value={phone}
          onChange={(e) =>
            setPhone(e.target.value)

          }
        />
        
        <input
          type="text"
          placeholder="Municipio"
          className="border p-3 rounded"
          value={municipality}
          onChange={(e) =>
            setMunicipality(e.target.value)
          }
        />

        <button
          type="submit"
          disabled={loading}
          className="bg-black text-white p-3 rounded disabled:opacity-60"
        >
          {loading ? 'Registrando…' : 'Registrarse'}
        </button>
      </form>
    </div>
  )
}