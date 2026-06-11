'use client'

// ── MundialClient ────────────────────────────────────────────────────────
// Interfaz de predicciones para el Mundial 2026.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TakaPoint from '@/components/TakaPoint'
import { TargetIcon, LightbulbIcon, StarIcon, LiveDotIcon, LockIcon, TrophyIcon, GalleryIcon, FootballIcon } from '@/components/icons/GameIcons'
import { trackPorraExactAdded, trackPorraExactRemoved } from '@/lib/analytics'

// ── Types ────────────────────────────────────────────────────────────────

interface RankedEvent {
  id:          string
  sport:       string
  competition: string
  event_date:  string
  team_home:   string | null
  team_away:   string | null
  featured:    boolean
  status:      'open' | 'closed' | 'resolved'
  result:      { winner: '1' | 'X' | '2'; home_score?: number; away_score?: number } | null
  meta:        { group?: string; venue?: string; city?: string }
}

interface PredictionRow {
  event_id:       string
  prediction:     {
    pick: '1' | 'X' | '2'
    /** ME1 — Marcador exacto opcional. +3 pts extra (+6 si featured)
     *  cuando coincide con el resultado real Y la tendencia es correcta.
     *  Máx 3 activos por user en eventos no resueltos. */
    exactScore?: { home: number; away: number }
  }
  points_awarded: number | null
  is_correct:     boolean | null
}

type PredMap = Record<string, PredictionRow>

// ── Flag emojis ──────────────────────────────────────────────────────────

const FLAGS: Record<string, string> = {
  'Argentina': '🇦🇷', 'Brazil': '🇧🇷', 'México': '🇲🇽', 'Mexico': '🇲🇽',
  'United States': '🇺🇸', 'USA': '🇺🇸', 'Canada': '🇨🇦',
  'Colombia': '🇨🇴', 'Ecuador': '🇪🇨', 'Peru': '🇵🇪', 'Chile': '🇨🇱',
  'Uruguay': '🇺🇾', 'Venezuela': '🇻🇪', 'Paraguay': '🇵🇾', 'Bolivia': '🇧🇴',
  'Costa Rica': '🇨🇷', 'Honduras': '🇭🇳', 'Panama': '🇵🇦',
  'Jamaica': '🇯🇲', 'Trinidad and Tobago': '🇹🇹',
  'Haiti': '🇭🇹', 'Curacao': '🇨🇼', 'Curaçao': '🇨🇼',
  'Guatemala': '🇬🇹', 'El Salvador': '🇸🇻', 'Cuba': '🇨🇺',
  'Antigua and Barbuda': '🇦🇬', 'Martinique': '🏴', 'Guadeloupe': '🏴',
  'Spain': '🇪🇸', 'France': '🇫🇷', 'Germany': '🇩🇪', 'Portugal': '🇵🇹',
  'Netherlands': '🇳🇱', 'Italy': '🇮🇹', 'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Croatia': '🇭🇷',
  'Belgium': '🇧🇪', 'Denmark': '🇩🇰', 'Austria': '🇦🇹', 'Switzerland': '🇨🇭',
  'Poland': '🇵🇱', 'Serbia': '🇷🇸', 'Turkey': '🇹🇷', 'Türkiye': '🇹🇷', 'Romania': '🇷🇴',
  'Czech Republic': '🇨🇿', 'Czechia': '🇨🇿',
  'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Hungary': '🇭🇺',
  'Slovakia': '🇸🇰', 'Slovenia': '🇸🇮', 'Ukraine': '🇺🇦', 'Greece': '🇬🇷',
  'Albania': '🇦🇱', 'Georgia': '🇬🇪', 'Wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
  'Sweden': '🇸🇪', 'Norway': '🇳🇴', 'Finland': '🇫🇮', 'Iceland': '🇮🇸',
  'Bosnia': '🇧🇦', 'Bosnia-Herzegovina': '🇧🇦', 'Bosnia and Herzegovina': '🇧🇦',
  'North Macedonia': '🇲🇰', 'Montenegro': '🇲🇪', 'Kosovo': '🇽🇰',
  'Luxembourg': '🇱🇺', 'Belarus': '🇧🇾', 'Bulgaria': '🇧🇬',
  'Morocco': '🇲🇦', 'Senegal': '🇸🇳', 'Nigeria': '🇳🇬', 'Egypt': '🇪🇬',
  'Ghana': '🇬🇭', 'Cameroon': '🇨🇲', 'Ivory Coast': '🇨🇮', 'Cote d\'Ivoire': '🇨🇮',
  'Tunisia': '🇹🇳', 'South Africa': '🇿🇦', 'Algeria': '🇩🇿',
  'Mali': '🇲🇱', 'Congo': '🇨🇩', 'Congo DR': '🇨🇩', 'DR Congo': '🇨🇩',
  'Cape Verde': '🇨🇻', 'Cabo Verde': '🇨🇻',
  'Zambia': '🇿🇲', 'Uganda': '🇺🇬', 'Tanzania': '🇹🇿', 'Kenya': '🇰🇪',
  'Libya': '🇱🇾', 'Ethiopia': '🇪🇹', 'Angola': '🇦🇴', 'Mozambique': '🇲🇿',
  'Burkina Faso': '🇧🇫', 'Guinea': '🇬🇳', 'Equatorial Guinea': '🇬🇶',
  'Japan': '🇯🇵', 'South Korea': '🇰🇷', 'Australia': '🇦🇺', 'Iran': '🇮🇷',
  'Saudi Arabia': '🇸🇦', 'Qatar': '🇶🇦', 'China': '🇨🇳', 'Indonesia': '🇮🇩',
  'Jordan': '🇯🇴', 'Iraq': '🇮🇶', 'Uzbekistan': '🇺🇿', 'Bahrain': '🇧🇭',
  'Oman': '🇴🇲', 'Palestine': '🇵🇸', 'Syria': '🇸🇾', 'Vietnam': '🇻🇳',
  'Thailand': '🇹🇭', 'Malaysia': '🇲🇾', 'Philippines': '🇵🇭',
  'United Arab Emirates': '🇦🇪', 'UAE': '🇦🇪', 'Kuwait': '🇰🇼',
  'New Zealand': '🇳🇿', 'Fiji': '🇫🇯', 'Papua New Guinea': '🇵🇬',
}

function flag(team: string | null): string {
  if (!team) return '🏳️'
  return FLAGS[team] ?? '🏴'
}

function shortName(name: string, max = 12): string {
  if (!name || name.length <= max) return name
  return name.slice(0, max - 1) + '…'
}

// ── Date helpers ─────────────────────────────────────────────────────────

const DAYS_ES   = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
// Fechas/horas en Europe/Madrid (no UTC). El agrupado por día (toDateKey) y
// su etiqueta (toDateLabel) usan la MISMA zona → quedan coherentes.
const WD_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
const MADRID_FMT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Madrid', weekday: 'short', day: '2-digit', month: '2-digit',
  year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})
function madridParts(iso: string) {
  const parts = MADRID_FMT.formatToParts(new Date(iso))
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  return { y: get('year'), mo: get('month'), d: get('day'), wd: WD_INDEX[get('weekday')] ?? 0, mon: Number(get('month')) - 1, hh: get('hour'), mm: get('minute') }
}
function toDateKey(iso: string): string { const p = madridParts(iso); return `${p.y}-${p.mo}-${p.d}` }
function toDateLabel(iso: string): string {
  const p = madridParts(iso)
  return `${DAYS_ES[p.wd]} ${Number(p.d)} ${MONTHS_ES[p.mon]}`
}
function toTimeLabel(iso: string): string {
  const p = madridParts(iso)
  return `${p.hh}:${p.mm}`
}

/** Devuelve ms hasta el lock (1h antes del partido). Negativo si ya está bloqueado. */
function msUntilLock(eventDate: string): number {
  const lockAt = new Date(eventDate).getTime() - 60 * 60 * 1000
  return lockAt - Date.now()
}

