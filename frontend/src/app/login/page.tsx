'use client'

import { useState } from 'react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleLogin = async (
    e: React.FormEvent
  ) => {
    e.preventDefault()

    try {
      const response = await fetch(
        'http://localhost:4000/api/auth/login',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            email: email.toLowerCase(),
            password,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        alert(data.message)
        return
      }

      localStorage.setItem(
        'token',
        data.token
      )

      alert('Login exitoso')

      window.location.href =
        '/dashboard'
    } catch (error) {
      console.error(error)

      alert('Error al iniciar sesión')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <form
        onSubmit={handleLogin}
        className="flex w-[400px] flex-col gap-4 rounded-lg border p-8"
      >
        <h1 className="text-2xl font-bold">
          Login SIGSEV
        </h1>

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

        <button className="bg-black text-white p-3 rounded">
          Ingresar
        </button>
      </form>
    </div>
  )
}