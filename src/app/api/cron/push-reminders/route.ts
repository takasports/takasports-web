// Cron de avisos de juegos. Vercel lo dispara según vercel.json:
//   ?kind=daily   → 09:00 UTC todos los días
//   ?kind=weekly  → 08:00 UTC los lunes
//
// Reusa /api/push/send (que ya valida PUSH_BROADCAST_SECRET y maneja VAPID).
// Auth del cron: Vercel manda Authorization: Bearer <CRON_SECRET>; aceptamos
// también ?secret= para pruebas manuales.

import { NextRequest, NextResponse } from 'next/server'
import { checkBearerOrHeader } from '@/lib/auth-utils'

interface PushMessage {
  title: string
  body: string
  url: string
  tag: string
}

// Variantes por juego — rotan según el día del mes para que el aviso diario
// no se sienta calcado. El tag se mantiene fijo por juego (iOS deduplica por
// tag y reemplaza la notificación previa si aún no se ha tocado).

const CRACKQUIZ_VARIANTS: Array<Omit<PushMessage, 'url' | 'tag'>> = [
  { title: 'CrackQuiz de hoy 🎯',  body: '10 preguntas, 20 s cada una. ¿Mantienes la racha?' },
  { title: 'Tu trivia diaria 🧠', body: '¿Cuánto sabes del deporte que sigues? Ponte a prueba.' },
  { title: 'Pleno o nada 🎯',     body: 'Diez disparos. Cero segundos para dudar. ¡Adentro!' },
  { title: 'Reta tu memoria 🔥',  body: 'Los 10 que jugaron ayer ya están dentro. ¿Y tú?' },
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

function pickByDate<T>(arr: T[], seed = Date.now()): T {
  const day = Math.floor(seed / (1000 * 60 * 60 * 24))
  return arr[day % arr.length]
}

function buildDaily(): PushMessage[] {
  const seed = Date.now()
  return [
    { ...pickByDate(CRACKQUIZ_VARIANTS, seed), url: '/crackquiz', tag: 'crackquiz' },
    { ...pickByDate(TAKAGRID_VARIANTS, seed),  url: '/takagrid',  tag: 'takagrid'  },
  ]
}

function buildWeekly(): PushMessage[] {
  const seed = Date.now()
  return [
    { ...pickByDate(SOPACRACKS_VARIANTS, seed), url: '/sopa-cracks', tag: 'sopacracks' },
    { ...pickByDate(MIONCE_VARIANTS, seed),     url: '/mionce',      tag: 'mionce'     },
  ]
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const broadcastSecret = process.env.PUSH_BROADCAST_SECRET

  // CRON_SECRET es obligatorio: si no está seteado, el endpoint queda cerrado.
  // Aceptamos `Authorization: Bearer <CRON_SECRET>` (formato Vercel) o el
  // header `x-cron-secret`. El antiguo `?secret=` queda eliminado (filtra en
  // logs y referer).
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (!broadcastSecret) {
    return NextResponse.json({ error: 'PUSH_BROADCAST_SECRET not set' }, { status: 503 })
  }

  const kind = url.searchParams.get('kind') ?? 'daily'
  const messages: PushMessage[] =
    kind === 'weekly' ? buildWeekly() :
    kind === 'daily'  ? buildDaily()  :
    []

  if (messages.length === 0) {
    return NextResponse.json({ error: `unknown kind=${kind}` }, { status: 400 })
  }

  const results: Array<{ tag: string; sent?: number; pruned?: number; error?: string }> = []
  for (const m of messages) {
    try {
      const res = await fetch(new URL('/api/push/send', url.origin), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-push-secret': broadcastSecret,
        },
        body: JSON.stringify({ ...m, topic: 'games' }),
      })
      const j = await res.json() as { sent?: number; pruned?: number; error?: string }
      results.push({ tag: m.tag, sent: j.sent, pruned: j.pruned, error: j.error })
    } catch (e) {
      results.push({ tag: m.tag, error: e instanceof Error ? e.message : String(e) })
    }
  }

  return NextResponse.json({ kind, results })
}
