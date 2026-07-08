// ── Timezone utilities ────────────────────────────────────────
// Los eventos tienen horas en Europe/Madrid (base española del producto).
// Esta capa convierte esas horas a la TZ preferida del usuario.

export const TZ_KEY = 'ts_timezone'
export const TZ_SOURCE_KEY = 'ts_timezone_source'
export const TZ_CHANGE_EVENT = 'ts-timezone-change'

export type TZSource = 'auto' | 'manual'

// Fuente de los eventos: Europe/Madrid
export const SOURCE_TZ = 'Europe/Madrid'

// ── Zonas comunes ─────────────────────────────────────────────
export interface TZOption {
  iana: string
  city: string
  region: string
  flag: string
}

export const TZ_OPTIONS: TZOption[] = [
  // Europa
  { iana: 'Europe/Madrid',    city: 'Madrid',        region: 'Europa',     flag: '🇪🇸' },
  { iana: 'Atlantic/Canary',  city: 'Canarias',      region: 'Europa',     flag: '🇮🇨' },
  { iana: 'Europe/London',    city: 'Londres',       region: 'Europa',     flag: '🇬🇧' },
  { iana: 'Europe/Paris',     city: 'París',         region: 'Europa',     flag: '🇫🇷' },
  { iana: 'Europe/Lisbon',    city: 'Lisboa',        region: 'Europa',     flag: '🇵🇹' },
  { iana: 'Europe/Berlin',    city: 'Berlín',        region: 'Europa',     flag: '🇩🇪' },
  { iana: 'Europe/Rome',      city: 'Roma',          region: 'Europa',     flag: '🇮🇹' },
  { iana: 'Europe/Amsterdam', city: 'Ámsterdam',     region: 'Europa',     flag: '🇳🇱' },
  { iana: 'Europe/Moscow',    city: 'Moscú',         region: 'Europa',     flag: '🇷🇺' },
  // América
  { iana: 'America/New_York',       city: 'Nueva York',    region: 'América',    flag: '🇺🇸' },
  { iana: 'America/Chicago',        city: 'Chicago',       region: 'América',    flag: '🇺🇸' },
  { iana: 'America/Los_Angeles',    city: 'Los Ángeles',   region: 'América',    flag: '🇺🇸' },
  { iana: 'America/Mexico_City',    city: 'Ciudad de México', region: 'América', flag: '🇲🇽' },
  { iana: 'America/Bogota',         city: 'Bogotá',        region: 'América',    flag: '🇨🇴' },
  { iana: 'America/Lima',           city: 'Lima',          region: 'América',    flag: '🇵🇪' },
  { iana: 'America/Argentina/Buenos_Aires', city: 'Buenos Aires', region: 'América', flag: '🇦🇷' },
  { iana: 'America/Sao_Paulo',      city: 'São Paulo',     region: 'América',    flag: '🇧🇷' },
  { iana: 'America/Santiago',       city: 'Santiago',      region: 'América',    flag: '🇨🇱' },
  // Asia / Pacífico / Medio Oriente
  { iana: 'Asia/Dubai',       city: 'Dubái',         region: 'Asia',       flag: '🇦🇪' },
  { iana: 'Asia/Kolkata',     city: 'Bombay',        region: 'Asia',       flag: '🇮🇳' },
  { iana: 'Asia/Shanghai',    city: 'Shanghái',      region: 'Asia',       flag: '🇨🇳' },
  { iana: 'Asia/Tokyo',       city: 'Tokio',         region: 'Asia',       flag: '🇯🇵' },
  { iana: 'Asia/Seoul',       city: 'Seúl',          region: 'Asia',       flag: '🇰🇷' },
  { iana: 'Asia/Singapore',   city: 'Singapur',      region: 'Asia',       flag: '🇸🇬' },
  { iana: 'Australia/Sydney', city: 'Sídney',        region: 'Pacífico',   flag: '🇦🇺' },
]

// ── Helpers ───────────────────────────────────────────────────

/** Lee la TZ guardada. Si no hay, usa la del browser. */
export function getStoredTZ(): string {
  if (typeof window === 'undefined') return SOURCE_TZ
  return (
    localStorage.getItem(TZ_KEY) ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    SOURCE_TZ
  )
}

