// Crónica semanal del Índice Taka
//
// GET → JSON con los mayores movimientos de la semana por categoría.
// GET ?format=html → HTML self-contained listo para email / push / blog.
//
// Pensado para llamarse cada lunes 09:00 desde n8n WF-* o desde un cron de Vercel.
// Sin auth público (data es la misma que ya muestra /rankings).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const revalidate = 600 // 10 min — la data subyacente cambia 1x/semana

type Mover = {
  id: string
  name: string
  subtitle: string | null
  sport: string | null
  category: string
  emoji: string | null
  country: string | null
  trend_reason: string | null
  score: number
  score_prev: number
  delta: number
}

const CATS = ['jugadores', 'jugadoras', 'clubes', 'entrenadores', 'creadores', 'periodistas'] as const

async function getMovers(limit = 5): Promise<{ up: Mover[]; down: Mover[] }> {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  )
  const { data, error } = await sb
    .from('ranking_view')
    .select('id,name,subtitle,sport,category,emoji,country,trend_reason,score,score_prev')
    .not('score_prev', 'is', null)
    .in('category', CATS as unknown as string[])
    .range(0, 1999)

  if (error || !data) return { up: [], down: [] }

  const movers: Mover[] = data.map((r) => ({
    id: r.id,
    name: r.name,
    subtitle: r.subtitle,
    sport: r.sport,
    category: r.category,
    emoji: r.emoji,
    country: r.country,
    trend_reason: r.trend_reason,
    score: Number(r.score),
    score_prev: Number(r.score_prev),
    delta: Math.round((Number(r.score) - Number(r.score_prev)) * 10) / 10,
  }))

  return {
    up: [...movers].sort((a, b) => b.delta - a.delta).filter(m => m.delta >= 1).slice(0, limit),
    down: [...movers].sort((a, b) => a.delta - b.delta).filter(m => m.delta <= -1).slice(0, limit),
  }
}

function renderHtml(up: Mover[], down: Mover[]): string {
  const row = (m: Mover, sign: '+' | '-') => `
    <tr>
      <td style="padding:8px 0;color:#D0D0E0;font-family:system-ui,sans-serif;">
        <a href="https://takasportsmedia.com/rankings/${m.id}" style="color:#C4B5FD;text-decoration:none;">
          ${m.country ?? ''} <strong>${m.name}</strong>
        </a>
        <span style="font-size:11px;color:#5A5A72;"> · ${m.subtitle ?? ''}</span>
      </td>
      <td style="padding:8px 0;text-align:right;font-family:system-ui,sans-serif;">
        <strong style="color:${sign === '+' ? '#22c55e' : '#f87171'};">${sign}${Math.abs(m.delta).toFixed(1)}</strong>
        <span style="color:#5A5A72;font-size:11px;"> · ${m.score.toFixed(1)}</span>
      </td>
    </tr>
    ${m.trend_reason ? `<tr><td colspan="2" style="padding:0 0 8px 0;font-size:11px;color:#8E8E9E;font-family:system-ui,sans-serif;">${m.trend_reason}</td></tr>` : ''}
  `

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Crónica semanal · Índice Taka</title></head>
<body style="background:#0a0a14;margin:0;padding:24px;">
<div style="max-width:560px;margin:0 auto;background:#13131F;border-radius:16px;padding:24px;">
  <p style="font-size:10px;font-weight:900;letter-spacing:2px;color:#7C3AED;margin:0 0 4px 0;font-family:system-ui,sans-serif;">CRÓNICA SEMANAL</p>
  <h1 style="font-size:24px;color:#E8E8F0;margin:0 0 24px 0;font-family:system-ui,sans-serif;">Movimientos del Índice Taka</h1>

  ${up.length > 0 ? `<h2 style="font-size:13px;color:#22c55e;margin:24px 0 8px 0;font-family:system-ui,sans-serif;">🔥 Suben</h2>
  <table style="width:100%;border-collapse:collapse;">${up.map(m => row(m, '+')).join('')}</table>` : ''}

  ${down.length > 0 ? `<h2 style="font-size:13px;color:#f87171;margin:24px 0 8px 0;font-family:system-ui,sans-serif;">❄️ Bajan</h2>
  <table style="width:100%;border-collapse:collapse;">${down.map(m => row(m, '-')).join('')}</table>` : ''}

  <p style="margin:32px 0 0 0;text-align:center;font-size:11px;color:#5A5A72;font-family:system-ui,sans-serif;">
    <a href="https://takasportsmedia.com/rankings" style="color:#7C3AED;text-decoration:none;">Ver el ranking completo →</a>
  </p>
</div>
</body></html>`
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const format = url.searchParams.get('format')
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') ?? '5', 10) || 5, 1), 20)

  const { up, down } = await getMovers(limit)

  if (format === 'html') {
    return new Response(renderHtml(up, down), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  return NextResponse.json({ up, down, week: new Date().toISOString().slice(0, 10) })
}
