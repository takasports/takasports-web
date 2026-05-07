// Calendar and date utilities
import type { SportEvent } from '@/lib/types'
import { SOURCE_TZ } from '@/lib/timezone'

export function isoToLocalDate(isoDate: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: SOURCE_TZ }).formatToParts(new Date(isoDate))
  const year = parts.find(p => p.type === 'year')?.value
  const month = parts.find(p => p.type === 'month')?.value
  const day = parts.find(p => p.type === 'day')?.value
  return `${year}-${month}-${day}`
}

export function localDateToIso(localDate: string): Date {
  const [year, month, day] = localDate.split('-')
  return new Date(`${year}-${month}-${day}T12:00:00Z`)
}

export function getDateLabel(idx: number): string {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const today = new Date(isoToLocalDate(new Date().toISOString()) + 'T12:00:00Z')
  const target = new Date(today)
  target.setDate(target.getDate() + idx)
  const dayName = days[target.getUTCDay()]
  const dayNum = target.getUTCDate()
  return idx === 0 ? 'Hoy' : idx === 1 ? 'Mañana' : `${dayName} ${dayNum}`
}

export function generateWeek(): { iso: string; label: string }[] {
  const todayIso = isoToLocalDate(new Date().toISOString())
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(todayIso + 'T12:00:00Z')
    d.setDate(d.getDate() + i)
    const iso = d.toISOString().split('T')[0]
    const label = getDateLabel(i)
    return { iso, label }
  })
}

export function normalizeStr(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
}

export function namesMatch(a: string, b: string): boolean {
  const na = normalizeStr(a), nb = normalizeStr(b)
  return na.includes(nb) || nb.includes(na)
}

// Group events by local calendar date (YYYY-MM-DD)
export function groupEventsByDate(events: SportEvent[]): Record<string, SportEvent[]> {
  const grouped: Record<string, SportEvent[]> = {}
  for (const ev of events) {
    const key = ev.isoDate ? isoToLocalDate(ev.isoDate) : 'unknown'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(ev)
  }
  return grouped
}

// Get ordered date keys for grouped events
export function orderedDateKeys(grouped: Record<string, SportEvent[]>): string[] {
  return Object.keys(grouped).sort((a, b) => {
    if (a === 'unknown') return 1
    if (b === 'unknown') return -1
    return a.localeCompare(b)
  })
}

// Format YYYY-MM-DD into a friendly label: "Hoy", "Mañana", or "Vie 5 May"
export function formatDateLabel(localDate: string): string {
  if (localDate === 'unknown') return 'Sin fecha'
  const today = isoToLocalDate(new Date().toISOString())
  if (localDate === today) return 'Hoy'

  const tomorrow = new Date(today + 'T12:00:00Z')
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  const tomorrowKey = tomorrow.toISOString().split('T')[0]
  if (localDate === tomorrowKey) return 'Mañana'

  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const d = new Date(localDate + 'T12:00:00Z')
  return `${days[d.getUTCDay()]} ${d.getUTCDate()} ${months[d.getUTCMonth()]}`
}

// Make Google Calendar URL
export function makeGoogleCalendarUrl(event: SportEvent, tz: string): string {
  if (!event.isoDate) return '#'
  const start = new Date(event.isoDate)
  const end = new Date(start.getTime() + 2 * 3_600_000)
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'
  const title = event.away ? `${event.home} vs ${event.away}` : event.home
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: `${event.sport} · ${event.comp}`,
    ctz: tz,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

// Schedule browser notification
export async function requestAndScheduleNotif(event: SportEvent): Promise<ReturnType<typeof setTimeout> | null> {
  if (typeof window === 'undefined' || !('Notification' in window) || !event.isoDate) return null
  const perm = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission()
  if (perm !== 'granted') return null
  const delay = new Date(event.isoDate).getTime() - Date.now() - 15 * 60_000
  if (delay < 0) return null
  const title = event.away ? `${event.home} vs ${event.away}` : event.home
  return setTimeout(() => {
    new Notification(`⏰ En 15 min: ${title}`, {
      body: `${event.comp} · ${event.time}`,
      icon: '/favicon.ico',
    })
  }, delay)
}