/** Guarda preferencia del usuario en localStorage + cookie (para que el
 *  server pueda leerla en el siguiente render y evite el flash de hidratación). */
export function setStoredTZ(tz: string, source: TZSource = 'manual'): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(TZ_KEY, tz)
  localStorage.setItem(TZ_SOURCE_KEY, source)
  // 1 año, accesible al server, samesite lax
  document.cookie = `${TZ_KEY}=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`
  window.dispatchEvent(new CustomEvent(TZ_CHANGE_EVENT, { detail: { tz, source } }))
}

export function getStoredTZSource(): TZSource | null {
  if (typeof window === 'undefined') return null
  const v = localStorage.getItem(TZ_SOURCE_KEY)
  return v === 'manual' || v === 'auto' ? v : null
}

/** Devuelve la opción de la lista o una sintética si no está. */
export function getTZOption(iana: string): TZOption {
  return (
    TZ_OPTIONS.find((t) => t.iana === iana) ?? {
      iana,
      city: iana.split('/').pop()?.replace('_', ' ') ?? iana,
      region: 'Otro',
      flag: '🌍',
    }
  )
}

/** Offset formateado: "+2" / "-5" / "UTC" */
export function getTZOffset(iana: string, date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: iana,
      timeZoneName: 'shortOffset',
    }).formatToParts(date)
    const raw = parts.find((p) => p.type === 'timeZoneName')?.value ?? ''
    // raw = "GMT+2", "GMT-5", "GMT"
    return raw.replace('GMT', 'UTC') || 'UTC'
  } catch {
    return 'UTC'
  }
}

/**
 * Convierte un string de hora "21:00" (en SOURCE_TZ = Europe/Madrid)
 * al mismo instante expresado en targetTZ.
 *
 * Estrategia: construir un Date que represente "hoy a las HH:MM en Europe/Madrid"
 * y formatearlo en la TZ destino.
 */
