import { Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { PlayerDetail } from '@/app/api/jugador/[slug]/route'
import Header from '@/components/Header'
import LiveStrip from '@/components/LiveStrip'
import Footer from '@/components/Footer'
import { SITE_URL } from '@/lib/constants'

export const revalidate = 1800

export const metadata = {
  title: 'Comparar jugadores | TakaSports',
  description: 'Compara las estadísticas de dos jugadores lado a lado.',
  // Combinatorial URL space → keep out of the index.
  robots: { index: false, follow: true },
}

function apiBase(): string {
  return process.env.NEXT_PUBLIC_SITE_URL
    ?? (process.env.NODE_ENV === 'production' ? SITE_URL : 'http://localhost:3000')
}

async function fetchPlayer(slug: string): Promise<PlayerDetail | null> {
  try {
    const res = await fetch(`${apiBase()}/api/jugador/${slug}`, { next: { revalidate: 1800 } })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

interface Candidate { name: string; slug: string; logo?: string; team: string }

async function fetchCandidates(): Promise<Candidate[]> {
  try {
    const res = await fetch(`${apiBase()}/api/stats/players`, { next: { revalidate: 1800 } })
    if (!res.ok) return []
    const d = await res.json()
    const seen = new Set<string>()
    const out: Candidate[] = []
    for (const lg of d.leagues ?? []) {
      for (const p of [...(lg.goals ?? []).slice(0, 8), ...(lg.assists ?? []).slice(0, 4)]) {
        if (!p.playerId || !p.leagueSlug || seen.has(p.playerId)) continue
        seen.add(p.playerId)
        out.push({
          name: p.name,
          slug: `${p.leagueSlug.replace('/', '_')}_${p.playerId}`,
          logo: p.teamLogo,
          team: p.team || lg.label,
        })
      }
    }
    return out.slice(0, 40)
  } catch { return [] }
}

function num(v: string): number | null {
  const m = v.replace(/\./g, '').match(/-?\d+/)
  return m ? parseInt(m[0], 10) : null
}

function PlayerHead({ p }: { p: PlayerDetail }) {
  const img = p.headshot ?? p.team?.logo
  return (
    <div className="flex flex-col items-center text-center gap-2 flex-1 min-w-0">
      <div className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center"
        style={{ background: 'rgba(124,58,237,0.12)' }}>
        {img ? (
          <Image src={img} alt={p.name} width={64} height={64} unoptimized
            style={{ objectFit: p.headshot ? 'cover' : 'contain', width: 64, height: 64 }} />
        ) : (
          <span className="font-black text-2xl" style={{ color: '#C4B5FD', fontFamily: 'var(--font-display)' }}>
            {p.name.charAt(0)}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <Link href={`/jugador/${p.leagueSlug.replace('/', '_')}_${p.id}`}
          className="font-black text-[15px] text-white leading-tight hover:underline block truncate"
          style={{ fontFamily: 'var(--font-display)' }}>
          {p.name}
        </Link>
        <div className="text-[11px] text-[#9A9AAA] mt-0.5 truncate">
          {[p.position, p.team?.name].filter(Boolean).join(' · ')}
        </div>
      </div>
    </div>
  )
}

function Comparison({ a, b }: { a: PlayerDetail; b: PlayerDetail }) {
  const labels: string[] = []
  for (const s of [...a.stats, ...b.stats]) if (!labels.includes(s.label)) labels.push(s.label)
  const mapA = new Map(a.stats.map(s => [s.label, s.value]))
  const mapB = new Map(b.stats.map(s => [s.label, s.value]))

  return (
    <div className="rounded-2xl overflow-hidden mb-6"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
      {labels.map((label, i) => {
        const va = mapA.get(label) ?? '—'
        const vb = mapB.get(label) ?? '—'
        const na = num(va), nb = num(vb)
        const aWins = na != null && nb != null && na > nb
        const bWins = na != null && nb != null && nb > na
        return (
          <div key={label} className="flex items-center text-[13px]"
            style={{ borderBottom: i < labels.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
            <div className="flex-1 text-right px-3 py-2.5 tabular-nums font-bold"
              style={{ color: aWins ? '#fff' : '#8A8AA0', background: aWins ? 'rgba(124,58,237,0.10)' : 'transparent' }}>
              {va}
            </div>
            <div className="w-32 text-center text-[10px] uppercase tracking-wide flex-shrink-0 px-1"
              style={{ color: '#5A5A6A', fontFamily: 'var(--font-sport)' }}>
              {label}
            </div>
            <div className="flex-1 px-3 py-2.5 tabular-nums font-bold"
              style={{ color: bWins ? '#fff' : '#8A8AA0', background: bWins ? 'rgba(124,58,237,0.10)' : 'transparent' }}>
              {vb}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CandidateGrid({ candidates, p1 }: { candidates: Candidate[]; p1?: string }) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-widest text-[#5A5A6A] mb-3"
        style={{ fontFamily: 'var(--font-sport)' }}>
        {p1 ? 'Elige el segundo jugador' : 'Elige un jugador para comparar'}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {candidates.map(c => {
          const href = p1
            ? `/comparar?p1=${encodeURIComponent(p1)}&p2=${encodeURIComponent(c.slug)}`
            : `/comparar?p1=${encodeURIComponent(c.slug)}`
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
                <div className="text-[10px] text-[#5A5A6A] truncate">{c.team}</div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

async function Content({ p1, p2 }: { p1?: string; p2?: string }) {
  const [a, b, candidates] = await Promise.all([
    p1 ? fetchPlayer(p1) : Promise.resolve(null),
    p2 ? fetchPlayer(p2) : Promise.resolve(null),
    fetchCandidates(),
  ])

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <Link href="/estadisticas?sport=futbol"
          className="flex items-center gap-1.5 text-[12px] text-[#5A5A6A] hover:text-white transition-colors"
          style={{ fontFamily: 'var(--font-sport)' }}>
          ‹ Volver a estadísticas
        </Link>
        <h1 className="text-[13px] font-black uppercase tracking-widest text-[#9A9AAA]"
          style={{ fontFamily: 'var(--font-sport)' }}>
          Comparar
        </h1>
      </div>

      {a && b ? (
        <>
          <div className="flex items-stretch gap-3 mb-6 rounded-2xl p-4"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <PlayerHead p={a} />
            <div className="flex items-center text-[12px] font-black text-[#5A5A6A]"
              style={{ fontFamily: 'var(--font-sport)' }}>VS</div>
            <PlayerHead p={b} />
          </div>
          <Comparison a={a} b={b} />
          <div className="text-center">
            <Link href={`/comparar?p1=${encodeURIComponent(p1!)}`}
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
            <PlayerHead p={a} />
          </div>
          <CandidateGrid candidates={candidates.filter(c => c.slug !== p1)} p1={p1} />
        </>
      ) : (
        <CandidateGrid candidates={candidates} />
      )}
    </div>
  )
}

export default async function CompararPage({
  searchParams,
}: { searchParams: Promise<{ p1?: string; p2?: string }> }) {
  const { p1, p2 } = await searchParams
  return (
    <>
      <LiveStrip />
      <Header />
      <main style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
        <Suspense>
          <Content p1={p1} p2={p2} />
        </Suspense>
      </main>
      <Footer />
    </>
  )
}
