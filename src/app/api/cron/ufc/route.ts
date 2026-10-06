// GET/POST /api/cron/ufc — cada hora.
//
// Previas y crónicas de las veladas importantes de UFC (lib/ufc.ts): previa entre 40 y
// 4 horas antes de la cartelera estelar (la víspera), y crónica cuando ESPN da por
// terminada toda la cartelera estelar (hasta 14 h después). Una de cada por velada.
// Deja el encargo en route_jobs para WF-08, igual que las previas y crónicas de
// partidos: sin IA aquí, redacción con IA gratis y nada se publica sin el editor.
//
// Ensayo sin escribir nada: `?dry=1` con `x-cron-secret` (y `&en=<ISO>` para otra hora).

import { NextResponse } from 'next/server'
import { checkBearerOrHeader } from '@/lib/auth-utils'
import { adminSupabase } from '@/lib/supabase-admin'
import { encargar, encargosRecientes } from '@/lib/produccion-propia'
import { construirDossierVelada, esVeladaImportante, fetchMetodo, fetchVeladas } from '@/lib/ufc'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const PREVIA_DESDE_H = 4
const PREVIA_HASTA_H = 40
const CRONICA_HASTA_H = 14

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
    ;[previas, cronicas] = await Promise.all([encargosRecientes(sb, 'previa', 5), encargosRecientes(sb, 'cronica', 3)])
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
  const hechas = { previa: new Set(previas.map((e) => e.matchRef)), cronica: new Set(cronicas.map((e) => e.matchRef)) }

  const veladas = await fetchVeladas([-1, 0, 1, 2].map((d) => ymd(now + d * 86400000)))
  const encargos: Record<string, unknown>[] = []
  const descartadas: { velada: string; motivo: string }[] = []

  for (const v of veladas) {
    const imp = esVeladaImportante(v)
    if (!imp.si) { descartadas.push({ velada: v.nombre, motivo: imp.motivo }); continue }
    const ref = `mma_ufc_${v.id}`
    const minutos = (Date.parse(v.iso) - now) / 60000
    const tipo: 'previa' | 'cronica' | null =
      !v.terminada && minutos >= PREVIA_DESDE_H * 60 && minutos <= PREVIA_HASTA_H * 60 ? 'previa'
      : v.terminada && -minutos <= CRONICA_HASTA_H * 60 ? 'cronica'
      : null
    if (!tipo) continue
    if (hechas[tipo].has(ref)) continue
    if (tipo === 'cronica') {
      for (const c of v.estelar) if (c.terminado) c.metodo = await fetchMetodo(v.id, c.id)
    }
    const { datos, texto } = construirDossierVelada(v, tipo)
    const main = v.estelar[0]
    const cand = { ev: { home: main.a.nombre, away: main.b.nombre, comp: 'UFC', matchRef: ref, homeScore: null, awayScore: null }, sport: 'ufc', puntuacion: v.numerado ? 15 : 13 }
    const titulo = `${tipo === 'previa' ? 'Previa' : 'Crónica'}: ${v.nombre}`
    encargos.push({ velada: v.nombre, tipo, motivo: imp.motivo, dossierChars: texto.length, dossier: seco ? texto : undefined })
    if (seco) continue
    const fallo = await encargar(sb, tipo, cand, datos, texto, {
      personas: [main.a.nombre, main.b.nombre], titulo,
      resumen: `${v.nombre}: ${main.a.nombre} contra ${main.b.nombre} (${main.peso}${main.tituloEnJuego ? ', título en juego' : ''}).`,
    })
    if (fallo) descartadas.push({ velada: v.nombre, motivo: fallo })
  }
  return NextResponse.json({ ok: true, seco, veladas: veladas.length, encargos, descartadas })
}

export async function GET(req: Request) { return handle(req) }
export async function POST(req: Request) { return handle(req) }
