'use client'

// ── UfcClient ─────────────────────────────────────────────────────────────
// Interfaz de predicciones UFC Ranked.
//
// Pick: 'a' (Fighter A gana) | 'b' (Fighter B gana)
// Método opcional: 'KO' | 'SUB' | 'DEC'
// Lock: 30 min antes del fight
// Featured = main event (doble puntos)
//
// Puntos (escala migración 066):
//   Ganador correcto:        1 pt normal  / 2 pts featured
//   Ganador + método:        3 pts normal / 4 pts featured  (método = +2 plano)

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TakaPoint from '@/components/TakaPoint'

// ── Types ─────────────────────────────────────────────────────────────────

interface UfcEvent {
  id:          string
  sport:       'ufc'
  competition: string
  event_date:  string
  fighter_a:   string | null
  fighter_b:   string | null
  featured:    boolean
  status:      'open' | 'closed' | 'resolved'
  result:      { winner: 'a' | 'b'; method: 'KO' | 'SUB' | 'DEC' | null } | null
  meta:        { venue?: string; city?: string; espn_id?: string; ppv_id?: string; card_position?: number; card_total?: number } | null
}

interface UfcPredRow {
  event_id:       string
  prediction:     {
    pick: 'a' | 'b'
    method?: 'KO' | 'SUB' | 'DEC'
  }
  points_awarded: number | null
  is_correct:     boolean | null
}

type PredMap = Record<string, UfcPredRow>

type Method = 'KO' | 'SUB' | 'DEC'

/** Una velada UFC = todos los combates de un mismo evento ESPN. */
interface Velada {
  key:         string
  name:        string
  fights:      UfcEvent[]
  minDate:     number
  maxDate:     number
  allResolved: boolean
}

// ── Date helpers (Europe/Madrid, no UTC) ───────────────────────────────────
// Antes se mostraba la hora en UTC ("21:00 UTC"), confuso para el usuario
// español. Formateamos en la zona de Madrid, como el resto del ecosistema.

const DAYS_ES   = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const WD_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
const MADRID_FMT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Madrid', weekday: 'short', day: '2-digit',
  month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})
function madridParts(iso: string) {
  const parts = MADRID_FMT.formatToParts(new Date(iso))
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  return { wd: WD_INDEX[get('weekday')] ?? 0, day: Number(get('day')), mon: Number(get('month')) - 1, hh: get('hour'), mm: get('minute') }
}
function toDateLabel(iso: string): string {
  const p = madridParts(iso)
  return `${DAYS_ES[p.wd]} ${p.day} ${MONTHS_ES[p.mon]}`
}
function toTimeLabel(iso: string): string {
  const p = madridParts(iso)
  return `${p.hh}:${p.mm}`
}

/** Devuelve ms hasta el lock (30 min antes del fight). Negativo si ya bloqueado. */
function msUntilLock(eventDate: string): number {
  const lockAt = new Date(eventDate).getTime() - 30 * 60 * 1000
  return lockAt - Date.now()
}
function formatLock(ms: number): string {
  if (ms <= 0) return '0 min'
  const totalMins = Math.ceil(ms / 60_000)
  if (totalMins >= 120) return `${Math.floor(totalMins / 60)}h ${totalMins % 60}m`
  if (totalMins >= 60)  return `1h ${totalMins - 60}m`
  return `${totalMins} min`
}

// ── Design tokens ─────────────────────────────────────────────────────────

const RED   = '#F87171'
const RED2  = '#EF4444'
const BG_CARD  = 'linear-gradient(145deg, #1A1111 0%, #130E0E 100%)'
const BG_FEAT  = 'linear-gradient(145deg, #1E0808 0%, #150404 100%)'

// ── Animations ────────────────────────────────────────────────────────────

