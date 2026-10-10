// Previas y crónicas de tenis (10/10/2026).
//
// El editor pidió «tenis grande»: los partidos de Alcaraz, las finales y lo que de
// verdad se busca. Qué entra:
//   · todos los partidos de Alcaraz en cuadro final (cualquier torneo);
//   · finales de Grand Slam, Masters 1000, WTA 1000 y Finals; semifinales de Grand Slam;
//   · un tenista de un país hispanohablante en una final de cualquier torneo, o en
//     cuartos o más de un Grand Slam, Masters 1000, WTA 1000 o Finals.
// Solo individuales y nunca la previa (qualifying).
//
// Los datos salen del scoreboard de ESPN, que devuelve el TORNEO entero (todas las
// rondas, con pista, hora prevista, cabezas de serie, país y marcador por sets con
// tie-breaks), y del ranking ATP/WTA de ESPN. No hay cara a cara ni estadísticas del
// partido: el redactor lo sabe. Puro salvo `fetchPartidosTenis`: se prueba con fixtures.

type J = any // eslint-disable-line @typescript-eslint/no-explicit-any

const SCOREBOARD = (gira: Gira) => `https://site.api.espn.com/apis/site/v2/sports/tennis/${gira}/scoreboard`
const RANKING = (gira: Gira) => `https://site.api.espn.com/apis/site/v2/sports/tennis/${gira}/rankings`

export type Gira = 'atp' | 'wta'
export type Categoria = 'slam' | 'masters' | '1000' | 'finals' | 'otro'

const PAISES_HISPANOS = new Set([
  'spain', 'mexico', 'argentina', 'colombia', 'chile', 'peru', 'venezuela', 'ecuador', 'uruguay', 'paraguay',
  'bolivia', 'costa rica', 'panama', 'guatemala', 'honduras', 'el salvador', 'nicaragua', 'dominican republic', 'cuba', 'puerto rico',
])
const PAISES_ES: Record<string, string> = {
  spain: 'España', argentina: 'Argentina', mexico: 'México', colombia: 'Colombia', chile: 'Chile', peru: 'Perú', uruguay: 'Uruguay',
  paraguay: 'Paraguay', bolivia: 'Bolivia', ecuador: 'Ecuador', venezuela: 'Venezuela', 'dominican republic': 'República Dominicana',
  'united states': 'EE. UU.', usa: 'EE. UU.', 'great britain': 'Gran Bretaña', 'united kingdom': 'Reino Unido', italy: 'Italia',
  germany: 'Alemania', france: 'Francia', russia: 'Rusia', serbia: 'Serbia', australia: 'Australia', canada: 'Canadá',
  czechia: 'República Checa', 'czech republic': 'República Checa', poland: 'Polonia', kazakhstan: 'Kazajistán', greece: 'Grecia',
  norway: 'Noruega', denmark: 'Dinamarca', sweden: 'Suecia', finland: 'Finlandia', netherlands: 'Países Bajos', belgium: 'Bélgica',
  switzerland: 'Suiza', austria: 'Austria', portugal: 'Portugal', croatia: 'Croacia', hungary: 'Hungría', bulgaria: 'Bulgaria',
  romania: 'Rumanía', slovakia: 'Eslovaquia', slovenia: 'Eslovenia', ukraine: 'Ucrania', belarus: 'Bielorrusia', latvia: 'Letonia',
  georgia: 'Georgia', japan: 'Japón', china: 'China', 'chinese taipei': 'Taiwán', 'hong kong': 'Hong Kong', 'south korea': 'Corea del Sur',
  brazil: 'Brasil', tunisia: 'Túnez', egypt: 'Egipto', 'south africa': 'Sudáfrica', 'new zealand': 'Nueva Zelanda', india: 'India',
  türkiye: 'Turquía', turkey: 'Turquía', monaco: 'Mónaco', estonia: 'Estonia', lithuania: 'Lituania', bosnia: 'Bosnia',
}
const CIUDADES_ES: Record<string, string> = {
  shanghai: 'Shanghái', beijing: 'Pekín', paris: 'París', turin: 'Turín', london: 'Londres', 'new york': 'Nueva York', rome: 'Roma',
  'monte carlo': 'Montecarlo', 'monte-carlo': 'Montecarlo', wuhan: 'Wuhan', riyadh: 'Riad', dubai: 'Dubái', doha: 'Doha',
  melbourne: 'Melbourne', madrid: 'Madrid', 'indian wells': 'Indian Wells', miami: 'Miami', montreal: 'Montreal', toronto: 'Toronto',
  cincinnati: 'Cincinnati', 'mason': 'Cincinnati', tokyo: 'Tokio', vienna: 'Viena', basel: 'Basilea', stockholm: 'Estocolmo',
}

