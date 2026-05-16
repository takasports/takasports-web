'use client'

// Banda inline "Tu posición #N de M" para incrustar dentro de pantallas
// de resultado existentes (ej. el ResultOverlay de TakaGrid).
// Más ligero que PostGameResultModal: sin overlay, sin share, sin CTA.

import { useMyPosition } from '@/hooks/useGameState'
import type { GameId } from '@/lib/games-store'

interface Props {
  gameId: GameId
  period: string
  accent: string
}

export default function MyPositionBanner({ gameId, period, accent }: Props) {
  const { data, loading } = useMyPosition(gameId, period)

  if (loading) {
    return <div className="h-10 rounded-xl w-full" style={{ background: 'rgba(255,255,255,0.03)' }} />
  }
  if (!data.position || data.total === 0) return null

  return (
    <div
      className="rounded-xl px-4 py-2.5 flex items-center justify-between w-full"
      style={{ background: `${accent}10`, border: `1px solid ${accent}30` }}
    >
      <span
        className="text-[10px] font-black uppercase tracking-widest"
        style={{ color: accent, fontFamily: 'var(--font-sport)' }}
      >
        Tu posición
      </span>
      <span
        className="text-sm font-black"
        style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)' }}
      >
        #{data.position} <span style={{ fontWeight: 400, opacity: 0.6 }}>de {data.total}</span>
      </span>
    </div>
  )
}
