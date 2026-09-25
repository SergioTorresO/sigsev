'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useRouter, usePathname } from 'next/navigation'
import Logo from './Logo'
import {
  IconHome,
  IconMap,
  IconAlertTriangle,
  IconBuildingCommunity,
  IconChecklist,
  IconClipboardCheck,
  IconTool,
  IconReceipt,
  IconUsers,
  IconHistory,
  IconCategory,
  IconLogout,
  IconMenu2,
  IconX,
  type Icon as TablerIcon,
} from '@tabler/icons-react'

// Iconos de Tabler Icons (@tabler/icons-react), uno por módulo del sidebar.
const NAV_ICONS: Record<string, TablerIcon> = {
  Dashboard: IconHome,
  'Mapa GIS': IconMap,
  Señales: IconAlertTriangle,
  Zonas: IconBuildingCommunity,
  'Mis asignaciones': IconChecklist,
  Inspecciones: IconClipboardCheck,
  Mantenimientos: IconTool,
  Reportes: IconReceipt,
  Usuarios: IconUsers,
  Auditoría: IconHistory,
  Catálogo: IconCategory,
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
  { label: 'Catálogo', href: '/dashboard/admin/catalogo' },
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
  // "Mis asignaciones" es exclusivo de TECNICO: ADMIN/SUPERVISOR no están en
  // ALLOWED_HREFS_BY_ROLE (ven todos los demás módulos sin filtrar), así que
  // se excluye aparte para no colarse en su sidebar.
  const visibleNavItems = (allowedHrefs
    ? navItems.filter((item) => allowedHrefs.includes(item.href))
    : navItems
  ).filter((item) => item.href !== '/dashboard/mis-asignaciones' || user?.roles?.name === 'TECNICO')

  // Marca/logo: mark real de SIGSEV + wordmark, reutilizado en drawer y sidebar de escritorio
  // (función simple, no componente, para no remontar estos nodos en cada re-render de Sidebar)
  const renderLogo = (collapsed = false) => (
    <div className="flex items-center gap-3 overflow-hidden whitespace-nowrap">
      <Logo className="h-9 w-9 shrink-0 rounded-lg shadow-lg shadow-blue-500/20" />
      <div className={collapsed ? 'hidden group-hover:block' : ''}>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-400/90">
          Inventario vial
        </p>
        <h1 className="-mt-0.5 text-xl font-bold text-white">SIGSEV</h1>
      </div>
    </div>
  )

  // Ítem de navegación: pill azul sólido cuando está activo, hover sutil en zinc cuando no
  const renderNavLink = (
    item: { label: string; href: string },
    isActive: boolean,
    collapsed = false,
  ) => {
    const ItemIcon = NAV_ICONS[item.label]
    return (
      <a
        key={item.label}
        href={item.href}
        title={collapsed ? item.label : undefined}
        className={`flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-medium whitespace-nowrap transition-all duration-150 ${
          isActive
            ? 'bg-blue-500 text-zinc-950 shadow-md shadow-blue-500/30'
            : 'text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-100'
        }`}
      >
        <ItemIcon size={20} className="shrink-0" />
        <span className={collapsed ? 'opacity-0 transition-opacity duration-150 group-hover:opacity-100' : ''}>
          {item.label}
        </span>
      </a>
    )
  }

  const renderProfileFooter = (collapsed = false) => (
    <div className="border-t border-zinc-800/80 pt-4">
      <a
        href="/dashboard/profile"
        title={collapsed ? user?.full_name : undefined}
        className={`flex items-center gap-3 overflow-hidden rounded-lg px-2 py-2 transition-colors hover:bg-zinc-800/70 ${
          pathname.startsWith('/dashboard/profile') ? 'bg-zinc-800/70' : ''
        }`}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-sm font-semibold text-zinc-950 shadow-md shadow-blue-500/20 ring-2 ring-zinc-800">
          {user?.full_name?.charAt(0).toUpperCase() ?? '?'}
        </div>
        <div className={`min-w-0 ${collapsed ? 'opacity-0 transition-opacity duration-150 group-hover:opacity-100' : ''}`}>
          <p className="truncate text-sm font-medium text-zinc-100">{user?.full_name}</p>
          <p className="truncate text-xs text-zinc-500">{user?.email}</p>
          <p className="mt-1 truncate text-[11px] font-semibold uppercase tracking-wide text-blue-400">
            {user?.roles?.name ?? 'Sin rol'}
          </p>
        </div>
      </a>
      <button
        onClick={handleLogout}
        title={collapsed ? 'Cerrar sesión' : undefined}
        className="mt-3 flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-zinc-800 px-2.5 py-2 text-xs font-medium text-zinc-400 transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300"
      >
        <IconLogout size={16} className="shrink-0" />
        <span className={collapsed ? 'hidden group-hover:inline' : ''}>Cerrar sesión</span>
      </button>
    </div>
  )

  return (
    <>
      {/* Barra superior móvil/tablet (<1024px) */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 text-white shadow-sm lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menú de navegación"
          className="flex h-9 w-9 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-white"
        >
          <IconMenu2 size={24} />
        </button>
        <span className="text-lg font-bold">SIGSEV</span>
        <span className="h-9 w-9" />
      </header>

      {/* Fondo oscuro tras el drawer móvil */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Drawer móvil/tablet: mismas opciones que el sidebar de escritorio, siempre expandido */}
      <aside
        className={`sidebar-scroll fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-y-auto border-r border-zinc-800 bg-zinc-950 px-5 py-6 text-white shadow-2xl transition-transform duration-200 ease-in-out lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-8 flex items-center justify-between">
          {renderLogo()}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar menú de navegación"
            className="flex h-9 w-9 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            <IconX size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-1">
          {visibleNavItems.map((item) => {
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href)
            return renderNavLink(item, isActive)
          })}
          {user?.roles?.name === 'ADMIN' && (
            <>
              <p className="mt-5 mb-1 truncate border-t border-zinc-800/80 px-2.5 pt-4 text-xs font-semibold uppercase tracking-widest text-zinc-500">
                Administración
              </p>
              {adminItems.map((item) => {
                const isActive = pathname.startsWith(item.href)
                return renderNavLink(item, isActive)
              })}
            </>
          )}
        </nav>

        {renderProfileFooter()}
      </aside>

      {/* Sidebar de escritorio (>=1024px): colapsado a iconos, se expande con hover */}
      <aside className="sidebar-scroll group fixed inset-y-0 left-0 z-40 hidden w-20 flex-col overflow-x-hidden overflow-y-auto border-r border-zinc-800 bg-zinc-950 px-3 py-6 text-white shadow-2xl shadow-black/30 transition-all duration-200 ease-in-out hover:w-64 hover:px-5 lg:flex">
      <div className="mb-10 overflow-hidden">
        {renderLogo(true)}
      </div>

      <nav className="flex-1 space-y-1 overflow-x-hidden">
        {visibleNavItems.map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href)
          return renderNavLink(item, isActive, true)
        })}
        {user?.roles?.name === 'ADMIN' && (
          <>
            <p className="mt-5 mb-1 truncate border-t border-zinc-800/80 px-2.5 pt-4 text-xs font-semibold uppercase tracking-widest text-zinc-500 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              Administración
            </p>
            {adminItems.map((item) => {
              const isActive = pathname.startsWith(item.href)
              return renderNavLink(item, isActive, true)
            })}
          </>
        )}
      </nav>

      {renderProfileFooter(true)}
    </aside>
    </>
  )
}
