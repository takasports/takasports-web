import { Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import PlayerAvatar from '@/components/PlayerAvatar'
import type { PlayerDetail } from '@/app/api/jugador/[slug]/route'
import { getSportStyle } from '@/lib/sports'
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
          slug: `${p.leagueSlug.replaceAll('/', '_')}_${p.playerId}`,
          logo: p.teamLogo,
          team: p.team || lg.label,
        })
      }
    }
    return out.slice(0, 40)
  } catch { return [] }
}

function num(v: string): number | null {
  // Conservar decimales: antes se borraba el punto (v.replace(/\./g,'')) y
  // '66.5%' se convertía en 665, '1.85' en 185 → el resaltado del ganador en
  // stats con % o ratios (TS%, PPG…) salía al azar. Ahora parseamos el primer
  // número permitiendo parte decimal.
  const m = v.match(/-?\d+(?:\.\d+)?/)
  return m ? parseFloat(m[0]) : null
}

function PlayerHead({ p }: { p: PlayerDetail }) {
  return (
    <div className="flex flex-col items-center text-center gap-2 flex-1 min-w-0">
      <div className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center"
        style={{ background: 'rgba(124,58,237,0.12)' }}>
        <PlayerAvatar headshot={p.headshot} teamLogo={p.team?.logo} teamName={p.team?.name}
          name={p.name} accent="#C4B5FD" headshotSize={64} logoSize={56} textClass="text-2xl" />
      </div>
      <div className="min-w-0">
        <Link href={`/jugador/${p.leagueSlug.replaceAll('/', '_')}_${p.id}`}
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

// Métricas donde MENOS es mejor: el resaltado de ganador se invierte.
const LESS_IS_BETTER = new Set(['Faltas', 'Faltas com.', 'Amarillas', 'Rojas', 'Pérdidas/partido'])

function sportFromLeagueSlug(slug?: string): string {
  const seg = (slug ?? '').split('/')[0]
  return seg === 'soccer' ? 'futbol' : seg === 'basketball' ? 'baloncesto' : ''
}

function Comparison({ a, b }: { a: PlayerDetail; b: PlayerDetail }) {
  const labels: string[] = []
  for (const s of [...a.stats, ...b.stats]) if (!labels.includes(s.label)) labels.push(s.label)
  const mapA = new Map(a.stats.map(s => [s.label, s.value]))
  const mapB = new Map(b.stats.map(s => [s.label, s.value]))
  // Tema por deporte (jugadores del mismo deporte; default morado si no se detecta).
  const accent = getSportStyle(sportFromLeagueSlug(a.leagueSlug || b.leagueSlug)).accent

  return (
    <div className="rounded-2xl overflow-hidden mb-6"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
      {labels.map((label, i) => {
        const va = mapA.get(label) ?? '—'
        const vb = mapB.get(label) ?? '—'
        const na = num(va), nb = num(vb)
        const lessBetter = LESS_IS_BETTER.has(label)
        let aWins = false, bWins = false
        if (na != null && nb != null && na !== nb) {
          aWins = lessBetter ? na < nb : na > nb
          bWins = !aWins
        }
        // Barras divergentes: cada lado proporcional al mayor de los dos (cabeza a cabeza).
        const max = Math.max(na ?? 0, nb ?? 0, 1)
        const pctA = na != null ? Math.round((na / max) * 100) : 0
        const pctB = nb != null ? Math.round((nb / max) * 100) : 0
        return (
          <div key={label} className="flex items-center text-[13px]"
            style={{ borderBottom: i < labels.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
            {/* Lado A (tira a la izquierda) */}
            <div className="flex-1 flex items-center gap-2 pl-3 pr-1.5 py-2.5 min-w-0">
              <span className="tabular-nums font-bold w-10 text-right flex-shrink-0"
                style={{ color: aWins ? '#fff' : '#8A8AA0' }}>{va}</span>
              <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div className="h-full rounded-full ts-bar-fill ml-auto"
                  style={{ width: `${pctA}%`, background: accent, opacity: aWins ? 1 : 0.4 }} />
              </div>
            </div>
            {/* Etiqueta central */}
            <div className="w-20 text-center flex-shrink-0 px-0.5">
              <div className="text-[9.5px] uppercase tracking-wide leading-tight"
                style={{ color: '#7C7C8C', fontFamily: 'var(--font-sport)' }}>{label}</div>
              {lessBetter && (
                <div className="text-[8px] uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>menos = mejor</div>
              )}
            </div>
            {/* Lado B (tira a la derecha) */}
            <div className="flex-1 flex items-center gap-2 pr-3 pl-1.5 py-2.5 min-w-0">
              <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div className="h-full rounded-full ts-bar-fill"
                  style={{ width: `${pctB}%`, background: accent, opacity: bWins ? 1 : 0.4 }} />
              </div>
              <span className="tabular-nums font-bold w-10 flex-shrink-0"
                style={{ color: bWins ? '#fff' : '#8A8AA0' }}>{vb}</span>
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
      <div className="flex items-center justify-between mb-3">
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

      {/* Cross-link al comparador del Índice Taka (4 factores subjetivos) */}
      <div className="mb-6">
        <Link
          href="/rankings/comparar"
          className="inline-flex items-center gap-2 text-[11px] transition-colors hover:text-white"
          style={{
            color: '#C4B5FD',
            fontFamily: 'var(--font-sport)',
            textDecoration: 'none',
          }}
        >
          <span style={{ color: '#5A5A6A' }}>¿Buscas comparar el Índice Taka?</span>
          <span>Comparador Taka →</span>
        </Link>
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
