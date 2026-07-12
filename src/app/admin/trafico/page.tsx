// /admin/trafico
// Panel ÚNICO de tráfico. Junta en una pantalla lo que antes estaba disperso:
//
//   • Visitas reales (GA4 Data API)       → gente que ENTRA a la web
//     └ usuarios/día, de dónde llegan (canales), páginas más vistas
//   • Búsqueda en Google (Search Console) → apariciones y clics EN Google
//     └ totales, top búsquedas, top páginas
//   • Descargas app iOS (App Store)       → pendiente de conectar aquí
//   • Salud web (deploy + rutas)          → que todo responda
//
// Protección: misma allowlist de admin que el resto de /admin.
// Degradación elegante: si a un bloque le falta credencial, muestra "pendiente"
// con los pasos para activarlo, en vez de romper la página.

import type { ReactNode } from 'react'
import Link from 'next/link'
import { requireAdmin } from '@/lib/admin-auth'
import { getGa4Summary, getSearchDetail, shortPath, type Ga4Summary, type SearchDetail } from '@/lib/traffic'
import {
  getTrafficSummary,
  checkRoutes,
  checkVercelDeploy,
  type TrafficSummary,
  type RouteCheck,
  type DeployStatus,
} from '@/lib/seo-audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Tráfico — TakaSports',
  robots: { index: false, follow: false },
}

const nf = (n?: number | null) => (n == null ? '–' : Math.round(n).toLocaleString('es-ES'))
const pct = (ctr?: number | null) => (ctr == null ? '–' : `${(ctr * 100).toFixed(1).replace('.', ',')}%`)

const ACCENTS = ['#7C3AED', '#8B5CF6', '#F472B6', '#60A5FA', '#86EFAC', '#FCD34D']

function TrendChip({ trend }: { trend?: 'up' | 'down' | 'flat' }) {
  if (!trend) return null
  const map = { up: { t: '▲', c: '#86EFAC' }, down: { t: '▼', c: '#FCA5A5' }, flat: { t: '▶', c: 'var(--text-muted)' } }
  const { t, c } = map[trend]
  return <span style={{ color: c, fontSize: 13, fontWeight: 800, marginLeft: 8 }}>{t}</span>
}

function BigCard({
  label, value, sub, accent = 'var(--purple)', children,
}: { label: string; value: ReactNode; sub?: ReactNode; accent?: string; children?: ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: `3px solid ${accent}`, borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)' }}>
      <p className="section-label" style={{ marginBottom: 6 }}>{label}</p>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 900, color: '#F8F8FF', lineHeight: 1, letterSpacing: '-0.02em' }}>
        {value}
      </p>
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

function Sparkbars({ series }: { series: { date: string; users: number }[] }) {
  if (!series.length) return null
  const max = Math.max(...series.map((d) => d.users), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 48, marginTop: 14 }}>
      {series.map((d) => {
        const h = Math.max(3, Math.round((d.users / max) * 46))
        return (
          <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div title={`${d.date}: ${d.users}`} style={{ width: '100%', height: h, background: 'var(--purple)', borderRadius: 3, opacity: 0.85 }} />
            <span style={{ fontSize: 9, color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums' }}>{d.date.slice(8, 10)}</span>
          </div>
        )
      })}
    </div>
  )
}

