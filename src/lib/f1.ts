// Previas y crónicas de los Grandes Premios de F1 (06/10/2026, «crónicas y previas de
// los partidos y eventos deportivos destacados»).
//
// La F1 en español se busca sobre todo ANTES («horarios GP de Singapur»), y lo que se
// busca es el horario de cada sesión, Alonso y Sainz, Colapinto, Checo Pérez. ESPN solo
// da el orden de llegada; Jolpica (la API gratuita heredera de Ergast, la misma del
// ranking de F1) da el calendario con todas las sesiones, el circuito, los resultados
// con equipo, tiempo, puntos, salida, vuelta rápida y abandonos, y los mundiales.
//   · Previa: en la semana del GP, desde 60 h antes de los libres 1 hasta 4 h antes de
//     la carrera, con los horarios de todas las sesiones en España y Latinoamérica.
//   · Crónica: de la carrera, cuando Jolpica publica el resultado (hasta 24 h después).
// Puro salvo `fetchJolpica`: se prueba con fixtures.

type J = any // eslint-disable-line @typescript-eslint/no-explicit-any

const JOLPICA = 'https://api.jolpi.ca/ergast/f1'

const PAISES_GP: Record<string, string> = {
  australian: 'Australia', chinese: 'China', japanese: 'Japón', bahrain: 'Baréin', 'saudi arabian': 'Arabia Saudí',
  miami: 'Miami', 'emilia romagna': 'Emilia-Romaña', monaco: 'Mónaco', spanish: 'España', barcelona: 'Barcelona',
  canadian: 'Canadá', austrian: 'Austria', british: 'Gran Bretaña', belgian: 'Bélgica', hungarian: 'Hungría',
  dutch: 'Países Bajos', italian: 'Italia', azerbaijan: 'Azerbaiyán', singapore: 'Singapur', 'united states': 'Estados Unidos',
  'mexico city': 'Ciudad de México', mexican: 'México', brazilian: 'Brasil', 'são paulo': 'São Paulo', 'sao paulo': 'São Paulo',
  'las vegas': 'Las Vegas', qatar: 'Catar', 'abu dhabi': 'Abu Dabi', madrid: 'Madrid',
}
const PAISES: Record<string, string> = {
  malaysia: 'Malasia', singapore: 'Singapur', usa: 'EE. UU.', 'united states': 'EE. UU.', mexico: 'México', brazil: 'Brasil',
  qatar: 'Catar', uae: 'Emiratos Árabes Unidos', spain: 'España', italy: 'Italia', japan: 'Japón', china: 'China',
  australia: 'Australia', monaco: 'Mónaco', canada: 'Canadá', austria: 'Austria', uk: 'Reino Unido', belgium: 'Bélgica',
  hungary: 'Hungría', netherlands: 'Países Bajos', azerbaijan: 'Azerbaiyán', bahrain: 'Baréin', 'saudi arabia': 'Arabia Saudí',
}
const NACIONALIDADES: Record<string, string> = {
  spanish: 'español', argentine: 'argentino', mexican: 'mexicano', brazilian: 'brasileño', british: 'británico',
  dutch: 'neerlandés', italian: 'italiano', monegasque: 'monegasco', german: 'alemán', french: 'francés', australian: 'australiano',
  canadian: 'canadiense', thai: 'tailandés', finnish: 'finlandés', 'new zealander': 'neozelandés', japanese: 'japonés',
  danish: 'danés', chinese: 'chino', american: 'estadounidense', colombian: 'colombiano', venezuelan: 'venezolano',
}
/** Los pilotos que sigue el lector hispano: siempre se dice dónde están. */
const HISPANOS = new Set(['spanish', 'argentine', 'mexican', 'colombian', 'venezuelan', 'chilean', 'uruguayan', 'peruvian'])

const minusc = (s: unknown) => String(s ?? '').trim().toLowerCase()
const pl = (n: unknown, uno: string, varios: string) => `${n} ${Number(n) === 1 ? uno : varios}`
/** Estado de Jolpica en español: «Retired» → «abandono», «+1 Lap» → «a 1 vuelta». */
export function estadoEs(st: unknown): string {
  const s = String(st ?? '').trim()
  const v = /^\+(\d+) Laps?$/i.exec(s)
  if (v) return `a ${pl(v[1], 'vuelta', 'vueltas')}`
  const m: Record<string, string> = { retired: 'abandono', accident: 'abandono por accidente', collision: 'abandono por choque', disqualified: 'descalificado', 'did not start': 'no tomó la salida', withdrew: 'retirado antes de la salida', finished: '' }
  return m[s.toLowerCase()] ?? s
}

