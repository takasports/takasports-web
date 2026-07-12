// /admin/trafico
// Panel ÚNICO de tráfico web + app. Esquema (de arriba abajo):
//   1. Resumen        — 4 KPIs de un vistazo (ahora, ayer, clics 24h, descargas)
//   2. EN VIVO        — quién está ahora, de dónde, en qué página (auto-refresco)
//   3. Visitas (GA4)  — 30 días + dispositivos + canales + países + top páginas
//   4. Búsqueda (GSC) — clics 24h/7d/28d + top búsquedas y páginas
//   5. Descargas iOS  — total/7d/ayer + países (vía Supabase, informe diario)
//   6. Salud web      — rutas + deploy
//
// Protección: allowlist ADMIN_EMAILS. Degradación elegante bloque a bloque.

import type { ReactNode } from 'react'
import Link from 'next/link'
import { requireAdmin } from '@/lib/admin-auth'
import RealtimePanel from './RealtimePanel'
import {
  getGa4Summary, getSearchDetail, getSearchTotals, getGa4Realtime, getAppDownloads, shortPath,
  type Ga4Summary, type SearchDetail, type SearchTotals, type Ga4Realtime, type AppDownloads,
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

const ACCENTS = ['#7C3AED', '#8B5CF6', '#F472B6', '#60A5FA', '#86EFAC', '#FCD34D']
const DEVICE_LABEL: Record<string, string> = { mobile: '📱 Móvil', desktop: '💻 Escritorio', tablet: '📲 Tablet', smart_tv: '📺 TV' }

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

function KpiMini({ icon, label, value, sub, accent }: { icon: string; label: string; value: ReactNode; sub?: string; accent: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: `3px solid ${accent}`, borderRadius: 'var(--radius-lg)', padding: '14px 16px' }}>
      <span style={{ fontSize: 24, lineHeight: 1 }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.7rem', fontWeight: 900, color: '#F8F8FF', lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</p>
        <p className="section-label" style={{ marginTop: 4 }}>{label}</p>
        {sub && <p style={{ color: 'var(--text-faint)', fontSize: 11, marginTop: 2 }}>{sub}</p>}
      </div>
    </div>
  )
}

function BigCard({ label, value, sub, accent = 'var(--purple)', children }: { label: string; value: ReactNode; sub?: ReactNode; accent?: string; children?: ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: `3px solid ${accent}`, borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)' }}>
      <p className="section-label" style={{ marginBottom: 6 }}>{label}</p>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 900, color: '#F8F8FF', lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</p>
      {sub && <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8 }}>{sub}</p>}
      {children}
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

/** Gráfica de barras de 30 días (última barra resaltada). */
function Bars30({ series }: { series: { date: string; users: number }[] }) {
  if (!series.length) return null
  const max = Math.max(...series.map((d) => d.users), 1)
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)' }}>
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

/** Barras horizontales con %: canales, dispositivos. */
function BarList({ items }: { items: { label: string; pct: number }[] }) {
  if (!items.length) return null
  const max = Math.max(...items.map((i) => i.pct), 1)
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
          <span style={{ minWidth: 128, fontFamily: 'var(--font-sport)', fontWeight: 700, color: 'var(--text-primary)', fontSize: 12.5 }}>{it.label}</span>
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
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--radius-full)', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontFamily: 'var(--font-sport)', fontSize: 12, fontWeight: 600 }}>
          {flag(c.countryCode)} {c.country} <span style={{ color: '#F8F8FF', fontWeight: 800 }}>{c.users}</span>
        </span>
      ))}
    </div>
  )
}

function RankTable({ rows }: { rows: { label: string; value: string; sub?: string }[] }) {
  if (!rows.length) return <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Sin datos.</p>
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
          <span style={{ flex: 1, color: 'var(--text-secondary)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
          {r.sub && <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>{r.sub}</span>}
          <span style={{ minWidth: 48, textAlign: 'right', fontFamily: 'var(--font-display)', fontWeight: 800, color: '#F8F8FF', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{r.value}</span>
        </div>
      ))}
    </div>
  )
}

