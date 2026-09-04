// ─────────────────────────────────────────────────────────────────────────────
// De qué región es quien está mirando, y qué competición es «la suya».
//
// POR QUÉ: medido en Search Console (13/08/2026), Latinoamérica ya es la mitad
// de nuestras impresiones y convierte a un tercio que España — 130.000
// impresiones para ~490 clics, frente a 129.442 para 1.717. Les aparecemos
// tanto como a España y no hacen clic, porque lo que ven es LaLiga.
//
// Y el sesgo está EN EL CÓDIGO, no en una impresión: `getLeagueScore` da 12 a
// LaLiga y 7 a Liga MX, así que sobre el feed real de 23 días el 23% de los
// partidos son de las Américas y ocupan el 6% de los Destacados.
//
// CÓMO se sabe la región: por el HUSO HORARIO del navegador, que el sitio ya lee
// para pintar las horas (`getStoredTZ`). Cero cookies, cero llamada al servidor,
// sin pedir permiso de ubicación.
//
// ⚠️ Esto SOLO puede usarse tras hidratar. El HTML se cachea con ISR y es el
// mismo para todo el mundo —incluido Google—; si el servidor ordenara por región
// se rompería la caché y, peor, el orden del servidor no coincidiría con el del
// cliente (fallo de hidratación, el #418 que ya costó dos sesiones).
// ─────────────────────────────────────────────────────────────────────────────

/** Cuánto sube la competición de tu país en los Destacados.
 *
 *  Calibrado sobre el feed real, contando en cuántos de los días que juega su
 *  liga entra al menos un partido suyo en el top 6:
 *
 *    país              hoy     +4      +6       +8
 *    México            3/12    6/12    11/12    12/12
 *    Brasil            1/9     6/9      8/9      9/9
 *    Argentina         2/15    5/15     7/15     9/15
 *    EE. UU. (MLS)     0/12    5/12    11/12    12/12
 *
 *  Con +4 se queda corto. Con +8 la liga local empieza a tapar a la Champions.
 *  Con +6 entra casi siempre SIN desalojar los partidos europeos grandes: un
 *  clásico sigue puntuando ~14 y gana. [José Tomás, 04/09/2026]
 */
export const EMPUJON_REGIONAL = 6

/** Prefijos de huso horario → competición «de casa». */
const LIGA_POR_HUSO: { prefijo: string; comp: string }[] = [
  { prefijo: 'America/Mexico',        comp: 'Liga MX' },
  { prefijo: 'America/Tijuana',       comp: 'Liga MX' },
  { prefijo: 'America/Cancun',        comp: 'Liga MX' },
  { prefijo: 'America/Monterrey',     comp: 'Liga MX' },
  { prefijo: 'America/Chihuahua',     comp: 'Liga MX' },
  { prefijo: 'America/Hermosillo',    comp: 'Liga MX' },
  { prefijo: 'America/Merida',        comp: 'Liga MX' },
  { prefijo: 'America/Mazatlan',      comp: 'Liga MX' },
  { prefijo: 'America/Sao_Paulo',     comp: 'Brasileirão' },
  { prefijo: 'America/Bahia',         comp: 'Brasileirão' },
  { prefijo: 'America/Fortaleza',     comp: 'Brasileirão' },
  { prefijo: 'America/Recife',        comp: 'Brasileirão' },
  { prefijo: 'America/Belem',         comp: 'Brasileirão' },
  { prefijo: 'America/Manaus',        comp: 'Brasileirão' },
  { prefijo: 'America/Cuiaba',        comp: 'Brasileirão' },
  { prefijo: 'America/Campo_Grande',  comp: 'Brasileirão' },
  { prefijo: 'America/Porto_Velho',   comp: 'Brasileirão' },
  { prefijo: 'America/Argentina',     comp: 'Liga Argentina' },
  { prefijo: 'America/Buenos_Aires',  comp: 'Liga Argentina' },
  // Estados Unidos y Canadá → MLS.
  { prefijo: 'America/New_York',      comp: 'MLS' },
  { prefijo: 'America/Chicago',       comp: 'MLS' },
  { prefijo: 'America/Denver',        comp: 'MLS' },
  { prefijo: 'America/Los_Angeles',   comp: 'MLS' },
  { prefijo: 'America/Phoenix',       comp: 'MLS' },
  { prefijo: 'America/Detroit',       comp: 'MLS' },
  { prefijo: 'America/Toronto',       comp: 'MLS' },
  { prefijo: 'America/Vancouver',     comp: 'MLS' },
  { prefijo: 'America/Edmonton',      comp: 'MLS' },
  { prefijo: 'America/Winnipeg',      comp: 'MLS' },
  { prefijo: 'America/Halifax',       comp: 'MLS' },
]

/**
 * La competición «de casa» de quien mira, o null si no tenemos una para su huso.
 *
 * España y el resto de Europa devuelven null a propósito: el orden que ya existe
 * ES el suyo, así que para ellos no cambia absolutamente nada.
 */
export function compDeCasa(tz?: string | null): string | null {
  if (!tz) return null
  const t = tz.trim()
  for (const { prefijo, comp } of LIGA_POR_HUSO) {
    if (t === prefijo || t.startsWith(prefijo + '/') || t.startsWith(prefijo)) return comp
  }
  return null
}

/** Los puntos que suma una competición para quien mira desde `tz`. */
export function empujonRegional(comp?: string | null, tz?: string | null): number {
  if (!comp) return 0
  const casa = compDeCasa(tz)
  if (!casa) return 0
  return comp.trim() === casa ? EMPUJON_REGIONAL : 0
}
