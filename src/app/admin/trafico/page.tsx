// /admin/trafico
// Panel ÚNICO de tráfico web + app, identidad Vidrio Taka (.tk-glass). Esquema:
//   0. Alertas        — banner rojo/ámbar si algo va mal; verde si todo bien
//   1. Explorador     — pills 24h/7d/Mes/Total que cambian la ventana (client)
//   2. En vivo        — quién está ahora, de dónde, en qué página (auto-refresco)
//   3. Visitas (GA4)  — 30 días + calidad + dispositivos + canales + países + páginas
//   4. Búsqueda (GSC) — clics 24h/7d/28d con comparativa + top búsquedas y páginas
//   5. Histórico      — visitas + clics + descargas juntas en el tiempo (Supabase)
//   6. Descargas iOS  — total/7d/ayer + países
//   7. Salud web      — rutas + deploy
//
// Explicaciones: términos con `title` (tooltip al pasar el cursor). Protección:
// allowlist ADMIN_EMAILS. Degradación elegante bloque a bloque.

import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import { requireAdmin } from '@/lib/admin-auth'
import RealtimePanel from './RealtimePanel'
import PeriodExplorer, { type PeriodData } from './PeriodExplorer'
import {
  getGa4Summary, getSearchDetail, getSearchTotals, getGa4Realtime, getAppDownloads, getTrafficHistory, shortPath,
  type Ga4Summary, type SearchDetail, type SearchTotals, type Ga4Realtime, type AppDownloads, type TrafficHistoryDay,
} from '@/lib/traffic'
import { checkRoutes, checkVercelDeploy, type RouteCheck, type DeployStatus } from '@/lib/seo-audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Tráfico — TakaSports',
  robots: { index: false, follow: false },
}

const nf = (n?: number | null) => (n == null ? '–' : Math.round(n).toLocaleString('es-ES'))
const pct = (ctr?: number | null) => (ctr == null ? '–' : `${(ctr * 100).toFixed(1).replace('.', ',')}%`)
function fmtDur(s?: number | null) {
  if (s == null) return '–'
  const m = Math.floor(s / 60), r = Math.round(s % 60)
  return m ? `${m} min ${r}s` : `${r}s`
}
function deltaPct(cur?: number | null, prev?: number | null): number | null {
  if (cur == null || prev == null || prev === 0) return null
  return Math.round(((cur - prev) / prev) * 100)
}
/** style con la variable --ga del acento (para .tk-glass-tint / .tk-glass-spine). */
function ga(accent: string, extra: CSSProperties = {}): CSSProperties {
  return { ['--ga' as string]: accent, ...extra } as CSSProperties
}

const ACCENTS = ['#7C3AED', '#8B5CF6', '#F472B6', '#60A5FA', '#86EFAC', '#FCD34D']
const DEVICE_LABEL: Record<string, string> = { mobile: '📱 Móvil', desktop: '💻 Escritorio', tablet: '📲 Tablet', smart_tv: '📺 TV' }

// Canales de GA4 → nombre claro + explicación (tooltip).
const CHANNEL_INFO: Record<string, { es: string; desc: string }> = {
  Direct: { es: 'Directo', desc: 'Entran escribiendo la dirección, desde marcadores o apps — sin fuente rastreable.' },
  'Organic Search': { es: 'Búsqueda orgánica', desc: 'Llegan desde resultados de Google/Bing, sin pagar anuncios.' },
  'Organic Social': { es: 'Redes sociales', desc: 'Llegan desde enlaces en redes (Instagram, X, TikTok…), sin pagar.' },
  Referral: { es: 'Referido', desc: 'Llegan desde un enlace puesto en otra web.' },
  'Organic Shopping': { es: 'Shopping', desc: 'Desde resultados o pestañas de compras de Google, sin pagar.' },
  Email: { es: 'Email', desc: 'Desde enlaces en correos (por ejemplo, la newsletter).' },
  'Paid Search': { es: 'Búsqueda de pago', desc: 'Desde anuncios en el buscador.' },
  'Paid Social': { es: 'Redes de pago', desc: 'Desde anuncios en redes sociales.' },
  Unassigned: { es: 'Sin asignar', desc: 'Google no pudo determinar de dónde vino la visita.' },
}
function channelInfo(name: string) { return CHANNEL_INFO[name] ?? { es: name, desc: '' } }

