'use client'

// Overlay que aparece tras completar una partida. Muestra:
//   · score del usuario
//   · posición #N de M en el ranking del periodo
//   · botón Compartir (ShareResultButton, encoder unificado)
//   · CTA "Ver ranking completo →"
//
// El modal se muestra UNA sola vez por (gameId, period): tras cerrarlo,
// se persiste un flag en localStorage para no volver a abrirlo en la
// misma ronda. Si el usuario es invitado (no_session), no abre nada
// (lo cubre el GuestRankingHint en /juegos).
//
// Patrón de uso desde un juego:
//
//   const [showResult, setShowResult] = useState(false)
//   useEffect(() => { if (finished) setShowResult(true) }, [finished])
//   ...
//   {showResult && <PostGameResultModal gameId="crackquiz" period={period}
//     play={play} accent="#FCD34D" onClose={() => setShowResult(false)} />}

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useMyPosition } from '@/hooks/useGameState'
import ShareResultButton from './ShareResultButton'
import type { GameId, GamePlay } from '@/lib/games-store'

interface Props {
  gameId:  GameId
  period:  string
  play:    GamePlay
  accent:  string
  onClose: () => void
  /** Si true, no aplica el flag "una vez por periodo" (útil para que
   *  el modal pueda volver a abrirse si el usuario reabre el juego). */
  alwaysShow?: boolean
  /** Override del slug de la página de leaderboard si difiere del gameId. */
  leaderboardSlug?: GameId
}

function shownKey(gameId: GameId, period: string): string {
  return `ts_games:result_shown:${gameId}:${period}`
}

export default function PostGameResultModal({
  gameId, period, play, accent, onClose, alwaysShow = false, leaderboardSlug,
}: Props) {
  const { data, loading } = useMyPosition(gameId, period)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (alwaysShow) { setVisible(true); return }
    try {
      const seen = localStorage.getItem(shownKey(gameId, period))
      if (!seen) {
        setVisible(true)
        localStorage.setItem(shownKey(gameId, period), '1')
      }
    } catch { setVisible(true) }
  }, [gameId, period, alwaysShow])

  if (!visible) return null

  const lbSlug = leaderboardSlug ?? gameId

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg-card)', border: `1px solid ${accent}40` }}
        onClick={e => e.stopPropagation()}
      >
        {/* Acento superior */}
        <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${accent}80, ${accent})` }} />

        {/* Header con close */}
        <div className="flex items-center justify-between px-5 pt-4">
          <span
            className="text-[10px] font-black uppercase tracking-widest"
            style={{ color: accent, fontFamily: 'var(--font-sport)' }}
          >
            Tu resultado · {period}
          </span>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="w-7 h-7 rounded-full flex items-center justify-center transition-opacity hover:opacity-100"
            style={{ background: 'rgba(255,255,255,0.04)', color: '#5A5A7A', opacity: 0.7 }}
          >
            ✕
          </button>
        </div>

        {/* Score grande */}
        <div className="px-6 pt-4 pb-2 text-center">
          <p
            className="font-black leading-none"
            style={{ fontFamily: 'var(--font-display)', color: accent, fontSize: 56 }}
          >
            {play.score}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>puntos</p>
        </div>

        {/* Posición */}
        <div className="px-6 py-3">
          {loading ? (
            <div className="h-12 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }} />
          ) : data.position && data.total > 0 ? (
            <div
              className="rounded-xl px-4 py-3 flex items-center justify-between"
              style={{ background: `${accent}10`, border: `1px solid ${accent}28` }}
            >
              <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: accent, fontFamily: 'var(--font-sport)' }}>
                Tu posición
              </span>
              <span className="text-base font-black" style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)' }}>
                #{data.position} <span className="opacity-60" style={{ fontWeight: 400 }}>de {data.total}</span>
              </span>
            </div>
          ) : (
            <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              Inicia sesión para entrar al ranking. Tu partida está guardada en este navegador.
            </p>
          )}
        </div>

        {/* Acciones */}
        <div className="px-6 pb-6 pt-2 flex flex-col gap-2">
          <ShareResultButton play={play} accent={accent} fullWidth />
          <Link
            href={`/juegos/leaderboard/${lbSlug}`}
            className="w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-center transition-opacity hover:opacity-80"
            style={{
              background:    'rgba(255,255,255,0.04)',
              color:         accent,
              border:        `1px solid ${accent}30`,
              fontFamily:    'var(--font-sport)',
              letterSpacing: '0.06em',
            }}
          >
            Ver ranking completo →
          </Link>
        </div>
      </div>
    </div>
  )
}
