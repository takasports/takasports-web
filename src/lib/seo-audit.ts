// Auditoría SEO diaria — núcleo reutilizable.
//
// Genera un resumen con tres bloques:
//   A) HEALTH CHECK  — estado del último deploy de Vercel + HTTP de rutas clave.
//   B) SEO / TRÁFICO — clics, impresiones, posición y top queries (Search Console API).
//   C) ALERTAS       — fallos de health y caídas bruscas de tráfico, destacadas arriba.
//
// Diseño "degrada con elegancia": cada bloque va en su try/catch. Si falta una
// credencial (GSC, Telegram, Vercel) se omite ese trozo y se anota, en vez de
// romper todo el informe. Así se puede probar por partes mientras se completan
// las variables de entorno.
//
// Sin dependencias nuevas: el JWT del service account se firma con `crypto`.

import { getOauthAccessToken, getServiceAccountToken } from './google-auth'
import { sendTelegram } from './telegram'

// ── Config ───────────────────────────────────────────────────────────────────

const SITE_URL = process.env.SEARCH_CONSOLE_SITE_URL || 'https://www.takasportsmedia.com/'
const BASE_URL = (process.env.SEO_AUDIT_BASE_URL || 'https://www.takasportsmedia.com').replace(/\/$/, '')

// Rutas que SIEMPRE deben responder 2xx/3xx. Si una falla, es la alerta nº1
// (esto es lo que evita otro "build roto 23h sin que nadie se entere").
const HEALTH_ROUTES = ['/', '/noticias', '/estadisticas', '/sitemap.xml', '/api/stats/standings']

const FETCH_TIMEOUT_MS = 10_000

// ── Tipos ──────────────────────────────────────────────────────────────────

export interface RouteCheck {
  path: string
  status: number | null
  ms: number
  ok: boolean
  error?: string
}

export interface DeployStatus {
  available: boolean
  state?: string // READY | ERROR | BUILDING | ...
  ok?: boolean
  createdAt?: string
  url?: string
  note?: string
}

export interface TrafficSummary {
  available: boolean
  lastDay?: string
  clicks?: number
  impressions?: number
  position?: number
  ctr?: number // 0..1
  avgClicks7?: number
  avgImpressions7?: number
  avgPosition7?: number
  avgCtr7?: number
  clicksTrend?: 'up' | 'down' | 'flat'
  impressionsTrend?: 'up' | 'down' | 'flat'
  bigDrop?: boolean
  topMovers?: { query: string; clicks: number; delta: number; isNew: boolean }[]
  // "Tarea de la semana": query que te ven mucho pero casi nadie pincha.
  opportunity?: { query: string; impressions: number; clicks: number; ctr: number }
  note?: string
}

export interface AuditReport {
  date: string
  alerts: string[]
  deploy: DeployStatus
  routes: RouteCheck[]
  routesAllOk: boolean
  traffic: TrafficSummary
  message: string
}

// ── Utilidades de fecha (UTC, sin libs) ──────────────────────────────────────

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}
function daysAgo(n: number): Date {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d
}

