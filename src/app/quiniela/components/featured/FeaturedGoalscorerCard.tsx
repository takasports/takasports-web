'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'

// ─────────────────────────────────────────────────────────────────
// Goleador del partido destacado — UI principal.
//
// Estados visibles:
//   · no-featured     → no hay partido destacado esta jornada (mensaje sutil)
//   · no-auth         → invita a login
//   · roster-pending  → ESPN aún no publicó alineaciones (típico >1h antes)
//   · open-no-pick    → selector de candidatos
//   · open-with-pick  → pick guardado, opción de cambiar
//   · live            → pick locked, partido en curso
//   · resolved-win    → tu jugador marcó → cuántos goles + monedas ganadas
//   · resolved-lose   → tu jugador no marcó
//   · resolved-no-pick → no participaste en este destacado
// ─────────────────────────────────────────────────────────────────

interface Candidate {
  id: string
  name: string
  shortName?: string
  jersey?: string
  posAbbr?: string
  headshot?: string
  teamSide: 'home' | 'away'
  starter?: boolean
}

interface TeamLineup {
  formation: string
  starters: Candidate[]
  bench: Candidate[]
}

interface MatchInfo {
  jornada: string
  espnId: string
  leagueSlug: string
  home: string
  away: string
  homeAbbr?: string
  awayAbbr?: string
  homeLogo?: string
  awayLogo?: string
  isoDate: string
  comp: string
}

interface UserPick {
  espn_id: string
  league_slug: string
  player_id: string
  player_name: string
  player_team_side: 'home' | 'away'
  resolved: boolean
  goals_scored: number
  awarded_coins: number
  created_at: string
  computed_at: string | null
}

interface FeaturedData {
  match: MatchInfo | null
  candidates: { home: TeamLineup; away: TeamLineup; status: 'pre' | 'live' | 'final' | 'unknown' } | null
  userPick: UserPick | null
  justResolved?: { goals: number; awarded: number }
}

const ACCENT = '#F472B6'      // fucsia distinto al purple base de la quiniela
const ACCENT_DIM = '#BE185D'

