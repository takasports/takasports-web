import type { SportEvent } from '@/lib/types'
import { getEventHighlightScore } from '@/lib/competitions'

// Previas automáticas: QUÉ partidos merecen una nota previa.
//
// Se reutiliza la misma vara que los Destacados de la portada
// (`getEventHighlightScore`: liga + cartel + rivalidad + selecciones + fase), con
// un único añadido: el interés hispano. La audiencia es mitad España, mitad
// Latinoamérica, y un Colombia–Paraguay amistoso le importa a más lectores
// nuestros que un Suiza–Eslovenia de Nations League aunque la vara general los
// ponga al revés.
//
// La nota se escribe con ANTELACIÓN: la demanda de un partido está delante, no
// detrás (ver memoria «el calendario: la demanda está delante»). El cron corre una
// vez por hora y coge lo que empieza entre 4 y 16 horas después: «no subirla mucho
// tiempo antes» (criterio del editor, 02/10/2026). Con la franja nocturna en
// silencio, casi todas llegan la misma mañana del partido: un 21:00 se encarga a
// las 05:00 y se redacta a las 08:00; un 13:00, la víspera a las 21:00.

export const VENTANA_DESDE_H = 4
export const VENTANA_HASTA_H = 16
/** Por debajo de esto no hay previa aunque el día venga flojo: mejor ninguna nota
 *  que una previa de un partido que no busca nadie. Calibrado el 02/10/2026 sobre
 *  807 partidos reales: con 11,5 entraban Polonia–Rumanía o Bélgica–Turquía (13,5
 *  por ser selecciones "de cartel", pero sin tirón para un lector hispano)… y
 *  también entran con 13. Lo que deja fuera 13 es el resto: LaLiga de mitad de
 *  tabla (11-12) y Nations League de selecciones menores (8,5). Un grande de
 *  LaLiga (11 + cartel + horario de máxima audiencia) pasa; el día flojo lo
 *  resuelve el orden, que pone delante a los hispanos y a los carteles. */
export const PUNTUACION_MINIMA = 13
export const MAX_PREVIAS_POR_DIA = 4
/** El fútbol es el grueso del tráfico: con un tope plano de 2, una noche de
 *  Champions con tres españoles dejaba fuera a uno para meter un partido de NBA. */
export const MAX_POR_DEPORTE: Record<string, number> = { futbol: 3, baloncesto: 2 }

/** Deportes con previa en esta primera versión. Son los que tienen ficha de
 *  partido completa en ESPN (clasificación, forma, cara a cara). F1, UFC y tenis
 *  llegan con otra fuente de datos. */
export const DEPORTES_CON_PREVIA: Record<string, 'futbol' | 'baloncesto'> = {
  'Fútbol': 'futbol',
  'NBA': 'baloncesto',
}

// Selecciones de países hispanohablantes, con el nombre tal y como llega del feed.
const SELECCIONES_HISPANAS = new Set([
  'españa', 'méxico', 'mexico', 'argentina', 'colombia', 'perú', 'peru', 'chile',
  'venezuela', 'ecuador', 'uruguay', 'paraguay', 'bolivia', 'costa rica', 'panamá',
  'panama', 'honduras', 'el salvador', 'guatemala', 'república dominicana',
  'republica dominicana', 'cuba', 'nicaragua', 'puerto rico',
])

export const EMPUJON_HISPANO = 2

export function interesHispano(home?: string | null, away?: string | null): number {
  const es = (n?: string | null) => !!n && SELECCIONES_HISPANAS.has(n.trim().toLowerCase())
  return (es(home) ? EMPUJON_HISPANO : 0) + (es(away) ? EMPUJON_HISPANO : 0)
}

export interface CandidataPrevia {
  ev: SportEvent
  sport: 'futbol' | 'baloncesto'
  puntuacion: number
}

export function puntuarPrevia(ev: SportEvent): number {
  return getEventHighlightScore({
    comp: ev.comp, home: ev.home, away: ev.away, stage: ev.stage, isoDate: ev.isoDate,
  }) + interesHispano(ev.home, ev.away)
}

/**
 * Partidos que PUEDEN llevar previa, de más a menos interesante, sin topes. Puro.
 * `yaHechas` son los matchRef que ya tienen previa encargada (no se repiten).
 *
 * Los topes van aparte (`cabeEnTopes`) porque antes de gastar un hueco hay que
 * mirar la ficha de ESPN de cada partido — p. ej. la pretemporada de la NBA no
 * viene marcada en el calendario y solo se sabe ahí.
 */
export function candidatasPrevia(
  events: SportEvent[],
  now: number,
  yaHechas: ReadonlySet<string> = new Set(),
): CandidataPrevia[] {
  const desde = now + VENTANA_DESDE_H * 3600_000
  const hasta = now + VENTANA_HASTA_H * 3600_000
  const vistos = new Set<string>()
  const candidatas: CandidataPrevia[] = []

  for (const ev of events) {
    const sport = DEPORTES_CON_PREVIA[ev.sport]
    if (!sport) continue
    // Sin matchRef no hay ficha de ESPN de la que sacar los datos, y sin rival no
    // hay previa de partido.
    if (!ev.matchRef || !ev.away || ev.isPast || ev.timeTbd || !ev.isoDate) continue
    if (yaHechas.has(ev.matchRef) || vistos.has(ev.matchRef)) continue
    const ts = new Date(ev.isoDate).getTime()
    if (!Number.isFinite(ts) || ts < desde || ts > hasta) continue
    vistos.add(ev.matchRef)

    const puntuacion = puntuarPrevia(ev)
    if (puntuacion < PUNTUACION_MINIMA) continue
    candidatas.push({ ev, sport, puntuacion })
  }

  return candidatas.sort((a, b) =>
    b.puntuacion - a.puntuacion ||
    new Date(a.ev.isoDate!).getTime() - new Date(b.ev.isoDate!).getTime())
}

/** ¿Cabe una previa más de este deporte? `yaHoy` = las encargadas hoy (día de
 *  Madrid), incluidas las de pasadas anteriores: el cron corre cada hora. */
export function cabeEnTopes(yaHoy: ReadonlyArray<{ sport: string }>, c: CandidataPrevia): boolean {
  if (yaHoy.length >= MAX_PREVIAS_POR_DIA) return false
  const n = yaHoy.filter((e) => e.sport === c.sport).length
  return n < (MAX_POR_DEPORTE[c.sport] ?? 2)
}

/** Selección sin mirar ESPN: candidatas en orden, recortadas por los topes. */
export function elegirPrevias(
  events: SportEvent[],
  now: number,
  yaHechas: ReadonlySet<string> = new Set(),
): CandidataPrevia[] {
  const elegidas: CandidataPrevia[] = []
  for (const c of candidatasPrevia(events, now, yaHechas)) {
    if (cabeEnTopes(elegidas, c)) elegidas.push(c)
  }
  return elegidas
}
