// Dossier de una previa: los DATOS VERIFICADOS del partido, en texto, para que el
// redactor (WF-08, en taka-system) escriba sobre ellos y solo sobre ellos.
//
// Sale de la ficha `summary` de ESPN — la misma fuente que la ficha de partido de
// la web, gratis y sin clave. Todo lo que aquí aparece es un dato oficial; el
// control antiinvención de WF-08 da por bueno cualquier cifra que esté en este
// texto y marca las que no. Por eso se escribe con cifras explícitas y no se
// resume nada que el redactor pudiera necesitar citar.
//
// Puro salvo `fetchSummary`: se prueba con fixtures.

import { toSpanishNation } from '@/lib/nation-names'

/* eslint-disable @typescript-eslint/no-explicit-any */
type J = any

// Rondas y torneos tal y como los escribe ESPN → español. Medido en la primera
// previa de prueba (Francia–Italia, 02/10/2026): con los nombres en inglés el
// redactor dejaba "Türkiye" en el texto.
const RONDAS: Array<[RegExp, string]> = [
  [/3rd-Place Match/i, 'partido por el tercer puesto'], [/Quarterfinals?/i, 'cuartos de final'],
  [/Semifinals?/i, 'semifinales'], [/Round of 16/i, 'octavos de final'], [/Round of 32/i, 'dieciseisavos de final'],
  [/Group Stage/i, 'fase de grupos'], [/League Phase/i, 'fase de liga'], [/Playoff Finals?/i, 'final de la repesca'],
  [/Playoffs?/i, 'eliminatoria'], [/\bFinal\b/i, 'final'],
  [/International Friendly/i, 'amistoso internacional'], [/FIFA World Cup/i, 'Mundial'],
  [/World Cup Qualifying - UEFA/i, 'clasificación europea para el Mundial'], [/World Cup Qualifying/i, 'clasificación para el Mundial'],
  [/UEFA Nations League/i, 'Liga de Naciones de la UEFA'], [/UEFA Champions League/i, 'Liga de Campeones'],
  [/Regular Season/i, 'temporada regular'],
]
const traducir = (t: string | null | undefined) => RONDAS.reduce((acc, [rx, es]) => acc.replace(rx, es), String(t ?? ''))
const nombreEs = (n: string | null | undefined) => toSpanishNation(n ?? '') || (n ?? '?')

const ESPN_SUMMARY = 'https://site.api.espn.com/apis/site/v2/sports'

export interface MatchRefParts { sport: 'soccer' | 'basketball'; league: string; event: string }

export function parseMatchRef(ref: string): MatchRefParts | null {
  const m = /^(soccer|basketball)_(.+)_(\d+)$/.exec(ref || '')
  return m ? { sport: m[1] as MatchRefParts['sport'], league: m[2], event: m[3] } : null
}

export async function fetchSummary(ref: string): Promise<J | null> {
  const p = parseMatchRef(ref)
  if (!p) return null
  try {
    const r = await fetch(`${ESPN_SUMMARY}/${p.sport}/${p.league}/summary?event=${p.event}`, {
      signal: AbortSignal.timeout(15000),
      cache: 'no-store',
    })
    return r.ok ? await r.json() : null
  } catch {
    return null
  }
}

/** NBA de pretemporada: ESPN la marca con `season.type === 1`. No merece previa. */
export function esPretemporada(summary: J, sport: 'futbol' | 'baloncesto'): boolean {
  return sport === 'baloncesto' && summary?.header?.season?.type === 1
}

const fmtFecha = (iso: string | undefined, tz = 'Europe/Madrid') => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('es-ES', { timeZone: tz, day: 'numeric', month: 'long', year: 'numeric' }).format(d)
}
const fmtHora = (iso: string, tz: string) =>
  new Intl.DateTimeFormat('es-ES', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))