export default function FeaturedGoalscorerCard({ authed }: { authed: boolean }) {
  const [data, setData] = useState<FeaturedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [posting, setPosting] = useState(false)
  const [search, setSearch] = useState('')
  const [changing, setChanging] = useState(false)   // toggle entre "ver pick" y "cambiar pick"
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/quiniela/featured', { cache: 'no-store' })
      if (r.ok) {
        const json = await r.json() as FeaturedData
        setData(json)
        // Reset selección si ya guardó pick
        if (json.userPick) setSelectedId(null)
      }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  // ── Derivados ─────────────────────────────────────────────────
  const match = data?.match ?? null
  const candidates = data?.candidates ?? null
  const userPick = data?.userPick ?? null
  const status = candidates?.status ?? 'unknown'

  // Kickoff pasado en cliente — para deshabilitar selector si el server
  // aún no lo marcó como live (latencia del cache de ESPN).
  const kickoffPassed = useMemo(() => {
    if (!match?.isoDate) return false
    return new Date(match.isoDate).getTime() <= Date.now()
  }, [match?.isoDate])

  const allCandidates = useMemo<Candidate[]>(() => {
    if (!candidates) return []
    return [
      ...candidates.home.starters, ...candidates.home.bench,
      ...candidates.away.starters, ...candidates.away.bench,
    ]
  }, [candidates])

  const filtered = useMemo<Candidate[]>(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allCandidates
    return allCandidates.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.shortName?.toLowerCase().includes(q) ?? false),
    )
  }, [allCandidates, search])

  // ── Submit ────────────────────────────────────────────────────
  const submit = useCallback(async () => {
    if (!selectedId || !match || posting) return
    const cand = allCandidates.find(c => c.id === selectedId)
    if (!cand) return
    setPosting(true)
    setError(null)
    try {
      const r = await fetch('/api/quiniela/featured', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          espnId: match.espnId,
          playerId: cand.id,
          playerName: cand.name,
          teamSide: cand.teamSide,
        }),
      })
      if (r.ok) {
        setChanging(false)
        await load()
      } else {
        const j = await r.json().catch(() => ({}))
        setError((j?.error as string) || 'Error guardando pick')
      }
    } catch { setError('Error de red') }
    finally { setPosting(false) }
  }, [selectedId, match, allCandidates, posting, load])

  // ── Don't show anything during initial load (skeleton minimal) ──
  if (loading) {
    return (
      <div
        className="rounded-2xl p-5 mb-4"
        style={{
          background: 'rgba(244,114,182,0.04)',
          border: '1px solid rgba(244,114,182,0.15)',
          minHeight: 100,
          animation: 'pulse 1.6s ease-in-out infinite alternate',
        }}
      />
    )
  }

  // Sin featured match → no renderiza nada (sin ruido visual)
  if (!match) return null

  const compShort = match.comp.length > 14 ? match.comp.slice(0, 14) + '…' : match.comp
  const kickoffLabel = (() => {
    try {
      return new Intl.DateTimeFormat('es-ES', {
        weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      }).format(new Date(match.isoDate))
    } catch { return '' }
  })()

  // ── Render principal ─────────────────────────────────────────
  return (
    <div
      className="rounded-2xl overflow-hidden mb-4"
      style={{
        background: 'linear-gradient(145deg, rgba(244,114,182,0.08) 0%, rgba(190,24,93,0.04) 100%)',
        border: '1px solid rgba(244,114,182,0.25)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
      }}
    >
      {/* Header */}
      <div
        className="px-5 py-4 flex items-center gap-3"
        style={{ borderBottom: '1px solid rgba(244,114,182,0.15)' }}
      >
        <span style={{ fontSize: 22, lineHeight: 1 }}>🎯</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black" style={{ color: '#F9A8D4', fontFamily: 'var(--font-display)' }}>
            Goleador del partido destacado
          </p>
          <p className="text-[10px]" style={{ color: '#C77FAE', fontFamily: 'var(--font-sport)' }}>
            Bonus de la jornada · 100 / 200 / 350 pts según los goles
          </p>
        </div>
        <span
          className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full flex-shrink-0"
          style={{
            background: 'rgba(244,114,182,0.14)',
            color: ACCENT,
            border: '1px solid rgba(244,114,182,0.3)',
            fontFamily: 'var(--font-sport)',
          }}
        >
          {compShort}
        </span>
      </div>

      {/* Match */}
      <div className="px-5 py-4 flex items-center justify-center gap-3" style={{ background: 'rgba(0,0,0,0.18)' }}>
        <TeamPill name={match.home} abbr={match.homeAbbr} logo={match.homeLogo} />
        <span className="text-xs font-black" style={{ color: '#9B6B85', fontFamily: 'var(--font-sport)' }}>vs</span>
        <TeamPill name={match.away} abbr={match.awayAbbr} logo={match.awayLogo} />
      </div>
      {kickoffLabel && (
        <div className="px-5 pt-1 pb-3 text-center">
          <p className="text-[10px]" style={{ color: '#8E5A78', fontFamily: 'var(--font-sport)' }}>
            {kickoffLabel}
          </p>
        </div>
      )}

      {/* Body por estado */}
      <div className="px-5 pb-5">
        {!authed && (
          <BlockMessage tone="neutral">
            <span>Iniciá sesión para predecir al goleador.</span>
          </BlockMessage>
        )}

        {authed && status === 'final' && userPick && (
          userPick.awarded_coins > 0 ? (
            <BlockMessage tone="win">
              <div>
                <p className="text-sm font-black" style={{ color: '#86EFAC', fontFamily: 'var(--font-display)' }}>
                  ¡Acertaste! +{userPick.awarded_coins} pts
                </p>
                <p className="text-[11px]" style={{ color: 'rgba(134,239,172,0.7)', fontFamily: 'var(--font-sport)' }}>
                  {userPick.player_name} marcó {userPick.goals_scored} {userPick.goals_scored === 1 ? 'gol' : 'goles'} en el partido.
                </p>
              </div>
            </BlockMessage>
          ) : (
            <BlockMessage tone="neutral">
              <div>
                <p className="text-sm font-black" style={{ color: '#E0E0F0', fontFamily: 'var(--font-display)' }}>
                  Esta vez no
                </p>
                <p className="text-[11px]" style={{ color: '#8B8BA8', fontFamily: 'var(--font-sport)' }}>
                  {userPick.player_name} no marcó. Probá la próxima jornada.
                </p>
              </div>
            </BlockMessage>
          )
        )}

        {authed && status === 'final' && !userPick && (
          <BlockMessage tone="neutral">
            <span>No participaste en este destacado. La próxima jornada te avisamos.</span>
          </BlockMessage>
        )}

        {authed && (status === 'live' || (status === 'pre' && kickoffPassed)) && userPick && (
          <BlockMessage tone="locked">
            <div>
              <p className="text-sm font-black" style={{ color: '#FCD34D', fontFamily: 'var(--font-display)' }}>
                Tu pick: {userPick.player_name}
              </p>
              <p className="text-[11px]" style={{ color: 'rgba(252,211,77,0.7)', fontFamily: 'var(--font-sport)' }}>
                Partido en curso · vuelve al terminar para ver el resultado.
              </p>
            </div>
          </BlockMessage>
        )}

        {authed && status === 'pre' && !kickoffPassed && (
          <PrePicker
            userPick={userPick}
            changing={changing}
            setChanging={setChanging}
            candidates={candidates}
            filtered={filtered}
            search={search}
            setSearch={setSearch}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            posting={posting}
            error={error}
            onSubmit={submit}
            kickoffPassed={kickoffPassed}
          />
        )}

        {/* Edge case: status pre pero el server aún no publicó alineaciones */}
        {authed && status === 'pre' && !kickoffPassed && !userPick && allCandidates.length === 0 && (
          <BlockMessage tone="neutral">
            <span>Las alineaciones se publican ~1h antes del kickoff. Vuelve más cerca del inicio.</span>
          </BlockMessage>
        )}
      </div>
    </div>
  )
}

