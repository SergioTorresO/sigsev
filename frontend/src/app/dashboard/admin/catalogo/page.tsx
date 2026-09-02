'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import Modal from '@/components/Modal'
import Pagination from '@/components/Pagination'

// ── Tipos ──────────────────────────────────────────────────────────────────
interface Category {
  id: string
  name: string
  description: string | null
  signal_types: [{ count: number }] | []
}

interface SignalType {
  id: string
  code: string
  name: string
  description: string | null
  category_id: string
  signal_categories: { id: string; name: string } | null
}

interface SignalTypesResponse {
  data: SignalType[]
  total: number
  page: number
  limit: number
}

const LIMIT = 15

// ── Página ─────────────────────────────────────────────────────────────────
export default function CatalogoPage() {
  const { user } = useAuth()
  const router = useRouter()
  const toast = useToast()

  // Solo ADMIN
  useEffect(() => {
    if (user && user.roles?.name !== 'ADMIN') router.replace('/dashboard')
  }, [user, router])

  // ── Pestaña activa ──────────────────────────────────────────────────────
  const [tab, setTab] = useState<'categories' | 'types'>('categories')

  // ── Estado: Categorías ──────────────────────────────────────────────────
  const [categories, setCategories] = useState<Category[]>([])
  const [catLoading, setCatLoading] = useState(true)

  const [catForm, setCatForm] = useState({ name: '', description: '' })
  const [editCat, setEditCat] = useState<Category | null>(null)
  const [deleteCatId, setDeleteCatId] = useState<string | null>(null)
  const [catSubmitting, setCatSubmitting] = useState(false)
  const [showCatForm, setShowCatForm] = useState(false)

  // ── Estado: Tipos de señal ──────────────────────────────────────────────
  const [signalTypes, setSignalTypes] = useState<SignalType[]>([])
  const [stTotal, setStTotal] = useState(0)
  const [stPage, setStPage] = useState(1)
  const [stSearch, setStSearch] = useState('')
  const [stCategoryFilter, setStCategoryFilter] = useState('')
  const [stLoading, setStLoading] = useState(true)

  const [stForm, setStForm] = useState({ code: '', name: '', description: '', category_id: '' })
  const [editSt, setEditSt] = useState<SignalType | null>(null)
  const [deleteStId, setDeleteStId] = useState<string | null>(null)
  const [stSubmitting, setStSubmitting] = useState(false)
  const [showStForm, setShowStForm] = useState(false)

  // ── Cargar categorías ───────────────────────────────────────────────────
  const fetchCategories = useCallback(async () => {
    setCatLoading(true)
    try {
      const data = await api.get<Category[]>('/catalog/categories')
      setCategories(data)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar categorías')
    } finally {
      setCatLoading(false)
    }
  }, [toast])

  // ── Cargar tipos de señal ───────────────────────────────────────────────
  const fetchSignalTypes = useCallback(async () => {
    setStLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(stPage),
        limit: String(LIMIT),
      })
      if (stSearch) params.set('search', stSearch)
      if (stCategoryFilter) params.set('category_id', stCategoryFilter)
      const data = await api.get<SignalTypesResponse>(`/catalog/signal-types?${params}`)
      setSignalTypes(data.data)
      setStTotal(data.total)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar tipos de señal')
    } finally {
      setStLoading(false)
    }
  }, [stPage, stSearch, stCategoryFilter, toast])

  useEffect(() => { fetchCategories() }, [fetchCategories])
  useEffect(() => { fetchSignalTypes() }, [fetchSignalTypes])

  // Reset página al cambiar filtros
  useEffect(() => { setStPage(1) }, [stSearch, stCategoryFilter])

  // ── CRUD Categorías ─────────────────────────────────────────────────────
  const openNewCat = () => {
    setCatForm({ name: '', description: '' })
    setEditCat(null)
    setShowCatForm(true)
  }

  const openEditCat = (cat: Category) => {
    setCatForm({ name: cat.name, description: cat.description ?? '' })
    setEditCat(cat)
    setShowCatForm(true)
  }

  const submitCat = async (e: React.FormEvent) => {
    e.preventDefault()
    setCatSubmitting(true)
    try {
      if (editCat) {
        await api.put(`/catalog/categories/${editCat.id}`, catForm)
        toast.success('Categoría actualizada')
      } else {
        await api.post('/catalog/categories', catForm)
        toast.success('Categoría creada')
      }
      setShowCatForm(false)
      fetchCategories()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setCatSubmitting(false)
    }
  }

  const confirmDeleteCat = async () => {
    if (!deleteCatId) return
    try {
      await api.delete(`/catalog/categories/${deleteCatId}`)
      toast.success('Categoría eliminada')
      setDeleteCatId(null)
      fetchCategories()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar')
      setDeleteCatId(null)
    }
  }

  // ── CRUD Tipos de señal ─────────────────────────────────────────────────
  const openNewSt = () => {
    setStForm({ code: '', name: '', description: '', category_id: '' })
    setEditSt(null)
    setShowStForm(true)
  }

  const openEditSt = (st: SignalType) => {
    setStForm({
      code: st.code,
      name: st.name,
      description: st.description ?? '',
      category_id: st.category_id,
    })
    setEditSt(st)
    setShowStForm(true)
  }

  const submitSt = async (e: React.FormEvent) => {
    e.preventDefault()
    setStSubmitting(true)
    try {
      if (editSt) {
        await api.put(`/catalog/signal-types/${editSt.id}`, stForm)
        toast.success('Tipo de señal actualizado')
      } else {
        await api.post('/catalog/signal-types', stForm)
        toast.success('Tipo de señal creado')
      }
      setShowStForm(false)
      fetchSignalTypes()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setStSubmitting(false)
    }
  }

  const confirmDeleteSt = async () => {
    if (!deleteStId) return
    try {
      await api.delete(`/catalog/signal-types/${deleteStId}`)
      toast.success('Tipo de señal eliminado')
      setDeleteStId(null)
      fetchSignalTypes()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar')
      setDeleteStId(null)
    }
  }

  const stTotalPages = Math.ceil(stTotal / LIMIT)

  const getCatCount = (cat: Category) => {
    if (!cat.signal_types || cat.signal_types.length === 0) return 0
    return (cat.signal_types[0] as { count: number }).count ?? 0
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <DashboardLayout title="Catálogo de señales" subtitle="Administración">
      <div className="space-y-6">
        {/* Pestañas */}
        <div className="border-b border-zinc-200">
          <nav className="-mb-px flex gap-6">
            <button
              onClick={() => setTab('categories')}
              className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                tab === 'categories'
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700'
              }`}
            >
              Categorías
            </button>
            <button
              onClick={() => setTab('types')}
              className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                tab === 'types'
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700'
              }`}
            >
              Tipos de señal
            </button>
          </nav>
        </div>

        {/* ── Tab: Categorías ─────────────────────────────────────────── */}
        {tab === 'categories' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={openNewCat}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                + Nueva categoría
              </button>
            </div>

            {catLoading ? (
              <p className="py-10 text-center text-sm text-zinc-500">Cargando...</p>
            ) : categories.length === 0 ? (
              <p className="py-10 text-center text-sm text-zinc-500">Sin categorías registradas</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-zinc-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      <th className="px-4 py-3">Nombre</th>
                      <th className="px-4 py-3">Descripción</th>
                      <th className="px-4 py-3 text-center">Tipos</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {categories.map((cat) => (
                      <tr key={cat.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3 font-medium text-zinc-900">{cat.name}</td>
                        <td className="px-4 py-3 text-zinc-600">{cat.description ?? '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center justify-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                            {getCatCount(cat)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => openEditCat(cat)}
                              className="rounded px-2.5 py-1 text-xs font-medium text-zinc-600 ring-1 ring-zinc-300 hover:bg-zinc-100"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => setDeleteCatId(cat.id)}
                              className="rounded px-2.5 py-1 text-xs font-medium text-red-600 ring-1 ring-red-300 hover:bg-red-50"
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
            )}
          </div>
        )}

        {/* ── Tab: Tipos de señal ─────────────────────────────────────── */}
        {tab === 'types' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                placeholder="Buscar por código o nombre..."
                value={stSearch}
                onChange={(e) => setStSearch(e.target.value)}
                className="w-64 rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
              <select
                value={stCategoryFilter}
                onChange={(e) => setStCategoryFilter(e.target.value)}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              >
                <option value="">Todas las categorías</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                onClick={openNewSt}
                className="ml-auto rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                + Nuevo tipo
              </button>
            </div>

            {stLoading ? (
              <p className="py-10 text-center text-sm text-zinc-500">Cargando...</p>
            ) : signalTypes.length === 0 ? (
              <p className="py-10 text-center text-sm text-zinc-500">Sin tipos de señal registrados</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-zinc-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      <th className="px-4 py-3">Código</th>
                      <th className="px-4 py-3">Nombre</th>
                      <th className="px-4 py-3">Categoría</th>
                      <th className="px-4 py-3">Descripción</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {signalTypes.map((st) => (
                      <tr key={st.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3">
                          <span className="inline-block rounded bg-zinc-100 px-2 py-0.5 font-mono text-xs font-semibold text-zinc-800">
                            {st.code}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-zinc-900">{st.name}</td>
                        <td className="px-4 py-3 text-zinc-600">
                          {st.signal_categories?.name ?? '—'}
                        </td>
                        <td className="max-w-xs px-4 py-3 text-zinc-500">
                          <span className="line-clamp-2">{st.description ?? '—'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => openEditSt(st)}
                              className="rounded px-2.5 py-1 text-xs font-medium text-zinc-600 ring-1 ring-zinc-300 hover:bg-zinc-100"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => setDeleteStId(st.id)}
                              className="rounded px-2.5 py-1 text-xs font-medium text-red-600 ring-1 ring-red-300 hover:bg-red-50"
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
            )}

            <Pagination page={stPage} totalPages={stTotalPages} onPageChange={setStPage} />
          </div>
        )}
      </div>

      {/* ── Modal: Formulario categoría ─────────────────────────────────── */}
      <Modal
        isOpen={showCatForm}
        onClose={() => setShowCatForm(false)}
        titleId="cat-form-title"
        title={editCat ? 'Editar categoría' : 'Nueva categoría'}
        maxWidthClassName="max-w-md"
      >
        <form onSubmit={submitCat} className="space-y-4">
          <div>
            <label htmlFor="cat-name" className="block text-sm font-medium text-zinc-700">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              id="cat-name"
              type="text"
              required
              value={catForm.name}
              onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              placeholder="Ej: Señales reglamentarias"
            />
          </div>
          <div>
            <label htmlFor="cat-desc" className="block text-sm font-medium text-zinc-700">
              Descripción
            </label>
            <textarea
              id="cat-desc"
              rows={3}
              value={catForm.description}
              onChange={(e) => setCatForm((f) => ({ ...f, description: e.target.value }))}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              placeholder="Descripción opcional de la categoría"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowCatForm(false)}
              className="rounded-md px-4 py-2 text-sm font-medium text-zinc-700 ring-1 ring-zinc-300 hover:bg-zinc-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={catSubmitting}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {catSubmitting ? 'Guardando...' : editCat ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: Confirmar eliminar categoría ─────────────────────────── */}
      <Modal
        isOpen={!!deleteCatId}
        onClose={() => setDeleteCatId(null)}
        titleId="delete-cat-title"
        title="Eliminar categoría"
        maxWidthClassName="max-w-sm"
        showCloseButton={false}
      >
        <p className="text-sm text-zinc-600">
          ¿Seguro que quieres eliminar esta categoría? Solo se puede eliminar si no tiene tipos de señal asociados.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={() => setDeleteCatId(null)}
            className="rounded-md px-4 py-2 text-sm font-medium text-zinc-700 ring-1 ring-zinc-300 hover:bg-zinc-50"
          >
            Cancelar
          </button>
          <button
            onClick={confirmDeleteCat}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Eliminar
          </button>
        </div>
      </Modal>

      {/* ── Modal: Formulario tipo de señal ────────────────────────────── */}
      <Modal
        isOpen={showStForm}
        onClose={() => setShowStForm(false)}
        titleId="st-form-title"
        title={editSt ? 'Editar tipo de señal' : 'Nuevo tipo de señal'}
        maxWidthClassName="max-w-lg"
      >
        <form onSubmit={submitSt} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="st-code" className="block text-sm font-medium text-zinc-700">
                Código <span className="text-red-500">*</span>
              </label>
              <input
                id="st-code"
                type="text"
                required
                value={stForm.code}
                onChange={(e) => setStForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm focus:border-emerald-500 focus:outline-none"
                placeholder="Ej: SR-01"
              />
            </div>
            <div>
              <label htmlFor="st-cat" className="block text-sm font-medium text-zinc-700">
                Categoría <span className="text-red-500">*</span>
              </label>
              <select
                id="st-cat"
                required
                value={stForm.category_id}
                onChange={(e) => setStForm((f) => ({ ...f, category_id: e.target.value }))}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              >
                <option value="">Seleccionar...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="st-name" className="block text-sm font-medium text-zinc-700">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              id="st-name"
              type="text"
              required
              value={stForm.name}
              onChange={(e) => setStForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              placeholder="Ej: Pare"
            />
          </div>
          <div>
            <label htmlFor="st-desc" className="block text-sm font-medium text-zinc-700">
              Descripción
            </label>
            <textarea
              id="st-desc"
              rows={3}
              value={stForm.description}
              onChange={(e) => setStForm((f) => ({ ...f, description: e.target.value }))}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              placeholder="Descripción opcional del tipo de señal"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowStForm(false)}
              className="rounded-md px-4 py-2 text-sm font-medium text-zinc-700 ring-1 ring-zinc-300 hover:bg-zinc-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={stSubmitting}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {stSubmitting ? 'Guardando...' : editSt ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: Confirmar eliminar tipo de señal ─────────────────────── */}
      <Modal
        isOpen={!!deleteStId}
        onClose={() => setDeleteStId(null)}
        titleId="delete-st-title"
        title="Eliminar tipo de señal"
        maxWidthClassName="max-w-sm"
        showCloseButton={false}
      >
        <p className="text-sm text-zinc-600">
          ¿Seguro que quieres eliminar este tipo de señal? Solo se puede eliminar si ninguna señal lo está usando.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={() => setDeleteStId(null)}
            className="rounded-md px-4 py-2 text-sm font-medium text-zinc-700 ring-1 ring-zinc-300 hover:bg-zinc-50"
          >
            Cancelar
          </button>
          <button
            onClick={confirmDeleteSt}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Eliminar
          </button>
        </div>
      </Modal>
    </DashboardLayout>
  )
}
