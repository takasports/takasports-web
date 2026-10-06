// GET/POST /api/cron/push-previas — cada 30 min.
//
// Avisa al móvil (tema `calendario`) de los partidos grandes con previa publicada que
// empiezan en 1 h - 3 h 30 min. Reglas y texto en `lib/push-previas.ts`. Lo avisado se
// guarda en system_config.push_previas = {dia, enviadas:[slug]} para no repetir y para
// contar el tope diario.
//
// Encendido el 05/10/2026 con el tono «con carácter» que eligió el editor. Con `ACTIVO`
// a false la ruta solo responde lo que mandaría y no envía nada. `?dry=1` fuerza el ensayo aunque esté activo, y
// `?en=<ISO>` simula otra hora en el ensayo.

import { NextResponse } from 'next/server'
import { checkBearerOrHeader } from '@/lib/auth-utils'
import { adminSupabase } from '@/lib/supabase-admin'
import { sanityClient } from '@/lib/sanity'
import { sendPushToTopic, audienciaDeTema } from '@/lib/push-topic'
import { MAX_AVISOS_DIA, previasParaAvisar, textoAviso, urlAviso, type PreviaPublicada } from '@/lib/push-previas'
import { diaMadrid } from '@/lib/produccion-propia'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const ACTIVO = true
const TEMA = 'calendario'
const SITE = 'https://www.takasportsmedia.com'

async function handle(req: Request) {
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  const url = new URL(req.url)
  const seco = !ACTIVO || url.searchParams.get('dry') === '1'
  const en = seco ? Date.parse(url.searchParams.get('en') ?? '') : NaN
  const now = Number.isFinite(en) ? en : Date.now()
  const sb = adminSupabase()
  if (!sb) return NextResponse.json({ ok: false, error: 'no_supabase' }, { status: 503 })

  const desde = new Date(now).toISOString()
  const hasta = new Date(now + 4 * 3600000).toISOString()
  const previas = await sanityClient.fetch<PreviaPublicada[]>(
    `*[_type == "article" && type == "previa" && defined(slug.current) && defined(matchKickoff.iso) && matchKickoff.iso >= $desde && matchKickoff.iso <= $hasta]{
      "slug": slug.current, "home": matchKickoff.home, "away": matchKickoff.away, "iso": matchKickoff.iso, "competicion": matchKickoff.competition, matchRef
    }`,
    { desde, hasta },
  ).catch(() => [] as PreviaPublicada[])

  const { data: fila } = await sb.from('system_config').select('value').eq('key', 'push_previas').maybeSingle()
  let estado: { dia?: string; enviadas?: string[]; historico?: string[] } = {}
  try { estado = typeof fila?.value === 'string' ? JSON.parse(fila.value) : (fila?.value ?? {}) } catch { estado = {} }
  const hoy = diaMadrid(now)
  const enviadasHoy = estado.dia === hoy ? (estado.enviadas ?? []) : []
  const todas = new Set([...(estado.historico ?? []), ...(estado.enviadas ?? [])])
  const huecos = Math.max(0, MAX_AVISOS_DIA - enviadasHoy.length)
  // Los GP de F1 no son «X y Y, cara a cara» (el «visitante» es el circuito): fuera.
  const elegidas = previasParaAvisar(previas.filter((p) => p.home && p.away && !/^racing_/.test((p as { matchRef?: string }).matchRef ?? '')), now, todas).slice(0, huecos)

  const avisos = elegidas.map((p) => ({ slug: p.slug, ...textoAviso(p), url: urlAviso(SITE, p.slug, 'previa') }))
  if (seco || avisos.length === 0) {
    return NextResponse.json({ ok: true, seco, activo: ACTIVO, candidatas: previas.length, enviadasHoy: enviadasHoy.length, avisos, audiencia: await audienciaDeTema(TEMA) })
  }

  const resultados = []
  for (const a of avisos) {
    resultados.push({ slug: a.slug, r: await sendPushToTopic(TEMA, { title: a.title, body: a.body, url: a.url, tag: 'previa-' + a.slug }) })
  }
  const nuevas = [...enviadasHoy, ...avisos.map((a) => a.slug)]
  await sb.from('system_config').upsert({
    key: 'push_previas',
    value: JSON.stringify({ dia: hoy, enviadas: nuevas, historico: [...(estado.historico ?? []), ...avisos.map((a) => a.slug)].slice(-100) }),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' })
  return NextResponse.json({ ok: true, enviados: resultados })
}

export async function GET(req: Request) { return handle(req) }
export async function POST(req: Request) { return handle(req) }