/** Formatea el tiempo restante al lock de forma legible */
function formatLock(ms: number): string {
  if (ms <= 0) return '0 min'
  const totalMins = Math.ceil(ms / 60_000)
  if (totalMins >= 120) return `${Math.floor(totalMins / 60)}h ${totalMins % 60}m`
  if (totalMins >= 60)  return `1h ${totalMins - 60}m`
  return `${totalMins} min`
}

// ── Design tokens ─────────────────────────────────────────────────────────

const GOLD     = '#FBBF24'
const GOLD2    = '#F59E0B'
const GOLD_D   = '#92400E'
// Card backgrounds — visibles, no transparentes
const BG_CARD  = 'linear-gradient(145deg, #1A1728 0%, #13111F 100%)'   // deep purple-dark
const BG_FEAT  = 'linear-gradient(145deg, #1E1608 0%, #150E02 100%)'   // deep amber-dark

// ── Animations & CSS ─────────────────────────────────────────────────────

const ANIMATIONS = `
  @keyframes mFadeIn      { from{opacity:0} to{opacity:1} }
  @keyframes mFadeInUp    { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  @keyframes mFloat       { 0%,100%{transform:translateY(0) rotate(-1deg)} 50%{transform:translateY(-8px) rotate(1deg)} }
  @keyframes mGoldPulse   { 0%,100%{box-shadow:0 0 20px #FBBF2418} 50%{box-shadow:0 0 48px #FBBF2435,0 0 80px #FBBF2415} }
  @keyframes mCardIn      { from{opacity:0;transform:translateY(16px) scale(0.985)} to{opacity:1;transform:none} }
  @keyframes mLivePulse   { 0%,100%{opacity:1} 50%{opacity:0.25} }
  @keyframes mPulse       { 0%,100%{transform:scale(1)} 50%{transform:scale(1.05)} }
  @keyframes mShimmer     {
    0%   { background-position:-300% center }
    100% { background-position:300% center }
  }

  .m-hero  { animation: mFadeIn 0.5s ease-out both }
  .m-title { animation: mFadeInUp 0.5s ease-out 0.05s both }
  .m-flags { animation: mFadeInUp 0.5s ease-out 0.12s both }
  .m-strip { animation: mFadeInUp 0.5s ease-out 0.18s both }
  .m-cta   { animation: mFadeInUp 0.5s ease-out 0.24s both }
  .m-group { animation: mFadeInUp 0.4s ease-out both }
  .m-trophy  { animation: mFloat 4s ease-in-out infinite; display:inline-block }
  .m-cd-box  { animation: mGoldPulse 2.5s ease-in-out infinite }
  .m-live    { animation: mLivePulse 1.2s ease-in-out infinite }

  /* Pick buttons */
  .pick-btn {
    transition: transform 0.13s ease, filter 0.13s ease, box-shadow 0.13s ease, background 0.13s ease !important;
    will-change: transform;
    position: relative;
    overflow: hidden;
  }
  .pick-btn::after {
    content: '';
    position: absolute;
    inset: 0;
    opacity: 0;
    background: radial-gradient(ellipse at center, rgba(255,255,255,0.15) 0%, transparent 70%);
    transition: opacity 0.2s ease;
    pointer-events: none;
    border-radius: inherit;
  }
  .pick-btn:hover:not(:disabled)::after { opacity: 1 }
  .pick-btn:hover:not(:disabled) {
    transform: translateY(-3px) scale(1.03) !important;
    filter: brightness(1.18) !important;
    box-shadow: 0 8px 28px rgba(0,0,0,0.45) !important;
  }
  .pick-btn:active:not(:disabled) {
    transform: translateY(0) scale(0.96) !important;
    filter: brightness(0.92) !important;
  }
  /* Match cards */
  .match-card {
    transition: transform 0.18s ease, box-shadow 0.18s ease !important;
    will-change: transform;
  }
  .match-card:hover { transform:translateY(-4px) !important; box-shadow:0 16px 48px rgba(0,0,0,0.55) !important }
`

// ── PickButton ────────────────────────────────────────────────────────────

function PickButton({
  label, flagEmoji, sublabel, active, correct, wrong, disabled, onClick,
}: {
  label: string; flagEmoji: string; sublabel?: string
  active: boolean; correct: boolean; wrong: boolean; disabled: boolean; onClick: () => void
}) {
  // Estado base
  let bg     = 'rgba(255,255,255,0.05)'
  let border = 'rgba(255,255,255,0.12)'
  let color  = 'rgba(255,255,255,0.55)'
  let sub    = 'rgba(255,255,255,0.25)'
  let shadow = 'none'
  let flagOp = '0.65'

  if (correct) {
    bg     = 'linear-gradient(145deg, rgba(74,222,128,0.18) 0%, rgba(34,197,94,0.10) 100%)'
    border = 'rgba(74,222,128,0.5)'; color = '#4ADE80'; sub = 'rgba(74,222,128,0.7)'
    shadow = '0 0 20px rgba(74,222,128,0.15)'; flagOp = '1'
  } else if (wrong) {
    bg     = 'rgba(239,68,68,0.08)'
    border = 'rgba(239,68,68,0.3)'; color = 'rgba(239,68,68,0.55)'; sub = 'rgba(239,68,68,0.4)'
    flagOp = '0.4'
  } else if (active) {
    bg     = `linear-gradient(145deg, ${GOLD}28 0%, ${GOLD}14 100%)`
    border = `${GOLD}80`; color = GOLD; sub = GOLD2
    shadow = `0 0 24px ${GOLD}22, inset 0 1px 0 ${GOLD}30`; flagOp = '1'
  }

  return (
    <button
      className="pick-btn"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={`${label}${correct ? ', acertaste' : wrong ? ', fallaste' : active ? ', elegido' : ''}`}
      style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 5,
        padding: '14px 8px 12px',
        borderRadius: 16, background: bg,
        border: `1.5px solid ${border}`,
        color, cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'var(--font-sport)',
        minWidth: 0, minHeight: 86,
        boxShadow: shadow,
      }}
    >
      {/* Flag */}
      <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1, opacity: parseFloat(flagOp) }}>
        {flagEmoji}
      </span>
      {/* Label */}
      <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.07em', textTransform: 'uppercase', lineHeight: 1 }}>
        {label}
      </span>
      {/* Sublabel */}
      {sublabel && (
        <span style={{
          fontSize: 8, color: sub, textTransform: 'uppercase', letterSpacing: '0.08em',
          maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1,
        }}>
          {shortName(sublabel)}
        </span>
      )}
      {/* Estado: acierto / fallo / elegido — no solo por color (✓/✗) */}
      {correct ? (
        <span style={{ fontSize: 8, color, letterSpacing: '0.12em', fontWeight: 900, marginTop: 1 }}>
          ✓ CORRECTO
        </span>
      ) : wrong ? (
        <span style={{ fontSize: 8, color, letterSpacing: '0.12em', fontWeight: 900, marginTop: 1 }}>
          ✗ FALLADO
        </span>
      ) : active ? (
        <span style={{ fontSize: 8, color: GOLD, letterSpacing: '0.12em', fontWeight: 900, marginTop: 1 }}>
          ✓ ELEGIDO
        </span>
      ) : null}
    </button>
  )
}

// ── ExactScoreBlock ───────────────────────────────────────────────────────
// Bloque del marcador exacto: discoverable, intuitivo, con estilo coherente
// (oro/morado, scoreboard real con steppers +/-).
//
// 4 estados visuales:
//   1. Sin pick + open → hint sutil "🎯 +N pts si clavas el marcador"
//   2. Con pick + sin exact + open → CTA gold "🎯 PREDECIR MARCADOR · +N pts"
//   3. Con pick + con exact + open → scoreboard editable con steppers
//   4. Resolved/closed + tenía exact → pill resultado (verde/naranja/gris)

