// Datos puros de países para el bloque "Dónde verlo". Sin dependencias de servidor:
// lo importan tanto los Server Components como la tarjeta de cliente.
//
// El país del lector sale de su zona horaria (America/Santiago → CL), no de la IP:
// es gratis, no depende de Vercel, funciona igual en la app, y respeta el selector
// manual de zona que ya tiene el sitio — un chileno en Madrid decide qué quiere ver.

export interface BroadcastRow {
  countryCode: string
  country: string
  channels: string[]
  url?: string | null
  note?: string | null
}

export const COUNTRY_NAMES: Record<string, string> = {
  ES: 'España',
  MX: 'México',
  AR: 'Argentina',
  PE: 'Perú',
  US: 'Estados Unidos',
  CO: 'Colombia',
  CL: 'Chile',
  VE: 'Venezuela',
  EC: 'Ecuador',
  UY: 'Uruguay',
  BO: 'Bolivia',
  PY: 'Paraguay',
  GT: 'Guatemala',
  CR: 'Costa Rica',
  PA: 'Panamá',
  HN: 'Honduras',
  SV: 'El Salvador',
  DO: 'República Dominicana',
}

export const COUNTRY_FLAGS: Record<string, string> = {
  ES: '🇪🇸', MX: '🇲🇽', AR: '🇦🇷', PE: '🇵🇪', US: '🇺🇸', CO: '🇨🇴', CL: '🇨🇱',
  VE: '🇻🇪', EC: '🇪🇨', UY: '🇺🇾', BO: '🇧🇴', PY: '🇵🇾', GT: '🇬🇹', CR: '🇨🇷',
  PA: '🇵🇦', HN: '🇭🇳', SV: '🇸🇻', DO: '🇩🇴',
}

// Zona representativa de cada país, para convertir la hora del partido. Los países
// con varios husos (México, Estados Unidos) usan el de su mayor audiencia; el resto
// de husos los cubre igualmente la fila "tu hora local" de la tarjeta de horario.
export const COUNTRY_TZ: Record<string, string> = {
  ES: 'Europe/Madrid',
  MX: 'America/Mexico_City',
  AR: 'America/Argentina/Buenos_Aires',
  PE: 'America/Lima',
  US: 'America/New_York',
  CO: 'America/Bogota',
  CL: 'America/Santiago',
  VE: 'America/Caracas',
  EC: 'America/Guayaquil',
  UY: 'America/Montevideo',
  BO: 'America/La_Paz',
  PY: 'America/Asuncion',
  GT: 'America/Guatemala',
  CR: 'America/Costa_Rica',
  PA: 'America/Panama',
  HN: 'America/Tegucigalpa',
  SV: 'America/El_Salvador',
  DO: 'America/Santo_Domingo',
}

// IANA → ISO 3166-1 alfa-2. Solo las zonas que nos importan; las variantes
// provinciales se resuelven por prefijo en countryFromTimeZone.
const TZ_TO_COUNTRY: Record<string, string> = {
  'Europe/Madrid': 'ES',
  'Atlantic/Canary': 'ES',
  'America/Mexico_City': 'MX',
  'America/Monterrey': 'MX',
  'America/Tijuana': 'MX',
  'America/Cancun': 'MX',
  'America/Bogota': 'CO',
  'America/Lima': 'PE',
  'America/Santiago': 'CL',
  'America/Punta_Arenas': 'CL',
  'America/Caracas': 'VE',
  'America/Guayaquil': 'EC',
  'America/Montevideo': 'UY',
  'America/Asuncion': 'PY',
  'America/La_Paz': 'BO',
  'America/Guatemala': 'GT',
  'America/Costa_Rica': 'CR',
  'America/Panama': 'PA',
  'America/Tegucigalpa': 'HN',
  'America/El_Salvador': 'SV',
  'America/Santo_Domingo': 'DO',
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Phoenix': 'US',
  'America/Los_Angeles': 'US',
  'America/Anchorage': 'US',
  'Pacific/Honolulu': 'US',
}

export function countryFromTimeZone(tz: string | null | undefined): string | null {
  if (!tz) return null
  if (TZ_TO_COUNTRY[tz]) return TZ_TO_COUNTRY[tz]
  if (tz.startsWith('America/Argentina/')) return 'AR'
  if (tz.startsWith('America/Indiana/') || tz.startsWith('America/Kentucky/')) return 'US'
  return null
}

// Desfase horario de una zona respecto a otra EN UN INSTANTE CONCRETO, en minutos.
// Se calcula sobre el instante real y no sobre el offset "de hoy" porque los
// cambios de hora no caen a la vez en los dos hemisferios: entre finales de
// octubre y principios de noviembre, España y Chile llegan a estar a 4, 5 o 6
// horas según el día. Formatearlo con el offset de hoy daría un desfase falso
// justo en las semanas en que más confunde.
export function offsetMinutes(isoDate: string, iana: string): number | null {
  try {
    const d = new Date(isoDate)
    if (Number.isNaN(d.getTime())) return null
    const p = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone: iana, hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      })
        .formatToParts(d)
        .map((x) => [x.type, x.value]),
    ) as Record<string, string>
    // 'en-US' con hour12:false devuelve 24 en vez de 0 para la medianoche.
    const hour = Number(p.hour) % 24
    const asUTC = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), hour, Number(p.minute), Number(p.second))
    return Math.round((asUTC - d.getTime()) / 60000)
  } catch {
    return null
  }
}

/** "+5 h", "−3:30 h", "igual" — el desfase de `iana` respecto a `refIana`. */
export function offsetLabel(isoDate: string, iana: string, refIana: string): string | null {
  const a = offsetMinutes(isoDate, iana)
  const b = offsetMinutes(isoDate, refIana)
  if (a === null || b === null) return null
  const diff = a - b
  if (diff === 0) return 'igual'
  const signo = diff > 0 ? '+' : '−' // menos tipográfico, no guion
  const abs = Math.abs(diff)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `${signo}${m ? `${h}:${String(m).padStart(2, '0')}` : h} h`
}
