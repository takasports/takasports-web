'use client'

import { useState } from 'react'
import { StarIcon, LiveDotIcon, LockIcon } from '@/components/icons/GameIcons'
import { getCompAccent } from '@/lib/competitions'
import { competitionArt } from './competition-art'
import TeamCrest from './TeamCrest'
import PickButton from './PickButton'
import ExactScoreBlock from './ExactScoreBlock'
import { timeLabel, formatCountdown } from './jornada'
import {
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
  event, pred, submitting, theme, onPick, onExactSet, onCaptain,
  showExactTooltip, onExactTooltipDismiss, animDelay = 0, liveScore, nowMs, deadlineMs,
}: {
  event: SoccerEvent
  pred: PredictionRow | undefined
  submitting: boolean
  theme: SoccerTheme
  liveScore?: LiveScore
  onPick: (id: string, pick: SoccerPick) => void
  onExactSet: (id: string, exact: { home: number; away: number } | null) => void
  /** Marcar/desmarcar este partido como el ×2 de la Jornada. */
  onCaptain: (id: string, captain: boolean) => void
  showExactTooltip?: boolean
  onExactTooltipDismiss?: () => void
  animDelay?: number
  /** Reloj del cliente, inyectado para que todas las tarjetas compartan el
   *  mismo tick y las cuentas atrás no se desincronicen entre sí. */
  nowMs: number
  /** Cierre de la JORNADA a la que pertenece este partido, o null si ya pasó.
   *  No lo decide la tarjeta: la Jornada cierra entera con su primer partido, y
   *  si cada tarjeta se rigiera por su propio kickoff ofrecería botones que la
   *  API va a rechazar. */
  deadlineMs: number | null
}) {
  const myPick     = pred?.prediction?.pick ?? null
  const exactScore = pred?.prediction?.exactScore ?? null
  const isCaptain  = pred?.prediction?.captain === true
  const isResolved = event.status === 'resolved'
  const isClosed   = event.status === 'closed'
  const winner     = event.result?.winner ?? null
  const pts        = pred?.points_awarded ?? null
  const [shared, setShared] = useState(false)

  // Cuenta atrás de la JORNADA, no de este partido. Ver `deadlineMs`.
  const lockMs   = deadlineMs === null ? 0 : deadlineMs - nowMs
  const isLocked = lockMs <= 0
  const isOpen   = event.status === 'open' && !isLocked
  const showLockWarning = event.status === 'open' && !isLocked && lockMs < 6 * 60 * 60 * 1000

  const compColor = getCompAccent(event.competition, theme.accent)
  const art       = competitionArt(event.competition)
  const crest = (side: 'home' | 'away', size: number) => (
    <TeamCrest
      name={side === 'home' ? event.team_home : event.team_away}
      logo={side === 'home' ? event.meta?.home_logo : event.meta?.away_logo}
      abbr={side === 'home' ? event.meta?.home_abbr : event.meta?.away_abbr}
      size={size}
    />
  )

  // ── Veredicto ──────────────────────────────────────────────────────────────
  // Quién cayó, para atenuarlo en el marcador.
  const loserSide: SoccerPick | null =
    isResolved && winner === '1' ? '2' : isResolved && winner === '2' ? '1' : null

  // Tendencia que marca el resultado EN CURSO. Es lo que permite decirle al
  // usuario si su pick sigue vivo mientras el partido se juega — sin esto, un
  // partido en directo es una tarjeta que no cuenta nada.
  const liveTrend: SoccerPick | null =
    liveScore && liveScore.home != null && liveScore.away != null
      ? liveScore.home > liveScore.away ? '1' : liveScore.away > liveScore.home ? '2' : 'X'
      : null

  const exactHit = !!(
    isResolved && exactScore && myPick === winner &&
    exactScore.home === event.result?.home_score &&
    exactScore.away === event.result?.away_score
  )
  const hit = isResolved && myPick != null && myPick === winner

  /** Por qué se pagó lo que se pagó. Sin esto, un "+24" no se entiende. */
  const winReason = [
    isCaptain ? 'tu capitán ×2' : null,
    exactHit ? 'marcador clavado' : null,
  ].filter(Boolean).join(' · ')

  const teamOf = (v: SoccerPick | null) =>
    v === '1' ? event.team_home : v === '2' ? event.team_away : 'el empate'

  /** Rótulo inferior: verde si acertaste, rojo mientras se juega, apagado si
   *  fallaste. El fallo NO va en rojo: no se castiga al que juega, se le invita
   *  a volver. Sin pick y sin jugar, no hay rótulo: no hay nada que sentenciar. */
  const band: { bg: string; fg: string; text: string; pts?: string | null; note?: string; border?: string } | null =
    isResolved && myPick
      ? hit
        ? {
            bg: `linear-gradient(90deg, ${theme.accent}, #A7F3D0 70%, transparent)`,
            fg: '#04140C', pts: `+${pts ?? 0}`, text: 'pts · Acertaste',
            note: winReason || undefined,
          }
        : {
            bg: 'rgba(255,255,255,0.05)', fg: 'var(--text-muted)',
            pts: '0', text: 'pts · Fallaste',
            border: '1px solid rgba(255,255,255,0.07)',
          }
      : isClosed && myPick && liveTrend
        ? {
            bg: 'linear-gradient(90deg, var(--color-live), #FF7A5C 65%, transparent)',
            fg: '#fff',
            text: myPick === liveTrend ? 'Tu pick sigue vivo' : 'Vas perdiendo el pick',
            note: liveTrend === 'X' && myPick !== 'X' ? 'empate = sin puntos' : `ahora gana ${teamOf(liveTrend)}`,
          }
        : null

  // Boleto: la tendencia manda (1 · X · 2) y debajo a quién apuestas. Antes
  // cada botón apilaba escudo + "LOCAL" + nombre —tres líneas— y la fila se
  // comía media tarjeta repitiendo unos escudos que ya están arriba, grandes.
  const picks: { label: string; sub: string; aria: string; val: SoccerPick }[] = [
    { label: '1', sub: event.team_home ?? 'Local',  aria: `Gana ${event.team_home ?? 'el local'}`,   val: '1' },
    { label: 'X', sub: 'Empate',                    aria: 'Empate',                                  val: 'X' },
    { label: '2', sub: event.team_away ?? 'Visita', aria: `Gana ${event.team_away ?? 'el visitante'}`, val: '2' },
  ]

  return (
    <div
      // `cal-card` aporta la silueta broadcast del sistema: profundidad, hover y
      // —sobre todo— la MUESCA DIAGONAL de la esquina inferior derecha teñida de
      // la competición, que es la firma de forma de «La Señal». La tarjeta vivía
      // fuera de ese lenguaje y por eso se leía como un dashboard cualquiera.
      className="cal-card"
      style={{
        ['--row-accent' as string]: event.featured ? theme.accent : compColor,
        position: 'relative',
        background: event.featured ? theme.cardBgFeat : theme.cardBg,
        borderTop:    `1px solid ${event.featured ? `${theme.accent}35` : 'rgba(255,255,255,0.1)'}`,
        borderRight:  `1px solid ${event.featured ? `${theme.accent}20` : 'rgba(255,255,255,0.07)'}`,
        borderBottom: `1px solid ${event.featured ? `${theme.accent}20` : 'rgba(255,255,255,0.07)'}`,
        borderLeft:   `3px solid ${event.featured ? theme.accent : compColor}`,
        borderRadius: 'var(--radius-card)',
        display: 'flex', flexDirection: 'column',
        animation: `fCardIn 0.4s ease-out ${animDelay}ms both`,
      }}
    >
      {/* Arte del torneo, entrando por la derecha y disolviéndose hacia el texto.
          Son las mismas ilustraciones que ya usa /calendario. */}
      {art && (
        <span
          aria-hidden
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage: `url(${art})`,
            backgroundSize: 'cover', backgroundPosition: 'right center',
            opacity: event.featured ? 0.3 : 0.24,
            WebkitMaskImage: 'linear-gradient(to left, #000 0%, transparent 78%)',
            maskImage: 'linear-gradient(to left, #000 0%, transparent 78%)',
          }}
        />
      )}

      <div style={{ position: 'relative', padding: band ? '13px 16px 12px 14px' : '13px 16px 14px 14px', display: 'flex', flexDirection: 'column' }}>
      {/* ── Cabecera ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {event.featured && (
          <span className="cal-live-tag" style={{
            fontSize: 9, fontWeight: 900, padding: '4px 10px',
            background: `linear-gradient(90deg, ${theme.accent}, #A7F3D0)`,
            color: '#04140C', fontFamily: 'var(--font-sport)', letterSpacing: '0.09em',
          }}>
            <StarIcon size={9} className="inline-block align-middle mr-1" />
            {event.sport === 'football' ? 'PARTIDAZO · X2' : 'PARTIDO DEL DÍA · X2'}
          </span>
        )}
        <span className="cal-live-tag" style={{
          fontSize: 9, fontWeight: 900, padding: '4px 9px',
          background: compColor, color: '#0A0A12',
          fontFamily: 'var(--font-sport)',
          textTransform: 'uppercase', letterSpacing: '0.09em',
        }}>{event.competition}</span>
        {event.meta?.stage && (
          <span className="cal-live-tag" style={{
            fontSize: 9, fontWeight: 700, padding: '4px 9px',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--text-muted)', fontFamily: 'var(--font-sport)',
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
            ⏱ {formatCountdown(lockMs)} para el cierre de la Jornada
          </span>
        )}
      </div>

      {/* ── Enfrentamiento ──
          Sin la caja negra que lo envolvía: tapaba el arte del torneo y añadía
          una segunda superficie dentro de la tarjeta sin aportar jerarquía. */}
      <div style={{
        marginBottom: 12,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
          {/* minWidth:0 + overflowWrap: sin ellos "Manchester United" desbordaba
              la tarjeta en móvil en vez de partirse en dos líneas. */}
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: 'clamp(12px, 3.2vw, 17px)', fontWeight: 900,
            // El perdedor se atenúa: con el marcador grande, atenuar al que cayó
            // hace que el resultado se lea de un vistazo sin tener que sumar.
            color: loserSide === '1' ? 'var(--text-muted)' : '#ECECF6',
            lineHeight: 1.05, textAlign: 'right', letterSpacing: '-0.01em',
            minWidth: 0, overflowWrap: 'break-word',
          }}>{event.team_home}</span>
          {crest('home', 30)}
        </div>

        {/* Marcador de emisión. Cuando el partido acabó, el resultado es LO que
            importa: iba en una cajita del mismo tamaño que la hora de un
            partido sin jugar. Ahora manda él. */}
        <div style={{ width: 'clamp(64px, 17vw, 96px)', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          {isResolved && event.result ? (
            <>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 7vw, 38px)', fontWeight: 900,
                color: '#F4F4FA', letterSpacing: '-0.03em', lineHeight: 0.92,
                fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
              }}>{event.result.home_score ?? '?'}–{event.result.away_score ?? '?'}</span>
              <span style={{ fontSize: 8.5, fontWeight: 900, color: 'var(--text-muted)', fontFamily: 'var(--font-sport)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>Final</span>
            </>
          ) : isClosed && liveScore && (liveScore.home != null || liveScore.away != null) ? (
            <>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 7vw, 38px)', fontWeight: 900,
                color: 'var(--color-live)', letterSpacing: '-0.03em', lineHeight: 0.92,
                fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
              }}>{liveScore.home ?? 0}–{liveScore.away ?? 0}</span>
              <span style={{ fontSize: 8.5, fontWeight: 900, color: 'var(--color-live)', fontFamily: 'var(--font-sport)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                {liveScore.clock || 'Directo'}
              </span>
            </>
          ) : (
            <>
              {/* La HORA manda sobre el "VS": es el dato que decide si te da
                  tiempo a jugar. Antes iba en cuerpo 9 debajo de un VS grande. */}
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 900,
                color: '#F4F4FA', lineHeight: 1, fontVariantNumeric: 'tabular-nums',
              }}>{timeLabel(event.event_date)}</span>
              <span style={{
                fontSize: 8, fontWeight: 900, color: 'var(--text-muted)',
                fontFamily: 'var(--font-sport)', letterSpacing: '0.18em',
              }}>VS</span>
            </>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          {crest('away', 30)}
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: 'clamp(12px, 3.2vw, 17px)', fontWeight: 900,
            color: loserSide === '2' ? 'var(--text-muted)' : '#ECECF6',
            lineHeight: 1.05, textAlign: 'left', letterSpacing: '-0.01em',
            minWidth: 0, overflowWrap: 'break-word',
          }}>{event.team_away}</span>
        </div>
      </div>

      {/* ── Tendencia ──
          Ya resuelto, los tres botones dejan de ser botones: son el registro de
          lo que elegiste, y ocupaban el mismo sitio que cuando podías jugar.
          Colapsan a una línea. */}
      {isResolved ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          padding: '8px 10px', borderRadius: 'var(--radius-md)',
          background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)',
        }}>
          {myPick ? (
            <>
              <span style={{ fontFamily: 'var(--font-sport)', fontSize: 8.5, fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Tu pick</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 900, color: hit ? theme.accent : '#F87171' }}>
                {myPick} · {teamOf(myPick)}
              </span>
              {exactScore && (
                <>
                  <span style={{ fontFamily: 'var(--font-sport)', fontSize: 8.5, fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', marginLeft: 6 }}>Tu apuesta</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 900, color: exactHit ? theme.accent : 'var(--text-secondary)' }}>
                    {exactScore.home} - {exactScore.away}
                  </span>
                </>
              )}
              {/* Acertar el ganador y HABER apostado al marcador no es lo
                  mismo que acertar a secas: en ese caso el partido pagó 0.
                  Decir solo "✓ acertado" al lado de un +0 es incoherente. */}
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-sport)', fontSize: 10, fontWeight: 800, color: 'var(--text-muted)' }}>
                {exactHit
                  ? '✓ clavado'
                  : exactScore && hit
                  ? 'ganador sí, marcador no'
                  : hit
                  ? '✓ acertado'
                  : `ganó ${teamOf(winner)}`}
              </span>
            </>
          ) : (
            <span style={{ fontFamily: 'var(--font-sport)', fontSize: 10, color: 'var(--text-muted)' }}>
              No jugaste este partido · ganó {teamOf(winner)}
            </span>
          )}
        </div>
      ) : (
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
              sublabel={p.sub}
              ariaLabel={p.aria}
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
      )}

      {/* ── Capitán ──
          El ×2 lo pone el jugador, no la casa. Solo aparece con pick hecho:
          antes de elegir ganador no hay nada que doblar. Ver SOCCER_POINTS. */}
      {myPick && (isOpen || isCaptain) && (
        <button
          type="button"
          onClick={() => { if (isOpen) onCaptain(event.id, !isCaptain) }}
          disabled={!isOpen || submitting}
          aria-pressed={isCaptain}
          title={isCaptain
            ? 'Este es tu ×2 de la Jornada'
            : 'Dobla lo que pague este partido. Solo uno por Jornada.'}
          style={{
            marginTop: 10, width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '8px 12px', borderRadius: 'var(--radius-card)',
            background: isCaptain ? `${theme.accent}1F` : 'rgba(255,255,255,0.035)',
            border: `1px solid ${isCaptain ? `${theme.accent}66` : 'rgba(255,255,255,0.09)'}`,
            color: isCaptain ? theme.accent : 'var(--text-muted)',
            cursor: isOpen && !submitting ? 'pointer' : 'default',
            fontFamily: 'var(--font-sport)',
          }}
        >
          <span aria-hidden style={{ display: 'inline-flex' }}><StarIcon size={12} /></span>
          <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {isCaptain ? 'Tu capitán · ×2' : 'Hacer capitán'}
          </span>
          {!isCaptain && (
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', opacity: 0.7 }}>
              dobla lo que pague
            </span>
          )}
        </button>
      )}

      {!isResolved && (
      <ExactScoreBlock
        event={event}
        myPick={myPick}
        exactScore={exactScore}
        isCaptain={isCaptain}
        isOpen={isOpen}
        isResolved={isResolved}
        isClosed={isClosed}
        winner={winner}
        submitting={submitting}
        onSet={(v) => onExactSet(event.id, v)}
        showTooltip={showExactTooltip === true}
        onTooltipDismiss={onExactTooltipDismiss}
      />
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

      {!myPick && !isOpen && !isResolved && (
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-sport)', marginTop: 8 }}>
          {isClosed ? 'Predicciones cerradas' : isLocked ? 'La Jornada ya cerró' : 'Sin predicción'}
        </span>
      )}
      </div>

      {/* ── Rótulo inferior (lower third) ──────────────────────────────────
          El veredicto, a sangre y en el canto de la tarjeta, como el rótulo de
          una retransmisión. Antes el "+12 pts ¡Acertaste!" era una línea de
          11 px perdida al fondo: el momento de recompensa, que es lo que hace
          volver al usuario, pasaba desapercibido. */}
      {band && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 9, padding: '9px 14px',
          fontFamily: 'var(--font-sport)', fontSize: 11, fontWeight: 900,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          background: band.bg, color: band.fg,
          borderTop: band.border ?? 'none',
        }}>
          {band.pts != null && (
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 19, letterSpacing: '-0.01em', lineHeight: 1 }}>
              {band.pts}
            </span>
          )}
          <span>{band.text}</span>
          {band.note && (
            <span style={{ marginLeft: 'auto', fontSize: 9.5, letterSpacing: '0.08em', opacity: 0.85, textAlign: 'right' }}>
              {band.note}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