const ANIMATIONS = `
  @keyframes uFadeIn    { from{opacity:0} to{opacity:1} }
  @keyframes uFadeInUp  { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  @keyframes uFloat     { 0%,100%{transform:translateY(0) rotate(-1deg)} 50%{transform:translateY(-8px) rotate(1deg)} }
  @keyframes uRedPulse  { 0%,100%{box-shadow:0 0 20px #F8717118} 50%{box-shadow:0 0 48px #F8717135,0 0 80px #F8717115} }
  @keyframes uCardIn    { from{opacity:0;transform:translateY(16px) scale(0.985)} to{opacity:1;transform:none} }
  @keyframes uLivePulse { 0%,100%{opacity:1} 50%{opacity:0.25} }

  .u-hero  { animation: uFadeIn 0.5s ease-out both }
  .u-title { animation: uFadeInUp 0.5s ease-out 0.05s both }
  .u-strip { animation: uFadeInUp 0.5s ease-out 0.18s both }
  .u-cta   { animation: uFadeInUp 0.5s ease-out 0.24s both }
  .u-group { animation: uFadeInUp 0.4s ease-out both }
  .u-glove { animation: uFloat 4s ease-in-out infinite; display:inline-block }
  .u-feat  { animation: uRedPulse 2.5s ease-in-out infinite }
  .u-live  { animation: uLivePulse 1.2s ease-in-out infinite }

  .fight-pick-btn {
    transition: transform 0.13s ease, filter 0.13s ease, box-shadow 0.13s ease !important;
    will-change: transform;
    position: relative; overflow: hidden;
  }
  .fight-pick-btn::after {
    content: '';
    position: absolute; inset: 0;
    opacity: 0;
    background: radial-gradient(ellipse at center, rgba(255,255,255,0.15) 0%, transparent 70%);
    transition: opacity 0.2s ease;
    pointer-events: none; border-radius: inherit;
  }
  .fight-pick-btn:hover:not(:disabled)::after { opacity: 1 }
  .fight-pick-btn:hover:not(:disabled) {
    transform: translateY(-3px) scale(1.03) !important;
    filter: brightness(1.18) !important;
    box-shadow: 0 8px 28px rgba(0,0,0,0.45) !important;
  }
  .fight-pick-btn:active:not(:disabled) {
    transform: translateY(0) scale(0.96) !important;
    filter: brightness(0.92) !important;
  }
  .fight-card {
    transition: transform 0.18s ease, box-shadow 0.18s ease !important;
    will-change: transform;
  }
  .fight-card:hover { transform:translateY(-4px) !important; box-shadow:0 16px 48px rgba(0,0,0,0.55) !important }
`

// ── FighterPickButton ─────────────────────────────────────────────────────

function FighterPickButton({
  name, side, active, correct, wrong, disabled, onClick,
}: {
  name:     string
  side:     'a' | 'b'
  active:   boolean
  correct:  boolean
  wrong:    boolean
  disabled: boolean
  onClick:  () => void
}) {
  let bg     = 'rgba(255,255,255,0.05)'
  let border = 'rgba(255,255,255,0.12)'
  let color  = 'rgba(255,255,255,0.55)'
  let shadow = 'none'

  if (correct) {
    bg = 'linear-gradient(145deg, rgba(74,222,128,0.18) 0%, rgba(34,197,94,0.10) 100%)'
    border = 'rgba(74,222,128,0.5)'; color = '#4ADE80'
    shadow = '0 0 20px rgba(74,222,128,0.15)'
  } else if (wrong) {
    bg = 'rgba(239,68,68,0.08)'
    border = 'rgba(239,68,68,0.3)'; color = 'rgba(239,68,68,0.55)'
  } else if (active) {
    bg = `linear-gradient(145deg, ${RED}28 0%, ${RED}14 100%)`
    border = `${RED}80`; color = RED
    shadow = `0 0 24px ${RED}22, inset 0 1px 0 ${RED}30`
  }

  const shortFighterName = (n: string) => {
    // "Jon Jones" → "J. Jones" si muy largo
    const parts = n.trim().split(' ')
    if (n.length <= 14 || parts.length < 2) return n
    return `${parts[0][0]}. ${parts.slice(1).join(' ')}`
  }

  return (
    <button
      className="fight-pick-btn"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={`${name}, ${side === 'a' ? 'luchador A' : 'luchador B'}${correct ? ', acertaste' : wrong ? ', fallaste' : active ? ', elegido' : ''}`}
      style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: '16px 10px 14px',
        borderRadius: 16, background: bg,
        border: `1.5px solid ${border}`,
        color, cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'var(--font-sport)',
        minWidth: 0, minHeight: 96,
        boxShadow: shadow,
      }}
    >
      {/* Side indicator */}
      <span style={{
        fontSize: 9, fontWeight: 900, letterSpacing: '0.12em',
        textTransform: 'uppercase', opacity: 0.55,
        color: active || correct ? color : 'rgba(255,255,255,0.35)',
      }}>
        {side === 'a' ? 'Luchador A' : 'Luchador B'}
      </span>
      {/* Fighter name */}
      <span style={{
        fontSize: 12, fontWeight: 900, letterSpacing: '0.04em',
        textTransform: 'uppercase', lineHeight: 1.2, textAlign: 'center',
        maxWidth: '100%', wordBreak: 'break-word',
      }}>
        {shortFighterName(name)}
      </span>
      {/* Gana badge */}
      <span style={{
        fontSize: 8, fontWeight: 700, letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: active || correct ? color : 'rgba(255,255,255,0.2)',
      }}>
        {correct ? '✓ CORRECTO' : wrong ? '✗ FALLADO' : active ? '✓ ELEGIDO' : 'GANA'}
      </span>
    </button>
  )
}

