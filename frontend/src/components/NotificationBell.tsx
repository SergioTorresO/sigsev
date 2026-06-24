'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { api } from '@/lib/api'

interface Notification {
  id: string
  type: 'SIGNAL_BAD_STATUS' | 'MAINTENANCE_OVERDUE' | 'ASSIGNMENT'
  title: string
  message: string
  is_read: boolean
  created_at: string
  signals?: { id: string; signal_code: string; address: string | null } | null
  maintenances?: { id: string; description: string } | null
}

const POLL_INTERVAL_MS = 30 * 1000

const TYPE_STYLES: Record<Notification['type'], string> = {
  SIGNAL_BAD_STATUS: 'bg-rose-100 text-rose-700',
  MAINTENANCE_OVERDUE: 'bg-amber-100 text-amber-700',
  ASSIGNMENT: 'bg-emerald-100 text-emerald-700',
}

const TYPE_LABELS: Record<Notification['type'], string> = {
  SIGNAL_BAD_STATUS: 'Señal',
  MAINTENANCE_OVERDUE: 'Vencido',
  ASSIGNMENT: 'Asignación',
}

const formatRelativeTime = (iso: string) => {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'ahora'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  return `hace ${days} d`
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchUnreadCount = useCallback(() => {
    api.get<{ count: number }>('/api/notifications/unread-count')
      .then((r) => setUnreadCount(r.count))
      .catch(() => {})
  }, [])

  const fetchNotifications = useCallback(() => {
    setLoading(true)
    api.get<{ data: Notification[] }>('/api/notifications?limit=10')
      .then((r) => setNotifications(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchUnreadCount])

  useEffect(() => {
    if (open) fetchNotifications()
  }, [open, fetchNotifications])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleMarkRead = async (id: string) => {
    try {
      await api.patch(`/api/notifications/${id}/read`, {})
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
      setUnreadCount((c) => Math.max(0, c - 1))
    } catch {
      // silencioso — no es crítico si falla un marcado individual
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await api.patch('/api/notifications/read-all', {})
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch {
      // silencioso
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
        aria-label="Notificaciones"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.85 23.85 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-zinc-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
            <p className="text-sm font-semibold text-zinc-900">Notificaciones</p>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs font-medium text-emerald-700 hover:underline">
                Marcar todas como leídas
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && (
              <p className="px-4 py-6 text-center text-sm text-zinc-400">Cargando…</p>
            )}
            {!loading && notifications.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-zinc-400">No tienes notificaciones</p>
            )}
            {!loading && notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => !n.is_read && handleMarkRead(n.id)}
                className={`block w-full border-b border-zinc-50 px-4 py-3 text-left transition-colors last:border-b-0 ${
                  n.is_read ? 'bg-white' : 'bg-emerald-50/60 hover:bg-emerald-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TYPE_STYLES[n.type]}`}>
                    {TYPE_LABELS[n.type]}
                  </span>
                  <span className="text-[11px] text-zinc-400">{formatRelativeTime(n.created_at)}</span>
                </div>
                <p className="mt-1.5 text-sm font-medium text-zinc-900">{n.title}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{n.message}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
