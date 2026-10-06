// Previas y crónicas de las veladas de UFC (06/10/2026).
//
// La UFC es el deporte de noticias que mejor funciona en Google (92 apariciones y 2,3
// clics por nota, frente a 52 y 0,6 del fútbol): en español hay poca competencia. El
// editor quiere más, «pero que siga siendo de cosas importantes»:
//   · todos los UFC numerados (UFC 332…);
//   · las Fight Night, solo si el combate estelar o el coestelar tiene título en juego
//     o un luchador de un país hispanohablante;
//   · nunca Contender Series, Road to UFC ni The Ultimate Fighter.
// Los datos salen del scoreboard de ESPN (cartelera, récords, países, pesos, títulos,
// sede y, al acabar, ganador, asalto y tiempo) y el método de cada combate del API
// «core» de ESPN. Puro salvo `fetchVeladas` y `fetchMetodo`: se prueba con fixtures.

type J = any // eslint-disable-line @typescript-eslint/no-explicit-any

const SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard'
const CORE = 'https://sports.core.api.espn.com/v2/sports/mma/leagues/ufc/events'

const PAISES_HISPANOS = new Set([
  'spain', 'mexico', 'argentina', 'colombia', 'chile', 'peru', 'venezuela', 'ecuador', 'uruguay', 'paraguay',
  'bolivia', 'costa rica', 'panama', 'guatemala', 'honduras', 'el salvador', 'nicaragua', 'dominican republic', 'cuba', 'puerto rico',
])
const PAISES_ES: Record<string, string> = {
  'united states': 'EE. UU.', usa: 'EE. UU.', brazil: 'Brasil', mexico: 'México', spain: 'España', england: 'Inglaterra',
  'united kingdom': 'Reino Unido', russia: 'Rusia', georgia: 'Georgia', china: 'China', japan: 'Japón', france: 'Francia',
  poland: 'Polonia', 'new zealand': 'Nueva Zelanda', australia: 'Australia', canada: 'Canadá', peru: 'Perú',
  kazakhstan: 'Kazajistán', kyrgyzstan: 'Kirguistán', uzbekistan: 'Uzbekistán', tajikistan: 'Tayikistán', dagestan: 'Daguestán',
  ireland: 'Irlanda', germany: 'Alemania', netherlands: 'Países Bajos', italy: 'Italia', sweden: 'Suecia', nigeria: 'Nigeria',
  cameroon: 'Camerún', 'south africa': 'Sudáfrica', 'south korea': 'Corea del Sur', thailand: 'Tailandia', armenia: 'Armenia',
  azerbaijan: 'Azerbaiyán', croatia: 'Croacia', serbia: 'Serbia', ukraine: 'Ucrania', 'dominican republic': 'República Dominicana',
  panama: 'Panamá', 'bosnia and herzegovina': 'Bosnia y Herzegovina', moldova: 'Moldavia', iran: 'Irán', turkey: 'Turquía',
}
const PESOS: Array<[RegExp, string]> = [
  [/strawweight/i, 'paja'], [/flyweight/i, 'mosca'], [/bantamweight/i, 'gallo'], [/featherweight/i, 'pluma'],
  [/light heavyweight/i, 'semipesado'], [/lightweight/i, 'ligero'], [/welterweight/i, 'wélter'], [/middleweight/i, 'medio'],
  [/heavyweight/i, 'pesado'], [/catchweight/i, 'pactado'],
]

export interface Luchador {
  nombre: string
  record: string | null
  pais: string | null
  hispano: boolean
  campeon: boolean
  ganador: boolean | null
  /** Tarjetas de los jueces de este luchador, si fue a decisión. */
  tarjetas: number[]
}
export interface Combate {
  id: string
  peso: string
  asaltos: number
  tituloEnJuego: boolean
  a: Luchador
  b: Luchador
  terminado: boolean
  asalto: number | null
  tiempo: string | null
  metodo?: string | null
}
export interface Velada {
  id: string
  nombre: string
  numerado: boolean
  iso: string
  estadio: string | null
  ciudad: string | null
  tv: string[]
  terminada: boolean
  /** Del combate estelar hacia abajo (la cartelera estelar: los 5 últimos de ESPN). */
  estelar: Combate[]
}

const minusc = (s: unknown) => String(s ?? '').trim().toLowerCase()

export function pesoEs(tipo: string): string {
  const fem = /^w\s|women/i.test(tipo)
  const p = PESOS.find(([re]) => re.test(tipo))?.[1] ?? tipo
  return `peso ${p}${fem ? ' femenino' : ''}`
}

