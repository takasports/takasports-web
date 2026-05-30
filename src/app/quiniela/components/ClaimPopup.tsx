'use client'

import { useEffect, useState } from 'react'

// ─────────────────────────────────────────────────────────────────
// ClaimPopup — popup animado de reward al reclamar un desafío.
//
// Aparece brevemente (3.5s) con una animación de entrada/salida.
// El user hace click en "Reclamar" en ChallengesPanel → se ejecuta
// el claim → si ok, se muestra este popup con las monedas y el badge.
// ─────────────────────────────────────────────────────────────────

interface ClaimPopupProps {
  badgeEmoji: string
  badgeName: string
  coinsAwarded: number
  onClose: () => void
}

export function ClaimPopup({ badgeEmoji, badgeName, coinsAwarded, onClose }: ClaimPopupProps) {
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    // Pequeño delay para que el mount dispare la animación de entrada
    const t1 = setTimeout(() => setVisible(true), 30)
    // Auto-close después de 3.5s
    const t2 = setTimeout(() => {
      setLeaving(true)
      setTimeout(onClose, 500)
    }, 3500)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onClose])

  return (
    <div
      className="fixed bottom-6 left-1/2 z-[400] pointer-events-none"
      style={{
        transform: `translateX(-50%) translateY(${visible && !leaving ? '0' : '120px'})`,
        opacity: visible && !leaving ? 1 : 0,
        transition: 'transform 0.45s cubic-bezier(0.34,1.56,0.64,1), opacity 0.35s ease',
      }}
    >
      <div
        className="flex items-center gap-3 px-5 py-3.5 rounded-2xl pointer-events-auto"
        style={{
          background: 'linear-gradient(135deg, #1A0B30 0%, #0A0118 100%)',
          border: '1px solid rgba(251,191,36,0.45)',
          boxShadow: '0 20px 60px rgba(251,191,36,0.25), 0 4px 16px rgba(0,0,0,0.5)',
          minWidth: 270,
        }}
      >
        {/* Badge icon */}
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: 'rgba(251,191,36,0.14)',
            border: '1px solid rgba(251,191,36,0.45)',
            fontSize: 24,
          }}
        >
          {badgeEmoji}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#fbbf24', fontFamily: 'var(--font-sport)' }}>
            ¡Recompensa reclamada!
          </p>
          <p className="font-black text-[13px] leading-tight" style={{ color: '#F0F0FF', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
            {badgeName}
          </p>
          {coinsAwarded > 0 ? (
            <p className="text-[15px] font-black tabular-nums leading-tight mt-0.5" style={{ color: '#fbbf24', fontFamily: 'var(--font-display)' }}>
              +{coinsAwarded} pts
            </p>
          ) : (
            <p className="text-[10px] font-black mt-0.5" style={{ color: '#A0A0C0', fontFamily: 'var(--font-sport)' }}>
              Badge desbloqueado
            </p>
          )}
        </div>

        {/* Shimmer */}
        <div className="flex-shrink-0 text-xl" style={{ opacity: 0.85 }}>✨</div>
      </div>
    </div>
  )
}