// ── Subcomponentes ──────────────────────────────────────────────

function TeamPill({ name, abbr, logo }: { name: string; abbr?: string; logo?: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl flex-shrink-0 min-w-0" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      {logo ? (
        <img src={logo} alt="" width={20} height={20} style={{ flexShrink: 0 }} />
      ) : (
        <span className="w-5 h-5 rounded-full flex-shrink-0" style={{ background: 'rgba(255,255,255,0.1)' }} />
      )}
      <span className="text-xs font-black truncate" style={{ color: '#E0E0F0', fontFamily: 'var(--font-display)' }}>
        {abbr ?? name}
      </span>
    </div>
  )
}

function BlockMessage({ children, tone }: { children: React.ReactNode; tone: 'neutral' | 'win' | 'lose' | 'locked' }) {
  const styles = {
    neutral: { bg: 'rgba(255,255,255,0.02)', border: 'rgba(255,255,255,0.06)' },
    win:     { bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.25)' },
    lose:    { bg: 'rgba(239,68,68,0.06)',   border: 'rgba(239,68,68,0.18)' },
    locked:  { bg: 'rgba(252,211,77,0.05)',  border: 'rgba(252,211,77,0.2)' },
  }[tone]
  return (
    <div
      className="rounded-xl px-4 py-3 text-center"
      style={{
        background: styles.bg,
        border: `1px solid ${styles.border}`,
        color: '#C0C0D8',
        fontSize: 12,
        fontFamily: 'var(--font-sport)',
      }}
    >
      {children}
    </div>
  )
}

