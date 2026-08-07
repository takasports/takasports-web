'use client'

import { useState } from 'react'
import { StarIcon, LiveDotIcon, LockIcon } from '@/components/icons/GameIcons'
import TakaPoint from '@/components/TakaPoint'
import { getCompAccent } from '@/lib/competitions'
import TeamCrest from './TeamCrest'
import PickButton from './PickButton'
import ExactScoreBlock from './ExactScoreBlock'
import { timeLabel, formatCountdown } from './fecha'
import {
  MAX_ACTIVE_EXACT, SOCCER_LOCK_MS,
  type SoccerEvent, type SoccerPick, type SoccerTheme, type LiveScore, type PredictionRow,
} from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Tarjeta de partido de una Fecha.
//
// Frente a la del Mundial cambian tres cosas de fondo, no de estilo:
//   · Escudos de club en vez de banderas emoji (en el Mundial todos los
//     equipos eran selecciones y valía un diccionario de emojis).
//   · Badge de COMPETICIÓN, porque en una misma Fecha conviven Champions,
//     LaLiga y Copa; en el Mundial todo era el mismo torneo y bastaba el grupo.
//   · Acento por tema, no dorado fijo.
// ─────────────────────────────────────────────────────────────────────────────

export default function MatchCard({
  event, pred, submitting, theme, onPick, onExactSet, activeExactCount,
  showExactTooltip, onExactTooltipDismiss, animDelay = 0, liveScore, nowMs,
}: {
  event: SoccerEvent
  pred: PredictionRow | undefined
  submitting: boolean
  theme: SoccerTheme
  liveScore?: LiveScore
  onPick: (id: string, pick: SoccerPick) => void
  onExactSet: (id: string, exact: { home: number; away: number } | null) => void
  activeExactCount: number
  showExactTooltip?: boolean
  onExactTooltipDismiss?: () => void
  animDelay?: number
  /** Reloj del cliente, inyectado para que todas las tarjetas compartan el
   *  mismo tick y las cuentas atrás no se desincronicen entre sí. */
  nowMs: number
}) {
  const myPick     = pred?.prediction?.pick ?? null
  const exactScore = pred?.prediction?.exactScore ?? null
  const isResolved = event.status === 'resolved'
  const isClosed   = event.status === 'closed'
  const winner     = event.result?.winner ?? null
  const pts        = pred?.points_awarded ?? null
  const [shared, setShared] = useState(false)
  const exactSlotAvailable = !!exactScore || activeExactCount < MAX_ACTIVE_EXACT

  const lockMs   = new Date(event.event_date).getTime() - SOCCER_LOCK_MS - nowMs
  const isLocked = lockMs <= 0
  const isOpen   = event.status === 'open' && !isLocked
  const showLockWarning = event.status === 'open' && !isLocked && lockMs < 6 * 60 * 60 * 1000

  const compColor = getCompAccent(event.competition, theme.accent)
  const crest = (side: 'home' | 'away', size: number) => (
    <TeamCrest
      name={side === 'home' ? event.team_home : event.team_away}
      logo={side === 'home' ? event.meta?.home_logo : event.meta?.away_logo}
      abbr={side === 'home' ? event.meta?.home_abbr : event.meta?.away_abbr}
      size={size}
    />
  )

  const picks: { label: string; visual: React.ReactNode; sub: string; val: SoccerPick }[] = [
    { label: 'Local',  visual: crest('home', 22), sub: event.team_home ?? '', val: '1' },
    { label: 'Empate', visual: <span style={{ fontSize: 20, lineHeight: 1 }}>⚖️</span>, sub: 'X', val: 'X' },
    { label: 'Visita', visual: crest('away', 22), sub: event.team_away ?? '', val: '2' },
  ]

  return (
    <div
      style={{
        background: event.featured ? theme.cardBgFeat : theme.cardBg,
        borderTop:    `1px solid ${event.featured ? `${theme.accent}35` : 'rgba(255,255,255,0.1)'}`,
        borderRight:  `1px solid ${event.featured ? `${theme.accent}20` : 'rgba(255,255,255,0.07)'}`,
        borderBottom: `1px solid ${event.featured ? `${theme.accent}20` : 'rgba(255,255,255,0.07)'}`,
        borderLeft:   `3px solid ${event.featured ? theme.accent : compColor}`,
        borderRadius: 18,
        padding: '14px 16px 14px 14px',
        display: 'flex', flexDirection: 'column',
        boxShadow: event.featured
          ? `0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 ${theme.accent}18`
          : '0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
        animation: `fCardIn 0.4s ease-out ${animDelay}ms both`,
      }}
    >
      {/* ── Cabecera ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {event.featured && (
          <span style={{
            fontSize: 9, fontWeight: 900, padding: '3px 8px', borderRadius: 'var(--radius-sm)',
            background: `linear-gradient(90deg,${theme.accent}2A,${theme.accent}14)`,
            border: `1px solid ${theme.accent}55`, color: theme.accent,
            fontFamily: 'var(--font-sport)', letterSpacing: '0.07em',
          }}>
            <StarIcon size={9} className="inline-block align-middle mr-1" />PARTIDO DEL DÍA · X2
          </span>
        )}
        <span style={{
          fontSize: 9, fontWeight: 800, padding: '3px 7px', borderRadius: 'var(--radius-sm)',
          background: `${compColor}1A`, border: `1px solid ${compColor}40`,
          color: compColor, fontFamily: 'var(--font-sport)',
          textTransform: 'uppercase', letterSpacing: '0.07em',
        }}>{event.competition}</span>
        {event.meta?.stage && (
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '3px 7px', borderRadius: 'var(--radius-sm)',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-sport)',
            textTransform: 'uppercase', letterSpacing: '0.07em',
          }}>{event.meta.stage}</span>
        )}
        {isClosed && (
          <span style={{ fontSize: 9, color: '#F87171', fontFamily: 'var(--font-sport)', fontWeight: 900, letterSpacing: '0.07em' }}>
            <LiveDotIcon size={7} className="align-middle mr-1" />EN VIVO
          </span>
        )}
        {isLocked && event.status === 'open' && (
          <span style={{ fontSize: 9, color: 'rgba(251,191,36,0.6)', fontFamily: 'var(--font-sport)', fontWeight: 700, letterSpacing: '0.06em' }}>
            <LockIcon size={9} className="inline-block align-middle mr-1" />PICKS BLOQUEADOS
          </span>
        )}
        {showLockWarning && (
          <span style={{ marginLeft: 'auto', fontSize: 8, color: 'rgba(251,191,36,0.55)', fontFamily: 'var(--font-sport)', fontWeight: 700, letterSpacing: '0.05em' }}>
            ⏱ {formatCountdown(lockMs)} para el cierre
          </span>
        )}
      </div>

      {/* ── Enfrentamiento ── */}
      <div style={{
        background: 'rgba(0,0,0,0.25)', borderRadius: 'var(--radius-card)',
        padding: '12px 10px', marginBottom: 12,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
          {crest('home', 40)}
          <span style={{
            fontSize: 12, fontWeight: 900, color: '#ECECF6',
            fontFamily: 'var(--font-sport)', lineHeight: 1.2, textAlign: 'right',
          }}>{event.team_home}</span>
        </div>

        <div style={{ width: 64, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          {isResolved && event.result ? (
            <>
              <div style={{ padding: '5px 10px', borderRadius: 'var(--radius-md)', background: `${theme.accent}18`, border: `1px solid ${theme.accent}30` }}>
                <span style={{
                  fontSize: 20, fontWeight: 900, color: theme.accent,
                  fontFamily: 'var(--font-display)', letterSpacing: '-0.03em', lineHeight: 1,
                }}>{event.result.home_score ?? '?'}–{event.result.away_score ?? '?'}</span>
              </div>
              <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.22)', fontFamily: 'var(--font-sport)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Final</span>
            </>
          ) : isClosed && liveScore && (liveScore.home != null || liveScore.away != null) ? (
            <>
              <div style={{ padding: '5px 10px', borderRadius: 'var(--radius-md)', background: 'rgba(248,113,113,0.14)', border: '1px solid rgba(248,113,113,0.35)' }}>
                <span style={{
                  fontSize: 20, fontWeight: 900, color: '#F87171',
                  fontFamily: 'var(--font-display)', letterSpacing: '-0.03em', lineHeight: 1,
                }}>{liveScore.home ?? 0}–{liveScore.away ?? 0}</span>
              </div>
              <span style={{ fontSize: 7, color: 'rgba(248,113,113,0.85)', fontFamily: 'var(--font-sport)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {liveScore.clock || 'Directo'}
              </span>
            </>
          ) : (
            <>
              <span style={{ fontSize: 13, fontWeight: 900, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-sport)', letterSpacing: '0.08em' }}>VS</span>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-sport)', textAlign: 'center' }}>{timeLabel(event.event_date)}</span>
            </>
          )}
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 5 }}>
          {crest('away', 40)}
          <span style={{
            fontSize: 12, fontWeight: 900, color: '#ECECF6',
            fontFamily: 'var(--font-sport)', lineHeight: 1.2, textAlign: 'left',
          }}>{event.team_away}</span>
        </div>
      </div>

      {/* ── Tendencia ── */}
      <div style={{ display: 'flex', gap: 7 }}>
        {picks.map(p => {
          const isActive  = myPick === p.val
          const isCorrect = isResolved && winner === p.val && isActive
          const isWrong   = isResolved && isActive && !isCorrect
          const isWinRow  = isResolved && winner === p.val && !isActive
          return (
            <PickButton
              key={p.val}
              label={p.label}
              visual={p.visual}
              sublabel={p.sub}
              active={isActive}
              correct={isCorrect || isWinRow}
              wrong={isWrong}
              disabled={!isOpen || submitting}
              theme={theme}
              onClick={() => onPick(event.id, p.val)}
            />
          )
        })}
      </div>

      <ExactScoreBlock
        event={event}
        myPick={myPick}
        exactScore={exactScore}
        isOpen={isOpen}
        isResolved={isResolved}
        isClosed={isClosed}
        winner={winner}
        submitting={submitting}
        exactSlotAvailable={exactSlotAvailable}
        onSet={(v) => onExactSet(event.id, v)}
        showTooltip={showExactTooltip === true}
        onTooltipDismiss={onExactTooltipDismiss}
      />

      {/* ── Puntos ── */}
      {isResolved && myPick && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
          {pts != null && pts > 0 ? (
            <>
              <TakaPoint size={13} />
              <span style={{ fontSize: 11, fontWeight: 900, color: theme.accent, fontFamily: 'var(--font-sport)' }}>+{pts} pts</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-sport)' }}>¡Acertaste!</span>
            </>
          ) : (
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-sport)' }}>
              Fallaste — ganó {winner === '1' ? event.team_home : winner === '2' ? event.team_away : 'el empate'}
            </span>
          )}
        </div>
      )}

      {/* ── Compartir ── */}
      {myPick && isOpen && (
        <button
          onClick={async () => {
            const label = myPick === '1' ? event.team_home : myPick === '2' ? event.team_away : 'Empate'
            const text  = `Predigo: ${label} en ${event.team_home} vs ${event.team_away} — ¿quién acierta más? ⚽`
            const url   = 'https://www.takasportsmedia.com/predicciones'
            try {
              const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> }
              if (nav.share) await nav.share({ title: 'TakaSports · Predicciones', text, url })
              else await navigator.clipboard.writeText(`${text}\n${url}`)
              setShared(true); setTimeout(() => setShared(false), 3000)
            } catch { /* cancelado */ }
          }}
          style={{
            alignSelf: 'flex-start', marginTop: 8,
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 'var(--radius-md)',
            background: `${theme.accent}0E`, border: `1px solid ${theme.accent}22`,
            color: theme.accentDim, fontSize: 9, fontWeight: 900,
            fontFamily: 'var(--font-sport)', textTransform: 'uppercase',
            letterSpacing: '0.06em', cursor: 'pointer',
          }}
        >{shared ? '✓ Copiado' : '↗ Compartir pick'}</button>
      )}

      {!myPick && !isOpen && (
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-sport)', marginTop: 8 }}>
          {isClosed ? 'Predicciones cerradas' : isLocked ? 'Picks bloqueados — el partido empieza en menos de 1 h' : 'Sin predicción'}
        </span>
      )}
    </div>
  )
}