function ScoreStepper({
  value, onChange, label, disabled,
}: {
  value: number
  onChange: (v: number) => void
  label: string
  disabled: boolean
}) {
  const clamp = (n: number) => Math.max(0, Math.min(20, n))
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      flex: 1, minWidth: 0,
    }}>
      <span style={{
        fontFamily: 'var(--font-sport)', fontSize: 9, fontWeight: 800,
        color: 'rgba(167,139,250,0.7)', letterSpacing: '0.08em',
        textTransform: 'uppercase',
        maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: 3, borderRadius: 10,
        background: 'rgba(0,0,0,0.32)',
        border: '1px solid rgba(167,139,250,0.28)',
      }}>
        <button
          type="button"
          onClick={() => onChange(clamp(value - 1))}
          disabled={disabled || value <= 0}
          aria-label={`Restar gol a ${label}`}
          style={{
            width: 22, height: 28, borderRadius: 6,
            background: value > 0 ? 'rgba(167,139,250,0.16)' : 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(167,139,250,0.22)',
            color: value > 0 ? '#C4B5FD' : 'rgba(255,255,255,0.2)',
            fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 900,
            cursor: disabled || value <= 0 ? 'not-allowed' : 'pointer',
            lineHeight: 1, padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >−</button>
        <span style={{
          minWidth: 26, textAlign: 'center',
          fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 900,
          color: '#fff', letterSpacing: '-0.02em', lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(clamp(value + 1))}
          disabled={disabled || value >= 20}
          aria-label={`Sumar gol a ${label}`}
          style={{
            width: 22, height: 28, borderRadius: 6,
            background: value < 20 ? 'rgba(167,139,250,0.16)' : 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(167,139,250,0.22)',
            color: value < 20 ? '#C4B5FD' : 'rgba(255,255,255,0.2)',
            fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 900,
            cursor: disabled || value >= 20 ? 'not-allowed' : 'pointer',
            lineHeight: 1, padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >+</button>
      </div>
    </div>
  )
}

function ExactScoreBlock({
  event, myPick, exactScore, isOpen, isLocked, isResolved, isClosed,
  winner, submitting, exactSlotAvailable, onSet,
  showTooltip, onTooltipDismiss,
}: {
  event: RankedEvent
  myPick: '1'|'X'|'2' | null
  exactScore: { home: number; away: number } | null
  isOpen: boolean
  isLocked: boolean
  isResolved: boolean
  isClosed: boolean
  winner: '1'|'X'|'2' | null
  submitting: boolean
  exactSlotAvailable: boolean
  onSet: (v: { home: number; away: number } | null) => void
  showTooltip?: boolean
  onTooltipDismiss?: () => void
}) {
  const bonusValue = event.featured ? 6 : 3
  // Editor controlado por el user: lo abre al CREAR uno nuevo, lo cierra
  // con ✕ (sin borrar) y lo reabre con "Editar". Mientras quede tiempo
  // (>1h antes del partido) siempre se puede reabrir.
  const [editorOpen, setEditorOpen] = useState(false)

  // ── 4. Modo lectura (resolved/closed + tenía exact) ──
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
    let statusText: React.ReactNode = `${exactScore.home} - ${exactScore.away}`
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
            background: 'rgba(74,222,128,0.22)',
            color: '#86EFAC',
            fontFamily: 'var(--font-sport)', fontSize: 9, fontWeight: 900,
            letterSpacing: '0.08em',
          }}>
            ✓ CLAVADO · +{bonusValue} PTS
          </span>
        )
      } else if (trendOk && realHome != null) {
        bg = 'rgba(249,115,22,0.08)'
        border = 'rgba(249,115,22,0.28)'
        labelColor = '#FED7AA'
        badge = (
          <span style={{
            fontFamily: 'var(--font-sport)', fontSize: 9, fontWeight: 700,
            color: 'rgba(255,255,255,0.55)', letterSpacing: '0.04em',
          }}>
            fue {realHome}-{realAway}
          </span>
        )
        statusText = `${exactScore.home} - ${exactScore.away}`
      } else {
        bg = 'rgba(255,255,255,0.03)'
        border = 'rgba(255,255,255,0.08)'
        labelColor = 'rgba(255,255,255,0.4)'
        statusText = `${exactScore.home} - ${exactScore.away}`
      }
    }

    return (
      <div style={{
        marginTop: 10, padding: '8px 10px', borderRadius: 12,
        background: bg, border: `1px solid ${border}`,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ display: 'inline-flex', lineHeight: 1 }} aria-hidden><TargetIcon size={14} /></span>
        <span style={{
          fontFamily: 'var(--font-sport)', fontSize: 9, fontWeight: 900,
          color: labelColor, letterSpacing: '0.08em',
        }}>
          MI MARCADOR
        </span>
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 900,
          color: '#fff', letterSpacing: '0.02em',
        }}>
          {statusText}
        </span>
        <span style={{ marginLeft: 'auto' }}>{badge}</span>
      </div>
    )
  }

  // Solo seguimos en eventos abiertos.
  if (!isOpen) return null

  // ── 1. Sin pick aún → hint sutil ──
  if (!myPick) {
    return (
      <div style={{
        marginTop: 10, padding: '8px 10px', borderRadius: 10,
        background: 'rgba(167,139,250,0.04)',
        border: '1px dashed rgba(167,139,250,0.18)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ display: 'inline-flex', lineHeight: 1, opacity: 0.6 }} aria-hidden><TargetIcon size={12} /></span>
        <span style={{
          flex: 1,
          fontFamily: 'var(--font-sport)', fontSize: 10, fontWeight: 700,
          color: 'rgba(167,139,250,0.65)', letterSpacing: '0.02em',
        }}>
          Marcador exacto · <strong style={{ color: '#C4B5FD' }}>+{bonusValue} pts</strong> si lo clavas
        </span>
        <span style={{
          fontFamily: 'var(--font-sport)', fontSize: 8, fontWeight: 800,
          color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          Elige ganador primero
        </span>
      </div>
    )
  }

  // ── 2. Con pick + sin exact → CTA llamativo ──
  if (!exactScore) {
    return (
      <div style={{ position: 'relative', marginTop: 10 }}>
        {/* AS3 — Tooltip de descubrimiento */}
        {showTooltip && exactSlotAvailable && (
          <div
            role="tooltip"
            style={{
              position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 6,
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '8px 10px', borderRadius: 10,
              background: 'linear-gradient(145deg, rgba(167,139,250,0.28) 0%, rgba(124,58,237,0.18) 100%)',
              border: '1px solid rgba(196,181,253,0.5)',
              boxShadow: '0 10px 24px rgba(124,58,237,0.32)',
              zIndex: 5,
              animation: 'mFadeInUp 0.3s ease-out both',
            }}
          >
            <span style={{ display: 'inline-flex', lineHeight: 1 }} aria-hidden><LightbulbIcon size={14} /></span>
            <p style={{
              flex: 1, margin: 0,
              fontFamily: 'var(--font-sport)', fontSize: 11, fontWeight: 700,
              color: '#fff', lineHeight: 1.35, letterSpacing: '0.01em',
            }}>
              ¿Te atreves con el marcador exacto? <strong style={{ color: '#FDE68A' }}>+{bonusValue} pts</strong> si lo clavas.
            </p>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onTooltipDismiss?.() }}
              aria-label="Cerrar consejo"
              style={{
                flexShrink: 0, width: 18, height: 18, borderRadius: 4,
                background: 'transparent', border: 'none',
                color: 'rgba(255,255,255,0.55)',
                cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 0,
              }}
            >✕</button>
            <span
              aria-hidden
              style={{
                position: 'absolute', bottom: -5, left: 18,
                width: 10, height: 10,
                background: 'rgba(196,181,253,0.32)',
                borderRight: '1px solid rgba(196,181,253,0.5)',
                borderBottom: '1px solid rgba(196,181,253,0.5)',
                transform: 'rotate(45deg)',
              }}
            />
          </div>
        )}
      <button
        type="button"
        onClick={() => {
          if (!exactSlotAvailable) return
          onSet({ home: 0, away: 0 })
          setEditorOpen(true)
          onTooltipDismiss?.()
        }}
        disabled={!exactSlotAvailable || submitting}
        className="exact-cta"
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '10px 12px', borderRadius: 12,
          background: exactSlotAvailable
            ? 'linear-gradient(145deg, rgba(167,139,250,0.18) 0%, rgba(124,58,237,0.08) 100%)'
            : 'rgba(255,255,255,0.025)',
          border: exactSlotAvailable
            ? '1px solid rgba(167,139,250,0.4)'
            : '1px dashed rgba(255,255,255,0.08)',
          color: exactSlotAvailable ? '#E9D5FF' : 'rgba(255,255,255,0.3)',
          cursor: exactSlotAvailable && !submitting ? 'pointer' : 'not-allowed',
          fontFamily: 'var(--font-sport)',
          boxShadow: exactSlotAvailable
            ? 'inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 12px rgba(124,58,237,0.12)'
            : 'none',
          transition: 'transform 0.12s ease, filter 0.12s ease, box-shadow 0.12s ease',
        }}
      >
        <span style={{ display: 'inline-flex', lineHeight: 1 }} aria-hidden><TargetIcon size={14} /></span>
        <span style={{
          fontSize: 11, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          {exactSlotAvailable ? 'Predecir marcador' : 'Marcador exacto (3/3 usados)'}
        </span>
        {exactSlotAvailable && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            padding: '2px 7px', borderRadius: 999,
            background: 'rgba(196,181,253,0.16)',
            color: '#C4B5FD',
            fontSize: 9, fontWeight: 900, letterSpacing: '0.06em',
          }}>
            +{bonusValue} PTS
          </span>
        )}
      </button>
      </div>
    )
  }

  // ── 3a. Con exact pero editor cerrado → summary compacto + "Editar" ──
  if (!editorOpen) {
    return (
      <div style={{
        marginTop: 10, padding: '8px 12px', borderRadius: 12,
        background: 'linear-gradient(145deg, rgba(167,139,250,0.12) 0%, rgba(124,58,237,0.04) 100%)',
        border: '1px solid rgba(167,139,250,0.32)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ display: 'inline-flex', lineHeight: 1 }} aria-hidden><TargetIcon size={14} /></span>
        <span style={{
          fontFamily: 'var(--font-sport)', fontSize: 9, fontWeight: 900,
          color: '#C4B5FD', letterSpacing: '0.08em',
        }}>
          MI MARCADOR
        </span>
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 900,
          color: '#fff', letterSpacing: '0.02em', lineHeight: 1,
        }}>
          {exactScore.home} - {exactScore.away}
        </span>
        <button
          type="button"
          onClick={() => setEditorOpen(true)}
          disabled={submitting}
          aria-label="Editar marcador exacto"
          title="Puedes editarlo hasta 1h antes del partido"
          style={{
            marginLeft: 'auto',
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 8,
            background: 'rgba(196,181,253,0.14)',
            border: '1px solid rgba(196,181,253,0.32)',
            color: '#C4B5FD',
            fontFamily: 'var(--font-sport)', fontSize: 9, fontWeight: 900,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            cursor: submitting ? 'wait' : 'pointer',
          }}
        >
          ✎ Editar
        </button>
      </div>
    )
  }

  // ── 3b. Editor scoreboard abierto ──
  const homeLabel = event.team_home ?? 'Local'
  const awayLabel = event.team_away ?? 'Visita'

  return (
    <div style={{
      marginTop: 10, padding: '10px 12px', borderRadius: 14,
      background: 'linear-gradient(145deg, rgba(167,139,250,0.16) 0%, rgba(124,58,237,0.08) 100%)',
      border: '1px solid rgba(167,139,250,0.4)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 16px rgba(124,58,237,0.12)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
      }}>
        <span style={{ display: 'inline-flex', lineHeight: 1 }} aria-hidden><TargetIcon size={12} /></span>
        <span style={{
          fontFamily: 'var(--font-sport)', fontSize: 9, fontWeight: 900,
          color: '#C4B5FD', letterSpacing: '0.1em',
        }}>
          MI MARCADOR
        </span>
        <span style={{
          fontFamily: 'var(--font-sport)', fontSize: 8, fontWeight: 800,
          color: 'rgba(196,181,253,0.5)', letterSpacing: '0.06em',
        }}>
          +{bonusValue} PTS SI LO CLAVAS
        </span>
        <button
          type="button"
          onClick={() => setEditorOpen(false)}
          disabled={submitting}
          aria-label="Cerrar editor (mantiene tu marcador guardado)"
          title="Cierra el editor. Tu marcador queda guardado y puedes volver a editarlo hasta 1h antes del partido."
          style={{
            marginLeft: 'auto',
            width: 22, height: 22, borderRadius: 6,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.5)',
            cursor: submitting ? 'wait' : 'pointer',
            fontSize: 12, lineHeight: 1, padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >✕</button>
      </div>

      {/* Scoreboard: home vs away */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 10,
      }}>
        <ScoreStepper
          value={exactScore.home}
          onChange={(v) => onSet({ home: v, away: exactScore.away })}
          label={shortName(homeLabel, 10)}
          disabled={submitting}
        />
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 900,
          color: 'rgba(255,255,255,0.3)', alignSelf: 'center', paddingBottom: 4,
          letterSpacing: '0.05em',
        }}>
          –
        </span>
        <ScoreStepper
          value={exactScore.away}
          onChange={(v) => onSet({ home: exactScore.home, away: v })}
          label={shortName(awayLabel, 10)}
          disabled={submitting}
        />
      </div>

      {/* Footer: Quitar (link sutil) + Cerrar (CTA) */}
      <div style={{
        marginTop: 10, paddingTop: 8,
        borderTop: '1px solid rgba(167,139,250,0.18)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}>
        <button
          type="button"
          onClick={() => {
            onSet(null)
            setEditorOpen(false)
          }}
          disabled={submitting}
          style={{
            background: 'transparent', border: 'none', padding: 0,
            color: 'rgba(255,255,255,0.4)',
            fontFamily: 'var(--font-sport)', fontSize: 9, fontWeight: 800,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            cursor: submitting ? 'wait' : 'pointer',
            textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.18)',
            textUnderlineOffset: 3,
          }}
        >
          Quitar marcador
        </button>
        <button
          type="button"
          onClick={() => setEditorOpen(false)}
          disabled={submitting}
          style={{
            padding: '5px 14px', borderRadius: 8,
            background: 'rgba(196,181,253,0.18)',
            border: '1px solid rgba(196,181,253,0.36)',
            color: '#C4B5FD',
            fontFamily: 'var(--font-sport)', fontSize: 10, fontWeight: 900,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            cursor: submitting ? 'wait' : 'pointer',
          }}
        >
          ✓ Cerrar
        </button>
      </div>
    </div>
  )
}

