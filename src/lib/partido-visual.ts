// Piezas visuales de las notas de partido (crónicas y previas), sacadas de la ficha
// de ESPN y NO del texto de la IA: el marcador con la línea de tiempo de goles y
// rojas, las barras de estadísticas, la mini-clasificación y la racha de cada equipo.
// Así la parte con datos de la nota se pinta en vez de contarse en prosa, y además no
// puede llevar errores: el 02/10/2026 una crónica dijo «dos de penalti» con un solo
// penalti en la ficha.
//
// Todo lo de aquí es puro salvo `fetchFichaVisual`, que lleva caché de una hora y un
// tope de 4 s: un adorno no puede retener la página (lección del 06/09/2026).

import { toSpanishNation } from '@/lib/nation-names'
import { parseMatchRef } from '@/lib/previas-dossier'

type J = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const ESPN_SUMMARY = 'https://site.api.espn.com/apis/site/v2/sports'

export interface EquipoVisual { nombre: string; escudo: string | null; goles: number | null }
export interface EventoVisual {
  minuto: string
  lado: 'home' | 'away'
  tipo: 'gol' | 'penalti' | 'propia' | 'roja'
  jugador: string
  asistencia?: string
}
export interface FilaEstadistica { label: string; home: number; away: number; unit?: string }
export interface FilaClasificacion { pos: number; equipo: string; pj: number; pts: number; dif: string; destacado: boolean }
export interface FichaVisual {
  home: EquipoVisual
  away: EquipoVisual
  terminado: boolean
  eventos: EventoVisual[]
  estadisticas: FilaEstadistica[]
  clasificacion: FilaClasificacion[]
  /** Últimos resultados, del más reciente al más antiguo: 'V' | 'E' | 'D'. */
  forma: { home: string[]; away: string[] }
}

const nombreEs = (n: unknown) => { const s = String(n ?? ''); return toSpanishNation(s) || s }

const minutoNum = (m: string) => {
  const x = /^(\d+)'?(?:\+(\d+))?/.exec(m || '')
  return x ? Number(x[1]) + (x[2] ? Number(x[2]) / 100 : 0) : 999
}

// Las estadísticas que cuentan el partido, en este orden. El resto (centros, balones
// largos, despejes…) es ruido para el lector.
const STATS: Array<[string, string, string?]> = [
  ['possessionPct', 'Posesión', '%'],
  ['totalShots', 'Tiros'],
  ['shotsOnTarget', 'Tiros a puerta'],
  ['wonCorners', 'Córners'],
  ['saves', 'Paradas'],
  ['foulsCommitted', 'Faltas'],
]

