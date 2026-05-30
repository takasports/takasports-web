'use client'

import { useEffect, useState } from 'react'
import TakaPoint from '@/components/TakaPoint'

// ─────────────────────────────────────────────────────────────────
// Toast flotante para mostrar puntos acreditados tras terminar una
// partida. Reusable entre juegos (MiOnce, SopaCracks, TakaGrid…).
// CrackQuiz tiene su propio banner inline en ResultScreen.
//
// Comportamiento:
//   · Muestra cuando awarded > 0; auto-dismiss a los 5s.
//   · Si awarded es null o 0 → no renderiza nada.
//   · Re-aparece si awarded cambia a un valor nuevo > 0.
//   · role=status + aria-live=polite para lectores de pantalla.
// ─────────────────────────────────────────────────────────────────

interface Props {
  /** null = aún no hay respuesta del server; >0 = mostrar; 0 = no mostrar */
  awarded: number | null
  /** Callback cuando el toast se auto-oculta */
  onDismiss?: () => void
  /** Color de acento del juego */
  accent?: string
}

export default function GameCoinsToast({
  awarded,
  onDismiss,
  accent = '#A78BFA',
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
        background: 'linear-gradient(135deg, rgba(167,139,250,0.14), rgba(109,40,217,0.10))',
        border: `1px solid ${accent}55`,
        borderRadius: 16,
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minWidth: 240,
        maxWidth: 'calc(100vw - 32px)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        animation: 'gpt-slide-up 0.45s ease-out',
      }}
    >
      <style>{`
        @keyframes gpt-slide-up {
          from { transform: translate(-50%, 24px); opacity: 0; }
          to   { transform: translate(-50%, 0);   opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="gpt-slide-up"] { animation: none !important; }
        }
      `}</style>

      <TakaPoint size={28} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 14,
            fontWeight: 900,
            color: '#A78BFA',
            fontFamily: 'var(--font-display)',
            margin: 0,
          }}
        >
          +{awarded} punto{awarded !== 1 ? 's' : ''} Taka
        </p>
        <p
          style={{
            fontSize: 10,
            color: 'rgba(255,255,255,0.45)',
            fontFamily: 'var(--font-sport)',
            margin: '2px 0 0 0',
          }}
        >
          Suman a tu ranking global
        </p>
      </div>
    </div>
  )
}
