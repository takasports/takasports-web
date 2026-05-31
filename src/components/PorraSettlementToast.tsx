'use client'

// Toast post-jornada: notifica al user que su porra anterior se ha liquidado.
//
// Comportamiento:
//  · Lee /api/quiniela/status (cache compartido).
//  · Si hay lastSettled Y no está en localStorage como "acked" → muestra toast.
//  · Auto-dismiss tras 12s o por click en cerrar.
//  · Click en CTA → /predicciones (a ver detalle/ranking).
//  · "Acked" persiste por jornada — la liquidación de cada jornada se nota una vez.

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { PorraStatus, PorraSettlement } from './PorraCTA'
import { trackPorraCtaClick, trackPorraSettlementShown } from '@/lib/analytics'
import { buildResultSlug } from '@/lib/porra-result-slug'

const STORAGE_KEY = 'porra:status:v1'
const TTL_MS = 60_000
const ACK_KEY = 'porra:settledAck:v1'
const AUTO_DISMISS_MS = 12_000

interface CachedStatus { data: PorraStatus; ts: number }

function readStatus(): PorraStatus | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedStatus
    if (Date.now() - parsed.ts > TTL_MS) return null
    return parsed.data
  } catch { return null }
}

function readAcked(): string | null {
  if (typeof window === 'undefined') return null
  try { return localStorage.getItem(ACK_KEY) } catch { return null }
}

function writeAcked(jornada: string) {
  try { localStorage.setItem(ACK_KEY, jornada) } catch { /* quota */ }
}

function tone(settled: PorraSettlement): {
  emoji: string
  headline: string
  accent: string
  bgGradient: string
} {
  const ratio = settled.totalPicks > 0 ? settled.correctCount / settled.totalPicks : 0
  if (settled.totalWon >= 100 || ratio >= 0.75) {
    return {
      emoji: '🔥',
      headline: '¡Tremendo!',
      accent: '#22C55E',
      bgGradient:
        'linear-gradient(135deg, rgba(34,197,94,0.32) 0%, rgba(34,197,94,0.08) 100%)',
    }
  }
  if (settled.totalWon > 0 || ratio >= 0.4) {
    return {
      emoji: '✅',
      headline: 'Buena porra',
      accent: '#F97316',
      bgGradient:
        'linear-gradient(135deg, rgba(124,58,237,0.28) 0%, rgba(249,115,22,0.18) 100%)',
    }
  }
  return {
    emoji: '🎯',
    headline: 'Jornada cerrada',
    accent: '#7C3AED',
    bgGradient:
      'linear-gradient(135deg, rgba(124,58,237,0.22) 0%, rgba(124,58,237,0.06) 100%)',
  }
}

interface FriendsData { avgHits: number; count: number }
interface LeagueRankData { name: string; rank: number; total: number }

