// GET/POST /api/cron/tenis — cada hora.
//
// Previas y crónicas de los partidos de tenis importantes (lib/tenis.ts): Alcaraz,
// finales grandes, semifinales de Grand Slam e hispanos en rondas altas.
//   · previa: cuando ya hay orden de juego (hora fija), entre 30 h y 1 h antes;
//   · crónica: cuando ESPN da el partido por terminado, hasta 18 h después del inicio.
// Tope de 4 previas y 4 crónicas de tenis por día de Madrid, primero lo más importante.
// Deja el encargo en route_jobs para WF-08, igual que UFC y F1: sin IA aquí, redacción
// con IA gratis y nada se publica sin el editor.
//
// Ensayo sin escribir nada: `?dry=1` con `x-cron-secret` (y `&en=<ISO>` para otra hora).

import { NextResponse } from 'next/server'
import { checkBearerOrHeader } from '@/lib/auth-utils'
import { adminSupabase } from '@/lib/supabase-admin'
import { diaMadrid, encargar, encargosRecientes } from '@/lib/produccion-propia'
import { construirDossierTenis, esPartidoImportante, fetchPartidosTenis, refTenis } from '@/lib/tenis'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const PREVIA_DESDE_MIN = 60
const PREVIA_HASTA_H = 30
const CRONICA_HASTA_H = 18
const TOPE_DIA = 4

const ymd = (t: number) => new Date(t).toISOString().slice(0, 10).replace(/-/g, '')

async function handle(req: Request) {
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  const url = new URL(req.url)
  const seco = url.searchParams.get('dry') === '1'
  const en = seco ? Date.parse(url.searchParams.get('en') ?? '') : NaN
  const now = Number.isFinite(en) ? en : Date.now()
  const sb = adminSupabase()
  if (!sb) return NextResponse.json({ ok: false, error: 'falta SUPABASE_SERVICE_ROLE_KEY' }, { status: 503 })

  let previas: Awaited<ReturnType<typeof encargosRecientes>>, cronicas: Awaited<ReturnType<typeof encargosRecientes>>
  try {
    ;[previas, cronicas] = await Promise.all([encargosRecientes(sb, 'previa', 3), encargosRecientes(sb, 'cronica', 3)])
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
  const hechas = { previa: new Set(previas.map((e) => e.matchRef)), cronica: new Set(cronicas.map((e) => e.matchRef)) }
  const hoy = diaMadrid(now)
  const usados = {
    previa: previas.filter((e) => /^tennis_/.test(e.matchRef ?? '') && diaMadrid(e.creado) === hoy).length,
    cronica: cronicas.filter((e) => /^tennis_/.test(e.matchRef ?? '') && diaMadrid(e.creado) === hoy).length,
  }

  const partidos = await fetchPartidosTenis([-1, 0, 1].map((d) => ymd(now + d * 86400000)))
  const candidatos = partidos
    .map((p) => {
      const imp = esPartidoImportante(p)
      const min = (Date.parse(p.iso) - now) / 60000
      const tipo: 'previa' | 'cronica' | null =
        p.estado === 'pre' && p.horaFija && min >= PREVIA_DESDE_MIN && min <= PREVIA_HASTA_H * 60 ? 'previa'
        : p.estado === 'post' && !p.walkover && (p.a.ganador || p.b.ganador) && -min >= 0 && -min <= CRONICA_HASTA_H * 60 ? 'cronica'
        : null
      return { p, imp, tipo }
    })
    .filter((x) => x.imp.si && x.tipo && !hechas[x.tipo].has(refTenis(x.p)))
    .sort((x, y) => y.imp.prioridad - x.imp.prioridad || Date.parse(x.p.iso) - Date.parse(y.p.iso))

  const encargos: Record<string, unknown>[] = []
  const descartados: { partido: string; motivo: string }[] = []
  for (const { p, imp, tipo } of candidatos) {
    const nombre = `${p.a.nombre} - ${p.b.nombre} (${p.torneo.corto}, ${p.ronda})`
    if (usados[tipo!] >= TOPE_DIA) { descartados.push({ partido: nombre, motivo: `tope de ${TOPE_DIA} ${tipo}s de tenis hoy` }); continue }
    const { datos, texto } = construirDossierTenis(p, tipo!, partidos)
    encargos.push({ partido: nombre, tipo, motivo: imp.motivo, dossierChars: texto.length, dossier: seco ? texto : undefined })
    usados[tipo!]++
    if (seco) continue
    const g = p.a.ganador ? p.a : p.b.ganador ? p.b : null
    const cand = { ev: { home: p.a.nombre, away: p.b.nombre, comp: p.torneo.largo, matchRef: refTenis(p), homeScore: null, awayScore: null }, sport: 'tenis', puntuacion: imp.prioridad / 1.2 }
    const fallo = await encargar(sb, tipo!, cand, datos, texto, {
      personas: [p.a.nombre, p.b.nombre],
      titulo: `${tipo === 'previa' ? 'Previa' : 'Crónica'}: ${p.a.nombre} - ${p.b.nombre}`,
      resumen: tipo === 'previa'
        ? `${p.torneo.largo}, ${p.ronda}: ${p.a.nombre} contra ${p.b.nombre}.`
        : `${p.torneo.largo}, ${p.ronda}: ${g ? `ganó ${g.nombre}` : 'resultado'} (${p.a.nombre} contra ${p.b.nombre}).`,
    })
    if (fallo) descartados.push({ partido: nombre, motivo: fallo })
  }
  return NextResponse.json({ ok: true, seco, partidos: partidos.length, encargos, descartados })
}

export async function GET(req: Request) { return handle(req) }
export async function POST(req: Request) { return handle(req) }