function luchador(c: J): Luchador {
  const pais = String(c?.athlete?.flag?.alt ?? '')
  const lin = c?.linescores?.[0]?.linescores ?? []
  return {
    nombre: String(c?.athlete?.displayName ?? '?'),
    record: c?.records?.[0]?.summary ?? null,
    pais: pais ? (PAISES_ES[minusc(pais)] ?? pais) : null,
    hispano: PAISES_HISPANOS.has(minusc(pais)),
    campeon: (c?.athlete?.accolades ?? []).some((a: J) => /belt|title/i.test(`${a?.type} ${a?.name}`)),
    ganador: typeof c?.winner === 'boolean' ? c.winner : null,
    tarjetas: lin.map((x: J) => Number(x?.value)).filter((x: number) => Number.isFinite(x)),
  }
}

/** Del evento del scoreboard a la velada, con la cartelera estelar en orden. Puro. */
export function veladaDesdeEvento(e: J): Velada | null {
  const comps: J[] = e?.competitions ?? []
  if (!comps.length) return null
  // ESPN las da de la primera de la noche al combate estelar: el estelar es el último.
  const estelar = comps.slice(-5).reverse().map((c: J): Combate | null => {
    const cs = c?.competitors ?? []
    if (cs.length !== 2) return null
    const asaltos = Number(c?.format?.regulation?.periods) || 3
    const a = luchador(cs[0]), b = luchador(cs[1])
    const terminado = c?.status?.type?.completed === true
    return {
      id: String(c?.id ?? ''),
      peso: pesoEs(String(c?.type?.abbreviation ?? c?.type?.text ?? '')),
      asaltos,
      tituloEnJuego: asaltos === 5 && (a.campeon || b.campeon),
      a, b, terminado,
      asalto: terminado ? Number(c?.status?.period) || null : null,
      tiempo: terminado ? (c?.status?.displayClock ?? null) : null,
    }
  }).filter((x): x is Combate => !!x)
  if (!estelar.length) return null
  const venue = comps[comps.length - 1]?.venue ?? e?.venues?.[0]
  const nombre = String(e?.name ?? '')
  return {
    id: String(e?.id ?? ''),
    nombre,
    numerado: /^UFC \d+/i.test(nombre),
    iso: String(comps[comps.length - 1]?.date ?? e?.date ?? ''),
    estadio: venue?.fullName ?? null,
    ciudad: [venue?.address?.city, venue?.address?.country].filter(Boolean).join(', ') || null,
    tv: [...new Set<string>(comps.flatMap((c: J) => (c?.broadcasts ?? []).flatMap((b: J) => b?.names ?? [])))],
    terminada: estelar.every((c) => c.terminado),
    estelar,
  }
}

/** ¿Merece previa y crónica? Ver la cabecera. */
export function esVeladaImportante(v: Velada): { si: boolean; motivo: string } {
  if (/contender series|road to ufc|ultimate fighter|\btuf\b/i.test(v.nombre)) return { si: false, motivo: 'formato menor' }
  if (v.numerado) return { si: true, motivo: 'UFC numerado' }
  const top = v.estelar.slice(0, 2)
  if (top.some((c) => c.tituloEnJuego)) return { si: true, motivo: 'título en juego' }
  const h = top.flatMap((c) => [c.a, c.b]).find((l) => l.hispano)
  if (h) return { si: true, motivo: `luchador hispano en el estelar (${h.nombre})` }
  return { si: false, motivo: 'Fight Night sin título ni hispanos arriba' }
}

