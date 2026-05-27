'use client'

import { useState } from 'react'

export default function RegisterPage() {
  const [full_name, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [role_id, setRoleId] = useState('')
  const [municipality, setMunicipality] = useState('')

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const response = await fetch(
        'http://localhost:4000/api/auth/register',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            full_name,
            email,
            password,
            phone,
            role_id,
            municipality
          }),
        }
      )

      const data = await response.json()

      alert(data.message)

      setFullName('')
      setEmail('')
      setPassword('')
      setPhone('')
      setMunicipality('')
      setRoleId('')
      
      console.log(data)
    } catch (error) {
      console.error(error)
      alert('Error al registrar usuario')
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

        <select
          className="border p-3 rounded"
          value={role_id}
          onChange={(e) =>
            setRoleId(e.target.value)
          }
        >
          <option value="">
            Seleccione un cargo
          </option>

          <option value="0206a6f2-b90f-4956-bff6-3886077979ae">
            ADMIN
          </option>

          <option value="623cfb5b-6e4f-4d6d-a741-21ff56a2f4ab">
            CONSULTA
          </option>

          <option value="6d1fd36a-fd77-4209-a5c2-24768ae56503">
            SUPERVISOR
          </option>

          <option value="cc1134c7-681e-494d-a617-3d0dbf5dee96">
            TECNICO
          </option>
        </select>

        <button
          type="submit"
          className="bg-black text-white p-3 rounded"
        >
          Registrarse
        </button>
      </form>
    </div>
  )
}