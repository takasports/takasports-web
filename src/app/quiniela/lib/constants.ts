import type { Pick } from '@/components/QuinielaModule'

// ─────────────────────────────────────────────────────────────────
// Constantes de picks
// ─────────────────────────────────────────────────────────────────
export const PICK_COLOR: Record<Pick, string>  = { '1': '#22c55e', '1X': '#6ee7b7', X: '#f59e0b', 'X2': '#fb923c', '2': '#ef4444' }
export const PICK_BG: Record<Pick, string>     = { '1': 'rgba(34,197,94,0.12)',  '1X': 'rgba(110,231,183,0.1)',  X: 'rgba(245,158,11,0.12)',  'X2': 'rgba(251,146,60,0.1)',  '2': 'rgba(239,68,68,0.12)' }
export const PICK_BORDER: Record<Pick, string> = { '1': 'rgba(34,197,94,0.38)',  '1X': 'rgba(110,231,183,0.3)',  X: 'rgba(245,158,11,0.38)',  'X2': 'rgba(251,146,60,0.3)',  '2': 'rgba(239,68,68,0.38)' }
export const PICK_GLOW: Record<Pick, string>   = { '1': 'rgba(34,197,94,0.18)',  '1X': 'rgba(110,231,183,0.12)', X: 'rgba(245,158,11,0.18)',  'X2': 'rgba(251,146,60,0.12)', '2': 'rgba(239,68,68,0.18)' }

// ─────────────────────────────────────────────────────────────────
// Badge system / coins / streak / tutorial / leagues keys
// ─────────────────────────────────────────────────────────────────
export const BADGES_KEY = 'ts_quiniela_badges'

export const COINS_KEY     = 'ts_quiniela_coins'
export const COINS_TXN_KEY = 'ts_quiniela_coins_txn'
export const COINS_INITIAL = 100

export const STREAK_KEY = 'ts_quiniela_streak'
export const TUTORED_KEY = 'ts_quiniela_tutored'

export const LEAGUES_KEY = 'ts_quiniela_leagues'

// Alias visible del jugador en ligas/ranking (antes se mandaba 'Tú'
// hardcodeado, lo que colapsaba a todos los miembros en una sola fila).
export const ALIAS_KEY = 'ts_quiniela_alias'

// ─────────────────────────────────────────────────────────────────
// Onboarding steps — refleja el modelo Ranked actual (apuesta con
// monedas + cuota como multiplicador + bonus de jornada + ligas
// privadas por puntos).
// ─────────────────────────────────────────────────────────────────
export const ONBOARDING_STEPS: { emoji: string; title: string; body: string; hint?: string }[] = [
  {
    emoji: '🎯',
    title: 'Predice cada partido',
    body: 'En cada tarjeta tocá L (gana local), E (empate) o V (gana visitante). Cada opción tiene su cuota (el multiplicador estilo casa de apuestas).',
    hint: 'Las cuotas se mueven en vivo según el consenso real del resto de jugadores.',
  },
  {
    emoji: '💰',
    title: 'Apostá tus monedas',
    body: 'Decidí cuántas monedas apostar en cada pick (entre 1 y 200). Si aciertas, ganás stake × cuota. Si fallás, perdés el stake. Apostar a una cuota alta paga mucho más, pero es más arriesgado.',
    hint: 'Default 10🪙 por pick · podés bajarlo o subirlo en el panel «Tu apuesta».',
  },
  {
    emoji: '⚽',
    title: 'Goleador del partido destacado',
    body: 'Cada jornada hay 1 partido destacado (el de mayor calidad). Podés elegir gratis quién marcará gol ahí: si tu jugador anota recibís bonus extra — 100🪙 si marca 1, 200🪙 si marca 2, 350🪙 si hace hat-trick.',
    hint: 'No cuesta nada participar · el partido destacado se autoselecciona cada jornada.',
  },
  {
    emoji: '🏆',
    title: 'Liga general + amigos',
    body: 'En el Ranked competís contra todos por monedas acumuladas. En ligas privadas armás un grupo con amigos por código/link y compiten por puntos internos (sin apuesta).',
    hint: 'Los juegos diarios (CrackQuiz, Mi Once, Sopa de Cracks) también te dan monedas para usar en el Ranked.',
  },
]
