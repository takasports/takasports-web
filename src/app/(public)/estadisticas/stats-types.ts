// Tipos compartidos del árbol de /estadisticas (extraídos del monolito EstadisticasClient).

import type { StandingZone } from '@/lib/league-zones'

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
  /** Escudo del club. En filas 'player' va de insignia junto a la cara; en 'club', plano. */
  logo?: string
  /** Cara del jugador (cascada Wikimedia/ESPN). Manda sobre el escudo en filas 'player'. */
  photo?: string
  /** Ratio por partido precomputado ("0,77 /PJ"). Solo en métricas de TOTAL con PJ conocidos. */
  perMatch?: string
  /** Zona de clasificación (UCL/UEL/descenso) en tablas de liga conocida. */
  zone?: StandingZone
  /** Discrimina el tratamiento visual del avatar. Sin valor = render legado (NBA/estáticos). */
  kind?: 'player' | 'club'
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

