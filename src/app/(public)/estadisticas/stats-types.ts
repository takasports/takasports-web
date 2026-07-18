// Tipos compartidos del árbol de /estadisticas (extraídos del monolito EstadisticasClient).

// ─────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────
export interface StatRow {
  rank: number
  name: string
  team?: string
  value: string
  sub?: string
  flag?: string
  trend?: 'up' | 'down' | 'flat'
  extra?: Record<string, string>
  /** Deep-link target (player or club detail page). */
  href?: string
  /** Club crest URL — shown on club table rows and as the avatar on player rows. */
  logo?: string
}

export interface StatBlock {
  id: string
  title: string
  metric: string
  unit?: string
  rows: StatRow[]
  placeholder?: boolean   // si true, muestra estado "próximamente"
  league?: string
  cardType?: string       // 'fixtures' → render with PlayoffSeriesCard
}

export interface MetricGroup {
  id: string
  label: string
  icon: string
  description?: string
  blocks: StatBlock[]
}

export interface SubSection {
  id: string
  label: string
  icon: string
  groups?: MetricGroup[]   // si existe, usa acordeón de grupos
  blocks?: StatBlock[]     // si no hay grupos, usa grid plano
}

export interface SportConfig {
  id: string
  label: string
  emoji: string
  accent: string
  sections: SubSection[]
}

