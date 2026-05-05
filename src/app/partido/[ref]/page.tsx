import { Suspense } from 'react'
import Link from 'next/link'
import type {
  MatchDetail, MatchStat, ScoringEvent, BasketballLeader, MmaFighter, RacingResult, GolfLeader,
} from '@/app/api/match/[ref]/route'
import Header from '@/components/Header'
import LiveStrip from '@/components/LiveStrip'
import Footer from '@/components/Footer'

export const revalidate = 30

// ── Metadata ───────────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ ref: string }>
}) {
  const { ref } = await params
  const match    = await fetchMatchDetail(ref)
  if (!match) return { title: 'Partido | TakaSports' }

  let title = ''
  let description = ''

  if (match.homeTeam && match.awayTeam) {
    const score = match.homeScore != null && match.awayScore != null
      ? ` ${match.homeScore}–${match.awayScore}`
      : ''
    title = `${match.homeTeam}${score} ${match.awayTeam} · ${match.leagueLabel} | TakaSports`
    description = `${match.statusLabel} · ${match.homeTeam} vs ${match.awayTeam}${match.venue ? ` en ${match.venue}` : ''}`
  } else if (match.mma?.fighters?.length) {
    const [a, b] = match.mma.fighters
    title = `${a?.name ?? '?'} vs ${b?.name ?? '?'} · UFC | TakaSports`
    description = `${match.mma.weightClass ?? 'UFC'} · ${match.statusLabel}`
  } else {
    title = `${match.leagueLabel} | TakaSports`
    description = match.statusLabel
  }

  const ogImage = match.homeLogo ?? 'https://takasportsmedia.com/taka-icon.png'

  return {
    title,
    description,
    alternates: { canonical: `https://takasportsmedia.com/partido/${ref}` },
    openGraph: {
      title,
      description,
      images: [{ url: ogImage, width: 200, height: 200 }],
      type: 'website',
      siteName: 'TakaSports',
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: [ogImage],
    },
  }
}

const LIVE_STATUSES = new Set([
  'STATUS_IN_PROGRESS', 'STATUS_HALFTIME', 'STATUS_SECOND_HALF',
  'STATUS_END_PERIOD', 'STATUS_OVERTIME',
])
const isLive = (s: string) => LIVE_STATUSES.has(s)

// ── Server fetch ───────────────────────────────────────────────────
async function fetchMatchDetail(ref: string): Promise<MatchDetail | null> {
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL
      ?? (process.env.NODE_ENV === 'production' ? 'https://takasportsmedia.com' : 'http://localhost:3000')
    const res  = await fetch(`${base}/api/match/${ref}`, { next: { revalidate: 30 } })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

// ── Shared bits ────────────────────────────────────────────────────
function TeamLogo({ logo, name, size = 56 }: { logo?: string; name: string; size?: number }) {
  if (logo) {
    return (
      <img src={logo} alt={name} width={size} height={size}
        style={{ width: size, height: size, objectFit: 'contain' }} />
    )
  }
  return (
    <div className="flex items-center justify-center rounded-2xl font-black text-xl"
      style={{ width: size, height: size, background: 'rgba(255,255,255,0.06)', color: '#555' }}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  )
}

function Pill({ children, color = '#818cf8', bg, border }: { children: React.ReactNode; color?: string; bg?: string; border?: string }) {
  return (
    <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full"
      style={{
        background: bg ?? `${color}1f`,
        color,
        border: border ?? `1px solid ${color}40`,
        fontFamily: 'var(--font-sport)',
      }}>
      {children}
    </span>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4 mb-4"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <p className="text-[9px] font-black uppercase tracking-widest mb-4"
        style={{ color: '#4A4A5A', fontFamily: 'var(--font-sport)' }}>
        {title}
      </p>
      {children}
    </div>
  )
}

function StatBar({ stat }: { stat: MatchStat }) {
  const hNum = parseFloat(stat.home.replace('%', '').replace(',', '.'))
  const aNum = parseFloat(stat.away.replace('%', '').replace(',', '.'))
  const total = hNum + aNum
  const homePct = total > 0 ? (hNum / total) * 100 : 50
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-[11px]" style={{ fontFamily: 'var(--font-sport)' }}>
        <span className="font-black" style={{ color: '#E0E0F0' }}>{stat.home}</span>
        <span className="font-semibold uppercase tracking-widest text-[9px]" style={{ color: '#5A5A6A' }}>{stat.label}</span>
        <span className="font-black" style={{ color: '#E0E0F0' }}>{stat.away}</span>
      </div>
      {!isNaN(homePct) && (
        <div className="flex rounded-full overflow-hidden h-1" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div style={{ width: `${homePct}%`, background: '#6366f1', transition: 'width 0.8s ease' }} />
          <div style={{ flex: 1, background: '#f59e0b' }} />
        </div>
      )}
    </div>
  )
}

