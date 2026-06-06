// "Hora Taka" = Europe/Madrid. FUENTE ÚNICA de día / semana / countdown para
// TODOS los juegos y misiones. Garantiza que el "día Taka" y la "semana Taka"
// (medianoche de Madrid) sean idénticos en cualquier dispositivo y zona horaria,
// sustituyendo los cómputos dispersos que mezclaban UTC y hora local del
// navegador (causa del doble-juego de CrackQuiz, la divergencia de semana de
// Mi Once en LatAm y los countdowns/resets descuadrados).
//
// Formatos: día "YYYY-MM-DD", semana ISO "YYYY-Www".

const TZ = 'Europe/Madrid'

export interface TakaParts {
  year: number; month: number; day: number
  hour: number; minute: number; second: number
}

/** Componentes de fecha/hora de `d` en la zona de Madrid. */
export function madridParts(d: Date = new Date()): TakaParts {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
  const map: Record<string, string> = {}
  for (const p of f.formatToParts(d)) if (p.type !== 'literal') map[p.type] = p.value
  let hour = Number(map.hour)
  if (hour === 24) hour = 0 // algunos motores devuelven '24' a medianoche
  return {
    year: Number(map.year), month: Number(map.month), day: Number(map.day),
    hour, minute: Number(map.minute), second: Number(map.second),
  }
}

/** "2026-05-15" — fecha del día en Madrid. */
export function madridDayISO(d: Date = new Date()): string {
  const p = madridParts(d)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** "2026-W20" — semana ISO del momento en Madrid. El año ISO puede diferir del
 *  natural en los bordes de año (norma ISO 8601, igual que el algoritmo previo). */
export function madridWeekISO(d: Date = new Date()): string {
  const p = madridParts(d)
  // Mismo algoritmo "jueves ancla" que usaba currentWeekISO, pero sobre la fecha
  // de calendario de Madrid → mismos números de semana, solo cambia el borde.
  const date = new Date(Date.UTC(p.year, p.month - 1, p.day))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/** Número de semana ISO (1..53) del momento en Madrid. */
export function madridWeekNumber(d: Date = new Date()): number {
  return Number(madridWeekISO(d).slice(-2))
}

/** Día de la semana en Madrid: Lun=1 .. Dom=7. */
export function madridWeekday(d: Date = new Date()): number {
  const p = madridParts(d)
  return new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay() || 7
}

/** ms hasta la próxima medianoche de Madrid. (En los 2 días/año de cambio de
 *  hora el valor puede desviarse ~1h; solo afecta al texto del countdown, no al
 *  reset real, que lo marca el cambio de clave de día.) */
export function msUntilMadridMidnight(d: Date = new Date()): number {
  const p = madridParts(d)
  const secs = p.hour * 3600 + p.minute * 60 + p.second
  return (86400 - secs) * 1000
}

/** ms hasta el próximo lunes 00:00 de Madrid. */
export function msUntilNextMadridMonday(d: Date = new Date()): number {
  const p = madridParts(d)
  const dow = madridWeekday(d)              // 1..7
  const daysToMonday = ((8 - dow) % 7) || 7 // 1..7 (si hoy es lunes → 7)
  const secs = p.hour * 3600 + p.minute * 60 + p.second
  return (daysToMonday * 86400 - secs) * 1000
}
