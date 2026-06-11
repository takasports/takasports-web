// /api/cron/stat-snapshots
// Cron orquestador de scrapers para bloques sin API gratuita en vivo.
// Cada scraper devuelve {rows, source, asOf} | null. Si null se omite el upsert.
//
// Auth: header `x-cron-secret` o `Authorization: Bearer <CRON_SECRET>`.
// El antiguo `?secret=` queda eliminado (filtra en logs/referer).
// Selección de scraper: ?sport=motogp (default: 'all' = todos los configurados).
//
// Vercel Cron lo invoca semanalmente (ver vercel.json).
// Llamada manual:
//   curl -H "x-cron-secret: XXX" "https://takasportsmedia.com/api/cron/stat-snapshots?sport=motogp"

import { NextResponse } from 'next/server'
import { upsertSnapshot, type UpsertResult } from '@/lib/stat-snapshots'
import { fetchMotogpRiders, fetchMotogpConstructors, type ScrapeResult } from '@/lib/motogp-scraper'
import { fetchUfcP4P, fetchUfcChampions, makeDivisionFetcher, UFC_DIVISIONS } from '@/lib/ufc-scraper'
import { fetchEloWorldRanking } from '@/lib/elo-scraper'
import { checkBearerOrHeader } from '@/lib/auth-utils'
import { sendTelegram } from '@/lib/telegram'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface ScraperJob {
  blockId: string
  fetcher: () => Promise<ScrapeResult | null>
}

const JOBS_BY_SPORT: Record<string, ScraperJob[]> = {
  motogp: [
    { blockId: 'motogp-pilotos',       fetcher: fetchMotogpRiders },
    { blockId: 'motogp-constructores', fetcher: fetchMotogpConstructors },
  ],
  ufc: [
    { blockId: 'ufc-p4p',       fetcher: fetchUfcP4P },
    { blockId: 'ufc-campeones', fetcher: fetchUfcChampions },
    // 11 divisiones (8 masc + 3 fem). Comparten 1 sola fetch HTML
    // gracias al cache de 60s en getRankings().
    ...UFC_DIVISIONS.map(div => ({
      blockId: div.blockId,
      fetcher: makeDivisionFetcher(div),
    })),
  ],
  // 'fifa' = ranking mundial selecciones (Elo, ya que la FIFA bloquea su API).
  // Bloque mantiene id legacy 'ranking-fifa' por estabilidad de URLs/favoritos.
  fifa: [
    { blockId: 'ranking-fifa', fetcher: fetchEloWorldRanking },
  ],
}

const ALL_JOBS: ScraperJob[] = Object.values(JOBS_BY_SPORT).flat()

async function runJob(job: ScraperJob): Promise<UpsertResult> {
  const result = await job.fetcher()
  if (!result || result.rows.length === 0) {
    return { ok: false, blockId: job.blockId, rows: 0, error: 'scrape_failed_or_empty' }
  }
  // Guarda con UN reintento: cubre fallos transitorios de la BD (el caso real de
  // ufc-w-flw, que quedó 10 días viejo mientras el resto del run sí se guardó).
  let res = await upsertSnapshot(job.blockId, result.rows, result.source, result.asOf)
  if (!res.ok) res = await upsertSnapshot(job.blockId, result.rows, result.source, result.asOf)
  return res
}

async function handle(req: Request) {
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  const url = new URL(req.url)
  const sport = (url.searchParams.get('sport') ?? 'all').toLowerCase()
  const jobs = sport === 'all' ? ALL_JOBS : (JOBS_BY_SPORT[sport] ?? [])
  if (jobs.length === 0) {
    return NextResponse.json({ ok: false, error: 'unknown_sport', sport, available: Object.keys(JOBS_BY_SPORT) }, { status: 400 })
  }

  const results = await Promise.all(jobs.map(runJob))
  const ok = results.every(r => r.ok)

  // Aviso si algún bloque no se actualizó: el dato anterior se mantiene (no se
  // borra), pero conviene enterarse el mismo día para reintentar a mano, en vez
  // de descubrir una semana después que un ranking quedó congelado.
  const failed = results.filter(r => !r.ok)
  if (failed.length > 0) {
    await sendTelegram(
      `⚠️ <b>stat-snapshots</b> (${sport}): ${failed.length} bloque(s) sin actualizar\n` +
      failed.map(f => `• <code>${f.blockId}</code> — ${f.error ?? 'error'}`).join('\n') +
      `\nEl dato anterior se mantiene. Reintentar: <code>?sport=${sport}</code>`,
    )
  }

  return NextResponse.json({ ok, sport, results })
}

export async function GET(req: Request)  { return handle(req) }
export async function POST(req: Request) { return handle(req) }
