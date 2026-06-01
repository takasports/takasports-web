'use client'

import { useState, useEffect } from 'react'
import type { League, MatchResult } from '../../lib/types'
import { computeStandings, getPlayerAlias } from '../../lib/helpers'
import type { LeagueMatchKey, LeagueMemberLite } from '../../lib/helpers'
import { LeagueChat } from './LeagueChat'
import { createClient } from '@/lib/supabase'

export function LeagueExpanded({ league, localResults }: { league: League; localResults: MatchResult[] }) {
  const [members, setMembers] = useState<LeagueMemberLite[]>([])
  const [matchKeys, setMatchKeys] = useState<LeagueMatchKey[]>([])
  const [loading, setLoading] = useState(true)
  // AD — Settings de la liga + identidad del user (para saber si es owner).
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [exactEnabled, setExactEnabled] = useState<boolean>(true)
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [toggling, setToggling] = useState(false)
  const [toggleError, setToggleError] = useState<string | null>(null)

  useEffect(() => {
    const sb = createClient()
    if (!sb) return
    sb.auth.getUser().then(({ data }) => setMyUserId(data.user?.id ?? null))
  }, [])

  const isOwner = !!myUserId && myUserId === ownerId

  // Refresca miembros periódicamente: aparecen nuevos picks y la
  // clasificación «vosotros vs» se mueve en vivo durante la jornada.
  useEffect(() => {
    let cancelled = false
    const load = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      fetch(`/api/quiniela/leagues?id=${league.id}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (cancelled || !data) return
          if (data.members) setMembers(data.members)
          if (Array.isArray(data.matchKeys)) setMatchKeys(data.matchKeys)
          // AD — Settings de la liga (default true para rows pre-migración).
          if (typeof data.exactEnabled === 'boolean') setExactEnabled(data.exactEnabled)
          if (typeof data.ownerId === 'string') setOwnerId(data.ownerId)
        })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false) })
    }
    load()
    const t = setInterval(load, 60_000)
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', load)
    return () => {
      cancelled = true
      clearInterval(t)
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', load)
    }
  }, [league.id])

  // Fire-and-forget: persistir scores reales por miembro al abrir la liga.
  // El server rate-limita a 10s/liga, así que abrir varias veces es barato.
  // No bloquea UI: la clasificación visible se sigue calculando en vivo via
  // computeStandings sobre members+localResults. Esto solo alimenta la
  // tabla quiniela_league_member_scores para historiales / leaderboards
  // server-side futuros.
  useEffect(() => {
    fetch(`/api/quiniela/leagues/score?id=${league.id}`, { method: 'POST' })
      .catch(() => { /* silent — UI no depende de esto */ })
  }, [league.id])

  const alias = (league.nickname || getPlayerAlias()).trim()
  const standings = computeStandings(matchKeys, members, localResults)
  const ranked = standings.map(s => ({ name: s.nickname, pts: s.points, hits: s.hits, pleno: s.pleno }))

  const hasResults = localResults.length > 0

  async function handleToggleExact() {
    if (!isOwner || toggling) return
    setToggling(true)
    setToggleError(null)
    try {
      const next = !exactEnabled
      const res = await fetch(`/api/quiniela/leagues/${league.id}/settings`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ exactEnabled: next }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 409) {
          setToggleError('Hay miembros con picks sellados en la jornada activa. Esperá al cierre.')
        } else {
          setToggleError(String(json?.error ?? 'No se pudo cambiar el ajuste'))
        }
        return
      }
      setExactEnabled(next)
    } catch {
      setToggleError('Error de red. Inténtalo otra vez.')
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      {/* AD — Setting de marcador exacto. Badge informativo para todos
          + toggle accionable solo para el owner. */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span
          title={exactEnabled
            ? 'Esta liga cuenta los puntos del marcador exacto en su ranking'
            : 'Esta liga ignora los puntos del marcador exacto (solo tendencia)'}
          className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md"
          style={{
            background: exactEnabled ? 'rgba(167,139,250,0.10)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${exactEnabled ? 'rgba(167,139,250,0.32)' : 'rgba(255,255,255,0.1)'}`,
            color: exactEnabled ? '#C4B5FD' : 'rgba(255,255,255,0.5)',
            fontFamily: 'var(--font-sport)',
            letterSpacing: '0.04em',
          }}
        >
          🎯 {exactEnabled ? 'Con marcador exacto' : 'Sin marcador exacto'}
        </span>
        {isOwner && (
          <button
            type="button"
            onClick={handleToggleExact}
            disabled={toggling}
            className="text-[9px] font-bold px-2 py-0.5 rounded-md transition-opacity disabled:opacity-50"
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.6)',
              cursor: toggling ? 'wait' : 'pointer',
              fontFamily: 'var(--font-sport)',
              letterSpacing: '0.04em',
            }}
          >
            {toggling ? 'GUARDANDO…' : exactEnabled ? 'DESACTIVAR' : 'ACTIVAR'}
          </button>
        )}
        {toggleError && (
          <p className="text-[10px] w-full" style={{ color: '#fca5a5', fontFamily: 'var(--font-sport)' }}>
            {toggleError}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1.5 mb-2">
        <span className="w-1.5 h-1.5 rounded-full inline-block animate-pulse" style={{ background: '#4ade80', boxShadow: '0 0 6px rgba(74,222,128,0.7)' }} />
        <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#3A3A58', fontFamily: 'var(--font-sport)' }}>
          Clasificación en vivo
        </p>
      </div>

      {loading && (
        <div className="flex flex-col gap-1 mb-3">
          {[0,1,2].map(i => (
            <div key={i} className="h-8 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.03)' }} />
          ))}
        </div>
      )}

      {!loading && ranked.length === 0 && (
        <p className="text-[10px] mb-3" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>
          Nadie ha enviado picks todavía. Sé el primero.
        </p>
      )}

      {!loading && ranked.length > 0 && (
        <div className="flex flex-col gap-1 mb-3">
          {ranked.map((r, pos) => {
            const isMe = !!alias && r.name === alias
            const gold = pos === 0
            return (
              <div key={r.name} className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
                style={{
                  background: gold ? 'rgba(245,158,11,0.08)' : isMe ? 'rgba(124,58,237,0.07)' : 'rgba(255,255,255,0.025)',
                  border: gold ? '1px solid rgba(245,158,11,0.2)' : isMe ? '1px solid rgba(124,58,237,0.18)' : '1px solid transparent',
                }}
              >
                <span className="text-[10px] font-black tabular-nums w-4" style={{ color: gold ? '#fbbf24' : '#3A3A58', fontFamily: 'var(--font-sport)' }}>
                  {pos + 1}
                </span>
                <span className="flex-1 text-[11px] font-bold" style={{ color: gold || isMe ? '#F0F0F5' : '#8080A0', fontFamily: 'var(--font-display)' }}>
                  {r.name}
                  {r.pleno && <span style={{ marginLeft: 4, fontSize: 9 }}>🎯</span>}
                  {isMe && <span style={{ color: '#A78BFA', marginLeft: 4, fontSize: 8 }}>tú</span>}
                </span>
                {hasResults && (
                  <span className="text-[9px] tabular-nums" style={{ color: '#3A3A56', fontFamily: 'var(--font-sport)' }}>
                    {r.hits} ✓
                  </span>
                )}
                <span className="text-[11px] font-black tabular-nums" style={{ color: gold ? '#fbbf24' : isMe ? '#A78BFA' : '#5A5A7A', fontFamily: 'var(--font-display)' }}>
                  {hasResults ? `${r.pts % 1 ? r.pts.toFixed(1) : r.pts} pts` : '—'}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {!hasResults && (
        <p className="text-[9px] mb-2" style={{ color: '#2A2A40', fontFamily: 'var(--font-sport)' }}>
          Los puntos aparecerán cuando terminen los partidos.
        </p>
      )}

      <LeagueChat leagueId={league.id} nickname={alias} />
    </div>
  )
}
