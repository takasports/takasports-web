'use client'

import { useEffect, useMemo, useState } from 'react'
import { GAME_IDS, type GameId } from '@/lib/games-store'

const TOKEN_KEY = 'ts_games_admin_token'

interface Entry {
  game_id:    GameId
  period:     string
  status:     'draft' | 'published'
  payload:    Record<string, unknown>
  updated_at: string
}

interface FunnelRow {
  game_id:          GameId
  started:          number
  completed:        number
  shared:           number
  unique_starters:  number
  completion_rate:  number
}

export default function GamesAdminClient() {
  const [token,   setToken]   = useState('')
  const [gameId,  setGameId]  = useState<GameId>('crackquiz')
  const [period,  setPeriod]  = useState('')
  const [payload, setPayload] = useState('{}')
  const [status,  setStatus]  = useState<'draft' | 'published'>('published')
  const [entries, setEntries] = useState<Entry[]>([])
  const [funnel,  setFunnel]  = useState<FunnelRow[]>([])
  const [msg,     setMsg]     = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [busy,    setBusy]    = useState(false)

  useEffect(() => {
    try { const saved = localStorage.getItem(TOKEN_KEY); if (saved) setToken(saved) } catch { /* */ }
  }, [])

  const headers = useMemo(() => ({
    'content-type':  'application/json',
    'x-admin-token': token,
  }), [token])

  const saveToken = () => {
    try { localStorage.setItem(TOKEN_KEY, token) } catch { /* */ }
    setMsg({ kind: 'ok', text: 'Token guardado en este navegador' })
    setTimeout(() => setMsg(null), 2000)
  }

  const loadList = async () => {
    // Si hay sesión admin (cookie) no hace falta token. El campo se mantiene
    // como fallback para llamadas desde n8n/cron o uso sin login.
    setBusy(true)
    const [resList, resFunnel] = await Promise.all([
      fetch(`/api/admin/games/content?game=${gameId}`, { headers, credentials: 'same-origin' }),
      fetch('/api/admin/games/funnel', { headers, credentials: 'same-origin' }),
    ])
    setBusy(false)
    if (!resList.ok) { setMsg({ kind: 'err', text: `${resList.status} — ${await resList.text()}` }); return }
    const data   = await resList.json() as { entries: Entry[] }
    const fdata  = resFunnel.ok ? await resFunnel.json() as { summary: FunnelRow[] } : { summary: [] }
    setEntries(data.entries)
    setFunnel(fdata.summary ?? [])
    setMsg({ kind: 'ok', text: `${data.entries.length} entradas` })
  }

  const submit = async () => {
    let parsed: Record<string, unknown>
    try { parsed = JSON.parse(payload) }
    catch { setMsg({ kind: 'err', text: 'Payload JSON inválido' }); return }
    if (!period.trim()) { setMsg({ kind: 'err', text: 'Falta periodo' }); return }

    setBusy(true)
    const res = await fetch('/api/admin/games/content', {
      method: 'POST',
      headers,
      credentials: 'same-origin',
      body: JSON.stringify({ game_id: gameId, period: period.trim(), payload: parsed, status }),
    })
    setBusy(false)
    if (!res.ok) { setMsg({ kind: 'err', text: `${res.status} — ${await res.text()}` }); return }
    setMsg({ kind: 'ok', text: `Guardado como ${status}` })
    void loadList()
  }

  const remove = async (g: GameId, p: string) => {
    if (!confirm(`¿Borrar ${g} · ${p}?`)) return
    setBusy(true)
    const res = await fetch(`/api/admin/games/content?game=${g}&period=${encodeURIComponent(p)}`, {
      method: 'DELETE',
      headers,
      credentials: 'same-origin',
    })
    setBusy(false)
    if (!res.ok) { setMsg({ kind: 'err', text: `${res.status} — ${await res.text()}` }); return }
    setMsg({ kind: 'ok', text: 'Borrado' })
    void loadList()
  }

  const loadEntryIntoForm = (e: Entry) => {
    setGameId(e.game_id)
    setPeriod(e.period)
    setPayload(JSON.stringify(e.payload, null, 2))
    setStatus(e.status)
  }

  return (
    <>
    {funnel.length > 0 && (
      <div className="rounded-2xl p-5 mb-6 overflow-x-auto" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <h2 className="text-[11px] font-black uppercase tracking-widest mb-4" style={{ color: '#A78BFA', fontFamily: 'var(--font-sport)' }}>
          Funnel · últimos 7 días
        </h2>
        <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: '#5A5A7A', fontFamily: 'var(--font-sport)' }}>
              <th className="text-left py-2 text-[9px] uppercase tracking-widest font-black">Juego</th>
              <th className="text-right py-2 text-[9px] uppercase tracking-widest font-black">Inicios</th>
              <th className="text-right py-2 text-[9px] uppercase tracking-widest font-black">Completas</th>
              <th className="text-right py-2 text-[9px] uppercase tracking-widest font-black">Únicos</th>
              <th className="text-right py-2 text-[9px] uppercase tracking-widest font-black">Shares</th>
              <th className="text-right py-2 text-[9px] uppercase tracking-widest font-black">Completion %</th>
            </tr>
          </thead>
          <tbody>
            {funnel.map(f => (
              <tr key={f.game_id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <td className="py-2 font-black" style={{ color: '#F0F0F5' }}>{f.game_id}</td>
                <td className="py-2 text-right" style={{ color: '#9090B0' }}>{f.started}</td>
                <td className="py-2 text-right" style={{ color: '#9090B0' }}>{f.completed}</td>
                <td className="py-2 text-right" style={{ color: '#9090B0' }}>{f.unique_starters}</td>
                <td className="py-2 text-right" style={{ color: '#9090B0' }}>{f.shared}</td>
                <td className="py-2 text-right font-black" style={{ color: f.completion_rate >= 50 ? '#4ade80' : '#FCD34D' }}>{f.completion_rate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ── Form ───────────────────────────────────────── */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <h2 className="text-[11px] font-black uppercase tracking-widest mb-4" style={{ color: '#A78BFA', fontFamily: 'var(--font-sport)' }}>
          Publicar
        </h2>

        <Label text="Admin token">
          <div className="flex gap-2">
            <input
              type="password" value={token} onChange={e => setToken(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg text-xs"
              style={{ background: 'rgba(255,255,255,0.04)', color: '#F0F0F5', border: '1px solid rgba(255,255,255,0.06)' }}
              placeholder="GAMES_ADMIN_TOKEN"
            />
            <button onClick={saveToken} className="px-3 rounded-lg text-[10px] font-black uppercase tracking-widest" style={{ background: 'rgba(167,139,250,0.12)', color: '#A78BFA', border: '1px solid rgba(167,139,250,0.25)' }}>
              Guardar
            </button>
          </div>
        </Label>

        <Label text="Juego">
          <select value={gameId} onChange={e => setGameId(e.target.value as GameId)} className="w-full px-3 py-2 rounded-lg text-xs" style={selectStyle}>
            {GAME_IDS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </Label>

        <Label text='Periodo (ej. "2026-W20", "2026-05-15", "laliga-J38")'>
          <input value={period} onChange={e => setPeriod(e.target.value)} className="w-full px-3 py-2 rounded-lg text-xs" style={selectStyle} />
        </Label>

        <Label text="Payload (JSON)">
          <textarea
            value={payload} onChange={e => setPayload(e.target.value)}
            rows={10}
            className="w-full px-3 py-2 rounded-lg text-xs font-mono"
            style={{ ...selectStyle, fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}
          />
        </Label>

        <Label text="Estado">
          <div className="flex gap-2">
            {(['draft','published'] as const).map(s => (
              <button key={s} onClick={() => setStatus(s)} className="flex-1 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest"
                style={{
                  background: status === s ? 'rgba(167,139,250,0.18)' : 'rgba(255,255,255,0.04)',
                  color:      status === s ? '#A78BFA' : '#5A5A7A',
                  border:     status === s ? '1px solid rgba(167,139,250,0.35)' : '1px solid rgba(255,255,255,0.06)',
                  fontFamily: 'var(--font-sport)',
                }}>
                {s}
              </button>
            ))}
          </div>
        </Label>

        <button onClick={submit} disabled={busy} className="w-full mt-2 px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest"
          style={{ background: 'linear-gradient(135deg,#7C3AED,#5B21B6)', color: '#fff', fontFamily: 'var(--font-sport)', cursor: busy ? 'progress' : 'pointer' }}>
          {busy ? 'Enviando…' : 'Publicar / actualizar'}
        </button>

        {msg && (
          <p className="mt-3 text-xs" style={{ color: msg.kind === 'ok' ? '#4ade80' : '#f87171' }}>
            {msg.text}
          </p>
        )}
      </div>

      {/* ── Lista ──────────────────────────────────────── */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[11px] font-black uppercase tracking-widest" style={{ color: '#A78BFA', fontFamily: 'var(--font-sport)' }}>
            Histórico
          </h2>
          <button onClick={loadList} disabled={busy} className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full"
            style={{ background: 'rgba(255,255,255,0.04)', color: '#9090B0', border: '1px solid rgba(255,255,255,0.06)' }}>
            Refrescar
          </button>
        </div>

        {entries.length === 0 ? (
          <p className="text-xs py-4 text-center" style={{ color: 'var(--text-muted)' }}>
            Pulsa "Refrescar" tras introducir el token.
          </p>
        ) : (
          <ul className="space-y-2 max-h-[500px] overflow-y-auto">
            {entries.map(e => (
              <li key={`${e.game_id}-${e.period}`} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <span className="text-[10px] font-black w-20 truncate" style={{ color: '#9090B0', fontFamily: 'var(--font-sport)' }}>{e.game_id}</span>
                <span className="text-[10px] flex-1 truncate" style={{ color: '#F0F0F5', fontFamily: 'var(--font-sport)' }}>{e.period}</span>
                <span className="text-[9px] px-2 py-0.5 rounded-full uppercase tracking-widest" style={{
                  background: e.status === 'published' ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)',
                  color:      e.status === 'published' ? '#4ade80' : '#5A5A7A',
                  fontFamily: 'var(--font-sport)',
                }}>
                  {e.status}
                </span>
                <button onClick={() => loadEntryIntoForm(e)} className="text-[9px] font-black px-2 py-1 rounded uppercase tracking-widest" style={{ color: '#A78BFA', fontFamily: 'var(--font-sport)' }}>Editar</button>
                <button onClick={() => remove(e.game_id, e.period)} className="text-[9px] font-black px-2 py-1 rounded uppercase tracking-widest" style={{ color: '#f87171', fontFamily: 'var(--font-sport)' }}>×</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
    </>
  )
}

const selectStyle = {
  background: 'rgba(255,255,255,0.04)',
  color:      '#F0F0F5',
  border:     '1px solid rgba(255,255,255,0.06)',
}

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="block mb-3">
      <span className="text-[9px] font-black uppercase tracking-widest block mb-1.5" style={{ color: '#5A5A7A', fontFamily: 'var(--font-sport)' }}>
        {text}
      </span>
      {children}
    </label>
  )
}
