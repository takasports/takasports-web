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
// Onboarding steps — modelo SIN apuestas: predices gratis y sumas
// PUNTOS FIJOS a la Liga Taka (tendencia 1 · destacado ×2 · marcador
// exacto +3 · pleno +5). Sin stake, sin saldo, sin cuotas que paguen.
// ─────────────────────────────────────────────────────────────────
export const ONBOARDING_STEPS: { emoji: string; title: string; body: string; hint?: string }[] = [
  {
    emoji: '🎯',
    title: 'Predice cada partido',
    body: 'En cada tarjeta tocá L (gana local), E (empate) o V (gana visitante). No apuestas nada: predecir es gratis.',
    hint: 'La cuota que ves es solo orientativa (el consenso del resto de jugadores), no multiplica tus puntos.',
  },
  {
    emoji: '🏆',
    title: 'Suma puntos por acertar',
    body: 'Cada tendencia acertada te da 1 punto para la Liga Taka. No pierdes nada si fallas. Acierta toda la jornada (pleno) y te llevas +5 puntos extra.',
    hint: 'Los puntos van al ranking general de TakaSports, junto con el Mundial y los minijuegos.',
  },
  {
    emoji: '⭐',
    title: 'Partido destacado · x2',
    body: 'Cada jornada hay 1 partido destacado (el más reñido). Si aciertas su 1/X/2, ese punto se duplica. Si encima clavas el marcador exacto, ese bonus también se dobla.',
    hint: 'No cuesta nada · el destacado se autoselecciona cada jornada en función del equilibrio del partido.',
  },
  {
    emoji: '🎯',
    title: 'Marcador exacto · +3 pts',
    body: 'Opcional: hasta 3 partidos por jornada podés añadir tu marcador exacto. Si clavás los goles Y la tendencia, te llevás +3 pts extra por pick. Si el partido es además el destacado, ese bonus también se duplica.',
    hint: 'Toca «+ Marcador exacto» bajo los botones 1/X/2 · solo cuenta si la tendencia también es correcta.',
  },
  {
    emoji: '🏆',
    title: 'Liga general + amigos',
    body: 'En el Ranked compites contra todos por puntos acumulados. En ligas privadas armás un grupo con amigos por código/link y compiten por puntos internos.',
    hint: 'Los juegos diarios (CrackQuiz, Mi Once, Sopa de Cracks) también te dan puntos Taka en el Ranked.',
  },
]