// Torneos grandes por su nombre en ESPN. Cada uno: [regex, ciudad en español, superficie].
const SLAMS: Array<[RegExp, string, string]> = [
  [/australian open/i, 'Open de Australia', 'pista dura'], [/roland garros|french open/i, 'Roland Garros', 'tierra batida'],
  [/wimbledon/i, 'Wimbledon', 'hierba'], [/us open/i, 'US Open', 'pista dura'],
]
const MASTERS: Array<[RegExp, string, string]> = [
  [/indian wells|bnp paribas open/i, 'Indian Wells', 'pista dura'], [/miami/i, 'Miami', 'pista dura'],
  [/monte[- ]?carlo/i, 'Montecarlo', 'tierra batida'], [/madrid/i, 'Madrid', 'tierra batida'],
  [/internazionali|italian open|\brome\b|\broma\b/i, 'Roma', 'tierra batida'], [/canad|national bank|toronto|montreal/i, 'Canadá', 'pista dura'],
  [/cincinnati|western & southern/i, 'Cincinnati', 'pista dura'], [/shanghai/i, 'Shanghái', 'pista dura'],
  [/paris masters|rolex paris|bnp paribas masters/i, 'París', 'pista dura bajo techo'],
]
const WTA_1000: Array<[RegExp, string, string]> = [
  ...MASTERS.filter(([, c]) => !['Montecarlo', 'Shanghái', 'París'].includes(c)),
  [/qatar|doha/i, 'Doha', 'pista dura'], [/dubai/i, 'Dubái', 'pista dura'], [/china open|beijing/i, 'Pekín', 'pista dura'],
  [/wuhan/i, 'Wuhan', 'pista dura'],
]

export interface Torneo {
  categoria: Categoria
  /** Nombre corto para titulares y SEO («Masters de Shanghái», «Roland Garros»). */
  corto: string
  /** Nombre completo para el texto («Masters 1000 de Shanghái»). */
  largo: string
  superficie: string | null
}

/** Categoría y nombre en español de un torneo, según el cuadro (el Open de China es ATP 500 y WTA 1000). */
export function torneoEs(nombre: string, major: boolean, gira: Gira): Torneo {
  const slam = SLAMS.find(([re]) => re.test(nombre))
  if (major || slam) return { categoria: 'slam', corto: slam?.[1] ?? nombre, largo: slam?.[1] ?? nombre, superficie: slam?.[2] ?? null }
  if (gira === 'atp' && /atp finals|nitto/i.test(nombre)) return { categoria: 'finals', corto: 'ATP Finals', largo: 'ATP Finals de Turín', superficie: 'pista dura bajo techo' }
  if (gira === 'wta' && /wta finals/i.test(nombre)) return { categoria: 'finals', corto: 'WTA Finals', largo: 'WTA Finals', superficie: 'pista dura bajo techo' }
  const m = (gira === 'atp' ? MASTERS : WTA_1000).find(([re]) => re.test(nombre))
  if (m) {
    return gira === 'atp'
      ? { categoria: 'masters', corto: `Masters de ${m[1]}`, largo: `Masters 1000 de ${m[1]}`, superficie: m[2] }
      : { categoria: '1000', corto: `WTA 1000 de ${m[1]}`, largo: `WTA 1000 de ${m[1]}`, superficie: m[2] }
  }
  return { categoria: 'otro', corto: nombre, largo: nombre, superficie: null }
}

export interface Tenista {
  id: string
  nombre: string
  pais: string | null
  hispano: boolean
  cabeza: number | null
  ranking: number | null
  puntos: number | null
  ganador: boolean | null
  sets: Array<{ juegos: number; tb: number | null }>
}
export interface PartidoTenis {
  id: string
  gira: Gira
  torneoId: string
  torneoNombre: string
  torneo: Torneo
  cuadro: 'masculino' | 'femenino'
  /** Ronda en español («segunda ronda», «cuartos de final», «final»). */
  ronda: string
  /** 7 final, 6 semifinales, 5 cuartos, 4 octavos… (para ordenar y decidir). */
  rondaOrden: number
  iso: string
  /** false = ESPN aún no tiene el orden de juego: solo se sabe el día. */
  horaFija: boolean
  pista: string | null
  sede: string | null
  estado: 'pre' | 'in' | 'post'
  retirada: boolean
  walkover: boolean
  a: Tenista
  b: Tenista
}

