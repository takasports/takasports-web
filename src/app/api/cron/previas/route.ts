// GET/POST /api/cron/previas
//
// Encarga las previas del día: elige los partidos destacados que empiezan entre 12
// y 36 horas después (`lib/previas.ts`), monta su dossier de datos verificados con
// la ficha de ESPN (`lib/previas-dossier.ts`) y deja un trabajo en `route_jobs`
// para el redactor de taka-system (WF-08). Aquí no se escribe ni una línea de la
// nota y no se llama a ninguna IA: este cron solo decide QUÉ partido y con QUÉ
// datos. La redacción, la foto y la aprobación en Telegram siguen el mismo camino
// que una noticia aprobada por el editor, y nada se publica sin su visto bueno.
//
// El trabajo nace con `step_status=pending`, que es como queda una noticia cuando
// el editor pulsa «Web». Si el pipeline está en pausa o en la franja nocturna,
// WF-08 no lo toca hasta que vuelva: las previas esperan en la cola, no se pierden.
//
// Auth idéntica al resto de crons: `x-cron-secret` o `Authorization: Bearer`.
// Ensayo sin escribir nada:
//   curl -H "x-cron-secret: $CRON_SECRET" 'https://.../api/cron/previas?dry=1'

import { NextResponse } from 'next/server'
import { checkBearerOrHeader } from '@/lib/auth-utils'
import { adminSupabase } from '@/lib/supabase-admin'
import { fetchEspnEvents } from '@/lib/espn'
import { candidatasPrevia, cabeEnTopes, type CandidataPrevia } from '@/lib/previas'
import { construirDossier, esPretemporada, fetchSummary } from '@/lib/previas-dossier'
import { getBroadcastRows, matchCompetition } from '@/lib/broadcast'
import { buscarFotoEstadio } from '@/lib/foto-estadio'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SITE = 'https://www.takasportsmedia.com'

async function handle(req: Request) {
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  const seco = new URL(req.url).searchParams.get('dry') === '1'
  const sb = adminSupabase()
  if (!sb) return NextResponse.json({ ok: false, error: 'falta SUPABASE_SERVICE_ROLE_KEY' }, { status: 503 })

  const now = Date.now()

  // Previas ya encargadas en los últimos días: no se repiten aunque el cron corra
  // dos veces o el partido siga dentro de la ventana mañana.
  const { data: previas, error: errPrevias } = await sb
    .from('route_jobs')
    .select('input_json')
    .eq('input_json->>kind', 'previa')
    .gte('created_at', new Date(now - 4 * 86400_000).toISOString())
  if (errPrevias) return NextResponse.json({ ok: false, error: errPrevias.message }, { status: 500 })
  const yaHechas = new Set<string>(
    (previas ?? []).map((r) => (r.input_json as { matchRef?: string } | null)?.matchRef).filter((x): x is string => !!x),
  )

  const events = await fetchEspnEvents().catch(() => [])
  const candidatas = candidatasPrevia(events, now, yaHechas)

  const elegidas: CandidataPrevia[] = []
  const descartadas: { partido: string; motivo: string }[] = []
  const encargos: Record<string, unknown>[] = []

  for (const c of candidatas) {
    if (!cabeEnTopes(elegidas, c)) continue
    const ref = c.ev.matchRef!
    const partido = `${c.ev.home} - ${c.ev.away}`
    const summary = await fetchSummary(ref)
    if (!summary) { descartadas.push({ partido, motivo: 'sin ficha de ESPN' }); continue }
    if (esPretemporada(summary, c.sport)) { descartadas.push({ partido, motivo: 'pretemporada' }); continue }

    // Canales: los mismos derechos verificados que pinta el bloque «Dónde verlo».
    const claveTv = matchCompetition(summary?.header?.league?.name, c.ev.comp)
    const tv = claveTv ? await getBroadcastRows(claveTv).catch(() => []) : []
    const { datos, texto } = construirDossier(summary, {
      matchRef: ref, sport: c.sport, home: c.ev.home, away: c.ev.away!,
      competicion: c.ev.comp, kickoffIso: c.ev.isoDate!,
    }, tv)
    // Fondo por defecto de la placa (la versión con foto es la que prefiere el editor).
    datos.fotoEstadio = await buscarFotoEstadio(datos.estadio)
    elegidas.push(c)
    encargos.push({ partido, puntuacion: c.puntuacion, datos, dossierChars: texto.length, dossier: seco ? texto : undefined })
    if (seco) continue

    // El content_item es solo el soporte que WF-08 espera encontrar: nace ya
    // "aprobado", puntuado y avisado para que ningún otro workflow (enriquecimiento,
    // scoring, avisos, limpieza) lo coja como si fuera una noticia de RSS.
    const titulo = `Previa: ${c.ev.home} - ${c.ev.away}`
    const ahora = new Date().toISOString()
    const { data: ci, error: errCi } = await sb.from('content_items').insert({
      canonical_title: titulo,
      original_title: titulo,
      summary: `${c.ev.comp}. ${c.ev.home} recibe a ${c.ev.away}.`,
      original_url: `${SITE}/partido/${ref}#previa`,
      sport: c.sport,
      language: 'es',
      status: 'approved',
      priority: 'high',
      confidence_level: 'high',
      source_count: 1,
      source_list_json: [],
      enriched_at: ahora,
      score: Math.min(100, Math.round(c.puntuacion * 5)),
      alert_type: 'previa',
      notified_at: ahora,
      entities_json: {
        teams: [c.ev.home, c.ev.away],
        players: [],
        competition: c.ev.comp,
        event_type: 'previa',
        title_es: titulo,
        summary_es: `${c.ev.comp}. ${c.ev.home} recibe a ${c.ev.away}.`,
        sport_relevance: 10,
      },
    }).select('id').single()
    if (errCi || !ci) { descartadas.push({ partido, motivo: 'content_item: ' + (errCi?.message ?? '?') }); elegidas.pop(); continue }

    const { error: errJob } = await sb.from('route_jobs').insert({
      content_item_id: ci.id,
      route: 'web',
      step: 'article',
      step_status: 'pending',
      status: 'pending',
      input_json: { kind: 'previa', matchRef: ref, puntuacion: c.puntuacion, datos, dossier: texto, origen: 'cron-previas' },
    })
    if (errJob) { descartadas.push({ partido, motivo: 'route_job: ' + errJob.message }); elegidas.pop(); continue }

    await sb.from('decision_log').insert({
      content_item_id: ci.id,
      action: 'previa_encargada',
      actor: 'system:cron-previas',
      routes_selected: ['web'],
      metadata_json: { matchRef: ref, puntuacion: c.puntuacion },
    })
  }

  return NextResponse.json({
    ok: true,
    seco,
    candidatas: candidatas.length,
    yaEncargadas: yaHechas.size,
    encargos,
    descartadas,
  })
}

export async function GET(req: Request) { return handle(req) }
export async function POST(req: Request) { return handle(req) }
