// ─────────────────────────────────────────────────────────────────────────────
// Card — la superficie de tarjeta del sitio.
//
// El borde `rgba(255,255,255,0.05)` estaba escrito a mano 64 veces y el fondo
// `rgba(255,255,255,0.025)`, 86. Cada vez que hubiera que subir el contraste —y
// la auditoría de accesibilidad AA de la fase 2 lo va a pedir— había que
// buscarlos uno a uno.
//
// Tres superficies, las que ya existían de facto:
//   · `glass`  — la de las tarjetas de contenido (clase `.tk-glass`).
//   · `sutil`  — la fila discreta de listados y laterales.
//   · `solida` — sobre `--bg-card`, para bloques que se despegan del fondo.
// ─────────────────────────────────────────────────────────────────────────────

import type { CSSProperties, ReactNode } from 'react'

type Superficie = 'glass' | 'sutil' | 'solida'

// Literales, no `rounded-${radio}`: Tailwind escanea el fichero como TEXTO y una
// clase construida en tiempo de ejecución no llega a generarse nunca.
const RADIOS = { lg: 'rounded-lg', xl: 'rounded-xl', '2xl': 'rounded-2xl' } as const

const ESTILOS: Record<Superficie, CSSProperties> = {
  glass:  {},   // la pinta `.tk-glass` desde globals.css
  sutil:  { background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' },
  solida: { background: 'var(--bg-card)', border: '1px solid var(--border)' },
}

export default function Card({
  children,
  superficie = 'glass',
  radio = 'xl',
  interactiva = false,
  className = '',
  style,
}: {
  children: ReactNode
  superficie?: Superficie
  radio?: keyof typeof RADIOS
  /** Añade `.news-card` (elevación y borde morado al pasar por encima). */
  interactiva?: boolean
  className?: string
  style?: CSSProperties
}) {
  return (
    <div
      className={[
        RADIOS[radio],
        superficie === 'glass' ? 'tk-glass' : '',
        interactiva ? 'news-card' : '',
        className,
      ].filter(Boolean).join(' ')}
      style={{ ...ESTILOS[superficie], ...style }}
    >
      {children}
    </div>
  )
}