const minusc = (s: unknown) => String(s ?? '').trim().toLowerCase()
const ORDINALES = ['primera', 'segunda', 'tercera', 'cuarta', 'quinta']

function rondaEs(nombre: string, partidosEnRonda: number): { ronda: string; orden: number } {
  if (/^final$/i.test(nombre)) return { ronda: 'final', orden: 7 }
  if (/^semifinal/i.test(nombre)) return { ronda: 'semifinales', orden: 6 }
  if (/^quarterfinal/i.test(nombre)) return { ronda: 'cuartos de final', orden: 5 }
  if (/round robin/i.test(nombre)) return { ronda: 'fase de grupos', orden: 3 }
  if (partidosEnRonda === 8) return { ronda: 'octavos de final', orden: 4 }
  const n = Number(/round (\d+)/i.exec(nombre)?.[1])
  return Number.isFinite(n) && n >= 1 ? { ronda: `${ORDINALES[n - 1] ?? `${n}.ª`} ronda`, orden: Math.min(3, n) } : { ronda: nombre, orden: 0 }
}

function tenista(c: J, ranking: Map<string, { pos: number; puntos: number }>): Tenista {
  const pais = String(c?.athlete?.flag?.alt ?? '')
  const id = String(c?.id ?? '')
  const rk = ranking.get(id)
  return {
    id,
    nombre: String(c?.athlete?.displayName ?? 'TBD'),
    pais: pais ? (PAISES_ES[minusc(pais)] ?? pais) : null,
    hispano: PAISES_HISPANOS.has(minusc(pais)),
    cabeza: Number(c?.curatedRank?.current) || null,
    ranking: rk?.pos ?? null,
    puntos: rk?.puntos ?? null,
    ganador: typeof c?.winner === 'boolean' ? c.winner : null,
    sets: (c?.linescores ?? []).map((l: J) => ({ juegos: Number(l?.value) || 0, tb: Number.isFinite(Number(l?.tiebreak)) ? Number(l.tiebreak) : null })),
  }
}

// Primero el que se busca: «Alcaraz vs Cerúndolo», no al revés. Alcaraz, luego un
// hispano y luego el mejor clasificado; si no se sabe, el orden del cuadro.
const peso = (t: Tenista) => (/\balcaraz\b/i.test(t.nombre) ? 1e6 : 0) + (t.hispano ? 1e4 : 0) + (t.ranking ? 1000 - t.ranking : 0)
function protagonistaPrimero(x: Tenista, y: Tenista): [Tenista, Tenista] {
  return peso(y) > peso(x) ? [y, x] : [x, y]
}

const sede = (v: string | null | undefined) => {
  const ciudad = String(v ?? '').split(',')[0].trim()
  return ciudad ? (CIUDADES_ES[minusc(ciudad)] ?? ciudad) : null
}