// ── MatchCard ─────────────────────────────────────────────────────────────

function MatchCard({
  event, pred, submitting, onPick, onExactSet, activeExactCount,
  showExactTooltip, onExactTooltipDismiss, animDelay = 0,
}: {
  event: RankedEvent; pred: PredictionRow | undefined
  submitting: boolean
  onPick: (id: string, pick: '1'|'X'|'2') => void
  /** ME3 — Set/unset del marcador exacto. null = quitar. */
  onExactSet: (id: string, exact: { home: number; away: number } | null) => void
  /** ME3 — Nº de exactos activos del user en eventos no resueltos (0..3). */
  activeExactCount: number
  /** AS3 — Render tooltip de descubrimiento en este card (solo el primero). */
  showExactTooltip?: boolean
  /** AS3 — Callback al dismissear el tooltip (✕ o usar el CTA). */
  onExactTooltipDismiss?: () => void
  animDelay?: number
}) {
  const myPick     = pred?.prediction?.pick ?? null
  const exactScore = pred?.prediction?.exactScore ?? null
  const isResolved = event.status === 'resolved'
  const isClosed   = event.status === 'closed'
  const winner     = event.result?.winner ?? null
  const pts        = pred?.points_awarded ?? null
  const [shared, setShared] = useState(false)
  const exactSlotAvailable = !!exactScore || activeExactCount < 3

  // Lock: 1h antes del partido (se recalcula en cada render por el tick)
  const lockMs  = msUntilLock(event.event_date)
  const isLocked = lockMs <= 0
  // isOpen = evento open en DB y todavía fuera de la ventana de lock
  const isOpen  = event.status === 'open' && !isLocked
  // Aviso visible si quedan menos de 6h para el lock
  const showLockWarning = event.status === 'open' && !isLocked && lockMs < 6 * 60 * 60 * 1000

  const picks: { label: string; flagEmoji: string; sub: string; val: '1'|'X'|'2' }[] = [
    { label: 'Local',  flagEmoji: flag(event.team_home), sub: event.team_home ?? '', val: '1' },
    { label: 'X',      flagEmoji: '⚖️',                  sub: 'Empate',              val: 'X' },
    { label: 'Visita', flagEmoji: flag(event.team_away), sub: event.team_away ?? '', val: '2' },
  ]

  const cardBg     = event.featured ? BG_FEAT : BG_CARD
  const accentColor= event.featured ? GOLD    : 'rgba(255,255,255,0.18)'
  const cardShadow = event.featured
    ? `0 4px 24px rgba(0,0,0,0.5), 0 0 0 0 transparent, inset 0 1px 0 ${GOLD}18`
    : '0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)'

  return (
    <div
      className="match-card"
      style={{
        background: cardBg,
        // Left accent bar via borderLeft override
        borderTop:    `1px solid ${event.featured ? `${GOLD}35` : 'rgba(255,255,255,0.1)'}`,
        borderRight:  `1px solid ${event.featured ? `${GOLD}20` : 'rgba(255,255,255,0.07)'}`,
        borderBottom: `1px solid ${event.featured ? `${GOLD}20` : 'rgba(255,255,255,0.07)'}`,
        borderLeft:   `3px solid ${accentColor}`,
        borderRadius: 18,
        padding: '14px 16px 14px 14px',
        display: 'flex', flexDirection: 'column', gap: 0,
        boxShadow: cardShadow,
        animation: `mCardIn 0.4s ease-out ${animDelay}ms both`,
      }}
    >
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        {event.featured && (
          <span style={{
            fontSize: 9, fontWeight: 900, padding: '3px 8px', borderRadius: 6,
            background: `linear-gradient(90deg,${GOLD}2A,${GOLD}14)`,
            border: `1px solid ${GOLD}55`, color: GOLD,
            fontFamily: 'var(--font-sport)', letterSpacing: '0.07em',
          }}><StarIcon size={9} className="inline-block align-middle mr-1" />DOBLE PUNTOS</span>
        )}
        {(event.meta?.group || event.meta?.city) && (
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '3px 7px', borderRadius: 6,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-sport)',
            textTransform: 'uppercase', letterSpacing: '0.07em',
          }}>{event.meta.group || event.meta.city}</span>
        )}
        {isClosed && (
          <span className="m-live" style={{ fontSize: 9, color: '#F87171', fontFamily: 'var(--font-sport)', fontWeight: 900, letterSpacing: '0.07em' }}>
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
            ⏱ {formatLock(lockMs)} para el cierre
          </span>
        )}
      </div>

      {/* ── Match area — dark inset ── */}
      <div style={{
        background: 'rgba(0,0,0,0.25)',
        borderRadius: 12,
        padding: '12px 10px',
        marginBottom: 12,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {/* Home team */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
          <span style={{ fontSize: 42, lineHeight: 1 }}>{flag(event.team_home)}</span>
          <span style={{
            fontSize: 12, fontWeight: 900, color: '#ECECF6',
            fontFamily: 'var(--font-sport)', lineHeight: 1.2, textAlign: 'right',
          }}>{event.team_home ?? '—'}</span>
        </div>

        {/* VS / Score box */}
        <div style={{
          width: 64, flexShrink: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        }}>
          {isResolved && event.result ? (
            <>
              <div style={{
                padding: '5px 10px', borderRadius: 8,
                background: `${GOLD}18`, border: `1px solid ${GOLD}30`,
              }}>
                <span style={{
                  fontSize: 20, fontWeight: 900, color: GOLD,
                  fontFamily: 'var(--font-display)', letterSpacing: '-0.03em', lineHeight: 1,
                }}>
                  {event.result.home_score ?? '?'}–{event.result.away_score ?? '?'}
                </span>
              </div>
              <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.22)', fontFamily: 'var(--font-sport)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Final
              </span>
            </>
          ) : (
            <>
              <span style={{
                fontSize: 13, fontWeight: 900, color: 'rgba(255,255,255,0.3)',
                fontFamily: 'var(--font-sport)', letterSpacing: '0.08em',
              }}>VS</span>
              <span style={{
                fontSize: 8, color: 'rgba(255,255,255,0.25)',
                fontFamily: 'var(--font-sport)', textAlign: 'center', lineHeight: 1.4,
              }}>{toTimeLabel(event.event_date)}</span>
            </>
          )}
        </div>

        {/* Away team */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 5 }}>
          <span style={{ fontSize: 42, lineHeight: 1 }}>{flag(event.team_away)}</span>
          <span style={{
            fontSize: 12, fontWeight: 900, color: '#ECECF6',
            fontFamily: 'var(--font-sport)', lineHeight: 1.2, textAlign: 'left',
          }}>{event.team_away ?? '—'}</span>
        </div>
      </div>

      {/* ── Pick buttons ── */}
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
              flagEmoji={p.flagEmoji}
              sublabel={p.sub}
              active={isActive}
              correct={isCorrect || isWinRow}
              wrong={isWrong}
              disabled={!isOpen || submitting}
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
        isLocked={isLocked}
        isResolved={isResolved}
        isClosed={isClosed}
        winner={winner}
        submitting={submitting}
        exactSlotAvailable={exactSlotAvailable}
        onSet={(v) => onExactSet(event.id, v)}
        showTooltip={showExactTooltip === true}
        onTooltipDismiss={onExactTooltipDismiss}
      />

      {/* ── Points earned ── */}
      {isResolved && myPick && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
          {pts != null && pts > 0 ? (
            <>
              <TakaPoint size={13} />
              <span style={{ fontSize: 11, fontWeight: 900, color: GOLD, fontFamily: 'var(--font-sport)' }}>+{pts} pts</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-sport)' }}>¡Acertaste!</span>
            </>
          ) : (
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-sport)' }}>
              Fallaste — ganó {winner === '1' ? event.team_home : winner === '2' ? event.team_away : 'el empate'}
            </span>
          )}
        </div>
      )}

      {/* ── Share pick ── */}
      {myPick && isOpen && (
        <button
          onClick={async () => {
            await sharePick(event.team_home, event.team_away, myPick)
            setShared(true); setTimeout(() => setShared(false), 3000)
          }}
          style={{
            alignSelf: 'flex-start', marginTop: 8,
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 8,
            background: `${GOLD}0E`, border: `1px solid ${GOLD}22`,
            color: GOLD_D, fontSize: 9, fontWeight: 900,
            fontFamily: 'var(--font-sport)', textTransform: 'uppercase',
            letterSpacing: '0.06em', cursor: 'pointer',
          }}
        >{shared ? '✓ Copiado' : '↗ Compartir pick'}</button>
      )}

      {/* ── Sin pick + no abierto ── */}
      {!myPick && !isOpen && (
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-sport)', marginTop: 8 }}>
          {isClosed ? 'Predicciones cerradas' : isLocked ? 'Picks bloqueados — partido en menos de 1h' : 'Sin predicción'}
        </span>
      )}
    </div>
  )
}

