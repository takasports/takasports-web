// ─────────────────────────────────────────────────────────────────
// Avisos de EQUIPO — lógica pura (sin red ni base de datos).
//
//   · «Hoy juega tu Atlético · 21:00 vs Barcelona · LaLiga · DAZN»
//   · «¡Gana tu Atlético! Atlético Madrid 2-1 Barcelona»
//
// Por qué existe: los favoritos de verdad son equipos (`team:<nombre>` en
// `user_favorites`, lo escriben la web y la app), y el único aviso de
// favoritos que había (/api/cron/favorites-push) cruzaba con jugadores del
// Índice. Nunca envió nada.
//
// Lo usa /api/cron/avisos-equipo (vía lib/avisos-equipo-run) y la vista previa.
//
// ── Cuándo se manda «hoy juega» ─────────────────────────────────────────
// Entre 3 h y 15 min antes del PRIMER partido del día que aún no ha empezado,
// y nunca de madrugada en la hora local del usuario (antes de las 9 o desde
// las 23). Se ata al saque y no a «las 10 de la mañana» a propósito:
// `profiles.timezone` vale 'Europe/Madrid' por defecto y mucha gente de Latam
// lo tendrá así sin serlo. Un aviso 3 h antes del partido llega a una hora
// razonable para quien lo va a ver, viva donde viva; uno fijo a las 10 de
// Madrid le llegaría a las 2-3 de la madrugada a un mexicano.
// ─────────────────────────────────────────────────────────────────

import { nameMatch } from './quiniela'
import { isWomensComp } from './football-leagues'

export const SIN_MADRUGADA_HOY = { desde: 9, hasta: 23 } as const
export const SIN_MADRUGADA_FINAL = { desde: 8, hasta: 24 } as const
/** Antelación máxima y mínima del aviso «hoy juega» respecto al saque. */
export const ANTELACION_MAX_MIN = 180
export const ANTELACION_MIN_MIN = 15
/** Pasado este tiempo desde el saque ya no se avisa del resultado. */
export const FINAL_CADUCA_MIN = 6 * 60

const ZONA_POR_DEFECTO = 'Europe/Madrid'
/** Zonas donde el canal de TV que guardamos (el de España) es el correcto. */
const ZONAS_CANAL_ES = new Set(['Europe/Madrid', 'Atlantic/Canary'])

export interface PartidoAviso {
  id: string
  home: string
  away: string | null
  isoDate?: string
  comp: string
  sport: string
  broadcast?: string
  matchRef?: string
  timeTbd?: boolean
}

export interface AvisoTexto {
  title: string
  body: string
  url: string
  tag: string
}

// ── Utilidades de zona ────────────────────────────────────────────────

/** Zona IANA válida o la de Madrid. Un valor corrupto no puede tumbar el cron. */
export function zonaValida(tz: string | null | undefined): string {
  if (!tz) return ZONA_POR_DEFECTO
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: tz })
    return tz
  } catch {
    return ZONA_POR_DEFECTO
  }
}

export function partesEnZona(d: Date, tz: string): { dia: string; hora: number; minuto: number } {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: zonaValida(tz), year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
  const m: Record<string, string> = {}
  for (const p of f.formatToParts(d)) if (p.type !== 'literal') m[p.type] = p.value
  let hora = Number(m.hour)
  if (hora === 24) hora = 0
  return { dia: `${m.year}-${m.month}-${m.day}`, hora, minuto: Number(m.minute) }
}

/** ¿Es hora decente en esa zona? `hasta` es exclusivo (24 = hasta medianoche). */
export function horaDecente(ahora: Date, tz: string, franja: { desde: number; hasta: number }): boolean {
  const { hora } = partesEnZona(ahora, tz)
  return hora >= franja.desde && hora < franja.hasta
}

function horaCorta(iso: string, tz: string): string {
  const { hora, minuto } = partesEnZona(new Date(iso), tz)
  return `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`
}

// ── Favoritos ─────────────────────────────────────────────────────────

/** `team:<nombre>` de `user_favorites` → equipos por usuario (sin duplicados). */
export function equiposPorUsuario(rows: readonly { user_id: string; entry_id: string }[]): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const r of rows) {
    if (!r?.user_id || typeof r.entry_id !== 'string' || !r.entry_id.startsWith('team:')) continue
    const nombre = r.entry_id.slice(5).trim()
    if (!nombre) continue
    const lista = out.get(r.user_id) ?? []
    if (!lista.some((n) => n.toLowerCase() === nombre.toLowerCase())) lista.push(nombre)
    out.set(r.user_id, lista)
  }
  return out
}

const PIDE_FEMENINO = /\b(femenino|femenina|women|womens|fem)\b/i