// ── Team scoreboard hero (soccer / basketball / tennis) ────────────
function TeamScoreboard({ match }: { match: MatchDetail }) {
  const live = isLive(match.status)
  const hasScore = match.homeScore != null && match.awayScore != null
  return (
    <div className="rounded-2xl p-6 mb-6"
      style={{
        background: live
          ? 'linear-gradient(135deg, rgba(74,222,128,0.06) 0%, rgba(9,9,15,0.8) 60%)'
          : 'rgba(255,255,255,0.03)',
        border: live ? '1px solid rgba(74,222,128,0.18)' : '1px solid rgba(255,255,255,0.07)',
      }}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col items-center gap-2 flex-1">
          <TeamLogo logo={match.homeLogo} name={match.homeTeam ?? '—'} size={56} />
          <p className="text-center font-black text-sm leading-tight"
            style={{ color: '#E0E0F0', fontFamily: 'var(--font-sport)' }}>
            {match.homeAbbr ?? match.homeTeam}
          </p>
        </div>
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          {hasScore ? (
            <p className="font-black tabular-nums"
              style={{ color: live ? '#4ade80' : '#F0F0F8', fontFamily: 'var(--font-display)', fontSize: 42, letterSpacing: '0.04em', lineHeight: 1 }}>
              {match.homeScore} – {match.awayScore}
            </p>
          ) : (
            <p className="font-black" style={{ color: '#3A3A5A', fontFamily: 'var(--font-display)', fontSize: 28 }}>vs</p>
          )}
          <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded"
            style={{
              color: live ? '#4ade80' : '#5A5A6A',
              background: live ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.04)',
              fontFamily: 'var(--font-sport)',
            }}>
            {match.statusLabel}
          </span>
        </div>
        <div className="flex flex-col items-center gap-2 flex-1">
          <TeamLogo logo={match.awayLogo} name={match.awayTeam ?? '—'} size={56} />
          <p className="text-center font-black text-sm leading-tight"
            style={{ color: '#E0E0F0', fontFamily: 'var(--font-sport)' }}>
            {match.awayAbbr ?? match.awayTeam}
          </p>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ match }: { match: MatchDetail }) {
  if (!match.venue && !match.broadcast) return null
  return (
    <div className="flex flex-wrap gap-3 mb-6">
      {match.venue && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M6 1C4.34 1 3 2.34 3 4c0 2.5 3 7 3 7s3-4.5 3-7c0-1.66-1.34-3-3-3z" stroke="#5A5A6A" strokeWidth="1.2" />
            <circle cx="6" cy="4" r="1" fill="#5A5A6A" />
          </svg>
          <span className="text-[10px]" style={{ color: '#6A6A7A', fontFamily: 'var(--font-sport)' }}>{match.venue}</span>
        </div>
      )}
      {match.broadcast && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <rect x="1.5" y="3" width="9" height="6" rx="1" stroke="#5A5A6A" strokeWidth="1.2" />
            <path d="M4 3V2.5M8 3V2.5" stroke="#5A5A6A" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <span className="text-[10px]" style={{ color: '#6A6A7A', fontFamily: 'var(--font-sport)' }}>{match.broadcast}</span>
        </div>
      )}
    </div>
  )
}

