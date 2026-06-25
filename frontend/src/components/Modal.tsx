'use client'

import { ReactNode } from 'react'
import { useModalA11y } from '@/hooks/useModalA11y'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  titleId: string
  title: ReactNode
  children: ReactNode
  maxWidthClassName?: string
  showCloseButton?: boolean
}

/**
 * Modal reutilizable (CLAUDE.md, item "Bajo" #77): centraliza el overlay
 * `fixed inset-0` + panel que estaba duplicado, casi textual, en cada página
 * con modales (señales, zonas, inspecciones, mantenimientos, mis
 * asignaciones, auditoría, usuarios). Incluye la accesibilidad ya resuelta
 * en el item #78 (`useModalA11y`: cierre con Escape, focus trap, ARIA
 * `role="dialog"`/`aria-modal`/`aria-labelledby`) para que cada página no
 * tenga que volver a aplicarla.
 */
export default function Modal({
  isOpen,
  onClose,
  titleId,
  title,
  children,
  maxWidthClassName = 'max-w-lg',
  showCloseButton = true,
}: ModalProps) {
  const panelRef = useModalA11y(isOpen, onClose)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4 py-6">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`max-h-[90vh] w-full ${maxWidthClassName} overflow-y-auto rounded-lg border border-zinc-200 bg-white p-6 shadow-xl`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 id={titleId} className="text-base font-semibold text-zinc-950">
            {title}
          </h3>
          {showCloseButton && (
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700" aria-label="Cerrar">
              ✕
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}