// ── MethodPicker ──────────────────────────────────────────────────────────

function MethodPicker({
  value, onChange, disabled, isResolved, resultMethod,
}: {
  value:        Method | null
  onChange:     (v: Method | null) => void
  disabled:     boolean
  isResolved:   boolean
  resultMethod: Method | null | undefined
}) {
  const METHODS: { id: Method; label: string; sublabel: string }[] = [
    { id: 'KO',  label: 'KO / TKO', sublabel: 'Knockout' },
    { id: 'SUB', label: 'SUB',       sublabel: 'Submission' },
    { id: 'DEC', label: 'DEC',       sublabel: 'Decision' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ fontSize: 9, fontWeight: 800, color: 'rgba(248,113,113,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'var(--font-sport)' }}>
          🎯 Método de victoria
        </span>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.22)', fontFamily: 'var(--font-sport)' }}>
          +2 pts extra
        </span>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {METHODS.map(m => {
          const isActive  = value === m.id
          const isCorrect = isResolved && resultMethod === m.id && value === m.id
          const isWrong   = isResolved && value === m.id && resultMethod !== m.id
          const isReal    = isResolved && resultMethod === m.id

          let bg     = 'rgba(255,255,255,0.04)'
          let border = 'rgba(255,255,255,0.1)'
          let color  = 'rgba(255,255,255,0.4)'

          if (isCorrect) {
            bg = 'rgba(74,222,128,0.12)'; border = 'rgba(74,222,128,0.4)'; color = '#4ADE80'
          } else if (isWrong) {
            bg = 'rgba(239,68,68,0.06)'; border = 'rgba(239,68,68,0.25)'; color = 'rgba(239,68,68,0.5)'
          } else if (isReal && isResolved) {
            // El método real pero el user no lo eligió
            bg = 'rgba(74,222,128,0.05)'; border = 'rgba(74,222,128,0.2)'; color = 'rgba(74,222,128,0.45)'
          } else if (isActive) {
            bg = `rgba(248,113,113,0.14)`; border = `rgba(248,113,113,0.45)`; color = RED
          }

          return (
            <button
              key={m.id}
              onClick={() => !disabled && onChange(isActive ? null : m.id)}
              disabled={disabled}
              aria-pressed={isActive}
              aria-label={`Método ${m.label} (${m.sublabel})${isCorrect ? ', acertaste' : isWrong ? ', fallaste' : isActive ? ', elegido' : ''}`}
              style={{
                flex: 1, padding: '8px 4px',
                borderRadius: 10, border: `1px solid ${border}`,
                background: bg, color,
                cursor: disabled ? 'default' : 'pointer',
                fontFamily: 'var(--font-sport)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 2,
                transition: 'all 0.13s ease',
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.06em' }}>
                {m.label}
              </span>
              <span style={{ fontSize: 7, opacity: 0.65, letterSpacing: '0.06em' }}>
                {m.sublabel}
              </span>
              {isCorrect && <span style={{ fontSize: 7, color: '#4ADE80' }}>✓ HIT</span>}
              {isWrong && <span style={{ fontSize: 7, color: 'rgba(239,68,68,0.6)' }}>✗ FALLO</span>}
              {isReal && !isActive && <span style={{ fontSize: 7, color: 'rgba(74,222,128,0.55)' }}>← real</span>}
            </button>
          )
        })}
        {/* Botón "Ninguno" si hay algo seleccionado */}
        {value !== null && !disabled && (
          <button
            onClick={() => onChange(null)}
            aria-label="Quitar método elegido"
            style={{
              padding: '8px 6px', borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(255,255,255,0.02)',
              color: 'rgba(255,255,255,0.2)',
              cursor: 'pointer', fontFamily: 'var(--font-sport)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 2,
              fontSize: 8, letterSpacing: '0.06em',
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}

// ── FightCard ─────────────────────────────────────────────────────────────

function FightCard({
  event,
  prediction,
  submitting,
  onPick,
  onClear,
}: {
  event:      UfcEvent
  prediction: UfcPredRow | undefined
  submitting: string | null
  onPick:     (eventId: string, pick: 'a' | 'b', method: Method | null) => void
  onClear:    (eventId: string) => void
}) {
  const now   = Date.now()
  const lockMs = msUntilLock(event.event_date)
  const isOpen     = event.status === 'open'
  const isClosed   = event.status === 'closed'
  const isResolved = event.status === 'resolved'
  const isLocked   = isOpen && lockMs <= 0
  const isDisabled = !isOpen || isLocked || submitting === event.id

  const myPick   = prediction?.prediction?.pick   ?? null
  const myMethod = prediction?.prediction?.method ?? null
  const result   = event.result

  // Estado local del método (antes de guardar, en el momento de elegir)
  const [localMethod, setLocalMethod] = useState<Method | null>(myMethod ?? null)

  // Sync si llega predicción nueva
  useEffect(() => {
    setLocalMethod(myMethod ?? null)
  }, [myMethod])

  const fighterA = event.fighter_a ?? 'Fighter A'
  const fighterB = event.fighter_b ?? 'Fighter B'

  const isA = myPick === 'a'
  const isB = myPick === 'b'

  const winnerA = result?.winner === 'a'
  const winnerB = result?.winner === 'b'

  const correctA = isResolved && isA && winnerA
  const correctB = isResolved && isB && winnerB
  const wrongA   = isResolved && isA && !winnerA
  const wrongB   = isResolved && isB && !winnerB

  // Puntos ganados
  const pointsAwarded = prediction?.points_awarded
  const isCorrect     = prediction?.is_correct

  // Re-pulsar el luchador ya elegido = quitar el pick (toggle off). Antes solo
  // se podía cambiar de luchador, nunca des-elegir.
  function handlePickA() {
    if (isDisabled) return
    if (isA) { onClear(event.id); return }
    onPick(event.id, 'a', localMethod)
  }
  function handlePickB() {
    if (isDisabled) return
    if (isB) { onClear(event.id); return }
    onPick(event.id, 'b', localMethod)
  }

  function handleMethodChange(m: Method | null) {
    setLocalMethod(m)
    // Si ya tiene un pick, re-enviar con el nuevo método
    if (myPick && !isDisabled) {
      onPick(event.id, myPick, m)
    }
  }

  return (
    <div
      className="fight-card"
      style={{
        borderRadius: 20,
        background: event.featured ? BG_FEAT : BG_CARD,
        border: `1.5px solid ${event.featured ? 'rgba(248,113,113,0.25)' : 'rgba(255,255,255,0.07)'}`,
        overflow: 'hidden',
        boxShadow: event.featured ? '0 4px 32px rgba(248,113,113,0.08)' : '0 2px 16px rgba(0,0,0,0.3)',
        animation: 'uCardIn 0.4s ease-out both',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '12px 16px 10px',
        borderBottom: `1px solid ${event.featured ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.05)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {event.featured && (
            <span
              className="u-feat"
              style={{
                fontSize: 8, fontWeight: 900, letterSpacing: '0.12em',
                padding: '2px 8px', borderRadius: 20,
                background: 'rgba(248,113,113,0.15)',
                border: '1px solid rgba(248,113,113,0.4)',
                color: RED, fontFamily: 'var(--font-sport)',
                flexShrink: 0,
              }}
            >
              ⭐ MAIN EVENT
            </span>
          )}
          {/* Fecha / hora */}
          <span style={{
            fontSize: 9, color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-sport)',
            letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>
            {toDateLabel(event.event_date)} · {toTimeLabel(event.event_date)}
          </span>
        </div>

        {/* Status badge */}
        <div style={{ flexShrink: 0 }}>
          {isClosed && (
            <span style={{ fontSize: 9, color: '#F59E0B', fontFamily: 'var(--font-sport)', fontWeight: 700 }}>
              🔴 EN VIVO
            </span>
          )}
          {isResolved && (
            <span style={{
              fontSize: 9, fontFamily: 'var(--font-sport)', fontWeight: 700,
              color: isCorrect ? '#4ADE80' : 'rgba(255,255,255,0.3)',
            }}>
              {isCorrect ? `+${pointsAwarded ?? 0} pts` : 'Finalizado'}
            </span>
          )}
          {isOpen && !isLocked && lockMs < 3 * 60 * 60 * 1000 && (
            <span style={{ fontSize: 9, color: '#F59E0B', fontFamily: 'var(--font-sport)', fontWeight: 700 }}>
              ⏱ {formatLock(lockMs)}
            </span>
          )}
          {isLocked && (
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-sport)' }}>
              🔒 CERRADO
            </span>
          )}
        </div>
      </div>

      {/* VS zona */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
          <FighterPickButton
            name={fighterA}
            side="a"
            active={isA}
            correct={correctA}
            wrong={wrongA}
            disabled={isDisabled}
            onClick={handlePickA}
          />

          {/* VS divider */}
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 4, flexShrink: 0,
          }}>
            <span style={{
              fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,0.2)',
              fontFamily: 'var(--font-sport)', letterSpacing: '0.08em',
            }}>
              VS
            </span>
            {isResolved && result && (
              <span style={{
                fontSize: 8, color: 'rgba(255,255,255,0.35)',
                fontFamily: 'var(--font-sport)',
                whiteSpace: 'nowrap',
              }}>
                {result.winner === 'a' ? '←' : '→'}
              </span>
            )}
          </div>

          <FighterPickButton
            name={fighterB}
            side="b"
            active={isB}
            correct={correctB}
            wrong={wrongB}
            disabled={isDisabled}
            onClick={handlePickB}
          />
        </div>

        {/* Quitar pick — fix del "no me deja des-clickear" */}
        {myPick && isOpen && !isLocked && !isResolved && (
          <button
            onClick={() => onClear(event.id)}
            disabled={isDisabled}
            aria-label="Quitar mi pick de este combate"
            style={{
              marginTop: 10, width: '100%', padding: '7px 10px',
              borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.03)',
              color: 'rgba(255,255,255,0.45)',
              cursor: isDisabled ? 'default' : 'pointer',
              fontFamily: 'var(--font-sport)', fontSize: 9,
              fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            }}
          >
            ✕ Quitar pick
          </button>
        )}

        {/* Featured points hint */}
        {event.featured && !isResolved && (
          <div style={{
            marginTop: 10,
            padding: '6px 10px',
            borderRadius: 8,
            background: 'rgba(248,113,113,0.06)',
            border: '1px solid rgba(248,113,113,0.15)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ fontSize: 10 }}>⭐</span>
            <span style={{
              fontSize: 9, fontFamily: 'var(--font-sport)',
              color: 'rgba(248,113,113,0.7)', letterSpacing: '0.06em',
            }}>
              Main event · Ganador x2 · +2 pts (o +4 con método)
            </span>
          </div>
        )}

        {/* Resultado real si resuelto */}
        {isResolved && result && (
          <div style={{
            marginTop: 10, padding: '8px 12px', borderRadius: 10,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{
              fontSize: 9, color: 'rgba(255,255,255,0.4)',
              fontFamily: 'var(--font-sport)', letterSpacing: '0.06em',
            }}>
              Resultado:
              <span style={{ color: 'rgba(255,255,255,0.7)', marginLeft: 6 }}>
                {result.winner === 'a' ? fighterA : fighterB} gana
                {result.method ? ` por ${result.method}` : ''}
              </span>
            </span>
            {myPick && (
              <span style={{
                fontSize: 10, fontWeight: 900,
                color: isCorrect ? '#4ADE80' : '#EF4444',
                fontFamily: 'var(--font-sport)',
              }}>
                {isCorrect ? `+${pointsAwarded} pts` : '0 pts'}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Método de victoria — solo si tiene pick y no está resuelto */}
      {(myPick || (isResolved && myPick)) && (
        <div style={{ padding: '12px 16px 16px' }}>
          <MethodPicker
            value={isResolved ? (myMethod ?? null) : localMethod}
            onChange={handleMethodChange}
            disabled={isDisabled || isResolved}
            isResolved={isResolved}
            resultMethod={result?.method}
          />
        </div>
      )}

      {/* Sin pick aún, mostrar hint del método */}
      {!myPick && isOpen && !isLocked && (
        <div style={{ padding: '0 16px 14px' }}>
          <div style={{
            marginTop: 10, padding: '8px 12px', borderRadius: 10,
            background: 'rgba(248,113,113,0.04)',
            border: '1px solid rgba(248,113,113,0.1)',
          }}>
            <span style={{
              fontSize: 9, color: 'rgba(248,113,113,0.45)',
              fontFamily: 'var(--font-sport)', letterSpacing: '0.06em',
            }}>
              🎯 Elige al ganador para añadir también el método (+2 pts extra)
            </span>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {submitting === event.id && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 20,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 20, animation: 'uLivePulse 0.8s infinite' }}>🥊</span>
        </div>
      )}
    </div>
  )
}

// ── HistorialSection ──────────────────────────────────────────────────────
// Veladas ya disputadas. Colapsado por defecto para no estorbar la vista
// principal (decisión del user). Cada fila: fecha · nombre · puntos del user.

function HistorialSection({ veladas, predictions }: { veladas: Velada[]; predictions: PredMap }) {
  const [open, setOpen] = useState(false)

  const rows = veladas.map(v => {
    let pts = 0, picks = 0
    for (const f of v.fights) {
      const p = predictions[f.id]
      if (p) { picks++; pts += p.points_awarded ?? 0 }
    }
    return { v, pts, picks }
  })
  const totalPts = rows.reduce((a, r) => a + r.pts, 0)

  return (
    <div style={{ marginTop: 8, marginBottom: 24 }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 8, padding: '12px 16px', borderRadius: 12,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          color: 'rgba(255,255,255,0.55)', cursor: 'pointer',
          fontFamily: 'var(--font-sport)', fontSize: 11,
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          🗂 Historial
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>
            {veladas.length} velada{veladas.length === 1 ? '' : 's'}
          </span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {totalPts > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#A78BFA' }}>
              <TakaPoint size={13} /> {totalPts}
            </span>
          )}
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>{open ? '▲' : '▼'}</span>
        </span>
      </button>

      {open && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map(({ v, pts, picks }) => (
            <div
              key={v.key}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 12, padding: '10px 14px', borderRadius: 10,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 9, color: 'rgba(255,255,255,0.35)',
                  fontFamily: 'var(--font-sport)', letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>
                  {toDateLabel(new Date(v.maxDate).toISOString())}
                </div>
                <div style={{
                  fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 700,
                  fontFamily: 'var(--font-sport)', whiteSpace: 'nowrap',
                  overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '60vw',
                }}>
                  {v.name}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                {picks > 0 ? (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontFamily: 'var(--font-display)', fontWeight: 900,
                    color: pts > 0 ? '#A78BFA' : 'rgba(255,255,255,0.4)', fontSize: 14,
                  }}>
                    <TakaPoint size={13} /> {pts}
                  </div>
                ) : (
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-sport)' }}>
                    Sin picks
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── UfcClient (main) ──────────────────────────────────────────────────────

export default function UfcClient() {
  const [events,     setEvents]     = useState<UfcEvent[]>([])
  const [predictions, setPredictions] = useState<PredMap>({})
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [hasSession, setHasSession] = useState(false)

  // ── Carga inicial ────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const [evRes, prRes] = await Promise.all([
        fetch('/api/ranked/events?sport=ufc', { cache: 'no-store' }),
        fetch('/api/ranked/predictions?sport=ufc', { cache: 'no-store' }),
      ])

      if (evRes.ok) {
        const { events: evArr } = await evRes.json() as { events: UfcEvent[] }
        setEvents(evArr ?? [])
      }

      if (prRes.ok) {
        const { predictions: map } = await prRes.json() as { predictions: PredMap }
        setPredictions(map ?? {})
        setHasSession(true)
      } else if (prRes.status === 401) {
        setHasSession(false)
      }
    } catch (e) {
      setError('No se pudieron cargar los combates. Inténtalo de nuevo.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  // ── Polling cuando hay fights en vivo ────────────────────────────────
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const hasLive = events.some(e => e.status === 'closed')
    if (!hasLive) return
    pollRef.current = setTimeout(() => void load(), 30_000)
    return () => { if (pollRef.current) clearTimeout(pollRef.current) }
  }, [events, load])

  // ── Submit pick ──────────────────────────────────────────────────────
  const handlePick = useCallback(async (eventId: string, pick: 'a' | 'b', method: Method | null) => {
    if (!hasSession) return
    setSubmitting(eventId)
    try {
      const body: Record<string, unknown> = { event_id: eventId, pick }
      if (method) body.method = method

      const res = await fetch('/api/ranked/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const j = await res.json() as { error?: string; message?: string }
        const msg = j.message ?? j.error ?? 'Error al guardar'
        if (msg.includes('locked') || msg.includes('cerran')) {
          // Re-cargar para actualizar lock state
          void load()
        }
        return
      }

      const { prediction } = await res.json() as { prediction: UfcPredRow }
      if (prediction) {
        setPredictions(prev => ({
          ...prev,
          [eventId]: prediction,
        }))
      }
    } finally {
      setSubmitting(null)
    }
  }, [hasSession, load])

  // ── Quitar pick (des-elegir) ─────────────────────────────────────────
  const handleClear = useCallback(async (eventId: string) => {
    if (!hasSession) return
    setSubmitting(eventId)
    try {
      const res = await fetch('/api/ranked/predictions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId }),
      })
      if (res.ok) {
        setPredictions(prev => {
          const next = { ...prev }
          delete next[eventId]
          return next
        })
      } else if (res.status === 409) {
        void load()   // ya bloqueado/cerrado — refrescar estado
      }
    } finally {
      setSubmitting(null)
    }
  }, [hasSession, load])

  // ── Velada actual + historial ────────────────────────────────────────
  // El usuario solo quiere ver la PRÓXIMA velada (cartel completo). Las ya
  // disputadas van a un historial aparte. Agrupamos por evento ESPN (ppv_id):
  // antes se agrupaba por nombre y todas las "UFC Fight Night" se fundían.
  const { currentEvent, pastEvents } = useMemo(() => {
    const groups = new Map<string, UfcEvent[]>()
    for (const ev of events) {
      const key = ev.meta?.ppv_id ?? ev.competition
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(ev)
    }

    const list: Velada[] = []
    for (const [key, fights] of groups) {
      const dates = fights.map(f => new Date(f.event_date).getTime())
      list.push({
        key,
        name: fights[0].competition,
        fights,
        minDate: Math.min(...dates),
        maxDate: Math.max(...dates),
        allResolved: fights.every(f => f.status === 'resolved'),
      })
    }

    const now   = Date.now()
    const GRACE = 24 * 60 * 60 * 1000   // margen tras el último combate

    // Actual = velada más próxima que aún no ha terminado del todo.
    const current = list
      .filter(v => !v.allResolved && v.maxDate >= now - GRACE)
      .sort((a, b) => a.minDate - b.minDate)[0] ?? null

    // Pasadas = resueltas o ya disputadas (≠ actual), recientes primero.
    const past = list
      .filter(v => v !== current && (v.allResolved || v.maxDate < now - GRACE))
      .sort((a, b) => b.maxDate - a.maxDate)

    return { currentEvent: current, pastEvents: past }
  }, [events])

  // Combates de la velada actual en orden de cartel (estelar arriba).
  const cardFights = useMemo(() => {
    if (!currentEvent) return []
    return [...currentEvent.fights].sort((a, b) => {
      const pa = a.meta?.card_position ?? (a.featured ? 0 : 999)
      const pb = b.meta?.card_position ?? (b.featured ? 0 : 999)
      if (pa !== pb) return pa - pb
      return new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
    })
  }, [currentEvent])

  const totalPredicted = Object.keys(predictions).length
  const totalPoints = Object.values(predictions)
    .reduce((acc, p) => acc + (p.points_awarded ?? 0), 0)

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <>
      <style>{ANIMATIONS}</style>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div
        className="u-hero"
        style={{
          background: 'linear-gradient(180deg, rgba(248,113,113,0.08) 0%, transparent 100%)',
          borderBottom: '1px solid rgba(248,113,113,0.1)',
          padding: '32px 0 24px',
        }}
      >
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10">
          {/* Title */}
          <div className="u-title" style={{ textAlign: 'center', marginBottom: 20 }}>
            <div className="u-glove" style={{ fontSize: 48, marginBottom: 8 }}>🥊</div>
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(1.8rem, 4vw, 3rem)',
              fontWeight: 900,
              letterSpacing: '-0.03em',
              lineHeight: 1,
              color: '#fff',
            }}>
              Ranked UFC
            </h1>
            <p style={{
              marginTop: 8,
              color: 'rgba(255,255,255,0.45)',
              fontSize: 13,
              maxWidth: 380,
              margin: '8px auto 0',
            }}>
              Predice al ganador de cada combate. +2 pts extra si aciertas el método.
              Main event vale el doble.
            </p>
          </div>

          {/* Stats strip — si hay sesión */}
          {hasSession && (totalPredicted > 0 || totalPoints > 0) && (
            <div
              className="u-strip"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 24,
                padding: '10px 20px',
                borderRadius: 14,
                background: 'rgba(248,113,113,0.06)',
                border: '1px solid rgba(248,113,113,0.15)',
                maxWidth: 420,
                margin: '0 auto',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 900,
                  color: RED, letterSpacing: '-0.02em',
                }}>
                  {totalPredicted}
                </div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-sport)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Picks
                </div>
              </div>
              <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.08)' }} />
              <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', gap: 4 }}>
                <div>
                  <div style={{
                    fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 900,
                    color: '#A78BFA', letterSpacing: '-0.02em',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    <TakaPoint size={16} />
                    {totalPoints}
                  </div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-sport)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Pts ganados
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────── */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 py-6">

        {/* Auth hint */}
        {!hasSession && !loading && (
          <div style={{
            textAlign: 'center', padding: '32px 16px',
            borderRadius: 16, marginBottom: 24,
            background: 'rgba(248,113,113,0.05)',
            border: '1px solid rgba(248,113,113,0.12)',
          }}>
            <span style={{ fontSize: 32, display: 'block', marginBottom: 10 }}>🔒</span>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 16 }}>
              Inicia sesión para guardar tus predicciones y competir en el ranking
            </p>
            <a
              href="/auth"
              style={{
                display: 'inline-block', padding: '10px 24px',
                borderRadius: 12, background: RED,
                color: '#fff', fontFamily: 'var(--font-sport)',
                fontSize: 11, fontWeight: 900, letterSpacing: '0.08em',
                textTransform: 'uppercase', textDecoration: 'none',
              }}
            >
              Entrar
            </a>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <span style={{ fontSize: 36 }}>🥊</span>
            <p style={{ color: 'rgba(255,255,255,0.3)', marginTop: 12, fontSize: 13, fontFamily: 'var(--font-sport)' }}>
              Cargando combates…
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            padding: '16px 20px', borderRadius: 12, marginBottom: 20,
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
            color: '#FCA5A5', fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {/* Sin velada próxima */}
        {!loading && !error && !currentEvent && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>🥊</span>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 900,
              color: 'rgba(255,255,255,0.5)',
            }}>
              Sin combates próximos
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, marginTop: 8 }}>
              Los eventos UFC aparecen aquí cuando se anuncian. Vuelve pronto.
            </p>
          </div>
        )}

        {/* ── Velada actual — cartel completo (estelar arriba) ─────── */}
        {currentEvent && (() => {
          const hasLive = currentEvent.fights.some(f => f.status === 'closed')
          return (
            <div className="u-group" style={{ marginBottom: 40 }}>
              {/* Cabecera de la velada */}
              <div style={{ textAlign: 'center', marginBottom: 22 }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '5px 16px', borderRadius: 20, marginBottom: 12,
                  background: 'rgba(248,113,113,0.08)',
                  border: '1px solid rgba(248,113,113,0.2)',
                }}>
                  <span style={{ fontSize: 12 }}>🥊</span>
                  <span style={{
                    fontFamily: 'var(--font-sport)', fontSize: 10, fontWeight: 900,
                    color: RED, letterSpacing: '0.1em', textTransform: 'uppercase',
                  }}>
                    {hasLive ? 'En vivo' : 'Próxima velada'}
                  </span>
                  {hasLive && (
                    <span className="u-live" style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: '#EF4444', boxShadow: '0 0 6px #EF4444',
                      display: 'inline-block',
                    }} />
                  )}
                </div>
                <h2 style={{
                  fontFamily: 'var(--font-display)', fontSize: 'clamp(1.3rem, 3vw, 2rem)',
                  fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.1,
                }}>
                  {currentEvent.name}
                </h2>
                <div style={{
                  marginTop: 6, fontSize: 11, color: 'rgba(255,255,255,0.4)',
                  fontFamily: 'var(--font-sport)', letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>
                  {toDateLabel(new Date(currentEvent.minDate).toISOString())} · {cardFights.length} combate{cardFights.length === 1 ? '' : 's'}
                </div>
              </div>

              {/* Cartel completo */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: 16,
              }}>
                {cardFights.map((fight, fi) => (
                  <div key={fight.id} style={{ position: 'relative', animationDelay: `${fi * 0.06}s` }}>
                    <FightCard
                      event={fight}
                      prediction={predictions[fight.id]}
                      submitting={submitting}
                      onPick={handlePick}
                      onClear={handleClear}
                    />
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        {/* ── Historial — colapsable, sin estorbar ─────────────────── */}
        {pastEvents.length > 0 && (
          <HistorialSection veladas={pastEvents} predictions={predictions} />
        )}
      </div>
    </>
  )
}