function PrePicker({
  userPick, changing, setChanging,
  candidates, filtered, search, setSearch,
  selectedId, setSelectedId, posting, error, onSubmit, kickoffPassed,
}: {
  userPick: UserPick | null
  changing: boolean
  setChanging: (b: boolean) => void
  candidates: FeaturedData['candidates']
  filtered: Candidate[]
  search: string
  setSearch: (s: string) => void
  selectedId: string | null
  setSelectedId: (id: string | null) => void
  posting: boolean
  error: string | null
  onSubmit: () => void
  kickoffPassed: boolean
}) {
  // Si hay pick y no está en modo cambiar → mostrar pick existente
  if (userPick && !changing) {
    return (
      <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(244,114,182,0.06)', border: '1px solid rgba(244,114,182,0.2)' }}>
        <span style={{ fontSize: 22, lineHeight: 1 }}>⚽</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black" style={{ color: '#F9A8D4', fontFamily: 'var(--font-display)' }}>
            Tu pick: {userPick.player_name}
          </p>
          <p className="text-[10px]" style={{ color: '#9B6B85', fontFamily: 'var(--font-sport)' }}>
            Si marca al menos 1 gol, sumás puntos extra al Ranked.
          </p>
        </div>
        {!kickoffPassed && (
          <button
            onClick={() => setChanging(true)}
            className="text-[10px] font-black px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
            style={{ background: 'rgba(244,114,182,0.12)', color: '#F472B6', border: '1px solid rgba(244,114,182,0.3)', fontFamily: 'var(--font-sport)' }}
          >
            Cambiar
          </button>
        )}
      </div>
    )
  }

  // Picker
  const hasAnyPlayer =
    candidates && (
      candidates.home.starters.length + candidates.home.bench.length +
      candidates.away.starters.length + candidates.away.bench.length
    ) > 0
  if (!candidates || !hasAnyPlayer) return null

  return (
    <div>
      <input
        type="text"
        placeholder="Buscar jugador…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-xs mb-3 outline-none"
        style={{
          background: 'rgba(0,0,0,0.3)',
          color: '#E0E0F0',
          border: '1px solid rgba(255,255,255,0.08)',
          fontFamily: 'var(--font-display)',
        }}
      />

      <div className="grid grid-cols-2 gap-3 mb-3" style={{ maxHeight: 380, overflowY: 'auto' }}>
        <LineupColumn
          label="Local"
          lineup={candidates.home}
          searchFilter={search.trim().toLowerCase()}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <LineupColumn
          label="Visitante"
          lineup={candidates.away}
          searchFilter={search.trim().toLowerCase()}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>

      {error && (
        <p className="text-[10px] text-center mb-2" style={{ color: '#F87171', fontFamily: 'var(--font-sport)' }}>
          {error}
        </p>
      )}

      <div className="flex gap-2">
        {userPick && (
          <button
            onClick={() => { setChanging(false); setSelectedId(null) }}
            className="px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-opacity hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.04)', color: '#6A6A8A', border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'var(--font-sport)' }}
          >
            Cancelar
          </button>
        )}
        <button
          onClick={onSubmit}
          disabled={!selectedId || posting}
          className="flex-1 py-2.5 rounded-xl font-black uppercase tracking-widest transition-opacity disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
          style={{
            background: selectedId
              ? `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DIM})`
              : 'rgba(255,255,255,0.04)',
            color: selectedId ? '#fff' : '#3A3A52',
            fontSize: 11,
            fontFamily: 'var(--font-sport)',
            letterSpacing: '0.08em',
            boxShadow: selectedId ? `0 4px 16px ${ACCENT_DIM}50` : 'none',
          }}
        >
          {posting ? 'Guardando…' : userPick ? 'Cambiar pick' : 'Confirmar goleador'}
        </button>
      </div>
    </div>
  )
}

// Agrupa una lista de candidatos por línea táctica (FWD/MID/DEF) para
// que la formación se vea como en un sitio de fantasy real.
function groupByLine(players: Candidate[]): { line: string; players: Candidate[] }[] {
  const lines = new Map<string, Candidate[]>()
  for (const p of players) {
    const pos = (p.posAbbr ?? '').toUpperCase()
    let line: string
    if (['F','CF','ST','SS','LW','RW','FW'].includes(pos)) line = 'Delanteros'
    else if (['M','CM','AM','DM','LM','RM','MF'].includes(pos)) line = 'Centrocampistas'
    else if (['D','CB','LB','RB','WB','DF'].includes(pos)) line = 'Defensas'
    else line = 'Otros'
    if (!lines.has(line)) lines.set(line, [])
    lines.get(line)!.push(p)
  }
  // Orden FWD → MID → DEF → Otros
  const ORDER = ['Delanteros', 'Centrocampistas', 'Defensas', 'Otros']
  return ORDER.filter(l => lines.has(l)).map(l => ({ line: l, players: lines.get(l)! }))
}