/** Barras horizontales (canales, con %). */
function ChannelBars({ channels }: { channels: { channel: string; users: number; pct: number }[] }) {
  const max = Math.max(...channels.map((c) => c.pct), 1)
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      {channels.map((c, i) => (
        <div key={c.channel} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
          <span style={{ minWidth: 120, fontFamily: 'var(--font-sport)', fontWeight: 700, color: 'var(--text-primary)', fontSize: 12.5 }}>{c.channel}</span>
          <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${Math.round((c.pct / max) * 100)}%`, height: '100%', background: ACCENTS[i % ACCENTS.length], borderRadius: 4 }} />
          </div>
          <span style={{ minWidth: 42, textAlign: 'right', fontFamily: 'var(--font-display)', fontWeight: 800, color: '#F8F8FF', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{c.pct}%</span>
        </div>
      ))}
    </div>
  )
}

/** Tabla compacta: etiqueta + valor (top páginas / búsquedas). */
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

  const [ga4, gsc, search, routes, deploy]: [Ga4Summary, TrafficSummary, SearchDetail, RouteCheck[], DeployStatus] =
    await Promise.all([getGa4Summary(), getTrafficSummary(), getSearchDetail(), checkRoutes(), checkVercelDeploy()])

  const okCount = routes.filter((r) => r.ok).length

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 xl:px-10 pt-10 pb-24">

        {/* Header */}
        <div className="mb-6">
          <Link href="/admin/dashboard" style={{ fontFamily: 'var(--font-sport)', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', textDecoration: 'none' }}>
            ← Dashboard editorial
          </Link>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 900, color: '#F8F8FF', letterSpacing: '-0.02em', marginTop: 8 }}>
            Tráfico
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 6 }}>
            Todo en un sitio. Datos en vivo · {new Date().toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}.
          </p>
        </div>

        {/* Explicador */}
        <div style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '12px 16px', marginBottom: 32, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <b style={{ color: 'var(--text-primary)' }}>Cada bloque mide algo distinto</b> — es normal que los números no coincidan:
          <b> Visitas (GA4)</b> = personas que entran a la web · <b>Búsqueda (Search Console)</b> = apariciones y clics en Google ·
          <b> Descargas</b> = instalaciones de la app iOS.
        </div>

        {/* ── VISITAS REALES · GA4 ── */}
        <section className="mb-12">
          <SectionTitle hint={ga4.available && ga4.via ? `fuente: ${ga4.via === 'service-account' ? 'service account' : 'OAuth'}` : undefined}>
            Visitas reales · Google Analytics
          </SectionTitle>
          {ga4.available ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <BigCard label="Usuarios · ayer" value={<>{nf(ga4.yesterday)}<TrendChip trend={ga4.trend} /></>} sub={`anteayer ${nf(ga4.dayBefore)}`} accent="#7C3AED">
                  {ga4.series && <Sparkbars series={ga4.series} />}
                </BigCard>
                <BigCard label="Media · 7 días" value={nf(ga4.avg7)} sub="usuarios activos/día" accent="#8B5CF6" />
                <BigCard label="Orgánico · 7d" value={ga4.organicPct == null ? '–' : `${ga4.organicPct}%`} sub="llega desde búsqueda de Google" accent="#F472B6" />
                <BigCard label="Propiedad GA4" value={<span style={{ fontSize: '1rem', fontFamily: 'var(--font-sport)' }}>{ga4.propertyId}</span>} sub={ga4.measurementId ? `tag ${ga4.measurementId}` : undefined} accent="#60A5FA" />
              </div>
              <div className="grid lg:grid-cols-2 gap-6">
                {ga4.channels && ga4.channels.length > 0 && (
                  <div>
                    <p className="section-label" style={{ marginBottom: 10 }}>De dónde llega la gente · 7d</p>
                    <ChannelBars channels={ga4.channels} />
                  </div>
                )}
                {ga4.topPages && ga4.topPages.length > 0 && (
                  <div>
                    <p className="section-label" style={{ marginBottom: 10 }}>Páginas más vistas · 7d</p>
                    <RankTable rows={ga4.topPages.map((p) => ({ label: shortPath(p.path), value: nf(p.views) }))} />
                  </div>
                )}
              </div>
            </>
          ) : (
            <PendingCard title="Visitas GA4 pendientes de conectar">
              {ga4.note && <p style={{ marginBottom: 8 }}>Motivo: <code style={{ fontSize: 12 }}>{ga4.note}</code></p>}
              Añade en Vercel la <b>service account de Google</b> (la misma que usa tu informe diario, <code style={{ fontSize: 12 }}>taka-report@…</code>):
              copia <code style={{ fontSize: 12 }}>client_email</code> → <code style={{ fontSize: 12 }}>GOOGLE_SA_CLIENT_EMAIL</code> y{' '}
              <code style={{ fontSize: 12 }}>private_key</code> → <code style={{ fontSize: 12 }}>GOOGLE_SA_PRIVATE_KEY</code>. Ya tiene acceso a la propiedad{' '}
              <b>{ga4.propertyId}</b>, así que se enciende solo tras redeploy.
            </PendingCard>
          )}
        </section>

        {/* ── BÚSQUEDA EN GOOGLE · SEARCH CONSOLE ── */}
        <section className="mb-12">
          <SectionTitle>Búsqueda en Google · Search Console</SectionTitle>
          {gsc.available && gsc.lastDay ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <BigCard label="Apariciones" value={nf(gsc.impressions)} sub={`media 7d ${nf(gsc.avgImpressions7)}`} accent="#7C3AED" />
                <BigCard label="Clics" value={<>{nf(gsc.clicks)}<TrendChip trend={gsc.clicksTrend} /></>} sub={`media 7d ${nf(gsc.avgClicks7)}`} accent="#8B5CF6" />
                <BigCard label="Entran de cada 100" value={pct(gsc.ctr)} sub={`media 7d ${pct(gsc.avgCtr7)}`} accent="#F472B6" />
                <BigCard label="Puesto medio" value={gsc.position?.toFixed(1) ?? '–'} sub={`media 7d ${gsc.avgPosition7?.toFixed(1) ?? '–'}`} accent="#60A5FA" />
              </div>
              {search.available && (
                <div className="grid lg:grid-cols-2 gap-6">
                  <div>
                    <p className="section-label" style={{ marginBottom: 10 }}>Top búsquedas · 7d</p>
                    <RankTable rows={(search.topQueries ?? []).map((q) => ({ label: q.key, value: nf(q.clicks), sub: `${nf(q.impressions)} vistas` }))} />
                  </div>
                  <div>
                    <p className="section-label" style={{ marginBottom: 10 }}>Páginas top en Google · 7d</p>
                    <RankTable rows={(search.topPages ?? []).map((p) => ({ label: p.key.replace(/^https?:\/\/[^/]+/, '') || '/', value: nf(p.clicks), sub: `pos ${p.position.toFixed(0)}` }))} />
                  </div>
                </div>
              )}
              {gsc.opportunity && (
                <p style={{ marginTop: 16, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  💡 <b>Tarea:</b> &quot;{gsc.opportunity.query}&quot; te ve {nf(gsc.opportunity.impressions)} veces pero casi nadie entra ({pct(gsc.opportunity.ctr)}) → mejora su título en Sanity.
                </p>
              )}
            </>
          ) : (
            <PendingCard title="Search Console sin datos">{gsc.note ?? 'Google tarda 2-3 días en tener datos.'}</PendingCard>
          )}
        </section>

        {/* ── DESCARGAS APP iOS ── */}
        <section className="mb-12">
          <SectionTitle>Descargas app iOS</SectionTitle>
          <PendingCard title="App Store aún no conectada a este panel">
            Las descargas se ven ahora en el <b>informe diario de Telegram</b> (taka-system, 9:15) y en{' '}
            <a href="https://appstoreconnect.apple.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--purple)', textDecoration: 'underline' }}>App Store Connect</a>.
            Se conectarán aquí en la siguiente fase (App Store Connect · Sales Reports API).
          </PendingCard>
        </section>

        {/* ── SALUD WEB ── */}
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