/** Puro: de la ficha `summary` de ESPN a lo que pintan los componentes. */
export function fichaVisual(summary: J | null | undefined, nombres?: { home?: string; away?: string }): FichaVisual | null {
  const comp = summary?.header?.competitions?.[0]
  const cs: J[] = comp?.competitors ?? []
  const cH = cs.find((c) => c.homeAway === 'home')
  const cA = cs.find((c) => c.homeAway === 'away')
  if (!cH || !cA) return null
  const idH = String(cH.team?.id ?? '')
  const idA = String(cA.team?.id ?? '')
  const terminado = comp?.status?.type?.completed === true || comp?.status?.type?.state === 'post'
  const equipo = (c: J, propio?: string): EquipoVisual => ({
    nombre: propio || nombreEs(c.team?.displayName),
    escudo: c.team?.logos?.[0]?.href ?? c.team?.logo ?? null,
    goles: terminado && c.score != null && c.score !== '' ? Number(c.score) : null,
  })

  const eventos: EventoVisual[] = []
  for (const e of [...(summary?.keyEvents ?? [])].sort((x: J, y: J) => minutoNum(x?.clock?.displayValue) - minutoNum(y?.clock?.displayValue))) {
    const t = String(e?.type?.text ?? '')
    const eq = String(e?.team?.id ?? '')
    const lado = eq === idH ? 'home' : eq === idA ? 'away' : null
    if (!lado) continue
    const gente: string[] = (e?.participants ?? []).map((p: J) => p?.athlete?.displayName).filter(Boolean)
    const minuto = String(e?.clock?.displayValue ?? '')
    let tipo: EventoVisual['tipo'] | null = null
    if (/own goal/i.test(t)) tipo = 'propia'
    else if (/penalty/i.test(t) && /scored|goal/i.test(t)) tipo = 'penalti'
    else if (/goal/i.test(t) && !/disallowed|missed|saved/i.test(t)) tipo = 'gol'
    else if (/red card/i.test(t)) tipo = 'roja'
    if (!tipo || !gente[0]) continue
    eventos.push({ minuto, lado, tipo, jugador: gente[0], ...(tipo === 'gol' && gente[1] ? { asistencia: gente[1] } : {}) })
  }

  const bx: J[] = summary?.boxscore?.teams ?? []
  const bH = bx.find((t) => String(t?.team?.id) === idH)
  const bA = bx.find((t) => String(t?.team?.id) === idA)
  const mapa = (t: J | undefined) => Object.fromEntries((t?.statistics ?? []).map((s: J) => [s.name, Number(s.displayValue)]))
  const sH = mapa(bH), sA = mapa(bA)
  const estadisticas: FilaEstadistica[] = terminado
    ? STATS.filter(([k]) => Number.isFinite(sH[k]) && Number.isFinite(sA[k]))
        .map(([k, label, unit]) => ({ label, home: sH[k], away: sA[k], ...(unit ? { unit } : {}) }))
    : []

  const clasificacion: FilaClasificacion[] = []
  for (const g of summary?.standings?.groups ?? []) {
    const filas: J[] = g?.standings?.entries ?? []
    if (!filas.some((f) => String(f.id) === idH || String(f.id) === idA)) continue
    for (const f of filas) {
      const st = Object.fromEntries((f.stats ?? []).map((s: J) => [s.name, s.displayValue]))
      const id = String(f.id)
      clasificacion.push({
        pos: Number(st.rank) || clasificacion.length + 1,
        equipo: id === idH ? (nombres?.home || nombreEs(f.team)) : id === idA ? (nombres?.away || nombreEs(f.team)) : nombreEs(f.team),
        pj: Number(st.gamesPlayed) || 0,
        pts: Number(st.points) || 0,
        dif: String(st.pointDifferential ?? ''),
        destacado: id === idH || id === idA,
      })
    }
    break
  }
  clasificacion.sort((a, b) => a.pos - b.pos)

  // Racha: ESPN da los últimos partidos de cada equipo; el más reciente, primero.
  const forma = { home: [] as string[], away: [] as string[] }
  for (const lf of summary?.lastFiveGames ?? []) {
    const lado = String(lf?.team?.id) === idH ? 'home' : String(lf?.team?.id) === idA ? 'away' : null
    if (!lado) continue
    forma[lado] = [...(lf.events ?? [])]
      .sort((x: J, y: J) => Date.parse(y.gameDate) - Date.parse(x.gameDate))
      .map((ev: J) => ({ W: 'V', D: 'E', L: 'D' } as Record<string, string>)[String(ev.gameResult)] ?? '')
      .filter(Boolean)
      .slice(0, 5)
  }

  return { home: equipo(cH, nombres?.home), away: equipo(cA, nombres?.away), terminado, eventos, estadisticas, clasificacion, forma }
}

export async function fetchFichaVisual(matchRef: string | null | undefined, nombres?: { home?: string; away?: string }): Promise<FichaVisual | null> {
  const p = parseMatchRef(matchRef ?? '')
  if (!p) return null
  try {
    const r = await fetch(`${ESPN_SUMMARY}/${p.sport}/${p.league}/summary?event=${p.event}`, {
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 3600 },
    })
    return r.ok ? fichaVisual(await r.json(), nombres) : null
  } catch {
    return null
  }
}

// ── Montaje en el cuerpo ─────────────────────────────────────────────────────

