'use client'

import { useEffect, useState } from 'react'

// ─────────────────────────────────────────────────────────────────
// Toast flotante para mostrar monedas acreditadas al Ranked tras
// terminar una partida. Reusable entre juegos (MiOnce, SopaCracks,
// TakaGrid, StrikerRush…). CrackQuiz tiene su propio banner inline
// integrado en ResultScreen — este toast es para juegos sin pantalla
// post-game dedicada.
//
// Comportamiento:
//   · Muestra cuando awarded > 0; auto-dismiss a los 5s.
//   · Si awarded es null o 0 → no renderiza nada (no estorba).
//   · Re-aparece si awarded cambia a un valor nuevo > 0.
//   · role=status + aria-live=polite para lectores de pantalla.
//   · Defensive: setTimeout limpio en cleanup.
// ─────────────────────────────────────────────────────────────────

interface Props {
  /** null = aún no hay respuesta del server; >0 = mostrar; 0 = no mostrar */
  awarded: number | null
  /** Callback cuando el toast se auto-oculta (para resetear state del padre) */
  onDismiss?: () => void
  /** Color de acento del juego (e.g. '#93C5FD' para MiOnce, '#6EE7B7' para Sopa) */
  accent?: string
  /** Acción/link bajo el mensaje principal. Default: explicación genérica. */
  hint?: string
}

export default function GameCoinsToast({
  awarded,
  onDismiss,
  accent = '#FCD34D',
  hint = 'Las usás para apostar en la Quiniela Ranked',
}: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (awarded === null || awarded <= 0) {
      setVisible(false)
      return
    }
    setVisible(true)
    const t = setTimeout(() => {
      setVisible(false)
      onDismiss?.()
    }, 5000)
    return () => clearTimeout(t)
  }, [awarded, onDismiss])

  if (!visible || !awarded || awarded <= 0) return null

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 'max(24px, env(safe-area-inset-bottom, 24px))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        background: 'linear-gradient(135deg, rgba(252,211,77,0.16), rgba(251,146,60,0.10))',
        border: `1px solid ${accent}66`,
        borderRadius: 16,
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minWidth: 260,
        maxWidth: 'calc(100vw - 32px)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        animation: 'gct-slide-up 0.45s ease-out',
      }}
    >
      <style>{`
        @keyframes gct-slide-up {
          from { transform: translate(-50%, 24px); opacity: 0; }
          to   { transform: translate(-50%, 0);   opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="gct-slide-up"] { animation: none !important; }
        }
      `}</style>
      <span style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>🪙</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 14,
            fontWeight: 900,
            color: accent,
            fontFamily: 'var(--font-display)',
            margin: 0,
          }}
        >
          +{awarded} monedas al Ranked
        </p>
        <p
          style={{
            fontSize: 10,
            color: 'rgba(255,255,255,0.5)',
            fontFamily: 'var(--font-sport)',
            margin: '2px 0 0 0',
          }}
        >
          {hint}
        </p>
      </div>
    </div>
  )
}