export function convertEventTime(timeStr: string, targetTZ: string, anchorIso?: string): string {
  if (targetTZ === SOURCE_TZ) return timeStr

  try {
    const [h, m] = timeStr.split(':').map(Number)
    if (isNaN(h) || isNaN(m)) return timeStr

    // 1. Fecha ANCLA en Madrid (YYYY-MM-DD): la del EVENTO (anchorIso) si se da, si no
    // hoy. Anclar a la fecha real del partido hace que el offset de horario de verano
    // (DST) sea el correcto; antes usaba SIEMPRE hoy → 1h de desfase alrededor de los
    // cambios de hora europeos para fechas lejanas (e incoherente con la app, que ya
    // pasa anchorIso). Espejo del convertEventTime de takasports-app.
    const anchor = anchorIso ? new Date(anchorIso) : new Date()
    const madridDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: SOURCE_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(Number.isNaN(anchor.getTime()) ? new Date() : anchor)

    // 2. Crear Date "naïve" en UTC con esa fecha+hora
    const naive = new Date(`${madridDate}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`)

    // 3. Leer qué hora muestra ese Date en SOURCE_TZ (puede diferir si hay DST)
    const fmtSrc = new Intl.DateTimeFormat('en', {
      timeZone: SOURCE_TZ,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(naive)
    const srcH = parseInt(fmtSrc.find((p) => p.type === 'hour')?.value ?? '0')
    const srcM = parseInt(fmtSrc.find((p) => p.type === 'minute')?.value ?? '0')

    // 4. Corregir el offset para que el Date sea el instante real en Madrid
    const deltaMs = ((h - srcH) * 60 + (m - srcM)) * 60_000
    const realDate = new Date(naive.getTime() + deltaMs)

    // 5. Formatear en targetTZ
    return new Intl.DateTimeFormat('en', {
      timeZone: targetTZ,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(realDate)
  } catch {
    return timeStr
  }
}

/** Indica si targetTZ es el mismo día que SOURCE_TZ para "hoy".
 *  Útil para mostrar aviso de cambio de día. */
export function isSameDay(timeStr: string, targetTZ: string, anchorIso?: string): boolean {
  if (targetTZ === SOURCE_TZ) return true
  try {
    const [h, m] = timeStr.split(':').map(Number)
    const anchor = anchorIso ? new Date(anchorIso) : new Date()
    const madridDate = new Intl.DateTimeFormat('en-CA', { timeZone: SOURCE_TZ }).format(
      Number.isNaN(anchor.getTime()) ? new Date() : anchor,
    )
    const naive = new Date(`${madridDate}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`)
    const fmtSrc = new Intl.DateTimeFormat('en', { timeZone: SOURCE_TZ, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(naive)
    const srcH = parseInt(fmtSrc.find(p => p.type === 'hour')?.value ?? '0')
    const srcM = parseInt(fmtSrc.find(p => p.type === 'minute')?.value ?? '0')
    const realDate = new Date(naive.getTime() + ((h - srcH) * 60 + (m - srcM)) * 60_000)

    const srcDay = new Intl.DateTimeFormat('en-CA', { timeZone: SOURCE_TZ }).format(realDate)
    const tgtDay = new Intl.DateTimeFormat('en-CA', { timeZone: targetTZ }).format(realDate)
    return srcDay === tgtDay
  } catch {
    return true
  }
}

/** Diferencia de día calendario entre SOURCE_TZ y targetTZ para un instante
 *  concreto (ISO). Devuelve -1, 0 o +1: cuántos días se desplaza la fecha del
 *  evento al verlo en la zona del usuario. Útil para avisar "+1 día" / "−1 día"
 *  cuando la hora local cae en otra jornada. */
export function dayDeltaForIso(isoDate: string | undefined, targetTZ: string): number {
  if (!isoDate || targetTZ === SOURCE_TZ) return 0
  try {
    const d = new Date(isoDate)
    const srcDay = new Intl.DateTimeFormat('en-CA', { timeZone: SOURCE_TZ }).format(d)
    const tgtDay = new Intl.DateTimeFormat('en-CA', { timeZone: targetTZ }).format(d)
    if (srcDay === tgtDay) return 0
    return tgtDay < srcDay ? -1 : 1
  } catch {
    return 0
  }
}

// ── Instante UTC → hora en cada país ──────────────────────────
// A diferencia de convertEventTime (que trabaja con "HH:MM" en Madrid), estas
// funciones parten de un INSTANTE exacto (ISO-8601 UTC) y lo expresan en cada
// zona. Es lo que usa la tarjeta "Horario del partido": un único instante real,
// convertido de forma determinista a cada país (sin que ninguna IA haga cuentas).

export interface ZoneTime {
  iana: string
  city: string
  flag: string
  time: string      // "21:00"
  offset: string    // "UTC+2"
  dayDelta: number  // -1 / 0 / +1 respecto a España (Europe/Madrid)
  dayLabel: string  // "" salvo si cambia de día: "dom. 12 jul"
}

/** Formatea un instante ISO-8601 UTC en una zona IANA concreta. */
export function formatInstantInZone(isoDate: string, iana: string): ZoneTime | null {
  try {
    const d = new Date(isoDate)
    if (Number.isNaN(d.getTime())) return null
    const opt = getTZOption(iana)
    const time = new Intl.DateTimeFormat('es-ES', {
      timeZone: iana, hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(d)
    const dayDelta = dayDeltaForIso(isoDate, iana)
    const dayLabel = dayDelta === 0 ? '' : new Intl.DateTimeFormat('es-ES', {
      timeZone: iana, weekday: 'short', day: 'numeric', month: 'short',
    }).format(d)
    return { iana, city: opt.city, flag: opt.flag, time, offset: getTZOffset(iana, d), dayDelta, dayLabel }
  } catch {
    return null
  }
}

/** Formatea un instante en una lista de zonas, descartando las inválidas. */
export function formatInstantForZones(isoDate: string, ianas: string[]): ZoneTime[] {
  return ianas
    .map((z) => formatInstantInZone(isoDate, z))
    .filter((z): z is ZoneTime => z !== null)
}

// Países donde más se sigue el deporte para el público de Taka (España + grandes
// mercados hispanohablantes + Reino Unido). España y Canarias se muestran aparte
// como referencia central; el resto forma la lista. La tarjeta acepta override
// para adaptarla al evento concreto (equipos/competición) en el futuro.
export const MATCH_AUDIENCE_ZONES: string[] = [
  'America/Mexico_City',
  'America/Bogota',
  'America/Lima',
  'America/Argentina/Buenos_Aires',
  'America/Santiago',
  'America/New_York',
  'Europe/London',
]