function flag(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return '🌐'
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

function TrendChip({ trend }: { trend?: 'up' | 'down' | 'flat' }) {
  if (!trend) return null
  const map = { up: { t: '▲', c: '#86EFAC' }, down: { t: '▼', c: '#FCA5A5' }, flat: { t: '▶', c: 'var(--text-muted)' } }
  const { t, c } = map[trend]
  return <span style={{ color: c, fontSize: 13, fontWeight: 800, marginLeft: 8 }}>{t}</span>
}

function DeltaChip({ cur, prev }: { cur?: number | null; prev?: number | null }) {
  const d = deltaPct(cur, prev)
  if (d == null) return null
  const up = d >= 0
  return <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 800, color: up ? '#86EFAC' : '#FCA5A5' }}>{up ? '▲' : '▼'} {up ? '+' : ''}{d}%</span>
}

function BigCard({ label, value, sub, accent = '#7C3AED', hint, children }: { label: string; value: ReactNode; sub?: ReactNode; accent?: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="tk-glass-tint tk-glass-spine" style={ga(accent, { borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)' })}>
      <p className="section-label" style={{ marginBottom: 6, cursor: hint ? 'help' : undefined }} title={hint}>{label}{hint ? ' ⓘ' : ''}</p>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 900, color: '#F8F8FF', lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</p>
      {sub && <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8 }}>{sub}</p>}
      {children}
    </div>
  )
}

function Stat({ label, value, accent, hint }: { label: string; value: string; accent: string; hint?: string }) {
  return (
    <div className="tk-glass-tint tk-glass-spine" style={ga(accent, { borderRadius: 'var(--radius-lg)', padding: '12px 16px' })}>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 900, color: '#F8F8FF', lineHeight: 1 }}>{value}</p>
      <p className="section-label" style={{ marginTop: 5, cursor: hint ? 'help' : undefined }} title={hint}>{label}{hint ? ' ⓘ' : ''}</p>
    </div>
  )
}

function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mb-4" style={{ flexWrap: 'wrap' }}>
      <span className="section-accent" />
      <h2 className="section-label">{children}</h2>
      {hint && <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>{hint}</span>}
    </div>
  )
}

function Subhead({ children, hint }: { children: ReactNode; hint?: string }) {
  return <p className="section-label" style={{ marginBottom: 10, cursor: hint ? 'help' : undefined }} title={hint}>{children}{hint ? ' ⓘ' : ''}</p>
}

function Bars30({ series }: { series: { date: string; users: number }[] }) {
  if (!series.length) return null
  const max = Math.max(...series.map((d) => d.users), 1)
  return (
    <div className="tk-glass" style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 96 }}>
        {series.map((d, i) => {
          const h = Math.max(2, Math.round((d.users / max) * 92))
          const last = i === series.length - 1
          return <div key={d.date} title={`${d.date}: ${d.users} usuarios`} style={{ flex: 1, height: h, background: last ? '#F472B6' : 'var(--purple)', opacity: last ? 1 : 0.65, borderRadius: 2 }} />
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: 'var(--text-faint)' }}>
        <span>{series[0]?.date.slice(5).replace('-', '/')}</span>
        <span>pico {max}/día</span>
        <span>{series[series.length - 1]?.date.slice(5).replace('-', '/')}</span>
      </div>
    </div>
  )
}

function MiniSpark({ label, values, latest, accent }: { label: string; values: number[]; latest: string; accent: string }) {
  const max = Math.max(...values, 1)
  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <span className="section-label">{label}</span>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: '#F8F8FF', fontSize: 16 }}>{latest}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 40 }}>
        {values.map((v, i) => (
          <div key={i} title={String(v)} style={{ flex: 1, height: Math.max(2, Math.round((v / max) * 38)), background: accent, opacity: i === values.length - 1 ? 1 : 0.5, borderRadius: 2 }} />
        ))}
      </div>
    </div>
  )
}

