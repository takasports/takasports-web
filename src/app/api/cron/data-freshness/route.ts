// GET / POST /api/cron/data-freshness
//
// Vigila que los datos clave NO se queden viejos EN SILENCIO. El recompute
// semanal del Índice Taka corre FUERA de Vercel (launchd en el Mac del dueño):
// si ese equipo está apagado o el script falla, los rankings se quedarían viejos
// sin que nadie se entere. Esta alarma lo detecta mirando la BD directamente —
// pase lo que pase con la máquina que lanza el recompute.
//
// Además (oct-2026): calendario de hoy sin fútbol en día de jornada, último reel
// con más de 48 h y noticias publicadas en 7 días por debajo de 80. Las reglas
// están en lib/data-freshness-rules.ts (probadas aparte).
//
// Manda ⚠️ a Telegram SOLO cuando algún dato excede su SLA (silencioso si todo
// está fresco, para no generar ruido). Auth: x-cron-secret / Bearer CRON_SECRET.
//   ?dry=1 → devuelve el informe JSON sin enviar Telegram.

import { NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'
import { checkBearerOrHeader } from '@/lib/auth-utils'
import { sendTelegram } from '@/lib/telegram'
import { createClient } from '@supabase/supabase-js'
import { sanityClient } from '@/lib/sanity'
import { getMergedReels } from '@/lib/reels-feed'
import { isoToLocalDate } from '@/lib/calendar'
import { SOURCE_TZ } from '@/lib/timezone'
import { fetchJsonExterno } from '@/lib/fetch-externo'
import {
  diaSemanaEn, evaluarCalendarioHoy, evaluarNoticiasSemana, evaluarReels,
} from '@/lib/data-freshness-rules'

export const dynamic = 'force-dynamic'
// 60 y no 30: ahora también lee el calendario público (/api/events/today), que
// en frío puede tardar ~20 s.
export const maxDuration = 60

/** Origen público del sitio (mismo criterio que el cron warm-events). */
function baseUrl(req: Request): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL
  if (env) return env.replace(/\/$/, '')
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return new URL(req.url).origin
}

// Partidos de fútbol con fecha de HOY (Madrid) en el calendario PÚBLICO, el que
// ven web y app. Se lee por HTTP a propósito: si el CDN sirve una respuesta de
// ayer o vacía, eso es justo lo que hay que detectar. null = no se pudo leer.
async function futbolHoyPublico(req: Request, hoy: string): Promise<{ n: number | null; error?: string }> {
  const json = await fetchJsonExterno<{ events?: Array<{ sport?: string; isoDate?: string }> }>(
    `${baseUrl(req)}/api/events/today`,
    { headers: { 'user-agent': 'taka-data-freshness' }, cache: 'no-store' },
    { etiqueta: 'data-freshness', timeoutMs: 25_000 },
  )
  if (!json || !Array.isArray(json.events)) return { n: null, error: 'sin respuesta válida' }
  const n = json.events.filter(e => e.sport === 'Fútbol' && e.isoDate && isoToLocalDate(e.isoDate) === hoy).length
  return { n }
}

// Partidos de fútbol del mismo día de la semana pasada, del archivo past_events.
async function futbolSemanaPasada(admin: NonNullable<ReturnType<typeof adminSupabase>>, ahora: number): Promise<number> {
  const objetivo = isoToLocalDate(new Date(ahora - 7 * 86_400_000).toISOString())
  const desde = new Date(ahora - 8.5 * 86_400_000).toISOString()
  const hasta = new Date(ahora - 5.5 * 86_400_000).toISOString()
  const { data, error } = await admin
    .from('past_events')
    .select('iso_date')
    .eq('sport', 'Fútbol')
    .gte('iso_date', desde)
    .lte('iso_date', hasta)
    .limit(1000)
  if (error || !data) return 0 // sin base no se avisa (evita falsos positivos)
  return (data as Array<{ iso_date: string }>).filter(r => isoToLocalDate(r.iso_date) === objetivo).length
}

// Noticias publicadas en Sanity en los últimos 7 días. Mismo criterio de
// "publicada" que el feed (status publicado o artículo del pipeline con
// headline, nunca borradores).
const NOTICIAS_7D_GROQ = `count(*[_type == "article" && !(_id in path('drafts.**')) && (status == "publicado" || defined(headline)) && publishedAt > $since])`

