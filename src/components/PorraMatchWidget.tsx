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

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { PorraStatus, PorraMatch } from './PorraCTA'
import { normalize as normalizeTeam, resolveAlias, TEAM_ALIASES } from '@/lib/quiniela'
import { usePorraStatus } from '@/lib/porra-status-client'
import {
  trackPorraCtaClick,
  trackPorraWidgetMatched,
  trackPorraWidgetPick,
  type PorraUserState,
} from '@/lib/analytics'


/** Normaliza el haystack del artículo igual que normalize() de lib/quiniela.
 * Usamos la misma función para garantizar que TEAM_ALIASES (cuyas claves
 * ya están en forma normalizada) matchean bit a bit. */
function normalizeHaystack(s: string): string {
  // normalize() de lib/quiniela hace lowercase + NFD + strip diacríticos
  // + strip no-alfanumérico, pero comprime espacios eliminándolos. Aquí
  // queremos preservar espacios para split por palabras, así que usamos
  // una variante local idéntica salvo en el manejo de espacios.
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Stopwords: palabras genéricas que no identifican unívocamente a un
 * equipo. Si aparecen solas (sin otra distintiva), no cuentan como hit. */
const STOPWORDS = new Set([
  'fc', 'cf', 'sc', 'ac', 'sd', 'cd', 'rcd', 'ud', 'rc', 'rb',
  'club', 'real', 'sporting', 'atletico', 'athletic', 'deportivo',
  'racing', 'united', 'city', 'town', 'bayern', 'inter', 'milan',
  'as', 'sl', 'ssc',
])

/** Devuelve TODOS los nombres por los que se conoce a un equipo:
 * canonical + claves de TEAM_ALIASES que apuntan a ese canonical.
 * Esto permite matchear "psg" en un artículo aunque el match traiga
 * "Paris Saint-Germain". */
function knownNamesFor(team: string): string[] {
  const canonical = resolveAlias(team) // ya normalizado
  const names = new Set<string>([canonical])
  // Reverse lookup en TEAM_ALIASES.
  for (const [alias, target] of Object.entries(TEAM_ALIASES)) {
    if (target === canonical) names.add(alias)
  }
  // También el nombre original tal cual viene de ESPN, por si tiene
  // matices únicos (ej. "Brighton & Hove Albion" → palabras únicas).
  names.add(normalizeTeam(team))
  return [...names]
}

/** Palabras distintivas: ≥4 chars y no en STOPWORDS. */
function distinctiveWords(name: string): string[] {
  return name.split(' ').filter((w) => w.length >= 4 && !STOPWORDS.has(w))
}

/** ¿Aparece el equipo en el haystack normalizado?
 * Estrategia:
 *  1. Para CADA nombre conocido del equipo, intenta substring match completo.
 *     Ej.: si conocemos "psg" y haystack contiene " psg ", hit directo.
 *  2. Si ningún nombre completo matchea, busca palabras distintivas (≥4 chars,
 *     no-stopword) de cualquier nombre conocido.
 */
function teamInHaystack(team: string, haystack: string): { hit: boolean; score: number } {
  const names = knownNamesFor(team)
  // Padding para evitar matches parciales: " barca " no debe matchear "barcas".
  const padded = ` ${haystack} `

  let score = 0
  for (const name of names) {
    if (name.length >= 4 && padded.includes(` ${name} `)) {
      score += name.length // matches completos pesan más
    }
  }
  if (score > 0) return { hit: true, score }

  // Fallback: palabras distintivas.
  const distinctive = new Set<string>()
  for (const name of names) {
    for (const w of distinctiveWords(name)) distinctive.add(w)
  }
  for (const w of distinctive) {
    if (padded.includes(` ${w} `)) score += 1
  }
  return { hit: score > 0, score }
}

function findMatch(matches: PorraMatch[], title: string, extra?: string[]): PorraMatch | null {
  const haystack = normalizeHaystack([title, ...(extra ?? [])].join(' '))
  let best: { match: PorraMatch; score: number } | null = null
  for (const m of matches) {
    const h = teamInHaystack(m.home, haystack)
    const a = teamInHaystack(m.away, haystack)
    if (!h.hit || !a.hit) continue
    // Score combinado: ambos equipos deben confirmarse; usamos el mínimo
    // para evitar que un equipo muy citado y otro apenas mencionado pase.
    const combined = Math.min(h.score, a.score) * 2 + h.score + a.score
    if (!best || combined > best.score) best = { match: m, score: combined }
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
  const status = usePorraStatus()
  const [pick, setPick] = useState<Pick | null>(null)

  const match = useMemo(() => {
    if (!status?.matches?.length) return null
    return findMatch(status.matches, title, tags)
  }, [status, title, tags])

  // Trackea que el widget se materializó para este artículo (una vez por mount).
  const trackedMatchRef = useRef<string | null>(null)
  useEffect(() => {
    if (!match) return
    const key = `${match.home}|${match.away}|${status?.jornada ?? ''}`
    if (trackedMatchRef.current === key) return
    trackedMatchRef.current = key
    trackPorraWidgetMatched({
      home: match.home,
      away: match.away,
      comp: match.comp,
      jornada: status?.jornada ?? null,
    })
  }, [match, status?.jornada])

  if (!status || !match) return null

  // No mostrar si el partido ya empezó.
  const kickoffMs = new Date(match.kickoff).getTime()
  if (!Number.isFinite(kickoffMs) || kickoffMs <= Date.now()) return null

  const odds = match.odds
  const href = '/predicciones'

  const userState: PorraUserState = status.isAuthed
    ? (status.hasPicked ? 'authed_picked' : 'authed_no_picks')
    : 'guest'

  function handlePickClick(opt: Pick) {
    setPick(opt)
    if (!match) return
    trackPorraWidgetPick({ home: match.home, away: match.away, pick: opt })
  }

  // Antes de navegar, deja la preselección en sessionStorage. PicksForm la
  // consume al montar (clave: 'porra:pendingPick'). Más resiliente que
  // query params porque no acopla a la ruta y se auto-limpia al consumirse.
  function handleCtaClick() {
    if (!pick) return
    trackPorraCtaClick({
      surface: 'article_widget',
      state: userState,
      jornada: status?.jornada ?? null,
      pick,
    })
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
      aria-label="Predicciones — apuesta este partido"
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
            PREDICCIONES
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
              onClick={() => handlePickClick(opt.key)}
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

      {/* Bonus goleador — solo si el partido es el destacado de la jornada.
          No es selección inline (el roster vive en /predicciones); aquí es
          un teaser para subir intención. */}
      {match.featured && (
        <div
          className="flex items-center gap-2 px-3 py-2 mb-3 rounded-lg"
          style={{
            background: 'linear-gradient(90deg, rgba(251,191,36,0.18) 0%, rgba(251,191,36,0.04) 100%)',
            border: '1px solid rgba(251,191,36,0.32)',
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }} aria-hidden>⚽</span>
          <div className="flex-1 min-w-0">
            <p style={{
              fontFamily: 'var(--font-sport)', fontWeight: 900, fontSize: 11,
              color: '#FDE68A', letterSpacing: '0.06em', margin: 0,
            }}>
              PARTIDO DESTACADO · x2 SI ACIERTAS
            </p>
            <p style={{
              fontSize: 11, color: 'rgba(255,255,255,0.65)',
              margin: '2px 0 0', lineHeight: 1.3,
            }}>
              Si clavas el 1/X/2 de este partido, tus puntos por este pick se duplican.
            </p>
          </div>
        </div>
      )}

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
        {pick ? 'CONFIRMAR EN PREDICCIONES →' : 'ELIGE TU PRONÓSTICO'}
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