const fmt = (iso: string, tz: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-ES', { timeZone: tz, ...o }).format(new Date(iso))
const hora = (iso: string, tz: string) => fmt(iso, tz, { hour: '2-digit', minute: '2-digit', hour12: false })
const fecha = (iso: string) => fmt(iso, 'Europe/Madrid', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

const ficha = (l: Luchador) => `${l.nombre} (${[l.record, l.pais, l.campeon ? 'campeón/a vigente' : null].filter(Boolean).join(', ')})`
const ETIQUETAS = ['COMBATE ESTELAR', 'COESTELAR', 'CARTELERA ESTELAR', 'CARTELERA ESTELAR', 'CARTELERA ESTELAR']

export function metodoEs(m: string | null | undefined): string | null {
  const s = minusc(m)
  if (!s) return null
  if (/unanimous/.test(s)) return 'decisión unánime'
  if (/split/.test(s)) return 'decisión dividida'
  if (/majority/.test(s)) return 'decisión mayoritaria'
  if (/decision/.test(s)) return 'decisión'
  if (/submission/.test(s)) return 'sumisión'
  if (/tko|ko|knockout|kotko/.test(s)) return 'KO/TKO'
  if (/draw/.test(s)) return 'empate'
  if (/no contest/.test(s)) return 'sin resultado (no contest)'
  if (/disqual/.test(s)) return 'descalificación'
  return null
}

/** Dossier de la velada para el redactor (WF-08): solo datos verificados. */
export function construirDossierVelada(v: Velada, tipo: 'previa' | 'cronica'): { datos: Record<string, unknown>; texto: string } {
  const main = v.estelar[0]
  const L: string[] = []
  L.push(`VELADA: ${v.nombre} (${v.numerado ? 'evento numerado de la UFC' : 'UFC Fight Night'}).`)
  if (tipo === 'previa') {
    L.push(`FECHA Y HORA DE LA CARTELERA ESTELAR: ${fecha(v.iso)}, a las ${hora(v.iso, 'Europe/Madrid')} hora peninsular española ` +
      `(${hora(v.iso, 'America/Mexico_City')} en Ciudad de México, ${hora(v.iso, 'America/Bogota')} en Bogotá y Lima, ` +
      `${hora(v.iso, 'America/Argentina/Buenos_Aires')} en Buenos Aires).`)
  } else {
    L.push(`FECHA: ${fecha(v.iso)}.`)
  }
  if (v.estadio) L.push(`SEDE: ${v.estadio}${v.ciudad ? ` (${v.ciudad})` : ''}.`)
  L.push(v.tv.length ? `EMISIÓN EN EE. UU.: ${v.tv.join(', ')}. Televisión en España y Latinoamérica: no consta.` : 'TELEVISIÓN: no consta.')
  L.push('')
  L.push(tipo === 'previa' ? 'CARTELERA ESTELAR (del combate estelar hacia abajo):' : 'RESULTADOS DE LA CARTELERA ESTELAR (del combate estelar hacia abajo):')
  v.estelar.forEach((c, i) => {
    const cab = `${i + 1}. ${ETIQUETAS[i]} — ${c.peso}${c.tituloEnJuego ? ', CON TÍTULO EN JUEGO' : ''}, a ${c.asaltos} asaltos`
    if (tipo === 'previa' || !c.terminado) { L.push(`${cab}: ${ficha(c.a)} contra ${ficha(c.b)}.`); return }
    const [g, p] = c.a.ganador ? [c.a, c.b] : c.b.ganador ? [c.b, c.a] : [null, null]
    const metodo = c.metodo ? ` por ${c.metodo}` : ''
    const decision = /decisión/.test(c.metodo ?? '') && g && g.tarjetas.length && p && p.tarjetas.length === g.tarjetas.length
      ? ` (tarjetas: ${g.tarjetas.map((x, k) => `${x}-${p.tarjetas[k]}`).join(', ')})` : ''
    const cuando = c.asalto && !/decisión/.test(c.metodo ?? '') ? ` en el asalto ${c.asalto}${c.tiempo ? ` (${c.tiempo})` : ''}` : ''
    L.push(g && p
      ? `${cab}: GANÓ ${ficha(g)} a ${ficha(p)}${metodo}${cuando}${decision}.`
      : `${cab}: ${ficha(c.a)} contra ${ficha(c.b)}: sin ganador (${c.metodo ?? 'resultado no consta'}).`)
  })
  L.push('')
  L.push('Los récords son los que tenía cada luchador según ESPN en el momento de la consulta. Los nombres de pesos y países ya están en español.')
  const datos = {
    matchRef: `mma_ufc_${v.id}`, sport: 'ufc', home: main.a.nombre, away: main.b.nombre, competicion: 'UFC',
    kickoffIso: v.iso, estadio: v.estadio, ciudad: v.ciudad, evento: v.nombre,
    combates: v.estelar.map((c) => ({ peso: c.peso, a: c.a.nombre, b: c.b.nombre, titulo: c.tituloEnJuego, metodo: c.metodo ?? null })),
  }
  return { datos, texto: L.join('\n') }
}

/** Veladas de ESPN de estos días (AAAAMMDD), una petición por día: el rango de fechas
 *  de ESPN dejó de funcionar en fútbol y NBA el 15/09/2026 y no se usa en ningún sitio
 *  (ver espn-meses.test.ts). Sin repetir la misma velada. */
export async function fetchVeladas(dias: string[]): Promise<Velada[]> {
  const out = new Map<string, Velada>()
  await Promise.all(dias.map(async (dia) => {
    try {
      const r = await fetch(`${SCOREBOARD}?dates=${dia}`, { signal: AbortSignal.timeout(12000), cache: 'no-store' })
      if (!r.ok) return
      const d = await r.json()
      for (const e of d?.events ?? []) { const v = veladaDesdeEvento(e); if (v) out.set(v.id, v) }
    } catch { /* un día que falla no tumba los demás */ }
  }))
  return [...out.values()]
}

/** Método de un combate terminado (decisión, KO/TKO, sumisión), del API «core» de ESPN. */
export async function fetchMetodo(eventoId: string, combateId: string): Promise<string | null> {
  try {
    const r = await fetch(`${CORE}/${eventoId}/competitions/${combateId}/status`, { signal: AbortSignal.timeout(8000), cache: 'no-store' })
    if (!r.ok) return null
    const d = await r.json()
    return metodoEs(d?.result?.displayName ?? d?.result?.name)
  } catch {
    return null
  }
}