/** Probabilidad implícita de una cuota americana, en %. */
export function probImplicita(moneyLine: unknown): number | null {
  const ml = Number(moneyLine)
  if (!Number.isFinite(ml) || ml === 0) return null
  const p = ml < 0 ? -ml / (-ml + 100) : 100 / (ml + 100)
  return Math.round(p * 100)
}

const RESULTADO: Record<string, string> = { W: 'victoria', L: 'derrota', D: 'empate', T: 'empate' }

const CATEGORIAS: Record<string, string> = {
  goalsLeaders: 'Máximo goleador', assistsLeaders: 'Máximo asistente', totalShots: 'Más tiros',
  accuratePasses: 'Más pases acertados', saves: 'Más paradas', points: 'Máximo anotador',
  rebounds: 'Máximo reboteador', assists: 'Máximo asistente',
}
// Etiquetas que ESPN solo trae en inglés y sin clave conocida.
const CATEGORIAS_TEXTO: Record<string, string> = {
  'Defensive Interventions': 'Intervenciones defensivas', 'Goals': 'Goles', 'Assists': 'Asistencias',
  'Points': 'Puntos', 'Rebounds': 'Rebotes', 'Total Shots': 'Tiros', 'Saves': 'Paradas',
}
// "Matches: 2, Goals: 3" → "3 goles en 2 partidos"; lo que no encaja se deja tal cual.
function traducirValor(v: unknown): string {
  const t = String(v ?? '')
  const m = /Matches:\s*(\d+),\s*(Goals|Assists):\s*(\d+)/i.exec(t)
  if (m) return `${m[3]} ${m[2].toLowerCase() === 'goals' ? (m[3] === '1' ? 'gol' : 'goles') : (m[3] === '1' ? 'asistencia' : 'asistencias')} en ${m[1]} ${m[1] === '1' ? 'partido' : 'partidos'}`
  return t
}

export interface DatosPrevia {
  matchRef: string
  sport: 'futbol' | 'baloncesto'
  home: string
  away: string
  competicion: string
  fase: string | null
  kickoffIso: string
  estadio: string | null
  ciudad: string | null
  /** Foto libre del estadio (Commons): fondo de la placa si no hay foto de noticias. */
  fotoEstadio?: { url: string; autor: string | null; licencia: string | null; titulo: string } | null
}

/**
 * Convierte la ficha de ESPN en el bloque de texto que recibe el redactor.
 * `home`/`away` llegan ya en español (del calendario de la web) y sustituyen a los
 * nombres en inglés de ESPN allí donde se refieren a los dos protagonistas.
 */
export interface FilaTv { country: string; channels: string[] }

