'use client'

// Widget inline de "La Porra" para artículos de previa de partido.
//
// Estrategia:
//  · Recibe el título (y opcionalmente tags) del artículo.
//  · Carga /api/quiniela/status (cache compartido con CTA / hero).
//  · Busca un partido cuyo home AND away aparezcan en el título.
//  · Si encuentra → renderiza picker 1/X/2 + cuotas + CTA a /predicciones.
//  · Si no encuentra → no renderiza nada (degradación silenciosa).
//
// El click no envía la apuesta — solo deep-linka a /predicciones?match=...
// para capturar la intención en el momento de máxima atención. El sellado
// real ocurre en la página de quiniela (que ya valida stakes/cuotas).

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { PorraStatus, PorraMatch } from './PorraCTA'

const STORAGE_KEY = 'porra:status:v1'
const TTL_MS = 60_000

interface CachedStatus { data: PorraStatus; ts: number }

function readCache(): PorraStatus | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedStatus
    if (Date.now() - parsed.ts > TTL_MS) return null
    return parsed.data
  } catch { return null }
}

function writeCache(data: PorraStatus) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ data, ts: Date.now() })) }
  catch { /* quota / SSR */ }
}

/** Normaliza para matching: minúsculas, sin diacríticos, sin no-alfanumérico. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Palabras genéricas a ignorar: muy comunes y por sí solas crean falsos
 * positivos (ej. "Real" en cualquier artículo sobre fútbol español). */
const STOPWORDS = new Set([
  'fc', 'cf', 'sc', 'ac', 'sd', 'cd', 'rcd', 'ud', 'club', 'real', 'sporting',
  'atletico', 'athletic', 'deportivo', 'racing', 'united', 'city',
])

/** Extrae las palabras distintivas (≥4 chars, no-stopword) de un nombre. */
function distinctiveWords(team: string): string[] {
  return norm(team)
    .split(' ')
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
}

/** Devuelve true si al menos una palabra distintiva del equipo aparece
 * en el haystack. Si el equipo no tiene palabras distintivas (caso raro
 * tipo "Cádiz CF" → solo "cadiz" sirve, ≥4 → ok), cae a la palabra más
 * larga aunque sea stopword. */
function teamInHaystack(team: string, haystack: string): boolean {
  const distinctive = distinctiveWords(team)
  if (distinctive.length > 0) {
    return distinctive.some((w) => haystack.includes(w))
  }
  // Fallback: palabra más larga ignorando stopwords cortos (≤2 chars).
  const words = norm(team).split(' ').filter((w) => w.length >= 3)
  const longest = words.sort((a, b) => b.length - a.length)[0]
  return !!longest && haystack.includes(longest)
}

function findMatch(matches: PorraMatch[], title: string, extra?: string[]): PorraMatch | null {
  const haystack = norm([title, ...(extra ?? [])].join(' '))
  // Si varios partidos matchean (ej. dos partidos del mismo equipo), nos
  // quedamos con el que más palabras distintivas aporte — más fiable.
  let best: { match: PorraMatch; score: number } | null = null
  for (const m of matches) {
    if (!teamInHaystack(m.home, haystack) || !teamInHaystack(m.away, haystack)) continue
    const score =
      distinctiveWords(m.home).filter((w) => haystack.includes(w)).length +
      distinctiveWords(m.away).filter((w) => haystack.includes(w)).length
    if (!best || score > best.score) best = { match: m, score }
  }
  return best?.match ?? null
}

function formatKickoff(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-ES', {
      weekday: 'short', day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'Europe/Madrid',
    }).format(new Date(iso)).replace('.', '')
  } catch { return '' }
}

interface Props {
  /** Título del artículo (se usa para matching contra los partidos). */
  title: string
  /** Tags/keywords opcionales para reforzar el matching. */
  tags?: string[]
}

type Pick = '1' | 'X' | '2'

