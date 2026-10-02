// Texto del aviso diario de juegos (cron push-reminders). Separado del route
// porque Next no deja exportar nada que no sea un handler desde route.ts.

export interface PushMessage {
  title: string
  body: string
  url: string
  tag: string
}

// Variantes por juego — rotan según el día para que el aviso no se sienta
// calcado. El tag se mantiene fijo por juego (iOS deduplica por tag y reemplaza
// la notificación previa si aún no se ha tocado).
//
// Sin prueba social inventada: «Los 10 que jugaron ayer ya están dentro» era una
// cifra fija que no salía de ningún dato.

const CRACKQUIZ_VARIANTS: Array<Omit<PushMessage, 'url' | 'tag'>> = [
  { title: 'CrackQuiz de hoy 🎯',  body: '10 preguntas, 20 s cada una. ¿Mantienes la racha?' },
  { title: 'Tu trivia diaria 🧠', body: '¿Cuánto sabes del deporte que sigues? Ponte a prueba.' },
  { title: 'Pleno o nada 🎯',     body: 'Diez disparos. Cero segundos para dudar. ¡Adentro!' },
  { title: 'Reta tu memoria 🔥',  body: 'Diez preguntas nuevas te esperan. ¿Las clavas todas?' },
]

const TAKAGRID_VARIANTS: Array<Omit<PushMessage, 'url' | 'tag'>> = [
  { title: 'TakaGrid de hoy 🟧',     body: 'Tres clubes, tres categorías. Un intento por celda.' },
  { title: 'Nuevo grid disponible',  body: 'Encaja los nueve. Tu racha depende de ello.' },
  { title: 'Conecta los nueve 🟧',   body: 'Un puzzle nuevo, nueve huecos, un solo intento.' },
]

const SOPACRACKS_VARIANTS: Array<Omit<PushMessage, 'url' | 'tag'>> = [
  { title: 'Nueva Sopa de Cracks 🔤', body: 'Diez nombres ocultos en el puzzle semanal.' },
  { title: 'Encuentra a los cracks',  body: 'Nueva sopa lista. ¿Cuántos cazas en menos de 2 min?' },
]

const MIONCE_VARIANTS: Array<Omit<PushMessage, 'url' | 'tag'>> = [
  { title: 'Nuevo reto Mi Once ⚽',  body: 'Arma tu once con el reto de esta semana.' },
  { title: 'Tu once de la semana',   body: 'Convocatoria abierta. Elige a los 11 que apuestan por ti.' },
]

const DAY_MS = 1000 * 60 * 60 * 24

function pick<T>(arr: T[], n: number): T {
  return arr[((n % arr.length) + arr.length) % arr.length]
}

/** El único aviso del día. */
export function buildDaily(seed = Date.now()): PushMessage {
  const day = Math.floor(seed / DAY_MS)
  const week = Math.floor(day / 7)
  const isMonday = new Date(seed).getUTCDay() === 1
  if (isMonday) {
    // Novedad de la semana: Sopa y Mi Once se turnan.
    return week % 2 === 0
      ? { ...pick(SOPACRACKS_VARIANTS, week), url: '/sopa-cracks', tag: 'sopacracks' }
      : { ...pick(MIONCE_VARIANTS, week),     url: '/mionce',      tag: 'mionce'     }
  }
  return day % 2 === 0
    ? { ...pick(CRACKQUIZ_VARIANTS, day), url: '/crackquiz', tag: 'crackquiz' }
    : { ...pick(TAKAGRID_VARIANTS, day),  url: '/takagrid',  tag: 'takagrid'  }
}
