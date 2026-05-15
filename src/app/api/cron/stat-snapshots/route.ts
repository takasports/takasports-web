// /api/cron/stat-snapshots
// Cron orquestador de scrapers para bloques sin API gratuita en vivo.
// Cada scraper devuelve {rows, source, asOf} | null. Si null se omite el upsert.
//
// Auth: header `x-cron-secret` o ?secret= debe coincidir con env CRON_SECRET.
// Selección de scraper: ?sport=motogp (default: 'all' = todos los configurados).
//
// Vercel Cron lo invoca semanalmente (ver vercel.json).
// También se puede llamar manualmente:
//   curl "https://takasportsmedia.com/api/cron/stat-snapshots?secret=XXX&sport=motogp"

import { NextResponse } from 'next/server'
import { upsertSnapshot, type UpsertResult } from '@/lib/stat-snapshots'
import { fetchMotogpRiders, fetchMotogpConstructors, type ScrapeResult } from '@/lib/motogp-scraper'
import { fetchUfcP4P, fetchUfcChampions } from '@/lib/ufc-scraper'
import { fetchEloWorldRanking } from '@/lib/elo-scraper'

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
  return upsertSnapshot(job.blockId, result.rows, result.source, result.asOf)
}

async function handle(req: Request) {
  const secret = process.env.CRON_SECRET
  const url = new URL(req.url)
  if (secret) {
    const auth = req.headers.get('authorization') ?? ''
    const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : null
    const provided = req.headers.get('x-cron-secret')
      ?? url.searchParams.get('secret')
      ?? bearer  // Vercel Cron auto-añade `Authorization: Bearer ${CRON_SECRET}`
    if (provided !== secret) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }
  }

  const sport = (url.searchParams.get('sport') ?? 'all').toLowerCase()
  const jobs = sport === 'all' ? ALL_JOBS : (JOBS_BY_SPORT[sport] ?? [])
  if (jobs.length === 0) {
    return NextResponse.json({ ok: false, error: 'unknown_sport', sport, available: Object.keys(JOBS_BY_SPORT) }, { status: 400 })
  }

  const results = await Promise.all(jobs.map(runJob))
  const ok = results.every(r => r.ok)
  return NextResponse.json({ ok, sport, results })
}

export async function GET(req: Request)  { return handle(req) }
export async function POST(req: Request) { return handle(req) }
