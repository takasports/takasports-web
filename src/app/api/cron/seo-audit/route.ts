// GET/POST /api/cron/seo-audit
//
// Auditoría SEO diaria → resumen por Telegram. Pensada para:
//   - Vercel Cron (schedule en vercel.json; envía Authorization: Bearer <CRON_SECRET>)
//   - manualmente: curl -H "x-cron-secret: $CRON_SECRET" https://.../api/cron/seo-audit
//   - prueba en seco sin enviar Telegram:  ?dry=1  (solo devuelve el JSON del informe)
//
// Auth: header `x-cron-secret` o `Authorization: Bearer <CRON_SECRET>`.

import { NextResponse } from 'next/server'
import { checkBearerOrHeader } from '@/lib/auth-utils'
import { runSeoAudit } from '@/lib/seo-audit'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function handle(req: Request) {
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const dry = new URL(req.url).searchParams.get('dry') === '1'
  const report = await runSeoAudit({ send: !dry })

  return NextResponse.json({
    ok: true,
    sentToTelegram: report.sentToTelegram,
    telegramNote: report.telegramNote,
    alerts: report.alerts,
    routesAllOk: report.routesAllOk,
    deploy: report.deploy,
    routes: report.routes,
    traffic: report.traffic,
    message: report.message,
  })
}

export async function GET(req: Request) {
  return handle(req)
}
export async function POST(req: Request) {
  return handle(req)
}
