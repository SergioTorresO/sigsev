'use client'

import { ReactNode } from 'react'
import Sidebar from './Sidebar'
import NotificationBell from './NotificationBell'

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
  return (
    <div className="min-h-screen bg-zinc-100">
      <Sidebar />

      {/* Main */}
      <main className="pt-14 lg:pl-20 lg:pt-0">
        <header className="border-b border-zinc-200 bg-white">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-5 lg:px-8">
            <div>
              {subtitle && (
                <p className="text-sm font-medium text-emerald-700">{subtitle}</p>
              )}
              <h2 className="mt-1 text-xl font-bold text-zinc-950 sm:text-2xl">{title}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {actions}
              <NotificationBell />
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-5 sm:py-6 lg:px-8">{children}</div>
      </main>
    </div>
  )
}
