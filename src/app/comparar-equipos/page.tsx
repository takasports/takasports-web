import { Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import PlayerAvatar from '@/components/PlayerAvatar'
import type { TeamDetail } from '@/app/api/team/[slug]/route'
import DivergentBar from '@/components/comparators/DivergentBar'
import { getSportStyle } from '@/lib/sports'
import Header from '@/components/Header'
import LiveStrip from '@/components/LiveStrip'
import Footer from '@/components/Footer'
import { SITE_URL } from '@/lib/constants'

export const revalidate = 1800

export const metadata = {
  title: 'Comparar equipos | TakaSports',
  description: 'Compara dos clubes lado a lado: clasificación, racha y stats de temporada.',
  robots: { index: false, follow: true },
}

function apiBase(): string {
  return process.env.NEXT_PUBLIC_SITE_URL
    ?? (process.env.NODE_ENV === 'production' ? SITE_URL : 'http://localhost:3000')
}

async function fetchTeam(slug: string): Promise<TeamDetail | null> {
  try {
    const res = await fetch(`${apiBase()}/api/team/${slug}`, { next: { revalidate: 300 } })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

interface TeamCandidate { name: string; slug: string; logo?: string; league: string }

async function fetchCandidates(): Promise<TeamCandidate[]> {
  try {
    const res = await fetch(`${apiBase()}/api/stats/standings`, { next: { revalidate: 3600 } })
    if (!res.ok) return []
    const d = await res.json()
    const out: TeamCandidate[] = []
    for (const g of d.football ?? []) {
      const ls = g.leagueSlug as string | undefined
      if (!ls) continue
      for (const r of (g.rows ?? []).slice(0, 6)) {
        if (!r.teamId) continue
        out.push({
          name: r.name,
          slug: `${ls.replaceAll('/', '_')}_${r.teamId}`,
          logo: r.logo,
          league: g.label,
        })
      }
    }
    return out.slice(0, 30)
  } catch { return [] }
}

function mainRow(t: TeamDetail) {
  return t.leagueTable.find(r => r.isMain)
}

function teamStats(t: TeamDetail): { label: string; value: string; n?: number }[] {
  const r = mainRow(t)
  const gp = t.record?.gp ?? r?.gp ?? 0
  const w  = t.record?.w  ?? r?.w  ?? 0
  const d  = t.record?.d  ?? r?.d  ?? 0
  const l  = t.record?.l  ?? r?.l  ?? 0
  const pts = t.record?.pts ?? r?.pts ?? 0
  const gf = r?.gf ?? 0
  const gc = r?.gc ?? 0
  const gd = r?.gd ?? 0
  const ppp = gp > 0 ? +(pts / gp).toFixed(2) : 0
  const winPct = gp > 0 ? Math.round((w / gp) * 100) : 0
  return [
    { label: 'Posición', value: r?.rank ? `${r.rank}º` : '—', n: r?.rank ? -r.rank : undefined },
    { label: 'Puntos',   value: String(pts), n: pts },
    { label: 'Partidos', value: String(gp), n: gp },
    { label: 'Victorias',value: String(w),  n: w },
    { label: 'Empates',  value: String(d),  n: d },
    // Derrotas y GC (goles en contra): MENOS es mejor → negamos n para que el
    // resaltado del "ganador" marque al equipo con menos derrotas / menos goles
    // encajados (antes marcaba al peor como superior).
    { label: 'Derrotas', value: String(l),  n: -l },
    { label: 'GF',       value: String(gf), n: gf },
    { label: 'GC',       value: String(gc), n: -gc },
    { label: 'DG',       value: gd > 0 ? `+${gd}` : String(gd), n: gd },
    { label: 'Pts/PJ',   value: String(ppp), n: ppp },
    { label: '% Victorias', value: gp ? `${winPct}%` : '—', n: winPct },
  ]
}

function TeamHead({ t }: { t: TeamDetail }) {
  return (
    <div className="flex flex-col items-center text-center gap-2 flex-1 min-w-0">
      <div className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center p-1.5"
        style={{ background: 'rgba(124,58,237,0.12)' }}>
        <PlayerAvatar teamLogo={t.logo} teamName={t.name} name={t.name}
          accent="#C4B5FD" logoSize={56} textClass="text-2xl" />
      </div>
      <div className="min-w-0">
        <Link href={`/equipo/${t.leagueSlug.replaceAll('/', '_')}_${t.id}`}
          className="font-black text-[15px] text-white leading-tight hover:underline block truncate"
          style={{ fontFamily: 'var(--font-display)' }}>
          {t.name}
        </Link>
        <div className="text-[11px] text-[#9A9AAA] mt-0.5 truncate">{t.leagueLabel}</div>
      </div>
    </div>
  )
}

// Magnitud absoluta del valor mostrado (para la longitud de la barra): "1º"→1,
// "+12"→12, "66%"→66, "—"→0. La dirección del ganador sale de `n`, no de aquí.
function mag(value: string): number {
  const m = value.match(/-?\d+(?:\.\d+)?/)
  return m ? Math.abs(parseFloat(m[0])) : 0
}
// Métricas donde MENOS es mejor (su `n` ya viene negado en teamStats).
const TEAM_LESS_IS_BETTER = new Set(['Posición', 'Derrotas', 'GC'])

function Comparison({ a, b }: { a: TeamDetail; b: TeamDetail }) {
  const sa = teamStats(a); const sb = teamStats(b)
  const accent = getSportStyle(a.leagueSlug.split('/')[0] === 'soccer' ? 'futbol' : '').accent
  return (
    <div className="rounded-2xl overflow-hidden mb-6"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
      {sa.map((row, i) => {
        const other = sb[i]
        const aWins = row.n != null && other.n != null && row.n > other.n
        const bWins = row.n != null && other.n != null && other.n > row.n
        const magA = mag(row.value), magB = mag(other.value)
        return (
          <DivergentBar
            key={row.label}
            label={row.label}
            displayA={row.value}
            displayB={other.value}
            magA={magA}
            magB={magB}
            max={Math.max(magA, magB)}
            aWins={aWins}
            bWins={bWins}
            accent={accent}
            note={TEAM_LESS_IS_BETTER.has(row.label) ? 'menos = mejor' : undefined}
            last={i === sa.length - 1}
          />
        )
      })}
    </div>
  )
}

function CandidateGrid({ candidates, t1 }: { candidates: TeamCandidate[]; t1?: string }) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-3"
        style={{ fontFamily: 'var(--font-sport)' }}>
        {t1 ? 'Elige el segundo equipo' : 'Elige un equipo para comparar'}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {candidates.map(c => {
          const href = t1
            ? `/comparar-equipos?t1=${encodeURIComponent(t1)}&t2=${encodeURIComponent(c.slug)}`
            : `/comparar-equipos?t1=${encodeURIComponent(c.slug)}`
          return (
            <Link key={c.slug} href={href}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 transition-all hover:bg-white/5"
              style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {c.logo && (
                <Image src={c.logo} alt="" width={22} height={22} unoptimized
                  style={{ objectFit: 'contain', flexShrink: 0 }} />
              )}
              <div className="min-w-0">
                <div className="text-[12px] font-semibold text-white truncate">{c.name}</div>
                <div className="text-[10px] text-[var(--text-muted)] truncate">{c.league}</div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

async function Content({ t1, t2 }: { t1?: string; t2?: string }) {
  const [a, b, candidates] = await Promise.all([
    t1 ? fetchTeam(t1) : Promise.resolve(null),
    t2 ? fetchTeam(t2) : Promise.resolve(null),
    fetchCandidates(),
  ])

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <Link href="/estadisticas?sport=futbol"
          className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-white transition-colors"
          style={{ fontFamily: 'var(--font-sport)' }}>
          ‹ Volver a estadísticas
        </Link>
        <h1 className="text-[13px] font-black uppercase tracking-widest text-[#9A9AAA]"
          style={{ fontFamily: 'var(--font-sport)' }}>
          Comparar equipos
        </h1>
      </div>

      {a && b ? (
        <>
          <div className="flex items-stretch gap-3 mb-6 rounded-2xl p-4"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <TeamHead t={a} />
            <div className="flex items-center text-[12px] font-black text-[var(--text-muted)]"
              style={{ fontFamily: 'var(--font-sport)' }}>VS</div>
            <TeamHead t={b} />
          </div>
          <Comparison a={a} b={b} />
          <div className="text-center">
            <Link href={`/comparar-equipos?t1=${encodeURIComponent(t1!)}`}
              className="text-[12px] font-semibold transition-opacity hover:opacity-80"
              style={{ color: '#C4B5FD', fontFamily: 'var(--font-sport)' }}>
              ↻ Cambiar rival
            </Link>
          </div>
        </>
      ) : a && !b ? (
        <>
          <div className="rounded-2xl p-4 mb-6 flex items-center gap-3"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <TeamHead t={a} />
          </div>
          <CandidateGrid candidates={candidates.filter(c => c.slug !== t1)} t1={t1} />
        </>
      ) : (
        <CandidateGrid candidates={candidates} />
      )}
    </div>
  )
}

export default async function CompararEquiposPage({
  searchParams,
}: { searchParams: Promise<{ t1?: string; t2?: string }> }) {
  const { t1, t2 } = await searchParams
  return (
    <>
      <LiveStrip />
      <Header />
      <main style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
        <Suspense>
          <Content t1={t1} t2={t2} />
        </Suspense>
      </main>
      <Footer />
    </>
  )
}