// ── Share helper ─────────────────────────────────────────────────────────

async function sharePick(teamHome: string | null, teamAway: string | null, pick: '1'|'X'|'2') {
  const label = pick === '1' ? teamHome ?? 'Local' : pick === '2' ? teamAway ?? 'Visita' : 'Empate'
  const text  = `Predigo: ${label} en ${teamHome ?? '?'} vs ${teamAway ?? '?'} — ¿Quién acierta más? 🏆`
  if (navigator.share) {
    try { await navigator.share({ title: 'Mi predicción en TakaSports', text, url: 'https://takasportsmedia.com/predicciones' }) }
    catch { /* cancelled */ }
  } else {
    await navigator.clipboard.writeText(`${text} takasportsmedia.com/predicciones`)
  }
}

// ── Countdown helpers ─────────────────────────────────────────────────────

function daysUntilKickoff(): number | null {
  const kickoff = new Date('2026-06-11T19:00:00Z')
  const now = new Date()
  if (now >= kickoff) return null
  return Math.ceil((kickoff.getTime() - now.getTime()) / 86_400_000)
}

function msUntilNextOpen(events: RankedEvent[]): number | null {
  const now   = Date.now()
  const opens = events.filter(e => e.status === 'open').map(e => new Date(e.event_date).getTime()).filter(t => t > now).sort((a,b) => a-b)
  if (!opens.length) return null
  const ms = opens[0] - now
  return ms < 86_400_000 ? ms : null
}

