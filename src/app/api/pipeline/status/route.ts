// GET /api/pipeline/status
// Endpoint de health check del pipeline editorial (Taka System).
// Pensado para ser monitoreado por UptimeRobot, Better Uptime, etc.
//
// Responde 200 si el sistema está SANO, 503 si está DEGRADADO.
// El body JSON incluye detalles para diagnóstico.
//
// Configuración UptimeRobot (gratuito):
//   https://uptimerobot.com → Add new monitor
//   → Monitor Type: HTTP(s) — Keyword
//   → URL: https://www.takasportsmedia.com/api/pipeline/status
//   → Keyword: "\"ok\":true"
//   → Alert when: Keyword not found
//   → Check interval: 5 minutes
//
// Criterios de salud:
//   SANO    → último artículo raw en Supabase < 20 min
//   DEGRADADO → sin artículos nuevos en 20-60 min (pipeline puede estar parado)
//   CAÍDO   → sin artículos nuevos en más de 60 min → responde 503

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SB_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const SB_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY   // necesita bypassear RLS de content_items

// Umbrales en minutos
const WARN_THRESHOLD_MIN  = 20
const ERROR_THRESHOLD_MIN = 60

interface CheckResult {
  ok: boolean
  label: string
  value: string | number | null
  detail?: string
}

async function checkLastIngest(): Promise<CheckResult> {
  if (!SB_URL || !SB_KEY) {
    return { ok: false, label: 'last_ingest', value: null, detail: 'Supabase service key not configured' }
  }
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/content_items?select=created_at&order=created_at.desc&limit=1`,
      {
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
        signal: AbortSignal.timeout(5000),
      }
    )
    if (!r.ok) return { ok: false, label: 'last_ingest', value: null, detail: `Supabase ${r.status}` }
    const rows = await r.json() as Array<{ created_at: string }>
    if (!rows.length) return { ok: false, label: 'last_ingest', value: null, detail: 'No items in content_items' }

    const lastAt  = new Date(rows[0].created_at)
    const diffMin = Math.round((Date.now() - lastAt.getTime()) / 60_000)
    const ok      = diffMin < ERROR_THRESHOLD_MIN

    return {
      ok,
      label:  'last_ingest',
      value:  diffMin,
      detail: `Last item ingested ${diffMin} min ago (${rows[0].created_at})`,
    }
  } catch (e) {
    return { ok: false, label: 'last_ingest', value: null, detail: String(e) }
  }
}

async function checkLastPublished(): Promise<CheckResult> {
  if (!SB_URL || !SB_KEY) {
    return { ok: true, label: 'last_published', value: null, detail: 'skipped (no key)' }
  }
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/content_items?select=created_at&status=eq.published_web&order=created_at.desc&limit=1`,
      {
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
        signal: AbortSignal.timeout(5000),
      }
    )
    if (!r.ok) return { ok: true, label: 'last_published', value: null, detail: `Supabase ${r.status}` }
    const rows = await r.json() as Array<{ created_at: string }>
    if (!rows.length) return { ok: true, label: 'last_published', value: null, detail: 'No published items yet' }

    const lastAt  = new Date(rows[0].created_at)
    const diffH   = Math.round((Date.now() - lastAt.getTime()) / 3_600_000)

    return {
      ok:     true,   // publicación es editorial, no automática — no penaliza el health
      label:  'last_published',
      value:  diffH,
      detail: `Last article published ${diffH}h ago`,
    }
  } catch (e) {
    return { ok: true, label: 'last_published', value: null, detail: String(e) }
  }
}

async function checkPendingJobs(): Promise<CheckResult> {
  if (!SB_URL || !SB_KEY) {
    return { ok: true, label: 'pending_jobs', value: null, detail: 'skipped (no key)' }
  }
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/route_jobs?select=id&status=eq.pending_approval`,
      {
        headers: {
          apikey: SB_KEY,
          Authorization: `Bearer ${SB_KEY}`,
          Prefer: 'count=exact',
          Range: '0-0',
        },
        signal: AbortSignal.timeout(5000),
      }
    )
    const contentRange = r.headers.get('content-range') ?? ''
    const total = parseInt(contentRange.split('/')[1] ?? '0', 10)

    return {
      ok:     true,   // artículos pendientes son normales — no penaliza el health
      label:  'pending_jobs',
      value:  total,
      detail: `${total} articles awaiting editorial approval`,
    }
  } catch (e) {
    return { ok: true, label: 'pending_jobs', value: null, detail: String(e) }
  }
}

export async function GET() {
  const [ingest, published, pending] = await Promise.all([
    checkLastIngest(),
    checkLastPublished(),
    checkPendingJobs(),
  ])

  const checks = [ingest, published, pending]
  const allOk  = checks.every(c => c.ok)

  // Determinar nivel de degradación
  const ingestMin = typeof ingest.value === 'number' ? ingest.value : Infinity
  let level: 'ok' | 'warn' | 'error' = 'ok'
  if (ingestMin >= ERROR_THRESHOLD_MIN || !ingest.ok) level = 'error'
  else if (ingestMin >= WARN_THRESHOLD_MIN)            level = 'warn'

  const body = {
    ok:        allOk && level !== 'error',
    level,
    ts:        new Date().toISOString(),
    thresholds: { warn_min: WARN_THRESHOLD_MIN, error_min: ERROR_THRESHOLD_MIN },
    checks: {
      last_ingest_min:    ingest.value,
      last_published_h:   published.value,
      pending_approvals:  pending.value,
    },
    details: checks.map(c => ({ label: c.label, ok: c.ok, detail: c.detail })),
  }

  const status = level === 'error' ? 503 : 200

  return NextResponse.json(body, {
    status,
    headers: {
      // No cachear nunca — el monitor necesita datos frescos
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
