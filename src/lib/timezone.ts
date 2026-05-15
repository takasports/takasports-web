// ── Timezone utilities ────────────────────────────────────────
// Los eventos tienen horas en Europe/Madrid (base española del producto).
// Esta capa convierte esas horas a la TZ preferida del usuario.

export const TZ_KEY = 'ts_timezone'

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
export function setStoredTZ(tz: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(TZ_KEY, tz)
  // 1 año, accesible al server, samesite lax
  document.cookie = `${TZ_KEY}=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`
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
export function convertEventTime(timeStr: string, targetTZ: string): string {
  if (targetTZ === SOURCE_TZ) return timeStr

  try {
    const [h, m] = timeStr.split(':').map(Number)
    if (isNaN(h) || isNaN(m)) return timeStr

    // 1. Fecha de hoy en Madrid (YYYY-MM-DD)
    const madridDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: SOURCE_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())

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
export function isSameDay(timeStr: string, targetTZ: string): boolean {
  if (targetTZ === SOURCE_TZ) return true
  try {
    const [h, m] = timeStr.split(':').map(Number)
    const madridDate = new Intl.DateTimeFormat('en-CA', { timeZone: SOURCE_TZ }).format(new Date())
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
