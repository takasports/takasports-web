// ─────────────────────────────────────────────────────────────────
// Levels — fórmula puntos → Level para el sistema de progresión Taka.
//
// F4·T5: el nivel deriva EXCLUSIVAMENTE de los puntos del ledger
// (point_transactions). NO hay bonus aparte por insignia: cada insignia
// acredita +50 PUNTOS REALES al desbloquearse (source='badge'), que ya
// cuentan tanto para el nivel como para la Liga Taka. Antes se sumaban
// 200 XP/insignia por fuera del ledger (no contaba para el ranking) — retirado.
//
// Los puntos son universales: ranked/predicciones, mundial, racha,
// minijuegos, misiones e insignias. El level es puramente cosmético — NO
// da ventajas mecánicas.
//
// Curva (recalibrada F4·T5 a la economía real, ~15–30 pts/día de un
// usuario enganchado; primeros niveles rápidos, techo en ~1½ año):
//   L1 Novato          0
//   L2 Aficionado      100
//   L3 Pronosticador   300
//   L4 Analista        700
//   L5 Experto         1500
//   L6 Crack           3000
//   L7 Maestro         5000
//   L8 Leyenda         7500
//   L9 Mito            11000
// ─────────────────────────────────────────────────────────────────

export interface LevelDef {
  level: number
  name: string
  minXp: number
  color: string
}

export const LEVELS: LevelDef[] = [
  { level: 1, name: 'Novato',         minXp: 0,      color: '#94a3b8' },
  { level: 2, name: 'Aficionado',     minXp: 100,    color: '#60a5fa' },
  { level: 3, name: 'Pronosticador',  minXp: 300,    color: '#22d3ee' },
  { level: 4, name: 'Analista',       minXp: 700,    color: '#34d399' },
  { level: 5, name: 'Experto',        minXp: 1500,   color: '#a78bfa' },
  { level: 6, name: 'Crack',          minXp: 3000,   color: '#f97316' },
  { level: 7, name: 'Maestro',        minXp: 5000,   color: '#ef4444' },
  { level: 8, name: 'Leyenda',        minXp: 7500,   color: '#fbbf24' },
  { level: 9, name: 'Mito',           minXp: 11000,  color: '#fb7185' },
]

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
 * XP total de un usuario = sus puntos Taka lifetime (suma positiva del
 * ledger point_transactions). Las insignias YA están dentro de esa suma
 * (acreditan +50 puntos reales al desbloquearse), así que no se suman aparte.
 */
export function computeXp(lifetimePts: number): number {
  return Math.max(0, Math.floor(lifetimePts))
}