export function construirDossier(
  summary: J,
  base: Omit<DatosPrevia, 'estadio' | 'ciudad' | 'fase'>,
  tv: readonly FilaTv[] = [],
): { datos: DatosPrevia; texto: string } {
  const comp = summary?.header?.competitions?.[0] ?? {}
  const competidores: J[] = comp.competitors ?? []
  const espnHome = competidores.find((c) => c.homeAway === 'home')
  const espnAway = competidores.find((c) => c.homeAway === 'away')
  const idHome = String(espnHome?.team?.id ?? espnHome?.id ?? '')
  const idAway = String(espnAway?.team?.id ?? espnAway?.id ?? '')
  const nombre = (id: string, fallback: string) => (id === idHome ? base.home : id === idAway ? base.away : nombreEs(fallback))

  const venue = summary?.gameInfo?.venue ?? {}
  const datos: DatosPrevia = {
    ...base,
    // El calendario trae etiquetas cortas ("Nations"); la ficha, el nombre entero.
    competicion: summary?.header?.league?.name || base.competicion,
    fase: summary?.header?.season?.name ?? null,
    estadio: venue.fullName ?? null,
    ciudad: [venue.address?.city, venue.address?.country].filter(Boolean).join(', ') || null,
  }

  const L: string[] = []
  L.push(`PARTIDO: ${base.home} (local) contra ${base.away} (visitante).`)
  L.push(`COMPETICIÓN: ${datos.competicion}${datos.fase ? ` — ${traducir(datos.fase)}` : ''}. No consta grupo ni jornada: no los menciones.`)
  L.push(`FECHA Y HORA: ${fmtFecha(base.kickoffIso)}, a las ${fmtHora(base.kickoffIso, 'Europe/Madrid')} hora peninsular española ` +
    `(${fmtHora(base.kickoffIso, 'America/Mexico_City')} en Ciudad de México, ${fmtHora(base.kickoffIso, 'America/Bogota')} en Bogotá y Lima, ` +
    `${fmtHora(base.kickoffIso, 'America/Argentina/Buenos_Aires')} en Buenos Aires).`)
  if (datos.estadio) L.push(`ESTADIO: ${datos.estadio}${datos.ciudad ? ` (${datos.ciudad})` : ''}.`)
  // Derechos de TV verificados (tabla broadcast_rights de la web). Si no hay, se
  // dice: el redactor rellenaba el hueco con "plataformas oficiales de la UEFA".
  L.push(tv.length
    ? 'TELEVISIÓN (derechos verificados por país):\n' + tv.map((r) => `- ${r.country}: ${r.channels.join(', ')}`).join('\n')
    : 'TELEVISIÓN: no consta. NO menciones canales ni plataformas; di que los canales de cada país están en la tabla «Dónde verlo» de esta página.')

  // Balance en la competición (récord del encabezado)
  for (const c of [espnHome, espnAway]) {
    if (!c) continue
    const recs: J[] = c.record ?? []
    const total = recs.find((r) => r.type === 'total')?.displayValue
    const pts = recs.find((r) => r.type === 'points')?.displayValue
    if (total || pts) {
      const etiqueta = base.sport === 'futbol' ? 'victorias-empates-derrotas' : 'victorias-derrotas'
      L.push(`BALANCE DE ${nombre(String(c.team?.id ?? c.id), c.team?.displayName)} EN LA COMPETICIÓN: ${total ?? '-'} (${etiqueta})${pts ? `, ${pts} puntos` : ''}.`)
    }
  }

  // Clasificación: solo las filas de los dos equipos, con su puesto
  const grupos: J[] = summary?.standings?.groups ?? []
  const filas: string[] = []
  const puntos = new Map<string, number>()
  for (const g of grupos) {
    for (const e of g?.standings?.entries ?? []) {
      const id = String(e.id ?? e.team?.id ?? '')
      if (id !== idHome && id !== idAway) continue
      const st = Object.fromEntries((e.stats ?? []).map((s: J) => [s.name, s.displayValue]))
      if (st.points != null && Number.isFinite(Number(st.points))) puntos.set(id, Number(st.points))
      const partes = [
        st.rank ? `${st.rank}º` : null,
        st.points ? `${st.points} puntos` : null,
        st.gamesPlayed ? `${st.gamesPlayed} partidos jugados` : null,
        st.overall ? `balance ${st.overall}` : null,
        st.pointDifferential ? `diferencia ${st.pointDifferential}` : null,
      ].filter(Boolean)
      filas.push(`- ${nombre(id, e.team)}${g.header ? ` (${g.header})` : ''}: ${partes.join(', ')}`)
    }
  }
  if (filas.length) L.push('CLASIFICACIÓN ACTUAL:\n' + filas.join('\n'))

  // Escenarios ya CALCULADOS: en la primera prueba el redactor sumó 6 + 3 y le
  // salieron 8. Las cuentas se hacen aquí, no en el modelo.
  const pH = puntos.get(idHome), pA = puntos.get(idAway)
  if (base.sport === 'futbol' && pH !== undefined && pA !== undefined) {
    L.push(`ESCENARIOS DE PUNTOS TRAS EL PARTIDO (calculados, úsalos tal cual): ` +
      `si gana ${base.home}, ${base.home} ${pH + 3} y ${base.away} ${pA}; ` +
      `si empatan, ${base.home} ${pH + 1} y ${base.away} ${pA + 1}; ` +
      `si gana ${base.away}, ${base.home} ${pH} y ${base.away} ${pA + 3}.`)
  }

  // Últimos cinco de cada uno
  for (const bloque of summary?.lastFiveGames ?? []) {
    const id = String(bloque?.team?.id ?? '')
    const evs: J[] = bloque?.events ?? []
    if (!evs.length) continue
    // ESPN los da del más antiguo al más reciente; se invierten para que el primero
    // sea el último partido jugado (en la prueba, el redactor tomó el primero de la
    // lista por "el último").
    const ultimos = [...evs].sort((x, y) => String(y.gameDate).localeCompare(String(x.gameDate))).slice(0, 5)
    const lineas = ultimos.map((e, i) => {
      const res = RESULTADO[e.gameResult] ?? e.gameResult ?? '?'
      const donde = 'contra'
      // `score` de ESPN pone primero al GANADOR ("2-0" en una victoria a domicilio y
      // "2-1" en una derrota). Se rehace desde el punto de vista del equipo con los
      // marcadores por lado, para que el redactor no lo lea al revés.
      const propio = String(e.homeTeamId) === id ? e.homeTeamScore : e.awayTeamScore
      const rival = String(e.homeTeamId) === id ? e.awayTeamScore : e.homeTeamScore
      const marcador = propio != null && rival != null ? `${propio}-${rival}` : (e.score ?? '?')
      // Empate en el marcador con resultado W/L = se decidió en los penaltis.
      const penP = String(e.homeTeamId) === id ? e.homeShootoutScore : e.awayShootoutScore
      const penR = String(e.homeTeamId) === id ? e.awayShootoutScore : e.homeShootoutScore
      const penaltis = Number(penP) + Number(penR) > 0 ? ` (${penP}-${penR} en los penaltis)` : ''
      return `- ${fmtFecha(e.gameDate)}${i === 0 ? ' (SU ÚLTIMO PARTIDO)' : ''}: ${res} ${marcador}${penaltis} ${donde} ${nombreEs(e.opponent?.displayName)}` +
        (e.competitionName ? ` — ${traducir(e.competitionName)}${e.roundName ? `, ${traducir(e.roundName)}` : ''}` : '')
    })
    L.push(`ÚLTIMOS PARTIDOS DE ${nombre(id, bloque?.team?.displayName)} (del más reciente al más antiguo; marcador desde su punto de vista, sus goles primero):\n` + lineas.join('\n'))
  }

  // Cara a cara
  for (const s of summary?.seasonseries ?? []) {
    const evs: J[] = (s?.events ?? []).filter((e: J) => e?.statusType?.completed || e?.status === 'post')
      .sort((x: J, y: J) => String(y.date).localeCompare(String(x.date)))
    const cab = s?.summary ? ` (${s.summary})` : ''
    if (!evs.length && !s?.summary) continue
    const lineas = evs.slice(0, 5).map((e, i) => {
      const h = (e.competitors ?? []).find((c: J) => c.homeAway === 'home')
      const a = (e.competitors ?? []).find((c: J) => c.homeAway === 'away')
      if (!h || !a) return null
      const nh = nombre(String(h.team?.id), h.team?.displayName)
      const na = nombre(String(a.team?.id), a.team?.displayName)
      const gh = Number(h.score), ga = Number(a.score)
      // El ganador va ESCRITO: en la primera prueba el redactor leyó "Italia 1-3
      // Francia" como victoria italiana.
      const quien = Number.isFinite(gh) && Number.isFinite(ga)
        ? (gh > ga ? `ganó ${nh}` : ga > gh ? `ganó ${na}` : 'empate')
        : 'resultado no disponible'
      return `- ${fmtFecha(e.date)}${i === 0 ? ' (EL MÁS RECIENTE)' : ''}: ${quien} — ${nh} (local) ${h.score ?? '?'}, ${na} (visitante) ${a.score ?? '?'}`
    }).filter(Boolean)
    // Recuento CALCULADO de esos mismos partidos, para que el redactor no tenga que
    // deducirlo (en la prueba llamó "única victoria italiana" a una de Francia).
    const victorias = new Map<string, string[]>()
    let empates = 0
    for (const e of evs.slice(0, 5)) {
      const h = (e.competitors ?? []).find((c: J) => c.homeAway === 'home')
      const a = (e.competitors ?? []).find((c: J) => c.homeAway === 'away')
      const gh = Number(h?.score), ga = Number(a?.score)
      if (!h || !a || !Number.isFinite(gh) || !Number.isFinite(ga)) continue
      if (gh === ga) { empates++; continue }
      const g = gh > ga ? nombre(String(h.team?.id), h.team?.displayName) : nombre(String(a.team?.id), a.team?.displayName)
      victorias.set(g, [...(victorias.get(g) ?? []), fmtFecha(e.date)])
    }
    if (victorias.size || empates) {
      const partes = [...victorias.entries()].map(([g, f]) => `${g} ganó ${f.length} (${f.join('; ')})`)
      if (empates) partes.push(`${empates} empate${empates > 1 ? 's' : ''}`)
      lineas.push(`RECUENTO DE ESTOS ${Math.min(evs.length, 5)} PARTIDOS (calculado): ${partes.join('; ')}. No hay más historial en DATA: no des totales históricos.`)
    }
    L.push(`ENFRENTAMIENTOS DIRECTOS ENTRE ${base.home.toUpperCase()} Y ${base.away.toUpperCase()}, del más reciente al más antiguo${cab}:` + (lineas.length ? '\n' + lineas.join('\n') : ' sin partidos previos registrados.'))
  }

  // Líderes estadísticos de cada equipo en la competición
  for (const t of summary?.leaders ?? []) {
    const id = String(t?.team?.id ?? '')
    const cats = (t?.leaders ?? []).map((c: J) => {
      const etiqueta = CATEGORIAS[c?.name] ?? CATEGORIAS_TEXTO[c?.displayName] ?? c?.displayName ?? c?.name
      const top = (c?.leaders ?? []).slice(0, 2).map((x: J) => `${x?.athlete?.displayName} — ${traducirValor(x?.displayValue)}`)
      return top.length ? `${etiqueta}: ${top.join('; ')}` : null
    }).filter(Boolean)
    if (cats.length) L.push(`LÍDERES DE ${nombre(id, t?.team?.displayName)} EN LA COMPETICIÓN:\n- ` + cats.join('\n- '))
  }

  // Lesionados (NBA lo trae; en fútbol suele venir vacío)
  for (const t of summary?.injuries ?? []) {
    const id = String(t?.team?.id ?? '')
    const lista = (t?.injuries ?? []).map((i: J) => {
      const tipo = i?.details?.type ? `, ${i.details.type}` : ''
      return `${i?.athlete?.displayName} (${i?.status ?? 'baja'}${tipo})`
    })
    if (lista.length) L.push(`PARTE MÉDICO DE ${nombre(id, t?.team?.displayName)}: ${lista.join('; ')}.`)
  }

  // Pronóstico del mercado, convertido a probabilidad — sin nombrar casas de apuestas
  const pc = (summary?.pickcenter ?? [])[0]
  if (pc) {
    // Las tres implícitas suman más de 100 (el margen de la casa): se normalizan
    // para que el texto no diga "94 %, 9 % y 5 %".
    const crudas = [pc.homeTeamOdds?.moneyLine, pc.drawOdds?.moneyLine, pc.awayTeamOdds?.moneyLine].map(probImplicita)
    const suma = crudas.reduce<number>((acc, p) => acc + (p ?? 0), 0)
    const norm = (p: number | null) => (p === null || suma <= 0 ? null : Math.round((p / suma) * 100))
    const [pH, pD, pA] = crudas.map(norm)
    const partes = [
      pH !== null ? `${base.home} ${pH}%` : null,
      pD !== null ? `empate ${pD}%` : null,
      pA !== null ? `${base.away} ${pA}%` : null,
    ].filter(Boolean)
    if (partes.length) {
      L.push(`PRONÓSTICO DEL MERCADO (probabilidad implícita, orientativa; NO nombres casas de apuestas ni menciones cuotas): ${partes.join(', ')}.` +
        (pc.overUnder ? ` Línea de ${base.sport === 'futbol' ? 'goles' : 'puntos'} totales: ${pc.overUnder}.` : ''))
    }
  }

  // Noticias de ESPN que mencionan a alguno de los dos: contexto, no hechos del partido
  const nombresEn = [espnHome?.team?.displayName, espnAway?.team?.displayName, espnHome?.team?.location, espnAway?.team?.location]
    .filter(Boolean).map((n: string) => n.toLowerCase())
  const noticias = (summary?.news?.articles ?? []).filter((a: J) => {
    const t = `${a?.headline ?? ''} ${a?.description ?? ''}`.toLowerCase()
    return nombresEn.some((n) => t.includes(n))
  }).slice(0, 4)
  if (noticias.length) {
    L.push('ACTUALIDAD RECIENTE DE LOS EQUIPOS (titulares en inglés; tradúcelos, no los cites literalmente):\n' +
      noticias.map((a: J) => `- ${fmtFecha(a.published)}: ${a.headline}${a.description ? ` — ${a.description}` : ''}`).join('\n'))
  }

  return { datos, texto: L.join('\n\n') }
}

