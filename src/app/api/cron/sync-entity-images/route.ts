// POST/GET /api/cron/sync-entity-images
//
// 1. Siembra sport_entities con los jugadores que la web YA muestra (líderes de ESPN).
// 2. Resuelve la foto de un lote de entidades que todavía no la tienen.
//
// Va por lotes a propósito: la cascada hace varias peticiones por jugador (HEAD a ESPN,
// búsqueda en Wikidata, Commons) y no queremos ni una función serverless colgada ni
// martillear a Wikimedia. El cron se llama a menudo y avanza poco a poco; los 'missing'
// se persisten, así que nunca se reintenta al mismo jugador sin foto.
//
// Se invoca desde un cron EXTERNO (n8n / GitHub Actions / cron-job.org): el plan Hobby
// de Vercel solo permite un cron al día.
//
// Auth: header `x-cron-secret` o `Authorization: Bearer <CRON_SECRET>`.

import { NextResponse } from 'next/server'
import { checkBearerOrHeader } from '@/lib/auth-utils'
import { getPlayersData } from '@/app/api/stats/players/route'
import { refreshEntityImage } from '@/lib/entity-images'
import {
  listEntitiesNeedingImage,
  sportEntitiesConfigured,
  upsertSportEntities,
  type SeedEntity,
} from '@/lib/sport-entities'

export const dynamic = 'force-dynamic'

/**
 * Tamaño de lote por pasada. Medido: 20 jugadores + la siembra tardan ~31 s en local, y
 * vercel.json capa las rutas API a maxDuration 60 s. Con arranque en frío eso queda
 * demasiado justo, así que 12 deja margen de sobra (~25 s). Para rellenar los ~450
 * sembrados hacen falta unas 38 pasadas; el cron va solo.
 */
const BATCH = 12

/**
 * Pausa entre jugadores. Sin ella encadenamos ~70 peticiones a Wikimedia en segundos y
 * nos limitan por ratio: medido, eso marcaba como 'missing' a media tabla de cracks que
 * sí tienen foto. Ir despacio sale gratis — el cron corre en segundo plano.
 */
const WIKI_COURTESY_MS = 300

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function seedFromEspnLeaders(): Promise<number> {
  const data = await getPlayersData()
  const leaders = [
    ...data.leagues.flatMap(league => [...league.goals, ...league.assists]),
    ...Object.values(data.combined).flat(),
  ]
  // Un jugador sale en varias listas (goleador + asistente + combinadas). Deduplico
  // quedándome con la entrada más rica: las categorías combinadas vienen SIN equipo, así
  // que prefiero la que trae club para no perder ese dato.
  const byId = new Map<string, SeedEntity>()
  for (const leader of leaders) {
    if (!leader.playerId) continue
    const cand: SeedEntity = {
      type: 'player',
      sport: 'football',
      name: leader.name,
      espnId: leader.playerId,
      leagueSlug: leader.leagueSlug ?? null,
      club: leader.team || null,
    }
    const existing = byId.get(leader.playerId)
    if (!existing || (!existing.club && cand.club)) byId.set(leader.playerId, cand)
  }
  return upsertSportEntities([...byId.values()])
}

async function handle(req: Request) {
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  if (!sportEntitiesConfigured()) {
    return NextResponse.json({ ok: false, error: 'supabase_not_configured' }, { status: 503 })
  }

  const seeded = await seedFromEspnLeaders()
  const pending = await listEntitiesNeedingImage('player', BATCH)

  // Secuencial a propósito: en paralelo dispararíamos 80 peticiones a Wikimedia de golpe.
  const bySource: Record<string, number> = {}
  for (const [index, entity] of pending.entries()) {
    if (index > 0) await sleep(WIKI_COURTESY_MS)
    const outcome = await refreshEntityImage(entity, 'headshot')
    const key = outcome.status === 'ok' ? outcome.image.source : outcome.status
    bySource[key] = (bySource[key] ?? 0) + 1
  }

  // 'error' no se persiste: esas entidades vuelven a salir en la próxima pasada.
  return NextResponse.json({
    ok: true,
    seeded,
    checked: pending.length,
    bySource,
  })
}

export async function GET(req: Request) {
  return handle(req)
}
export async function POST(req: Request) {
  return handle(req)
}