function LineupColumn({
  label, lineup, searchFilter, selectedId, onSelect,
}: {
  label: string
  lineup: TeamLineup
  searchFilter: string
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const [showBench, setShowBench] = useState(false)

  const filterByQ = (list: Candidate[]) => {
    if (!searchFilter) return list
    return list.filter(c =>
      c.name.toLowerCase().includes(searchFilter) ||
      (c.shortName?.toLowerCase().includes(searchFilter) ?? false),
    )
  }
  const starters = filterByQ(lineup.starters)
  const bench = filterByQ(lineup.bench)
  const grouped = groupByLine(starters)
  const isEmpty = starters.length === 0 && bench.length === 0

  return (
    <div>
      {/* Header con liga / equipo + formación táctica */}
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#F9A8D4', fontFamily: 'var(--font-sport)' }}>
          {label}
        </p>
        {lineup.formation && (
          <span
            className="text-[9px] font-black tabular-nums px-1.5 py-0.5 rounded"
            style={{ background: 'rgba(244,114,182,0.12)', color: '#F472B6', border: '1px solid rgba(244,114,182,0.25)', fontFamily: 'var(--font-display)' }}
            title="Sistema táctico anunciado"
          >
            {lineup.formation}
          </span>
        )}
      </div>

      {isEmpty && (
        <p className="text-[10px] py-2 text-center" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>
          {searchFilter ? '—' : 'Alineación no publicada todavía'}
        </p>
      )}

      {/* Titulares agrupados por línea (FWD → MID → DEF) */}
      {grouped.length > 0 && (
        <div className="flex flex-col gap-2">
          {grouped.map(g => (
            <div key={g.line}>
              <p className="text-[8px] font-black uppercase tracking-widest mb-1" style={{ color: '#5A4070', fontFamily: 'var(--font-sport)' }}>
                {g.line}
              </p>
              <div className="flex flex-col gap-1">
                {g.players.map(p => (
                  <PlayerButton key={p.id} player={p} selectedId={selectedId} onSelect={onSelect} starter />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Banquillo colapsable */}
      {bench.length > 0 && (
        <div className="mt-3 pt-2" style={{ borderTop: '1px dashed rgba(255,255,255,0.06)' }}>
          <button
            onClick={() => setShowBench(v => !v)}
            className="w-full flex items-center justify-between text-[9px] font-black uppercase tracking-widest mb-1.5 py-1"
            style={{ background: 'none', border: 'none', color: '#6A4A80', fontFamily: 'var(--font-sport)', cursor: 'pointer' }}
            aria-expanded={showBench}
          >
            <span>Banquillo ({bench.length})</span>
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ transform: showBench ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {showBench && (
            <div className="flex flex-col gap-1">
              {bench.map(p => (
                <PlayerButton key={p.id} player={p} selectedId={selectedId} onSelect={onSelect} starter={false} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PlayerButton({ player: p, selectedId, onSelect, starter }: {
  player: Candidate
  selectedId: string | null
  onSelect: (id: string) => void
  starter: boolean
}) {
  const isSel = selectedId === p.id
  return (
    <button
      onClick={() => onSelect(p.id)}
      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all"
      style={{
        background: isSel ? 'rgba(244,114,182,0.18)' : 'rgba(255,255,255,0.02)',
        border: isSel ? '1px solid rgba(244,114,182,0.5)' : '1px solid transparent',
        cursor: 'pointer',
        opacity: starter ? 1 : 0.78,
      }}
      aria-pressed={isSel}
    >
      {p.headshot ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.headshot} alt="" width={20} height={20} style={{ borderRadius: '50%', flexShrink: 0 }} />
      ) : (
        <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[8px] font-black" style={{ background: 'rgba(255,255,255,0.06)', color: '#6A6A8A', fontFamily: 'var(--font-sport)' }}>
          {p.jersey ?? '?'}
        </span>
      )}
      <span className="text-[11px] font-bold truncate flex-1 min-w-0" style={{ color: isSel ? '#F9A8D4' : '#C0C0D8', fontFamily: 'var(--font-display)' }}>
        {p.shortName || p.name}
      </span>
      {p.posAbbr && (
        <span className="text-[8px] font-black flex-shrink-0" style={{ color: isSel ? '#F472B6' : '#3A3A52', fontFamily: 'var(--font-sport)' }}>
          {p.posAbbr}
        </span>
      )}
    </button>
  )
}

