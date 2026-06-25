'use client'

import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Accesibilidad mínima para modales (CLAUDE.md, item "Bajo" #78): cierre con
 * `Escape` y focus trap (Tab/Shift+Tab no se escapan del modal mientras está
 * abierto). Se usa con el patrón de modal ya existente en el proyecto
 * (overlay `fixed inset-0` + panel) sin tener que reescribir su markup:
 *
 *   const panelRef = useModalA11y(showModal, closeModal)
 *   <div className="fixed inset-0 ...">
 *     <div ref={panelRef} role="dialog" aria-modal="true" className="...">
 *       ...
 *
 * Al abrirse, mueve el foco al primer elemento enfocable del panel; al
 * cerrarse, lo devuelve al elemento que tenía el foco antes de abrir el modal
 * (normalmente el botón que lo disparó).
 */
export function useModalA11y(isOpen: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isOpen) return

    previouslyFocused.current = document.activeElement as HTMLElement | null

    const panel = panelRef.current
    const focusables = panel?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    focusables?.[0]?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }

      if (e.key !== 'Tab' || !panelRef.current) return

      const nodes = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      if (nodes.length === 0) return

      const first = nodes[0]
      const last = nodes[nodes.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      previouslyFocused.current?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  return panelRef
}