/** «Singapore Grand Prix» → «Gran Premio de Singapur»; «Bahrain Grand Prix in Malaysia» →
 *  «Gran Premio de Baréin en Malasia». Si no se reconoce, se deja como viene. */
export function nombreGp(raceName: string): string {
  const m = /^(.*?)\s+Grand Prix(?:\s+in\s+(.+))?$/i.exec(raceName.trim())
  if (!m) return raceName
  const base = PAISES_GP[minusc(m[1])] ?? m[1]
  const en = m[2] ? ` en ${PAISES[minusc(m[2])] ?? m[2]}` : ''
  return `Gran Premio de ${base}${en}`
}

const iso = (s: J) => (s?.date ? `${s.date}T${s.time ?? '00:00:00Z'}` : null)

export interface SesionGp { nombre: string; iso: string }
export interface Gp {
  temporada: string
  ronda: number
  nombre: string
  circuito: string
  lugar: string | null
  carreraIso: string
  sesiones: SesionGp[]
}

/** Del objeto «Race» de Jolpica al GP con sus sesiones en orden. Puro. */
export function gpDesdeJolpica(r: J): Gp | null {
  const carreraIso = iso(r)
  if (!r || !carreraIso) return null
  const s: Array<[string, J]> = [
    ['Libres 1', r.FirstPractice], ['Libres 2', r.SecondPractice], ['Libres 3', r.ThirdPractice],
    ['Clasificación al sprint', r.SprintQualifying ?? r.SprintShootout], ['Sprint', r.Sprint],
    ['Clasificación', r.Qualifying], ['Carrera', r],
  ]
  const sesiones = s.map(([nombre, x]) => ({ nombre, iso: iso(x) })).filter((x): x is SesionGp => !!x.iso)
    .sort((a, b) => Date.parse(a.iso) - Date.parse(b.iso))
  const loc = r?.Circuit?.Location
  return {
    temporada: String(r.season), ronda: Number(r.round), nombre: nombreGp(String(r.raceName ?? '')),
    circuito: String(r?.Circuit?.circuitName ?? ''),
    lugar: [loc?.locality, loc?.country ? (PAISES[minusc(loc.country)] ?? loc.country) : null].filter(Boolean).join(', ') || null,
    carreraIso, sesiones,
  }
}

export const refGp = (g: Pick<Gp, 'temporada' | 'ronda'>) => `racing_f1_${g.temporada}${String(g.ronda).padStart(2, '0')}`

