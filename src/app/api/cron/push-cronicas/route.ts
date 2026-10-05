// GET/POST /api/cron/push-cronicas — cada 15 min.
//
// Avisa al móvil (tema `calendario`) cuando se publica la crónica de un partido grande:
// «Pitido final», marcador y figura. Es la pareja de /api/cron/push-previas; reglas y
// texto en `lib/push-previas.ts`. El marcador y la figura salen del summary de ESPN del
// `matchRef` de la crónica. Lo avisado queda en system_config.push_cronicas =
// {dia, enviadas:[slug], historico:[slug]}.
//
// `?dry=1` ensaya sin enviar ni escribir, y `?en=<ISO>` simula otra hora en el ensayo.

import { NextResponse } from 'next/server'
import { checkBearerOrHeader } from '@/lib/auth-utils'
import { adminSupabase } from '@/lib/supabase-admin'
import { sanityClient } from '@/lib/sanity'
import { sendPushToTopic, audienciaDeTema } from '@/lib/push-topic'
import { fetchSummary, parseMatchRef } from '@/lib/previas-dossier'
import { fichaVisual } from '@/lib/partido-visual'
import { FINAL_HASTA_MIN, MAX_FINALES_DIA, PUNTUACION_MINIMA_AVISO, puntuarFinal, textoFinal, urlAviso, type PartidoAcabado } from '@/lib/push-previas'
import { diaMadrid } from '@/lib/produccion-propia'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const ACTIVO = true
const TEMA = 'calendario'
const SITE = 'https://www.takasportsmedia.com'

async function partido(slug: string, matchRef: string): Promise<PartidoAcabado | null> {
  const ref = parseMatchRef(matchRef)
  const summary = ref ? await fetchSummary(matchRef) : null
  const f = summary ? fichaVisual(summary) : null
  if (!ref || !f || !f.terminado || f.home.goles == null || f.away.goles == null) return null
  const comp = summary?.header?.competitions?.[0]
  return {
    slug,
    eventId: ref.event,
    home: f.home.nombre,
    away: f.away.nombre,
    golesHome: f.home.goles,
    golesAway: f.away.goles,
    competicion: String(summary?.header?.league?.name ?? ''),
    iso: String(comp?.date ?? ''),
    figura: f.figura && f.figura.goles > 0 ? f.figura.jugador : null,
  }
}

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

  const desde = new Date(now - FINAL_HASTA_MIN * 60000).toISOString()
  const hasta = new Date(now).toISOString()
  const cronicas = await sanityClient.fetch<Array<{ slug: string; matchRef: string }>>(
    `*[_type == "article" && type == "cronica" && defined(slug.current) && defined(matchRef) && publishedAt >= $desde && publishedAt <= $hasta]{
      "slug": slug.current, matchRef
    }`,
    { desde, hasta },
  ).catch(() => [] as Array<{ slug: string; matchRef: string }>)

  const { data: fila } = await sb.from('system_config').select('value').eq('key', 'push_cronicas').maybeSingle()
  let estado: { dia?: string; enviadas?: string[]; historico?: string[] } = {}
  try { estado = typeof fila?.value === 'string' ? JSON.parse(fila.value) : (fila?.value ?? {}) } catch { estado = {} }
  const hoy = diaMadrid(now)
  const enviadasHoy = estado.dia === hoy ? (estado.enviadas ?? []) : []
  const todas = new Set([...(estado.historico ?? []), ...(estado.enviadas ?? [])])
  const huecos = Math.max(0, MAX_FINALES_DIA - enviadasHoy.length)

  const nuevas = cronicas.filter((c) => !todas.has(c.slug))
  const partidos = huecos ? (await Promise.all(nuevas.map((c) => partido(c.slug, c.matchRef)))).filter((p): p is PartidoAcabado => !!p) : []
  const elegidos = partidos
    .map((p) => ({ p, s: puntuarFinal(p) }))
    .filter((x) => x.s >= PUNTUACION_MINIMA_AVISO)
    .sort((a, b) => b.s - a.s)
    .slice(0, huecos)
    .map((x) => x.p)

  const avisos = elegidos.map((p) => ({ slug: p.slug, eventId: p.eventId, ...textoFinal(p), url: urlAviso(SITE, p.slug, 'cronica') }))
  if (seco || avisos.length === 0) {
    return NextResponse.json({ ok: true, seco, activo: ACTIVO, candidatas: cronicas.length, evaluadas: partidos.length, enviadasHoy: enviadasHoy.length, avisos, audiencia: await audienciaDeTema(TEMA) })
  }

  const resultados = []
  for (const a of avisos) {
    resultados.push({ slug: a.slug, r: await sendPushToTopic(TEMA, { title: a.title, body: a.body, url: a.url, tag: 'equipo-final-' + a.eventId }) })
  }
  await sb.from('system_config').upsert({
    key: 'push_cronicas',
    value: JSON.stringify({ dia: hoy, enviadas: [...enviadasHoy, ...avisos.map((a) => a.slug)], historico: [...(estado.historico ?? []), ...avisos.map((a) => a.slug)].slice(-100) }),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' })
  return NextResponse.json({ ok: true, enviados: resultados })
}

export async function GET(req: Request) { return handle(req) }
export async function POST(req: Request) { return handle(req) }
