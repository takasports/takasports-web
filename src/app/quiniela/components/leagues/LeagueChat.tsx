'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface ChatMessage { id: string; nickname: string; message: string; created_at: string }

export function LeagueChat({ leagueId }: { leagueId: string }) {
  const [msgs, setMsgs]       = useState<ChatMessage[]>([])
  const [input, setInput]     = useState('')
  const [nick, setNick]       = useState(() => { try { return localStorage.getItem('ts_quiniela_nickname') ?? '' } catch { return '' } })
  const [sending, setSending] = useState(false)
  const [showNick, setShowNick] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadMsgs = useCallback(() => {
    fetch(`/api/quiniela/chat?liga=${leagueId}&limit=30`)
      .then(r => r.ok ? r.json() : [])
      .then((data: ChatMessage[]) => setMsgs(data))
      .catch(() => {})
  }, [leagueId])

  useEffect(() => { loadMsgs(); const t = setInterval(loadMsgs, 15_000); return () => clearInterval(t) }, [loadMsgs])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])
  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(null), 4000)
    return () => clearTimeout(t)
  }, [error])

  const send = async () => {
    const msg = input.trim()
    const nickname = nick.trim() || 'Anon'
    if (!msg || sending) return
    setSending(true)
    setError(null)
    try {
      localStorage.setItem('ts_quiniela_nickname', nickname)
      const res = await fetch('/api/quiniela/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ liga: leagueId, message: msg, nickname }),
      })
      if (res.status === 429) {
        const j = await res.json().catch(() => ({})) as { error?: string; retryMs?: number }
        const secs = Math.ceil((j.retryMs ?? 4000) / 1000)
        setError(`${j.error ?? 'rate limit'} (${secs}s)`)
      } else if (!res.ok) {
        setError('No se pudo enviar')
      } else {
        setInput('')
        loadMsgs()
      }
    } catch { setError('Sin conexión') }
    setSending(false)
  }

  const remove = async (id: string) => {
    if (!confirm('¿Borrar este mensaje?')) return
    try {
      const res = await fetch(`/api/quiniela/chat?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (res.ok) {
        setMsgs(prev => prev.filter(m => m.id !== id))
      } else if (res.status === 403 || res.status === 401) {
        setError('Solo el autor o el owner puede borrar')
      } else {
        setError('No se pudo borrar')
      }
    } catch { setError('Sin conexión') }
  }

  return (
    <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: '#3A3A58', fontFamily: 'var(--font-sport)' }}>
        Chat de liga
      </p>

      {/* Messages */}
      <div className="flex flex-col gap-1.5 mb-2 max-h-48 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
        {msgs.length === 0 && (
          <p className="text-[10px]" style={{ color: '#2A2A40', fontFamily: 'var(--font-sport)' }}>
            Sin mensajes aún. ¡Di algo!
          </p>
        )}
        {msgs.map(m => (
          <div key={m.id} className="group flex flex-col gap-0.5 relative">
            <span className="text-[9px] font-black" style={{ color: '#5A4878', fontFamily: 'var(--font-sport)' }}>
              {m.nickname} · {new Date(m.created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <p className="text-[11px] px-2.5 py-1.5 rounded-xl inline-block max-w-full break-words pr-7" style={{ background: 'rgba(255,255,255,0.04)', color: '#C0C0D8', fontFamily: 'var(--font-display)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {m.message}
            </p>
            <button
              type="button"
              aria-label="Borrar mensaje"
              onClick={() => remove(m.id)}
              className="absolute bottom-1 right-1 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-70 focus:opacity-100 transition-opacity"
              style={{ background: 'rgba(239,68,68,0.12)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.25)', cursor: 'pointer' }}
            >
              <svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            </button>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div role="alert" className="text-[10px] mb-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.2)', fontFamily: 'var(--font-sport)' }}>
          {error}
        </div>
      )}

      {/* Nickname prompt */}
      {showNick && (
        <input
          className="w-full rounded-xl px-3 py-2 text-xs mb-1.5 outline-none"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(124,58,237,0.3)', color: '#C0C0D8', fontFamily: 'var(--font-display)' }}
          placeholder="Tu nombre en la liga…"
          value={nick}
          maxLength={24}
          onChange={e => setNick(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && setShowNick(false)}
          onBlur={() => setShowNick(false)}
          autoFocus
        />
      )}

      {/* Input */}
      <div className="flex gap-2">
        <button onClick={() => setShowNick(v => !v)} className="text-[10px] px-2 py-1.5 rounded-lg flex-shrink-0 truncate max-w-[60px]" style={{ background: 'rgba(124,58,237,0.1)', color: '#7C6AAA', border: '1px solid rgba(124,58,237,0.2)', fontFamily: 'var(--font-sport)', cursor: 'pointer' }}>
          {nick || 'Anon'}
        </button>
        <input
          className="flex-1 rounded-xl px-3 py-1.5 text-[11px] outline-none"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#C0C0D8', fontFamily: 'var(--font-display)' }}
          placeholder="Mensaje…"
          value={input}
          maxLength={280}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
        />
        <button
          onClick={send}
          disabled={!input.trim() || sending}
          className="px-3 py-1.5 rounded-xl flex-shrink-0 text-[11px] font-black transition-opacity"
          style={{
            background: input.trim() ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.04)',
            color: input.trim() ? '#C4B5FD' : '#3A3A52',
            border: input.trim() ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.06)',
            cursor: input.trim() && !sending ? 'pointer' : 'not-allowed',
          }}
        >
          →
        </button>
      </div>
    </div>
  )
}
