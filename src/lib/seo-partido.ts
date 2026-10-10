// SEO de las notas de partido: previas y crónicas (05/10/2026).
//
// En Google nos ven mucho y nos pinchan poco (0,2 % de CTR la semana del 26/09). Quien
// busca un partido escribe lo que quiere saber —«barcelona real madrid horario»,
// «dónde ver», «resumen», «resultado»— y el titular periodístico no se lo promete.
// Aquí sale, sin IA y con datos verificados (ESPN y los derechos de TV de la base):
//   · el <title>: «Barcelona - Real Madrid: horario y dónde ver el Clásico | LaLiga» o
//     «Barcelona 2-1 Real Madrid: resumen, goles y figura | LaLiga», que encoge por
//     escalones hasta caber en ~62 caracteres (lo que Google enseña sin cortar);
//   · la meta descripción con día, horas de España y México y canal, o goles y figura;
//   · preguntas frecuentes con respuesta exacta (hora por país, TV, estadio, cómo
//     llegan, último cara a cara / resultado, goleadores, figura, clasificación),
//     que se ven en la nota y van en FAQPage;
//   · el SportsEvent de schema.org al que apunta el NewsArticle (`about`).
// El H1 y el titular de redes no cambian. Todo puro: se prueba con fixtures.

import type { BroadcastRow } from '@/lib/broadcast-countries'
import type { FichaVisual } from '@/lib/partido-visual'
import { rivalidadDe } from '@/lib/push-previas'
import { parseMatchRef } from '@/lib/previas-dossier'

export const MAX_TITULO = 62
export const MAX_DESCRIPCION = 158

export interface DatosSeoPartido {
  tipo: 'previa' | 'cronica'
  home: string
  away: string
  iso: string | null
  /** Etiqueta corta de la competición («LaLiga», «Champions»), si se conoce. */
  competicion: string | null
  deporte: 'futbol' | 'baloncesto' | 'ufc' | 'f1' | 'tenis'
  ficha: FichaVisual | null
  tv: BroadcastRow[]
}

export interface PreguntaFrecuente { q: string; a: string }

// ── Competición ──────────────────────────────────────────────────────────────
// Por la liga del matchRef de ESPN: el nombre que da ESPN viene en inglés
// («Spanish LALIGA») y el de la previa a veces largo («LaLiga EA Sports»).
const LIGAS: Record<string, string> = {
  'esp.1': 'LaLiga', 'esp.2': 'LaLiga Hypermotion', 'esp.w.1': 'Liga F', 'esp.copa_del_rey': 'Copa del Rey', 'esp.super_cup': 'Supercopa',
  'eng.1': 'Premier League', 'ita.1': 'Serie A', 'ger.1': 'Bundesliga', 'fra.1': 'Ligue 1', 'por.1': 'Liga Portugal', 'ned.1': 'Eredivisie',
  'uefa.champions': 'Champions', 'uefa.europa': 'Europa League', 'uefa.europa.conf': 'Conference League', 'uefa.nations': 'Nations League',
  'uefa.wchampions': 'Champions femenina', 'fifa.world': 'Mundial', 'fifa.cwc': 'Mundial de Clubes', 'fifa.friendly': 'Amistoso',
  'mex.1': 'Liga MX', 'arg.1': 'Liga Argentina', 'bra.1': 'Brasileirão', 'col.1': 'Liga BetPlay', 'chi.1': 'Primera de Chile',
  'conmebol.libertadores': 'Libertadores', 'conmebol.sudamericana': 'Sudamericana', 'usa.1': 'MLS', 'nba': 'NBA',
}
export function competicionCorta(matchRef: string | null | undefined, etiqueta?: string | null): string | null {
  const liga = parseMatchRef(matchRef ?? '')?.league
  if (liga && LIGAS[liga]) return LIGAS[liga]
  if (liga && /^fifa\.worldq/.test(liga)) return 'Eliminatorias'
  const e = String(etiqueta ?? '').replace(/\s+EA Sports$/i, '').trim()
  return e && e.length <= 22 ? e : null
}