export interface Cruce {
  partido: PartidoAviso
  /** Nombre del equipo del usuario TAL COMO lo trae el partido (ESPN). */
  equipo: string
  rival: string
  /** Si el usuario sigue a los dos equipos del partido. */
  sigueAmbos: boolean
  /** Partido de competición femenina (el nombre del club no lo dice). */
  femenino?: boolean
}

/** «tu Real Madrid» o, si es la sección femenina, «tu Real Madrid femenino». */
export function nombreTuyo(c: Pick<Cruce, 'equipo' | 'femenino'>): string {
  return c.femenino && !PIDE_FEMENINO.test(c.equipo) ? `${c.equipo} femenino` : c.equipo
}

/**
 * Partidos de equipo en los que juega alguno de los equipos del usuario.
 * Los clubes comparten nombre con su sección femenina ("Barcelona", "Real
 * Madrid"): un favorito sin «femenino» no casa con partidos de liga femenina,
 * igual que el calendario no cruza forma reciente entre géneros.
 */
export function cruzarPartidos(equipos: readonly string[], partidos: readonly PartidoAviso[]): Cruce[] {
  const out: Cruce[] = []
  if (equipos.length === 0) return out
  for (const p of partidos) {
    if (!p.away || !p.home) continue
    const femenino = isWomensComp(p.comp)
    const validos = equipos.filter((e) => PIDE_FEMENINO.test(e) === femenino)
    const casaLocal = validos.some((e) => nameMatch(e, p.home))
    const casaVisit = validos.some((e) => nameMatch(e, p.away as string))
    if (!casaLocal && !casaVisit) continue
    out.push({
      partido: p,
      equipo: casaLocal ? p.home : (p.away as string),
      rival: casaLocal ? (p.away as string) : p.home,
      sigueAmbos: casaLocal && casaVisit,
      femenino,
    })
  }
  return out
}

function urlPartido(p: PartidoAviso): string {
  return p.matchRef ? `/partido/${p.matchRef}` : '/calendario'
}

// ── «Hoy juega tu…» ──────────────────────────────────────────────────

export type PlanHoy =
  | { ok: true; ref: string; cruce: Cruce; texto: AvisoTexto }
  | { ok: false; motivo: 'sin_partidos' | 'aun_no' | 'ya_empezado' | 'madrugada' }

/**
 * Decide si toca el aviso del día para un usuario. `ref` es el día LOCAL del
 * partido (clave de idempotencia: un aviso por usuario y día).
 */
export function planAvisoHoy(input: {
  equipos: readonly string[]
  partidos: readonly PartidoAviso[]
  tz: string | null | undefined
  ahora: Date
}): PlanHoy {
  const tz = zonaValida(input.tz)
  const ahoraMs = input.ahora.getTime()
  const hoyLocal = partesEnZona(input.ahora, tz).dia

  const delDia = cruzarPartidos(input.equipos, input.partidos)
    .filter((c) => c.partido.isoDate && !c.partido.timeTbd)
    .filter((c) => partesEnZona(new Date(c.partido.isoDate as string), tz).dia === hoyLocal)
    .filter((c) => new Date(c.partido.isoDate as string).getTime() > ahoraMs)
    .sort((a, b) => (a.partido.isoDate as string).localeCompare(b.partido.isoDate as string))

  if (delDia.length === 0) return { ok: false, motivo: 'sin_partidos' }
  const primero = delDia[0]
  const faltan = (new Date(primero.partido.isoDate as string).getTime() - ahoraMs) / 60_000
  if (faltan > ANTELACION_MAX_MIN) return { ok: false, motivo: 'aun_no' }
  if (faltan < ANTELACION_MIN_MIN) return { ok: false, motivo: 'ya_empezado' }
  if (!horaDecente(input.ahora, tz, SIN_MADRUGADA_HOY)) return { ok: false, motivo: 'madrugada' }

  // Otro partido de OTRO equipo suyo ese mismo día: se menciona, no se avisa aparte.
  const otro = delDia.find((c) => c.equipo !== primero.equipo && c.partido.id !== primero.partido.id)
  return { ok: true, ref: hoyLocal, cruce: primero, texto: textoAvisoHoy(primero, tz, otro, hoyLocal) }
}

export function textoAvisoHoy(c: Cruce, tz: string, otro?: Cruce, dia?: string): AvisoTexto {
  const zona = zonaValida(tz)
  const p = c.partido
  const hora = p.isoDate ? horaCorta(p.isoDate, zona) : ''
  // El canal guardado es el de España: en otra zona sería mentira.
  const canal = p.broadcast && ZONAS_CANAL_ES.has(zona) ? p.broadcast : undefined
  // Si sigue a los dos equipos, el titular ya nombra el partido entero.
  const cabeza = c.sigueAmbos ? hora : `${hora} vs ${c.rival}`
  let body = [cabeza, p.comp, canal].filter(Boolean).join(' · ')
  if (otro?.partido.isoDate) body += `. Y a las ${horaCorta(otro.partido.isoDate, zona)}, tu ${nombreTuyo(otro)}`
  return {
    title: c.sigueAmbos ? `Hoy: ${p.home} vs ${p.away}` : `Hoy juega tu ${nombreTuyo(c)}`,
    body,
    url: urlPartido(p),
    tag: `equipo-hoy-${dia ?? partesEnZona(new Date(), zona).dia}`,
  }
}

