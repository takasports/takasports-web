// Construye strings compartibles tipo Wordle por juego.
//
// Cada encoder recibe el `payload` que cada juego guarda en game_plays
// (forma libre, definida por el propio juego) y devuelve un string con
// emojis listo para copiar/compartir. Si el payload no encaja, cae a un
// formato genérico "X pts" — defensivo, nunca falla.

import type { GameId, GamePlay } from './games-store'

const SITE_URL = 'https://takasportsmedia.com'

export interface ShareResult {
  /** Texto multi-línea listo para clipboard / share. */
  text:  string
  /** Título corto para Web Share API. */
  title: string
  /** URL canónica del juego. */
  url:   string
}

// ── Helpers ──────────────────────────────────────────────────────

function gameUrl(gameId: GameId): string {
  // Slugs reales en el repo (ver src/app/<slug>/).
  const slug: Record<GameId, string> = {
    quiniela:    'quiniela',
    crackquiz:   'crackquiz',
    mionce:      'mionce',
    sopacracks:  'sopa-cracks',
    takagrid:    'takagrid',
    strikerrush: 'strikerrush',
  }
  return `${SITE_URL}/${slug[gameId]}`
}

function gameTitle(gameId: GameId): string {
  const t: Record<GameId, string> = {
    quiniela:    'Quiniela',
    crackquiz:   'CrackQuiz',
    mionce:      'Mi Once',
    sopacracks:  'Sopa de Cracks',
    takagrid:    'TakaGrid',
    strikerrush: 'Striker Rush',
  }
  return t[gameId]
}

function asArray<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : []
}
function asNumber(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

// ── Encoders por juego ──────────────────────────────────────────

// Quiniela: payload esperado { picks: ('1'|'X'|'2')[], results: ('1'|'X'|'2'|null)[] }
function encodeQuiniela(play: GamePlay, period: string): string {
  const picks   = asArray<string>((play.payload as Record<string, unknown>).picks)
  const results = asArray<string | null>((play.payload as Record<string, unknown>).results)
  const len = Math.max(picks.length, results.length)
  let hits = 0
  let emojis = ''
  for (let i = 0; i < len; i++) {
    const p = picks[i], r = results[i]
    if (!r) { emojis += '⚪'; continue }
    if (p === r) { emojis += '✅'; hits++ } else { emojis += '❌' }
  }
  return `Taka Quiniela ${period} — ${hits}/${len}\n${emojis}`
}

// CrackQuiz: payload { correct: number, total: number, streak?: number }
function encodeCrackquiz(play: GamePlay, period: string): string {
  const p = play.payload as Record<string, unknown>
  const correct = asNumber(p.correct)
  const total   = asNumber(p.total) || correct
  const streak  = asNumber(p.streak)
  const emojis  = '🟩'.repeat(correct) + '⬜'.repeat(Math.max(0, total - correct))
  const tail    = streak > 0 ? `\n🔥 racha ${streak}` : ''
  return `Taka CrackQuiz ${period} — ${correct}/${total}\n${emojis}${tail}`
}

// TakaGrid: payload { solved: bool[9] }  (3x3 row-major)
function encodeTakagrid(play: GamePlay, period: string): string {
  const solved = asArray<boolean>((play.payload as Record<string, unknown>).solved).slice(0, 9)
  const cells  = Array.from({ length: 9 }, (_, i) => solved[i] ? '✅' : '❌')
  const grid   = `${cells.slice(0,3).join('')}\n${cells.slice(3,6).join('')}\n${cells.slice(6,9).join('')}`
  const count  = cells.filter(c => c === '✅').length
  return `Taka Grid ${period} — ${count}/9\n${grid}`
}

// Sopa: payload { found: number, total: number, seconds: number }
function encodeSopacracks(play: GamePlay, period: string): string {
  const p = play.payload as Record<string, unknown>
  const found   = asNumber(p.found)
  const total   = asNumber(p.total) || found
  const seconds = asNumber(p.seconds)
  const m = Math.floor(seconds / 60), s = Math.floor(seconds % 60)
  const time = seconds > 0 ? `\n⏱️ ${m}m ${String(s).padStart(2,'0')}s` : ''
  return `Taka Sopa ${period} — ${found}/${total}${time}`
}

// Mi Once: payload { formation: string, filled: number, captain?: string }
function encodeMionce(play: GamePlay, period: string): string {
  const p = play.payload as Record<string, unknown>
  const formation = typeof p.formation === 'string' ? p.formation : ''
  const filled    = asNumber(p.filled)
  const captain   = typeof p.captain === 'string' ? p.captain : ''
  const lines = [`Taka Mi Once ${period}`]
  if (formation) lines.push(`📋 ${formation}`)
  lines.push(`⚽ ${filled}/11 alineados`)
  if (captain) lines.push(`© ${captain}`)
  return lines.join('\n')
}

// Striker Rush: payload { distance, ballsCollected? }
function encodeStrikerrush(play: GamePlay): string {
  return `Taka Striker Rush — ${play.score} pts`
}

const ENCODERS: Record<GameId, (play: GamePlay, period: string) => string> = {
  quiniela:    encodeQuiniela,
  crackquiz:   encodeCrackquiz,
  takagrid:    encodeTakagrid,
  sopacracks:  encodeSopacracks,
  mionce:      encodeMionce,
  strikerrush: encodeStrikerrush,
}

// ── API pública ──────────────────────────────────────────────────

export function buildShareResult(play: GamePlay): ShareResult {
  const encoder = ENCODERS[play.game_id] ?? ((p: GamePlay) => `${gameTitle(p.game_id)} — ${p.score} pts`)
  const body = encoder(play, play.period)
  const url  = gameUrl(play.game_id)
  return {
    title: `${gameTitle(play.game_id)} · ${play.period}`,
    text:  `${body}\n${url}`,
    url,
  }
}

/**
 * Comparte el resultado. Intenta Web Share API (mobile) y cae a
 * clipboard. Devuelve la acción que se ejecutó.
 */
export async function shareResult(play: GamePlay): Promise<'shared' | 'copied' | 'failed'> {
  const share = buildShareResult(play)
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      await navigator.share({ title: share.title, text: share.text, url: share.url })
      return 'shared'
    } catch (err) {
      // AbortError = usuario canceló. Sin caer a clipboard en ese caso.
      if ((err as { name?: string })?.name === 'AbortError') return 'failed'
    }
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(share.text)
      return 'copied'
    } catch { /* fall through */ }
  }
  return 'failed'
}
