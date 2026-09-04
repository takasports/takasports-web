// ─────────────────────────────────────────────────────────────────────────────
// Pill — la etiqueta corta en versalitas: deporte, estado, «Nuevo», «En directo».
//
// `font-black uppercase tracking-widest` aparece 433 veces en el repo con quince
// tamaños distintos. Esto no pretende reemplazarlas todas de golpe —sería un
// diff imposible de revisar— sino fijar la forma correcta para lo nuevo y para
// lo que se vaya tocando.
//
// Dos formas:
//   · `tono="acento"` — teñida del color que se le pase (deporte, estado).
//   · `tono="neutro"` — gris, para metadatos.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReactNode } from 'react'

const TAMANOS = {
  xs: 'text-[8px] px-1.5 py-0.5',
  sm: 'text-[9px] px-2 py-0.5',
  md: 'text-[10px] px-2.5 py-1',
} as const

export default function Pill({
  children,
  color = '#7C3AED',
  tono = 'acento',
  tamano = 'sm',
  redonda = true,
  className = '',
}: {
  children: ReactNode
  color?: string
  tono?: 'acento' | 'neutro'
  tamano?: keyof typeof TAMANOS
  redonda?: boolean
  className?: string
}) {
  const acento = tono === 'acento'
  return (
    <span
      className={`inline-flex items-center gap-1 font-black uppercase tracking-widest whitespace-nowrap ${TAMANOS[tamano]} ${redonda ? 'rounded-full' : 'rounded'} ${className}`}
      style={{
        fontFamily: 'var(--font-sport)',
        background: acento ? `${color}1F` : 'rgba(255,255,255,0.05)',
        color: acento ? color : 'var(--text-muted)',
        border: `1px solid ${acento ? `${color}45` : 'rgba(255,255,255,0.08)'}`,
      }}
    >
      {children}
    </span>
  )
}
