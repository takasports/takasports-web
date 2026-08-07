'use client'

import type { ReactNode } from 'react'
import type { SoccerTheme } from './types'

// Botón de tendencia (L / X / V). Extraído del cliente del Mundial, que lo
// tenía cableado a la paleta dorada y a un emoji de bandera; aquí el acento
// llega por tema y el visual del equipo por slot, para que sirva a clubes.

export default function PickButton({
  label, visual, sublabel, ariaLabel, active, correct, wrong, disabled, theme, onClick,
}: {
  /** La tendencia: 1 · X · 2. Es la marca del boleto, y va grande. */
  label: string
  /** Escudo opcional. Se retiró de los botones: entre el escudo, "LOCAL" y el
   *  nombre del equipo eran tres líneas por botón y la fila de picks se comía
   *  media tarjeta. El escudo ya está, grande, en el enfrentamiento de arriba. */
  visual?: ReactNode
  sublabel?: string
  /** Nombre accesible: "1" a secas no dice nada a un lector de pantalla. */
  ariaLabel?: string
  active: boolean
  correct: boolean
  wrong: boolean
  disabled: boolean
  theme: SoccerTheme
  onClick: () => void
}) {
  let bg     = 'rgba(255,255,255,0.05)'
  let border = 'rgba(255,255,255,0.12)'
  let color  = 'rgba(255,255,255,0.55)'
  let sub    = 'rgba(255,255,255,0.25)'
  let shadow = 'none'
  let visualOp = 0.65

  if (correct) {
    bg     = 'linear-gradient(145deg, rgba(74,222,128,0.18) 0%, rgba(34,197,94,0.10) 100%)'
    border = 'rgba(74,222,128,0.5)'; color = '#4ADE80'; sub = 'rgba(74,222,128,0.7)'
    shadow = '0 0 20px rgba(74,222,128,0.15)'; visualOp = 1
  } else if (wrong) {
    bg     = 'rgba(239,68,68,0.08)'
    border = 'rgba(239,68,68,0.3)'; color = 'rgba(239,68,68,0.55)'; sub = 'rgba(239,68,68,0.4)'
    visualOp = 0.4
  } else if (active) {
    bg     = `linear-gradient(145deg, ${theme.accent}28 0%, ${theme.accent}14 100%)`
    border = `${theme.accent}80`; color = theme.accent; sub = theme.accentDim
    shadow = `0 0 18px ${theme.accent}22`; visualOp = 1
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={ariaLabel}
      style={{
        flex: 1, minWidth: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        padding: '9px 6px', borderRadius: 'var(--radius-md)',
        background: bg, border: `1px solid ${border}`, boxShadow: shadow,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled && !active && !correct && !wrong ? 0.55 : 1,
        transition: 'background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
      }}
    >
      {visual && <span style={{ opacity: visualOp, lineHeight: 1, display: 'inline-flex' }}>{visual}</span>}
      <span style={{
        fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 900,
        color, letterSpacing: '0.02em', lineHeight: 1,
      }}>{label}</span>
      {sublabel && (
        <span style={{
          fontFamily: 'var(--font-sport)', fontSize: 9, fontWeight: 700,
          color: sub, lineHeight: 1.2, textAlign: 'center',
          maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{sublabel}</span>
      )}
    </button>
  )
}