function Subhead({ children }: { children: ReactNode }) {
  return <p className="section-label" style={{ marginBottom: 10 }}>{children}</p>
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

  const [ga4, searchTotals, search, ios, realtime, routes, deploy]: [Ga4Summary, SearchTotals, SearchDetail, AppDownloads, Ga4Realtime, RouteCheck[], DeployStatus] =
    await Promise.all([getGa4Summary(), getSearchTotals(), getSearchDetail(), getAppDownloads(), getGa4Realtime(), checkRoutes(), checkVercelDeploy()])

  const okCount = routes.filter((r) => r.ok).length

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 xl:px-10 pt-10 pb-24">

        {/* Header */}
        <div className="mb-6">
          <Link href="/admin/dashboard" style={{ fontFamily: 'var(--font-sport)', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', textDecoration: 'none' }}>← Dashboard editorial</Link>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 900, color: '#F8F8FF', letterSpacing: '-0.02em', marginTop: 8 }}>Tráfico</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 6 }}>Web y app en un sitio · datos en vivo · {new Date().toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}</p>
        </div>

        {/* 1 · RESUMEN */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KpiMini icon="🟢" label="Ahora en la web" value={realtime.available ? realtime.activeUsers : '–'} sub="tiempo real" accent="#22C55E" />
          <KpiMini icon="👥" label="Visitas · ayer" value={ga4.available ? nf(ga4.yesterday) : '–'} sub={ga4.available ? `28 días: ${nf(ga4.total28)}` : 'GA4 pendiente'} accent="#7C3AED" />
          <KpiMini icon="🔍" label="Clics Google · 24h" value={searchTotals.h24 ? nf(searchTotals.h24.clicks) : '–'} sub={searchTotals.d7 ? `7 días: ${nf(searchTotals.d7.clicks)}` : undefined} accent="#8B5CF6" />
          <KpiMini icon="📱" label="Descargas iOS" value={ios.available ? nf(ios.total) : '–'} sub={ios.available ? 'desde el lanzamiento' : 'pendiente'} accent="#FCD34D" />
        </div>

        {/* 2 · EN VIVO */}
        <RealtimePanel initial={realtime} />

        {/* 3 · VISITAS REALES · GA4 */}
        <section className="mb-12">
          <SectionTitle hint={ga4.available && ga4.via ? `fuente: ${ga4.via === 'service-account' ? 'service account' : 'OAuth'}` : undefined}>Visitas a la web · Google Analytics</SectionTitle>
          {ga4.available ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <BigCard label="Usuarios · ayer" value={<>{nf(ga4.yesterday)}<TrendChip trend={ga4.trend} /></>} sub={`anteayer ${nf(ga4.dayBefore)}`} accent="#7C3AED" />
                <BigCard label="Usuarios · 28 días" value={nf(ga4.total28)} sub={ga4.newUsers28 != null ? `${nf(ga4.newUsers28)} nuevos` : undefined} accent="#8B5CF6" />
                <BigCard label="Media · 7 días" value={nf(ga4.avg7)} sub="usuarios/día" accent="#F472B6" />
                <BigCard label="Orgánico · 7d" value={ga4.organicPct == null ? '–' : `${ga4.organicPct}%`} sub="llega desde búsqueda" accent="#60A5FA" />
              </div>

              {ga4.series && ga4.series.length > 0 && (
                <div className="mb-6">
                  <Subhead>Usuarios por día · últimos 30 días</Subhead>
                  <Bars30 series={ga4.series} />
                </div>
              )}

              <div className="grid lg:grid-cols-2 gap-6 mb-6">
                {ga4.devices && ga4.devices.length > 0 && (
                  <div>
                    <Subhead>Dispositivos · 28d</Subhead>
                    <BarList items={ga4.devices.map((d) => ({ label: DEVICE_LABEL[d.category] ?? d.category, pct: d.pct }))} />
                  </div>
                )}
                {ga4.channels && ga4.channels.length > 0 && (
                  <div>
                    <Subhead>De dónde llega la gente · 7d</Subhead>
                    <BarList items={ga4.channels.map((c) => ({ label: c.channel, pct: c.pct }))} />
                  </div>
                )}
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                {ga4.webCountries && ga4.webCountries.length > 0 && (
                  <div>
                    <Subhead>Países · 28d</Subhead>
                    <CountryChips items={ga4.webCountries} />
                  </div>
                )}
                {ga4.topPages && ga4.topPages.length > 0 && (
                  <div>
                    <Subhead>Páginas más vistas · 7d</Subhead>
                    <RankTable rows={ga4.topPages.map((p) => ({ label: shortPath(p.path), value: nf(p.views) }))} />
                  </div>
                )}
              </div>
            </>
          ) : (
            <PendingCard title="Visitas GA4 pendientes de conectar">
              {ga4.note && <p style={{ marginBottom: 8 }}>Motivo: <code style={{ fontSize: 12 }}>{ga4.note}</code></p>}
              Añade en Vercel la service account de Google (<code style={{ fontSize: 12 }}>GOOGLE_SA_CLIENT_EMAIL</code> / <code style={{ fontSize: 12 }}>GOOGLE_SA_PRIVATE_KEY</code>) — la misma de tu informe diario. Se enciende tras el redeploy.
            </PendingCard>
          )}
        </section>

        {/* 4 · BÚSQUEDA EN GOOGLE · SEARCH CONSOLE */}
        <section className="mb-12">
          <SectionTitle hint="ventanas que cuadran con la interfaz de Search Console">Búsqueda en Google · Search Console</SectionTitle>
          {searchTotals.available && searchTotals.d28 ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <BigCard label="Clics" value={nf(searchTotals.d28.clicks)} sub={`24h: ${nf(searchTotals.h24?.clicks)} · 7d: ${nf(searchTotals.d7?.clicks)} · 28d`} accent="#7C3AED" />
                <BigCard label="Apariciones" value={nf(searchTotals.d28.impressions)} sub={`24h: ${nf(searchTotals.h24?.impressions)} · 28d`} accent="#8B5CF6" />
                <BigCard label="Entran de cada 100" value={pct(searchTotals.d28.ctr)} sub="CTR · 28 días" accent="#F472B6" />
                <BigCard label="Puesto medio" value={searchTotals.d28.position ? searchTotals.d28.position.toFixed(1) : '–'} sub="posición · 28 días" accent="#60A5FA" />
              </div>
              {search.available && (
                <div className="grid lg:grid-cols-2 gap-6">
                  <div>
                    <Subhead>Top búsquedas · 7d</Subhead>
                    <RankTable rows={(search.topQueries ?? []).map((q) => ({ label: q.key, value: nf(q.clicks), sub: `${nf(q.impressions)} vistas` }))} />
                  </div>
                  <div>
                    <Subhead>Páginas top en Google · 7d</Subhead>
                    <RankTable rows={(search.topPages ?? []).map((p) => ({ label: p.key.replace(/^https?:\/\/[^/]+/, '') || '/', value: nf(p.clicks), sub: `pos ${p.position.toFixed(0)}` }))} />
                  </div>
                </div>
              )}
            </>
          ) : (
            <PendingCard title="Search Console sin datos">{searchTotals.note ?? 'Google tarda 2-3 días en tener datos.'}</PendingCard>
          )}
        </section>

        {/* 5 · DESCARGAS APP iOS */}
        <section className="mb-12">
          <SectionTitle hint={ios.available && ios.day ? `foto del ${ios.day} · informe diario` : undefined}>Descargas app iOS</SectionTitle>
          {ios.available ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <BigCard label="Total · desde lanzamiento" value={nf(ios.total)} sub={ios.launchDate ? `desde ${ios.launchDate}` : undefined} accent="#FCD34D" />
                <BigCard label="Últimos 7 días" value={nf(ios.d7)} accent="#86EFAC" />
                <BigCard label="Ayer" value={nf(ios.yesterday)} accent="#60A5FA" />
                <BigCard label="Plataforma" value={<span style={{ fontSize: '1rem', fontFamily: 'var(--font-sport)' }}>iOS · App Store</span>} sub="Android: próximamente" accent="#F472B6" />
              </div>
              {ios.countries && ios.countries.length > 0 && (
                <div>
                  <Subhead>Por país · desde lanzamiento</Subhead>
                  <CountryChips items={ios.countries.map(([code, n]) => ({ country: code, countryCode: code, users: n }))} />
                </div>
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

        {/* 6 · SALUD WEB */}
        <section>
          <SectionTitle>Salud de la web</SectionTitle>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)' }}>
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
