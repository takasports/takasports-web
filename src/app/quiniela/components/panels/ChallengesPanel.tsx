'use client'

import { useEffect, useState, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { ClaimPopup } from '../ClaimPopup'

// ─────────────────────────────────────────────────────────────────
// ChallengesPanel — sidebar card de retos semanales.
//
// Visible para TODOS los usuarios (incluyendo no-autenticados).
// Para no-auth: muestra los retos con CTA de login.
// Para auth: muestra estado (pending/completed/claimed) + botón "Reclamar".
//
// Flujo de claim:
//   1. User hace click en "Reclamar"
//   2. POST /api/quiniela/challenges/claim
//   3. Si ok: muestra ClaimPopup con monedas + badge
//   4. Refetch automático del estado para actualizar la UI
// ─────────────────────────────────────────────────────────────────

interface Challenge {
  badge_id: string
  name: string
  emoji: string
  color: string
  bg: string
  challenge_title: string
  challenge_description: string
  coin_bonus: number
  criteria_type: string
  criteria_value: number
  capped: boolean
  status: 'pending' | 'completed' | 'claimed' | null
  coins_awarded: number
}

interface ClaimResult {
  badgeEmoji: string
  badgeName: string
  coinsAwarded: number
}

export function ChallengesPanel({
  jornada,
  user,
}: {
  jornada: string
  user: User | null
}) {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [loaded, setLoaded] = useState(false)
  const [claiming, setClaiming] = useState<string | null>(null)  // badge_id in progress
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null)

  const load = useCallback(() => {
    if (!jornada || jornada === 'Cargando…' || jornada === 'Sin jornada activa') return
    setLoaded(false)
    fetch(`/api/quiniela/challenges?jornada=${encodeURIComponent(jornada)}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.challenges) setChallenges(data.challenges)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [jornada])

  useEffect(() => { load() }, [load])

  // Ocultar si no hay retos activos en esta jornada
  if (loaded && challenges.length === 0) return null
  if (!loaded && (!jornada || jornada === 'Cargando…')) return null

  async function handleClaim(ch: Challenge) {
    if (claiming || ch.status !== 'completed') return
    setClaiming(ch.badge_id)
    try {
      const res = await fetch('/api/quiniela/challenges/claim', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ badgeId: ch.badge_id, jornada }),
      })
      const data = await res.json() as {
        ok?: boolean
        coinsAwarded?: number
        badgeName?: string
        badgeEmoji?: string
        alreadyClaimed?: boolean
        error?: string
      }
      if (data.ok) {
        setClaimResult({
          badgeEmoji: data.badgeEmoji ?? ch.emoji,
          badgeName: data.badgeName ?? ch.name,
          coinsAwarded: data.coinsAwarded ?? 0,
        })
        // Refrescar estado de challenges
        load()
      }
    } catch { /* silent */ } finally {
      setClaiming(null)
    }
  }

  function criteriaLabel(ch: Challenge): string {
    switch (ch.criteria_type) {
      case 'pleno':          return 'Acertá todos los partidos de la jornada'
      case 'min_hits':       return `Acertá al menos ${ch.criteria_value} partidos`
      case 'all_participants': return 'Sellá tu quiniela en esta jornada'
      case 'top_n':          return `Terminá TOP ${ch.criteria_value} del ranking semanal`
      case 'manual':         return 'Reto especial — verificación manual'
      default:               return ch.challenge_description
    }
  }

  return (
    <>
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div
          className="px-5 py-3 flex items-center gap-2"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <span className="section-accent" />
          <h2 className="section-label">Retos</h2>
          <span
            className="ml-auto text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
            style={{
              background: 'rgba(251,191,36,0.1)',
              color: '#fbbf24',
              border: '1px solid rgba(251,191,36,0.25)',
              fontFamily: 'var(--font-sport)',
            }}
          >
            {jornada.length > 20 ? jornada.slice(0, 20) + '…' : jornada}
          </span>
        </div>

        {/* Lista de retos */}
        <div className="px-4 py-3 flex flex-col gap-2">
          {!loaded ? (
            [1, 2].map(i => (
              <div
                key={i}
                className="h-16 rounded-xl animate-pulse"
                style={{ background: 'rgba(255,255,255,0.03)' }}
              />
            ))
          ) : (
            challenges.map(ch => {
              const isClaimed   = ch.status === 'claimed'
              const isCompleted = ch.status === 'completed'
              const isPending   = ch.status === 'pending' || ch.status === null
              const isClaiming  = claiming === ch.badge_id

              return (
                <div
                  key={ch.badge_id}
                  className="rounded-xl px-3 py-2.5"
                  style={{
                    background: isCompleted
                      ? 'rgba(251,191,36,0.06)'
                      : isClaimed
                      ? 'rgba(34,197,94,0.04)'
                      : 'rgba(255,255,255,0.02)',
                    border: isCompleted
                      ? '1px solid rgba(251,191,36,0.3)'
                      : isClaimed
                      ? '1px solid rgba(34,197,94,0.2)'
                      : '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Badge icon */}
                    <div
                      className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
                      style={{
                        background: ch.bg,
                        border: `1px solid ${ch.color}55`,
                        fontSize: 18,
                        opacity: isClaimed ? 0.7 : 1,
                      }}
                    >
                      {ch.emoji}
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[11px] font-black leading-tight"
                        style={{
                          color: isCompleted ? '#fbbf24' : isClaimed ? '#22c55e' : '#A0A0C0',
                          fontFamily: 'var(--font-display)',
                        }}
                      >
                        {ch.challenge_title}
                      </p>
                      <p
                        className="text-[9px] leading-snug mt-0.5"
                        style={{ color: '#4A4A6A', fontFamily: 'var(--font-sport)' }}
                      >
                        {criteriaLabel(ch)}
                      </p>

                      {/* Reward line */}
                      <div className="flex items-center gap-2 mt-1.5">
                        {ch.coin_bonus > 0 && (
                          <span
                            className="text-[9px] font-black tabular-nums"
                            style={{
                              color: isClaimed ? '#22c55e' : '#fbbf24',
                              fontFamily: 'var(--font-display)',
                            }}
                          >
                            {isClaimed ? `+${ch.coins_awarded} pts` : `+${ch.coin_bonus} pts`}
                          </span>
                        )}
                        <span
                          className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                          style={{
                            background: 'rgba(255,255,255,0.04)',
                            color: ch.color,
                            fontFamily: 'var(--font-sport)',
                          }}
                        >
                          {ch.name}
                        </span>

                        {/* Status / CTA */}
                        <div className="ml-auto flex-shrink-0">
                          {isClaimed && (
                            <span
                              className="text-[9px] font-black"
                              style={{ color: '#22c55e', fontFamily: 'var(--font-sport)' }}
                            >
                              ✓ Reclamado
                            </span>
                          )}
                          {isCompleted && !user && (
                            <span
                              className="text-[9px] font-black"
                              style={{ color: '#fbbf24', fontFamily: 'var(--font-sport)' }}
                            >
                              ¡Completado!
                            </span>
                          )}
                          {isCompleted && user && (
                            <button
                              type="button"
                              disabled={isClaiming || ch.capped}
                              onClick={() => void handleClaim(ch)}
                              className="text-[9px] font-black px-2.5 py-1 rounded-lg transition-opacity hover:opacity-85"
                              style={{
                                background: ch.capped
                                  ? 'rgba(255,255,255,0.04)'
                                  : 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                                color: ch.capped ? '#5A5A78' : '#0A0118',
                                fontFamily: 'var(--font-sport)',
                                cursor: ch.capped || isClaiming ? 'not-allowed' : 'pointer',
                                opacity: isClaiming ? 0.6 : 1,
                              }}
                            >
                              {isClaiming ? '…' : ch.capped ? 'Agotado' : 'Reclamar'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Login CTA para non-auth en pending */}
                  {isPending && !user && (
                    <p
                      className="text-[8px] mt-2 text-center"
                      style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}
                    >
                      Iniciá sesión para participar y reclamar
                    </p>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Popup de reward */}
      {claimResult && (
        <ClaimPopup
          badgeEmoji={claimResult.badgeEmoji}
          badgeName={claimResult.badgeName}
          coinsAwarded={claimResult.coinsAwarded}
          onClose={() => setClaimResult(null)}
        />
      )}
    </>
  )
}
