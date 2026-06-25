'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'

interface Role { id: string; name: string; description: string | null }
interface User {
  id: string
  full_name: string
  email: string
  phone: string | null
  is_active: boolean
  municipality: string | null
  position: string | null
  created_at: string
  role_id: string | null
  roles: { id: string; name: string } | null
}
interface UsersResponse { data: User[]; total: number; page: number; limit: number }

const LIMIT = 15

const emptyForm = {
  full_name: '', email: '', password: '', phone: '',
  role_id: '', municipality: '', position: '',
}

export default function AdminUsersPage() {
  const { user } = useAuth()
  const router = useRouter()
  const toast = useToast()

  // Administración (gestión de usuarios) es exclusivo de ADMIN
  useEffect(() => {
    if (user && user.roles?.name !== 'ADMIN') router.replace('/dashboard')
  }, [user, router])

  const [users, setUsers] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [roles, setRoles] = useState<Role[]>([])

  // Create form
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState(emptyForm)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState('')

  // Edit modal
  const [editUser, setEditUser] = useState<User | null>(null)
  const [editForm, setEditForm] = useState({ full_name: '', phone: '', role_id: '', municipality: '', position: '', is_active: true })
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
      if (search) params.set('search', search)
      if (roleFilter) params.set('role_id', roleFilter)
      if (activeFilter !== '') params.set('is_active', activeFilter)
      const res = await api.get<UsersResponse>(`/api/users?${params}`)
      setUsers(res.data)
      setTotal(res.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar usuarios')
    } finally {
      setLoading(false)
    }
  }, [page, search, roleFilter, activeFilter])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  useEffect(() => {
    api.get<Role[]>('/api/users/roles').then(setRoles).catch(() => {})
  }, [])

  // Create
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError('')
    setCreateLoading(true)
    try {
      await api.post('/api/users', {
        ...createForm,
        phone: createForm.phone || undefined,
        role_id: createForm.role_id || undefined,
        municipality: createForm.municipality || undefined,
        position: createForm.position || undefined,
      })
      setShowCreate(false)
      setCreateForm(emptyForm)
      fetchUsers()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Error al crear usuario')
    } finally {
      setCreateLoading(false)
    }
  }

  // Edit
  const openEdit = (u: User) => {
    setEditUser(u)
    setEditForm({
      full_name: u.full_name,
      phone: u.phone ?? '',
      role_id: u.role_id ?? '',
      municipality: u.municipality ?? '',
      position: u.position ?? '',
      is_active: u.is_active,
    })
    setEditError('')
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editUser) return
    setEditError('')
    setEditLoading(true)
    try {
      await api.put(`/api/users/${editUser.id}`, {
        ...editForm,
        phone: editForm.phone || undefined,
        role_id: editForm.role_id || undefined,
        municipality: editForm.municipality || undefined,
        position: editForm.position || undefined,
      })
      setEditUser(null)
      fetchUsers()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Error al actualizar usuario')
    } finally {
      setEditLoading(false)
    }
  }

  // Toggle active
  const handleToggle = async (id: string) => {
    try {
      await api.patch(`/api/users/${id}/toggle-active`, {})
      fetchUsers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    }
  }

  // Delete
  const handleDelete = async () => {
    if (!deleteId) return
    setDeleteLoading(true)
    try {
      await api.delete(`/api/users/${deleteId}`)
      setDeleteId(null)
      fetchUsers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar usuario')
    } finally {
      setDeleteLoading(false)
    }
  }

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <DashboardLayout
      title="Gestión de usuarios"
      subtitle="Administración"
      actions={
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          {showCreate ? 'Cancelar' : '+ Nuevo usuario'}
        </button>
      }
    >
      {/* Create form */}
      {showCreate && (
        <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-zinc-950">Crear usuario</h3>
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
            {createError && (
              <div className="sm:col-span-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{createError}</div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Nombre completo *</label>
              <input required value={createForm.full_name} onChange={(e) => setCreateForm((f) => ({ ...f, full_name: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Correo *</label>
              <input required type="email" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Contraseña *</label>
              <input required type="password" value={createForm.password} onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Teléfono</label>
              <input value={createForm.phone} onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" placeholder="Opcional" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Rol</label>
              <select value={createForm.role_id} onChange={(e) => setCreateForm((f) => ({ ...f, role_id: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none">
                <option value="">Por defecto (CONSULTA)</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Municipio</label>
              <input value={createForm.municipality} onChange={(e) => setCreateForm((f) => ({ ...f, municipality: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" placeholder="Opcional" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Cargo</label>
              <input value={createForm.position} onChange={(e) => setCreateForm((f) => ({ ...f, position: e.target.value }))}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" placeholder="Opcional" />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" disabled={createLoading}
                className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                {createLoading ? 'Creando…' : 'Crear usuario'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text" placeholder="Buscar nombre o correo…" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none sm:w-56"
        />
        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1) }}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none sm:w-auto">
          <option value="">Todos los roles</option>
          {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select value={activeFilter} onChange={(e) => { setActiveFilter(e.target.value); setPage(1) }}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none sm:w-auto">
          <option value="">Todos</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-5 py-3">
          <span className="text-sm font-medium text-zinc-600">
            {loading ? 'Cargando…' : `${total} usuario${total !== 1 ? 's' : ''}`}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Nombre</th>
                <th className="px-5 py-3 font-semibold">Correo</th>
                <th className="px-5 py-3 font-semibold">Rol</th>
                <th className="px-5 py-3 font-semibold">Cargo</th>
                <th className="px-5 py-3 font-semibold">Estado</th>
                <th className="px-5 py-3 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-5 py-4"><div className="h-4 animate-pulse rounded bg-zinc-100" /></td>
                  ))}</tr>
                ))
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-zinc-400">No hay usuarios</td></tr>
              ) : users.map((u) => (
                <tr key={u.id} className="hover:bg-zinc-50">
                  <td className="px-5 py-4 font-medium text-zinc-950">{u.full_name}</td>
                  <td className="px-5 py-4 text-zinc-600">{u.email}</td>
                  <td className="px-5 py-4">
                    <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">
                      {u.roles?.name ?? '—'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-zinc-500">{u.position ?? '—'}</td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => handleToggle(u.id)}
                      className={`rounded-full px-2 py-1 text-xs font-semibold transition-colors ${
                        u.is_active
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                          : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                      }`}
                    >
                      {u.is_active ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEdit(u)}
                        className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => setDeleteId(u.id)}
                        className="rounded-md border border-rose-200 px-3 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-zinc-100 px-5 py-3">
            <span className="text-xs text-zinc-500">Página {page} de {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium disabled:opacity-40 hover:bg-zinc-50">Anterior</button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium disabled:opacity-40 hover:bg-zinc-50">Siguiente</button>
            </div>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg border border-zinc-200 bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-base font-semibold text-zinc-950">Editar usuario</h3>
            <form onSubmit={handleEdit} className="grid gap-4 sm:grid-cols-2">
              {editError && (
                <div className="sm:col-span-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{editError}</div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Nombre completo *</label>
                <input required value={editForm.full_name} onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Teléfono</label>
                <input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Rol</label>
                <select value={editForm.role_id} onChange={(e) => setEditForm((f) => ({ ...f, role_id: e.target.value }))}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none">
                  <option value="">Sin rol</option>
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Municipio</label>
                <input value={editForm.municipality} onChange={(e) => setEditForm((f) => ({ ...f, municipality: e.target.value }))}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Cargo</label>
                <input value={editForm.position} onChange={(e) => setEditForm((f) => ({ ...f, position: e.target.value }))}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-zinc-700">Estado</label>
                <button
                  type="button"
                  onClick={() => setEditForm((f) => ({ ...f, is_active: !f.is_active }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editForm.is_active ? 'bg-emerald-600' : 'bg-zinc-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${editForm.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                <span className="text-sm text-zinc-600">{editForm.is_active ? 'Activo' : 'Inactivo'}</span>
              </div>
              <div className="sm:col-span-2 flex gap-3 pt-2">
                <button type="submit" disabled={editLoading}
                  className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                  {editLoading ? 'Guardando…' : 'Guardar cambios'}
                </button>
                <button type="button" onClick={() => setEditUser(null)}
                  className="rounded-md border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-base font-semibold text-zinc-950">Eliminar usuario</h3>
            <p className="mb-5 text-sm text-zinc-600">Esta acción es permanente. ¿Deseas continuar?</p>
            <div className="flex gap-3">
              <button onClick={handleDelete} disabled={deleteLoading}
                className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60">
                {deleteLoading ? 'Eliminando…' : 'Eliminar'}
              </button>
              <button onClick={() => setDeleteId(null)}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
