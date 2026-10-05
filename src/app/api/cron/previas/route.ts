// GET/POST /api/cron/previas
//
// Encarga las previas: cada hora, elige los partidos destacados que empiezan entre 4
// y 16 horas después (`lib/previas.ts`), monta su dossier de datos verificados con
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
import { candidatasPrevia, cabeEnTopes, esDiaGrande, esLatam, type CandidataPrevia } from '@/lib/previas'
import { construirDossier, esPretemporada, fetchSummary } from '@/lib/previas-dossier'
import { getBroadcastRows, matchCompetition } from '@/lib/broadcast'
import { buscarFotoEstadio } from '@/lib/foto-estadio'
import { diaMadrid, encargar, encargosRecientes } from '@/lib/produccion-propia'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function handle(req: Request) {
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  const seco = new URL(req.url).searchParams.get('dry') === '1'
  const sb = adminSupabase()
  if (!sb) return NextResponse.json({ ok: false, error: 'falta SUPABASE_SERVICE_ROLE_KEY' }, { status: 503 })

  // Solo en ensayo: `?en=<ISO>` simula otra hora.
  const en = seco ? Date.parse(new URL(req.url).searchParams.get('en') ?? '') : NaN
  const now = Number.isFinite(en) ? en : Date.now()

  // Previas ya encargadas en los últimos días: no se repiten aunque el cron corra
  // dos veces o el partido siga dentro de la ventana mañana.
  let recientes: Awaited<ReturnType<typeof encargosRecientes>>
  try {
    recientes = await encargosRecientes(sb, 'previa', 4)
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
  const yaHechas = new Set(recientes.map((e) => e.matchRef).filter((x): x is string => !!x))
  // El cron corre cada hora: el tope diario cuenta también lo encargado en pasadas anteriores de hoy.
  const hoy = diaMadrid(now)
  const yaHoy: Array<{ sport: string; latam?: boolean }> = recientes.filter((e) => diaMadrid(e.creado) === hoy).map((e) => ({ sport: e.sport, latam: esLatam(e.matchRef) }))

  const events = await fetchEspnEvents().catch(() => [])
  const candidatas = candidatasPrevia(events, now, yaHechas)
  const diaGrande = esDiaGrande(events, now)

  const elegidas: CandidataPrevia[] = []
  const descartadas: { partido: string; motivo: string }[] = []
  const encargos: Record<string, unknown>[] = []

  for (const c of candidatas) {
    if (!cabeEnTopes(yaHoy, c, diaGrande)) continue
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
    yaHoy.push({ sport: c.sport, latam: c.latam })
    encargos.push({ partido, puntuacion: c.puntuacion, datos, dossierChars: texto.length, dossier: seco ? texto : undefined })
    if (seco) continue

    const fallo = await encargar(sb, 'previa', c, datos, texto)
    if (fallo) { descartadas.push({ partido, motivo: fallo }); elegidas.pop(); yaHoy.pop(); continue }
  }

  return NextResponse.json({
    ok: true,
    seco,
    candidatas: candidatas.length,
    yaEncargadas: yaHechas.size,
    deHoy: yaHoy.length,
    diaGrande,
    encargos,
    descartadas,
  })
}

export async function GET(req: Request) { return handle(req) }
export async function POST(req: Request) { return handle(req) }
