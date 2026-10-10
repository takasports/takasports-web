// GET/POST /api/cron/f1 — cada hora.
//
// Previa y crónica de cada Gran Premio de F1 (lib/f1.ts), con datos de Jolpica. Previa
// en la semana del GP (desde 60 h antes de los libres 1 hasta 4 h antes de la carrera) y
// crónica de la carrera en cuanto Jolpica publica el resultado y el Mundial actualizado
// (hasta 24 h después). Deja el encargo para WF-08 como las previas de partidos: sin IA
// aquí y nada se publica sin el editor.
//
// Ensayo sin escribir nada: `?dry=1` con `x-cron-secret` (y `&en=<ISO>` para otra hora).

import { NextResponse } from 'next/server'
import { checkBearerOrHeader } from '@/lib/auth-utils'
import { adminSupabase } from '@/lib/supabase-admin'
import { encargar, encargosRecientes } from '@/lib/produccion-propia'
import { construirDossierGpCronica, construirDossierGpPrevia, fetchJolpica, gpDesdeJolpica, piloto, refGp, type Gp } from '@/lib/f1'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const PREVIA_ANTES_LIBRES_H = 60
const PREVIA_HASTA_CARRERA_H = 4
const CRONICA_HASTA_H = 24

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lista = (d: any, tabla: string, clave: string) => d?.MRData?.[tabla]?.[clave] ?? []

async function mundiales() {
  const [p, e] = await Promise.all([fetchJolpica('current/driverstandings/'), fetchJolpica('current/constructorstandings/')])
  const lp = lista(p, 'StandingsTable', 'StandingsLists')[0]
  const le = lista(e, 'StandingsTable', 'StandingsLists')[0]
  return { ronda: Number(lp?.round) || 0, pilotos: lp?.DriverStandings ?? [], equipos: le?.ConstructorStandings ?? [] }
}

const candidata = (g: Gp) => ({ ev: { home: g.nombre, away: g.circuito, comp: 'Fórmula 1', matchRef: refGp(g), homeScore: null, awayScore: null }, sport: 'formula1', puntuacion: 14 })

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
    ;[previas, cronicas] = await Promise.all([encargosRecientes(sb, 'previa', 7), encargosRecientes(sb, 'cronica', 3)])
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
  const encargos: Record<string, unknown>[] = []
  const notas: string[] = []

  // Previa del próximo GP.
  const prox = gpDesdeJolpica(lista(await fetchJolpica('current/next/'), 'RaceTable', 'Races')[0])
  if (prox) {
    const libres = Date.parse(prox.sesiones[0]?.iso ?? prox.carreraIso)
    const carrera = Date.parse(prox.carreraIso)
    const ref = refGp(prox)
    if (now < libres - PREVIA_ANTES_LIBRES_H * 3600000) notas.push(`previa de ${prox.nombre}: aún pronto`)
    else if (now > carrera - PREVIA_HASTA_CARRERA_H * 3600000) notas.push(`previa de ${prox.nombre}: ya tarde`)
    else if (previas.some((p) => p.matchRef === ref)) notas.push(`previa de ${prox.nombre}: ya encargada`)
    else {
      const m = await mundiales()
      const { datos, texto } = construirDossierGpPrevia(prox, m.pilotos, m.equipos)
      encargos.push({ gp: prox.nombre, tipo: 'previa', dossier: seco ? texto : undefined, dossierChars: texto.length })
      if (!seco) {
        // Con el líder del Mundial como protagonista, la foto de la tarjeta es la de un piloto
        // y no un gráfico genérico del GP (10/10/2026: rechazado en la previa de Singapur).
        const lider = m.pilotos[0]?.Driver ? piloto(m.pilotos[0].Driver) : null
        const fallo = await encargar(sb, 'previa', candidata(prox), datos, texto, { titulo: `Previa: ${prox.nombre} ${prox.temporada}`, resumen: `${prox.nombre}, ronda ${prox.ronda} del Mundial de F1, en ${prox.circuito}.`, ...(lider ? { personas: [lider] } : {}) })
        if (fallo) notas.push(`previa: ${fallo}`)
      }
    }
  }

  // Crónica del último GP.
  const ult = lista(await fetchJolpica('current/last/results/'), 'RaceTable', 'Races')[0]
  const g = gpDesdeJolpica(ult)
  if (g && Array.isArray(ult?.Results) && ult.Results.length) {
    const ref = refGp(g)
    const hace = (now - Date.parse(g.carreraIso)) / 3600000
    if (hace < 0 || hace > CRONICA_HASTA_H) notas.push(`crónica de ${g.nombre}: fuera de plazo`)
    else if (cronicas.some((c) => c.matchRef === ref)) notas.push(`crónica de ${g.nombre}: ya encargada`)
    else {
      const m = await mundiales()
      if (m.ronda !== g.ronda) notas.push(`crónica de ${g.nombre}: el Mundial aún no está actualizado`)
      else {
        const { datos, texto } = construirDossierGpCronica(g, ult.Results, m.pilotos, m.equipos)
        encargos.push({ gp: g.nombre, tipo: 'cronica', dossier: seco ? texto : undefined, dossierChars: texto.length })
        if (!seco) {
          const fallo = await encargar(sb, 'cronica', candidata(g), datos, texto, { titulo: `Crónica: ${g.nombre} ${g.temporada}`, resumen: `${g.nombre}: gana ${String(datos.ganador ?? '?')}.`, ...(datos.ganador ? { personas: [String(datos.ganador)] } : {}) })
          if (fallo) notas.push(`crónica: ${fallo}`)
        }
      }
    }
  }
  return NextResponse.json({ ok: true, seco, encargos, notas })
}

export async function GET(req: Request) { return handle(req) }
export async function POST(req: Request) { return handle(req) }