/** Los partidos individuales de cuadro final de un evento del scoreboard. Puro. */
export function partidosDesdeEvento(e: J, ranking: Map<string, { pos: number; puntos: number }> = new Map()): PartidoTenis[] {
  const out: PartidoTenis[] = []
  for (const g of e?.groupings ?? []) {
    const tipo = String(g?.grouping?.slug ?? g?.grouping?.displayName ?? '')
    const fem = /women/i.test(tipo)
    if (!/singles/i.test(tipo)) continue
    const comps: J[] = g?.competitions ?? []
    const porRonda = new Map<string, number>()
    for (const c of comps) porRonda.set(String(c?.round?.displayName ?? ''), (porRonda.get(String(c?.round?.displayName ?? '')) ?? 0) + 1)
    const gira: Gira = fem ? 'wta' : 'atp'
    const torneo = torneoEs(String(e?.name ?? ''), e?.major === true, gira)
    for (const c of comps) {
      const nombreRonda = String(c?.round?.displayName ?? '')
      if (/qualif/i.test(nombreRonda)) continue
      const cs: J[] = c?.competitors ?? []
      if (cs.length !== 2) continue
      // ESPN pone primero al «visitante»: se ordena por `order` para respetar el cuadro.
      const [x, y] = [...cs].sort((p, q) => (Number(p?.order) || 0) - (Number(q?.order) || 0))
      const { ronda, orden } = rondaEs(nombreRonda, porRonda.get(nombreRonda) ?? 0)
      const st = c?.status?.type ?? {}
      const [ta, tb] = protagonistaPrimero(tenista(x, ranking), tenista(y, ranking))
      out.push({
        id: String(c?.id ?? ''),
        gira,
        torneoId: String(e?.id ?? ''),
        torneoNombre: String(e?.name ?? ''),
        torneo,
        cuadro: fem ? 'femenino' : 'masculino',
        ronda, rondaOrden: orden,
        iso: String(c?.date ?? ''),
        horaFija: c?.timeValid === true,
        pista: String(c?.venue?.court ?? '').trim() || null,
        sede: sede(c?.venue?.fullName ?? e?.venue?.displayName),
        estado: st?.state === 'post' ? 'post' : st?.state === 'in' ? 'in' : 'pre',
        retirada: /retired/i.test(String(st?.name ?? '')),
        walkover: /walkover/i.test(String(st?.name ?? '')) || /w\/o|walkover/i.test(String(c?.notes?.[0]?.text ?? '')),
        a: ta,
        b: tb,
      })
    }
  }
  return out
}

const conocido = (t: Tenista) => !!t.nombre && t.nombre !== 'TBD' && !t.id.startsWith('-')
const ALCARAZ = /\balcaraz\b/i

/** ¿Merece previa y crónica? Ver la cabecera. `prioridad` ordena cuando hay tope. */
export function esPartidoImportante(p: PartidoTenis): { si: boolean; motivo: string; prioridad: number } {
  const no = (motivo: string) => ({ si: false, motivo, prioridad: 0 })
  if (!conocido(p.a) || !conocido(p.b)) return no('rivales por decidir')
  if (p.walkover) return no('walkover')
  const grande = p.torneo.categoria !== 'otro'
  const alc = [p.a, p.b].find((t) => ALCARAZ.test(t.nombre))
  if (alc) return { si: true, motivo: 'partido de Alcaraz', prioridad: 20 }
  if (p.rondaOrden === 7 && grande) return { si: true, motivo: `final de ${p.torneo.largo}`, prioridad: 18 }
  if (p.rondaOrden === 6 && p.torneo.categoria === 'slam') return { si: true, motivo: 'semifinal de Grand Slam', prioridad: 16 }
  const h = [p.a, p.b].find((t) => t.hispano)
  if (h && p.rondaOrden === 7) return { si: true, motivo: `final con ${h.nombre}`, prioridad: 15 }
  if (h && grande && p.rondaOrden >= 5) return { si: true, motivo: `${h.nombre} en ${p.ronda}`, prioridad: 14 }
  return no('partido sin Alcaraz, final ni hispanos en rondas altas')
}