// ── «Resultado final» ────────────────────────────────────────────────

/** Minutos mínimos desde el saque antes de preguntar si ha acabado. */
export function duracionMinima(sport: string): number {
  const s = (sport ?? '').toLowerCase()
  if (s.includes('fútbol') || s.includes('futbol') || s.includes('soccer')) return 105
  if (s.includes('balonc') || s.includes('nba') || s.includes('basket')) return 125
  if (s.includes('rugby')) return 95
  if (s.includes('nfl') || s.includes('americano')) return 180
  if (s.includes('hockey') || s.includes('nhl')) return 140
  return 120
}

/** ¿Merece la pena preguntar a ESPN por este partido ahora? */
export function tocaMirarResultado(p: PartidoAviso, ahora: Date): boolean {
  if (!p.isoDate || !p.matchRef || !p.away) return false
  const desdeSaque = (ahora.getTime() - new Date(p.isoDate).getTime()) / 60_000
  return desdeSaque >= duracionMinima(p.sport) && desdeSaque <= FINAL_CADUCA_MIN
}

export interface EstadoPartido {
  final: boolean
  statusName: string
  homeScore: number | null
  awayScore: number | null
  homeWinner?: boolean
  awayWinner?: boolean
}

const ESTADOS_FINALES = new Set([
  'STATUS_FINAL', 'STATUS_FULL_TIME', 'STATUS_FT', 'STATUS_ENDED',
  'STATUS_FINAL_PEN', 'STATUS_FINAL_AET',
  'STATUS_FULL_TIME_ET', 'STATUS_FULL_TIME_AET', 'STATUS_PENALTY',
])

function aEntero(v: unknown): number | null {
  if (v == null) return null
  const raw = typeof v === 'object' ? (v as { value?: unknown; displayValue?: unknown }).value ?? (v as { displayValue?: unknown }).displayValue : v
  const n = Number(raw)
  return Number.isFinite(n) ? Math.round(n) : null
}

/** Lee el `summary` de ESPN (el partido cuelga de `header`). `null` si no se entiende. */
export function leerEstadoSummary(json: unknown): EstadoPartido | null {
  const comp = (json as { header?: { competitions?: unknown[] } })?.header?.competitions?.[0] as
    | { status?: { type?: { name?: string } }; competitors?: { homeAway?: string; score?: unknown; winner?: boolean }[] }
    | undefined
  const home = comp?.competitors?.find((c) => c.homeAway === 'home')
  const away = comp?.competitors?.find((c) => c.homeAway === 'away')
  if (!home || !away) return null
  const statusName = comp?.status?.type?.name ?? ''
  return {
    final: ESTADOS_FINALES.has(statusName),
    statusName,
    homeScore: aEntero(home.score),
    awayScore: aEntero(away.score),
    homeWinner: home.winner,
    awayWinner: away.winner,
  }
}

export function textoAvisoFinal(c: Cruce, e: EstadoPartido): AvisoTexto | null {
  const p = c.partido
  if (!e.final || e.homeScore == null || e.awayScore == null || !p.away) return null
  const penaltis = /PEN/.test(e.statusName)
  const marcador = `${p.home} ${e.homeScore}-${e.awayScore} ${p.away}${penaltis ? ' (penaltis)' : ''}`
  const base = { url: urlPartido(p), tag: `equipo-final-${p.id}` }
  const cola = `Resultado final${p.comp ? ` · ${p.comp}` : ''}. Mira las estadísticas del partido.`
  if (c.sigueAmbos) return { ...base, title: `Final: ${marcador}`, body: cola }

  const esLocal = c.equipo === p.home
  let gana: boolean | null
  if (e.homeScore !== e.awayScore) gana = esLocal ? e.homeScore > e.awayScore : e.awayScore > e.homeScore
  else if (e.homeWinner || e.awayWinner) gana = esLocal ? !!e.homeWinner : !!e.awayWinner // penaltis
  else gana = null

  if (gana === true) return { ...base, title: `¡Gana tu ${nombreTuyo(c)}! ${marcador}`, body: cola }
  if (gana === null) return { ...base, title: `Empate de tu ${nombreTuyo(c)}: ${marcador}`, body: cola }
  return { ...base, title: `Final: ${marcador}`, body: `Derrota de tu ${nombreTuyo(c)}${p.comp ? ` en ${p.comp}` : ''}. Mira las estadísticas del partido.` }
}
