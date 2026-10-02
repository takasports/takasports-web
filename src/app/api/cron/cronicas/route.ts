// GET/POST /api/cron/cronicas
//
// Encarga las crónicas de los grandes resultados: los partidos destacados (misma
// vara que las previas) que empezaron entre 2 y 8 horas antes y ya terminaron.
// Monta con la ficha de ESPN un dossier del partido acabado (resultado, goles con
// minuto y autor, marcador al descanso, tarjetas, estadísticas, clasificación ya
// actualizada) y deja un route_job para WF-08, igual que las previas. Sin IA aquí;
// la crónica se redacta solo con IA gratis y pasa por la aprobación del editor.
//
// Corre cada 30 minutos. De noche WF-08 está en silencio: lo que se encargue de
// madrugada se redacta a las 8:00.
//
// Ensayo sin escribir nada: `?dry=1` con `x-cron-secret` (y `&en=<ISO>` para
// simular otra hora).

import { NextResponse } from 'next/server'
import { checkBearerOrHeader } from '@/lib/auth-utils'
import { adminSupabase } from '@/lib/supabase-admin'
import { fetchEspnPastEvents } from '@/lib/espn'
import { candidatasCronica, MAX_CRONICAS_POR_DIA } from '@/lib/cronicas'
import { construirDossierCronica, esPretemporada, fetchSummary } from '@/lib/previas-dossier'
import { buscarFotoEstadio } from '@/lib/foto-estadio'
import { encargar, encargosRecientes } from '@/lib/produccion-propia'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function handle(req: Request) {
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  const seco = new URL(req.url).searchParams.get('dry') === '1'
  const sb = adminSupabase()
  if (!sb) return NextResponse.json({ ok: false, error: 'falta SUPABASE_SERVICE_ROLE_KEY' }, { status: 503 })
  // Solo en ensayo: `?en=<ISO>` simula otra hora para probar con partidos ya jugados.
  const en = seco ? Date.parse(new URL(req.url).searchParams.get('en') ?? '') : NaN
  const now = Number.isFinite(en) ? en : Date.now()

  let recientes: Awaited<ReturnType<typeof encargosRecientes>>
  try {
    recientes = await encargosRecientes(sb, 'cronica', 2)
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
  const yaHechas = new Set(recientes.map((e) => e.matchRef).filter((x): x is string => !!x))
  // Tope diario por día de Madrid: las de hoy ya encargadas cuentan.
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date(now))
  const deHoy = recientes.filter((e) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date(e.creado)) === hoy).length
  let hueco = Math.max(0, MAX_CRONICAS_POR_DIA - deHoy)

  const events = await fetchEspnPastEvents().catch(() => [])
  const candidatas = candidatasCronica(events, now, yaHechas)
  const encargos: Record<string, unknown>[] = []
  const descartadas: { partido: string; motivo: string }[] = []

  for (const c of candidatas) {
    if (hueco <= 0) break
    const ref = c.ev.matchRef!
    const partido = `${c.ev.home} ${c.ev.homeScore}-${c.ev.awayScore} ${c.ev.away}`
    const summary = await fetchSummary(ref)
    if (!summary) { descartadas.push({ partido, motivo: 'sin ficha de ESPN' }); continue }
    if (esPretemporada(summary, c.sport)) { descartadas.push({ partido, motivo: 'pretemporada' }); continue }
    const estado = summary?.header?.competitions?.[0]?.status?.type
    if (estado && estado.completed === false) { descartadas.push({ partido, motivo: 'aún no ha terminado' }); continue }

    const { datos, texto } = construirDossierCronica(summary, {
      matchRef: ref, sport: c.sport, home: c.ev.home, away: c.ev.away!,
      competicion: c.ev.comp, kickoffIso: c.ev.isoDate!,
    })
    datos.fotoEstadio = await buscarFotoEstadio(datos.estadio)
    hueco--
    encargos.push({ partido, puntuacion: c.puntuacion, datos, dossierChars: texto.length, dossier: seco ? texto : undefined })
    if (seco) continue
    const fallo = await encargar(sb, 'cronica', c, datos, texto)
    if (fallo) { descartadas.push({ partido, motivo: fallo }); hueco++ }
  }

  return NextResponse.json({ ok: true, seco, candidatas: candidatas.length, deHoy, encargos, descartadas })
}

export async function GET(req: Request) { return handle(req) }
export async function POST(req: Request) { return handle(req) }