async function timedFetch(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

// ── A) HEALTH: rutas HTTP ────────────────────────────────────────────────────

export async function checkRoutes(): Promise<RouteCheck[]> {
  return Promise.all(
    HEALTH_ROUTES.map(async (path): Promise<RouteCheck> => {
      const start = Date.now()
      try {
        // GET (no HEAD): algunas rutas dinámicas no implementan HEAD.
        const res = await timedFetch(BASE_URL + path, {
          method: 'GET',
          headers: { 'user-agent': 'taka-seo-audit/1.0' },
          redirect: 'manual',
        })
        const ms = Date.now() - start
        const ok = res.status >= 200 && res.status < 400
        return { path, status: res.status, ms, ok }
      } catch (e) {
        return {
          path,
          status: null,
          ms: Date.now() - start,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        }
      }
    }),
  )
}

// ── A) HEALTH: estado del deploy de Vercel (opcional) ────────────────────────

export async function checkVercelDeploy(): Promise<DeployStatus> {
  const token = process.env.VERCEL_TOKEN
  const projectId = process.env.VERCEL_PROJECT_ID
  if (!token || !projectId) {
    return { available: false, note: 'VERCEL_TOKEN / VERCEL_PROJECT_ID no configurados' }
  }
  try {
    const teamQs = process.env.VERCEL_TEAM_ID ? `&teamId=${process.env.VERCEL_TEAM_ID}` : ''
    const url = `https://api.vercel.com/v6/deployments?projectId=${encodeURIComponent(projectId)}&target=production&limit=1${teamQs}`
    const res = await timedFetch(url, { headers: { authorization: `Bearer ${token}` } })
    if (!res.ok) return { available: false, note: `Vercel API ${res.status}` }
    const data = (await res.json()) as { deployments?: { readyState?: string; state?: string; createdAt?: number; url?: string }[] }
    const dep = data.deployments?.[0]
    if (!dep) return { available: false, note: 'sin deployments' }
    const state = dep.readyState || dep.state || 'UNKNOWN'
    return {
      available: true,
      state,
      ok: state === 'READY',
      createdAt: dep.createdAt ? new Date(dep.createdAt).toISOString() : undefined,
      url: dep.url,
    }
  } catch (e) {
    return { available: false, note: e instanceof Error ? e.message : String(e) }
  }
}

// ── B) Google Search Console API ─────────────────────────────────────────────

/**
 * Access token para la Search Console API. Prioriza OAuth (cuenta de usuario)
 * porque las cuentas de servicio creadas tras abril/2026 no se pueden añadir a
 * Search Console (bug conocido de Google). Si no hay OAuth, cae al service
 * account. El minteo de tokens vive en `./google-auth` (compartido con GA4).
 */
async function getGscAccessToken(): Promise<string | null> {
  const oauth = await getOauthAccessToken()
  if (oauth) return oauth
  return getServiceAccountToken(['https://www.googleapis.com/auth/webmasters.readonly'])
}

interface GscRow {
  keys?: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

async function gscQuery(
  token: string,
  body: Record<string, unknown>,
): Promise<GscRow[]> {
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE_URL)}/searchAnalytics/query`
  const res = await timedFetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`searchAnalytics ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = (await res.json()) as { rows?: GscRow[] }
  return data.rows ?? []
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const trend = (cur: number, base: number): 'up' | 'down' | 'flat' => {
  if (base === 0) return cur > 0 ? 'up' : 'flat'
  const diff = (cur - base) / base
  if (diff > 0.05) return 'up'
  if (diff < -0.05) return 'down'
  return 'flat'
}

export async function getTrafficSummary(): Promise<TrafficSummary> {
  let token: string | null
  try {
    token = await getGscAccessToken()
  } catch (e) {
    return { available: false, note: `auth GSC: ${e instanceof Error ? e.message : String(e)}` }
  }
  if (!token) return { available: false, note: 'Google sin configurar (OAuth o service account)' }

  try {
    // 1) Serie diaria de los últimos ~16 días (GSC va con 2-3 días de retraso).
    const byDate = await gscQuery(token, {
      startDate: ymd(daysAgo(16)),
      endDate: ymd(daysAgo(1)),
      dimensions: ['date'],
      rowLimit: 30,
    })
    if (!byDate.length) return { available: true, note: 'sin datos aún (GSC tarda 2-3 días)' }

    const sorted = [...byDate].sort((a, b) => (a.keys![0] < b.keys![0] ? -1 : 1))
    const last = sorted[sorted.length - 1]
    const prior7 = sorted.slice(Math.max(0, sorted.length - 8), sorted.length - 1)

    const avgClicks7 = mean(prior7.map((r) => r.clicks))
    const avgImpr7 = mean(prior7.map((r) => r.impressions))
    const avgPos7 = mean(prior7.map((r) => r.position))
    const avgCtr7 = mean(prior7.map((r) => r.ctr))

    // 2) Top queries: ventana reciente vs anterior para detectar nuevas/subidas.
    const [recentQ, prevQ] = await Promise.all([
      gscQuery(token, { startDate: ymd(daysAgo(8)), endDate: ymd(daysAgo(1)), dimensions: ['query'], rowLimit: 100 }),
      gscQuery(token, { startDate: ymd(daysAgo(16)), endDate: ymd(daysAgo(9)), dimensions: ['query'], rowLimit: 100 }),
    ])
    const prevMap = new Map(prevQ.map((r) => [r.keys![0], r.clicks]))
    const movers = recentQ
      .map((r) => {
        const q = r.keys![0]
        const prev = prevMap.get(q) ?? 0
        return { query: q, clicks: r.clicks, delta: r.clicks - prev, isNew: prev === 0 }
      })
      .filter((m) => m.delta > 0)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 3)

    // 3) "Tarea de la semana": la query con más impresiones y CTR más bajo
    //    (te ven mucho pero casi nadie entra → mejorar título/meta en Sanity).
    const oppCands = recentQ
      .filter((r) => r.impressions >= 50)
      .sort((a, b) => a.ctr - b.ctr || b.impressions - a.impressions)
    const opp = oppCands.find((r) => r.ctr < 0.02)
    const opportunity = opp
      ? { query: opp.keys![0], impressions: opp.impressions, clicks: opp.clicks, ctr: opp.ctr }
      : undefined

    const bigDrop = avgClicks7 > 3 && last.clicks < avgClicks7 * 0.5

    return {
      available: true,
      lastDay: last.keys![0],
      clicks: last.clicks,
      impressions: last.impressions,
      position: last.position,
      ctr: last.ctr,
      avgClicks7,
      avgImpressions7: avgImpr7,
      avgPosition7: avgPos7,
      avgCtr7,
      clicksTrend: trend(last.clicks, avgClicks7),
      impressionsTrend: trend(last.impressions, avgImpr7),
      bigDrop,
      topMovers: movers,
      opportunity,
    }
  } catch (e) {
    return { available: false, note: `query GSC: ${e instanceof Error ? e.message : String(e)}` }
  }
}

