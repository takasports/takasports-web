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
// tiempo antes» (criterio del editor, 02/10/2026; desde el 05/10 los grandes, la
// víspera: ver VENTANA_ANTICIPADA_HASTA_H). Con la franja nocturna en
// silencio, casi todas llegan la misma mañana del partido: un 21:00 se encarga a
// las 05:00 y se redacta a las 08:00; un 13:00, la víspera a las 21:00.

export const VENTANA_DESDE_H = 4
export const VENTANA_HASTA_H = 16
/** PREVIAS A LA VÍSPERA (05/10/2026, decisión del editor). Una previa sale en Google
 *  ~10 veces más que una noticia, pero la gente busca el horario de un partido grande
 *  con días de antelación y la nota llegaba la misma mañana. Los partidos de fútbol de
 *  más cartel (14,5: Real Madrid-Villarreal, Liverpool-City, Croacia-España…) se
 *  encargan hasta 40 h antes, así que salen la víspera; el resto sigue en 4-16 h. */
export const VENTANA_ANTICIPADA_HASTA_H = 40
export const PUNTUACION_ANTICIPADA = 14.5
/** Por debajo de esto no hay previa aunque el día venga flojo: mejor ninguna nota
 *  que una previa de un partido que no busca nadie. Calibrado el 02/10/2026 sobre
 *  807 partidos reales: con 11,5 entraban Polonia–Rumanía o Bélgica–Turquía (13,5
 *  por ser selecciones "de cartel", pero sin tirón para un lector hispano)… y
 *  también entran con 13. Lo que deja fuera 13 es el resto: LaLiga de mitad de
 *  tabla (11-12) y Nations League de selecciones menores (8,5). Un grande de
 *  LaLiga (11 + cartel + horario de máxima audiencia) pasa; el día flojo lo
 *  resuelve el orden, que pone delante a los hispanos y a los carteles. */
export const PUNTUACION_MINIMA = 13
/** Topes por DÍA DEL PARTIDO (Madrid), no por día de encargo: con las previas a la
 *  víspera, un sábado se encarga en parte el viernes. Subidos el 05/10/2026 (4→5,
 *  fútbol 3→4; días grandes 7→8 y 5→6; Latinoamérica 2→3) porque las previas son lo que
 *  más sale en Google. */
export const MAX_PREVIAS_POR_DIA = 5
/** El fútbol es el grueso del tráfico: con un tope plano de 2, una noche de
 *  Champions con tres españoles dejaba fuera a uno para meter un partido de NBA. */
export const MAX_POR_DEPORTE: Record<string, number> = { futbol: 4, baloncesto: 2 }
/** Fines de semana y días de Champions (05/10/2026, decisión del editor): es cuando se
 *  juega casi todo lo que se busca y 4 previas se quedaban cortas. */
export const MAX_PREVIAS_DIA_GRANDE = 8
export const MAX_FUTBOL_DIA_GRANDE = 6

/** CARRIL LATINOAMERICANO (05/10/2026). Latinoamérica es la mitad de las impresiones en
 *  Google, pero con la puntuación general su mejor partido sacaba 7 (Liga MX) o 4,5
 *  (Argentina) y nunca llegaba al mínimo de 13: cero previas latinoamericanas. Va en un
 *  carril aparte, con su mínimo, su empujón a los grandes y su cupo diario, que no
 *  quita sitio a las europeas. Se reconoce por la liga del matchRef de ESPN. */
export const LIGAS_LATAM = new Set([
  'mex.1', 'arg.1', 'bra.1', 'col.1', 'chi.1', 'conmebol.libertadores', 'conmebol.sudamericana',
])
export const PUNTUACION_MINIMA_LATAM = 9
/** Ajustes por liga dentro del carril. Argentina parte de 4 en la puntuación general
 *  (no está en la tabla de ligas) frente al 7 de Liga MX: sin esto, ni un Boca entraba.
 *  El Brasileirão se lee en portugués: para el lector hispano solo vale un cartel de
 *  dos grandes, así que su mínimo es el general. */
const EXTRA_LIGA_LATAM: Record<string, number> = { 'arg.1': 3 }
const MINIMO_LIGA_LATAM: Record<string, number> = { 'bra.1': PUNTUACION_MINIMA }
export const MAX_LATAM_POR_DIA = 3
export const EMPUJON_GRANDE_LATAM = 3
const GRANDES_LATAM = [
  'américa', 'guadalajara', 'chivas', 'cruz azul', 'pumas', 'tigres', 'monterrey', 'toluca',
  'boca juniors', 'river plate', 'racing club', 'independiente', 'san lorenzo', 'estudiantes de la plata', 'vélez',
  'flamengo', 'palmeiras', 'corinthians', 'são paulo', 'fluminense', 'atlético-mg', 'grêmio', 'internacional',
  'atlético nacional', 'millonarios', 'américa de cali', 'colo-colo', 'universidad de chile', 'universidad católica',
]
const norm = (s?: string | null) => (s ?? '').trim().toLowerCase()
// «Independiente» no debe sumar a «Independiente Rivadavia», ni «Santos» de Brasil al
// «Santos» de México por accidente de nombre: se exige el nombre exacto o que empiece por
// el del grande seguido de nada más que un espacio y un sufijo de ciudad conocido.
export function esGrandeLatam(n?: string | null): boolean {
  const x = norm(n)
  return GRANDES_LATAM.some((g) => x === g || (x.startsWith(g + ' ') && !/rivadavia|laguna/.test(x)))
}
export function ligaDe(matchRef?: string | null): string | null {
  const m = /^soccer_(.+)_\d+$/.exec(matchRef ?? '')
  return m ? m[1] : null
}
export const esLatam = (matchRef?: string | null) => LIGAS_LATAM.has(ligaDe(matchRef) ?? '')

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
  latam?: boolean
}

