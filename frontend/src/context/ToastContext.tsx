'use client'

import { createContext, useCallback, useContext, useRef, useState, ReactNode } from 'react'

export type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: number
  message: string
  type: ToastType
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

const AUTO_DISMISS_MS = 5000

const TOAST_STYLES: Record<ToastType, string> = {
  success: 'bg-green-50 border-green-300 text-green-800',
  error: 'bg-red-50 border-red-300 text-red-800',
  info: 'bg-blue-50 border-blue-300 text-blue-800',
}

const TOAST_ICON: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  info: 'i',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const idRef = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++idRef.current
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
  }, [dismiss])

  const value: ToastContextValue = {
    showToast,
    success: (message: string) => showToast(message, 'success'),
    error: (message: string) => showToast(message, 'error'),
    info: (message: string) => showToast(message, 'info'),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className={`flex items-start gap-2 rounded-lg border px-4 py-3 shadow-md text-sm animate-in ${TOAST_STYLES[t.type]}`}
          >
            <span className="font-bold">{TOAST_ICON[t.type]}</span>
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Cerrar"
              className="text-current opacity-60 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return ctx
}
