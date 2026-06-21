// GET/POST /api/cron/sync-ufc
// Sincroniza fights de UFC desde ESPN → ranked_events (sport='ufc').
//
// Requiere header `x-cron-secret` o `Authorization: Bearer <CRON_SECRET>`.
// Llama close_started_ranked_events() para cerrar fights ya empezados.
//
// ESPN slug: mma/ufc
// La API devuelve eventos PPV (UFC 305, Fight Night, etc.) y cada evento
// tiene `competitions[]` — una por cada fight del card.
//
// Reglas UF1:
//   · sport='ufc'
//   · fighter_a / fighter_b en lugar de team_home/team_away
//   · featured = main event (último fight del PPV o flag en notes)
//   · result = { winner: 'a'|'b', method: 'KO'|'SUB'|'DEC' }
//   · Lock = 30 min antes del fight (gestionado server-side al insertar
//     predicciones — el cron solo controla status open/closed/resolved)

import { NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'
import { checkBearerOrHeader } from '@/lib/auth-utils'

export const dynamic = 'force-dynamic'
// Tope anti-runaway: si algo se cuelga, Vercel corta a los 60s en vez de dejar
// correr la función hasta el límite por defecto del plan (300s) = menos GB-horas.
export const maxDuration = 60

interface EspnCompetitor {
  id?:      string  // = athleteId → foto: a.espncdn.com/i/headshots/mma/players/full/{id}.png
  homeAway: string
  athlete?: {
    displayName?: string
    shortName?:   string
    flag?:        { href?: string }
    accolades?:   { name?: string; type?: string }[]
  }
  team?:    { displayName?: string }
  score?:   string | { value: number }
  winner?:  boolean
  order?:   number  // Posición en el card (1 = main event)
  records?: { summary?: string }[]
}

interface EspnStatusType {
  name:    string
  detail:  string
  state:   string
}

interface EspnCompetition {
  id?:         string
  date:        string
  competitors: EspnCompetitor[]
  status:      { type: EspnStatusType }
  venue?:      { fullName?: string; address?: { city?: string } }
  format?:     { regulation?: { periods?: number } }
  notes?:      { type: string; headline: string }[]
}

interface EspnEvent {
  id:           string
  date:         string
  name:         string
  shortName?:   string
  competitions: EspnCompetition[]
}

async function fetchUfcEvents(): Promise<EspnEvent[]> {
  // Próximos 90 días + últimos 7 (para resolver fights recién pasados).
  const now = new Date()
  const start = new Date(now); start.setDate(now.getDate() - 7)
  const end   = new Date(now); end.setDate(now.getDate() + 90)
  const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '')
  const url = `https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard?dates=${fmt(start)}-${fmt(end)}&limit=100`
  try {
    // Timeout de 10s: si ESPN se cuelga, abortamos en vez de quedarnos colgados
    // (mismo cinturón que ya tiene sync-mundial). El catch de abajo degrada a [].
    const res = await fetch(url, { next: { revalidate: 0 }, signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return []
    const json = await res.json() as { events?: EspnEvent[] }
    return json.events ?? []
  } catch {
    return []
  }
}

const FINAL_STATUSES = new Set([
  'STATUS_FINAL', 'STATUS_FULL_TIME', 'STATUS_FT', 'STATUS_ENDED',
  'STATUS_TBD',  // ESPN a veces deja TBD en fights anuladas
])

/**
 * Extrae el método de victoria del detail del status ESPN.
 * Detail típicos: "KO/TKO 1st round 4:12", "Submission - Rear-Naked Choke",
 *                 "Decision - Unanimous", "Draw"
 */
function parseMethod(detail: string | null | undefined): 'KO' | 'SUB' | 'DEC' | null {
  if (!detail) return null
  const d = detail.toLowerCase()
  if (d.includes('ko') || d.includes('tko') || d.includes('knockout')) return 'KO'
  if (d.includes('submission') || d.includes('sub') || d.includes('tap')) return 'SUB'
  if (d.includes('decision') || d.includes('dec')) return 'DEC'
  return null
}

function toUfcWinner(
  fighterA: EspnCompetitor | undefined,
  fighterB: EspnCompetitor | undefined,
): 'a' | 'b' | null {
  if (fighterA?.winner === true) return 'a'
  if (fighterB?.winner === true) return 'b'
  return null
}

/**
 * ESPN usa "TBA" / "Opponent TBA" / "TBD" para combates aún sin rival
 * confirmado (veladas lejanas con el cartel a medio cerrar). No los guardamos:
 * no se puede predecir un combate sin luchadores.
 */
function isPlaceholderFighter(name: string): boolean {
  return /\b(tba|tbd)\b/i.test(name) || /to be announced/i.test(name)
}

/**
 * Datos del luchador para el banner cara-a-cara del evento (Fase 1).
 * competitor.id es el athleteId → la foto se arma en el cliente.
 */
function fighterMeta(c: EspnCompetitor | undefined) {
  return {
    id:     c?.id ?? null,
    flag:   c?.athlete?.flag?.href ?? null,
    belt:   c?.athlete?.accolades?.find(a => a?.type === 'Belt')?.name ?? null,
    record: c?.records?.find(r => r?.summary)?.summary ?? null,
  }
}

async function handle(req: Request) {
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  if (!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    return NextResponse.json({ ok: false, error: 'supabase_not_configured' }, { status: 503 })
  }

  const ppvEvents = await fetchUfcEvents()
  if (ppvEvents.length === 0) {
    return NextResponse.json({ ok: true, fetched: 0, upserted: 0, note: 'ESPN returned no UFC events' })
  }

  const admin = adminSupabase()
  if (!admin) return NextResponse.json({ ok: false, error: 'admin_client_unavailable' }, { status: 503 })

  let upserted = 0
  let scored   = 0

  // Cerrar fights iniciados (vía admin: la función ya no es ejecutable por anon/auth).
  try { await admin.rpc('close_started_ranked_events') } catch { /* */ }

  // Pre-fetch IDs ya resueltos.
  const { data: resolvedRows } = await admin
    .from('ranked_events')
    .select('id')
    .eq('sport', 'ufc')
    .eq('status', 'resolved')
  const resolvedIds = new Set((resolvedRows ?? []).map((r: { id: string }) => r.id))

  for (const ppv of ppvEvents) {
    // Nombre COMPLETO de la velada (p.ej. "UFC Fight Night: Kape vs. Horiguchi").
    // Antes se usaba shortName ("UFC Fight Night"), idéntico para TODAS las
    // veladas Fight Night → la UI las fusionaba en un único bloque gigante.
    const ppvName = ppv.name ?? ppv.shortName ?? 'UFC'
    const fights = ppv.competitions ?? []

    // ESPN devuelve las competitions en orden de cartel inverso: preliminares
    // primero y combate estelar al FINAL. competitor.order es solo la esquina
    // (1/2) dentro del combate, NO la posición en el cartel — por eso la
    // detección anterior marcaba todos como featured. El estelar real es el
    // último combate del array.
    const lastIdx = fights.length - 1

    for (let idx = 0; idx < fights.length; idx++) {
      const fight = fights[idx]
      const competitors = fight.competitors ?? []
      const fighterA = competitors[0]
      const fighterB = competitors[1]
      if (!fighterA || !fighterB) continue

      const nameA = fighterA.athlete?.displayName ?? fighterA.team?.displayName ?? ''
      const nameB = fighterB.athlete?.displayName ?? fighterB.team?.displayName ?? ''
      if (!nameA || !nameB) continue
      // Combates aún sin rival cerrado: no se pueden predecir, los saltamos.
      if (isPlaceholderFighter(nameA) || isPlaceholderFighter(nameB)) continue

      const statusName = fight.status?.type?.name ?? ''
      const statusState = fight.status?.type?.state ?? ''
      const isResolved = FINAL_STATUSES.has(statusName) || statusState === 'post'
      const isClosed   = statusState === 'in'

      const winner = isResolved ? toUfcWinner(fighterA, fighterB) : null
      const method = isResolved ? parseMethod(fight.status?.type?.detail) : null

      const fightId = `ufc-espn-${fight.id ?? ppv.id + '-' + nameA.slice(0, 8) + '-' + nameB.slice(0, 8)}`

      if (resolvedIds.has(fightId) && !isResolved) continue

      const status = isResolved && winner != null ? 'resolved' : isClosed ? 'closed' : 'open'
      const result = isResolved && winner != null
        ? { winner, method }
        : null

      const row = {
        id:          fightId,
        sport:       'ufc',
        competition: ppvName,
        event_date:  fight.date,
        fighter_a:   nameA,
        fighter_b:   nameB,
        // Mantenemos team_home/team_away en NULL para UFC — el código de UI
        // debe leer fighter_a/fighter_b cuando sport='ufc'.
        team_home:   null,
        team_away:   null,
        featured:    idx === lastIdx,   // estelar = último combate del cartel
        status,
        result,
        meta: {
          venue:         fight.venue?.fullName ?? null,
          city:          fight.venue?.address?.city ?? null,
          espn_id:       fight.id ?? null,
          ppv_id:        ppv.id,
          // Posición en el cartel: 1 = estelar, 2 = coestelar … (mayor = preliminar).
          card_position: fights.length - idx,
          card_total:    fights.length,
          // Datos para el banner cara-a-cara (foto/bandera/cinturón/récord).
          fighters: { a: fighterMeta(fighterA), b: fighterMeta(fighterB) },
        },
      }

      const { error } = await admin.from('ranked_events').upsert(row, {
        onConflict: 'id',
        ignoreDuplicates: false,
      })
      if (error) continue

      upserted++

      // Auto-scoring si está resuelto.
      if (isResolved && winner !== null) {
        try {
          await admin.rpc('score_ufc_prediction', {
            p_event_id: fightId,
            p_winner:   winner,
            p_method:   method ?? null,
          })
          scored++
        } catch { /* scoring fallo no rompe el cron */ }
      }
    }
  }

  return NextResponse.json({ ok: true, fetched: ppvEvents.length, upserted, scored })
}

export async function GET(req: Request)  { return handle(req) }
export async function POST(req: Request) { return handle(req) }
