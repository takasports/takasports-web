// Balance del CARA A CARA a partir de los enfrentamientos que ya da la API
// (`/api/match/[ref]` → headToHead.matches, hoy los 5 últimos de ESPN).
//
// Función PURA y sin dependencias, con dos copias IDÉNTICAS:
// `takasports-web/src/lib/h2h-resumen.ts` y `takasports-app/src/lib/h2h-resumen.ts`
// (el paquete shared va por tarball vendorizado y no se toca para esto). Si
// cambias una, cambia la otra y sus pruebas: las dos baterías (vitest en la
// web, jest en la app) comprueban los mismos casos.
//
// Todo se cuenta desde el punto de vista del LOCAL DE HOY (G/E/P = gana,
// empata o pierde el local del partido que se está mirando), sea cual sea el
// campo en el que se jugó cada enfrentamiento.
//
// Salvaguarda: solo entran partidos YA JUGADOS. Se descartan los que tienen
// fecha posterior a `ahora` y los que no traen marcador: la serie de la NBA
// mandaba los partidos por jugar con 0-0 y el cara a cara pintaba empates
// inventados. El arreglo de verdad está en la API; esto es la red por si otra
// fuente vuelve a colarlos.
//
// Reglas para pocos partidos (N = enfrentamientos con marcador y lados
// reconocibles). Con 5 hay de todo; con menos se apaga lo que no dice nada:
//   · N = 0 → nada (la ficha enseña su estado vacío).
//   · N = 1 → solo la lista con ese partido: un «1-0-0» o una barra entera de
//     un color no informan de nada que no diga ya el propio marcador.
//   · N ≥ 2 → victorias / empates / victorias del contrario (números).
//   · N ≥ 3 → la barra, los goles (a favor-en contra, por partido, «marcan los
//     dos») y «según dónde se juega» (si hay partidos en casa Y fuera; la barra
//     de cada fila, solo si esa fila tiene 2 o más).
//   · Datos: la racha solo si dura 2 o más; la mayor goleada solo con una
//     diferencia de 2 o más (en baloncesto, 10); la última victoria de cada uno
//     y el último duelo, sin repetir partido entre fichas. La sección solo sale
//     si hay algo más que el último duelo (que ya encabeza la lista).

export interface PartidoH2H {
  id: string
  isoDate: string
  comp: string
  home: string
  away: string
  homeScore: number | null
  awayScore: number | null
  homeAbbr?: string
  awayAbbr?: string
  homeLogo?: string
  awayLogo?: string
}

export interface EquipoH2H {
  nombre: string
  abbr?: string
  /** id ESPN: se reconoce también en la URL del escudo (…/500/93.png). */
  id?: string
}

export type ResultadoH2H = 'G' | 'E' | 'P'
export type LadoH2H = 'local' | 'visitante'

export interface FilaH2H {
  partido: PartidoH2H
  /** Desde el local de hoy. null = sin lados reconocibles. */
  resultado: ResultadoH2H | null
  /** ¿El local de hoy jugó ese partido en su campo? null = no se sabe. */
  localEnCasa: boolean | null
}

export interface TramoH2H {
  n: number
  g: number
  e: number
  p: number
}

export interface RachaH2H {
  /** Quién la lleva. null = solo empates. */
  equipo: LadoH2H | null
  tipo: 'victorias' | 'sinPerder' | 'empates'
  n: number
  /** Desglose DESDE EL EQUIPO de la racha: sus victorias y los empates. */
  victorias: number
  empates: number
}

export type FichaH2H =
  | { tipo: 'racha'; racha: RachaH2H }
  | { tipo: 'ultimaVictoria'; equipo: LadoH2H; partido: PartidoH2H }
  | { tipo: 'mayorGoleada'; equipo: LadoH2H; partido: PartidoH2H }
  | { tipo: 'ultimoDuelo'; partido: PartidoH2H; ganador: LadoH2H | null }

export interface ResumenH2H {
  /** Partidos que cuentan (con marcador y lados reconocibles). */
  n: number
  victoriasLocal: number
  empates: number
  victoriasVisitante: number
  /** Goles (o puntos) del local de hoy y del visitante de hoy en esos N. */
  golesLocal: number
  golesVisitante: number
  golesPorPartido: number
  ambosMarcan: number
  enCasa: TramoH2H
  fuera: TramoH2H
  racha: RachaH2H | null
  fichas: FichaH2H[]
  filas: FilaH2H[]
  mostrar: {
    balance: boolean
    barra: boolean
    goles: boolean
    segunDonde: boolean
    barraCasa: boolean
    barraFuera: boolean
    datos: boolean
  }
}