// SLA por dato: días que puede pasar sin actualizarse antes de avisar.
//   · Resultados pasados (sync DIARIO) → 2 días = 1 de cadencia + 1 de gracia.
//   · Pipeline de noticias (ingesta CONTINUA) → 2 días: el pipeline crea
//     content_items cada pocos minutos; 2 días sin un solo item nuevo = caído
//     (o pausado a propósito vía Telegram, en cuyo caso el aviso es informativo).
// El Índice Taka se vigila APARTE, POR CATEGORÍA (ver más abajo).
const CHECKS: ReadonlyArray<{ table: string; column: string; slaDays: number; label: string }> = [
  { table: 'past_events',   column: 'updated_at', slaDays: 2, label: 'Resultados pasados (sync diario)' },
  { table: 'content_items', column: 'created_at', slaDays: 2, label: 'Pipeline de noticias (ingesta)' },
]

// Índice Taka (recompute SEMANAL) → 9 días = 7 de cadencia + 2 de gracia.
// Se vigila POR CATEGORÍA (no con un máximo global): así un parón PARCIAL de una
// sola categoría no queda enmascarado por otra que sí se actualizó.
const RANKING_SLA_DAYS = 9
// Categorías SIN fuente automática (se curan SOLO a mano): exentas de la alarma
// para no generar ruido recurrente. Hoy NINGUNA: UFC femenino se actualiza vía
// ingest-ufc-rankings.mjs (ufc.com), que ahora sella last_auto_update, así que
// se vigila como las demás. Si en el futuro una categoría pasa a curarse solo a
// mano, añádela aquí.
const STATIC_CATEGORIES = new Set<string>([])

