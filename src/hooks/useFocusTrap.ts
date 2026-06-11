import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface FocusTrapOptions {
  /** Enfocar el primer elemento al activar (default: true). Pásalo a false si el contenedor ya gestiona su foco inicial. */
  initialFocus?: boolean
  /** Cerrar con Escape (default: true). Pásalo a false si el contenedor ya tiene su propio handler de Escape. */
  escape?: boolean
  /** Elemento al que devolver el foco al cerrar (default: el que tenía el foco antes de abrir). */
  returnRef?: RefObject<HTMLElement | null>
}

/**
 * Atrapa el foco del teclado dentro de `containerRef` mientras `active` sea true.
 * - Tab / Shift+Tab ciclan dentro del contenedor (no se escapan al fondo de la página).
 * - Escape llama a onClose (salvo escape: false).
 * - Al cerrar/desmontar devuelve el foco al disparador (returnRef o el elemento que lo tenía antes).
 *
 * 0 KB de dependencias: solo manejo de foco con la API nativa del navegador.
 * Patrón WAI-ARIA para diálogos modales y menús desplegables.
 */
export function useFocusTrap(
  active: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  opts?: FocusTrapOptions,
) {
  const initialFocus = opts?.initialFocus ?? true
  const escape = opts?.escape ?? true
  const returnRef = opts?.returnRef
  const prevFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!active) return
    const container = containerRef.current
    if (!container) return
    prevFocused.current = (document.activeElement as HTMLElement) ?? null

    const focusable = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        .filter((el) => el.offsetParent !== null)

    if (initialFocus) {
      const els = focusable()
      ;(els[0] ?? container).focus()
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (escape && e.key === 'Escape') { e.preventDefault(); onClose(); return }
      if (e.key !== 'Tab') return
      const els = focusable()
      if (els.length === 0) return
      const first = els[0]
      const last = els[els.length - 1]
      const current = document.activeElement as HTMLElement
      if (e.shiftKey && (current === first || !container.contains(current))) {
        e.preventDefault(); last.focus()
      } else if (!e.shiftKey && (current === last || !container.contains(current))) {
        e.preventDefault(); first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      const ret = returnRef?.current ?? prevFocused.current
      if (ret && document.contains(ret)) ret.focus()
    }
  }, [active, containerRef, onClose, initialFocus, escape, returnRef])
}