type Tramo = { _type: string; _key?: string; text?: string; marks?: string[] }
type Bloque = { _type: string; _key?: string; style?: string; listItem?: string; children?: Tramo[]; [k: string]: unknown }

const textoDe = (b: Bloque) => (b.children ?? []).map((c) => c.text ?? '').join('')

/**
 * Inserta las piezas visuales en el cuerpo de una nota de partido: el marcador tras
 * la entradilla, las barras de estadísticas bajo la sección de números (o antes de la
 * ficha) y la clasificación bajo la sección que la comenta. Puro.
 */
export function montarPiezasPartido(cuerpo: Bloque[], f: FichaVisual, tipo: 'cronica' | 'previa'): Bloque[] {
  const out = [...cuerpo]
  const idxH2 = (rx: RegExp) => out.findIndex((b) => b._type === 'block' && (b.style === 'h2' || b.style === 'h3') && rx.test(textoDe(b)))
  const ficha = idxH2(/ficha del partido/i)
  const insertarTras = (rx: RegExp, bloque: Bloque) => {
    const i = idxH2(rx)
    if (i >= 0) out.splice(i + 1, 0, bloque)
    else if (ficha >= 0) out.splice(idxH2(/ficha del partido/i), 0, bloque)
    else out.push(bloque)
  }

  if (tipo === 'cronica' && (f.eventos.length || f.home.goles != null)) {
    // Tras la entradilla: los dos primeros párrafos normales.
    let normales = 0, pos = 0
    for (let i = 0; i < out.length; i++) {
      if (out[i]._type === 'block' && (out[i].style ?? 'normal') === 'normal' && !out[i].listItem) normales++
      if (normales === 2) { pos = i + 1; break }
    }
    out.splice(pos, 0, { _type: 'partidoMarcador', _key: 'pv-marcador', home: f.home, away: f.away, eventos: f.eventos })
  }
  if (tipo === 'cronica' && f.estadisticas.length >= 3) {
    insertarTras(/n[uú]meros|estad[ií]stic/i, {
      _type: 'statChart', _key: 'pv-stats', title: `${f.home.nombre} - ${f.away.nombre}`,
      homeLabel: f.home.nombre, awayLabel: f.away.nombre, rows: f.estadisticas,
    })
  }
  if (tipo === 'previa' && (f.forma.home.length || f.forma.away.length)) {
    insertarTras(/c[oó]mo llega|llegan|racha|forma/i, { _type: 'partidoForma', _key: 'pv-forma', home: f.home, away: f.away, forma: f.forma })
  }
  if (f.clasificacion.length >= 2) {
    insertarTras(/clasificaci[oó]n|qu[eé] cambia|en juego/i, { _type: 'partidoClasificacion', _key: 'pv-tabla', filas: f.clasificacion })
  }
  return out
}

// ── Noticias en general: menos bloque de letras ─────────────────────────────

const PALABRAS_PARRAFO_MAX = 75

/**
 * Parte en dos los párrafos de más de 75 palabras por el punto más cercano a la
 * mitad. Solo toca párrafos de un único tramo de texto sin marcas (nada de enlaces ni
 * negritas que se pudieran romper). Puro.
 */
export function partirParrafosLargos(cuerpo: Bloque[]): Bloque[] {
  const out: Bloque[] = []
  for (const b of cuerpo) {
    const ch = b.children ?? []
    const simple = b._type === 'block' && (b.style ?? 'normal') === 'normal' && !b.listItem &&
      ch.length === 1 && ch[0]._type === 'span' && !(ch[0].marks ?? []).length
    const t = simple ? String(ch[0].text ?? '') : ''
    if (!simple || t.split(/\s+/).length <= PALABRAS_PARRAFO_MAX) { out.push(b); continue }
    // Cortes posibles: fin de frase seguido de mayúscula (no "3.5", ni "Sr. Pérez").
    const cortes = [...t.matchAll(/[.!?…»”]\s+(?=[A-ZÁÉÍÓÚÑ¿¡«“])/g)].map((m) => (m.index ?? 0) + m[0].length)
    if (!cortes.length) { out.push(b); continue }
    const mitad = t.length / 2
    const c = cortes.reduce((a, x) => (Math.abs(x - mitad) < Math.abs(a - mitad) ? x : a))
    if (c < t.length * 0.25 || c > t.length * 0.75) { out.push(b); continue }
    const k = b._key ?? 'p'
    out.push({ ...b, children: [{ ...ch[0], text: t.slice(0, c).trim() }] })
    out.push({ ...b, _key: k + '-b', children: [{ ...ch[0], _key: k + '-bs', text: t.slice(c).trim() }] })
  }
  return out
}

