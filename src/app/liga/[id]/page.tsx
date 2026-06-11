import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import Header from '@/components/Header'
import LiveStrip from '@/components/LiveStrip'
import Footer from '@/components/Footer'
import { ShareButton } from '@/components/ShareButton'
import { SITE_URL, SITE_NAME } from '@/lib/constants'

export const revalidate = 1800

interface LeagueDef {
  id: string
  label: string
  tableBlockId: string
  leagueSlug: string         // ESPN slug, e.g. "soccer/esp.1"
  playersKey: string         // /api/stats/players league.id
  accent: string
}

const LEAGUES: Record<string, LeagueDef> = {
  'esp.1':   { id: 'esp.1',   label: 'LaLiga',         tableBlockId: 'tabla-laliga',     leagueSlug: 'soccer/esp.1', playersKey: 'esp.1', accent: '#ef4444' },
  'eng.1':   { id: 'eng.1',   label: 'Premier League', tableBlockId: 'tabla-premier',    leagueSlug: 'soccer/eng.1', playersKey: 'eng.1', accent: '#a78bfa' },
  'ita.1':   { id: 'ita.1',   label: 'Serie A',        tableBlockId: 'tabla-serie-a',    leagueSlug: 'soccer/ita.1', playersKey: 'ita.1', accent: '#22c55e' },
  'ger.1':   { id: 'ger.1',   label: 'Bundesliga',     tableBlockId: 'tabla-bundesliga', leagueSlug: 'soccer/ger.1', playersKey: 'ger.1', accent: '#f59e0b' },
  'fra.1':   { id: 'fra.1',   label: 'Ligue 1',        tableBlockId: 'tabla-ligue1',     leagueSlug: 'soccer/fra.1', playersKey: 'fra.1', accent: '#3b82f6' },
}

export function generateStaticParams() {
  return Object.keys(LEAGUES).map(id => ({ id }))
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const lg = LEAGUES[id]
  if (!lg) return { title: 'Liga | TakaSports' }
  const title = `${lg.label} · Clasificación, goleadores y asistencias | TakaSports`
  const description = `Tabla en vivo de ${lg.label}, máximos goleadores y mejores asistentes de la temporada.`
  return {
    title, description,
    alternates: { canonical: `${SITE_URL}/liga/${id}` },
    openGraph: { title, description, type: 'website', siteName: SITE_NAME },
  }
}

function apiBase(): string {
  return process.env.NEXT_PUBLIC_SITE_URL
    ?? (process.env.NODE_ENV === 'production' ? SITE_URL : 'http://localhost:3000')
}

interface StandRow {
  rank: number; name: string; abbr: string; value: string
  extra: Record<string, string>; teamId?: string; logo?: string
}
interface PlayerRow { name: string; team: string; value: number; matches: number; playerId?: string; teamLogo?: string; leagueSlug?: string }

async function fetchData(def: LeagueDef): Promise<{ rows: StandRow[]; goals: PlayerRow[]; assists: PlayerRow[] }> {
  const base = apiBase()
  try {
    const [standRes, playRes] = await Promise.all([
      fetch(`${base}/api/stats/standings`, { next: { revalidate: 1800 } }),
      fetch(`${base}/api/stats/players`, { next: { revalidate: 1800 } }),
    ])
    const stand = standRes.ok ? await standRes.json() : {}
    const play  = playRes.ok  ? await playRes.json()  : {}
    const group = (stand.football ?? []).find((g: { id: string }) => g.id === def.tableBlockId)
    const rows: StandRow[] = group?.rows ?? []
    const lg = (play.leagues ?? []).find((l: { id: string }) => l.id === def.playersKey)
    return { rows, goals: lg?.goals ?? [], assists: lg?.assists ?? [] }
  } catch {
    return { rows: [], goals: [], assists: [] }
  }
}

function teamHref(def: LeagueDef, teamId?: string) {
  return teamId ? `/equipo/${def.leagueSlug.replace('/', '_')}_${teamId}` : undefined
}
function playerHref(p: PlayerRow) {
  return p.playerId && p.leagueSlug ? `/jugador/${p.leagueSlug.replace('/', '_')}_${p.playerId}` : undefined
}

