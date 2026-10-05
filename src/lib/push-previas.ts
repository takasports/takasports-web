// Aviso al móvil antes de los partidos grandes con previa publicada (05/10/2026).
//
// Una previa responde a lo que se busca antes del partido (horario y dónde verlo) y
// un aviso horas antes es lo que más devuelve gente a la web. Reglas: solo partidos
// con previa YA PUBLICADA, entre 1 h y 3 h 30 min antes, como mucho 2 avisos al día
// (los partidos de más cartel) y nunca dos veces el mismo. Va al tema `calendario`
// (avisos de partidos) por `sendPushToTopic`: navegador y app, con o sin cuenta.
// Todo lo de aquí es puro salvo lo que se importa en la ruta.

import { getEventHighlightScore } from '@/lib/competitions'
import { interesHispano } from '@/lib/previas'

export const AVISO_DESDE_MIN = 60
export const AVISO_HASTA_MIN = 210
export const MAX_AVISOS_DIA = 2
/** Solo carteles de verdad: un grande de LaLiga o Champions, un clásico latinoamericano. */
export const PUNTUACION_MINIMA_AVISO = 13

export interface PreviaPublicada {
  slug: string
  home: string
  away: string
  iso: string
  competicion?: string | null
}

export function puntuarAviso(p: PreviaPublicada): number {
  return getEventHighlightScore({ comp: p.competicion ?? '', home: p.home, away: p.away, isoDate: p.iso }) + interesHispano(p.home, p.away)
}

/** Las previas que tocan ahora, de más a menos cartel, sin las ya avisadas. */
export function previasParaAvisar(previas: PreviaPublicada[], now: number, yaAvisadas: ReadonlySet<string>): PreviaPublicada[] {
  return previas
    .filter((p) => {
      const t = Date.parse(p.iso)
      const min = (t - now) / 60000
      return Number.isFinite(t) && min >= AVISO_DESDE_MIN && min <= AVISO_HASTA_MIN && !yaAvisadas.has(p.slug)
    })
    .map((p) => ({ p, s: puntuarAviso(p) }))
    .filter((x) => x.s >= PUNTUACION_MINIMA_AVISO)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.p)
}

const hora = (iso: string, tz: string) =>
  new Intl.DateTimeFormat('es-ES', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\./g, '').trim()

