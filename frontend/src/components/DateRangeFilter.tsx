'use client'

import { useEffect, useRef, useState } from 'react'
import { DayPicker, type DateRange } from 'react-day-picker'
import 'react-day-picker/style.css'
import { es } from 'react-day-picker/locale'
import { IconCalendar } from '@tabler/icons-react'

export interface DateRangeFilterValue {
  from?: string // 'YYYY-MM-DD'
  to?: string // 'YYYY-MM-DD'
}

interface DateRangeFilterProps {
  value: DateRangeFilterValue
  onChange: (value: DateRangeFilterValue) => void
  label?: string
}

// 'YYYY-MM-DD' <-> Date a mediodía local: evita que el cambio de mes/día se corra por el
// redondeo de zona horaria que hace new Date('YYYY-MM-DD') al interpretarlo como UTC medianoche.
const toDate = (s?: string) => (s ? new Date(`${s}T12:00:00`) : undefined)
const toIso = (d?: Date) =>
  d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : undefined
const fmt = (s?: string) =>
  s ? new Date(`${s}T12:00:00`).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : undefined

// Selector de rango de fechas en un solo control (un botón que abre un calendario con
// selección "Desde–Hasta" en un clic), reemplaza el patrón de dos <input type="date">
// separados. Usado hoy solo en /dashboard/admin/audit; si un segundo módulo lo necesita,
// ya queda listo para reutilizar.
export default function DateRangeFilter({ value, onChange, label = 'Rango de fechas' }: DateRangeFilterProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  // react-day-picker en mode="range" fija from=to en el primer clic (un rango de un solo día
  // ya "completo"), así que no se puede usar "from y to definidos" para saber si el usuario
  // terminó de elegir. Contamos clics físicos en un día: el 1º fija el inicio y deja el
  // calendario abierto para poder extender el rango; el 2º (sea el mismo día de nuevo, para
  // un rango de un día, u otro distinto) cierra el calendario.
  const dayClicksRef = useRef(0)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open])

  const hasValue = Boolean(value.from || value.to)
  const range: DateRange | undefined = hasValue ? { from: toDate(value.from), to: toDate(value.to) } : undefined
  const display = hasValue ? `${fmt(value.from) ?? '…'} – ${fmt(value.to) ?? '…'}` : label

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { dayClicksRef.current = 0; setOpen((o) => !o) }}
        className="flex w-full items-center gap-2 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 focus:border-blue-500 focus:outline-none sm:w-auto"
      >
        <IconCalendar size={16} className="shrink-0 text-zinc-400" />
        <span className={hasValue ? '' : 'text-zinc-400'}>{display}</span>
      </button>

      {open && (
        <div
          className="absolute z-50 mt-2 rounded-lg border border-zinc-200 bg-white p-3 shadow-xl"
          style={{ '--rdp-accent-color': '#3b82f6', '--rdp-accent-background-color': '#eff6ff' } as React.CSSProperties}
        >
          <DayPicker
            mode="range"
            locale={es}
            selected={range}
            onSelect={(r) => {
              onChange({ from: toIso(r?.from), to: toIso(r?.to) })
              dayClicksRef.current += 1
              if (dayClicksRef.current >= 2) {
                setOpen(false)
                dayClicksRef.current = 0
              }
            }}
          />
          {hasValue && (
            <button
              type="button"
              onClick={() => { onChange({ from: undefined, to: undefined }); setOpen(false) }}
              className="mt-1 w-full rounded-md py-1.5 text-center text-xs font-medium text-blue-600 hover:bg-blue-50"
            >
              Limpiar rango
            </button>
          )}
        </div>
      )}
    </div>
  )
}
