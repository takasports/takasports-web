// ─────────────────────────────────────────────────────────────────
// Levels — fórmula XP → Level para el sistema de progresión Taka.
//
// Diseño:
//   · XP = puntos Taka acumulados lifetime (sum de point_transactions.amount > 0)
//          + 200 XP por cada badge desbloqueado.
//   · Los puntos son universales: vienen de ranked, quiniela,
//     streak milestones, juegos diarios, etc.
//   · El level es puramente cosmético — NO da ventajas mecánicas.
//
// Tabla de niveles:
//   L1 Novato          0
//   L2 Aficionado      500
//   L3 Pronosticador   1500
//   L4 Analista        3500
//   L5 Experto         7500
//   L6 Crack           15000
//   L7 Maestro         30000
//   L8 Leyenda         60000
//   L9 Mito            100000
// ─────────────────────────────────────────────────────────────────

export interface LevelDef {
  level: number
  name: string
  minXp: number
  color: string
}

export const LEVELS: LevelDef[] = [
  { level: 1, name: 'Novato',         minXp: 0,      color: '#94a3b8' },
  { level: 2, name: 'Aficionado',     minXp: 500,    color: '#60a5fa' },
  { level: 3, name: 'Pronosticador',  minXp: 1500,   color: '#22d3ee' },
  { level: 4, name: 'Analista',       minXp: 3500,   color: '#34d399' },
  { level: 5, name: 'Experto',        minXp: 7500,   color: '#a78bfa' },
  { level: 6, name: 'Crack',          minXp: 15000,  color: '#f97316' },
  { level: 7, name: 'Maestro',        minXp: 30000,  color: '#ef4444' },
  { level: 8, name: 'Leyenda',        minXp: 60000,  color: '#fbbf24' },
  { level: 9, name: 'Mito',           minXp: 100000, color: '#fb7185' },
]

export const XP_PER_BADGE = 200

export interface LevelInfo {
  current: LevelDef
  next: LevelDef | null   // null si ya en max level
  xp: number              // XP total del user
  xpInLevel: number       // XP acumulado dentro del nivel actual
  xpToNext: number        // XP que falta para subir (0 si max)
  progress: number        // 0..1 — para barra de progreso
}

export function computeLevel(xp: number): LevelInfo {
  const safe = Math.max(0, Math.floor(xp))
  let currentIdx = 0
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (safe >= LEVELS[i].minXp) { currentIdx = i; break }
  }
  const current = LEVELS[currentIdx]
  const next = LEVELS[currentIdx + 1] ?? null
  const xpInLevel = safe - current.minXp
  if (!next) {
    return { current, next: null, xp: safe, xpInLevel, xpToNext: 0, progress: 1 }
  }
  const span = next.minXp - current.minXp
  const xpToNext = next.minXp - safe
  const progress = Math.min(1, Math.max(0, xpInLevel / span))
  return { current, next, xp: safe, xpInLevel, xpToNext, progress }
}

/**
 * Calcula XP total de un user dados los inputs del ledger + badges.
 * XP = suma de puntos positivos en point_transactions + bonus por badges.
 */
export function computeXp(opts: {
  lifetimePts: number    // SUM(amount) WHERE amount > 0 FROM point_transactions
  badgesCount: number
}): number {
  return Math.max(0, Math.floor(opts.lifetimePts) + opts.badgesCount * XP_PER_BADGE)
}
