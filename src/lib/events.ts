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

// Etiqueta relativa con fecha real: "Hoy", "Mañana", "Dom · 20 abr"
function dayLabel(daysAhead: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  if (daysAhead === 0) return 'Hoy'
  if (daysAhead === 1) return 'Mañana'
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${days[d.getDay()]} · ${d.getDate()} ${months[d.getMonth()]}`
}

export const ALL_EVENTS: SportEvent[] = [
  { id: '1',  home: 'Real Madrid', away: 'Atlético',    sport: 'Fútbol',     comp: 'LaLiga',        date: dayLabel(0), time: '21:00', accent: '#22c55e', venue: 'Bernabéu, Madrid',      stage: 'Jornada 34',    broadcast: 'DAZN' },
  { id: '2',  home: 'Lakers',      away: 'Celtics',     sport: 'Baloncesto', comp: 'NBA Playoffs',  date: dayLabel(1), time: '02:30', accent: '#f59e0b', venue: 'Crypto.com Arena, LA',  stage: 'R1 · G4',       broadcast: 'NBA League Pass' },
  { id: '3',  home: 'GP Bahréin',  away: null,          sport: 'F1',         comp: 'Fórmula 1',     date: dayLabel(2), time: '17:00', accent: '#ef4444', venue: 'Circuito de Sakhir',    stage: 'Carrera',       broadcast: 'DAZN F1' },
  { id: '4',  home: 'Alcaraz',     away: 'Sinner',      sport: 'Tenis',      comp: 'Roland Garros', date: dayLabel(3), time: '14:00', accent: '#d97706', venue: 'Court Philippe-Chatrier', stage: 'SF · Tierra',  broadcast: 'Eurosport' },
  { id: '5',  home: 'Argentina',   away: 'Brasil',      sport: 'Fútbol',     comp: 'Eliminatorias', date: dayLabel(4), time: '20:30', accent: '#22c55e', venue: 'Monumental, Buenos Aires', stage: 'Jornada 16',  broadcast: 'DirecTV' },
  { id: '6',  home: 'Warriors',    away: 'Knicks',      sport: 'Baloncesto', comp: 'NBA Playoffs',  date: dayLabel(4), time: '01:00', accent: '#f59e0b', venue: 'Chase Center, SF',      stage: 'R1 · G4',       broadcast: 'NBA League Pass' },
  { id: '7',  home: 'UFC Fight Night', away: null,      sport: 'UFC',        comp: 'UFC',           date: dayLabel(5), time: '23:00', accent: '#f97316', venue: 'T-Mobile Arena, Las Vegas', stage: 'Main Card', broadcast: 'UFC Fight Pass' },
  { id: '8',  home: 'Barcelona',   away: 'Valencia',    sport: 'Fútbol',     comp: 'LaLiga',        date: dayLabel(6), time: '18:30', accent: '#22c55e', venue: 'Spotify Camp Nou',      stage: 'Jornada 35',    broadcast: 'DAZN' },
  { id: '9',  home: 'Djokovic',    away: 'Zverev',      sport: 'Tenis',      comp: 'Roland Garros', date: dayLabel(6), time: '13:00', accent: '#d97706', venue: 'Court Suzanne-Lenglen', stage: 'QF · Tierra',   broadcast: 'Eurosport' },
  { id: '10', home: 'GP Mónaco',   away: null,          sport: 'F1',         comp: 'Fórmula 1',     date: dayLabel(7), time: '15:00', accent: '#ef4444', venue: 'Circuit de Monaco',     stage: 'Carrera',       broadcast: 'DAZN F1' },
  { id: '11', home: 'FC Barcelona', away: 'Atlético W', sport: 'Fútbol',     comp: 'Liga F',        date: dayLabel(1), time: '18:00', accent: '#22c55e', venue: 'Estadi Johan Cruyff',   stage: 'Jornada 26',    broadcast: 'DAZN' },
  { id: '12', home: 'Real Madrid W', away: 'Wolfsburg', sport: 'Fútbol',     comp: 'Champions F',   date: dayLabel(3), time: '21:00', accent: '#22c55e', venue: 'Alfredo Di Stéfano',    stage: 'Cuartos · Ida', broadcast: 'DAZN' },
  { id: '13', home: 'Levante W',    away: 'Sevilla W',  sport: 'Fútbol',     comp: 'Liga F',        date: dayLabel(5), time: '16:00', accent: '#22c55e', venue: 'Estadi Camilo Cano',    stage: 'Jornada 27',    broadcast: 'Teledeporte' },
]

export const HOME_EVENTS = ALL_EVENTS.slice(0, 4)