export interface OpcionesH2H {
  /** Diferencia mínima para hablar de «mayor goleada». Fútbol 2, baloncesto 10. */
  umbralGoleada?: number
  /** Máximo de fichas en «Datos». */
  maxFichas?: number
  /** «Ahora» (ms o Date) para descartar partidos futuros. Por defecto, Date.now(). Inyectable en pruebas. */
  ahora?: number | Date
}

/**
 * ¿Es un enfrentamiento ya jugado? Con marcador y sin fecha futura. Una fecha
 * ilegible no descarta (no se puede saber), el marcador ausente sí.
 */
export function esPartidoJugadoH2H(m: PartidoH2H, ahora: number | Date = Date.now()): boolean {
  if (m.homeScore == null || m.awayScore == null) return false
  const t = Date.parse(m.isoDate)
  const ref = typeof ahora === 'number' ? ahora : ahora.getTime()
  return Number.isNaN(t) || t <= ref
}

const norm = (s: string | undefined) =>
  (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

const idDeLogo = (logo: string | undefined) => {
  const m = logo?.match(/\/(\d+)\.png(?:\?|$)/)
  return m ? m[1] : undefined
}

function esEquipo(nombre: string, abbr: string | undefined, logo: string | undefined, eq: EquipoH2H): boolean {
  if (eq.nombre && norm(nombre) === norm(eq.nombre)) return true
  if (eq.abbr && abbr && norm(abbr) === norm(eq.abbr)) return true
  if (eq.id && idDeLogo(logo) === eq.id) return true
  return false
}

/** ¿Jugó el local de hoy en casa? null si no se puede saber con certeza. */
export function localJugoEnCasa(m: PartidoH2H, local: EquipoH2H, visitante: EquipoH2H): boolean | null {
  const casa = esEquipo(m.home, m.homeAbbr, m.homeLogo, local) || esEquipo(m.away, m.awayAbbr, m.awayLogo, visitante)
  const fuera = esEquipo(m.away, m.awayAbbr, m.awayLogo, local) || esEquipo(m.home, m.homeAbbr, m.homeLogo, visitante)
  if (casa === fuera) return null
  return casa
}

function resultadoDe(m: PartidoH2H, enCasa: boolean | null): ResultadoH2H | null {
  if (enCasa == null || m.homeScore == null || m.awayScore == null) return null
  const a = enCasa ? m.homeScore : m.awayScore
  const b = enCasa ? m.awayScore : m.homeScore
  return a > b ? 'G' : a < b ? 'P' : 'E'
}

const vacio = (): TramoH2H => ({ n: 0, g: 0, e: 0, p: 0 })
const sumar = (t: TramoH2H, r: ResultadoH2H) => {
  t.n++
  if (r === 'G') t.g++
  else if (r === 'E') t.e++
  else t.p++
}

const cuentaInicial = (seq: ResultadoH2H[], vale: (r: ResultadoH2H) => boolean) => {
  let k = 0
  while (k < seq.length && vale(seq[k])) k++
  return k
}

/** Racha vigente (desde el partido más reciente hacia atrás). */
export function calcularRacha(seq: ResultadoH2H[]): RachaH2H | null {
  if (seq.length < 2) return null
  const desde = (equipo: LadoH2H, n: number): RachaH2H => {
    const tramo = seq.slice(0, n)
    const gana: ResultadoH2H = equipo === 'local' ? 'G' : 'P'
    const victorias = tramo.filter((r) => r === gana).length
    const empates = n - victorias
    return { equipo, tipo: empates === 0 ? 'victorias' : 'sinPerder', n, victorias, empates }
  }
  const sinPerderLocal = cuentaInicial(seq, (r) => r !== 'P')
  const sinPerderVis = cuentaInicial(seq, (r) => r !== 'G')
  if (seq[0] === 'G') return sinPerderLocal >= 2 ? desde('local', sinPerderLocal) : null
  if (seq[0] === 'P') return sinPerderVis >= 2 ? desde('visitante', sinPerderVis) : null
  // Empezando por empate: la lleva quien suma más partidos sin perder.
  if (sinPerderLocal > sinPerderVis) return desde('local', sinPerderLocal)
  if (sinPerderVis > sinPerderLocal) return desde('visitante', sinPerderVis)
  // Iguales = todo empates desde el último.
  const n = cuentaInicial(seq, (r) => r === 'E')
  return n >= 2 ? { equipo: null, tipo: 'empates', n, victorias: 0, empates: n } : null
}

export function resumenH2H(
  partidos: PartidoH2H[],
  local: EquipoH2H,
  visitante: EquipoH2H,
  opciones: OpcionesH2H = {},
): ResumenH2H {
  const umbral = opciones.umbralGoleada ?? 2
  const maxFichas = opciones.maxFichas ?? 4

  // Fuera los partidos por jugar (fecha futura o sin marcador).
  const jugados = partidos.filter((m) => esPartidoJugadoH2H(m, opciones.ahora))

  // Más reciente primero, pase lo que pase con el orden de entrada.
  const ordenados = [...jugados].sort((a, b) => (b.isoDate || '').localeCompare(a.isoDate || ''))

  const filas: FilaH2H[] = ordenados.map((partido) => {
    const localEnCasa = localJugoEnCasa(partido, local, visitante)
    return { partido, localEnCasa, resultado: resultadoDe(partido, localEnCasa) }
  })
  const validas = filas.filter((f): f is FilaH2H & { resultado: ResultadoH2H; localEnCasa: boolean } => f.resultado != null)
  const n = validas.length

  const total = vacio()
  const enCasa = vacio()
  const fuera = vacio()
  let golesLocal = 0
  let golesVisitante = 0
  let ambosMarcan = 0
  for (const f of validas) {
    const { homeScore, awayScore } = f.partido as { homeScore: number; awayScore: number }
    sumar(total, f.resultado)
    sumar(f.localEnCasa ? enCasa : fuera, f.resultado)
    golesLocal += f.localEnCasa ? homeScore : awayScore
    golesVisitante += f.localEnCasa ? awayScore : homeScore
    if (homeScore > 0 && awayScore > 0) ambosMarcan++
  }

  const racha = calcularRacha(validas.map((f) => f.resultado))

  // ── Fichas de «Datos» ──
  // Prioridad (si sobran, caen las últimas): racha, último duelo, última
  // victoria del local, última del visitante, mayor goleada. Un partido solo
  // aparece en una ficha.
  const usados = new Set<string>()
  const ganadorDe = (f: FilaH2H): LadoH2H | null =>
    f.resultado === 'G' ? 'local' : f.resultado === 'P' ? 'visitante' : null

  const fRacha: FichaH2H | null = racha ? { tipo: 'racha', racha } : null

  let fUltimo: FichaH2H | null = null
  if (validas[0]) {
    fUltimo = { tipo: 'ultimoDuelo', partido: validas[0].partido, ganador: ganadorDe(validas[0]) }
    usados.add(validas[0].partido.id)
  }

  const ultimaDe = (lado: LadoH2H): FichaH2H | null => {
    const f = validas.find((v) => ganadorDe(v) === lado)
    if (!f || usados.has(f.partido.id)) return null
    usados.add(f.partido.id)
    return { tipo: 'ultimaVictoria', equipo: lado, partido: f.partido }
  }
  const fUltLocal = ultimaDe('local')
  const fUltVis = ultimaDe('visitante')

  let fGoleada: FichaH2H | null = null
  const dif = (f: FilaH2H) => Math.abs((f.partido.homeScore ?? 0) - (f.partido.awayScore ?? 0))
  const maxDif = validas.reduce((mx, f) => Math.max(mx, dif(f)), 0)
  if (maxDif >= umbral) {
    // Entre empatadas a diferencia máxima: la de más goles del ganador (un 4-2
    // «golea» más que un 2-0) y, a igualdad, la más reciente. Si la elegida ya
    // está en otra ficha se prueba la siguiente; si todas lo están, no se repite.
    const masGoles = (f: FilaH2H) => Math.max(f.partido.homeScore ?? 0, f.partido.awayScore ?? 0)
    const cand = validas
      .filter((f) => dif(f) === maxDif)
      .sort((a, b) => masGoles(b) - masGoles(a)) // estable: conserva lo reciente primero
      .find((f) => !usados.has(f.partido.id))
    if (cand) {
      usados.add(cand.partido.id)
      fGoleada = { tipo: 'mayorGoleada', equipo: ganadorDe(cand) as LadoH2H, partido: cand.partido }
    }
  }

  const porPrioridad = [fRacha, fUltimo, fUltLocal, fUltVis, fGoleada].filter((x): x is FichaH2H => !!x)
  const elegidas = new Set(porPrioridad.slice(0, maxFichas))
  // Orden de lectura (el de la maqueta): racha, últimas victorias, goleada, último duelo.
  const fichas = [fRacha, fUltLocal, fUltVis, fGoleada, fUltimo].filter((x): x is FichaH2H => !!x && elegidas.has(x))

  return {
    n,
    victoriasLocal: total.g,
    empates: total.e,
    victoriasVisitante: total.p,
    golesLocal,
    golesVisitante,
    golesPorPartido: n ? (golesLocal + golesVisitante) / n : 0,
    ambosMarcan,
    enCasa,
    fuera,
    racha,
    fichas,
    filas,
    mostrar: {
      balance: n >= 2,
      barra: n >= 3,
      goles: n >= 3,
      segunDonde: n >= 3 && enCasa.n >= 1 && fuera.n >= 1,
      barraCasa: enCasa.n >= 2,
      barraFuera: fuera.n >= 2,
      datos: n >= 2 && fichas.some((f) => f.tipo !== 'ultimoDuelo'),
    },
  }
}

// ── Formato (compartido para que web y app digan lo mismo) ──────────────────

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** «8 feb 26» */
export function fechaCortaH2H(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`
}

/** «8 feb 2026» */
export function fechaLargaH2H(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

const PAISES = /^(spanish|english|italian|german|french|portuguese|dutch|scottish|turkish|belgian|argentine|argentinian|brazilian|mexican|japanese|saudi|us)\s+/i
// Claves ya normalizadas (minúsculas, sin tildes) y SIN el país delante: ESPN
// manda «2025-26 English Premier League», «2021-22 German DFB Pokal», «2024-25
// Coppa Italia», «2008/09 UEFA Cup»; la temporada y el país se quitan antes.
// Las de país van también enteras por si llegan sin temporada.
const CORTAS: Record<string, string> = {
  laliga: 'LaLiga',
  'laliga ea sports': 'LaLiga',
  'laliga hypermotion': 'LaLiga 2',
  'premier league': 'Premier',
  'english premier league': 'Premier',
  'league championship': 'Championship',
  'english league championship': 'Championship',
  bundesliga: 'Bundesliga',
  'german bundesliga': 'Bundesliga',
  'serie a': 'Serie A',
  'italian serie a': 'Serie A',
  'ligue 1': 'Ligue 1',
  'french ligue 1': 'Ligue 1',
  'coupe de france': 'Copa de Francia',
  'french coupe de france': 'Copa de Francia',
  'fa cup': 'FA Cup',
  'english fa cup': 'FA Cup',
  'carabao cup': 'Copa de la Liga',
  'english carabao cup': 'Copa de la Liga',
  'efl cup': 'Copa de la Liga',
  'english efl cup': 'Copa de la Liga',
  'league cup': 'Copa de la Liga',
  'english league cup': 'Copa de la Liga',
  'dfb pokal': 'Copa de Alemania',
  'dfb-pokal': 'Copa de Alemania',
  'german dfb pokal': 'Copa de Alemania',
  'coppa italia': 'Copa de Italia',
  'italian coppa italia': 'Copa de Italia',
  'copa del rey': 'Copa del Rey',
  'spanish copa del rey': 'Copa del Rey',
  'uefa champions league': 'Champions',
  'uefa europa league': 'Europa League',
  'uefa europa conference league': 'Conference',
  'uefa conference league': 'Conference',
  'uefa cup': 'Copa de la UEFA',
  'uefa super cup': 'Supercopa UEFA',
  'supercopa de espana': 'Supercopa',
  'super cup': 'Supercopa',
  'club friendly': 'Amistoso',
  'club friendlies': 'Amistoso',
  'international friendly': 'Amistoso',
  // Baloncesto: la serie de la temporada de ESPN se llama así, no «NBA».
  nba: 'NBA',
  'nba cup': 'Copa NBA',
  'emirates nba cup': 'Copa NBA',
  'regular season': 'Temporada regular',
  'regular season series': 'Temporada regular',
  playoffs: 'Playoffs',
  'playoff series': 'Playoffs',
  'postseason series': 'Playoffs',
  preseason: 'Pretemporada',
  'preseason series': 'Pretemporada',
}

/** «2020-21 Spanish Copa del Rey» → «Copa del Rey»; «2025-26 LALIGA» → «LaLiga». */
export function competicionCortaH2H(comp: string): string {
  const sinTemporada = (comp ?? '')
    .replace(/^\s*\d{4}(?:\s*[-/]\s*\d{2,4})?\s+/, '')
    .replace(PAISES, '')
    .trim()
  return CORTAS[norm(sinTemporada)] ?? sinTemporada
}

/** Copas (eliminatorias) frente a ligas: la maqueta las marca en oro. */
export function esCopaH2H(comp: string): boolean {
  return /\b(copa|cup|coupe|pokal|coppa|ta[çc]a|supercopa|super ?cup|trophy|troph[ée]e)\b/i.test(comp ?? '')
}

/** «ATH 4-2 LEV» (el que jugó en casa, primero). */
export function marcadorH2H(m: PartidoH2H): string {
  const h = m.homeAbbr || m.home
  const a = m.awayAbbr || m.away
  return `${h} ${m.homeScore ?? '-'}-${m.awayScore ?? '-'} ${a}`
}

/** 2.8 → «2,8» */
export function decimalH2H(x: number): string {
  return (Math.round(x * 10) / 10).toFixed(1).replace('.', ',')
}
