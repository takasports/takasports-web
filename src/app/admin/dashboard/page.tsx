// /admin/dashboard?token=XXX
// Dashboard editorial protegido. Muestra métricas básicas para tomar
// decisiones de contenido: artículos publicados, top tags, push subs,
// plays por juego, reels indexados, newsletter subs.
//
// Protección: ?token=$RANKINGS_ADMIN_TOKEN (mismo patrón que /admin/rankings).
// Sin token o token erróneo → redirect a /?admin=unauthorized.

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { sanityClient } from '@/lib/sanity'
import { adminSupabase } from '@/lib/supabase-admin'
import { getMergedReels } from '@/lib/reels-feed'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Dashboard editorial — TakaSports',
  robots: { index: false, follow: false },
}

type SP = { token?: string | string[] }

interface TagCount { tag: string; count: number }
interface GameCount { game_id: string; plays: number }

const COUNT_ARTICLES_24H = `count(*[_type=="article" && (status=="publicado" || defined(headline)) && publishedAt > $since])`
const COUNT_ARTICLES_7D = `count(*[_type=="article" && (status=="publicado" || defined(headline)) && publishedAt > $since])`

const TAGS_QUERY = `
  *[_type=="article" && (status=="publicado" || defined(headline)) && publishedAt > $since && defined(tags)][0...200] { tags }
`

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

async function fetchSanityCount(query: string, since: string): Promise<number> {
  try {
    const r = await sanityClient.fetch<number>(query, { since })
    return typeof r === 'number' ? r : 0
  } catch {
    return 0
  }
}