/** Barras horizontales con %: canales, dispositivos. `hint` → tooltip por fila. */
function BarList({ items }: { items: { label: string; pct: number; hint?: string }[] }) {
  if (!items.length) return null
  const max = Math.max(...items.map((i) => i.pct), 1)
  return (
    <div className="tk-glass" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      {items.map((it, i) => (
        <div key={i} title={it.hint} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none', cursor: it.hint ? 'help' : undefined }}>
          <span style={{ minWidth: 128, fontFamily: 'var(--font-sport)', fontWeight: 700, color: 'var(--text-primary)', fontSize: 12.5 }}>{it.label}{it.hint ? ' ⓘ' : ''}</span>
          <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${Math.round((it.pct / max) * 100)}%`, height: '100%', background: ACCENTS[i % ACCENTS.length], borderRadius: 4 }} />
          </div>
          <span style={{ minWidth: 42, textAlign: 'right', fontFamily: 'var(--font-display)', fontWeight: 800, color: '#F8F8FF', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{it.pct}%</span>
        </div>
      ))}
    </div>
  )
}

function CountryChips({ items }: { items: { country: string; countryCode: string; users: number }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.slice(0, 12).map((c, i) => (
        <span key={i} className="tk-glass" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--radius-full)', color: 'var(--text-secondary)', fontFamily: 'var(--font-sport)', fontSize: 12, fontWeight: 600 }}>
          {flag(c.countryCode)} {c.country} <span style={{ color: '#F8F8FF', fontWeight: 800 }}>{c.users}</span>
        </span>
      ))}
    </div>
  )
}

function RankTable({ rows }: { rows: { label: string; value: string; sub?: string }[] }) {
  if (!rows.length) return <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Sin datos.</p>
  return (
    <div className="tk-glass" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
          <span style={{ flex: 1, color: 'var(--text-secondary)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
          {r.sub && <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>{r.sub}</span>}
          <span style={{ minWidth: 48, textAlign: 'right', fontFamily: 'var(--font-display)', fontWeight: 800, color: '#F8F8FF', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{r.value}</span>
        </div>
      ))}
    </div>
  )
}

function PendingCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)' }}>
      <p style={{ fontFamily: 'var(--font-sport)', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 14, marginBottom: 8 }}>⚪️ {title}</p>
      <div style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6 }}>{children}</div>
    </div>
  )
}

export default async function TraficoPage() {
  await requireAdmin('/admin/trafico')

  const [ga4, searchTotals, search, ios, realtime, history, routes, deploy]: [Ga4Summary, SearchTotals, SearchDetail, AppDownloads, Ga4Realtime, TrafficHistoryDay[], RouteCheck[], DeployStatus] =
    await Promise.all([getGa4Summary(), getSearchTotals(), getSearchDetail(), getAppDownloads(), getGa4Realtime(), getTrafficHistory(), checkRoutes(), checkVercelDeploy()])

  const okCount = routes.filter((r) => r.ok).length

  // ── Alertas ──
  const alerts: { level: 'red' | 'yellow'; msg: string }[] = []
  const downRoutes = routes.filter((r) => !r.ok)
  if (downRoutes.length) alerts.push({ level: 'red', msg: `${downRoutes.length} página(s) de la web no responden: ${downRoutes.map((r) => r.path).join(', ')}` })
  if (deploy.available && !deploy.ok) alerts.push({ level: 'red', msg: `El último deploy está en estado ${deploy.state} (revisa Vercel)` })
  const clicsDelta = deltaPct(searchTotals.d28?.clicks, searchTotals.prevD28?.clicks)
  if (clicsDelta != null && clicsDelta <= -30) alerts.push({ level: 'yellow', msg: `Los clics de Google han bajado ${Math.abs(clicsDelta)}% vs el mes anterior` })
  const visitsDelta = deltaPct(ga4.total28, ga4.prevTotal28)
  if (visitsDelta != null && visitsDelta <= -30) alerts.push({ level: 'yellow', msg: `Las visitas han bajado ${Math.abs(visitsDelta)}% vs el mes anterior` })
  const hasRed = alerts.some((a) => a.level === 'red')

  // ── Periodos para el explorador ──
  const periods: PeriodData[] = [
    { key: '24h', label: '24 horas', metric: { visits: ga4.yesterday ?? null, visitsPrev: ga4.dayBefore ?? null, clics: searchTotals.h24?.clicks ?? null, clicsPrev: null, impressions: searchTotals.h24?.impressions ?? null, impressionsPrev: null } },
    { key: '7d', label: '7 días', metric: { visits: ga4.users7d ?? null, visitsPrev: ga4.prevUsers7d ?? null, clics: searchTotals.d7?.clicks ?? null, clicsPrev: searchTotals.prevD7?.clicks ?? null, impressions: searchTotals.d7?.impressions ?? null, impressionsPrev: searchTotals.prevD7?.impressions ?? null } },
    { key: 'month', label: 'Mes', metric: { visits: ga4.total28 ?? null, visitsPrev: ga4.prevTotal28 ?? null, clics: searchTotals.d28?.clicks ?? null, clicsPrev: searchTotals.prevD28?.clicks ?? null, impressions: searchTotals.d28?.impressions ?? null, impressionsPrev: searchTotals.prevD28?.impressions ?? null } },
    { key: 'total', label: 'Total', metric: { visits: ga4.allTimeUsers ?? null, visitsPrev: null, clics: searchTotals.allTime?.clicks ?? null, clicsPrev: null, impressions: searchTotals.allTime?.impressions ?? null, impressionsPrev: null } },
  ]

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 xl:px-10 pt-10 pb-24">

        {/* Header */}
        <div className="mb-6">
          <Link href="/admin/dashboard" style={{ fontFamily: 'var(--font-sport)', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', textDecoration: 'none' }}>← Dashboard editorial</Link>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 900, color: '#F8F8FF', letterSpacing: '-0.02em', marginTop: 8 }}>Tráfico</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 6 }}>Web y app en un sitio · datos en vivo · {new Date().toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}</p>
        </div>

        {/* 0 · ALERTAS */}
        <div className="tk-glass" style={{ borderRadius: 'var(--radius-lg)', padding: '12px 16px', marginBottom: 24, borderColor: alerts.length ? (hasRed ? 'rgba(239,68,68,0.4)' : 'rgba(234,179,8,0.4)') : 'rgba(34,197,94,0.35)' }}>
          {alerts.length === 0 ? (
            <p style={{ color: '#86EFAC', fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-sport)' }}>🟢 Todo en orden — web operativa y sin caídas de tráfico.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {alerts.map((a, i) => (
                <p key={i} style={{ color: a.level === 'red' ? '#FCA5A5' : '#FDE68A', fontWeight: 700, fontSize: 13.5, fontFamily: 'var(--font-sport)' }}>{a.level === 'red' ? '🔴' : '🟡'} {a.msg}</p>
              ))}
            </div>
          )}
        </div>

        {/* 1 · EXPLORADOR POR PERIODO */}
        <PeriodExplorer periods={periods} />

        {/* 2 · EN VIVO */}
        <RealtimePanel initial={realtime} />

        {/* 3 · VISITAS REALES · GA4 */}
        <section className="mb-12">
          <SectionTitle hint={ga4.available && ga4.via ? `fuente: ${ga4.via === 'service-account' ? 'service account' : 'OAuth'}` : undefined}>Visitas a la web · Google Analytics</SectionTitle>
          {ga4.available ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <BigCard label="Usuarios · ayer" value={<>{nf(ga4.yesterday)}<TrendChip trend={ga4.trend} /></>} sub={`anteayer ${nf(ga4.dayBefore)}`} accent="#7C3AED" hint="Personas distintas que entraron ayer a la web (usuarios activos de Google Analytics)." />
                <BigCard label="Usuarios · 28 días" value={<>{nf(ga4.total28)}<DeltaChip cur={ga4.total28} prev={ga4.prevTotal28} /></>} sub={ga4.prevTotal28 != null ? `mes anterior: ${nf(ga4.prevTotal28)}` : undefined} accent="#8B5CF6" hint="Personas distintas en los últimos 28 días, con el % de cambio frente a los 28 anteriores." />
                <BigCard label="Media · 7 días" value={nf(ga4.avg7)} sub="usuarios/día" accent="#F472B6" />
                <BigCard label="Orgánico · 7d" value={ga4.organicPct == null ? '–' : `${ga4.organicPct}%`} sub="llega desde búsqueda" accent="#60A5FA" hint="% de visitas que llegan desde resultados de búsqueda (Google/Bing) sin pagar anuncios." />
              </div>

              {ga4.series && ga4.series.length > 0 && (
                <div className="mb-6">
                  <Subhead>Usuarios por día · últimos 30 días</Subhead>
                  <Bars30 series={ga4.series} />
                </div>
              )}

              {(ga4.pagesPerSession != null || ga4.avgSessionSec != null || ga4.engagementRate != null) && (
                <div className="mb-6">
                  <Subhead>Calidad de la visita · 28d</Subhead>
                  <div className="grid grid-cols-3 gap-4">
                    <Stat label="Páginas por sesión" value={ga4.pagesPerSession != null ? ga4.pagesPerSession.toFixed(1).replace('.', ',') : '–'} accent="#7C3AED" hint="Cuántas páginas ve de media una persona en cada visita. Más = navega más." />
                    <Stat label="Tiempo medio" value={fmtDur(ga4.avgSessionSec)} accent="#8B5CF6" hint="Cuánto dura de media cada visita." />
                    <Stat label="Interacción" value={ga4.engagementRate != null ? `${Math.round(ga4.engagementRate * 100)}%` : '–'} accent="#F472B6" hint="% de visitas en las que la persona interactuó (no entró y se fue enseguida)." />
                  </div>
                </div>
              )}

              <div className="grid lg:grid-cols-2 gap-6 mb-6">
                {ga4.devices && ga4.devices.length > 0 && (
                  <div><Subhead hint="Con qué aparato entran a la web.">Dispositivos · 28d</Subhead><BarList items={ga4.devices.map((d) => ({ label: DEVICE_LABEL[d.category] ?? d.category, pct: d.pct }))} /></div>
                )}
                {ga4.channels && ga4.channels.length > 0 && (
                  <div><Subhead hint="Cómo llega la gente a la web. Pasa el cursor por cada fila para ver qué significa.">De dónde llega la gente · 7d</Subhead><BarList items={ga4.channels.map((c) => { const info = channelInfo(c.channel); return { label: info.es, pct: c.pct, hint: info.desc } })} /></div>
                )}
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                {ga4.webCountries && ga4.webCountries.length > 0 && (
                  <div><Subhead>Países · 28d</Subhead><CountryChips items={ga4.webCountries} /></div>
                )}
                {ga4.topPages && ga4.topPages.length > 0 && (
                  <div><Subhead>Páginas más vistas · 7d</Subhead><RankTable rows={ga4.topPages.map((p) => ({ label: shortPath(p.path), value: nf(p.views) }))} /></div>
                )}
              </div>
            </>
          ) : (
            <PendingCard title="Visitas GA4 pendientes de conectar">
              {ga4.note && <p style={{ marginBottom: 8 }}>Motivo: <code style={{ fontSize: 12 }}>{ga4.note}</code></p>}
              Añade en Vercel la service account de Google (<code style={{ fontSize: 12 }}>GOOGLE_SA_CLIENT_EMAIL</code> / <code style={{ fontSize: 12 }}>GOOGLE_SA_PRIVATE_KEY</code>). Se enciende tras el redeploy.
            </PendingCard>
          )}
        </section>

        {/* 4 · BÚSQUEDA EN GOOGLE · SEARCH CONSOLE */}
        <section className="mb-12">
          <SectionTitle hint="ventanas que cuadran con la interfaz de Search Console">Búsqueda en Google · Search Console</SectionTitle>
          {searchTotals.available && searchTotals.d28 ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <BigCard label="Clics" value={<>{nf(searchTotals.d28.clicks)}<DeltaChip cur={searchTotals.d28.clicks} prev={searchTotals.prevD28?.clicks} /></>} sub={`24h: ${nf(searchTotals.h24?.clicks)} · 7d: ${nf(searchTotals.d7?.clicks)} · 28d`} accent="#7C3AED" hint="Veces que pincharon tu web en los resultados de Google. Grande = 28 días; abajo 24h y 7d." />
                <BigCard label="Apariciones" value={<>{nf(searchTotals.d28.impressions)}<DeltaChip cur={searchTotals.d28.impressions} prev={searchTotals.prevD28?.impressions} /></>} sub={`24h: ${nf(searchTotals.h24?.impressions)} · 28d`} accent="#8B5CF6" hint="Veces que tu web salió en Google (aunque no pincharan)." />
                <BigCard label="Entran de cada 100" value={pct(searchTotals.d28.ctr)} sub="CTR · 28 días" accent="#F472B6" hint="CTR: de cada 100 que ven tu web en Google, cuántos pinchan." />
                <BigCard label="Puesto medio" value={searchTotals.d28.position ? searchTotals.d28.position.toFixed(1) : '–'} sub="posición · 28 días" accent="#60A5FA" hint="En qué puesto sale tu web de media en Google (1 = arriba del todo)." />
              </div>
              {search.available && (
                <div className="grid lg:grid-cols-2 gap-6">
                  <div><Subhead>Top búsquedas · 7d</Subhead><RankTable rows={(search.topQueries ?? []).map((q) => ({ label: q.key, value: nf(q.clicks), sub: `${nf(q.impressions)} vistas` }))} /></div>
                  <div><Subhead>Páginas top en Google · 7d</Subhead><RankTable rows={(search.topPages ?? []).map((p) => ({ label: p.key.replace(/^https?:\/\/[^/]+/, '') || '/', value: nf(p.clicks), sub: `pos ${p.position.toFixed(0)}` }))} /></div>
                </div>
              )}
            </>
          ) : (
            <PendingCard title="Search Console sin datos">{searchTotals.note ?? 'Google tarda 2-3 días en tener datos.'}</PendingCard>
          )}
        </section>

        {/* 5 · HISTÓRICO UNIFICADO */}
        {history.length > 0 && (
          <section className="mb-12">
            <SectionTitle hint={`${history.length} día${history.length > 1 ? 's' : ''} · crece cada día a las 9:15`}>Histórico</SectionTitle>
            <div className="tk-glass grid md:grid-cols-3 gap-8" style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)' }}>
              <MiniSpark label="Visitas · por día" values={history.map((h) => h.visits ?? 0)} latest={nf(history[history.length - 1]?.visits)} accent="var(--purple)" />
              <MiniSpark label="Clics Google · vent. 7d" values={history.map((h) => h.clics ?? 0)} latest={nf(history[history.length - 1]?.clics)} accent="#8B5CF6" />
              <MiniSpark label="Descargas iOS · total" values={history.map((h) => h.downloads ?? 0)} latest={nf(history[history.length - 1]?.downloads)} accent="#FCD34D" />
            </div>
          </section>
        )}

        {/* 6 · DESCARGAS APP iOS */}
        <section className="mb-12">
          <SectionTitle hint={ios.available && ios.day ? `foto del ${ios.day} · informe diario` : undefined}>Descargas app iOS</SectionTitle>
          {ios.available ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <BigCard label="Total · desde lanzamiento" value={nf(ios.total)} sub={ios.launchDate ? `desde ${ios.launchDate}` : undefined} accent="#FCD34D" />
                <BigCard label="Últimos 7 días" value={<>{nf(ios.d7)}<DeltaChip cur={ios.d7} prev={ios.prev7d} /></>} sub={ios.prev7d != null ? `7d antes: ${nf(ios.prev7d)}` : undefined} accent="#86EFAC" />
                <BigCard label="Ayer" value={nf(ios.yesterday)} accent="#60A5FA" />
                <BigCard label="Plataforma" value={<span style={{ fontSize: '1rem', fontFamily: 'var(--font-sport)' }}>iOS · App Store</span>} sub="Android: próximamente" accent="#F472B6" />
              </div>
              {ios.countries && ios.countries.length > 0 && (
                <div><Subhead>Por país · desde lanzamiento</Subhead><CountryChips items={ios.countries.map(([code, n]) => ({ country: code, countryCode: code, users: n }))} /></div>
              )}
            </>
          ) : (
            <PendingCard title="Descargas iOS — aún sin datos">
              {ios.note && <p style={{ marginBottom: 8 }}>{ios.note}</p>}
              El informe diario de taka-system (9:15) guarda las descargas en Supabase y este bloque las lee. También en{' '}
              <a href="https://appstoreconnect.apple.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--purple)', textDecoration: 'underline' }}>App Store Connect</a>.
            </PendingCard>
          )}
        </section>

        {/* 7 · SALUD WEB */}
        <section>
          <SectionTitle>Salud de la web</SectionTitle>
          <div className="tk-glass" style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: routes.every((r) => r.ok) ? '#86EFAC' : '#FCA5A5', fontSize: 18 }}>
              {okCount}/{routes.length} páginas OK
              {deploy.available && <span style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: 14 }}> · deploy {deploy.state}</span>}
            </p>
            <div className="flex flex-wrap gap-2" style={{ marginTop: 12 }}>
              {routes.map((r) => (
                <span key={r.path} style={{ padding: '4px 10px', borderRadius: 'var(--radius-full)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', fontSize: 11, fontFamily: 'var(--font-sport)', color: r.ok ? 'var(--text-secondary)' : '#FCA5A5' }}>
                  {r.ok ? '✓' : '✕'} {r.path} <span style={{ color: 'var(--text-faint)' }}>{r.status ?? 'timeout'}</span>
                </span>
              ))}
            </div>
          </div>
        </section>

      </main>
    </div>
  )
}
