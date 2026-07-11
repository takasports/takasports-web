'use client'

import { useEffect, useRef } from 'react'
import Header from './Header'
import BreakingNewsBar from './BreakingNewsBar'
import LiveStrip from './LiveStrip'

// Consola "La Señal": apila el Header y la franja de marcadores (LiveStrip) como
// un único bloque STICKY, de modo que el directo no se pierde al hacer scroll
// (antes el LiveStrip iba dentro del contenido de cada página y desaparecía al
// bajar). El Header se monta con sticky={false} porque es ESTE contenedor el que
// se fija al top; así Header + LiveStrip viajan juntos como una sola consola.
//
// Se usa solo en (public)/layout.tsx. home/calendario montan <Header /> directo
// (sticky propio, sin consola) = territorio del calendario, intacto.
//
// LiveStrip ya hace su propio autofetch del directo y se colapsa al bajar en
// móvil; dentro de la consola eso lo minimiza dejando el Header visible.
//
// BreakingNewsBar va sin props = modo autofetch (titulares de /api/articles,
// prioriza los "breaking"): aparece en TODA la web (public). Si no hay titulares
// devuelve null y no ocupa espacio. Orden Header → Última hora → Directo.
//
// --console-h: la consola publica su ALTURA REAL como variable CSS en <html>.
// Los sticky que viven bajo ella (p. ej. el filtro de deportes de /noticias) se
// anclan a `top: var(--console-h, 56px)` en vez de a un offset fijo — antes el
// filtro usaba top:56 y quedaba TAPADO por la consola (~132px y z superior) al
// hacer scroll. La altura es dinámica (breaking puede no estar; el directo se
// colapsa en móvil), por eso se mide con ResizeObserver y no se hardcodea. El
// fallback 56px cubre las rutas sin consola (hubs /futbol…, header simple).
export default function HeaderConsole() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const apply = () => {
      document.documentElement.style.setProperty('--console-h', `${el.offsetHeight}px`)
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => {
      ro.disconnect()
      document.documentElement.style.removeProperty('--console-h')
    }
  }, [])

  return (
    <div ref={ref} className="sticky top-0 z-50">
      <Header sticky={false} />
      <BreakingNewsBar />
      <LiveStrip />
    </div>
  )
}