async function fetchTopTags(): Promise<TagCount[]> {
  try {
    const rows = await sanityClient.fetch<Array<{ tags?: string[] | null }>>(
      TAGS_QUERY,
      { since: isoDaysAgo(30) },
    )
    const counter = new Map<string, number>()
    for (const r of rows ?? []) {
      if (!Array.isArray(r.tags)) continue
      for (const t of r.tags) {
        if (typeof t !== 'string' || !t.trim()) continue
        counter.set(t, (counter.get(t) ?? 0) + 1)
      }
    }
    return Array.from(counter.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  } catch {
    return []
  }
}

async function fetchPushSubsTotal(): Promise<number> {
  const supa = adminSupabase()
  if (!supa) return 0
  const { count } = await supa.from('push_subscriptions').select('*', { count: 'exact', head: true })
  return count ?? 0
}

async function fetchNewsletterTotal(): Promise<number> {
  const supa = adminSupabase()
  if (!supa) return 0
  const { count } = await supa
    .from('newsletter_subscribers')
    .select('*', { count: 'exact', head: true })
    .is('unsubscribed_at', null)
  return count ?? 0
}

async function fetchPlaysByGame(): Promise<GameCount[]> {
  const supa = adminSupabase()
  if (!supa) return []
  const since = isoDaysAgo(7)
  const { data } = await supa
    .from('game_plays')
    .select('game_id')
    .gte('created_at', since)
  if (!Array.isArray(data)) return []
  const counter = new Map<string, number>()
  for (const row of data) {
    const id = (row as { game_id?: string }).game_id
    if (!id) continue
    counter.set(id, (counter.get(id) ?? 0) + 1)
  }
  return Array.from(counter.entries())
    .map(([game_id, plays]) => ({ game_id, plays }))
    .sort((a, b) => b.plays - a.plays)
}

interface MetricCardProps {
  label: string
  value: string | number
  hint?: string
  accent?: string
}
function MetricCard({ label, value, hint, accent = 'var(--purple)' }: MetricCardProps) {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${accent}`,
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-lg)',
      }}
    >
      <p className="section-label" style={{ marginBottom: 6 }}>{label}</p>
      <p
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
          fontWeight: 900,
          color: '#F8F8FF',
          lineHeight: 1,
          letterSpacing: '-0.02em',
        }}
      >
        {value}
      </p>
      {hint && (
        <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8 }}>{hint}</p>
      )}
    </div>
  )
}

export default async function AdminDashboardPage(
  { searchParams }: { searchParams: Promise<SP> },
) {
  const sp = await searchParams
  const token = Array.isArray(sp.token) ? sp.token[0] : (sp.token ?? '')
  const expected = process.env.RANKINGS_ADMIN_TOKEN
  if (!token || !expected || token !== expected) {
    redirect('/?admin=unauthorized')
  }

  // Datos en paralelo — cada uno con su catch defensivo
  const [
    articles24h,
    articles7d,
    topTags,
    pushSubs,
    newsletterSubs,
    playsByGame,
    reelsIndexed,
  ] = await Promise.all([
    fetchSanityCount(COUNT_ARTICLES_24H, isoDaysAgo(1)),
    fetchSanityCount(COUNT_ARTICLES_7D, isoDaysAgo(7)),
    fetchTopTags(),
    fetchPushSubsTotal(),
    fetchNewsletterTotal(),
    fetchPlaysByGame(),
    getMergedReels().then(r => r.length).catch(() => 0),
  ])

  const totalPlays7d = playsByGame.reduce((acc, g) => acc + g.plays, 0)

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 xl:px-10 pt-10 pb-24">

        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/admin/rankings?token=${encodeURIComponent(token)}`}
            style={{
              fontFamily: 'var(--font-sport)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              textDecoration: 'none',
            }}
          >
            ← Admin rankings
          </Link>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              fontWeight: 900,
              color: '#F8F8FF',
              letterSpacing: '-0.02em',
              marginTop: 8,
            }}
          >
            Dashboard editorial
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 6 }}>
            Métricas en vivo. Generadas en {new Date().toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}.
          </p>
        </div>

        {/* Métricas principales */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <MetricCard label="Artículos · 24h" value={articles24h} accent="#7C3AED" />
          <MetricCard label="Artículos · 7d" value={articles7d} accent="#8B5CF6" hint={`media ${(articles7d / 7).toFixed(1)}/día`} />
          <MetricCard label="Reels indexados" value={reelsIndexed} accent="#F472B6" hint="getMergedReels" />
          <MetricCard label="Push subs" value={pushSubs} accent="#FCD34D" />
          <MetricCard label="Newsletter subs" value={newsletterSubs} accent="#86EFAC" hint="activos (sin baja)" />
          <MetricCard label="Plays totales · 7d" value={totalPlays7d} accent="#60A5FA" />
        </div>

        {/* Plays por juego */}
        <section className="mb-10">
          <div className="flex items-center gap-2.5 mb-4">
            <span className="section-accent" />
            <h2 className="section-label">Plays por juego · últimos 7 días</h2>
          </div>
          {playsByGame.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Sin datos.</p>
          ) : (
            <div
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
              }}
            >
              {playsByGame.map((g, i) => {
                const max = playsByGame[0]?.plays || 1
                const pct = Math.round((g.plays / max) * 100)
                return (
                  <div
                    key={g.game_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 16px',
                      borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <span style={{ minWidth: 110, fontFamily: 'var(--font-sport)', fontWeight: 700, color: 'var(--text-primary)', fontSize: 13 }}>
                      {g.game_id}
                    </span>
                    <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: 'var(--purple)', borderRadius: 4 }} />
                    </div>
                    <span style={{ minWidth: 60, textAlign: 'right', fontFamily: 'var(--font-display)', fontWeight: 800, color: '#F8F8FF', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
                      {g.plays}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Top tags */}
        <section>
          <div className="flex items-center gap-2.5 mb-4">
            <span className="section-accent" />
            <h2 className="section-label">Top tags · últimos 30 días</h2>
          </div>
          {topTags.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Sin tags en el período.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {topTags.map(({ tag, count }) => (
                <Link
                  key={tag}
                  href={`/tag/${encodeURIComponent(tag)}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-full)',
                    background: 'rgba(255,255,255,0.05)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border)',
                    fontFamily: 'var(--font-sport)',
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: '0.03em',
                    textDecoration: 'none',
                  }}
                >
                  #{tag}
                  <span style={{ color: 'var(--text-faint)', fontSize: 10, fontWeight: 700 }}>{count}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

      </main>
    </div>
  )
}
