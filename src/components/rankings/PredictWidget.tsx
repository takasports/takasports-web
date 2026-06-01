'use client'

import { useEffect, useState } from 'react'

interface Opt { id: string; name: string; image_url: string | null; score: number }
interface PredictResp { week: string; category: string; options: Opt[]; myPick: string | null }

export default function PredictWidget({ category = 'jugadores' }: { category?: string }) {
  const [data, setData] = useState<PredictResp | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch(`/api/rankings/predict?category=${category}`)
      .then(r => r.json()).then(setData)
      .catch(() => setData({ week: '', category, options: [], myPick: null }))
  }, [category])

  if (!data || data.options.length === 0) return null

  async function pick(entryId: string) {
    if (busy || data?.myPick) return
    setBusy(true)
    try {
      const res = await fetch('/api/rankings/predict', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, entry_id: entryId }),
      })
      if (res.status === 401) {
        window.location.href = `/login?returnTo=${encodeURIComponent(window.location.pathname)}`
        return
      }
      if (res.ok) {
        const fresh = await fetch(`/api/rankings/predict?category=${category}`).then(r => r.json())
        setData(fresh)
      }
    } finally { setBusy(false) }
  }

  return (
    <div className="rounded-2xl p-5 mb-6"
      style={{ background: 'var(--bg-card)', border: '1px solid rgba(245,158,11,0.18)' }}>
      <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-1"
        style={{ color: '#f59e0b', fontFamily: 'var(--font-sport)' }}>
        Predicción · próxima semana
      </p>
      <h3 className="text-base font-black mb-3"
        style={{ color: '#E8E8F0', fontFamily: 'var(--font-display)' }}>
        ¿Quién será #1 el próximo lunes?
      </h3>
      <div className="grid grid-cols-5 gap-2">
        {data.options.map((o) => {
          const isMine = data.myPick === o.id
          return (
            <button key={o.id} onClick={() => pick(o.id)}
              disabled={!!data.myPick || busy}
              className="flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all"
              style={{
                background: isMine ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isMine ? '#f59e0b' : 'rgba(255,255,255,0.08)'}`,
                cursor: data.myPick ? 'default' : 'pointer',
              }}>
              {o.image_url ? (
                <img src={o.image_url} alt="" width={42} height={42}
                  style={{ borderRadius: 9999, objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 42, height: 42, borderRadius: 9999, background: 'rgba(245,158,11,0.2)' }} />
              )}
              <span className="text-[10px] text-center leading-tight font-bold line-clamp-2"
                style={{ color: '#E8E8F0', fontFamily: 'var(--font-sport)' }}>
                {o.name}
              </span>
            </button>
          )
        })}
      </div>
      {data.myPick && (
        <p className="text-[10px] mt-3" style={{ color: '#f59e0b', fontFamily: 'var(--font-sport)' }}>
          ✓ Tu predicción está guardada. Se resuelve el lunes 10:30.
        </p>
      )}
    </div>
  )
}