// ── Formato ──────────────────────────────────────────────────────────────────
/** Apellido para titulares de tenis: «Carlos Alcaraz» → «Alcaraz», «Alex de Minaur» → «de Minaur». */
export function apellido(nombre: string): string {
  const p = nombre.trim().split(/\s+/)
  if (p.length < 2) return nombre.trim()
  const i = p.findIndex((x, k) => k > 0 && /^(de|del|da|van|von|di|le|la)$/i.test(x))
  return i > 0 ? p.slice(i).join(' ') : p[p.length - 1]
}
const fmt = (iso: string, tz: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-ES', { timeZone: tz, ...o }).format(new Date(iso))
const hora = (iso: string, tz: string) => fmt(iso, tz, { hour: '2-digit', minute: '2-digit', hour12: false })
const diaLargo = (iso: string) => fmt(iso, 'Europe/Madrid', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^(\p{L}+), /u, '$1 ')
const fechaCorta = (ymd: string) => fmt(ymd + 'T12:00:00Z', 'UTC', { day: 'numeric', month: 'long', year: 'numeric' })
const valido = (iso: string | null | undefined): iso is string => !!iso && Number.isFinite(Date.parse(iso))
const lista = (xs: string[]) => xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`
const recortar = (s: string, max: number) => {
  if (s.length <= max) return s
  const t = s.slice(0, max - 1)
  const k = t.lastIndexOf(' ')
  return (k > max * 0.6 ? t.slice(0, k) : t).replace(/[\s,.;:·-]+$/, '') + '…'
}
const primero = (opciones: string[], max: number) => opciones.find((t) => t.length <= max) ?? recortar(opciones[opciones.length - 1], max)

const ZONAS: Array<[string, string]> = [
  ['México', 'America/Mexico_City'], ['Argentina', 'America/Argentina/Buenos_Aires'], ['Colombia', 'America/Bogota'],
  ['Chile', 'America/Santiago'], ['Estados Unidos (hora del Este)', 'America/New_York'],
]

const goles = (d: DatosSeoPartido) => {
  const f = d.ficha
  return f && f.terminado && f.home.goles != null && f.away.goles != null ? { h: f.home.goles, a: f.away.goles } : null
}

/** Goleadores agrupados: «Robert Lewandowski (24' de penalti y 47') y Virgil Ghita (49', en propia)». */
function goleadores(f: FichaVisual): string[] {
  const por = new Map<string, string[]>()
  for (const e of f.eventos) {
    if (e.tipo === 'roja') continue
    const m = e.tipo === 'penalti' ? `${e.minuto} de penalti` : e.tipo === 'propia' ? `${e.minuto}, en propia` : e.minuto
    por.set(e.jugador, [...(por.get(e.jugador) ?? []), m])
  }
  return [...por].map(([j, ms]) => `${j} (${lista(ms)})`)
}

// ── Título ───────────────────────────────────────────────────────────────────
/** Null = usar el titular de la nota (p. ej. la crónica de una velada: no hay marcador). */
export function tituloSeoPartido(d: DatosSeoPartido): string | null {
  const comp = d.competicion ? ` | ${d.competicion}` : ''
  const g = goles(d)
  if (d.tipo === 'cronica' && g) {
    const m = `${d.home} ${g.h}-${g.a} ${d.away}`
    const conGoles = g.h + g.a > 0 ? 'resumen, goles y figura' : 'resumen y estadísticas'
    return primero([`${m}: ${conGoles}${comp}`, `${m}: ${conGoles}`, `${m}: resumen y goles`, `${m}: resumen`, m], MAX_TITULO)
  }
  // Una crónica sin marcador de goles (una velada, un GP) se queda con su titular.
  if (d.tipo === 'cronica') return null
  if (d.deporte === 'f1') {
    // En F1 se busca «horarios GP de Singapur»: el GP es el «partido» y away es el circuito.
    const gp = d.home.replace(/^Gran Premio/, 'GP')
    return primero([`${gp}: horarios y dónde ver la carrera | F1`, `${gp}: horarios y dónde ver la carrera`, `${gp}: horarios de la F1`, gp], MAX_TITULO)
  }
  if (d.deporte === 'tenis') {
    // En tenis se busca por apellido («alcaraz vs cerundolo horario»), y el torneo
    // («alcaraz shanghai») pesa más que «el partido».
    const cruce = `${apellido(d.home)} vs ${apellido(d.away)}`
    return primero([`${cruce}: horario y dónde ver el partido${comp}`, `${cruce}: horario y TV${comp}`, `${cruce}: horario y dónde ver el partido`, `${cruce}: horario y TV`, cruce], MAX_TITULO)
  }
  // «vs»: es como más se escribe la búsqueda («barcelona vs real madrid»), sobre todo en Latinoamérica.
  const cruce = `${d.home} vs ${d.away}`
  const riv = d.deporte === 'futbol' ? rivalidadDe(d.home, d.away) : null
  const que = riv ? riv.nombre : d.deporte === 'ufc' ? 'el combate' : 'el partido'
  return primero([`${cruce}: horario y dónde ver ${que}${comp}`, `${cruce}: horario y dónde ver ${que}`, `${cruce}: horario y dónde verlo`, `${cruce}: horario y TV`, cruce], MAX_TITULO)
}

// ── Descripción ──────────────────────────────────────────────────────────────
const canalEspana = (tv: BroadcastRow[]) => {
  const es = tv.find((r) => r.countryCode === 'ES')
  return es && es.channels.length ? lista(es.channels.slice(0, 2)) : null
}

export function descripcionSeoPartido(d: DatosSeoPartido): string | null {
  const comp = d.competicion ? ` (${d.competicion})` : ''
  const g = goles(d)
  if (d.tipo === 'cronica') {
    if (!g || !d.ficha) return null
    const m = `${d.home} ${g.h}-${g.a} ${d.away}${comp}`
    const gs = goleadores(d.ficha)
    const fig = d.ficha.figura ? ` Figura: ${d.ficha.figura.jugador}.` : ''
    const cola = ' Resumen, estadísticas y clasificación.'
    const conGoles = gs.length ? `${m}: goles de ${lista(gs)}.` : `${m}.`
    // Los goleadores pesan más que la figura: es lo que se busca («quién marcó»).
    return primero([conGoles + fig + cola, conGoles + cola, conGoles + ' Resumen y estadísticas.', conGoles, `${m}.${fig}${cola}`, `${m}.${cola}`], MAX_DESCRIPCION)
  }
  if (!valido(d.iso)) return null
  const cuando = `${diaLargo(d.iso)}, ${hora(d.iso, 'Europe/Madrid')} en España y ${hora(d.iso, 'America/Mexico_City')} en México`
  const tv = canalEspana(d.tv)
  if (d.deporte === 'f1') {
    const gp = d.home.replace(/^Gran Premio/, 'GP')
    return primero([`${gp}: carrera el ${cuando}. Horarios de libres, clasificación y carrera, y cómo llega el Mundial.`, `${gp}: carrera el ${cuando}.`], MAX_DESCRIPCION)
  }
  const base = `${d.home} - ${d.away}${comp}: ${cuando}.`
  const extra = d.deporte === 'ufc' ? ' Previa con la cartelera estelar y lo que se juega.'
    : d.deporte === 'tenis' ? ' Previa con el camino de cada uno en el torneo y lo que se juega.'
    : ' Previa con la forma, el cara a cara y lo que se juega.'
  return primero([`${base}${tv ? ` Por ${tv}.` : ''}${extra}`, `${base}${tv ? ` Por ${tv}.` : ''}`, base], MAX_DESCRIPCION)
}

// ── Preguntas frecuentes ─────────────────────────────────────────────────────
const racha = (r: string[]) => {
  const n = (x: string) => r.filter((y) => y === x).length
  const partes = [[n('V'), 'victoria', 'victorias'], [n('E'), 'empate', 'empates'], [n('D'), 'derrota', 'derrotas']] as const
  return lista(partes.filter(([c]) => c > 0).map(([c, s, p]) => `${c} ${c === 1 ? s : p}`))
}

export function faqPartido(d: DatosSeoPartido): PreguntaFrecuente[] {
  const cruce = d.deporte === 'ufc' ? `combate ${d.home} vs ${d.away}` : d.deporte === 'f1' ? d.home : `${d.home} - ${d.away}`
  const f = d.ficha
  const out: PreguntaFrecuente[] = []
  const posicion = () => {
    const filas = (f?.clasificacion ?? []).filter((x) => x.destacado)
    return filas.length ? filas.map((x) => `${x.equipo} es ${x.pos}.º con ${x.pts} puntos en ${x.pj} partidos`).join('; ') + '.' : null
  }

  if (d.tipo === 'previa') {
    if (valido(d.iso)) {
      const otras = ZONAS.map(([pais, tz]) => `en ${pais}, a las ${hora(d.iso!, tz)}`)
      out.push(d.deporte === 'f1'
        ? { q: `¿A qué hora es la carrera del ${cruce}?`, a: `La carrera se corre el ${diaLargo(d.iso)} a las ${hora(d.iso, 'Europe/Madrid')} en España (hora peninsular); ${lista(otras)}. Los horarios de libres y clasificación están en la previa.` }
        : d.deporte === 'tenis'
          ? { q: `¿A qué hora es el ${cruce}?`, a: `Está previsto el ${diaLargo(d.iso)} hacia las ${hora(d.iso, 'Europe/Madrid')} en España (hora peninsular); ${lista(otras)}. En el tenis la hora es orientativa: depende de cuánto duren los partidos anteriores en la pista.` }
          : { q: `¿A qué hora es el ${cruce}?`, a: `Se juega el ${diaLargo(d.iso)} a las ${hora(d.iso, 'Europe/Madrid')} en España (hora peninsular); ${lista(otras)}.` })
    }
    const tv = d.tv.filter((r) => r.channels.length).slice(0, 7)
    if (tv.length) out.push({ q: `¿Dónde ver el ${cruce} por TV?`, a: tv.map((r) => `En ${r.country}, por ${lista(r.channels)}.`).join(' ') })
    if (f?.estadio) out.push({ q: `¿Dónde se juega el ${cruce}?`, a: `En ${f.estadio}${f.ciudad ? `, en ${f.ciudad}` : ''}.` })
    else if (d.deporte === 'f1' && d.away) out.push({ q: `¿Dónde se corre el ${cruce}?`, a: `En el circuito ${d.away}.` })
    if (f && (f.forma.home.length || f.forma.away.length)) {
      const partes = [f.forma.home.length ? `${d.home} suma ${racha(f.forma.home)} en sus últimos ${f.forma.home.length} partidos` : null,
        f.forma.away.length ? `${d.away}, ${racha(f.forma.away)} en los últimos ${f.forma.away.length}` : null].filter(Boolean)
      const pos = posicion()
      out.push({ q: `¿Cómo llegan ${d.home} y ${d.away}?`, a: `${partes.join('; ')}.${pos ? ' ' + pos : ''}` })
    }
    const ult = f?.caraACara?.[0]
    if (ult) out.push({ q: `¿Cuál fue el último ${cruce}?`, a: `El último enfrentamiento fue el ${fechaCorta(ult.fecha)}: ${ult.local} ${ult.golesLocal}-${ult.golesVisitante} ${ult.visitante}.` })
    return out
  }

  const g = goles(d)
  if (!f || !g) return out
  const cuando = valido(d.iso) ? `, el ${diaLargo(d.iso)}` : ''
  out.push({ q: `¿Cómo quedó el ${cruce}?`, a: `Terminó ${d.home} ${g.h}-${g.a} ${d.away}${d.competicion ? ` (${d.competicion})` : ''}${cuando}.` })
  const gs = goleadores(f)
  if (gs.length) out.push({ q: `¿Quién marcó los goles del ${cruce}?`, a: `${lista(gs)}.` })
  if (f.figura) {
    const x = f.figura
    const det = [x.goles ? `${x.goles} ${x.goles === 1 ? 'gol' : 'goles'}${x.penaltis ? ` (${x.penaltis} de penalti)` : ''}` : null, x.asistencias ? `${x.asistencias} ${x.asistencias === 1 ? 'asistencia' : 'asistencias'}` : null].filter(Boolean)
    out.push({ q: `¿Quién fue la figura del ${cruce}?`, a: `${x.jugador}, con ${lista(det as string[])}.` })
  }
  const rojas = f.eventos.filter((e) => e.tipo === 'roja')
  if (rojas.length) out.push({ q: `¿Hubo expulsados en el ${cruce}?`, a: `Sí: ${lista(rojas.map((e) => `${e.jugador} (${e.minuto})`))}.` })
  const pos = posicion()
  if (pos) out.push({ q: '¿Cómo queda la clasificación?', a: pos })
  return out
}

// ── schema.org ───────────────────────────────────────────────────────────────
export function sportsEventJsonLd(d: DatosSeoPartido, canonical: string, descripcion?: string | null) {
  if (!valido(d.iso)) return null
  const equipo = (name: string) => ({ '@type': 'SportsTeam', name })
  const f = d.ficha
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    '@id': `${canonical}#partido`,
    name: d.deporte === 'f1' ? d.home : `${d.home} - ${d.away}`,
    startDate: d.iso,
    ...(d.tipo === 'previa' ? { eventStatus: 'https://schema.org/EventScheduled' } : {}),
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    sport: d.deporte === 'baloncesto' ? 'Baloncesto' : d.deporte === 'ufc' ? 'Artes marciales mixtas' : d.deporte === 'f1' ? 'Fórmula 1' : d.deporte === 'tenis' ? 'Tenis' : 'Fútbol',
    ...(descripcion ? { description: descripcion } : {}),
    // En F1 no hay dos rivales: el «local» es el GP y el «visitante», el circuito.
    ...(d.deporte === 'f1'
      ? { location: { '@type': 'Place', name: d.away, address: d.away } }
      : d.deporte === 'tenis'
        ? { competitor: [{ '@type': 'Person', name: d.home }, { '@type': 'Person', name: d.away }] }
        : { homeTeam: equipo(d.home), awayTeam: equipo(d.away), competitor: [equipo(d.home), equipo(d.away)] }),
    ...(f?.estadio ? { location: { '@type': 'Place', name: f.estadio, address: f.ciudad ?? f.estadio } } : {}),
    ...(d.competicion ? { superEvent: { '@type': 'SportsEvent', name: d.competicion } } : {}),
    url: canonical,
  }
}

/** Las preguntas de la nota (si el pipeline puso alguna) después de las de datos, sin repetir. */
export function unirPreguntas(datos: PreguntaFrecuente[], editoriales: PreguntaFrecuente[] | null | undefined): PreguntaFrecuente[] {
  const clave = (q: string) => q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
  const vistas = new Set(datos.map((x) => clave(x.q)))
  return [...datos, ...(editoriales ?? []).filter((x) => x?.q && x?.a && !vistas.has(clave(x.q)))]
}