function formatCountdown(ms: number): string {
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60
  return h > 0 ? `${h}h ${String(m).padStart(2,'0')}m` : `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`
}

// ── Main component ───────────────────────────────────────────────────────

export default function MundialClient() {
  const [events,     setEvents]     = useState<RankedEvent[]>([])
  const [preds,      setPreds]      = useState<PredMap>({})
  const [loading,    setLoading]    = useState(true)
  const [loggedIn,   setLoggedIn]   = useState<boolean | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [showLogin,  setShowLogin]  = useState(false)
  const [tick,       setTick]       = useState(0)
  // AS3 — Tooltip de descubrimiento del marcador exacto. Una sola vez por
  // user, persistido en localStorage. Aparece en el primer evento donde
  // el user tiene pick y todavía no añadió exacto.
  const [exactTooltipDismissed, setExactTooltipDismissed] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' &&
        localStorage.getItem('mundial:exactTooltipDismissed') === '1'
    } catch { return true }
  })
  const dismissExactTooltip = useCallback(() => {
    setExactTooltipDismissed(true)
    try { localStorage.setItem('mundial:exactTooltipDismissed', '1') } catch { /* */ }
  }, [])
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [evRes, predRes] = await Promise.all([
        fetch('/api/ranked/events?sport=mundial'),
        fetch('/api/ranked/predictions?sport=mundial'),
      ])
      const evData   = await evRes.json()   as { events?: RankedEvent[] }
      const predData = await predRes.json() as { predictions?: PredMap; reason?: string }
      setEvents(evData.events ?? [])
      setPreds(predData.predictions ?? {})
      setLoggedIn(predData.reason !== 'no_session')
    } catch { setError('Error cargando partidos. Intenta de nuevo.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    tickRef.current = setInterval(() => setTick(t => t+1), 1000)
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [])

  // Función interna: envía POST a /api/ranked/predictions con el pick
  // actual + un exactScore opcional. La RPC del Mundial guarda el JSONB
  // completo, así que siempre necesitamos pasar pick + exactScore (o sin
  // exactScore si lo estamos quitando).
  const sendPrediction = useCallback(async (
    eventId: string,
    pick: '1'|'X'|'2',
    exactScore: { home: number; away: number } | null,
  ) => {
    if (submitting) return
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = { event_id: eventId, pick }
      if (exactScore) body.exactScore = exactScore
      const res = await fetch('/api/ranked/predictions', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.status === 401) { setShowLogin(true); return }
      if (res.status === 409) {
        // Puede ser pick_locked, event_closed, o exact_limit.
        try {
          const json = await res.json() as { error?: string; message?: string }
          if (json?.error === 'exact_limit') {
            setError(json.message ?? 'Ya tienes 3 marcadores exactos activos.')
            return
          }
        } catch { /* */ }
        await load(); return
      }
      if (!res.ok) throw new Error('error')
      const data = await res.json() as {
        prediction?: { event_id: string; prediction: PredictionRow['prediction'] }
      }
      if (data.prediction) {
        setPreds(prev => ({
          ...prev,
          [eventId]: {
            ...(prev[eventId] ?? {}),
            event_id: eventId, prediction: data.prediction!.prediction,
            points_awarded: prev[eventId]?.points_awarded ?? null,
            is_correct:     prev[eventId]?.is_correct ?? null,
          },
        }))
        try { window.dispatchEvent(new Event('taka:badge-check')) } catch { /* noop */ }
      }
    } catch { setError('No se pudo guardar la predicción.') }
    finally { setSubmitting(false) }
  }, [submitting, load])

  const handlePick = useCallback((eventId: string, pick: '1'|'X'|'2') => {
    // Preservar exact actual al cambiar la tendencia.
    const currentExact = preds[eventId]?.prediction?.exactScore ?? null
    void sendPrediction(eventId, pick, currentExact)
  }, [preds, sendPrediction])

  const handleExactSet = useCallback((
    eventId: string,
    exact: { home: number; away: number } | null,
  ) => {
    // Necesitamos el pick actual; sin pick no se debería poder llegar aquí
    // pero por defensa, si falta, no hacemos nada.
    const currentPick = preds[eventId]?.prediction?.pick
    if (!currentPick) return
    // AS4 — Analytics: solo eventos de transición (no spam al editar goles).
    const prev = preds[eventId]?.prediction?.exactScore ?? null
    if (!prev && exact) {
      // Conteo "después" para el slot (activeExactCount es el "antes").
      const ev = events.find(e => e.id === eventId)
      const openIds = new Set(events.filter(e => e.status !== 'resolved').map(e => e.id))
      const slotAfter = (openIds.has(eventId) ? 1 : 0) +
        Object.entries(preds).filter(([eid, p]) =>
          eid !== eventId && openIds.has(eid) && !!p?.prediction?.exactScore,
        ).length
      trackPorraExactAdded({ slot: slotAfter, featured: !!ev?.featured })
    } else if (prev && !exact) {
      const openIds = new Set(events.filter(e => e.status !== 'resolved').map(e => e.id))
      const remainingAfter = Object.entries(preds).filter(([eid, p]) =>
        eid !== eventId && openIds.has(eid) && !!p?.prediction?.exactScore,
      ).length
      trackPorraExactRemoved({ remaining: remainingAfter })
    }
    void sendPrediction(eventId, currentPick, exact)
  }, [preds, sendPrediction, events])

  // ME3 — Nº de exactos activos del user (en eventos NO resueltos). Sirve
  // para deshabilitar "+ Marcador exacto" cuando se alcanza el límite.
  const activeExactCount = useMemo(() => {
    const openIds = new Set(events.filter(e => e.status !== 'resolved').map(e => e.id))
    let count = 0
    for (const eid of Object.keys(preds)) {
      if (!openIds.has(eid)) continue
      if (preds[eid]?.prediction?.exactScore) count++
    }
    return count
  }, [events, preds])

  // AS3 — El primer evento (en orden de la grid) donde el user tiene pick
  // pero NO tiene exact aún recibe el tooltip de descubrimiento. Solo uno.
  const tooltipEventId = useMemo<string | null>(() => {
    if (exactTooltipDismissed) return null
    if (activeExactCount > 0) return null // ya usó al menos uno; ya descubrió
    const sortedEvents = [...events].sort((a, b) =>
      (a.event_date ?? '').localeCompare(b.event_date ?? ''),
    )
    for (const ev of sortedEvents) {
      if (ev.status !== 'open') continue
      const p = preds[ev.id]?.prediction
      if (p?.pick && !p?.exactScore) return ev.id
    }
    return null
  }, [events, preds, exactTooltipDismissed, activeExactCount])

  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; events: RankedEvent[] }>()
    for (const ev of events) {
      const key = toDateKey(ev.event_date)
      if (!map.has(key)) map.set(key, { label: toDateLabel(ev.event_date), events: [] })
      map.get(key)!.events.push(ev)
    }
    return [...map.entries()].sort(([a],[b]) => a.localeCompare(b))
  }, [events])

  const totalPts    = Object.values(preds).reduce((a,p) => a + (p.points_awarded ?? 0), 0)
  const myPicks     = Object.keys(preds).length
  const openCount   = events.filter(e => e.status === 'open').length
  const daysLeft    = daysUntilKickoff()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const nextMatchMs = useMemo(() => msUntilNextOpen(events), [events, tick])

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 pb-16">
      <style>{ANIMATIONS}</style>

      {/* ═══════════════════════ HERO ═══════════════════════════ */}
      <div
        className="m-hero relative rounded-2xl overflow-hidden mt-4 mb-10"
        style={{
          background: 'radial-gradient(ellipse 90% 120% at 15% 55%, #200E00 0%, #0D0920 45%, #060512 100%)',
          border: `1px solid rgba(251,191,36,0.16)`,
          boxShadow: `0 0 0 1px rgba(251,191,36,0.06), 0 32px 80px rgba(0,0,0,0.6)`,
        }}
      >
        {/* ── Decoración "2026" masivo ── */}
        <div
          aria-hidden
          style={{
            position: 'absolute', right: -36, bottom: -20,
            fontSize: 'clamp(9rem, 28vw, 22rem)',
            fontFamily: 'var(--font-display)', fontWeight: 900,
            color: 'transparent',
            WebkitTextStroke: `1.5px rgba(251,191,36,0.10)`,
            letterSpacing: '-0.07em', lineHeight: 1,
            pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap',
            mixBlendMode: 'screen',
          }}
        >2026</div>

        {/* ── Glows ── */}
        <div aria-hidden style={{ position:'absolute', top:-100, left:'10%', width:500, height:500, background:`radial-gradient(ellipse,${GOLD}0E 0%,transparent 60%)`, pointerEvents:'none' }} />
        <div aria-hidden style={{ position:'absolute', bottom:-80, right:'25%', width:320, height:320, background:'radial-gradient(ellipse,rgba(120,80,255,0.07) 0%,transparent 60%)', pointerEvents:'none' }} />

        {/* ── Noise texture ── */}
        <div
          aria-hidden
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage: `repeating-conic-gradient(rgba(255,255,255,0.013) 0% 25%, transparent 0% 50%) 0 0 / 3px 3px`,
          }}
        />

        {/* ── Content ── */}
        <div className="relative px-6 pt-7 pb-0">

          {/* Fila: título + countdown */}
          <div className="flex items-start justify-between gap-4 flex-wrap">

            {/* Título */}
            <div className="m-title flex flex-col gap-2">
              <span style={{ fontSize: 9, fontWeight: 900, fontFamily:'var(--font-sport)', color:`${GOLD}70`, textTransform:'uppercase', letterSpacing:'0.22em' }}>
                48 PARTIDOS · 1 CAMPEÓN · TUS PICKS
              </span>

              <div className="flex items-end gap-3">
                <span className="m-trophy" style={{ lineHeight: 1, color: GOLD, display: 'inline-flex' }}><TrophyIcon size={54} /></span>
                <div>
                  <h1 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(2.4rem, 6vw, 4rem)',
                    fontWeight: 900, color: GOLD,
                    letterSpacing: '-0.04em', lineHeight: 0.86,
                    textShadow: `0 0 80px ${GOLD}50, 0 2px 20px rgba(0,0,0,0.8)`,
                  }}>MUNDIAL</h1>
                  {/* Línea decorativa bajo el título */}
                  <div style={{
                    height: 2, marginTop: 6, marginBottom: 4,
                    background: `linear-gradient(to right, ${GOLD}80, ${GOLD}20, transparent)`,
                    borderRadius: 2,
                  }} />
                  <p style={{
                    fontFamily: 'var(--font-display)', fontSize: 'clamp(0.9rem,2.2vw,1.6rem)',
                    fontWeight: 900, color: `${GOLD}50`, letterSpacing: '0.20em', lineHeight: 1,
                  }}>2026</p>
                </div>
              </div>

              {/* Host nations */}
              <div className="m-flags flex items-center flex-wrap mt-1" style={{ gap: 0 }}>
                {[{e:'🇺🇸',n:'USA'},{e:'🇨🇦',n:'CANADA'},{e:'🇲🇽',n:'MEXICO'}].map(({e,n},i) => (
                  <div key={n} className="flex items-center">
                    {i > 0 && <span style={{ color:`${GOLD}28`, fontSize:11, margin:'0 9px' }}>·</span>}
                    <span style={{ fontSize: 18 }}>{e}</span>
                    <span style={{ fontSize:9, fontWeight:900, color:'rgba(255,255,255,0.42)', fontFamily:'var(--font-sport)', letterSpacing:'0.12em', marginLeft:5 }}>{n}</span>
                  </div>
                ))}
                <span style={{ fontSize:8, color:'rgba(255,255,255,0.2)', fontFamily:'var(--font-sport)', marginLeft:14 }}>11 Jun – 19 Jul 2026</span>
              </div>
            </div>

            {/* Countdown + stats */}
            <div className="flex flex-col items-end gap-3 flex-shrink-0">
              {(daysLeft !== null || nextMatchMs !== null) && (
                <div
                  className="m-cd-box flex flex-col items-center justify-center rounded-2xl"
                  style={{
                    background: `linear-gradient(145deg, ${GOLD}22 0%, ${GOLD}0C 100%)`,
                    border: `1.5px solid ${GOLD}40`,
                    padding: '18px 28px', minWidth: 108,
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  {daysLeft !== null ? (
                    <>
                      <span key={daysLeft} style={{
                        fontSize: 56, fontWeight: 900, color: GOLD,
                        fontFamily: 'var(--font-display)', lineHeight: 1,
                        letterSpacing: '-0.05em', textShadow: `0 0 40px ${GOLD}70`,
                      }}>{daysLeft}</span>
                      <span style={{ fontSize:8, color:GOLD2, fontFamily:'var(--font-sport)', textTransform:'uppercase', letterSpacing:'0.18em', marginTop:4 }}>
                        {daysLeft === 1 ? 'día' : 'días'}
                      </span>
                    </>
                  ) : nextMatchMs !== null ? (
                    <>
                      <span style={{
                        fontSize: 30, fontWeight: 900, color: GOLD,
                        fontFamily: 'var(--font-display)', lineHeight: 1,
                        letterSpacing: '-0.02em', textShadow: `0 0 30px ${GOLD}60`,
                      }}>{formatCountdown(nextMatchMs)}</span>
                      <span style={{ fontSize:7.5, color:GOLD2, fontFamily:'var(--font-sport)', textTransform:'uppercase', letterSpacing:'0.12em', marginTop:4 }}>próximo pick</span>
                    </>
                  ) : null}
                </div>
              )}

              {myPicks > 0 && daysLeft === null && (
                <div className="flex items-center gap-5 px-5 py-3 rounded-2xl" style={{ background:`${GOLD}0E`, border:`1px solid ${GOLD}22` }}>
                  <div style={{ textAlign:'center' }}>
                    <p style={{ fontSize:26, fontWeight:900, color:GOLD, fontFamily:'var(--font-display)', lineHeight:1 }}>{myPicks}</p>
                    <p style={{ fontSize:8, color:GOLD_D, fontFamily:'var(--font-sport)', textTransform:'uppercase', letterSpacing:'0.1em' }}>picks</p>
                  </div>
                  {totalPts > 0 && <>
                    <div style={{ width:1, height:30, background:`${GOLD}20` }} />
                    <div style={{ textAlign:'center' }}>
                      <p style={{ fontSize:26, fontWeight:900, color:GOLD, fontFamily:'var(--font-display)', lineHeight:1 }}>{totalPts}</p>
                      <p style={{ fontSize:8, color:GOLD_D, fontFamily:'var(--font-sport)', textTransform:'uppercase', letterSpacing:'0.1em' }}>pts</p>
                    </div>
                  </>}
                </div>
              )}
            </div>
          </div>

          {/* Strip de puntos */}
          <div className="m-strip flex items-center gap-5 flex-wrap pb-5 pt-3">
            {[{Icon:FootballIcon,text:'Resultado correcto',pts:'3 pts'},{Icon:StarIcon,text:'Partido destacado',pts:'6 pts'}].map(item => (
              <div key={item.text} className="flex items-center gap-1.5">
                <span style={{ display:'inline-flex', color:'rgba(255,255,255,0.45)' }}><item.Icon size={12} /></span>
                <span style={{ fontSize:10, color:'rgba(255,255,255,0.35)', fontFamily:'var(--font-sport)' }}>{item.text}</span>
                <span style={{ fontSize:10, fontWeight:900, color:GOLD, fontFamily:'var(--font-sport)', background:`${GOLD}14`, padding:'1px 6px', borderRadius:5 }}>{item.pts}</span>
              </div>
            ))}
            {totalPts > 0 && (
              <a href={`/api/og/mundial-stats?picks=${myPicks}&correct=${Object.values(preds).filter(p=>p.is_correct).length}&pts=${totalPts}`} target="_blank" rel="noopener noreferrer"
                style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:8, background:`${GOLD}12`, border:`1px solid ${GOLD}28`, color:GOLD_D, fontSize:9, fontWeight:900, fontFamily:'var(--font-sport)', textTransform:'uppercase', letterSpacing:'0.07em', textDecoration:'none' }}>
                <GalleryIcon size={11} />Compartir mis stats
              </a>
            )}
          </div>

          {/* CTA para no logueados */}
          {loggedIn === false && !loading && (
            <div className="m-cta" style={{
              margin:'0 -24px',
              padding:'14px 24px 16px',
              display:'flex', alignItems:'center', gap:14, flexWrap:'wrap',
              background:`linear-gradient(90deg,${GOLD}0C 0%,rgba(120,80,255,0.04) 100%)`,
              borderTop:`1px solid ${GOLD}18`,
            }}>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:13, fontWeight:900, color:'#F2F2F8', fontFamily:'var(--font-sport)', lineHeight:1.3 }}>Crea tu cuenta y empieza a predecir gratis</p>
                <p style={{ fontSize:10, color:'rgba(255,255,255,0.35)', fontFamily:'var(--font-sport)', marginTop:3 }}>Guarda tus picks · Acumula puntos · Compite en el ranking</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <a href="/auth/login" style={{ padding:'9px 18px', borderRadius:11, background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.14)', color:'rgba(255,255,255,0.8)', fontSize:11, fontWeight:900, fontFamily:'var(--font-sport)', textDecoration:'none', letterSpacing:'0.04em', textTransform:'uppercase', whiteSpace:'nowrap' }}>
                  Iniciar sesión
                </a>
                <a href="/auth/register" style={{ padding:'9px 18px', borderRadius:11, background:GOLD, color:'#000', fontSize:11, fontWeight:900, fontFamily:'var(--font-sport)', textDecoration:'none', letterSpacing:'0.04em', textTransform:'uppercase', whiteSpace:'nowrap', boxShadow:`0 4px 20px ${GOLD}35` }}>
                  Registro gratis →
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Login CTA modal ──────────────────────────────────── */}
      {showLogin && (
        <div className="mb-4 px-5 py-4 rounded-2xl flex flex-col gap-3"
          style={{ background:`linear-gradient(135deg,${GOLD}08,rgba(0,0,0,0.2))`, border:`1px solid ${GOLD}32`, boxShadow:`0 0 40px ${GOLD}08` }}>
          <div className="flex items-center gap-2">
            <span style={{ display:'inline-flex', color:GOLD }}><TrophyIcon size={22} /></span>
            <div>
              <p style={{ fontSize:13, fontWeight:900, color:GOLD, fontFamily:'var(--font-sport)' }}>Inicia sesión para predecir</p>
              <p style={{ fontSize:11, color:'rgba(255,255,255,0.4)', fontFamily:'var(--font-sport)', marginTop:1 }}>Crea una cuenta gratis y compite en el Mundial 2026</p>
            </div>
            <button onClick={() => setShowLogin(false)} style={{ marginLeft:'auto', opacity:0.4, background:'none', border:'none', color:'#F0F0F8', cursor:'pointer', fontSize:16 }}>✕</button>
          </div>
          <div className="flex gap-2">
            <a href="/auth/login" style={{ flex:1, textAlign:'center', padding:'10px 16px', borderRadius:11, background:`${GOLD}1E`, border:`1px solid ${GOLD}55`, color:GOLD, fontSize:11, fontWeight:900, fontFamily:'var(--font-sport)', textDecoration:'none', textTransform:'uppercase' }}>Iniciar sesión</a>
            <a href="/auth/register" style={{ flex:1, textAlign:'center', padding:'10px 16px', borderRadius:11, background:GOLD, color:'#000', fontSize:11, fontWeight:900, fontFamily:'var(--font-sport)', textDecoration:'none', textTransform:'uppercase', boxShadow:`0 4px 20px ${GOLD}35` }}>Crear cuenta gratis</a>
          </div>
        </div>
      )}

      {/* ─── Error ───────────────────────────────────────────── */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm"
          style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', color:'#FCA5A5', fontFamily:'var(--font-sport)' }}>
          {error}
          <button onClick={() => setError(null)} style={{ float:'right', opacity:0.6, background:'none', border:'none', color:'inherit', cursor:'pointer' }}>✕</button>
        </div>
      )}

      {/* ─── Loading ─────────────────────────────────────────── */}
      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 rounded-full animate-spin" style={{ border:`2px solid ${GOLD}20`, borderTopColor:GOLD }} />
        </div>
      )}

      {/* ─── Empty ───────────────────────────────────────────── */}
      {!loading && events.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <span style={{ display:'inline-flex', color:GOLD }}><TrophyIcon size={52} /></span>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:'clamp(1.2rem,2.5vw,1.8rem)', color:GOLD, letterSpacing:'-0.02em' }}>Cargando partidos…</h2>
          <p style={{ color:'rgba(255,255,255,0.35)', fontSize:13, maxWidth:360 }}>Los fixtures del Mundial se están sincronizando. Recarga en unos segundos.</p>
        </div>
      )}

      {/* ─── Match groups ─────────────────────────────────────── */}
      {!loading && grouped.length > 0 && (
        <div className="flex flex-col gap-12">
          {grouped.map(([dateKey, { label, events: dayEvents }], gi) => (
            <section key={dateKey} className="m-group" style={{ animationDelay:`${gi * 55}ms` }}>

              {/* Date header */}
              <div className="flex items-center gap-3 mb-5">
                <div style={{ width:4, height:24, borderRadius:2, flexShrink:0, background:`linear-gradient(to bottom, ${GOLD}, ${GOLD2}40)`, boxShadow:`0 0 10px ${GOLD}35` }} />
                <span style={{ fontSize:14, fontWeight:900, color:'#EDEDF8', fontFamily:'var(--font-sport)', textTransform:'uppercase', letterSpacing:'0.10em' }}>
                  {label}
                </span>
                <div style={{ flex:1, height:1, background:`linear-gradient(to right,${GOLD}22,transparent)` }} />
                {dayEvents.filter(e => e.status === 'open').length > 0 && (
                  <span style={{ fontSize:9, fontWeight:700, color:GOLD2, fontFamily:'var(--font-sport)', background:`${GOLD}10`, padding:'3px 9px', borderRadius:10, border:`1px solid ${GOLD}22` }}>
                    {dayEvents.filter(e => e.status === 'open').length} pendientes
                  </span>
                )}
              </div>

              {/* Cards grid */}
              <div
                className="grid gap-4"
                style={{
                  gridTemplateColumns: dayEvents.length === 1
                    ? 'minmax(280px, 420px)'
                    : 'repeat(auto-fill, minmax(290px, 1fr))',
                  justifyContent: dayEvents.length === 1 ? 'center' : undefined,
                }}
              >
                {dayEvents.map((ev, ci) => (
                  <MatchCard
                    key={ev.id} event={ev} pred={preds[ev.id]}
                    submitting={submitting} onPick={handlePick}
                    onExactSet={handleExactSet} activeExactCount={activeExactCount}
                    showExactTooltip={ev.id === tooltipEventId}
                    onExactTooltipDismiss={dismissExactTooltip}
                    animDelay={gi * 55 + ci * 45}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ─── Footer note ─────────────────────────────────────── */}
      {!loading && openCount > 0 && (
        <p className="text-center mt-12" style={{ fontSize:10, color:'rgba(255,255,255,0.16)', fontFamily:'var(--font-sport)' }}>
          Los picks se pueden cambiar hasta 1 hora antes de cada partido · Se bloquean automáticamente
        </p>
      )}
    </div>
  )
}