// ── Dossier ──────────────────────────────────────────────────────────────────
const fmt = (iso: string, tz: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-ES', { timeZone: tz, ...o }).format(new Date(iso))
const hora = (iso: string, tz: string) => fmt(iso, tz, { hour: '2-digit', minute: '2-digit', hour12: false })
const fecha = (iso: string) => fmt(iso, 'Europe/Madrid', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const miles = (n: number) => n.toLocaleString('es-ES')

/** «6-4, 7-6 (7-4)» desde el punto de vista de `g` (el ganador). */
export function marcador(g: Tenista, p: Tenista): string {
  return g.sets.map((s, i) => {
    const o = p.sets[i]
    if (!o) return `${s.juegos}`
    const tb = s.tb != null && o.tb != null ? ` (${s.tb}-${o.tb})` : ''
    return `${s.juegos}-${o.juegos}${tb}`
  }).join(', ')
}

const fichaTenista = (t: Tenista, gira: Gira) => {
  const det = [
    t.pais,
    t.ranking ? `número ${t.ranking} del ranking ${gira.toUpperCase()}${t.puntos ? ` con ${miles(t.puntos)} puntos` : ''}` : null,
    t.cabeza ? `cabeza de serie n.º ${t.cabeza} del torneo` : 'sin ser cabeza de serie',
  ].filter(Boolean)
  return `${t.nombre} (${det.join('; ')})`
}

/** Lo que ha hecho cada tenista en este torneo antes de este partido. */
function camino(t: Tenista, p: PartidoTenis, todos: PartidoTenis[]): string {
  const previos = todos
    .filter((x) => x.torneoId === p.torneoId && x.cuadro === p.cuadro && x.estado === 'post' && x.rondaOrden < p.rondaOrden && [x.a.id, x.b.id].includes(t.id))
    .sort((x, y) => x.rondaOrden - y.rondaOrden || x.iso.localeCompare(y.iso))
  if (!previos.length) return p.rondaOrden <= 1
    ?`${t.nombre}: es su primer partido en el torneo.`
    : `${t.nombre}: debuta en el torneo en esta ronda (no jugó la anterior${t.cabeza ? ', como suele pasar a los cabezas de serie, que entran exentos' : ''}).`
  return `${t.nombre}: ` + previos.map((x) => {
    const yo = x.a.id === t.id ? x.a : x.b
    const rival = x.a.id === t.id ? x.b : x.a
    if (x.walkover) return `${x.ronda}: pasó sin jugar ante ${rival.nombre} (walkover)`
    return yo.ganador
      ? `${x.ronda}: venció a ${rival.nombre} por ${marcador(yo, rival)}${x.retirada ? ' (retirada del rival)' : ''}`
      : `${x.ronda}: perdió con ${rival.nombre}`
  }).join('; ') + '. De esos partidos solo consta el marcador.'
}

/** Siguiente partido del ganador, si el cuadro ya lo tiene. */
function siguiente(g: Tenista, p: PartidoTenis, todos: PartidoTenis[]): string | null {
  if (p.rondaOrden === 7) return null
  const sig = todos.find((x) => x.torneoId === p.torneoId && x.cuadro === p.cuadro && x.rondaOrden > p.rondaOrden && [x.a.id, x.b.id].includes(g.id))
  if (!sig) return null
  const rival = sig.a.id === g.id ? sig.b : sig.a
  return conocido(rival) ? `En ${sig.ronda} se medirá a ${fichaTenista(rival, p.gira)}.` : `Jugará ${sig.ronda}; su rival aún no está decidido.`
}

/** Dossier del partido para el redactor (WF-08): solo datos verificados. */
export function construirDossierTenis(p: PartidoTenis, tipo: 'previa' | 'cronica', todos: PartidoTenis[] = []): { datos: Record<string, unknown>; texto: string } {
  const L: string[] = []
  const t = p.torneo
  L.push(`TORNEO: ${t.largo}${t.categoria === 'slam' ? ' (Grand Slam)' : ''}, cuadro individual ${p.cuadro}${t.superficie ? `, en ${t.superficie}` : ''}${p.sede ? `. Sede: ${p.sede}` : ''}.`)
  L.push(`RONDA: ${p.ronda}.`)
  if (tipo === 'previa') {
    L.push(p.horaFija
      ? `FECHA Y HORA PREVISTA: ${fecha(p.iso)}, hacia las ${hora(p.iso, 'Europe/Madrid')} hora peninsular española ` +
        `(${hora(p.iso, 'America/Mexico_City')} en Ciudad de México, ${hora(p.iso, 'America/Bogota')} en Bogotá y Lima, ` +
        `${hora(p.iso, 'America/Argentina/Buenos_Aires')} en Buenos Aires)${p.pista ? `, en la pista ${p.pista}` : ''}. ` +
        'En el tenis la hora es orientativa: depende de cuánto duren los partidos anteriores en esa pista.'
      : `FECHA: ${fecha(p.iso)}. Hora: por confirmar (el orden de juego aún no está publicado).`)
    L.push('TELEVISIÓN: no consta.')
    L.push('')
    L.push(`JUGADORES: ${fichaTenista(p.a, p.gira)} contra ${fichaTenista(p.b, p.gira)}.`)
    L.push('')
    L.push('CAMINO EN ESTE TORNEO:')
    L.push(`- ${camino(p.a, p, todos)}`)
    L.push(`- ${camino(p.b, p, todos)}`)
    L.push('')
    L.push(p.rondaOrden === 7 ? `QUÉ SE JUEGA: el título del ${t.largo}.` : `QUÉ SE JUEGA: el pase a la siguiente ronda del ${t.largo}.`)
  } else {
    L.push(`FECHA: ${fecha(p.iso)}${p.pista ? `, en la pista ${p.pista}` : ''}.`)
    const [g, per] = p.a.ganador ? [p.a, p.b] : p.b.ganador ? [p.b, p.a] : [null, null]
    L.push('')
    if (g && per) {
      L.push(`RESULTADO: GANÓ ${fichaTenista(g, p.gira)} a ${fichaTenista(per, p.gira)} por ${marcador(g, per)}${p.retirada ? `, por RETIRADA de ${per.nombre} con el partido en ese marcador` : ''}.`)
      L.push(`SETS JUGADOS: ${g.sets.length}.`)
      L.push(p.rondaOrden === 7 ? `${g.nombre} es el CAMPEÓN del ${t.largo}${p.cuadro === 'femenino' ? ' (campeona)' : ''}.` : (siguiente(g, p, todos) ?? 'SIGUIENTE RONDA: no consta todavía.'))
    } else {
      L.push(`RESULTADO: ${p.a.nombre} contra ${p.b.nombre}: no consta el ganador.`)
    }
    L.push('')
    L.push('CAMINO EN ESTE TORNEO HASTA ESTE PARTIDO:')
    L.push(`- ${camino(p.a, p, todos)}`)
    L.push(`- ${camino(p.b, p, todos)}`)
  }
  L.push('')
  // «No consta el cara a cara» lo leyó la IA como «nunca se han enfrentado» (previa de
  // Alcaraz-Cerúndolo, 10/10/2026): se dice que NO TENEMOS el dato, no que no exista.
  L.push('SIN DATOS (no los tenemos, lo que NO significa que no existan; no hables de ellos): el historial de enfrentamientos entre ambos, cómo fueron sus partidos anteriores más allá del marcador, las estadísticas del partido (saques, roturas, errores) y la emisión en España y Latinoamérica.')
  L.push('Ranking y puntos: clasificación de esta semana según ESPN. La cabeza de serie es la de este torneo. Los nombres de países y rondas ya están en español.')
  const datos = {
    matchRef: refTenis(p), sport: 'tenis', home: p.a.nombre, away: p.b.nombre, competicion: t.corto,
    kickoffIso: p.iso, horaFija: p.horaFija, estadio: p.pista, ciudad: p.sede, torneo: t.largo, ronda: p.ronda, cuadro: p.cuadro,
  }
  return { datos, texto: L.join('\n') }
}

export const refTenis = (p: Pick<PartidoTenis, 'gira' | 'id'>) => `tennis_${p.gira}_${p.id}`

// ── Red ──────────────────────────────────────────────────────────────────────
async function fetchRanking(gira: Gira): Promise<Map<string, { pos: number; puntos: number }>> {
  const m = new Map<string, { pos: number; puntos: number }>()
  try {
    const r = await fetch(RANKING(gira), { signal: AbortSignal.timeout(10000), cache: 'no-store' })
    if (!r.ok) return m
    const d = await r.json()
    for (const x of d?.rankings?.[0]?.ranks ?? []) {
      const id = String(x?.athlete?.id ?? '')
      if (id) m.set(id, { pos: Number(x?.current) || 0, puntos: Number(x?.points) || 0 })
    }
  } catch { /* sin ranking, el dossier lo omite */ }
  return m
}

/** Partidos de los torneos en juego estos días (AAAAMMDD), ATP y WTA. El scoreboard
 *  de ESPN devuelve el torneo entero por día; los torneos mixtos (Open de China)
 *  salen en los dos y se quitan los repetidos. Una petición por día y gira (el rango
 *  de fechas de ESPN no se usa: ver espn-meses.test.ts). */
export async function fetchPartidosTenis(dias: string[]): Promise<PartidoTenis[]> {
  const [rkAtp, rkWta] = await Promise.all([fetchRanking('atp'), fetchRanking('wta')])
  const ranking = new Map([...rkAtp, ...rkWta])
  const out = new Map<string, PartidoTenis>()
  await Promise.all((['atp', 'wta'] as Gira[]).flatMap((gira) => dias.map(async (dia) => {
    try {
      const r = await fetch(`${SCOREBOARD(gira)}?dates=${dia}`, { signal: AbortSignal.timeout(15000), cache: 'no-store' })
      if (!r.ok) return
      const d = await r.json()
      for (const e of d?.events ?? []) for (const p of partidosDesdeEvento(e, ranking)) out.set(refTenis(p), p)
    } catch { /* un día que falla no tumba los demás */ }
  })))
  return [...out.values()]
}