// ── CRÓNICA ─────────────────────────────────────────────────────────────────
// Mismo principio que la previa: todo dato que el redactor pueda citar sale de
// aquí, ya contado y escrito sin ambigüedades (marcador al descanso calculado,
// goles con minuto y autor, el ganador escrito). El resumen de ESPN (en inglés)
// entra solo como contexto: el redactor no lo traduce ni lo copia.

const ESTADISTICAS_FUTBOL: Array<[string, string, (v: string) => string]> = [
  ['possessionPct', 'Posesión', (v) => `${v}%`],
  ['totalShots', 'Tiros', (v) => v],
  ['shotsOnTarget', 'Tiros a puerta', (v) => v],
  ['wonCorners', 'Saques de esquina', (v) => v],
  ['foulsCommitted', 'Faltas', (v) => v],
  ['offsides', 'Fueras de juego', (v) => v],
  ['saves', 'Paradas', (v) => v],
  ['accuratePasses', 'Pases acertados', (v) => v],
  ['totalPasses', 'Pases totales', (v) => v],
  ['yellowCards', 'Amarillas', (v) => v],
  ['redCards', 'Rojas', (v) => v],
]

/** ¿Este keyEvent de ESPN es un gol? Ojo: el penalti marcado llega como
 *  "Penalty - Scored", SIN la palabra "goal" (lo cazó una prueba el 02/10/2026). */