export function puntuarPrevia(ev: SportEvent): number {
  return getEventHighlightScore({
    comp: ev.comp, home: ev.home, away: ev.away, stage: ev.stage, isoDate: ev.isoDate,
  }) + interesHispano(ev.home, ev.away)
}

/** Puntuación con el carril latinoamericano y el mínimo que le toca. La comparten
 *  previas y crónicas (06/10/2026: «crónicas y previas de los destacados»). */
export function puntuarConCarril(ev: SportEvent): { puntuacion: number; latam: boolean; minimo: number } {
  const latam = esLatam(ev.matchRef)
  const liga = ligaDe(ev.matchRef) ?? ''
  const puntuacion = puntuarPrevia(ev) + (latam
    ? (EXTRA_LIGA_LATAM[liga] ?? 0) + (esGrandeLatam(ev.home) ? EMPUJON_GRANDE_LATAM : 0) + (esGrandeLatam(ev.away) ? EMPUJON_GRANDE_LATAM : 0)
    : 0)
  return { puntuacion, latam, minimo: latam ? (MINIMO_LIGA_LATAM[liga] ?? PUNTUACION_MINIMA_LATAM) : PUNTUACION_MINIMA }
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
  const hastaAnticipada = now + VENTANA_ANTICIPADA_HASTA_H * 3600_000
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
    if (!Number.isFinite(ts) || ts < desde || ts > hastaAnticipada) continue

    const { puntuacion, latam, minimo } = puntuarConCarril(ev)
    if (puntuacion < minimo) continue
    // Más allá de las 16 h solo el fútbol de más cartel (la víspera).
    if (ts > hasta && !(sport === 'futbol' && puntuacion >= PUNTUACION_ANTICIPADA)) continue
    vistos.add(ev.matchRef)
    candidatas.push({ ev, sport, puntuacion, ...(latam ? { latam: true } : {}) })
  }

  return candidatas.sort((a, b) =>
    b.puntuacion - a.puntuacion ||
    new Date(a.ev.isoDate!).getTime() - new Date(b.ev.isoDate!).getTime())
}

/** ¿Cabe una previa más? `yaHoy` = las ya encargadas para partidos del MISMO día (de
 *  Madrid) que esta, incluidas las de pasadas anteriores: el cron corre cada hora. Las latinoamericanas van en su propio
 *  cupo y no cuentan para el de Europa/NBA. `diaGrande` = fin de semana o día de
 *  Champions. */
export function cabeEnTopes(
  yaHoy: ReadonlyArray<{ sport: string; latam?: boolean }>,
  c: CandidataPrevia,
  diaGrande = false,
): boolean {
  if (c.latam) return yaHoy.filter((e) => e.latam).length < MAX_LATAM_POR_DIA
  const resto = yaHoy.filter((e) => !e.latam)
  if (resto.length >= (diaGrande ? MAX_PREVIAS_DIA_GRANDE : MAX_PREVIAS_POR_DIA)) return false
  const n = resto.filter((e) => e.sport === c.sport).length
  const tope = c.sport === 'futbol' && diaGrande ? MAX_FUTBOL_DIA_GRANDE : (MAX_POR_DEPORTE[c.sport] ?? 2)
  return n < tope
}

/** Fin de semana (en Madrid) o un día con partidos de la Champions masculina (la
 *  etiqueta exacta 'Champions': la femenina, la asiática o la de Concacaf no cuentan).
 *  Puro. */
export function esDiaGrande(events: SportEvent[], now: number): boolean {
  const dia = (t: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date(t))
  const sem = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', weekday: 'short' }).format(new Date(now))
  if (sem === 'Sat' || sem === 'Sun') return true
  const hoy = dia(now)
  return events.some((e) => e.comp === 'Champions' && !!e.isoDate && dia(Date.parse(e.isoDate)) === hoy)
}

/** Día de Madrid (AAAA-MM-DD) de un partido: los topes van por él. */
export const diaDelPartido = (iso: string | number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date(iso))

/** Selección sin mirar ESPN: candidatas en orden, recortadas por los topes de su día. */
export function elegirPrevias(
  events: SportEvent[],
  now: number,
  yaHechas: ReadonlySet<string> = new Set(),
): CandidataPrevia[] {
  const elegidas: CandidataPrevia[] = []
  for (const c of candidatasPrevia(events, now, yaHechas)) {
    const dia = diaDelPartido(c.ev.isoDate!)
    const delDia = elegidas.filter((e) => diaDelPartido(e.ev.isoDate!) === dia)
    if (cabeEnTopes(delDia, c, esDiaGrande(events, Date.parse(c.ev.isoDate!)))) elegidas.push(c)
  }
  return elegidas
}