// ── Soccer block ───────────────────────────────────────────────────
function ScoringTimeline({ events, homeTeam, awayTeam }: { events: ScoringEvent[]; homeTeam: string; awayTeam: string }) {
  if (events.length === 0) return null
  const ICONS: Record<string, string> = {
    goal: '⚽', 'own-goal': '⚽', penalty: '⚽', yellow: '🟨', red: '🟥',
  }
  return (
    <div className="flex flex-col gap-2">
      {events.map((ev, i) => (
        <div key={i} className={`flex items-center gap-2 ${ev.team === 'home' ? 'flex-row' : 'flex-row-reverse'}`}>
          <span className="text-sm">{ICONS[ev.type] ?? '•'}</span>
          <div className={`flex flex-col ${ev.team === 'away' ? 'items-end' : ''}`}>
            <span className="text-[11px] font-semibold" style={{ color: '#D0D0E8', fontFamily: 'var(--font-sport)' }}>
              {ev.player ?? (ev.team === 'home' ? homeTeam : awayTeam)}
            </span>
            {ev.clock && (
              <span className="text-[10px]" style={{ color: '#5A5A6A' }}>{ev.clock}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function SoccerBlock({ match }: { match: MatchDetail }) {
  if (!match.soccer) return null
  return (
    <>
      {match.soccer.stats.length > 0 && (
        <Section title="Estadísticas">
          <div className="flex items-center justify-between text-[10px] font-black mb-3" style={{ fontFamily: 'var(--font-sport)' }}>
            <span style={{ color: '#818cf8' }}>{match.homeAbbr ?? match.homeTeam}</span>
            <span style={{ color: '#f59e0b' }}>{match.awayAbbr ?? match.awayTeam}</span>
          </div>
          <div className="flex flex-col gap-3">
            {match.soccer.stats.map((s, i) => <StatBar key={i} stat={s} />)}
          </div>
        </Section>
      )}
      {match.soccer.scoring.length > 0 && (
        <Section title="Eventos">
          <ScoringTimeline events={match.soccer.scoring} homeTeam={match.homeTeam ?? ''} awayTeam={match.awayTeam ?? ''} />
        </Section>
      )}
    </>
  )
}

// ── Basketball block ───────────────────────────────────────────────
function QuarterTable({ home, away, homeAbbr, awayAbbr }: {
  home: (number | null)[]; away: (number | null)[]; homeAbbr: string; awayAbbr: string
}) {
  const len = Math.max(home.length, away.length)
  if (len === 0) return null
  const labels = Array.from({ length: len }, (_, i) => i < 4 ? `Q${i + 1}` : `OT${i - 3}`)
  const sum = (arr: (number | null)[]) => arr.reduce<number>((a, v) => a + (v ?? 0), 0)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]" style={{ fontFamily: 'var(--font-sport)' }}>
        <thead>
          <tr style={{ color: '#5A5A6A' }}>
            <th className="text-left font-semibold pb-2">EQUIPO</th>
            {labels.map(l => <th key={l} className="font-semibold pb-2 px-1 tabular-nums" style={{ width: 32 }}>{l}</th>)}
            <th className="font-black pb-2 px-1 tabular-nums" style={{ color: '#E0E0F0' }}>T</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ color: '#D0D0E8' }}>
            <td className="font-black py-1" style={{ color: '#818cf8' }}>{homeAbbr}</td>
            {Array.from({ length: len }).map((_, i) => <td key={i} className="text-center tabular-nums">{home[i] ?? '—'}</td>)}
            <td className="text-center font-black tabular-nums" style={{ color: '#F0F0F8' }}>{sum(home) || '—'}</td>
          </tr>
          <tr style={{ color: '#D0D0E8' }}>
            <td className="font-black py-1" style={{ color: '#f59e0b' }}>{awayAbbr}</td>
            {Array.from({ length: len }).map((_, i) => <td key={i} className="text-center tabular-nums">{away[i] ?? '—'}</td>)}
            <td className="text-center font-black tabular-nums" style={{ color: '#F0F0F8' }}>{sum(away) || '—'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function LeaderCard({ leader }: { leader: BasketballLeader }) {
  const accent = leader.team === 'home' ? '#818cf8' : '#f59e0b'
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
      {leader.headshot
        ? <img src={leader.headshot} alt={leader.player} width={36} height={36} className="rounded-full" style={{ objectFit: 'cover', background: '#1A1A28' }} />
        : <div className="w-9 h-9 rounded-full" style={{ background: '#1A1A28' }} />
      }
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-black truncate" style={{ color: '#E0E0F0', fontFamily: 'var(--font-sport)' }}>{leader.player}</p>
        <p className="text-[9px] uppercase tracking-widest" style={{ color: '#5A5A6A', fontFamily: 'var(--font-sport)' }}>{leader.category}</p>
      </div>
      <div className="text-right">
        <p className="font-black tabular-nums" style={{ color: accent, fontFamily: 'var(--font-display)', fontSize: 20, lineHeight: 1 }}>{leader.value}</p>
        {leader.summary && (
          <p className="text-[9px]" style={{ color: '#5A5A6A', fontFamily: 'var(--font-sport)' }}>{leader.summary}</p>
        )}
      </div>
    </div>
  )
}

function BasketballBlock({ match }: { match: MatchDetail }) {
  if (!match.basketball) return null
  const { quarters, leaders, stats } = match.basketball
  const hasQuarters = quarters.home.some(v => v != null) || quarters.away.some(v => v != null)
  return (
    <>
      {hasQuarters && (
        <Section title="Marcador por cuartos">
          <QuarterTable
            home={quarters.home} away={quarters.away}
            homeAbbr={match.homeAbbr ?? match.homeTeam ?? '—'}
            awayAbbr={match.awayAbbr ?? match.awayTeam ?? '—'}
          />
        </Section>
      )}
      {leaders.length > 0 && (
        <Section title="Líderes del partido">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {leaders.map((l, i) => <LeaderCard key={i} leader={l} />)}
          </div>
        </Section>
      )}
      {stats.length > 0 && (
        <Section title="Estadísticas de equipo">
          <div className="flex items-center justify-between text-[10px] font-black mb-3" style={{ fontFamily: 'var(--font-sport)' }}>
            <span style={{ color: '#818cf8' }}>{match.homeAbbr ?? match.homeTeam}</span>
            <span style={{ color: '#f59e0b' }}>{match.awayAbbr ?? match.awayTeam}</span>
          </div>
          <div className="flex flex-col gap-3">
            {stats.map((s, i) => <StatBar key={i} stat={s} />)}
          </div>
        </Section>
      )}
    </>
  )
}

// ── Tennis block ───────────────────────────────────────────────────
function TennisBlock({ match }: { match: MatchDetail }) {
  if (!match.tennis) return null
  const t = match.tennis
  const setCount = Math.max(t.sets.home.length, t.sets.away.length)
  return (
    <>
      <div className="rounded-2xl p-6 mb-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        {t.round && (
          <p className="text-[10px] font-black uppercase tracking-widest text-center mb-3"
            style={{ color: '#5A5A6A', fontFamily: 'var(--font-sport)' }}>
            {t.round}
          </p>
        )}
        <div className="flex flex-col gap-3">
          {(['home', 'away'] as const).map(side => {
            const player = side === 'home' ? t.homePlayer : t.awayPlayer
            const sets   = side === 'home' ? t.sets.home  : t.sets.away
            return (
              <div key={side} className="flex items-center justify-between gap-3">
                <span className="font-black text-sm" style={{ color: '#E0E0F0', fontFamily: 'var(--font-sport)' }}>
                  {player ?? '—'}
                </span>
                <div className="flex gap-2">
                  {Array.from({ length: setCount }).map((_, i) => (
                    <span key={i} className="w-7 h-7 flex items-center justify-center rounded-md font-black tabular-nums text-sm"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        color: side === 'home' ? '#818cf8' : '#f59e0b',
                        fontFamily: 'var(--font-display)',
                      }}>
                      {sets[i] ?? '—'}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-[10px] text-center mt-4 uppercase tracking-widest font-black"
          style={{ color: '#5A5A6A', fontFamily: 'var(--font-sport)' }}>
          {match.statusLabel}
        </p>
      </div>
    </>
  )
}

// ── MMA block ──────────────────────────────────────────────────────
function FighterCard({ fighter, side }: { fighter: MmaFighter; side: 'home' | 'away' }) {
  const accent = fighter.winner ? '#4ade80' : '#5A5A6A'
  return (
    <div className={`flex flex-col ${side === 'away' ? 'items-end text-right' : 'items-start text-left'} gap-2 flex-1`}>
      {fighter.headshot
        ? <img src={fighter.headshot} alt={fighter.name} width={72} height={72} className="rounded-full"
            style={{ objectFit: 'cover', background: '#1A1A28', border: fighter.winner ? '2px solid #4ade80' : '2px solid rgba(255,255,255,0.06)' }} />
        : <div className="w-[72px] h-[72px] rounded-full" style={{ background: '#1A1A28' }} />
      }
      <p className="font-black text-sm leading-tight" style={{ color: '#E0E0F0', fontFamily: 'var(--font-sport)' }}>
        {fighter.name}
      </p>
      {fighter.flag && (
        <p className="text-[10px]" style={{ color: '#6A6A7A', fontFamily: 'var(--font-sport)' }}>{fighter.flag}</p>
      )}
      {fighter.record && (
        <p className="text-[10px] tabular-nums" style={{ color: '#8A8AA0', fontFamily: 'var(--font-sport)' }}>{fighter.record}</p>
      )}
      {fighter.winner && (
        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded"
          style={{ background: 'rgba(74,222,128,0.12)', color: accent, border: '1px solid rgba(74,222,128,0.3)', fontFamily: 'var(--font-sport)' }}>
          Ganador
        </span>
      )}
    </div>
  )
}

function MmaBlock({ match }: { match: MatchDetail }) {
  if (!match.mma) return null
  const m = match.mma
  const [a, b] = m.fighters
  return (
    <>
      <div className="rounded-2xl p-6 mb-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        {(m.weightClass || m.cardName) && (
          <div className="flex items-center justify-center gap-2 mb-4 flex-wrap">
            {m.weightClass && <Pill color="#f87171">{m.weightClass}</Pill>}
            {m.cardName && (
              <span className="text-[10px] uppercase tracking-widest" style={{ color: '#6A6A7A', fontFamily: 'var(--font-sport)' }}>
                {m.cardName}
              </span>
            )}
          </div>
        )}
        <div className="flex items-start justify-between gap-4">
          {a ? <FighterCard fighter={a} side="home" /> : <div className="flex-1" />}
          <div className="flex flex-col items-center justify-center gap-2 flex-shrink-0 pt-6">
            <span className="font-black" style={{ color: '#3A3A5A', fontFamily: 'var(--font-display)', fontSize: 22 }}>vs</span>
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded"
              style={{ color: '#5A5A6A', background: 'rgba(255,255,255,0.04)', fontFamily: 'var(--font-sport)' }}>
              {match.statusLabel}
            </span>
          </div>
          {b ? <FighterCard fighter={b} side="away" /> : <div className="flex-1" />}
        </div>
      </div>

      <Section title="Detalles del combate">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: '#5A5A6A', fontFamily: 'var(--font-sport)' }}>Rounds</p>
            <p className="text-sm font-black" style={{ color: '#E0E0F0', fontFamily: 'var(--font-sport)' }}>
              {m.rounds ? `${m.rounds} programados` : '—'}
            </p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: '#5A5A6A', fontFamily: 'var(--font-sport)' }}>Final</p>
            <p className="text-sm font-black" style={{ color: '#E0E0F0', fontFamily: 'var(--font-sport)' }}>
              {m.endRound ? `R${m.endRound}${m.endTime ? ` · ${m.endTime}` : ''}` : '—'}
            </p>
          </div>
        </div>
        {m.note && (
          <p className="text-[11px] mt-3" style={{ color: '#8A8AA0', fontFamily: 'var(--font-sport)' }}>{m.note}</p>
        )}
      </Section>
    </>
  )
}

// ── Racing (F1) block ──────────────────────────────────────────────
function RacingBlock({ match }: { match: MatchDetail }) {
  if (!match.racing) return null
  const r = match.racing
  return (
    <>
      <div className="rounded-2xl p-6 mb-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        {r.circuit && (
          <p className="text-[10px] font-black uppercase tracking-widest text-center mb-2"
            style={{ color: '#9CA3AF', fontFamily: 'var(--font-sport)' }}>
            {r.circuit}
          </p>
        )}
        <p className="text-center font-black"
          style={{ color: '#F0F0F8', fontFamily: 'var(--font-display)', fontSize: 22 }}>
          {match.statusLabel}
        </p>
      </div>
      {r.results.length > 0 && (
        <Section title="Top 10">
          <div className="flex flex-col gap-1.5">
            {r.results.map((row: RacingResult, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5 px-2 rounded-md"
                style={{ background: i < 3 ? 'rgba(245,158,11,0.05)' : 'transparent' }}>
                <span className="w-6 text-center font-black tabular-nums"
                  style={{ color: i === 0 ? '#FCD34D' : i === 1 ? '#D1D5DB' : i === 2 ? '#D97706' : '#6A6A7A', fontFamily: 'var(--font-display)' }}>
                  {row.pos}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-black truncate" style={{ color: '#E0E0F0', fontFamily: 'var(--font-sport)' }}>{row.driver}</p>
                  {row.team && <p className="text-[10px] truncate" style={{ color: '#6A6A7A', fontFamily: 'var(--font-sport)' }}>{row.team}</p>}
                </div>
                {row.time && (
                  <span className="text-[11px] font-black tabular-nums" style={{ color: '#9CA3AF', fontFamily: 'var(--font-display)' }}>{row.time}</span>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  )
}

// ── Golf block ─────────────────────────────────────────────────────
function GolfBlock({ match }: { match: MatchDetail }) {
  if (!match.golf) return null
  const g = match.golf
  return (
    <>
      <div className="rounded-2xl p-6 mb-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <p className="text-center font-black"
          style={{ color: '#F0F0F8', fontFamily: 'var(--font-display)', fontSize: 22 }}>
          {match.statusLabel}
        </p>
        {g.round && (
          <p className="text-[10px] text-center mt-2 uppercase tracking-widest"
            style={{ color: '#9CA3AF', fontFamily: 'var(--font-sport)' }}>{g.round}</p>
        )}
      </div>
      {g.leaderboard.length > 0 && (
        <Section title="Clasificación">
          <div className="flex flex-col gap-1.5">
            {g.leaderboard.map((row: GolfLeader, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5 px-2 rounded-md">
                <span className="w-8 text-center font-black tabular-nums"
                  style={{ color: '#9CA3AF', fontFamily: 'var(--font-display)' }}>
                  {row.pos}
                </span>
                <p className="flex-1 text-[12px] font-black truncate"
                  style={{ color: '#E0E0F0', fontFamily: 'var(--font-sport)' }}>{row.player}</p>
                <span className="text-[11px] font-black tabular-nums"
                  style={{ color: '#818cf8', fontFamily: 'var(--font-display)' }}>{row.score}</span>
                {row.today && (
                  <span className="text-[10px] tabular-nums" style={{ color: '#6A6A7A' }}>{row.today}</span>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  )
}

// ── Match content ──────────────────────────────────────────────────
function MatchContent({ match }: { match: MatchDetail }) {
  const live = isLive(match.status)
  const showTeamHero = match.sport === 'soccer' || match.sport === 'basketball'

  return (
    <div className="max-w-2xl mx-auto px-4 pb-16">
      <div className="py-5">
        <Link href="/calendario" className="inline-flex items-center gap-1.5 text-[11px] font-semibold transition-opacity hover:opacity-70"
          style={{ color: '#5A5A6A', textDecoration: 'none', fontFamily: 'var(--font-sport)' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Volver
        </Link>
      </div>

      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <Pill>{match.leagueLabel}</Pill>
        {live && (
          <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#4ade80' }} />
            En Vivo
          </span>
        )}
      </div>

      {showTeamHero && <TeamScoreboard match={match} />}
      {showTeamHero && <InfoRow match={match} />}

      {match.sport === 'soccer'     && <SoccerBlock match={match} />}
      {match.sport === 'basketball' && <BasketballBlock match={match} />}
      {match.sport === 'tennis'     && <TennisBlock match={match} />}
      {match.sport === 'mma'        && <MmaBlock match={match} />}
      {match.sport === 'racing'     && <RacingBlock match={match} />}
      {match.sport === 'golf'       && <GolfBlock match={match} />}

      {!showTeamHero && <InfoRow match={match} />}
    </div>
  )
}

function NotFound() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-24 flex flex-col items-center gap-4 text-center">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
        style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>
        ⚽
      </div>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No se encontró información de este partido.</p>
      <Link href="/calendario" className="text-xs font-semibold px-4 py-2 rounded-full transition-opacity hover:opacity-80"
        style={{ background: 'rgba(124,58,237,0.15)', color: '#C4B5FD', border: '1px solid rgba(124,58,237,0.3)', fontFamily: 'var(--font-sport)', textDecoration: 'none' }}>
        Volver al calendario
      </Link>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────
export default async function MatchPage({
  params,
}: {
  params: Promise<{ ref: string }>
}) {
  const { ref } = await params
  const match   = await fetchMatchDetail(ref)

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }} className="flex flex-col">
      <Header />
      <LiveStrip />
      <main className="flex-1">
        <Suspense fallback={
          <div className="max-w-2xl mx-auto px-4 py-24 text-center">
            <p className="text-sm animate-pulse" style={{ color: '#4A4A5A' }}>Cargando partido…</p>
          </div>
        }>
          {match ? <MatchContent match={match} /> : <NotFound />}
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
