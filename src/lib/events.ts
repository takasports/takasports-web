// Datos de ejemplo — estructura final lista para conectar con fuente real (Sanity / API oficial)
// SportEvent vive en /lib/types.ts como fuente única de verdad
import type { SportEvent } from './types'
import { getSportStyle, SLUG_TO_LABEL } from './sports'
import { SOURCE_TZ } from './timezone'

export type { SportEvent }

// ── Normalización Sanity → SportEvent ────────────────────────
interface RawSanityEvent {
  _id: string
  sport: string
  home: string
  away?: string
  date: string   // ISO datetime UTC
  venue?: string
  status?: string
  stage?: string
  broadcast?: string
  competition?: { name: string; slug: string }
}

const DAYS_ES  = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function toDateLabel(isoDate: string): string {
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: SOURCE_TZ }).format(new Date())
  const eventStr = new Intl.DateTimeFormat('en-CA', { timeZone: SOURCE_TZ }).format(new Date(isoDate))
  const diffDays = Math.round((new Date(eventStr).getTime() - new Date(todayStr).getTime()) / 86_400_000)
  if (diffDays === 0) return 'Hoy'
  if (diffDays === 1) return 'Mañana'
  // Parse the Madrid calendar date (YYYY-MM-DD) at UTC noon to get stable day/weekday values
  const d = new Date(eventStr + 'T12:00:00Z')
  return `${DAYS_ES[d.getUTCDay()]} · ${d.getUTCDate()} ${MONTHS_ES[d.getUTCMonth()]}`
}

function toTimeStr(isoDate: string): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: SOURCE_TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(isoDate))
  const h = parts.find(p => p.type === 'hour')?.value   ?? '00'
  const m = parts.find(p => p.type === 'minute')?.value ?? '00'
  return `${h}:${m}`
}

export function normalizeEvent(raw: RawSanityEvent): SportEvent {
  const { accent }    = getSportStyle(raw.sport)
  const sportLabel    = SLUG_TO_LABEL[raw.sport] ?? raw.sport
  return {
    id:        raw._id,
    home:      raw.home,
    away:      raw.away ?? null,
    sport:     sportLabel,
    comp:      raw.competition?.name ?? sportLabel,
    date:      toDateLabel(raw.date),
    time:      toTimeStr(raw.date),
    accent,
    isoDate:   raw.date,
    venue:     raw.venue,
    stage:     raw.stage,
    broadcast: raw.broadcast,
    source:    'sanity' as const,
  }
}