// ── Telegram ─────────────────────────────────────────────────────────────────

// sendTelegram vive ahora en ./telegram (módulo ligero reutilizable por crons).
// Se reexporta para no romper imports existentes desde '@/lib/seo-audit'.
export { sendTelegram }

// ── Composición del mensaje ──────────────────────────────────────────────────

const esNum = (n?: number) => (n == null ? '–' : Math.round(n).toLocaleString('es-ES'))
// Porcentaje con coma decimal (1.5 → "1,5").
const esPct = (ctr?: number) => (ctr == null ? '–' : (ctr * 100).toFixed(1).replace('.', ','))

function fechaLarga(d: Date): string {
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })
}
function fechaCorta(iso: string): string {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

function buildMessage(r: Omit<AuditReport, 'message'>): string {
  const L: string[] = []
  const t = r.traffic

  // Cabecera + veredicto en lenguaje normal.
  const hardProblem = !r.routesAllOk || (r.deploy.available && !r.deploy.ok)
  const verdict = hardProblem
    ? '🔴 <b>Hay un problema, míralo abajo</b>'
    : r.alerts.length
      ? `🟡 <b>Atención a ${r.alerts.length} cosa${r.alerts.length > 1 ? 's' : ''}</b>`
      : '🟢 <b>Todo en orden hoy</b>'

  L.push(`🏆 <b>Taka SEO</b> · ${fechaLarga(new Date())}`)
  L.push('')
  L.push(verdict)

  if (r.alerts.length) {
    L.push('')
    L.push('🚨 <b>PROBLEMAS</b>')
    for (const a of r.alerts) L.push(`• ${a}`)
  }

  // ── ¿Cómo voy en Google? ──
  L.push('')
  if (!t.available || !t.lastDay) {
    L.push('📊 <b>¿Cómo voy en Google?</b>')
    L.push(`⚪️ ${t.note ?? 'aún sin datos (Google tarda 2-3 días)'}`)
  } else {
    const clicksTxt =
      t.clicksTrend === 'up'
        ? `mejor que tu media (${esNum(t.avgClicks7)}/día) 📈`
        : t.clicksTrend === 'down'
          ? `por debajo de tu media (${esNum(t.avgClicks7)}/día) 📉`
          : `en tu media (${esNum(t.avgClicks7)}/día) ➡️`
    const imprTxt =
      t.impressionsTrend === 'up'
        ? `por encima de tu media (${esNum(t.avgImpressions7)}/día) 📈`
        : t.impressionsTrend === 'down'
          ? `por debajo de tu media (${esNum(t.avgImpressions7)}/día) 📉`
          : `en tu media (${esNum(t.avgImpressions7)}/día) ➡️`
    // Posición: número más bajo = mejor.
    const posBetter = t.position != null && t.avgPosition7 != null && t.position < t.avgPosition7 - 0.3
    const posWorse = t.position != null && t.avgPosition7 != null && t.position > t.avgPosition7 + 0.3
    const posTxt = posBetter
      ? `(subiendo desde ${t.avgPosition7?.toFixed(0)}) 📈`
      : posWorse
        ? `(bajando desde ${t.avgPosition7?.toFixed(0)}) 📉`
        : '(estable) ➡️'

    L.push(`📊 <b>¿Cómo voy en Google?</b> (datos del ${fechaCorta(t.lastDay)})`)
    L.push(`👁 Apariciones: <b>${esNum(t.impressions)}</b> — ${imprTxt}`)
    L.push(`👆 Visitas: <b>${esNum(t.clicks)}</b> — ${clicksTxt}`)
    L.push(`🎯 De cada 100 que te ven, entran: <b>${esPct(t.ctr)}</b> (tu media: ${esPct(t.avgCtr7)})`)
    L.push(`📍 Puesto medio: <b>${t.position?.toFixed(0) ?? '–'}</b> ${posTxt}`)

    if (t.topMovers && t.topMovers.length) {
      L.push('')
      L.push('🔥 <b>Lo que está despegando:</b>')
      for (const m of t.topMovers) {
        const prev = m.clicks - m.delta
        const tail = m.isNew ? '🆕 ¡nueva!' : `(antes ${esNum(prev)})`
        L.push(`   • ${m.query} — ${esNum(m.clicks)} visitas ${tail}`)
      }
    }

    if (t.opportunity) {
      L.push('')
      L.push(
        `💡 <b>Tarea de la semana:</b> la búsqueda "${t.opportunity.query}" te ve mucho ` +
          `(${esNum(t.opportunity.impressions)} veces) pero casi nadie entra ` +
          `(${esPct(t.opportunity.ctr)}%) → mejora su título en Sanity.`,
      )
    }
  }

  // ── Web sana (resumen del health-check en 1 línea) ──
  const okCount = r.routes.filter((x) => x.ok).length
  const salud = r.routesAllOk ? `${okCount}/${r.routes.length} páginas OK` : `⚠️ ${okCount}/${r.routes.length} páginas OK`
  const deployTxt = r.deploy.available ? ` · deploy ${r.deploy.state}` : ''
  L.push('')
  L.push(`🩺 <b>Web sana:</b> ${salud}${deployTxt}`)

  return L.join('\n')
}

// ── Orquestación ─────────────────────────────────────────────────────────────

export async function runSeoAudit(
  opts: { send?: boolean } = {},
): Promise<AuditReport & { sentToTelegram: boolean; telegramNote?: string }> {
  const { send = true } = opts
  const date = ymd(new Date())

  const [deploy, routes, traffic] = await Promise.all([
    checkVercelDeploy(),
    checkRoutes(),
    getTrafficSummary(),
  ])

  const routesAllOk = routes.every((r) => r.ok)

  // Construir alertas (lo más crítico arriba del mensaje).
  const alerts: string[] = []
  if (deploy.available && !deploy.ok) alerts.push(`Deploy en estado <b>${deploy.state}</b> (¡revisa Vercel!)`)
  for (const c of routes.filter((x) => !x.ok)) {
    alerts.push(`Ruta <b>${c.path}</b> no responde (${c.status ?? c.error ?? 'timeout'})`)
  }
  if (traffic.available && traffic.bigDrop) {
    alerts.push(`Caída brusca de clics: ${esNum(traffic.clicks)} vs media ${esNum(traffic.avgClicks7)}`)
  }

  const partial: Omit<AuditReport, 'message'> = { date, alerts, deploy, routes, routesAllOk, traffic }
  const message = buildMessage(partial)

  if (!send) {
    return { ...partial, message, sentToTelegram: false, telegramNote: 'dry run (no enviado)' }
  }
  const tg = await sendTelegram(message)

  return { ...partial, message, sentToTelegram: tg.sent, telegramNote: tg.note }
}
