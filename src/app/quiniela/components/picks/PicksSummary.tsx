'use client'

import { useState, useEffect, useRef } from 'react'
import { QUINIELA_PICKS_KEY } from '@/components/QuinielaModule'
import type { QuinielaMatch, QuinielaSaved, Pick } from '@/components/QuinielaModule'
import { nameMatch } from '@/lib/quiniela'
import { LEAGUES_KEY, COINS_INITIAL } from '../../lib/constants'
import type { League, MatchResult } from '../../lib/types'
import { isCorrect, getCoins, addCoins } from '../../lib/helpers'
import { MatchCard } from '../match/MatchCard'
import { ConsensusBar } from '../match/ConsensusBar'
import { ResultToast } from '../match/ResultToast'
import { RevealCeremony } from './RevealCeremony'

interface ServerMember { nickname: string; picks: Record<number, string> }

export function PicksSummary({ saved, matches, onReset, onScore, onUpdateSaved }: {
  saved: QuinielaSaved
  matches: QuinielaMatch[]
  onReset: () => void
  onScore?: (correct: number, total: number, results: MatchResult[]) => void
  onUpdateSaved?: (s: QuinielaSaved) => void
}) {
  const [confirmReset, setConfirmReset] = useState(false)
  const [results, setResults] = useState<MatchResult[]>([])
  const [liveScores, setLiveScores] = useState<{ id: string; homeTeam: string; awayTeam: string; homeGoals: number | null; awayGoals: number | null; elapsed: number | null; status: string; matchRef?: string }[]>([])
  const [friendPicksData, setFriendPicksData] = useState<{ nickname: string; picks: Record<number, string> }[]>([])
  const [toast, setToast] = useState<{ home: string; away: string; homeGoals: number; awayGoals: number; correct: boolean } | null>(null)
  const prevResultKeysRef = useRef<Set<string>>(new Set())
  const now = Date.now()
  const anyStarted = matches.some(m => m.isoDate && new Date(m.isoDate).getTime() < now)

  // ── Reveal mechanic ──────────────────────────────────────────────
  const REVEAL_KEY = `ts_quiniela_revealed_${saved.jornada}`
  const [revealed, setRevealed] = useState(() => {
    try { return typeof window !== 'undefined' && !!localStorage.getItem(REVEAL_KEY) } catch { return false }
  })
  const [showCeremony, setShowCeremony] = useState(false)

  // ── Comodín ──────────────────────────────────────────────────────
  const COMODIN_KEY = `ts_quiniela_comodin_${saved.jornada}`
  const COMODIN_COST = 25
  const [comodinUsed, setComodinUsed] = useState(() => {
    try { return typeof window !== 'undefined' && !!localStorage.getItem(COMODIN_KEY) } catch { return false }
  })
  const [comodinTarget, setComodinTarget] = useState<number | null>(null)
  const [coinBalance, setCoinBalance] = useState(() => {
    try { return typeof window !== 'undefined' ? getCoins() : COINS_INITIAL } catch { return COINS_INITIAL }
  })

  useEffect(() => {
    // Load friend picks from first joined league
    try {
      const raw = localStorage.getItem(LEAGUES_KEY)
      if (raw) {
        const leagues: League[] = JSON.parse(raw as string)
        if (leagues.length > 0) {
          fetch(`/api/quiniela/leagues?id=${leagues[0].id}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
              if (data?.members) {
                setFriendPicksData(data.members.filter((m: ServerMember) => m.nickname !== 'Tú'))
              }
            })
            .catch(() => {})
        }
      }
    } catch { /* ignore */ }

    // Poll results + detect new ones for flash cards
    const fetchResults = () =>
      fetch('/api/quiniela/results')
        .then(r => r.ok ? r.json() : [])
        .then((newResults: MatchResult[]) => {
          setResults(newResults)
          newResults.forEach(r => {
            const key = `${r.home}-${r.away}`
            if (!prevResultKeysRef.current.has(key)) {
              prevResultKeysRef.current.add(key)
              const myPick = saved.picks.find(p => nameMatch(p.home, r.home) && nameMatch(p.away, r.away))
              if (myPick) {
                const correct = isCorrect(myPick.pick as Pick, r.outcome)
                setToast({ home: r.home, away: r.away, homeGoals: r.homeGoals, awayGoals: r.awayGoals, correct })
              }
            }
          })
        })
        .catch(() => {})
    fetchResults()
    const t = setInterval(fetchResults, 30_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!anyStarted) return
    const fetchLive = () => {
      if (document.visibilityState === 'hidden') return
      fetch('/api/events/live')
        .then(r => r.ok ? r.json() : [])
        .then(setLiveScores)
        .catch(() => {})
    }
    fetchLive()
    const t = setInterval(fetchLive, 30_000)
    document.addEventListener('visibilitychange', fetchLive)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', fetchLive)
    }
  }, [anyStarted])


  function getResult(home: string, away: string, espnId?: string): MatchResult | undefined {
    if (espnId) {
      const byId = results.find(r => r.espnId === espnId)
      if (byId) return byId
    }
    return results.find(r => nameMatch(r.home, home) && nameMatch(r.away, away))
  }
  function getLive(home: string, away: string, espnId?: string) {
    if (espnId) {
      const byId = liveScores.find(f => f.id === espnId || f.matchRef?.endsWith(`_${espnId}`))
      if (byId) return byId
    }
    return liveScores.find(f => nameMatch(f.homeTeam, home) && nameMatch(f.awayTeam, away))
  }

  const evaluated = results.length > 0 ? saved.picks.filter((p, i) => getResult(p.home, p.away, matches[i]?.espnId)).length : 0
  const scored = saved.picks.filter((p, i) => {
    const r = getResult(p.home, p.away, matches[i]?.espnId)
    return r && isCorrect(p.pick as Pick, r.outcome)
  }).length
  const allEvaluated = evaluated > 0 && evaluated === saved.picks.length

  useEffect(() => {
    if (allEvaluated && revealed && onScore) onScore(scored, evaluated, results)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allEvaluated, revealed])

  const isResultVisible = (i: number) => {
    const hasResult = !!getResult(saved.picks[i].home, saved.picks[i].away)
    if (!hasResult) return false
    if (!allEvaluated) return true
    return revealed
  }

  const handleComodinPick = (idx: number, newPick: Pick) => {
    const newPicks = saved.picks.map((p, i) => i === idx ? { ...p, pick: newPick } : p)
    const newSaved = { ...saved, picks: newPicks }
    try { localStorage.setItem(QUINIELA_PICKS_KEY, JSON.stringify(newSaved)) } catch {}
    onUpdateSaved?.(newSaved)
    const newBalance = addCoins(-COMODIN_COST, 'Comodín usado')
    setCoinBalance(newBalance)
    setComodinUsed(true)
    setComodinTarget(null)
    try { localStorage.setItem(COMODIN_KEY, '1') } catch {}
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Flash card toast */}
      {toast && (
        <ResultToast
          {...toast}
          onDismiss={() => setToast(null)}
        />
      )}

      {showCeremony && (
        <RevealCeremony
          picks={saved.picks}
          results={results}
          matchData={matches}
          onComplete={() => {
            setShowCeremony(false)
            setRevealed(true)
            try { localStorage.setItem(REVEAL_KEY, '1') } catch {}
          }}
        />
      )}
      {/* Banner superior */}
      <div className="rounded-2xl px-5 py-4 flex items-center gap-4" style={{
        background: 'linear-gradient(135deg,rgba(34,197,94,0.08) 0%,rgba(16,185,129,0.04) 100%)',
        border: '1px solid rgba(34,197,94,0.2)',
      }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M5 13L9 17L19 7" stroke="#4ade80" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black" style={{ color: '#D0F0D8', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>Predicción registrada</p>
          <p className="text-[10px]" style={{ color: '#3A6A40', fontFamily: 'var(--font-sport)' }}>
            {saved.jornada} · {saved.picks.length} partidos · {anyStarted ? 'En curso · bloqueada' : 'Puedes cambiar hasta el pitido'}
          </p>
        </div>
        {!anyStarted && (
          confirmReset ? (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => { onReset(); setConfirmReset(false) }} className="text-[10px] font-black px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', fontFamily: 'var(--font-sport)' }}>
                Sí, cambiar
              </button>
              <button onClick={() => setConfirmReset(false)} className="text-[10px] font-black px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)', color: '#6060A0', border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'var(--font-sport)' }}>
                No
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmReset(true)} className="text-[10px] font-black px-2.5 py-1.5 rounded-lg flex-shrink-0" style={{ background: 'rgba(255,255,255,0.04)', color: '#4A4A6A', border: '1px solid rgba(255,255,255,0.07)', fontFamily: 'var(--font-sport)' }}>
              Cambiar picks
            </button>
          )
        )}
        {anyStarted && (
          <div className="flex-shrink-0 flex items-center gap-1.5" style={{ color: '#4A4A6A' }}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <rect x="2" y="5" width="8" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M4 5V3.5a2 2 0 014 0V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <span className="text-[9px] font-black uppercase tracking-widest" style={{ fontFamily: 'var(--font-sport)' }}>Bloqueado</span>
          </div>
        )}
      </div>

      {/* Marcador final (tras reveal) */}
      {allEvaluated && revealed && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl" style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.18)' }}>
          <span className="text-lg">⭐</span>
          <span className="text-sm font-black" style={{ color: '#fbbf24', fontFamily: 'var(--font-display)' }}>{scored} de {evaluated} acertados</span>
          <span className="text-[10px]" style={{ color: '#6A5020', fontFamily: 'var(--font-sport)' }}>Jornada cerrada</span>
          <button
            onClick={() => {
              const emoji = saved.picks.map(p => {
                const r = getResult(p.home, p.away)
                if (!r) return '⏳'
                return isCorrect(p.pick as Pick, r.outcome) ? '✅' : '❌'
              }).join('')
              const text = `Acerté ${scored}/${evaluated} en la Quiniela TakaSports ${emoji}\ntakasports.com/quiniela`
              if (navigator.share) navigator.share({ text }).catch(() => {})
              else navigator.clipboard?.writeText(text).catch(() => {})
            }}
            className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black transition-opacity hover:opacity-75"
            style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)', fontFamily: 'var(--font-sport)' }}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M5 2H2a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1V7M8 1h3v3M5 7l6-6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Compartir
          </button>
        </div>
      )}

      {/* Botón REVELAR — grande, sólo cuando todos los resultados están listos */}
      {allEvaluated && !revealed && (
        <button
          onClick={() => setShowCeremony(true)}
          className="w-full rounded-2xl font-black uppercase tracking-widest transition-transform hover:scale-[1.015] active:scale-[0.98]"
          style={{
            minHeight: 68,
            fontSize: 15,
            fontFamily: 'var(--font-sport)',
            letterSpacing: '0.1em',
            background: 'linear-gradient(135deg,#7C3AED 0%,#5B21B6 50%,#9333ea 100%)',
            color: '#fff',
            border: '1px solid rgba(124,58,237,0.5)',
            boxShadow: '0 8px 36px rgba(124,58,237,0.55), inset 0 1px 0 rgba(255,255,255,0.12)',
            animation: 'quinielaPulse 2.2s ease-in-out infinite',
          }}
        >
          ⚡ Revelar resultados
        </button>
      )}

      {/* Cards */}
      {saved.picks.map((p, i) => {
        const matchData = matches[i] ?? { home: p.home, away: p.away }
        const result    = getResult(p.home, p.away, matchData.espnId)
        const live      = !result ? getLive(p.home, p.away, matchData.espnId) : undefined
        const correct   = result ? isCorrect(p.pick as Pick, result.outcome) : false
        const visible   = isResultVisible(i)
        const isComodinTarget = comodinTarget === i
        const matchStarted = !!(matchData.isoDate && new Date(matchData.isoDate).getTime() < Date.now())

        return (
          <div key={i} className="flex flex-col">
            <div className="relative">
              <MatchCard
                match={{ home: p.home, away: p.away, homeLogo: matchData.homeLogo, awayLogo: matchData.awayLogo, homeShort: matchData.homeShort, awayShort: matchData.awayShort }}
                index={i}
                pick={p.pick as Pick}
                onPick={(newPick) => isComodinTarget && handleComodinPick(i, newPick)}
                forceLocked={!isComodinTarget}
                comp={matchData.comp}
                time={matchData.time}
                isoDate={matchData.isoDate}
                odds={matchData.odds}
                comodinAvailable={!comodinUsed && !comodinTarget && matchStarted}
                isComodinUnlocked={isComodinTarget}
                onUseComodin={() => setComodinTarget(i)}
                comodinCost={COMODIN_COST}
                coinBalance={coinBalance}
                liveScore={live && live.homeGoals != null ? { homeGoals: live.homeGoals, awayGoals: live.awayGoals, elapsed: live.elapsed, status: live.status } : undefined}
                finalScore={visible && result ? { homeGoals: result.homeGoals, awayGoals: result.awayGoals } : undefined}
                correct={visible && result ? correct : undefined}
                friendPicks={friendPicksData.filter(m => m.picks[i] !== undefined).map(m => ({ name: m.nickname, pick: m.picks[i] })).slice(0, 3)}
                isCaptain={saved.captainIdx === i}
              />
            </div>
            {/* Consenso de la comunidad */}
            <ConsensusBar match={matchData} userPick={p.pick as Pick} />
          </div>
        )
      })}
    </div>
  )
}