async function handle(req: Request) {
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const admin = adminSupabase()
  if (!admin) return NextResponse.json({ ok: false, error: 'admin_unavailable' }, { status: 503 })

  const dry = new URL(req.url).searchParams.get('dry') === '1'
  const now = Date.now()
  const checks: Array<Record<string, unknown>> = []
  const stale: string[] = []

  for (const c of CHECKS) {
    // Fila con el valor MÁS reciente de la columna (nulls al final).
    const { data, error } = await admin
      .from(c.table)
      .select(c.column)
      .order(c.column, { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      checks.push({ table: c.table, column: c.column, ok: false, note: error.message })
      stale.push(`• <b>${c.label}</b>: error al consultar (${error.message})`)
      continue
    }

    const last = data ? ((data as unknown as Record<string, string | null>)[c.column] ?? null) : null
    const ageDays = last ? (now - new Date(last).getTime()) / 86_400_000 : Infinity
    const ok = ageDays <= c.slaDays
    checks.push({
      table: c.table,
      column: c.column,
      last,
      ageDays: Number.isFinite(ageDays) ? Math.round(ageDays * 10) / 10 : null,
      slaDays: c.slaDays,
      ok,
    })
    if (!ok) {
      const ageTxt = Number.isFinite(ageDays) ? `${ageDays.toFixed(1)} días` : 'sin datos'
      stale.push(`• <b>${c.label}</b>: ${ageTxt} sin actualizarse (límite ${c.slaDays}d). Última: ${last ?? '—'}`)
    }
  }

  // Índice Taka POR CATEGORÍA: detecta paros PARCIALES (una categoría vieja
  // mientras otras siguen frescas) que el antiguo máximo global ocultaba.
  // Las categorías estáticas (STATIC_CATEGORIES) se omiten.
  const { data: cats, error: catErr } = await admin.rpc('f_ranking_category_freshness')
  if (catErr) {
    checks.push({ source: 'Índice Taka (por categoría)', ok: false, note: catErr.message })
    stale.push(`• <b>Índice Taka</b>: error al consultar frescura por categoría (${catErr.message})`)
  } else {
    const rows = (cats ?? []) as Array<{ category: string; last_update: string | null; age_days: number | string | null }>
    for (const row of rows) {
      if (STATIC_CATEGORIES.has(row.category)) continue
      const ageDays = row.age_days != null ? Number(row.age_days) : Infinity
      const ok = ageDays <= RANKING_SLA_DAYS
      checks.push({
        source: `Índice · ${row.category}`,
        last: row.last_update,
        ageDays: Number.isFinite(ageDays) ? ageDays : null,
        slaDays: RANKING_SLA_DAYS,
        ok,
      })
      if (!ok) {
        const ageTxt = Number.isFinite(ageDays) ? `${ageDays.toFixed(1)} días` : 'sin datos'
        stale.push(`• <b>Índice Taka · ${row.category}</b>: ${ageTxt} sin actualizarse (límite ${RANKING_SLA_DAYS}d). Última: ${row.last_update ?? '—'}`)
      }
    }
  }

  // GRANT/legibilidad de ranking_view (anon): el Índice de arriba se mide con el
  // cliente service-role, que IGNORA permisos. Pero la web y la app PÚBLICAS leen
  // ranking_view como ANON; si esa vista pierde el GRANT SELECT a anon/authenticated
  // (p.ej. al recrearse sin re-emitir el GRANT) los rankings salen VACÍOS para todo
  // el mundo aunque el dato esté fresco — justo el bug que ya nos pasó. Lo
  // detectamos LEYÉNDOLA como anon (service-role daría un falso OK).
  const anonUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!anonUrl || !anonKey) {
    checks.push({ source: 'ranking_view (anon)', ok: false, note: 'env anon no configurada' })
    stale.push('• <b>Ranking (legible por anon)</b>: no se pudo comprobar (falta NEXT_PUBLIC_SUPABASE_ANON_KEY)')
  } else {
    const anon = createClient(anonUrl, anonKey, { auth: { persistSession: false } })
    const { count, error: anonErr } = await anon
      .from('ranking_view')
      .select('*', { count: 'exact', head: true })
    if (anonErr) {
      checks.push({ source: 'ranking_view (anon)', ok: false, code: anonErr.code, note: anonErr.message })
      stale.push(
        anonErr.code === '42501'
          ? '• <b>Ranking SIN PERMISO para anon</b>: ranking_view perdió el GRANT SELECT → rankings VACÍOS en web y app. Re-aplica <code>GRANT SELECT ON public.ranking_view TO anon, authenticated;</code>'
          : `• <b>Ranking (legible por anon)</b>: error al leer ranking_view (${anonErr.message}${anonErr.code ? `, código ${anonErr.code}` : ''})`,
      )
    } else if (!count) {
      checks.push({ source: 'ranking_view (anon)', ok: false, count: 0 })
      stale.push('• <b>Ranking VACÍO</b>: ranking_view es legible por anon pero devuelve 0 filas → rankings vacíos en web y app')
    } else {
      checks.push({ source: 'ranking_view (anon)', ok: true, count })
    }
  }

  // ── Calendario, reels y noticias ────────────────────────────────────────
  // Cada comprobación va aislada: si una falla no tumba las demás. El cron
  // corre una vez al día, así que cada tipo de aviso llega como mucho una vez
  // al día, todos juntos en el mismo mensaje.
  const hoy = isoToLocalDate(new Date(now).toISOString())
  const diaSemana = diaSemanaEn(new Date(now), SOURCE_TZ)

  const [calendario, reels, noticias] = await Promise.all([
    (async () => {
      try {
        const [hoyRes, base] = await Promise.all([futbolHoyPublico(req, hoy), futbolSemanaPasada(admin, now)])
        return { futbolHoy: hoyRes.n, futbolSemanaPasada: base, error: hoyRes.error }
      } catch (e) {
        return { futbolHoy: null, futbolSemanaPasada: 0, error: (e as Error).message }
      }
    })(),
    (async () => {
      try {
        const lista = await getMergedReels()
        let max = 0
        for (const r of lista) {
          const ms = new Date(r.timestamp).getTime()
          if (Number.isFinite(ms) && ms > max) max = ms
        }
        return { ultimoReelIso: max > 0 ? new Date(max).toISOString() : null }
      } catch {
        return { ultimoReelIso: null }
      }
    })(),
    (async () => {
      try {
        const since = new Date(now - 7 * 86_400_000).toISOString()
        const n = await sanityClient.fetch<number>(NOTICIAS_7D_GROQ, { since })
        return { publicadas7d: typeof n === 'number' ? n : null }
      } catch (e) {
        return { publicadas7d: null, error: (e as Error).message }
      }
    })(),
  ])

  const avisoCalendario = evaluarCalendarioHoy({ ...calendario, diaSemana })
  checks.push({ source: 'Calendario de hoy (fútbol)', ...calendario, diaSemana, ok: !avisoCalendario })
  if (avisoCalendario) stale.push(avisoCalendario)

  const avisoReels = evaluarReels({ ...reels, ahoraMs: now })
  checks.push({ source: 'Reels (último)', ...reels, ok: !avisoReels })
  if (avisoReels) stale.push(avisoReels)

  const avisoNoticias = evaluarNoticiasSemana(noticias)
  checks.push({ source: 'Noticias publicadas (7 días)', ...noticias, ok: !avisoNoticias })
  if (avisoNoticias) stale.push(avisoNoticias)

  let telegram: { sent: boolean; note?: string } = { sent: false, note: 'sin alertas' }
  if (stale.length > 0) {
    if (dry) {
      telegram = { sent: false, note: 'dry-run: no enviado' }
    } else {
      const msg =
        `⚠️ <b>TakaSports — datos viejos</b>\n\n${stale.join('\n')}\n\n` +
        `Revisa el recompute semanal (launchd en el Mac), el cron de sync o la fuente indicada.`
      telegram = await sendTelegram(msg)
    }
  }

  return NextResponse.json({ ok: true, stale: stale.length > 0, checks, telegram })
}

export async function GET(req: Request) {
  return handle(req)
}
export async function POST(req: Request) {
  return handle(req)
}