// Tono «con carácter» (elegido por el editor el 05/10/2026): frase de grada en el
// titular y los dos equipos cara a cara en el cuerpo. Las grandes rivalidades llevan
// frase propia; las expresiones van ancladas (^…$) para no confundir Racing Club con
// Racing Bulls ni Independiente con Independiente del Valle.
interface Rivalidad { a: RegExp; b: RegExp; titulo: string; cuerpo: string }
const RIVALIDADES: Rivalidad[] = [
  { a: /^(fc )?barcelona$|^barca$/, b: /^real madrid$/, titulo: 'Se viene el Clásico', cuerpo: 'Barça y Madrid, cara a cara' },
  { a: /^real madrid$/, b: /^atletico( de)? madrid$/, titulo: 'Madrid se parte en dos', cuerpo: 'Real Madrid y Atlético, derbi en la capital' },
  { a: /^sevilla( fc)?$/, b: /^(real )?betis$/, titulo: 'Sevilla se parte en dos', cuerpo: 'Sevilla y Betis, el gran derbi' },
  { a: /^athletic( club| bilbao)?$/, b: /^real sociedad$/, titulo: 'Derbi vasco a la vista', cuerpo: 'Athletic y Real Sociedad, frente a frente' },
  { a: /^boca( juniors)?$/, b: /^river( plate)?$/, titulo: 'Se para el país: Superclásico', cuerpo: 'Boca y River, cara a cara' },
  { a: /^racing( club)?$/, b: /^independiente$/, titulo: 'Avellaneda se tiñe de dos colores', cuerpo: 'Racing e Independiente, frente a frente' },
  { a: /^(club )?america$/, b: /^(cd |chivas de )?guadalajara$|^chivas$/, titulo: 'Llega el Clásico Nacional', cuerpo: 'América y Chivas, cara a cara' },
  { a: /^tigres( uanl)?$/, b: /^(cf )?monterrey$|^rayados$/, titulo: 'Monterrey se parte en dos', cuerpo: 'Tigres y Rayados, el Clásico Regio' },
  { a: /^flamengo$/, b: /^fluminense$/, titulo: 'Llega el Fla-Flu', cuerpo: 'Flamengo y Fluminense, cara a cara' },
  { a: /^colo[ -]colo$/, b: /^universidad de chile$|^u de chile$/, titulo: 'Chile se paraliza: Superclásico', cuerpo: 'Colo-Colo y la U, cara a cara' },
  { a: /^manchester (united|utd)$/, b: /^manchester city$/, titulo: 'Mánchester se parte en dos', cuerpo: 'United y City, el derbi' },
  { a: /^arsenal$/, b: /^tottenham( hotspur)?$/, titulo: 'Derbi del norte de Londres', cuerpo: 'Arsenal y Tottenham, frente a frente' },
  { a: /^inter( milan| de milan)?$/, b: /^(ac )?milan$/, titulo: 'Milán se parte en dos', cuerpo: 'Inter y Milan, el Derbi della Madonnina' },
  { a: /^bayern( munich| de munich)?$/, b: /^borussia dortmund$|^dortmund$/, titulo: 'Llega Der Klassiker', cuerpo: 'Bayern y Dortmund, cara a cara' },
  { a: /^argentina$/, b: /^brasil$/, titulo: 'Argentina-Brasil, palabras mayores', cuerpo: 'La Albiceleste y la Canarinha, cara a cara' },
]

const TITULOS = ['Hoy hay partidazo', 'Esto no te lo puedes perder', 'Cita marcada en rojo', 'Ve calentando, que hoy se juega', 'Que ruede el balón']
const TITULOS_CHAMPIONS = ['Suena el himno de la Champions 🎶', 'Noche de Champions 🌙']
const TITULOS_COPA = ['Huele a Libertadores 🏆', 'Noche de Copa 🏆']

/** Siempre la misma frase para la misma previa (las pruebas y un reintento no la cambian),
 *  pero distinta de un partido a otro para que no suene a robot. */
function turno<T>(lista: T[], semilla: string): T {
  let h = 0
  for (const c of semilla) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return lista[h % lista.length]
}

/** Texto del aviso. La notificación no sabe el país de quien la recibe, así que lleva
 *  la hora de España y la de México (los dos públicos grandes) y la previa trae el
 *  resto de países. */
export function textoAviso(p: PreviaPublicada): { title: string; body: string } {
  const h = norm(p.home), a = norm(p.away)
  const comp = norm(p.competicion ?? '')
  const balon = /euroliga|euroleague|\bacb\b|\bnba\b|basket|baloncesto/.test(comp) ? '🏀' : '⚽'
  const horas = `a las ${hora(p.iso, 'Europe/Madrid')} 🇪🇸 · ${hora(p.iso, 'America/Mexico_City')} 🇲🇽`
  const cola = 'Lo que se juega y dónde verlo, en la previa.'
  const riv = RIVALIDADES.find((r) => (r.a.test(h) && r.b.test(a)) || (r.a.test(a) && r.b.test(h)))
  if (riv && balon === '⚽') return { title: `${riv.titulo} ${balon}`, body: `${riv.cuerpo} ${horas}. ${cola}` }
  const title = /champions/.test(comp) ? turno(TITULOS_CHAMPIONS, p.slug)
    : /libertadores|sudamericana/.test(comp) ? turno(TITULOS_COPA, p.slug)
    : `${turno(TITULOS, p.slug)} ${balon}`
  return { title, body: `${p.home} y ${p.away}, cara a cara ${horas}. ${cola}` }
}