/**
 * La primera cita literal del cuerpo («…» o “…”) de 40 a 240 caracteres, con quien
 * la dice si el párrafo lo nombra justo después («…», dijo X / «…», explicó X). No se
 * inventa ni se resume nada: si la nota no trae una cita, no hay destacado. Puro.
 */
export function citaDestacada(cuerpo: Bloque[]): { texto: string; autor: string | null; tras: number } | null {
  const VERBO = /^,?\s*(?:ha\s+)?(?:dijo|explicó|aseguró|afirmó|declaró|señaló|reconoció|admitió|añadió|comentó|apuntó|indicó|advirtió|sentenció|manifestó|expresó|confesó|lamentó|subrayó|destacó|insistió)(?=[\s,.]|$)\s*(?:el\s+|la\s+)?([A-ZÁÉÍÓÚÑ][\wáéíóúñü.'-]+(?:\s+(?:de\s+)?[A-ZÁÉÍÓÚÑ][\wáéíóúñü.'-]+){0,3})?/
  for (let i = 0; i < cuerpo.length; i++) {
    const b = cuerpo[i]
    if (b._type !== 'block' || (b.style ?? 'normal') !== 'normal' || b.listItem) continue
    const t = textoDe(b)
    // Latinas, inglesas y rectas. Las rectas se emparejan en orden (1.ª con 2.ª, 3.ª
    // con 4.ª): matchAll consume la de cierre, así que nunca empieza una cita en el
    // cierre de la anterior. Y solo pasa si es una declaración (ver abajo).
    for (const m of t.matchAll(/«([^«»]{40,240})»|“([^“”]{40,240})”|"([^"]{40,240})"/g)) {
      const cita0 = (m[1] ?? m[2] ?? m[3] ?? '').trim()
      const cita = cita0.charAt(0).toUpperCase() + cita0.slice(1)
      const antes = t.slice(Math.max(0, (m.index ?? 0) - 3), m.index ?? 0)
      const resto = t.slice((m.index ?? 0) + m[0].length)
      const a = VERBO.exec(resto)
      // Es una DECLARACIÓN si la presentan dos puntos o la sigue un verbo de habla; una
      // expresión entrecomillada («el más raro de la historia») no se destaca.
      if (!/:\s*$/.test(antes) && !a) continue
      return { texto: cita, autor: a && a[1] ? a[1] : null, tras: i }
    }
  }
  return null
}

/**
 * Inserta el destacado dos párrafos por debajo de la cita y nunca antes del tercer
 * párrafo de la nota: en la entradilla repetiría lo que se acaba de leer. Puro.
 */
export function montarDestacado(cuerpo: Bloque[]): Bloque[] {
  const c = citaDestacada(cuerpo)
  if (!c) return cuerpo
  const out = [...cuerpo]
  const esNormal = (b: Bloque) => b._type === 'block' && (b.style ?? 'normal') === 'normal' && !b.listItem
  let tras = 0, total = 0, pos = -1
  for (let i = 0; i < out.length; i++) {
    if (!esNormal(out[i])) continue
    total++
    if (i > c.tras) tras++
    if (tras >= 2 && total >= 3) { pos = i + 1; break }
  }
  if (pos < 0 || pos >= out.length) return cuerpo
  out.splice(pos, 0, { _type: 'destacado', _key: 'pv-destacado', texto: c.texto, autor: c.autor })
  return out
}