const fmt = (i: string, tz: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-ES', { timeZone: tz, ...o }).format(new Date(i))
const hora = (i: string, tz: string) => fmt(i, tz, { hour: '2-digit', minute: '2-digit', hour12: false })
const dia = (i: string) => fmt(i, 'Europe/Madrid', { weekday: 'long', day: 'numeric', month: 'long' })
const nac = (n: unknown) => NACIONALIDADES[minusc(n)] ?? String(n ?? '')
export const piloto = (d: J) => `${d?.givenName ?? ''} ${d?.familyName ?? ''}`.trim()

function lineasMundial(pilotos: J[], equipos: J[], L: string[], tras: string) {
  if (pilotos.length) {
    L.push(`MUNDIAL DE PILOTOS ${tras}:`)
    pilotos.slice(0, 10).forEach((x: J) => L.push(`${x.position}. ${piloto(x.Driver)} (${(x.Constructors ?? [])[0]?.name ?? '?'}): ${pl(x.points, 'punto', 'puntos')}, ${pl(x.wins, 'victoria', 'victorias')}.`))
    const extra = pilotos.slice(10).filter((x: J) => HISPANOS.has(minusc(x?.Driver?.nationality)))
    extra.forEach((x: J) => L.push(`${x.position}. ${piloto(x.Driver)} (${(x.Constructors ?? [])[0]?.name ?? '?'}): ${pl(x.points, 'punto', 'puntos')}.`))
  }
  if (equipos.length) {
    L.push(`MUNDIAL DE CONSTRUCTORES ${tras}: ` + equipos.slice(0, 5).map((x: J) => `${x.position}. ${x?.Constructor?.name} ${x.points} pts`).join('; ') + '.')
  }
}

export function construirDossierGpPrevia(g: Gp, pilotos: J[], equipos: J[]): { datos: Record<string, unknown>; texto: string } {
  const L: string[] = []
  L.push(`GRAN PREMIO: ${g.nombre} ${g.temporada}, ronda ${g.ronda} del Mundial de Fórmula 1.`)
  L.push(`CIRCUITO: ${g.circuito}${g.lugar ? ` (${g.lugar})` : ''}.`)
  L.push('HORARIOS DEL FIN DE SEMANA (España peninsular · Ciudad de México · Bogotá y Lima · Buenos Aires):')
  for (const s of g.sesiones) {
    L.push(`- ${s.nombre}: ${dia(s.iso)}, ${hora(s.iso, 'Europe/Madrid')} · ${hora(s.iso, 'America/Mexico_City')} · ${hora(s.iso, 'America/Bogota')} · ${hora(s.iso, 'America/Argentina/Buenos_Aires')}.`)
  }
  L.push('TELEVISIÓN: no consta.')
  L.push('')
  lineasMundial(pilotos, equipos, L, 'ANTES DE ESTE GRAN PREMIO')
  const datos = {
    matchRef: refGp(g), sport: 'formula1', home: g.nombre, away: g.circuito, competicion: 'Fórmula 1',
    kickoffIso: g.carreraIso, estadio: g.circuito, ciudad: g.lugar, sesiones: g.sesiones,
  }
  return { datos, texto: L.join('\n') }
}

export function construirDossierGpCronica(g: Gp, resultados: J[], pilotos: J[], equipos: J[]): { datos: Record<string, unknown>; texto: string } {
  const L: string[] = []
  L.push(`GRAN PREMIO: ${g.nombre} ${g.temporada}, ronda ${g.ronda} del Mundial de Fórmula 1. CARRERA: ${dia(g.carreraIso)}.`)
  L.push(`CIRCUITO: ${g.circuito}${g.lugar ? ` (${g.lugar})` : ''}.`)
  L.push('RESULTADO DE LA CARRERA (posición, piloto, nacionalidad, equipo, tiempo o diferencia, puntos, posición de salida):')
  const linea = (x: J) => {
    const tiempo = x?.Time?.time || estadoEs(x?.status)
    const vr = x?.FastestLap?.rank === '1' ? ', VUELTA RÁPIDA' : ''
    return `${x.position}. ${piloto(x.Driver)} (${nac(x?.Driver?.nationality)}), ${x?.Constructor?.name}: ${tiempo || 'sin tiempo'}, ${pl(x.points, 'punto', 'puntos')}, salió ${x.grid === '0' ? 'desde el pit lane' : x.grid + '.º'}${vr}.`
  }
  resultados.slice(0, 10).forEach((x) => L.push(linea(x)))
  const resto = resultados.slice(10).filter((x) => HISPANOS.has(minusc(x?.Driver?.nationality)) || !/finished|lap/i.test(String(x?.status)))
  if (resto.length) {
    L.push('MÁS ALLÁ DEL 10.º (hispanos y abandonos):')
    resto.forEach((x) => L.push(linea(x)))
  }
  L.push('')
  lineasMundial(pilotos, equipos, L, 'TRAS ESTE GRAN PREMIO')
  const ganador = resultados[0]
  const datos = {
    matchRef: refGp(g), sport: 'formula1', home: g.nombre, away: g.circuito, competicion: 'Fórmula 1',
    kickoffIso: g.carreraIso, estadio: g.circuito, ciudad: g.lugar,
    ganador: ganador ? piloto(ganador.Driver) : null, equipo: ganador?.Constructor?.name ?? null,
  }
  return { datos, texto: L.join('\n') }
}

/** GET a Jolpica; null si falla (no tumba el cron). */
export async function fetchJolpica(ruta: string): Promise<J | null> {
  try {
    const r = await fetch(`${JOLPICA}/${ruta.replace(/^\//, '')}`, { signal: AbortSignal.timeout(12000), cache: 'no-store' })
    return r.ok ? await r.json() : null
  } catch {
    return null
  }
}