export default function PorraSettlementToast() {
  const [settled, setSettled] = useState<PorraSettlement | null>(null)
  const [friends, setFriends] = useState<FriendsData | null>(null)
  const [leagueRank, setLeagueRank] = useState<LeagueRankData | null>(null)
  const [closing, setClosing] = useState(false)
  const [shareDone, setShareDone] = useState(false)
  // Evita doble-track en StrictMode / re-renders.
  const trackedShownRef = useRef<string | null>(null)

  async function handleShareResult() {
    if (!settled) return
    const slug = buildResultSlug(
      settled.jornada,
      settled.correctCount,
      settled.totalPicks,
      settled.totalWon,
    )
    const url = typeof window !== 'undefined'
      ? `${window.location.origin}/predicciones/resultado/${slug}`
      : `https://takasportsmedia.com/predicciones/resultado/${slug}`
    const text = `Mi porra de la ${settled.jornada}: ${settled.correctCount}/${settled.totalPicks} aciertos${settled.totalWon ? ` · +${settled.totalWon} pts` : ''}. ¿Le ganas?`
    try {
      const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> }
      if (nav.share) {
        await nav.share({ title: 'Mi porra · TakaSports', text, url })
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`)
        setShareDone(true)
        setTimeout(() => setShareDone(false), 2000)
      }
      trackPorraCtaClick({
        surface: 'settlement_toast',
        state: 'authed_settled',
        jornada: settled.jornada,
      })
    } catch { /* user canceled */ }
  }

  // Carga inicial (post-hidratación) — usa cache compartido + fetch fallback.
  useEffect(() => {
    let cancelled = false

    function evaluate(data: PorraStatus | null) {
      const s = data?.lastSettled
      // Guards: necesitamos jornada válida y al menos un pick para que
      // el copy del toast tenga sentido ("X/Y aciertos" con Y=0 es feo).
      if (!s) return
      if (typeof s.jornada !== 'string' || s.jornada.length === 0) return
      if (typeof s.totalPicks !== 'number' || s.totalPicks <= 0) return
      if (typeof s.correctCount !== 'number' || s.correctCount < 0) return
      const acked = readAcked()
      if (acked === s.jornada) return
      setSettled(s)
      // Comparativa con amigos (P): requiere al menos 2 peers para mostrar
      // (muestra demasiado pequeña con 1 es ruidosa).
      if (
        typeof data?.friendsAvgHits === 'number' &&
        Number.isFinite(data.friendsAvgHits) &&
        (data?.friendsCount ?? 0) >= 2
      ) {
        setFriends({ avgHits: data.friendsAvgHits, count: data.friendsCount ?? 0 })
      }
      // R — Ranking en mejor liga privada. Solo si total ≥ 2.
      const br = data?.bestLeagueRank
      if (br && typeof br.rank === 'number' && typeof br.total === 'number' && br.total >= 2) {
        setLeagueRank({ name: br.leagueName, rank: br.rank, total: br.total })
      }
    }

    const cached = readStatus()
    if (cached) { evaluate(cached); return }

    fetch('/api/quiniela/status', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: PorraStatus | null) => {
        if (cancelled) return
        evaluate(data)
      })
      .catch(() => { /* silencioso */ })
    return () => { cancelled = true }
  }, [])

  // Auto-dismiss + track de impresión (una vez por jornada en este mount).
  useEffect(() => {
    if (!settled) return
    if (trackedShownRef.current !== settled.jornada) {
      trackedShownRef.current = settled.jornada
      trackPorraSettlementShown({
        jornada: settled.jornada,
        correct: settled.correctCount,
        total: settled.totalPicks,
        totalWon: settled.totalWon,
      })
    }
    const id = setTimeout(() => handleClose(), AUTO_DISMISS_MS)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled])

  function handleClose() {
    if (!settled) return
    setClosing(true)
    writeAcked(settled.jornada)
    setTimeout(() => setSettled(null), 240)
  }

  if (!settled) return null

  const t = tone(settled)

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        left: 20,
        maxWidth: 380,
        marginLeft: 'auto',
        zIndex: 60,
        animation: closing
          ? 'porraToastOut 220ms ease-in forwards'
          : 'porraToastIn 320ms cubic-bezier(0.34,1.4,0.64,1) both',
      }}
    >
      <div
        className="rounded-2xl p-4"
        style={{
          background: '#0F0F18',
          backgroundImage: t.bgGradient,
          border: `1px solid ${t.accent}55`,
          boxShadow: `0 12px 36px rgba(0,0,0,0.5), 0 0 24px ${t.accent}22`,
        }}
      >
        <div className="flex items-start gap-3">
          <span style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }} aria-hidden>
            {t.emoji}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span style={{
                fontFamily: 'var(--font-sport)', fontWeight: 900, fontSize: 14,
                color: '#fff', letterSpacing: '0.02em',
              }}>
                {t.headline}
              </span>
              <span style={{
                fontSize: 9, fontWeight: 800, letterSpacing: '0.08em',
                padding: '2px 6px', borderRadius: 4,
                background: `${t.accent}33`, color: t.accent === '#22C55E' ? '#BBF7D0' : '#FED7AA',
                fontFamily: 'var(--font-sport)',
              }}>
                {settled.jornada.toUpperCase()}
              </span>
            </div>
            <p style={{
              fontSize: 12, color: 'rgba(255,255,255,0.75)',
              margin: 0, lineHeight: 1.4,
            }}>
              <strong style={{ color: '#fff' }}>
                {settled.correctCount}/{settled.totalPicks} aciertos
              </strong>
              {settled.totalWon > 0 && (
                <>
                  {' · '}
                  <strong style={{ color: t.accent }}>+{settled.totalWon} pts</strong>
                </>
              )}
            </p>
            {/* R — Ranking en mejor liga (prioridad sobre P si está top-3). */}
            {leagueRank && (
              <p style={{
                fontSize: 11, color: 'rgba(255,255,255,0.65)',
                margin: '4px 0 0', lineHeight: 1.3,
              }}>
                {leagueRank.rank === 1
                  ? <>👑 <strong style={{ color: '#FDE68A' }}>1º</strong> en {leagueRank.name}</>
                  : leagueRank.rank <= 3
                    ? <>🏅 <strong style={{ color: '#FDE68A' }}>{leagueRank.rank}º</strong> de {leagueRank.total} en {leagueRank.name}</>
                    : <><strong style={{ color: '#fff' }}>{leagueRank.rank}º</strong> de {leagueRank.total} en {leagueRank.name}</>}
              </p>
            )}
            {/* P — comparativa con amigos. Solo si tenemos peers fiables. */}
            {friends && (
              <p style={{
                fontSize: 11, color: 'rgba(255,255,255,0.55)',
                margin: '4px 0 0', lineHeight: 1.3,
              }}>
                {settled.correctCount > friends.avgHits
                  ? <>👑 Por encima de tu liga ({friends.avgHits.toFixed(1)} prom · {friends.count})</>
                  : settled.correctCount < friends.avgHits
                    ? <>Tu liga promedió {friends.avgHits.toFixed(1)} ({friends.count} amigos)</>
                    : <>Empatas con tu liga ({friends.avgHits.toFixed(1)} prom)</>}
              </p>
            )}
            <div className="flex items-center gap-3 mt-2">
              <Link
                href="/predicciones"
                onClick={() => {
                  trackPorraCtaClick({
                    surface: 'settlement_toast',
                    state: 'authed_settled',
                    jornada: settled.jornada,
                  })
                  handleClose()
                }}
                className="inline-flex items-center gap-1"
                style={{
                  fontFamily: 'var(--font-sport)', fontWeight: 800, fontSize: 11,
                  color: t.accent, letterSpacing: '0.06em',
                  textDecoration: 'none',
                }}
              >
                VER DETALLE →
              </Link>
              <button
                type="button"
                onClick={handleShareResult}
                aria-label="Compartir resultado"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  padding: 0,
                  fontFamily: 'var(--font-sport)', fontWeight: 800, fontSize: 11,
                  color: 'rgba(255,255,255,0.5)', letterSpacing: '0.06em',
                }}
              >
                {shareDone ? '✓ COPIADO' : 'COMPARTIR'}
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Cerrar"
            style={{
              flexShrink: 0, width: 24, height: 24, borderRadius: 6,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.6)',
              cursor: 'pointer', fontSize: 12, lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
      </div>
      <style>{`
        @keyframes porraToastIn {
          from { opacity: 0; transform: translateY(20px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes porraToastOut {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(20px) scale(0.96); }
        }
      `}</style>
    </div>
  )
}
