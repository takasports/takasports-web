// ─────────────────────────────────────────────────────────────────────────────
// SectionHeader — el rótulo de sección del sitio: acento vertical + título en
// versalitas, y opcionalmente algo alineado a la derecha («Ver todos →», una
// cuenta, una fecha).
//
// Las clases `.section-accent` y `.section-label` ya existían, pero el ENVOLTORIO
// estaba escrito a mano 60 veces en 45 ficheros, con seis variantes de margen y
// dos de hueco. Cuando el diseño del rótulo cambie —y en la fase 2 va a
// cambiar— habría que tocar 45 sitios.
//
// Server component: no necesita estado.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReactNode } from 'react'

export default function SectionHeader({
  children,
  as: Tag = 'h2',
  id,
  accent,
  action,
  className = 'mb-4',
}: {
  children: ReactNode
  /** El nivel importa para lectores de pantalla y para Google: cada pantalla
   *  conserva el que ya tenía en vez de imponer `h2` a todas. */
  as?: 'h2' | 'h3' | 'p'
  /** Para `aria-labelledby` de la sección que encabeza. */
  id?: string
  /** Acento del deporte. Por defecto, el morado de marca. */
  accent?: string
  /** Contenido alineado a la derecha. */
  action?: ReactNode
  /** Solo el margen/hueco; el resto de la maqueta la pone el componente. */
  className?: string
}) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span className="section-accent" style={accent ? { background: accent } : undefined} />
      <Tag id={id} className="section-label">{children}</Tag>
      {action ? <div className="ml-auto flex items-center gap-2">{action}</div> : null}
    </div>
  )
}