export default function PorraMatchWidget({ title, tags }: Props) {
  const [status, setStatus] = useState<PorraStatus | null>(null)
  const [pick, setPick] = useState<Pick | null>(null)

  useEffect(() => {
    let cancelled = false
    const cached = readCache()
    if (cached) { setStatus(cached); return }
    fetch('/api/quiniela/status', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: PorraStatus | null) => {
        if (cancelled || !data) return
        setStatus(data)
        writeCache(data)
      })
      .catch(() => { /* silencioso */ })
    return () => { cancelled = true }
  }, [])

  const match = useMemo(() => {
    if (!status?.matches?.length) return null
    return findMatch(status.matches, title, tags)
  }, [status, title, tags])

  if (!status || !match) return null

  // No mostrar si el partido ya empezó.
  const kickoffMs = new Date(match.kickoff).getTime()
  if (!Number.isFinite(kickoffMs) || kickoffMs <= Date.now()) return null

  const odds = match.odds
  const href = '/predicciones'

  // Antes de navegar, deja la preselección en sessionStorage. PicksForm la
  // consume al montar (clave: 'porra:pendingPick'). Más resiliente que
  // query params porque no acopla a la ruta y se auto-limpia al consumirse.
  function handleCtaClick() {
    if (!pick) return
    try {
      sessionStorage.setItem(
        'porra:pendingPick',
        JSON.stringify({ home: match!.home, away: match!.away, pick, ts: Date.now() }),
      )
    } catch { /* quota */ }
  }

  const options: Array<{ key: Pick; label: string; odd?: number; sub: string }> = [
    { key: '1', label: '1', odd: odds?.home, sub: match.home },
    { key: 'X', label: 'X', odd: odds?.draw, sub: 'Empate' },
    { key: '2', label: '2', odd: odds?.away, sub: match.away },
  ]

  return (
    <aside
      aria-label="La Porra — apuesta este partido"
      className="my-6 rounded-2xl p-4 sm:p-5 not-prose"
      style={{
        background:
          'linear-gradient(135deg, rgba(124,58,237,0.14) 0%, rgba(124,58,237,0.05) 50%, rgba(249,115,22,0.12) 100%)',
        border: '1px solid rgba(124,58,237,0.32)',
        boxShadow: '0 0 24px rgba(124,58,237,0.10)',
      }}
    >
      {/* Header del widget */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span aria-hidden style={{
            display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
            background: '#F97316', boxShadow: '0 0 8px #F97316',
            animation: 'porraWidgetPulse 1.6s ease-in-out infinite',
          }} />
          <span style={{
            fontFamily: 'var(--font-sport)', fontWeight: 900, fontSize: 13,
            color: '#fff', letterSpacing: '0.04em',
          }}>
            LA PORRA
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
            color: 'rgba(255,255,255,0.55)', fontFamily: 'var(--font-sport)',
          }}>
            · {match.comp} · {formatKickoff(match.kickoff)}
          </span>
        </div>
      </div>

      {/* Partido — logos y nombres */}
      <div className="flex items-center justify-center gap-3 mb-4">
        {match.homeLogo
          ? <Image src={match.homeLogo} alt="" width={26} height={26} className="object-contain" unoptimized />
          : <span className="w-[26px] h-[26px] rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />}
        <span style={{
          fontFamily: 'var(--font-sport)', fontWeight: 800, fontSize: 14,
          color: '#fff', letterSpacing: '0.02em',
        }}>
          {match.home}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, padding: '0 4px' }}>vs</span>
        <span style={{
          fontFamily: 'var(--font-sport)', fontWeight: 800, fontSize: 14,
          color: '#fff', letterSpacing: '0.02em',
        }}>
          {match.away}
        </span>
        {match.awayLogo
          ? <Image src={match.awayLogo} alt="" width={26} height={26} className="object-contain" unoptimized />
          : <span className="w-[26px] h-[26px] rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />}
      </div>

      {/* Picker 1 / X / 2 */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {options.map((opt) => {
          const selected = pick === opt.key
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => setPick(opt.key)}
              aria-pressed={selected}
              className="flex flex-col items-center justify-center py-2.5 rounded-xl transition-all"
              style={{
                background: selected
                  ? 'linear-gradient(135deg, rgba(124,58,237,0.45) 0%, rgba(249,115,22,0.35) 100%)'
                  : 'rgba(255,255,255,0.04)',
                border: selected
                  ? '1px solid rgba(255,255,255,0.28)'
                  : '1px solid rgba(255,255,255,0.08)',
                boxShadow: selected ? '0 4px 14px rgba(124,58,237,0.25)' : 'none',
                cursor: 'pointer',
              }}
            >
              <span style={{
                fontFamily: 'var(--font-sport)', fontWeight: 900, fontSize: 18,
                color: selected ? '#fff' : 'rgba(255,255,255,0.85)',
                letterSpacing: '0.04em', lineHeight: 1,
              }}>
                {opt.label}
              </span>
              {typeof opt.odd === 'number' && (
                <span style={{
                  fontSize: 10, marginTop: 4, fontWeight: 700,
                  color: selected ? '#FED7AA' : 'rgba(255,255,255,0.5)',
                  fontFamily: 'var(--font-sport)',
                }}>
                  ×{opt.odd.toFixed(2)}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* CTA */}
      <Link
        href={href}
        onClick={handleCtaClick}
        className="block w-full text-center py-2.5 rounded-xl"
        style={{
          background: pick
            ? 'linear-gradient(135deg, #7C3AED 0%, #F97316 100%)'
            : 'rgba(255,255,255,0.06)',
          border: pick
            ? '1px solid rgba(255,255,255,0.2)'
            : '1px solid rgba(255,255,255,0.1)',
          color: pick ? '#fff' : 'rgba(255,255,255,0.6)',
          fontFamily: 'var(--font-sport)',
          fontWeight: 900,
          fontSize: 13,
          letterSpacing: '0.06em',
          textDecoration: 'none',
          boxShadow: pick ? '0 6px 16px rgba(124,58,237,0.3)' : 'none',
          transition: 'background 200ms, box-shadow 200ms',
        }}
      >
        {pick ? 'CONFIRMAR EN LA PORRA →' : 'ELIGE TU PRONÓSTICO'}
      </Link>

      <p className="text-center mt-2" style={{
        fontSize: 10, color: 'rgba(255,255,255,0.4)',
        fontFamily: 'var(--font-sport)', letterSpacing: '0.04em',
      }}>
        Juega gratis · {status.jornada}
      </p>

      <style>{`
        @keyframes porraWidgetPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.55; transform: scale(0.85); }
        }
      `}</style>
    </aside>
  )
}
