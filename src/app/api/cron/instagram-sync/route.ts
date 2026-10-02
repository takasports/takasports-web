// GET /api/cron/instagram-sync — mantiene los reels de @taka.sports al día solos.
//
// Cada hora: renueva el token de Instagram cuando le quedan ≤50 días, baja los
// reels por el Graph API oficial, copia las portadas nuevas a Supabase Storage
// (URLs que no caducan) y reescribe reels.json si algo cambió. Avisa por
// Telegram (una vez al día como mucho) si Instagram no está conectado, si el
// permiso caducó o caduca en ≤7 días, o si lleva ≥6 h sin sincronizar. Toda la
// lógica en lib/ig-sync.ts.
//
// Auth: Bearer CRON_SECRET (lo manda Vercel Cron) o x-cron-secret.
//   ?dry=1 → informe sin escribir nada ni avisar.

import { NextResponse } from 'next/server'
import { checkBearerOrHeader } from '@/lib/auth-utils'
import { syncInstagramReels } from '@/lib/ig-sync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: Request) {
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  const dry = new URL(req.url).searchParams.get('dry') === '1'
  const report = await syncInstagramReels({ dry })
  // 200 aunque no haya token: el cron no debe "fallar" por un estado que ya se
  // avisa por Telegram. 500 solo si ni siquiera se pudo hablar con Supabase.
  const status = report.errors.includes('supabase_unavailable') ? 500 : 200
  return NextResponse.json(report, { status, headers: { 'Cache-Control': 'no-store' } })
}
