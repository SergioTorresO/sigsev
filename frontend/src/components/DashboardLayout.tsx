'use client'

import { useAuth } from '@/context/AuthContext'
import { useRouter, usePathname } from 'next/navigation'
import { ReactNode } from 'react'

const navItems = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Mapa GIS', href: '/dashboard/mapa' },
  { label: 'Señales', href: '/dashboard/signals' },
  { label: 'Inspecciones', href: '/dashboard/inspections' },
  { label: 'Mantenimientos', href: '/dashboard/maintenances' },
  { label: 'Reportes', href: '/dashboard/reportes' },
]

const adminItems = [
  { label: 'Usuarios', href: '/dashboard/admin/users' },
]

interface DashboardLayoutProps {
  children: ReactNode
  title: string
  subtitle?: string
  actions?: ReactNode
}

export default function DashboardLayout({
  children,
  title,
  subtitle,
  actions,
}: DashboardLayoutProps) {
  const { user, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-zinc-100">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-zinc-200 bg-zinc-950 px-5 py-6 text-white lg:flex lg:flex-col">
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">
            Inventario vial
          </p>
          <h1 className="mt-2 text-2xl font-bold">SIGSEV</h1>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href)
            return (
              <a
                key={item.label}
                href={item.href}
                className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white text-zinc-950'
                    : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                {item.label}
              </a>
            )
          })}
          {user?.roles?.name === 'ADMIN' && (
            <>
              <p className="mt-4 px-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">Administración</p>
              {adminItems.map((item) => {
                const isActive = pathname.startsWith(item.href)
                return (
                  <a
                    key={item.label}
                    href={item.href}
                    className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-white text-zinc-950'
                        : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </a>
                )
              })}
            </>
          )}
        </nav>

        <div className="border-t border-zinc-700 pt-4">
          <a
            href="/dashboard/profile"
            className={`block rounded-md px-2 py-2 transition-colors hover:bg-zinc-800 ${
              pathname.startsWith('/dashboard/profile') ? 'bg-zinc-800' : ''
            }`}
          >
            <p className="truncate text-sm font-medium text-white">{user?.full_name}</p>
            <p className="truncate text-xs text-zinc-400">{user?.email}</p>
            <p className="mt-1 text-xs font-semibold text-emerald-400">
              {user?.roles?.name ?? 'Sin rol'}
            </p>
          </a>
          <button
            onClick={handleLogout}
            className="mt-3 w-full rounded-md border border-zinc-600 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="lg:pl-64">
        <header className="border-b border-zinc-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
            <div>
              {subtitle && (
                <p className="text-sm font-medium text-emerald-700">{subtitle}</p>
              )}
              <h2 className="mt-1 text-2xl font-bold text-zinc-950">{title}</h2>
            </div>
            {actions && <div className="flex gap-3">{actions}</div>}
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-5 py-6 lg:px-8">{children}</div>
      </main>
    </div>
  )
}