export function esGol(tipo: string): boolean {
  if (/no goal|disallow|missed|saved/i.test(tipo)) return false
  return /goal/i.test(tipo) || /penalty\s*-\s*scored/i.test(tipo)
}

/** Minuto de ESPN ("45'+2'") → número para ordenar y partir en mitades. */
function minutoNum(m: string | undefined): number {
  const x = /(\d+)'?(?:\s*\+\s*(\d+))?/.exec(m ?? '')
  return x ? Number(x[1]) + (x[2] ? Number(x[2]) / 100 : 0) : 999
}

export function construirDossierCronica(
  summary: J,
  base: Omit<DatosPrevia, 'estadio' | 'ciudad' | 'fase'>,
): { datos: DatosPrevia & { marcador: { home: number; away: number } }; texto: string } {
  const comp = summary?.header?.competitions?.[0] ?? {}
  const competidores: J[] = comp.competitors ?? []
  const cH = competidores.find((c) => c.homeAway === 'home')
  const cA = competidores.find((c) => c.homeAway === 'away')
  const idH = String(cH?.team?.id ?? '')
  const idA = String(cA?.team?.id ?? '')
  const nombre = (id: string, fallback: string) => (id === idH ? base.home : id === idA ? base.away : nombreEs(fallback))
  const gH = Number(cH?.score), gA = Number(cA?.score)
  const venue = summary?.gameInfo?.venue ?? {}
  const datos = {
    ...base,
    competicion: summary?.header?.league?.name || base.competicion,
    fase: summary?.header?.season?.name ?? null,
    estadio: venue.fullName ?? null,
    ciudad: [venue.address?.city, venue.address?.country].filter(Boolean).join(', ') || null,
    marcador: { home: gH, away: gA },
  }

  const L: string[] = []
  const ganador = gH > gA ? `ganó ${base.home}` : gA > gH ? `ganó ${base.away}` : 'empate'
  L.push(`RESULTADO FINAL: ${base.home} ${gH} - ${gA} ${base.away} (${ganador}). ${base.home} jugaba como local.`)
  L.push(`COMPETICIÓN: ${datos.competicion}${datos.fase ? ` — ${traducir(datos.fase)}` : ''}. No consta grupo ni jornada: no los menciones.`)
  L.push(`FECHA: ${fmtFecha(base.kickoffIso)}, ${fmtHora(base.kickoffIso, 'Europe/Madrid')} hora peninsular española.`)
  if (datos.estadio) L.push(`ESTADIO: ${datos.estadio}${datos.ciudad ? ` (${datos.ciudad})` : ''}.`)
  const gi = summary?.gameInfo ?? {}
  if (gi.attendance) L.push(`ASISTENCIA: ${gi.attendance} espectadores.`)
  const arbitros = (gi.officials ?? []).map((o: J) => o?.displayName).filter(Boolean)
  if (arbitros.length) L.push(`ÁRBITRO: ${arbitros.join(', ')}.`)

  // Goles, tarjetas y cambios, en orden de minuto
  const ke: J[] = summary?.keyEvents ?? []
  const goles: string[] = []
  const tarjetas: string[] = []
  let alDescanso = { h: 0, a: 0 }
  for (const e of [...ke].sort((x, y) => minutoNum(x?.clock?.displayValue) - minutoNum(y?.clock?.displayValue))) {
    const tipo = String(e?.type?.text ?? '')
    const min = String(e?.clock?.displayValue ?? '')
    const equipoId = String(e?.team?.id ?? '')
    const equipo = nombre(equipoId, e?.team?.displayName ?? '')
    const gente: string[] = (e?.participants ?? []).map((p: J) => p?.athlete?.displayName).filter(Boolean)
    if (esGol(tipo)) {
      const propia = /own goal/i.test(tipo)
      const como = propia ? 'en propia puerta' : /penalty/i.test(tipo) ? 'de penalti' : /header/i.test(tipo) ? 'de cabeza' : ''
      const asist = !propia && gente[1] ? `, asistencia de ${gente[1]}` : ''
      goles.push(`- ${min}: gol de ${equipo} — ${gente[0] ?? 'autor no disponible'}${como ? ` (${como})` : ''}${asist}`)
      if (minutoNum(min) <= 45.99) {
        if (equipoId === idH) alDescanso.h++
        else if (equipoId === idA) alDescanso.a++
      }
    } else if (/card/i.test(tipo)) {
      tarjetas.push(`- ${min}: ${/red/i.test(tipo) ? 'ROJA' : 'amarilla'} a ${gente[0] ?? '?'} (${equipo})`)
    }
  }
  if (base.sport === 'futbol') {
    L.push('GOLES (los ÚNICOS del partido, en orden; minuto, equipo y autor):\n' + (goles.length ? goles.join('\n') : '- ninguno: el partido acabó sin goles'))
    if (goles.length) L.push(`MARCADOR AL DESCANSO (calculado): ${base.home} ${alDescanso.h} - ${alDescanso.a} ${base.away}.`)
    if (tarjetas.length) L.push('TARJETAS:\n' + tarjetas.join('\n'))
  }

  // Marcador por cuartos (NBA)
  if (base.sport === 'baloncesto') {
    const parciales = (c: J) => (c?.linescores ?? []).map((l: J) => l?.displayValue ?? l?.value).join(' - ')
    if (cH?.linescores?.length) {
      L.push(`PARCIALES POR CUARTO:\n- ${base.home}: ${parciales(cH)}\n- ${base.away}: ${parciales(cA)}`)
    }
  }

  // Estadísticas del partido
  const bx: J[] = summary?.boxscore?.teams ?? []
  const bH = bx.find((t) => String(t?.team?.id) === idH)
  const bA = bx.find((t) => String(t?.team?.id) === idA)
  if (bH && bA) {
    const mapa = (t: J) => Object.fromEntries((t.statistics ?? []).map((s: J) => [s.name, s.displayValue]))
    const mH = mapa(bH), mA = mapa(bA)
    const filas = base.sport === 'futbol'
      ? ESTADISTICAS_FUTBOL.filter(([k]) => mH[k] != null && mA[k] != null).map(([k, et, f]) => `- ${et}: ${base.home} ${f(mH[k])}, ${base.away} ${f(mA[k])}`)
      : (bH.statistics ?? []).slice(0, 12).map((s: J) => `- ${s.label ?? s.name}: ${base.home} ${s.displayValue}, ${base.away} ${mA[s.name] ?? '?'}`)
    if (filas.length) L.push('ESTADÍSTICAS DEL PARTIDO:\n' + filas.join('\n'))
  }

  // Líderes del partido (NBA) / del equipo en la competición (fútbol)
  for (const t of summary?.leaders ?? []) {
    const id = String(t?.team?.id ?? '')
    const cats = (t?.leaders ?? []).map((c: J) => {
      const etiqueta = CATEGORIAS[c?.name] ?? CATEGORIAS_TEXTO[c?.displayName] ?? c?.displayName ?? c?.name
      const top = (c?.leaders ?? []).slice(0, 1).map((x: J) => `${x?.athlete?.displayName} — ${traducirValor(x?.displayValue)}`)
      return top.length ? `${etiqueta}: ${top.join('; ')}` : null
    }).filter(Boolean)
    if (cats.length) {
      L.push(`DESTACADOS DEL PARTIDO EN ${nombre(id, t?.team?.displayName)}:\n- ` + cats.join('\n- '))
    }
  }

  // Clasificación ya actualizada con este resultado
  const filas: string[] = []
  for (const g of summary?.standings?.groups ?? []) {
    for (const e of g?.standings?.entries ?? []) {
      const id = String(e.id ?? e.team?.id ?? '')
      if (id !== idH && id !== idA) continue
      const st = Object.fromEntries((e.stats ?? []).map((s: J) => [s.name, s.displayValue]))
      filas.push(`- ${nombre(id, e.team)}: ${[st.rank ? `${st.rank}º` : null, st.points ? `${st.points} puntos` : null, st.gamesPlayed ? `${st.gamesPlayed} partidos` : null, st.overall ? `balance ${st.overall}` : null].filter(Boolean).join(', ')}`)
    }
  }
  if (filas.length) L.push('CLASIFICACIÓN TRAS EL PARTIDO:\n' + filas.join('\n'))

  const art = summary?.article
  if (art?.headline) {
    L.push(`RESUMEN DE AGENCIA (en inglés; solo contexto, NO lo traduzcas ni lo copies, y no cites el medio): ${art.headline}${art.description ? ` — ${art.description}` : ''}`)
  }

  return { datos, texto: L.join('\n\n') }
}
