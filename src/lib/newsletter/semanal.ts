// ─────────────────────────────────────────────────────────────────────────────
// Newsletter semanal — QUÉ lleva el correo del lunes. Lógica pura y testeable:
// aquí no hay red ni base de datos; lo que se trae de fuera llega como datos
// desde `datos-semanal.ts` y lo que se pinta sale de `plantilla-semanal.ts`.
//
// El formulario (NewsletterSection, 11 páginas) promete tres cosas:
//   · «Resumen de fútbol, NBA, F1, UFC y más»  → noticias destacadas, una por
//     deporte mientras haya deportes distintos, y los partidos grandes.
//   · «Estadísticas y rankings semanales»      → quién sube en el Ranking Taka
//     y la clasificación de la Liga Taka / Jornada.
//   · «Acceso anticipado a nuevos juegos…»     → NO hay nada que lo cumpla; el
//     bloque de juego es el juego de la semana, no un adelanto.
//
// Nada de esto escribe contenido: los titulares y entradillas son los que ya
// publicó el pipeline en Sanity. El correo solo elige y enlaza.
// ─────────────────────────────────────────────────────────────────────────────

import { getEventHighlightScore, getLeagueScore, highlightReason } from '@/lib/competitions'
import { madridParts, madridWeekISO } from '@/lib/taka-time'

export const SITE = 'https://www.takasportsmedia.com'

// ── Edición ──────────────────────────────────────────────────────────────────

export interface Edicion {
  /** Lunes de la edición, YYYY-MM-DD (hora de Madrid). */
  lunes: string
  /** Semana ISO del lunes: "2026-W41". */
  semanaISO: string
  /** Número de semana (41). */
  numero: number
  /** Clave de la edición y de la campaña UTM: "semanal-2026-41". */
  clave: string
  /** [desde, hasta) de la semana que EMPIEZA, en ms (medianoche de Madrid). */
  desdeMs: number
  hastaMs: number
  /** Lunes de la semana que ACABA (la Jornada a cerrar), YYYY-MM-DD. */
  lunesAnterior: string
}

/** Suma días a un YYYY-MM-DD sin que el huso mueva la fecha (mediodía UTC). */
export function sumarDias(ymd: string, dias: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d, 12))
  t.setUTCDate(t.getUTCDate() + dias)
  return t.toISOString().slice(0, 10)
}

/** Instante UTC de las 00:00 de Madrid del día `ymd`. */
export function medianocheMadrid(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number)
  const candidato = Date.UTC(y, m - 1, d, 0, 0, 0)
  const p = madridParts(new Date(candidato))
  const relojComoUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  // relojComoUtc - candidato = desfase de Madrid (+1 h o +2 h).
  return candidato - (relojComoUtc - candidato)
}

