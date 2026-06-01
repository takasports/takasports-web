'use client'

import { useEffect, useState } from 'react'

interface PollOption { entry_id: string; name: string; image_url?: string | null }
interface Poll { id: number; question: string; options: PollOption[]; closes_at: string }
interface ResultRow { entry_id: string; votes: number }
interface PollResponse { poll: Poll | null; results: ResultRow[]; myVote: string | null }

export default function WeeklyPoll({ category = 'jugadores' }: { category?: string }) {
  const [data, setData] = useState<PollResponse | null>(null)
  const [voting, setVoting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/rankings/poll?category=${category}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ poll: null, results: [], myVote: null }))
  }, [category])

  if (!data?.poll) return null
  const { poll, results, myVote } = data
  const totalVotes = results.reduce((a, r) => a + r.votes, 0)

  async function vote(entryId: string) {
    if (voting || myVote) return
    setVoting(true)
    setError(null)
    try {
      const res = await fetch('/api/rankings/poll', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poll_id: poll.id, entry_id: entryId }),
      })
      if (res.status === 401) {
        window.location.href = `/login?returnTo=${encodeURIComponent(window.location.pathname)}`
        return
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error ?? 'Error al votar')
        return
      }
      const fresh = await fetch(`/api/rankings/poll?category=${category}`).then(r => r.json())
      setData(fresh)
    } finally {
      setVoting(false)
    }
  }

  return (
    <div className="rounded-2xl p-5 mb-6"
      style={{ background: 'var(--bg-card)', border: '1px solid rgba(124,58,237,0.18)' }}>
      <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-1"
        style={{ color: '#7C3AED', fontFamily: 'var(--font-sport)' }}>
        Encuesta de la semana · {totalVotes} {totalVotes === 1 ? 'voto' : 'votos'}
      </p>
      <h3 className="text-base font-black mb-4"
        style={{ color: '#E8E8F0', fontFamily: 'var(--font-display)' }}>
        {poll.question}
      </h3>

      <div className="space-y-2">
        {poll.options.map((o) => {
          const v = results.find(r => r.entry_id === o.entry_id)?.votes ?? 0
          const pct = totalVotes > 0 ? Math.round((v / totalVotes) * 100) : 0
          const isMine = myVote === o.entry_id
          const showResults = !!myVote
          return (
            <button
              key={o.entry_id}
              onClick={() => vote(o.entry_id)}
              disabled={!!myVote || voting}
              className="w-full text-left rounded-xl px-3 py-2.5 relative overflow-hidden transition-all"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${isMine ? '#7C3AED' : 'rgba(255,255,255,0.08)'}`,
                cursor: myVote ? 'default' : 'pointer',
              }}>
              {showResults && (
                <div className="absolute inset-y-0 left-0"
                  style={{
                    width: `${pct}%`,
                    background: isMine ? 'rgba(124,58,237,0.22)' : 'rgba(124,58,237,0.10)',
                    transition: 'width 0.6s ease-out',
                  }} />
              )}
              <div className="relative flex items-center gap-3">
                {o.image_url
                  ? <img src={o.image_url} alt="" width={28} height={28} className="rounded-full object-cover" />
                  : <div style={{ width: 28, height: 28 }} className="rounded-full bg-purple-900" />}
                <span className="text-sm font-bold flex-1"
                  style={{ color: '#E8E8F0', fontFamily: 'var(--font-sport)' }}>
                  {o.name}
                </span>
                {showResults && (
                  <span className="text-xs font-black tabular-nums"
                    style={{ color: isMine ? '#C4B5FD' : '#8E8E9E', fontFamily: 'var(--font-display)' }}>
                    {pct}%
                  </span>
                )}
                {isMine && <span title="Tu voto" style={{ color: '#C4B5FD', fontSize: 12 }}>✓</span>}
              </div>
            </button>
          )
        })}
      </div>

      {error && <p className="text-[11px] mt-2" style={{ color: '#f87171' }}>{error}</p>}
      {!myVote && !error && (
        <p className="text-[10px] mt-2" style={{ color: '#5A5A72', fontFamily: 'var(--font-sport)' }}>
          Solo puedes votar una vez por semana.
        </p>
      )}
    </div>
  )
}
