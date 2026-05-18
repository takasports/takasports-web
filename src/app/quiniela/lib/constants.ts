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
// Onboarding steps
// ─────────────────────────────────────────────────────────────────
export const ONBOARDING_STEPS: { emoji: string; title: string; body: string; hint?: string }[] = [
  { emoji: '🎯', title: 'Predice cada partido', body: 'Toca 1 (gana local), X (empate) o 2 (gana visitante). Cada acierto = +10🪙.', hint: 'La IA te sugiere una opción usando las cuotas reales.' },
  { emoji: '👑', title: 'Elige tu capitán', body: 'Toca la 👑 en la tarjeta del partido que más seguro veas. Si aciertas ese, los puntos se doblan (+20🪙). Si fallas, no pasa nada.', hint: 'Solo 1 capitán por jornada · puedes cambiarlo hasta el cierre.' },
  { emoji: '🪙', title: 'Gana monedas y pleno', body: 'Acierto = +10 · Capitán acertado = +20 · Acertar todos los partidos = +100 de bonus.', hint: 'Las monedas desbloquean comodines durante la jornada.' },
  { emoji: '🏆', title: 'Compite con amigos', body: 'Crea una liga privada con código y compartilo. Compite cada semana en un ranking propio.', hint: 'También puedes unirte con un enlace de invitación.' },
]
