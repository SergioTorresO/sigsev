'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useRouter, usePathname } from 'next/navigation'

// Iconos en SVG inline (sin dependencias externas)
function Icon({ path, className = 'h-5 w-5' }: { path: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={path} />
    </svg>
  )
}

const ICONS: Record<string, string> = {
  Dashboard: 'M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
  'Mapa GIS': 'M9 4 3 6.5v14L9 18l6 2.5 6-2.5v-14L15 6.5 9 4Zm0 0v14m6-11.5v14',
  Señales: 'M12 2v6m0 0-7 12h14L12 8Zm-2.2 9h4.4',
  Zonas: 'M3 11l9-7 9 7M5 10v9h14v-9M9 19v-5h6v5',
  'Mis asignaciones': 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  Inspecciones: 'M9 11l2 2 4-4M5 5h14v15l-3-2-3 2-3-2-3 2V5Z',
  Mantenimientos: 'M14.7 6.3a4 4 0 1 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.83 2.83-2-2L14.7 6.3Z',
  Reportes: 'M7 3h7l3 3v15H7V3Zm7 0v3h3M9 13h6M9 17h6M9 9h2',
  Usuarios: 'M16 14a4 4 0 1 0-8 0M3 21a7 7 0 0 1 18 0M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  Auditoría: 'M9 12h6m-6 4h6M5 4h14v16l-4-3-3 2-3-2-4 3V4Z',
}

const navItems = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Mapa GIS', href: '/dashboard/mapa' },
  { label: 'Señales', href: '/dashboard/signals' },
  { label: 'Mis asignaciones', href: '/dashboard/mis-asignaciones' },
  { label: 'Zonas', href: '/dashboard/zonas' },
  { label: 'Inspecciones', href: '/dashboard/inspections' },
  { label: 'Mantenimientos', href: '/dashboard/maintenances' },
  { label: 'Reportes', href: '/dashboard/reportes' },
]

const adminItems = [
  { label: 'Usuarios', href: '/dashboard/admin/users' },
  { label: 'Auditoría', href: '/dashboard/admin/audit' },
]

