'use client'

import { useState } from 'react'
import { TargetIcon, LightbulbIcon } from '@/components/icons/GameIcons'
import { SOCCER_POINTS, soccerPayout, type SoccerEvent, type SoccerPick } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Marcador exacto — la jugada de riesgo. Cuatro modos, en este orden:
//   4. Lectura   — partido cerrado/resuelto y el usuario había apostado.
//   1. Sin pick  — pista sutil (primero hay que elegir ganador).
//   2. Con pick  — CTA para apostar.
//   3a/3b. Con marcador — resumen compacto o editor abierto.
//
// Lo importante de este bloque es lo que DICE, no lo que hace. Nació como un
// bonus que solo sumaba (+3 si lo clavabas, nada si no) y con cinco huecos
// gratis: rellenarlos siempre era la jugada óptima, así que no era una
// decisión, era trabajo. Desde la migración 128 el marcador SUSTITUYE al
// pronóstico de tendencia: 12 pts si lo clavas, 0 si no, aunque hubieras
// acertado el ganador. Toda la copia de aquí existe para que el usuario
// entienda ese canje ANTES de pulsar, no al ver el resultado.
//
// La paleta morada es la del producto (puntos Taka), no la del torneo.
// ─────────────────────────────────────────────────────────────────────────────

function ScoreStepper({
  value, onChange, label, disabled,
}: {
  value: number
  onChange: (v: number) => void
  label: string
  disabled: boolean
}) {
  const clamp = (n: number) => Math.max(0, Math.min(20, n))
  const btn = (txt: string, delta: number, aria: string) => (
    <button
      type="button"
      onClick={() => onChange(clamp(value + delta))}
      disabled={disabled || (delta < 0 ? value <= 0 : value >= 20)}
      aria-label={aria}
      style={{
        width: 26, height: 26, borderRadius: 'var(--radius-sm)',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.12)',
        color: 'rgba(255,255,255,0.7)',
        fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 900,
        lineHeight: 1, padding: 0, cursor: disabled ? 'wait' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >{txt}</button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
      <span style={{
        fontFamily: 'var(--font-sport)', fontSize: 9, fontWeight: 800,
        color: 'rgba(255,255,255,0.45)', letterSpacing: '0.04em',
        maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {btn('−', -1, `Quitar un gol a ${label}`)}
        <span style={{
          minWidth: 26, textAlign: 'center',
          fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 900,
          color: '#fff', letterSpacing: '-0.02em', lineHeight: 1,
        }}>{value}</span>
        {btn('+', 1, `Añadir un gol a ${label}`)}
      </div>
    </div>
  )
}

function short(s: string, max = 10): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`
}

export default function ExactScoreBlock({
  event, myPick, exactScore, isCaptain, isOpen, isResolved, isClosed,
  winner, submitting, onSet,
  showTooltip, onTooltipDismiss,
}: {
  event: SoccerEvent
  myPick: SoccerPick | null
  exactScore: { home: number; away: number } | null
  /** Este partido es el ×2 del usuario: los dos importes van doblados. */
  isCaptain: boolean
  isOpen: boolean
  isResolved: boolean
  isClosed: boolean
  winner: SoccerPick | null
  submitting: boolean
  onSet: (v: { home: number; away: number } | null) => void
  showTooltip?: boolean
  onTooltipDismiss?: () => void
}) {
  // Lo que paga clavarlo y lo que se renuncia por intentarlo. Ambos salen de
  // `soccerPayout`, que es el espejo del reparto real del servidor.
  const exactPts    = soccerPayout(isCaptain, true)
  const tendencyPts = soccerPayout(isCaptain, false)
  const [editorOpen, setEditorOpen] = useState(false)

  // ── 4. Modo lectura ──
  if ((isResolved || isClosed) && exactScore) {
    const realHome = event.result?.home_score
    const realAway = event.result?.away_score
    const exactHit =
      realHome != null && realAway != null &&
      exactScore.home === realHome && exactScore.away === realAway
    const trendOk = isResolved && winner === myPick

    let bg = 'linear-gradient(145deg, rgba(167,139,250,0.14) 0%, rgba(124,58,237,0.06) 100%)'
    let border = 'rgba(167,139,250,0.3)'
    let labelColor = '#C4B5FD'
    let badge: React.ReactNode = null

    if (isResolved) {
      if (exactHit) {
        bg = 'linear-gradient(145deg, rgba(34,197,94,0.20) 0%, rgba(22,163,74,0.08) 100%)'
        border = 'rgba(74,222,128,0.5)'
        labelColor = '#86EFAC'
        badge = (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            padding: '2px 7px', borderRadius: 999,
            background: 'rgba(74,222,128,0.22)', color: '#86EFAC',
            fontFamily: 'var(--font-sport)', fontSize: 9, fontWeight: 900, letterSpacing: '0.08em',
          }}>✓ CLAVADO · +{exactPts} PTS</span>
        )
      } else if (trendOk && realHome != null) {
        // Acertó el ganador pero falló los goles: la apuesta se llevó por
        // delante los puntos de tendencia. Se dice explícitamente, con el
        // resultado real al lado — es el único momento en que el usuario
        // aprende de verdad lo que cuesta esta jugada.
        bg = 'rgba(249,115,22,0.08)'
        border = 'rgba(249,115,22,0.28)'
        labelColor = '#FED7AA'
        badge = (
          <span style={{
            fontFamily: 'var(--font-sport)', fontSize: 9, fontWeight: 700,
            color: 'rgba(255,255,255,0.55)', letterSpacing: '0.04em',
          }}>fue {realHome}-{realAway} · 0 pts (apostaste los {tendencyPts})</span>
        )
      } else {
        bg = 'rgba(255,255,255,0.03)'
        border = 'rgba(255,255,255,0.08)'
        labelColor = 'rgba(255,255,255,0.4)'
      }
    }

    return (
      <div style={{
        marginTop: 10, padding: '8px 10px', borderRadius: 'var(--radius-card)',
        background: bg, border: `1px solid ${border}`,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ display: 'inline-flex', lineHeight: 1 }} aria-hidden><TargetIcon size={14} /></span>
        <span style={{
          fontFamily: 'var(--font-sport)', fontSize: 9, fontWeight: 900,
          color: labelColor, letterSpacing: '0.08em',
        }}>MI APUESTA</span>
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 900,
          color: '#fff', letterSpacing: '0.02em',
        }}>{exactScore.home} - {exactScore.away}</span>
        <span style={{ marginLeft: 'auto' }}>{badge}</span>
      </div>
    )
  }

  if (!isOpen) return null

  // ── 1. Sin pick aún ──
  if (!myPick) {
    return (
      <div style={{
        marginTop: 10, padding: '8px 10px', borderRadius: 10,
        background: 'rgba(167,139,250,0.04)',
        border: '1px dashed rgba(167,139,250,0.18)',
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      }}>
        <span style={{ display: 'inline-flex', lineHeight: 1, opacity: 0.6 }} aria-hidden><TargetIcon size={12} /></span>
        <span style={{
          flex: 1, fontFamily: 'var(--font-sport)', fontSize: 10, fontWeight: 700,
          color: 'rgba(167,139,250,0.65)', letterSpacing: '0.02em',
        }}>
          Apuesta al marcador · <strong style={{ color: '#C4B5FD' }}>{exactPts} pts</strong> si lo clavas
        </span>
        <span style={{
          fontFamily: 'var(--font-sport)', fontSize: 8, fontWeight: 800,
          color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>Elige ganador primero</span>
      </div>
    )
  }

  // ── 2. Con pick, sin marcador ──
  if (!exactScore) {
    return (
      <div style={{ marginTop: 10 }}>
        {showTooltip && (
          <div
            role="tooltip"
            // En el flujo, no flotando. Iba en `position:absolute; bottom:100%`
            // y se montaba encima de los botones 1·X·2 —muy visible en el
            // Partido del Día, que ocupa el ancho completo—, tapando justo lo
            // que el usuario tiene que pulsar.
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8,
              padding: '8px 10px', borderRadius: 10,
              background: 'linear-gradient(145deg, rgba(167,139,250,0.28) 0%, rgba(124,58,237,0.18) 100%)',
              border: '1px solid rgba(196,181,253,0.5)',
              animation: 'fFadeInUp 0.3s ease-out both',
            }}
          >
            <span style={{ display: 'inline-flex', lineHeight: 1 }} aria-hidden><LightbulbIcon size={14} /></span>
            <p style={{
              flex: 1, margin: 0, fontFamily: 'var(--font-sport)', fontSize: 11, fontWeight: 700,
              color: '#fff', lineHeight: 1.35, letterSpacing: '0.01em',
            }}>
              ¿Te atreves con el marcador? Cambias tus {tendencyPts} pts por{' '}
              <strong style={{ color: '#FDE68A' }}>{exactPts}</strong> — pero si no lo clavas, ese partido vale 0.
            </p>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onTooltipDismiss?.() }}
              aria-label="Cerrar consejo"
              style={{
                flexShrink: 0, width: 18, height: 18, borderRadius: 4,
                background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.55)',
                cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 0,
              }}
            >✕</button>
          </div>
        )}
        {/* Ya no hay cupo que gastar, así que el botón no se deshabilita nunca:
            lo único que hay que comunicar es el CANJE. El "en vez de N" va en
            el propio botón —no en un tooltip que se descarta— porque es la
            mitad de la decisión y tiene que seguir ahí la décima vez. */}
        <button
          type="button"
          onClick={() => {
            onSet({ home: 0, away: 0 })
            setEditorOpen(true)
            onTooltipDismiss?.()
          }}
          disabled={submitting}
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '10px 12px', borderRadius: 'var(--radius-card)',
            background: 'linear-gradient(145deg, rgba(167,139,250,0.18) 0%, rgba(124,58,237,0.08) 100%)',
            border: '1px solid rgba(167,139,250,0.4)',
            color: '#E9D5FF',
            cursor: submitting ? 'wait' : 'pointer',
            fontFamily: 'var(--font-sport)',
          }}
        >
          <span style={{ display: 'inline-flex', lineHeight: 1 }} aria-hidden><TargetIcon size={14} /></span>
          <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Apostar al marcador
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            padding: '2px 7px', borderRadius: 999,
            background: 'rgba(196,181,253,0.16)', color: '#C4B5FD',
            fontSize: 9, fontWeight: 900, letterSpacing: '0.06em',
          }}>{exactPts} PTS</span>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
            color: 'rgba(255,255,255,0.42)',
          }}>en vez de {tendencyPts}</span>
        </button>
      </div>
    )
  }

  // ── 3a. Resumen compacto ──
  if (!editorOpen) {
    return (
      <div style={{
        marginTop: 10, padding: '8px 12px', borderRadius: 'var(--radius-card)',
        background: 'linear-gradient(145deg, rgba(167,139,250,0.12) 0%, rgba(124,58,237,0.04) 100%)',
        border: '1px solid rgba(167,139,250,0.32)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ display: 'inline-flex', lineHeight: 1 }} aria-hidden><TargetIcon size={14} /></span>
        <span style={{
          fontFamily: 'var(--font-sport)', fontSize: 9, fontWeight: 900,
          color: '#C4B5FD', letterSpacing: '0.08em',
        }}>MI APUESTA</span>
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 900,
          color: '#fff', letterSpacing: '0.02em', lineHeight: 1,
        }}>{exactScore.home} - {exactScore.away}</span>
        {/* El "o 0" viaja con el marcador hasta el cierre: si solo apareciera
            al elegirlo, al repasar la Jornada parecería puntos asegurados. */}
        <span style={{
          fontFamily: 'var(--font-sport)', fontSize: 9, fontWeight: 800,
          color: 'rgba(196,181,253,0.62)', letterSpacing: '0.05em',
        }}>{exactPts} pts o 0</span>
        <button
          type="button"
          onClick={() => setEditorOpen(true)}
          disabled={submitting}
          aria-label="Editar mi apuesta al marcador"
          title="Puedes cambiarla o retirarla hasta 1 h antes del partido"
          style={{
            marginLeft: 'auto',
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 'var(--radius-md)',
            background: 'rgba(196,181,253,0.14)', border: '1px solid rgba(196,181,253,0.32)',
            color: '#C4B5FD', fontFamily: 'var(--font-sport)', fontSize: 9, fontWeight: 900,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            cursor: submitting ? 'wait' : 'pointer',
          }}
        >✎ Editar</button>
      </div>
    )
  }

  // ── 3b. Editor abierto ──
  return (
    <div style={{
      marginTop: 10, padding: '10px 12px', borderRadius: 14,
      background: 'linear-gradient(145deg, rgba(167,139,250,0.16) 0%, rgba(124,58,237,0.08) 100%)',
      border: '1px solid rgba(167,139,250,0.4)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ display: 'inline-flex', lineHeight: 1 }} aria-hidden><TargetIcon size={12} /></span>
        <span style={{
          fontFamily: 'var(--font-sport)', fontSize: 9, fontWeight: 900,
          color: '#C4B5FD', letterSpacing: '0.1em',
        }}>MI APUESTA</span>
        <span style={{
          fontFamily: 'var(--font-sport)', fontSize: 8, fontWeight: 800,
          color: 'rgba(196,181,253,0.5)', letterSpacing: '0.06em',
        }}>{exactPts} PTS SI LO CLAVAS · 0 SI NO</span>
        <button
          type="button"
          onClick={() => setEditorOpen(false)}
          disabled={submitting}
          aria-label="Cerrar editor (mantiene tu marcador guardado)"
          style={{
            marginLeft: 'auto', width: 22, height: 22, borderRadius: 'var(--radius-sm)',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.5)', cursor: submitting ? 'wait' : 'pointer',
            fontSize: 12, lineHeight: 1, padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >✕</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
        <ScoreStepper
          value={exactScore.home}
          onChange={(v) => onSet({ home: v, away: exactScore.away })}
          label={short(event.team_home ?? 'Local')}
          disabled={submitting}
        />
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 900,
          color: 'rgba(255,255,255,0.3)', alignSelf: 'center', paddingBottom: 4,
        }}>–</span>
        <ScoreStepper
          value={exactScore.away}
          onChange={(v) => onSet({ home: exactScore.home, away: v })}
          label={short(event.team_away ?? 'Visita')}
          disabled={submitting}
        />
      </div>

      <div style={{
        marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(167,139,250,0.18)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}>
        <button
          type="button"
          onClick={() => { onSet(null); setEditorOpen(false) }}
          disabled={submitting}
          style={{
            background: 'transparent', border: 'none', padding: 0,
            color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-sport)',
            fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
            cursor: submitting ? 'wait' : 'pointer', textDecoration: 'underline',
            textUnderlineOffset: 3,
          }}
        >Volver a {tendencyPts} pts</button>
        <button
          type="button"
          onClick={() => setEditorOpen(false)}
          disabled={submitting}
          style={{
            padding: '5px 14px', borderRadius: 'var(--radius-md)',
            background: 'rgba(196,181,253,0.18)', border: '1px solid rgba(196,181,253,0.36)',
            color: '#C4B5FD', fontFamily: 'var(--font-sport)', fontSize: 10, fontWeight: 900,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            cursor: submitting ? 'wait' : 'pointer',
          }}
        >✓ Cerrar</button>
      </div>
    </div>
  )
}
