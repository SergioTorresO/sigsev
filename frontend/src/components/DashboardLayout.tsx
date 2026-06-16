'use client'

import { ReactNode } from 'react'
import Sidebar from './Sidebar'

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
      <main className="lg:pl-20">
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