function StandingsTable({ rows, def }: { rows: StandRow[]; def: LeagueDef }) {
  if (!rows.length) return <p className="text-[12px] text-[var(--text-muted)] px-4 py-6 text-center">Sin datos</p>
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="flex items-center gap-2 px-4 py-2.5 text-[10px] uppercase tracking-widest text-[#3A3A4A]"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', fontFamily: 'var(--font-sport)' }}>
        <span className="w-6 text-center">#</span>
        <span className="flex-1">Equipo</span>
        <span className="w-7 text-center">PJ</span>
        <span className="hidden sm:block w-9 text-center">DG</span>
        <span className="w-8 text-center font-black text-[var(--text-muted)]">PTS</span>
      </div>
      {rows.map(r => {
        const href = teamHref(def, r.teamId)
        const inner = (
          <div className="flex items-center gap-2 px-4 py-2.5"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
            <span className="w-6 text-center text-[12px] font-black" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>{r.rank}</span>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {r.logo && <Image src={r.logo} alt={r.abbr} width={20} height={20} unoptimized style={{ objectFit: 'contain', flexShrink: 0 }} />}
              <span className="text-[12px] font-semibold truncate" style={{ color: href ? '#fff' : '#9A9AAA' }}>{r.name}</span>
            </div>
            <span className="w-7 text-center text-[12px] text-[var(--text-muted)] tabular-nums">{(parseInt(r.extra?.V ?? '0') + parseInt(r.extra?.E ?? '0') + parseInt(r.extra?.D ?? '0')) || 0}</span>
            <span className="hidden sm:block w-9 text-center text-[12px] tabular-nums" style={{ color: 'var(--text-muted)' }}>{r.extra?.DG ?? '—'}</span>
            <span className="w-8 text-center text-[13px] font-black tabular-nums text-white" style={{ fontFamily: 'var(--font-display)' }}>{r.value}</span>
          </div>
        )
        return href
          ? <Link key={r.rank} href={href} className="block hover:bg-white/5 transition-colors">{inner}</Link>
          : <div key={r.rank}>{inner}</div>
      })}
    </div>
  )
}

function LeaderList({ title, players, metric, def }: { title: string; players: PlayerRow[]; metric: string; def: LeagueDef }) {
  if (!players.length) return null
  return (
    <section>
      <div className="text-[10px] font-black uppercase tracking-widest mb-3"
        style={{ color: def.accent, fontFamily: 'var(--font-sport)' }}>
        {title}
      </div>
      <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
        {players.slice(0, 10).map((p, i) => {
          const href = playerHref(p)
          const inner = (
            <div className="flex items-center gap-2.5 px-4 py-2.5"
              style={{ borderBottom: i < Math.min(players.length, 10) - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
              <span className="w-5 text-[11px] font-black tabular-nums text-right" style={{ color: i < 3 ? def.accent : '#5A5A72' }}>{i + 1}</span>
              {p.teamLogo && <Image src={p.teamLogo} alt="" width={22} height={22} unoptimized style={{ objectFit: 'contain', flexShrink: 0 }} />}
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold truncate text-white">{p.name}</div>
                <div className="text-[10px] truncate" style={{ color: '#7A7A92' }}>{p.team} · {p.matches} PJ</div>
              </div>
              <span className="w-10 text-right font-black tabular-nums" style={{ color: i < 3 ? def.accent : '#fff', fontFamily: 'var(--font-display)' }}>
                {p.value}
              </span>
              <span className="hidden sm:block w-12 text-right text-[10px] uppercase tracking-wide" style={{ color: '#5A5A72', fontFamily: 'var(--font-sport)' }}>{metric}</span>
            </div>
          )
          return href
            ? <Link key={i} href={href} className="block hover:bg-white/5 transition-colors">{inner}</Link>
            : <div key={i}>{inner}</div>
        })}
      </div>
    </section>
  )
}

async function Content({ id }: { id: string }) {
  const def = LEAGUES[id]
  if (!def) notFound()
  const { rows, goals, assists } = await fetchData(def)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <Link href="/estadisticas?sport=futbol"
          className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-white transition-colors"
          style={{ fontFamily: 'var(--font-sport)' }}>
          ‹ Volver a estadísticas
        </Link>
        <ShareButton title={`${def.label} · TakaSports`} />
      </div>

      <div className="rounded-2xl p-5 mb-6"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="text-[11px] font-black uppercase tracking-widest mb-1"
          style={{ color: def.accent, fontFamily: 'var(--font-sport)' }}>Liga</div>
        <h1 className="text-2xl font-black text-white leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
          {def.label}
        </h1>
        <p className="text-[12px] text-[#9A9AAA] mt-1">Tabla, goleadores y asistentes en vivo</p>
      </div>

      <section className="mb-8">
        <div className="text-[10px] font-black uppercase tracking-widest mb-3"
          style={{ color: def.accent, fontFamily: 'var(--font-sport)' }}>
          Clasificación
        </div>
        <StandingsTable rows={rows} def={def} />
      </section>

      <div className="grid sm:grid-cols-2 gap-6">
        <LeaderList title="Goleadores" players={goals} metric="Goles" def={def} />
        <LeaderList title="Asistencias" players={assists} metric="Asist." def={def} />
      </div>
    </div>
  )
}

export default async function LigaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <>
      <LiveStrip />
      <Header />
      <main style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
        <Suspense>
          <Content id={id} />
        </Suspense>
      </main>
      <Footer />
    </>
  )
}