// Sidebar global: colapsado a iconos (w-20), se expande al pasar el cursor (hover:w-64) en
// escritorio (>=1024px, breakpoint `lg`). Por debajo de ese ancho el hover no existe (touch),
// así que se muestra una barra superior con botón de menú que abre un drawer a pantalla completa
// con las mismas opciones, siempre con etiquetas visibles (sin depender de hover).
// Se usa en TODAS las páginas del dashboard, sin importar el rol del usuario.
export default function Sidebar() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Cierra el drawer móvil automáticamente al navegar a otra página
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const handleLogout = () => {
    setMobileOpen(false)
    logout()
    router.push('/login')
  }

  // Módulos visibles en el sidebar según rol:
  // - CONSULTA: Dashboard, Mapa GIS
  // - TECNICO: Dashboard, Mapa GIS, Señales, Mis asignaciones
  // - ADMIN / SUPERVISOR: todos (Dashboard, Mapa GIS, Señales, Zonas, Inspecciones, Mantenimientos, Reportes)
  const ALLOWED_HREFS_BY_ROLE: Record<string, string[]> = {
    CONSULTA: ['/dashboard', '/dashboard/mapa'],
    TECNICO: ['/dashboard', '/dashboard/mapa', '/dashboard/signals', '/dashboard/mis-asignaciones'],
  }
  const allowedHrefs = user?.roles?.name ? ALLOWED_HREFS_BY_ROLE[user.roles.name] : undefined
  const visibleNavItems = allowedHrefs
    ? navItems.filter((item) => allowedHrefs.includes(item.href))
    : navItems

  return (
    <>
      {/* Barra superior móvil/tablet (<1024px) */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-zinc-200 bg-zinc-950 px-4 text-white lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menú de navegación"
          className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-zinc-800"
        >
          <Icon path="M4 6h16M4 12h16M4 18h16" className="h-6 w-6" />
        </button>
        <span className="text-lg font-bold">SIGSEV</span>
        <span className="h-9 w-9" />
      </header>

      {/* Fondo oscuro tras el drawer móvil */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Drawer móvil/tablet: mismas opciones que el sidebar de escritorio, siempre expandido */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-y-auto border-r border-zinc-200 bg-zinc-950 px-5 py-6 text-white transition-transform duration-200 ease-in-out lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">
              Inventario vial
            </p>
            <h1 className="mt-1 text-2xl font-bold">SIGSEV</h1>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar menú de navegación"
            className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-zinc-800"
          >
            <Icon path="M6 6l12 12M18 6 6 18" className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1">
          {visibleNavItems.map((item) => {
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href)
            return (
              <a
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-white text-zinc-950' : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <Icon path={ICONS[item.label]} className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
              </a>
            )
          })}
          {user?.roles?.name === 'ADMIN' && (
            <>
              <p className="mt-4 truncate px-2.5 text-xs font-semibold uppercase tracking-widest text-zinc-500">
                Administración
              </p>
              {adminItems.map((item) => {
                const isActive = pathname.startsWith(item.href)
                return (
                  <a
                    key={item.label}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors ${
                      isActive ? 'bg-white text-zinc-950' : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                    }`}
                  >
                    <Icon path={ICONS[item.label]} className="h-5 w-5 shrink-0" />
                    <span>{item.label}</span>
                  </a>
                )
              })}
            </>
          )}
        </nav>

        <div className="border-t border-zinc-700 pt-4">
          <a
            href="/dashboard/profile"
            className={`flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-zinc-800 ${
              pathname.startsWith('/dashboard/profile') ? 'bg-zinc-800' : ''
            }`}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold">
              {user?.full_name?.charAt(0).toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{user?.full_name}</p>
              <p className="truncate text-xs text-zinc-400">{user?.email}</p>
              <p className="mt-1 truncate text-xs font-semibold text-emerald-400">
                {user?.roles?.name ?? 'Sin rol'}
              </p>
            </div>
          </a>
          <button
            onClick={handleLogout}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-zinc-600 px-2.5 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white"
          >
            <Icon path="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" className="h-4 w-4 shrink-0" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Sidebar de escritorio (>=1024px): colapsado a iconos, se expande con hover */}
      <aside className="group fixed inset-y-0 left-0 z-40 hidden w-20 flex-col overflow-x-hidden overflow-y-auto border-r border-zinc-200 bg-zinc-950 px-3 py-6 text-white transition-all duration-200 ease-in-out hover:w-64 hover:px-5 lg:flex">
      <div className="mb-10 overflow-hidden whitespace-nowrap">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          Inventario vial
        </p>
        <h1 className="mt-2 text-2xl font-bold">
          <span className="hidden group-hover:inline">SIGSEV</span>
          <span className="inline group-hover:hidden">SV</span>
        </h1>
      </div>

      <nav className="flex-1 space-y-1 overflow-x-hidden">
        {visibleNavItems.map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href)
          return (
            <a
              key={item.label}
              href={item.href}
              title={item.label}
              className={`flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-white text-zinc-950'
                  : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              <Icon path={ICONS[item.label]} className="h-5 w-5 shrink-0" />
              <span className="opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                {item.label}
              </span>
            </a>
          )
        })}
        {user?.roles?.name === 'ADMIN' && (
          <>
            <p className="mt-4 truncate px-2.5 text-xs font-semibold uppercase tracking-widest text-zinc-500 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              Administración
            </p>
            {adminItems.map((item) => {
              const isActive = pathname.startsWith(item.href)
              return (
                <a
                  key={item.label}
                  href={item.href}
                  title={item.label}
                  className={`flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-white text-zinc-950'
                      : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  <Icon path={ICONS[item.label]} className="h-5 w-5 shrink-0" />
                  <span className="opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                    {item.label}
                  </span>
                </a>
              )
            })}
          </>
        )}
      </nav>

      <div className="border-t border-zinc-700 pt-4">
        <a
          href="/dashboard/profile"
          title={user?.full_name}
          className={`flex items-center gap-3 overflow-hidden rounded-md px-2 py-2 transition-colors hover:bg-zinc-800 ${
            pathname.startsWith('/dashboard/profile') ? 'bg-zinc-800' : ''
          }`}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold">
            {user?.full_name?.charAt(0).toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            <p className="truncate text-sm font-medium text-white">{user?.full_name}</p>
            <p className="truncate text-xs text-zinc-400">{user?.email}</p>
            <p className="mt-1 truncate text-xs font-semibold text-emerald-400">
              {user?.roles?.name ?? 'Sin rol'}
            </p>
          </div>
        </a>
        <button
          onClick={handleLogout}
          title="Cerrar sesión"
          className="mt-3 flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-md border border-zinc-600 px-2.5 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white"
        >
          <Icon path="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" className="h-4 w-4 shrink-0" />
          <span className="hidden group-hover:inline">Cerrar sesión</span>
        </button>
      </div>
    </aside>
    </>
  )
}