function hoyMadrid(now: Date): string {
  const p = madridParts(now)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** Día de la semana de un YYYY-MM-DD: lunes=1 … domingo=7. */
function diaSemana(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay() || 7
}

/**
 * Edición a la que pertenece `now`.
 *
 * · 'envio': el lunes de la semana en curso. Si el cron reintenta el martes,
 *   sigue siendo LA MISMA edición (misma clave → no se manda dos veces).
 * · 'vista': la próxima que va a salir. El lunes es la de hoy; cualquier otro
 *   día, la del lunes siguiente (lo que el dueño va a aprobar).
 */
export function edicionSemanal(now: Date, modo: 'envio' | 'vista' = 'envio'): Edicion {
  const hoy = hoyMadrid(now)
  const dow = diaSemana(hoy)
  const lunes = modo === 'envio' || dow === 1
    ? sumarDias(hoy, 1 - dow)
    : sumarDias(hoy, 8 - dow)
  const semanaISO = madridWeekISO(new Date(medianocheMadrid(lunes) + 12 * 3600_000))
  const [anio, sem] = semanaISO.split('-W')
  return {
    lunes,
    semanaISO,
    numero: Number(sem),
    clave: `semanal-${anio}-${sem}`,
    desdeMs: medianocheMadrid(lunes),
    hastaMs: medianocheMadrid(sumarDias(lunes, 7)),
    lunesAnterior: sumarDias(lunes, -7),
  }
}

// ── Enlaces ──────────────────────────────────────────────────────────────────

/**
 * Enlace con UTM de la campaña. Acepta rutas ("/noticias/x") o URLs absolutas
 * del propio sitio. `bloque` va en utm_content para saber qué bloque convierte.
 */
export function conUtm(ruta: string, campana: string, bloque?: string): string {
  const url = new URL(ruta, SITE)
  url.searchParams.set('utm_source', 'newsletter')
  url.searchParams.set('utm_medium', 'email')
  url.searchParams.set('utm_campaign', campana)
  if (bloque) url.searchParams.set('utm_content', bloque)
  return url.toString()
}

// ── Noticias ─────────────────────────────────────────────────────────────────

export interface NoticiaCandidata {
  slug: string
  title: string
  summary?: string | null
  sport?: string | null
  competition?: string | null
  type?: string | null
  publishedAt: string
  imagen?: string | null
}

/** Clave de deporte para la diversidad: el slug de Sanity, o «otros». */
export function claveDeporte(sport?: string | null): string {
  const s = (sport ?? '').toLowerCase().trim()
  if (!s) return 'otros'
  if (s === 'nba' || s === 'euroliga' || s === 'acb' || s === 'bcl') return 'baloncesto'
  if (s === 'wrestling') return 'wwe'
  return s
}

/**
 * Puntuación de una noticia para el bloque de destacadas.
 *
 * · Competición: el MISMO peso de liga que usan los Destacados del calendario
 *   (Champions 12, LaLiga 11, Nations 8, amistoso 3…).
 * · Clics desde Google en la última ventana de Search Console (tope para que
 *   un pelotazo no se coma todo): hasta +10.
 * · Frescura: un lunes interesa más lo del fin de semana que lo del martes.
 */
export function puntuarNoticia(n: NoticiaCandidata, clics: number, ahora: number): number {
  let p = getLeagueScore(n.competition ?? '')
  p += Math.min(Math.max(clics, 0), 60) / 6
  const edadH = (ahora - new Date(n.publishedAt).getTime()) / 3600_000
  if (edadH <= 48) p += 1.5
  else if (edadH <= 96) p += 0.75
  if (n.type === 'cronica') p += 0.5
  return p
}

/**
 * Las `n` noticias destacadas de la semana, una por deporte mientras queden
 * deportes distintos (la promesa es «fútbol, NBA, F1, UFC y más»; si no, la
 * semana de selecciones serían cinco de fútbol). Si hay menos deportes que
 * huecos, se rellena con lo siguiente mejor puntuado.
 *
 * Fuera: previas (un lunes ya hablan de partidos jugados), sin slug/título, y
 * las que ya salen en «Lo más leído» (`excluir`) para no repetir enlace.
 */
export function elegirDestacadas(
  noticias: NoticiaCandidata[],
  opts: { clics?: Map<string, number>; excluir?: Set<string>; ahora: number; n?: number },
): NoticiaCandidata[] {
  const { clics = new Map(), excluir = new Set(), ahora, n = 5 } = opts
  const vistos = new Set<string>()
  const puntuadas = noticias
    .filter(x => x?.slug && x?.title && x.type !== 'previa' && !excluir.has(x.slug))
    .filter(x => (vistos.has(x.slug) ? false : (vistos.add(x.slug), true)))
    .map(x => ({ x, p: puntuarNoticia(x, clics.get(x.slug) ?? 0, ahora) }))
    .sort((a, b) => b.p - a.p || b.x.publishedAt.localeCompare(a.x.publishedAt))

  const elegidas: NoticiaCandidata[] = []
  const deportes = new Set<string>()
  for (const { x } of puntuadas) {
    if (elegidas.length >= n) break
    const k = claveDeporte(x.sport)
    if (deportes.has(k)) continue
    deportes.add(k)
    elegidas.push(x)
  }
  for (const { x } of puntuadas) {
    if (elegidas.length >= n) break
    if (!elegidas.includes(x)) elegidas.push(x)
  }
  return elegidas
}

/**
 * La entradilla, solo si aporta. La metaDescription del pipeline muchas veces
 * EMPIEZA repitiendo el titular palabra por palabra; debajo del propio titular
 * eso se lee como un eco, así que en ese caso no se pinta.
 */
export function resumenUtil(titulo: string, resumen: string | null | undefined): string | null {
  const r = (resumen ?? '').trim()
  if (!r) return null
  const norm = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const t = norm(titulo)
  if (t && norm(r).startsWith(t)) return null
  return r
}

// ── Partidos de la semana ────────────────────────────────────────────────────

export interface PartidoCandidato {
  id: string
  home: string
  away: string | null
  sport: string
  comp: string
  isoDate?: string
  stage?: string
  isPast?: boolean
  matchRef?: string
  broadcast?: string
}

export interface PartidoElegido extends PartidoCandidato {
  isoDate: string
  motivo: string | null
}

/** Fútbol hasta 3 (es lo que más lee esta audiencia); el resto hasta 2. */
function topePorDeporte(sport: string): number {
  return sport === 'Fútbol' ? 3 : 2
}

/**
 * Los partidos grandes de la semana que empieza, con el MISMO ranking que los
 * Destacados del calendario (getEventHighlightScore: liga + cartel + selección
 * + fase + prime time de Madrid). Con tope por deporte: el de Destacados es de
 * un día, y en una semana entera la NBA (11 de base + carteles) metía tres
 * partidos de madrugada —de pretemporada en octubre— por delante de un
 * España de selecciones. Se devuelven por fecha, que es como se lee una agenda.
 */
export function elegirPartidosGrandes(
  eventos: PartidoCandidato[],
  desdeMs: number,
  hastaMs: number,
  n = 6,
): PartidoElegido[] {
  const vistos = new Set<string>()
  const enSemana: Array<{ ev: PartidoCandidato & { isoDate: string }; score: number; ts: number }> = []
  for (const ev of eventos) {
    if (!ev?.isoDate || ev.isPast) continue
    const ts = new Date(ev.isoDate).getTime()
    if (!Number.isFinite(ts) || ts < desdeMs || ts >= hastaMs) continue
    // Mismo partido por dos fuentes (o dos sesiones de un GP): una sola vez.
    const clave = `${ev.home}|${ev.away ?? ''}|${ev.isoDate.slice(0, 10)}`
    if (vistos.has(clave)) continue
    vistos.add(clave)
    const score = getEventHighlightScore({ comp: ev.comp, home: ev.home, away: ev.away, stage: ev.stage, isoDate: ev.isoDate })
    enSemana.push({ ev: ev as PartidoCandidato & { isoDate: string }, score, ts })
  }
  enSemana.sort((a, b) => b.score - a.score || a.ts - b.ts)

  const porDeporte = new Map<string, number>()
  const elegidos: Array<{ ev: PartidoCandidato & { isoDate: string }; ts: number }> = []
  for (const c of enSemana) {
    if (elegidos.length >= n) break
    const usados = porDeporte.get(c.ev.sport) ?? 0
    if (usados >= topePorDeporte(c.ev.sport)) continue
    porDeporte.set(c.ev.sport, usados + 1)
    elegidos.push(c)
  }
  return elegidos
    .sort((a, b) => a.ts - b.ts)
    .map(({ ev }) => ({ ...ev, motivo: highlightReason({ comp: ev.comp, home: ev.home, away: ev.away, stage: ev.stage }) }))
}

// ── Liga Taka / Jornada ──────────────────────────────────────────────────────

export interface FilaClasificacion {
  userId: string
  nombre: string
  puntos: number
  aciertos?: number
  jugados?: number
  puesto: number
}

/**
 * Nombre que se puede enseñar. Un correo NUNCA es un nombre (desde el
 * 01/10/2026 el respaldo es «Takero NNNN», ver nombre-publico.ts): si el
 * display_name viene vacío o con pinta de dirección, se usa el respaldo.
 */
export function nombreVisible(displayName: string | null | undefined, porDefecto: string): string {
  const n = (displayName ?? '').trim()
  if (!n || n.includes('@')) return porDefecto
  return n.length > 28 ? `${n.slice(0, 27)}…` : n
}

// ── Juego de la semana ───────────────────────────────────────────────────────

export type JuegoSemanal = 'mionce' | 'sopacracks'

/** Los dos juegos SEMANALES se turnan: semana par Mi Once, impar Sopa de Cracks. */
export function juegoDeLaSemana(semanaISO: string): JuegoSemanal {
  const n = Number(semanaISO.slice(-2))
  return Number.isFinite(n) && n % 2 === 0 ? 'mionce' : 'sopacracks'
}

// ── Contenido completo ───────────────────────────────────────────────────────

export interface NoticiaCorreo {
  titulo: string
  resumen: string | null
  deporte: string | null
  competicion: string | null
  url: string
  imagen: string | null
}

export interface PartidoCorreo {
  dia: string       // "Lun 5"
  hora: string      // "20:45" o "" si no hay hora
  comp: string
  sport: string
  titulo: string    // "Francia – Bélgica" o "GP de Japón"
  motivo: string | null
  canal: string | null
  url: string
}

export interface MovimientoCorreo {
  nombre: string
  detalle: string
  bandera: string | null
  score: number
  delta: number
  url: string
}

export interface ContenidoSemanal {
  edicion: Edicion
  generadoEn: string
  destacadas: NoticiaCorreo[]
  masLeidas: NoticiaCorreo[]
  /** "del 24 al 30 sep" — la ventana real de Search Console (va con retraso). */
  masLeidasVentana: string | null
  partidos: PartidoCorreo[]
  movimientos: MovimientoCorreo[]
  ligaTaka: {
    /** Clasificación de la Jornada que acaba (vacía si nadie jugó). */
    jornada: FilaClasificacion[]
    jornadaParticipantes: number
    jornadaUrl: string
    /** Top de la clasificación acumulada (Liga Taka). */
    general: FilaClasificacion[]
    generalUrl: string
    /** La Jornada nueva: cuántos partidos y cuál es el estrella. */
    abierta: { partidos: number; estrella: string | null; url: string } | null
  }
  juego: {
    id: JuegoSemanal
    nombre: string
    titulo: string
    descripcion: string
    url: string
  }
}

/** ¿Hay suficiente para mandar? Un correo sin noticias ni partidos no sale. */
export function contenidoSuficiente(c: ContenidoSemanal): { ok: boolean; motivo?: string } {
  if (c.destacadas.length < 3) return { ok: false, motivo: 'menos_de_3_noticias' }
  if (c.partidos.length === 0 && c.masLeidas.length === 0) return { ok: false, motivo: 'sin_partidos_ni_mas_leidas' }
  return { ok: true }
}

function recortar(s: string, max: number): string {
  if (s.length <= max) return s
  const corte = s.slice(0, max - 1)
  const espacio = corte.lastIndexOf(' ')
  return `${(espacio > max * 0.6 ? corte.slice(0, espacio) : corte).replace(/[\s,;:.–-]+$/, '')}…`
}

/** Asunto: el titular que abre el correo, con la marca delante. ≤ 78 caracteres. */
export function asuntoSemanal(c: ContenidoSemanal): string {
  const titular = c.destacadas[0]?.titulo
  const base = 'Taka Semanal'
  if (!titular) return `${base} · Lo que pasó y lo que viene`
  return `${base}: ${recortar(titular, 78 - base.length - 2)}`
}

/** Preheader (la línea gris que se ve en la bandeja junto al asunto). */
export function preheaderSemanal(c: ContenidoSemanal): string {
  const partes: string[] = []
  const cartel = c.partidos.find(p => p.motivo) ?? c.partidos[0]
  if (cartel) partes.push(`${cartel.titulo} y ${Math.max(c.partidos.length - 1, 0)} partidos más`)
  if (c.movimientos[0]) partes.push(`${c.movimientos[0].nombre} sube en el Ranking Taka`)
  partes.push(`juego de la semana: ${c.juego.nombre}`)
  return recortar(partes.join(' · '), 140)
}

// ── Formato de fechas (hora de Madrid) ───────────────────────────────────────

const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** "Lun 5" + "20:45" en hora de Madrid. `sinHora` para rondas sin horario. */
export function diaHoraMadrid(iso: string, sinHora = false): { dia: string; hora: string } {
  const d = new Date(iso)
  const p = madridParts(d)
  const dow = new Date(Date.UTC(p.year, p.month - 1, p.day, 12)).getUTCDay()
  return {
    dia: `${DIAS_CORTOS[dow]} ${p.day}`,
    hora: sinHora ? '' : `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`,
  }
}

/** "del 24 al 30 sep" / "del 28 sep al 4 oct". */
export function rangoCorto(desde: string, hasta: string): string {
  const [, m1, d1] = desde.split('-').map(Number)
  const [, m2, d2] = hasta.split('-').map(Number)
  return m1 === m2
    ? `del ${d1} al ${d2} ${MESES_CORTOS[m2 - 1]}`
    : `del ${d1} ${MESES_CORTOS[m1 - 1]} al ${d2} ${MESES_CORTOS[m2 - 1]}`
}

/** "lunes 5 de octubre de 2026". */
export function fechaLarga(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
  return `${dias[dow]} ${d} de ${MESES_LARGOS[m - 1]} de ${y}`
}
