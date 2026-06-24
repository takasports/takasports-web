'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { PodiumMedal } from '@/components/icons/GameIcons'
import NewsletterSection from '@/components/NewsletterSection'
import ScrollToTop from '@/components/ScrollToTop'
import { StatBlockBoundary } from '@/components/StatBlockBoundary'
import { trackStatsBlockOpen, trackStatsGroupOpen, trackSearch } from '@/lib/analytics'
import { StatsSearchModal, type SearchableRow } from '@/components/StatsSearchModal'

// ─────────────────────────────────────────────────────────────────
// DATOS EN VIVO — resumen de fuentes y limitaciones
// ─────────────────────────────────────────────────────────────────
// ✅ GRATIS  ESPN           → Goles + Asistencias (solo 2 categorías)
// ✅ GRATIS  NBA.com        → PPG, RPG, APG, BPG, SPG, EFF, 3PM (temporada activa)
// ✅ GRATIS  Jolpica/F1     → Clasificación pilotos/constructores, poles, vueltas rápidas
// ✅ GRATIS  ATP/WTA (ESPN) → Rankings en vivo
// ✅ GRATIS  FIFA (ESPN)    → Ranking selecciones
// ⚠️ HIST    API-Sports     → Tarjetas, tiros a puerta, G/90 (free tier = temporada 2024)
// ─────────────────────────────────────────────────────────────────
// ❌ PENDIENTE PAGO — automatizaciones no disponibles gratis:
//
// API-Sports Pro (~€12/mes):
//   Desbloquea temporada 2025-26 → tarjetas-amarillas, tarjetas-rojas, tiros-puerta, goles-90
//   Endpoint: players/topyellowcards, topredcards, topscorers con season=2025
//
// StatsBomb Open + FIFA World Cup: gratuito para datos históricos de Copas.
//   Para xG, key passes, presiones (datos avanzados) de ligas activas requiere licencia
//   StatsBomb Data (~€50-500+/mes según liga).
//
// WhoScored / Opta (~€200-500+/mes): xG, progressive carries, duels, pressing stats,
//   goalkeeper PSxG. No hay alternativa gratuita para datos de temporada activa.
// ─────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────
interface StatRow {
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

interface StatBlock {
  id: string
  title: string
  metric: string
  unit?: string
  rows: StatRow[]
  placeholder?: boolean   // si true, muestra estado "próximamente"
  league?: string
  cardType?: string       // 'fixtures' → render with PlayoffSeriesCard
}

interface MetricGroup {
  id: string
  label: string
  icon: string
  description?: string
  blocks: StatBlock[]
}

interface SubSection {
  id: string
  label: string
  icon: string
  groups?: MetricGroup[]   // si existe, usa acordeón de grupos
  blocks?: StatBlock[]     // si no hay grupos, usa grid plano
}

interface SportConfig {
  id: string
  label: string
  emoji: string
  accent: string
  sections: SubSection[]
}

// ─────────────────────────────────────────────────────────────────
// FILTROS
// ─────────────────────────────────────────────────────────────────
const LEAGUE_FILTERS   = ['General', 'LaLiga', 'Premier League', 'Bundesliga', 'Serie A', 'Ligue 1']

// Short-name aliases that don't appear in ESPN's standings response.
// Used for tables (goleadores, etc.) where the player's `team` field comes
// from a different source (api-sports, editorial) and uses a casual nickname.
const TEAM_ALIASES: Record<string, string> = {
  'Barcelona': 'LaLiga',           'Atlético': 'LaLiga',          'Betis': 'LaLiga',
  'Rayo': 'LaLiga',                'Celta Vigo': 'LaLiga',
  'Man City': 'Premier League',    'Man United': 'Premier League','Tottenham': 'Premier League',
  'Newcastle': 'Premier League',   'Brighton': 'Premier League',  'West Ham': 'Premier League',
  'Bournemouth': 'Premier League', 'Wolves': 'Premier League',    'Wolverhampton': 'Premier League',
  'Bayern': 'Bundesliga',          'Leverkusen': 'Bundesliga',    'Dortmund': 'Bundesliga',
  'Stuttgart': 'Bundesliga',       'Freiburg': 'Bundesliga',
  'Inter Milan': 'Serie A',        'Inter Milán': 'Serie A',      'Internazionale': 'Serie A',
  'Roma': 'Serie A',
  'PSG': 'Ligue 1',                'Marseille': 'Ligue 1',        'Lyon': 'Ligue 1',
}

// Live dictionary populated from liveData.football. Aliases above are merged
// in so partial names ("Bayern", "Tottenham") still resolve. Empty until first
// fetch returns; the league filter just won't kick in until then.
const TeamLeagueContext = React.createContext<Record<string, string>>(TEAM_ALIASES)

function buildTeamLeague(football: { label: string; rows: { name: string; abbr?: string }[] }[]): Record<string, string> {
  const out: Record<string, string> = { ...TEAM_ALIASES }
  for (const league of football) {
    for (const r of league.rows) {
      if (r.name) out[r.name] = league.label
      if (r.abbr) out[r.abbr] = league.label
    }
  }
  return out
}

// ─────────────────────────────────────────────────────────────────
// DATOS — FÚTBOL
// Solo bloques con fuente real (ESPN/API-Sports/NBA.com) o snapshots
// editoriales con fecha visible. Nada de xG/xA/PSxG/presiones que
// requieren licencia StatsBomb/Opta.
// ─────────────────────────────────────────────────────────────────
const FUTBOL_JUGADORES_GROUPS: MetricGroup[] = [
  {
    id: 'ataque',
    label: 'Ataque',
    icon: '⚡',
    description: 'Goles, asistencias y producción ofensiva',
    blocks: [
      {
        id: 'goleadores', title: 'Goleadores', metric: 'Goles',
        rows: [{ rank: 1, name: 'Cargando…', value: '—', sub: 'ESPN · top liga europea', trend: 'flat' as const }],
      },
      {
        id: 'asistencias', title: 'Asistencias', metric: 'Asist.',
        rows: [{ rank: 1, name: 'Cargando…', value: '—', sub: 'ESPN · top liga europea', trend: 'flat' as const }],
      },
    ],
  },
  {
    id: 'tiro',
    label: 'Tiro',
    icon: '🎯',
    description: 'Volumen y precisión de disparo (5 grandes ligas)',
    blocks: [
      {
        id: 'tiros-puerta', title: 'Tiros a puerta', metric: 'TP',
        rows: [{ rank: 1, name: 'Cargando…', value: '—', sub: 'ESPN · 5 ligas', trend: 'flat' as const }],
      },
      {
        id: 'tiros-totales', title: 'Tiros totales', metric: 'Tiros',
        rows: [{ rank: 1, name: 'Cargando…', value: '—', sub: 'ESPN · 5 ligas', trend: 'flat' as const }],
      },
    ],
  },
  {
    id: 'disciplina',
    label: 'Disciplina',
    icon: '🟨',
    description: 'Tarjetas y faltas (5 grandes ligas)',
    blocks: [
      {
        id: 'tarjetas-amarillas', title: 'Tarjetas amarillas', metric: 'TA',
        rows: [{ rank: 1, name: 'Cargando…', value: '—', sub: 'ESPN · 5 ligas', trend: 'flat' as const }],
      },
      {
        id: 'tarjetas-rojas', title: 'Tarjetas rojas', metric: 'TR',
        rows: [{ rank: 1, name: 'Cargando…', value: '—', sub: 'ESPN · 5 ligas', trend: 'flat' as const }],
      },
      {
        id: 'faltas', title: 'Faltas cometidas', metric: 'Faltas',
        rows: [{ rank: 1, name: 'Cargando…', value: '—', sub: 'ESPN · 5 ligas', trend: 'flat' as const }],
      },
    ],
  },
  {
    id: 'porteria',
    label: 'Portería',
    icon: '🧤',
    description: 'Porteros con más paradas (5 grandes ligas)',
    blocks: [
      {
        id: 'paradas', title: 'Paradas', metric: 'Paradas',
        rows: [{ rank: 1, name: 'Cargando…', value: '—', sub: 'ESPN · 5 ligas', trend: 'flat' as const }],
      },
    ],
  },
]

// ─────────────────────────────────────────────────────────────────
// DATOS — FÚTBOL FEMENINO
// ─────────────────────────────────────────────────────────────────
// NO MENTIR (misma regla que el bloque "SPORTS COMPLETO" de abajo): sin filas
// hardcodeadas. Antes había snapshots a fuego (Aitana 22, Sam Kerr en Chelsea,
// tabla Barça 72) que, si el live no respondía, se mostraban como reales y
// caducados. applyLive rellena estos bloques desde womenGoals/womenAssists/
// womenLigaF cuando llegan; si no hay datos en vivo, StatBlockCard muestra
// "Sin datos disponibles" en vez de un dato viejo inventado.
const FUTBOL_FEMENINO_BLOCKS: StatBlock[] = [
  { id: 'f-goleadoras',  title: 'Goleadoras',   metric: 'Goles',  rows: [] },
  { id: 'f-asistencias', title: 'Asistencias',  metric: 'Asist.', rows: [] },
  { id: 'f-ligaf-tabla', title: 'Tabla Liga F', metric: 'Puntos', placeholder: false, rows: [] },
]

// ─────────────────────────────────────────────────────────────────
// DATOS — SPORTS COMPLETO
// ─────────────────────────────────────────────────────────────────
// Solo metadatos de cabecera (id + label). Las 4 selecciones por grupo
// vienen siempre del live (ESPN /standings). Sin equipos hardcodeados → si
// FIFA cambia algo, nunca mostramos un dato desactualizado.
const WC_GROUPS_FALLBACK = (['A','B','C','D','E','F','G','H','I','J','K','L'] as const).map(L => ({
  id: `wc-group-${L.toLowerCase()}`,
  label: `Grupo ${L}`,
}))

const SPORTS: SportConfig[] = [
  {
    // Pseudo-deporte: landing cross-sport con lo más relevante de cada deporte
    // sin que el usuario tenga que navegar. Renderizado especial via <ResumenView/>
    // (no usa sections.blocks). Id se mantiene 'resumen' para no romper URLs
    // guardadas; el label es 'Destacados' alineado con la pastilla del calendario.
    id: 'resumen', label: 'Destacados', emoji: '⭐', accent: '#7C3AED',
    sections: [{ id: 'home', label: 'Hoy', icon: '⭐', blocks: [] }],
  },
  {
    id: 'mundial', label: 'Mundial 2026', emoji: '🌍', accent: '#f59e0b',
    sections: [
      {
        id: 'grupos', label: 'Grupos', icon: '🏆',
        blocks: WC_GROUPS_FALLBACK.map(g => ({
          id: g.id,
          title: g.label,
          metric: 'Pts',
          rows: [],
        })),
      },
      {
        id: 'wc-goleo', label: 'Goleadores', icon: '⚽',
        blocks: [
          { id: 'wc-scorers', title: 'Mundial 2026 · Goleadores', metric: 'Goles',  rows: [] },
          { id: 'wc-assists', title: 'Mundial 2026 · Asistencias', metric: 'Asist.', rows: [] },
        ],
      },
      {
        id: 'calendario', label: 'Próximos partidos', icon: '📅',
        blocks: [{
          id: 'wc-schedule',
          title: 'Próximos partidos · Mundial 2026',
          metric: 'Hora',
          rows: [],
        }],
      },
      {
        id: 'eliminatoria', label: 'Eliminatoria', icon: '⚔️',
        blocks: [{
          id: 'wc-knockout',
          title: 'Fase eliminatoria · Mundial 2026',
          metric: 'Resultado',
          placeholder: true,
          rows: [],
        }],
      },
      {
        id: 'clasificados', label: 'Clasificados', icon: '✅',
        blocks: [{
          id: 'wc-qualified', title: 'Selecciones clasificadas · 48 plazas',
          metric: 'Grupo', rows: [],
        }],
      },
    ],
  },
  {
    id: 'futbol', label: 'Fútbol', emoji: '⚽', accent: '#22c55e',
    sections: [
      { id: 'jugadores', label: 'Jugadores', icon: '👤', groups: FUTBOL_JUGADORES_GROUPS },
      {
        id: 'competiciones', label: 'Competiciones', icon: '🏆',
        blocks: [
          {
            id: 'tabla-laliga', title: 'Tabla LaLiga', metric: 'Pts', league: 'LaLiga',
            rows: [
              { rank: 1, name: 'FC Barcelona',    value: '74', sub: '29 PJ · +42', trend: 'up',   extra: { V: '23', E: '5', D: '1' } },
              { rank: 2, name: 'Real Madrid',     value: '71', sub: '29 PJ · +38', trend: 'flat', extra: { V: '22', E: '5', D: '2' } },
              { rank: 3, name: 'Atlético Madrid', value: '60', sub: '29 PJ · +19', trend: 'flat', extra: { V: '18', E: '6', D: '5' } },
              { rank: 4, name: 'Athletic Club',   value: '54', sub: '29 PJ · +14', trend: 'up',   extra: { V: '16', E: '6', D: '7' } },
              { rank: 5, name: 'Villarreal',      value: '50', sub: '29 PJ · +8',  trend: 'flat', extra: { V: '14', E: '8', D: '7' } },
              { rank: 6, name: 'Real Sociedad',   value: '46', sub: '29 PJ · +4',  trend: 'down', extra: { V: '12', E: '10', D: '7' } },
              { rank: 7, name: 'Betis',           value: '44', sub: '29 PJ · +2',  trend: 'flat', extra: { V: '12', E: '8', D: '9' } },
              { rank: 8, name: 'Rayo Vallecano',  value: '40', sub: '29 PJ · -2',  trend: 'up',   extra: { V: '11', E: '7', D: '11' } },
              { rank: 9, name: 'Valencia',        value: '38', sub: '29 PJ · -4',  trend: 'down', extra: { V: '10', E: '8', D: '11' } },
              { rank: 10, name: 'Osasuna',        value: '37', sub: '29 PJ · -5',  trend: 'flat', extra: { V: '10', E: '7', D: '12' } },
            ],
          },
          {
            id: 'tabla-premier', title: 'Tabla Premier League', metric: 'Pts', league: 'Premier League',
            rows: [
              { rank: 1, name: 'Liverpool',       value: '82', sub: '31 PJ · +56', trend: 'up',   extra: { V: '26', E: '4', D: '1' } },
              { rank: 2, name: 'Arsenal',         value: '71', sub: '31 PJ · +37', trend: 'up',   extra: { V: '21', E: '8', D: '2' } },
              { rank: 3, name: 'Chelsea',         value: '64', sub: '31 PJ · +24', trend: 'up',   extra: { V: '19', E: '7', D: '5' } },
              { rank: 4, name: 'Nottingham Forest',value: '61',sub: '31 PJ · +18', trend: 'up',   extra: { V: '18', E: '7', D: '6' } },
              { rank: 5, name: 'Newcastle',       value: '58', sub: '31 PJ · +20', trend: 'flat', extra: { V: '17', E: '7', D: '7' } },
              { rank: 6, name: 'Man City',        value: '55', sub: '31 PJ · +10', trend: 'down', extra: { V: '16', E: '7', D: '8' } },
              { rank: 7, name: 'Aston Villa',     value: '53', sub: '31 PJ · +8',  trend: 'flat', extra: { V: '15', E: '8', D: '8' } },
            ],
          },
          {
            id: 'tabla-bundesliga', title: 'Tabla Bundesliga', metric: 'Pts', league: 'Bundesliga',
            rows: [
              { rank: 1, name: 'Bayern Munich',   value: '82', sub: '29 PJ · +64', trend: 'up',   extra: { V: '26', E: '4', D: '0' } },
              { rank: 2, name: 'Bayer Leverkusen',value: '75', sub: '29 PJ · +42', trend: 'flat', extra: { V: '23', E: '6', D: '2' } },
              { rank: 3, name: 'Eintracht Frankfurt',value: '61',sub: '29 PJ · +16',trend: 'up',  extra: { V: '18', E: '7', D: '4' } },
              { rank: 4, name: 'Borussia Dortmund',value: '59', sub: '29 PJ · +14', trend: 'flat', extra: { V: '17', E: '8', D: '4' } },
              { rank: 5, name: 'RB Leipzig',       value: '55', sub: '29 PJ · +8',  trend: 'flat', extra: { V: '16', E: '7', D: '6' } },
            ],
          },
          {
            id: 'tabla-serie-a', title: 'Tabla Serie A', metric: 'Pts', league: 'Serie A',
            rows: [
              { rank: 1, name: 'Inter Milán',   value: '72', sub: '29 PJ · +34', trend: 'flat', extra: { V: '22', E: '6', D: '1' } },
              { rank: 2, name: 'AC Milan',      value: '65', sub: '29 PJ · +24', trend: 'up',   extra: { V: '20', E: '5', D: '4' } },
              { rank: 3, name: 'Juventus',      value: '60', sub: '29 PJ · +18', trend: 'flat', extra: { V: '18', E: '6', D: '5' } },
              { rank: 4, name: 'Atalanta',      value: '58', sub: '29 PJ · +20', trend: 'up',   extra: { V: '17', E: '7', D: '5' } },
              { rank: 5, name: 'Napoli',        value: '55', sub: '29 PJ · +12', trend: 'up',   extra: { V: '16', E: '7', D: '6' } },
              { rank: 6, name: 'Roma',          value: '48', sub: '29 PJ · +6',  trend: 'down', extra: { V: '14', E: '6', D: '9' } },
              { rank: 7, name: 'Lazio',         value: '44', sub: '29 PJ · +2',  trend: 'flat', extra: { V: '12', E: '8', D: '9' } },
            ],
          },
          {
            id: 'tabla-ligue1', title: 'Tabla Ligue 1', metric: 'Pts', league: 'Ligue 1',
            rows: [
              { rank: 1, name: 'Paris Saint-Germain', value: '87', sub: '32 PJ · +81', trend: 'up',   extra: { V: '28', E: '3', D: '1' } },
              { rank: 2, name: 'Monaco',              value: '72', sub: '32 PJ · +32', trend: 'up',   extra: { V: '22', E: '6', D: '4' } },
              { rank: 3, name: 'Marseille',           value: '65', sub: '32 PJ · +22', trend: 'flat', extra: { V: '20', E: '5', D: '7' } },
              { rank: 4, name: 'Lens',                value: '58', sub: '32 PJ · +12', trend: 'flat', extra: { V: '17', E: '7', D: '8' } },
              { rank: 5, name: 'Brest',               value: '57', sub: '32 PJ · +8',  trend: 'up',   extra: { V: '16', E: '9', D: '7' } },
              { rank: 6, name: 'Lille',               value: '56', sub: '32 PJ · +9',  trend: 'flat', extra: { V: '16', E: '8', D: '8' } },
              { rank: 7, name: 'Nice',                value: '54', sub: '32 PJ · +6',  trend: 'flat', extra: { V: '15', E: '9', D: '8' } },
            ],
          },
          {
            id: 'tabla-ucl', title: 'Champions League', metric: 'Pts',
            rows: [
              { rank: 1,  name: 'Real Madrid',      value: '—', sub: 'Fase de liga', trend: 'flat' as const, extra: {} },
              { rank: 2,  name: 'Manchester City',  value: '—', sub: 'Fase de liga', trend: 'flat' as const, extra: {} },
            ],
          },
          {
            id: 'tabla-uel', title: 'Europa League', metric: 'Pts',
            rows: [
              { rank: 1,  name: 'Manchester United', value: '—', sub: 'Fase de liga', trend: 'flat' as const, extra: {} },
              { rank: 2,  name: 'Roma',               value: '—', sub: 'Fase de liga', trend: 'flat' as const, extra: {} },
            ],
          },
          {
            id: 'ucl-scorers', title: 'Champions · Goleadores', metric: 'Goles',
            rows: [{ rank: 1, name: 'Cargando…', value: '—', sub: 'ESPN', trend: 'flat' as const }],
          },
          {
            id: 'ucl-assists', title: 'Champions · Asistencias', metric: 'Asist.',
            rows: [{ rank: 1, name: 'Cargando…', value: '—', sub: 'ESPN', trend: 'flat' as const }],
          },
          {
            id: 'uel-scorers', title: 'Europa League · Goleadores', metric: 'Goles',
            rows: [{ rank: 1, name: 'Cargando…', value: '—', sub: 'ESPN', trend: 'flat' as const }],
          },
          {
            id: 'uel-assists', title: 'Europa League · Asistencias', metric: 'Asist.',
            rows: [{ rank: 1, name: 'Cargando…', value: '—', sub: 'ESPN', trend: 'flat' as const }],
          },
          {
            id: 'goles-equipo', title: 'Equipos más goleadores', metric: 'Goles',
            rows: [
              { rank: 1, name: 'Manchester City', value: '82', sub: '29 PJ · 2.83/PJ', trend: 'flat' },
              { rank: 2, name: 'FC Barcelona',    value: '79', sub: '29 PJ · 2.72/PJ', trend: 'up' },
              { rank: 3, name: 'Real Madrid',     value: '76', sub: '29 PJ · 2.62/PJ', trend: 'flat' },
              { rank: 4, name: 'Liverpool',       value: '71', sub: '29 PJ · 2.45/PJ', trend: 'up' },
              { rank: 5, name: 'Arsenal',         value: '68', sub: '29 PJ · 2.34/PJ', trend: 'up' },
              { rank: 6, name: 'Bayer Leverkusen',value: '65', sub: '27 PJ · 2.41/PJ', trend: 'up' },
              { rank: 7, name: 'Bayern Munich',   value: '62', sub: '27 PJ · 2.30/PJ', trend: 'flat' },
            ],
          },
          {
            id: 'menos-goles', title: 'Defensas más sólidas', metric: 'GC',
            rows: [
              { rank: 1, name: 'Manchester City', value: '18', sub: '29 PJ · 0.62/PJ', trend: 'flat' },
              { rank: 2, name: 'Arsenal',         value: '20', sub: '29 PJ · 0.69/PJ', trend: 'flat' },
              { rank: 3, name: 'Real Madrid',     value: '22', sub: '29 PJ · 0.76/PJ', trend: 'flat' },
              { rank: 4, name: 'FC Barcelona',    value: '24', sub: '29 PJ · 0.83/PJ', trend: 'flat' },
              { rank: 5, name: 'Atlético Madrid', value: '26', sub: '29 PJ · 0.90/PJ', trend: 'up' },
            ],
          },
          {
            id: 'pichichi-laliga', title: 'Pichichi LaLiga', metric: 'Goles', league: 'LaLiga',
            // Placeholder hasta que /api/stats/players responda (applyLivePlayerToBlock
            // lo reemplaza con el Pichichi en vivo). Antes había un snapshot hardcodeado
            // (Lewandowski 26) que se mostraba como real mientras la API cargaba.
            rows: [
              { rank: 1, name: 'Cargando…', value: '—', sub: 'ESPN · LaLiga', trend: 'flat' },
            ],
          },
          {
            id: 'bota-oro', title: 'Bota de Oro Europa', metric: 'Goles×2',
            rows: [
              { rank: 1, name: 'Cargando…', value: '—', sub: 'ESPN · 5 grandes ligas', trend: 'flat' },
            ],
          },
        ],
      },
      {
        id: 'selecciones', label: 'Selecciones', icon: '🌍',
        blocks: [
          {
            id: 'ranking-fifa', title: 'Ranking Mundial · Elo', metric: 'Pts',
            rows: [
              { rank: 1,  name: 'Francia',        value: '1877.3', sub: 'pts FIFA', flag: '🇫🇷', trend: 'up' },
              { rank: 2,  name: 'España',         value: '1876.4', sub: 'pts FIFA', flag: '🇪🇸', trend: 'down' },
              { rank: 3,  name: 'Argentina',      value: '1874.8', sub: 'pts FIFA', flag: '🇦🇷', trend: 'down' },
              { rank: 4,  name: 'Inglaterra',     value: '1826.0', sub: 'pts FIFA', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'flat' },
              { rank: 5,  name: 'Portugal',       value: '1763.8', sub: 'pts FIFA', flag: '🇵🇹', trend: 'up' },
              { rank: 6,  name: 'Brasil',         value: '1761.2', sub: 'pts FIFA', flag: '🇧🇷', trend: 'down' },
              { rank: 7,  name: 'Países Bajos',   value: '1757.9', sub: 'pts FIFA', flag: '🇳🇱', trend: 'flat' },
              { rank: 8,  name: 'Marruecos',      value: '1756.8', sub: 'pts FIFA', flag: '🇲🇦', trend: 'up' },
              { rank: 9,  name: 'Bélgica',        value: '1734.7', sub: 'pts FIFA', flag: '🇧🇪', trend: 'down' },
              { rank: 10, name: 'Alemania',       value: '1730.4', sub: 'pts FIFA', flag: '🇩🇪', trend: 'up' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'baloncesto', label: 'Baloncesto', emoji: '🏀', accent: '#f59e0b',
    sections: [
      {
        id: 'jugadores', label: 'Jugadores', icon: '👤',
        blocks: [
          {
            id: 'nba-scoring', title: 'Anotadores (PPG)', metric: 'PPG',
            rows: [
              { rank: 1,  name: 'Shai Gilgeous-Alexander', team: 'OKC',     value: '32.7', sub: 'Temp. 24/25', flag: '🇨🇦', trend: 'up',   extra: { RPG: '5.5', APG: '6.4' } },
              { rank: 2,  name: 'Giannis Antetokounmpo',   team: 'MIL',     value: '30.4', sub: 'Temp. 24/25', flag: '🇬🇷', trend: 'up',   extra: { RPG: '11.9', APG: '6.5' } },
              { rank: 3,  name: 'Nikola Jokić',            team: 'DEN',     value: '29.6', sub: 'Temp. 24/25', flag: '🇷🇸', trend: 'flat', extra: { RPG: '12.7', APG: '10.2' } },
              { rank: 4,  name: 'Anthony Edwards',         team: 'MIN',     value: '27.6', sub: 'Temp. 24/25', flag: '🇺🇸', trend: 'up',   extra: { RPG: '5.8', APG: '5.6' } },
              { rank: 5,  name: 'Jayson Tatum',            team: 'BOS',     value: '26.8', sub: 'Temp. 24/25', flag: '🇺🇸', trend: 'flat', extra: { RPG: '8.2', APG: '4.9' } },
              { rank: 6,  name: 'Luka Dončić',             team: 'LAL',     value: '25.6', sub: 'Temp. 24/25', flag: '🇸🇮', trend: 'flat', extra: { RPG: '8.0', APG: '7.9' } },
              { rank: 7,  name: 'Victor Wembanyama',       team: 'SAS',     value: '24.3', sub: 'Temp. 24/25', flag: '🇫🇷', trend: 'up',   extra: { RPG: '10.7', APG: '3.7' } },
              { rank: 8,  name: 'LaMelo Ball',             team: 'CHA',     value: '23.8', sub: 'Temp. 24/25', flag: '🇺🇸', trend: 'up',   extra: { RPG: '5.9', APG: '8.0' } },
              { rank: 9,  name: 'Karl-Anthony Towns',      team: 'NYK',     value: '23.7', sub: 'Temp. 24/25', flag: '🇩🇴', trend: 'up',   extra: { RPG: '12.8', APG: '3.1' } },
              { rank: 10, name: 'Alperen Şengün',          team: 'HOU',     value: '23.4', sub: 'Temp. 24/25', flag: '🇹🇷', trend: 'up',   extra: { RPG: '8.9', APG: '4.5' } },
            ],
          },
          {
            id: 'nba-rebounds', title: 'Reboteadores (RPG)', metric: 'RPG',
            rows: [
              { rank: 1, name: 'Domantas Sabonis',      team: 'SAC', value: '13.9', sub: 'Temp. 24/25', flag: '🇱🇹', trend: 'up' },
              { rank: 2, name: 'Karl-Anthony Towns',    team: 'NYK', value: '12.8', sub: 'Temp. 24/25', flag: '🇩🇴', trend: 'up' },
              { rank: 3, name: 'Nikola Jokić',          team: 'DEN', value: '12.7', sub: 'Temp. 24/25', flag: '🇷🇸', trend: 'flat' },
              { rank: 4, name: 'Giannis Antetokounmpo', team: 'MIL', value: '11.9', sub: 'Temp. 24/25', flag: '🇬🇷', trend: 'flat' },
              { rank: 5, name: 'Victor Wembanyama',     team: 'SAS', value: '10.7', sub: 'Temp. 24/25', flag: '🇫🇷', trend: 'up' },
              { rank: 6, name: 'Alperen Şengün',        team: 'HOU', value: '8.9',  sub: 'Temp. 24/25', flag: '🇹🇷', trend: 'up' },
              { rank: 7, name: 'Jayson Tatum',          team: 'BOS', value: '8.2',  sub: 'Temp. 24/25', flag: '🇺🇸', trend: 'flat' },
            ],
          },
          {
            id: 'nba-assists', title: 'Asistencias (APG)', metric: 'APG',
            rows: [
              { rank: 1, name: 'Trae Young',                team: 'ATL', value: '11.6', sub: 'Temp. 24/25', flag: '🇺🇸', trend: 'up' },
              { rank: 2, name: 'Nikola Jokić',              team: 'DEN', value: '10.2', sub: 'Temp. 24/25', flag: '🇷🇸', trend: 'up' },
              { rank: 3, name: 'Tyrese Haliburton',         team: 'IND', value: '9.2',  sub: 'Temp. 24/25', flag: '🇺🇸', trend: 'flat' },
              { rank: 4, name: 'LaMelo Ball',               team: 'CHA', value: '8.0',  sub: 'Temp. 24/25', flag: '🇺🇸', trend: 'up' },
              { rank: 5, name: 'Luka Dončić',               team: 'LAL', value: '7.9',  sub: 'Temp. 24/25', flag: '🇸🇮', trend: 'flat' },
              { rank: 6, name: 'Shai Gilgeous-Alexander',   team: 'OKC', value: '6.4',  sub: 'Temp. 24/25', flag: '🇨🇦', trend: 'up' },
              { rank: 7, name: 'Giannis Antetokounmpo',     team: 'MIL', value: '6.5',  sub: 'Temp. 24/25', flag: '🇬🇷', trend: 'up' },
            ],
          },
          {
            id: 'nba-blocks', title: 'Tapones (BPG)', metric: 'BPG',
            rows: [
              { rank: 1, name: 'Victor Wembanyama', team: 'SAS', value: '3.8', sub: 'Temp. 24/25', flag: '🇫🇷', trend: 'up' },
              { rank: 2, name: 'Walker Kessler',    team: 'UTA', value: '2.4', sub: 'Temp. 24/25', flag: '🇺🇸', trend: 'up' },
              { rank: 3, name: 'Myles Turner',      team: 'IND', value: '2.0', sub: 'Temp. 24/25', flag: '🇺🇸', trend: 'flat' },
              { rank: 4, name: 'Alperen Şengün',    team: 'HOU', value: '1.9', sub: 'Temp. 24/25', flag: '🇹🇷', trend: 'up' },
              { rank: 5, name: 'Evan Mobley',       team: 'CLE', value: '1.8', sub: 'Temp. 24/25', flag: '🇺🇸', trend: 'up' },
            ],
          },
          {
            id: 'nba-efficiency', title: 'True Shooting % (TS%)', metric: 'TS%',
            rows: [
              { rank: 1, name: 'Nikola Jokić',          team: 'DEN', value: '66.5%', sub: 'Temp. 24/25', flag: '🇷🇸', trend: 'up' },
              { rank: 2, name: 'Shai Gilgeous-Alexander', team: 'OKC', value: '63.7%', sub: 'Temp. 24/25', flag: '🇨🇦', trend: 'up' },
              { rank: 3, name: 'Giannis Antetokounmpo', team: 'MIL', value: '62.0%', sub: 'Temp. 24/25', flag: '🇬🇷', trend: 'flat' },
              { rank: 4, name: 'Karl-Anthony Towns',    team: 'NYK', value: '63.2%', sub: 'Temp. 24/25', flag: '🇩🇴', trend: 'up' },
              { rank: 5, name: 'Jayson Tatum',          team: 'BOS', value: '57.4%', sub: 'Temp. 24/25', flag: '🇺🇸', trend: 'flat' },
              { rank: 6, name: 'Stephen Curry',         team: 'GSW', value: '60.5%', sub: 'Temp. 24/25', flag: '🇺🇸', trend: 'flat' },
            ],
          },
          {
            id: 'nba-mvp-race', title: 'MVP Race · Editorial Taka', metric: 'Pos.',
            rows: [
              { rank: 1, name: 'Shai Gilgeous-Alexander', team: 'OKC', value: '#1', sub: '32.7 PPG · 64-18', flag: '🇨🇦', trend: 'up' },
              { rank: 2, name: 'Nikola Jokić',          team: 'DEN', value: '#2', sub: 'Triples-dobles', flag: '🇷🇸', trend: 'flat' },
              { rank: 3, name: 'Giannis Antetokounmpo', team: 'MIL', value: '#3', sub: '30.4 PPG · 11.9 RPG', flag: '🇬🇷', trend: 'flat' },
              { rank: 4, name: 'Jayson Tatum',          team: 'BOS', value: '#4', sub: 'Líder Este', flag: '🇺🇸', trend: 'up' },
              { rank: 5, name: 'Anthony Edwards',       team: 'MIN', value: '#5', sub: '27.6 PPG', flag: '🇺🇸', trend: 'up' },
            ],
          },
          {
            id: 'nba-dpoy-race', title: 'DPOY Race · Editorial Taka', metric: 'Pos.',
            rows: [
              { rank: 1, name: 'Cargando…', value: '—', sub: 'Auto desde NBA.com', trend: 'flat' },
            ],
          },
          {
            id: 'nba-rookie-race', title: 'Rookie of the Year Race', metric: 'Pos.',
            rows: [
              { rank: 1, name: 'Stephon Castle',     team: 'SAS', value: '#1', sub: '14.7 PPG · 4.1 APG',  flag: '🇺🇸', trend: 'up' },
              { rank: 2, name: 'Jaylen Wells',       team: 'MEM', value: '#2', sub: '10.4 PPG',            flag: '🇺🇸', trend: 'flat' },
              { rank: 3, name: 'Zach Edey',          team: 'MEM', value: '#3', sub: '9.2 PPG · 6.2 RPG',   flag: '🇨🇦', trend: 'up' },
              { rank: 4, name: 'Zaccharie Risacher', team: 'ATL', value: '#4', sub: '12.6 PPG',            flag: '🇫🇷', trend: 'flat' },
              { rank: 5, name: 'Alex Sarr',          team: 'WAS', value: '#5', sub: '13.0 PPG · 6.5 RPG',  flag: '🇫🇷', trend: 'up' },
            ],
          },
          {
            id: 'nba-steals', title: 'Robos (SPG)', metric: 'SPG',
            rows: [
              { rank: 1, name: 'De\'Aaron Fox',   team: 'SAC', value: '1.8', sub: 'Temp. 24/25', flag: '🇺🇸', trend: 'up' },
              { rank: 2, name: 'OG Anunoby',      team: 'NYK', value: '1.5', sub: 'Temp. 24/25', flag: '🇨🇦', trend: 'up' },
              { rank: 3, name: 'Dyson Daniels',   team: 'ATL', value: '1.5', sub: 'Temp. 24/25', flag: '🇦🇺', trend: 'up' },
              { rank: 4, name: 'Jalen Suggs',     team: 'ORL', value: '1.4', sub: 'Temp. 24/25', flag: '🇺🇸', trend: 'flat' },
              { rank: 5, name: 'Alex Caruso',     team: 'OKC', value: '1.4', sub: 'Temp. 24/25', flag: '🇺🇸', trend: 'flat' },
            ],
          },
          {
            id: 'nba-3pt', title: 'Triples anotados (3PM)', metric: '3PM',
            rows: [
              { rank: 1, name: 'Stephen Curry',   team: 'GSW', value: '4.8', sub: 'Temp. 24/25', flag: '🇺🇸', trend: 'up' },
              { rank: 2, name: 'Trae Young',      team: 'ATL', value: '4.3', sub: 'Temp. 24/25', flag: '🇺🇸', trend: 'up' },
              { rank: 3, name: 'Luka Dončić',     team: 'LAL', value: '4.1', sub: 'Temp. 24/25', flag: '🇸🇮', trend: 'flat' },
              { rank: 4, name: 'Damian Lillard',  team: 'MIL', value: '3.9', sub: 'Temp. 24/25', flag: '🇺🇸', trend: 'flat' },
              { rank: 5, name: 'Donovan Mitchell',team: 'CLE', value: '3.7', sub: 'Temp. 24/25', flag: '🇺🇸', trend: 'up' },
            ],
          },
        ],
      },
      {
        id: 'equipos', label: 'Equipos', icon: '🏟️',
        blocks: [
          {
            id: 'nba-este', title: 'Conferencia Este', metric: 'W-L',
            rows: [
              { rank: 1, name: 'Detroit Pistons',    value: '60-22', sub: '1º Este',  trend: 'up',   extra: { Racha: '—', Pts: '—' } },
              { rank: 2, name: 'Boston Celtics',    value: '56-26', sub: '2º Este',  trend: 'flat', extra: { Racha: '—', Pts: '—' } },
              { rank: 3, name: 'New York Knicks',   value: '53-29', sub: '3º Este',  trend: 'up',   extra: { Racha: '—', Pts: '—' } },
              { rank: 4, name: 'Cleveland Cavaliers',value: '52-30', sub: '4º Este', trend: 'flat', extra: { Racha: '—', Pts: '—' } },
              { rank: 5, name: 'Toronto Raptors',   value: '46-36', sub: '5º Este',  trend: 'flat', extra: { Racha: '—', Pts: '—' } },
              { rank: 6, name: 'Atlanta Hawks',     value: '46-36', sub: '6º Este',  trend: 'flat', extra: { Racha: '—', Pts: '—' } },
            ],
          },
          {
            id: 'nba-oeste', title: 'Conferencia Oeste', metric: 'W-L',
            rows: [
              { rank: 1, name: 'OKC Thunder',            value: '64-18', sub: '1º Oeste', trend: 'up',   extra: { Racha: '—', Pts: '—' } },
              { rank: 2, name: 'San Antonio Spurs',   value: '62-20', sub: '2º Oeste', trend: 'up',   extra: { Racha: '—', Pts: '—' } },
              { rank: 3, name: 'Denver Nuggets',      value: '54-28', sub: '3º Oeste', trend: 'flat', extra: { Racha: '—', Pts: '—' } },
              { rank: 4, name: 'Los Angeles Lakers',  value: '53-29', sub: '4º Oeste', trend: 'flat', extra: { Racha: '—', Pts: '—' } },
              { rank: 5, name: 'Houston Rockets',     value: '52-30', sub: '5º Oeste', trend: 'flat', extra: { Racha: '—', Pts: '—' } },
              { rank: 6, name: 'Minnesota Timberwolves', value: '49-33', sub: '6º Oeste', trend: 'flat', extra: { Racha: '—', Pts: '—' } },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'formula1', label: 'F1', emoji: '🏎️', accent: '#ef4444',
    sections: [
      {
        id: 'pilotos', label: 'Pilotos', icon: '🧑‍✈️',
        blocks: [
          {
            id: 'f1-campeonato', title: 'Campeonato de Pilotos', metric: 'Pts',
            rows: [
              { rank: 1, name: 'Kimi Antonelli',  team: 'Mercedes',  value: '100', sub: 'Temp. 2026 · R4', flag: '🇮🇹', trend: 'up',   extra: { Vic: '1', Podios: '4' } },
              { rank: 2, name: 'George Russell',  team: 'Mercedes',  value: '80',  sub: 'Temp. 2026 · R4', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'up',   extra: { Vic: '1', Podios: '3' } },
              { rank: 3, name: 'Charles Leclerc', team: 'Ferrari',   value: '59',  sub: 'Temp. 2026 · R4', flag: '🇲🇨', trend: 'flat', extra: { Vic: '0', Podios: '2' } },
              { rank: 4, name: 'Lando Norris',    team: 'McLaren',   value: '51',  sub: 'Temp. 2026 · R4', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'flat', extra: { Vic: '0', Podios: '2' } },
              { rank: 5, name: 'Lewis Hamilton',  team: 'Ferrari',   value: '51',  sub: 'Temp. 2026 · R4', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'up',   extra: { Vic: '0', Podios: '2' } },
              { rank: 6, name: 'Oscar Piastri',   team: 'McLaren',   value: '43',  sub: 'Temp. 2026 · R4', flag: '🇦🇺', trend: 'flat', extra: { Vic: '0', Podios: '1' } },
              { rank: 7, name: 'Max Verstappen',  team: 'Red Bull',  value: '26',  sub: 'Temp. 2026 · R4', flag: '🇳🇱', trend: 'down', extra: { Vic: '0', Podios: '1' } },
            ],
          },
          {
            id: 'f1-poles', title: 'Poles position', metric: 'Poles',
            rows: [
              { rank: 1, name: 'Kimi Antonelli',  team: 'Mercedes',  value: '2', sub: 'Temp. 2026 · R4', flag: '🇮🇹', trend: 'up' },
              { rank: 2, name: 'George Russell',  team: 'Mercedes',  value: '1', sub: 'Temp. 2026 · R4', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'flat' },
              { rank: 3, name: 'Max Verstappen',  team: 'Red Bull',  value: '1', sub: 'Temp. 2026 · R4', flag: '🇳🇱', trend: 'flat' },
            ],
          },
        ],
      },
      {
        id: 'calendario-f1', label: 'Calendario', icon: '📅',
        blocks: [{
          id: 'f1-calendario', title: 'Próximos GP · Temporada 2026', metric: 'Fecha',
          rows: [{ rank: 1, name: 'Cargando…', value: '—', sub: 'Jolpica · calendario', trend: 'flat' as const }],
        }],
      },
      {
        id: 'sprints-f1', label: 'Sprints', icon: '⚡',
        blocks: [{
          id: 'f1-sprints', title: 'Sprint Wins · Temporada 2026', metric: 'Vic',
          rows: [{ rank: 1, name: 'Cargando…', value: '—', sub: 'Jolpica · sprints temp.', trend: 'flat' as const }],
        }],
      },
      {
        id: 'constructores', label: 'Constructores', icon: '🏗️',
        blocks: [
          {
            id: 'f1-constructores', title: 'Campeonato de Constructores', metric: 'Pts',
            rows: [
              { rank: 1, name: 'Mercedes',        value: '180', sub: 'Temp. 2026 · R4', trend: 'up' },
              { rank: 2, name: 'Ferrari',         value: '110', sub: 'Temp. 2026 · R4', trend: 'flat' },
              { rank: 3, name: 'McLaren',         value: '94',  sub: 'Temp. 2026 · R4', trend: 'up' },
              { rank: 4, name: 'Red Bull Racing', value: '30',  sub: 'Temp. 2026 · R4', trend: 'down' },
              { rank: 5, name: 'Alpine',          value: '23',  sub: 'Temp. 2026 · R4', trend: 'up' },
              { rank: 6, name: 'Haas F1 Team',    value: '18',  sub: 'Temp. 2026 · R4', trend: 'flat' },
              { rank: 7, name: 'RB F1 Team',      value: '14',  sub: 'Temp. 2026 · R4', trend: 'flat' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'tenis', label: 'Tenis', emoji: '🎾', accent: '#d97706',
    sections: [
      {
        id: 'atp', label: 'ATP', icon: '👨',
        blocks: [
          {
            id: 'atp-ranking', title: 'Ranking ATP (Top 10)', metric: 'Pts',
            rows: [
              { rank: 1, name: 'Jannik Sinner',           value: '14350', sub: '2 Grand Slams',  flag: '🇮🇹', trend: 'up',   extra: { GS: '2',  Torneos: '9' } },
              { rank: 2, name: 'Carlos Alcaraz',          value: '12960', sub: '4 Grand Slams',  flag: '🇪🇸', trend: 'flat', extra: { GS: '4',  Torneos: '7' } },
              { rank: 3, name: 'Alexander Zverev',        value: '5805',  sub: '0 Grand Slams',  flag: '🇩🇪', trend: 'up',   extra: { GS: '0',  Torneos: '6' } },
              { rank: 4, name: 'Novak Djokovic',          value: '4700',  sub: '24 Grand Slams', flag: '🇷🇸', trend: 'down', extra: { GS: '24', Torneos: '3' } },
              { rank: 5, name: 'Felix Auger-Aliassime',   value: '4050',  sub: '0 Grand Slams',  flag: '🇨🇦', trend: 'up',   extra: { GS: '0',  Torneos: '4' } },
              { rank: 6, name: 'Ben Shelton',             value: '4030',  sub: '0 Grand Slams',  flag: '🇺🇸', trend: 'up',   extra: { GS: '0',  Torneos: '5' } },
              { rank: 7, name: 'Taylor Fritz',            value: '3770',  sub: '0 Grand Slams',  flag: '🇺🇸', trend: 'flat', extra: { GS: '0',  Torneos: '4' } },
            ],
          },
        ],
      },
      {
        id: 'wta', label: 'WTA', icon: '👩',
        blocks: [
          {
            id: 'wta-ranking', title: 'Ranking WTA (Top 10)', metric: 'Pts',
            rows: [
              { rank: 1, name: 'Aryna Sabalenka', value: '10110', sub: '3 Grand Slams', flag: '🇧🇾', trend: 'flat', extra: { GS: '3', Torneos: '7' } },
              { rank: 2, name: 'Elena Rybakina',  value: '8555',  sub: '1 Grand Slam',  flag: '🇰🇿', trend: 'up',   extra: { GS: '1', Torneos: '5' } },
              { rank: 3, name: 'Iga Swiatek',     value: '6948',  sub: '5 Grand Slams', flag: '🇵🇱', trend: 'down', extra: { GS: '5', Torneos: '4' } },
              { rank: 4, name: 'Coco Gauff',      value: '6749',  sub: '1 Grand Slam',  flag: '🇺🇸', trend: 'flat', extra: { GS: '1', Torneos: '5' } },
              { rank: 5, name: 'Jessica Pegula',  value: '6136',  sub: '0 Grand Slams', flag: '🇺🇸', trend: 'up',   extra: { GS: '0', Torneos: '4' } },
              { rank: 6, name: 'Amanda Anisimova',value: '5985',  sub: '0 Grand Slams', flag: '🇺🇸', trend: 'up',   extra: { GS: '0', Torneos: '4' } },
              { rank: 7, name: 'Mirra Andreeva',  value: '4181',  sub: '0 Grand Slams', flag: '🇷🇺', trend: 'up',   extra: { GS: '0', Torneos: '3' } },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'ufc', label: 'UFC', emoji: '🥊', accent: '#f97316',
    sections: [
      {
        id: 'ranking-ufc', label: 'Top general', icon: '🏆',
        blocks: [
          {
            id: 'ufc-p4p', title: 'Pound for Pound (Top 10)', metric: 'Pos.',
            rows: [{ rank: 1, name: 'Cargando…', value: '—', sub: 'ufc.com', trend: 'flat' as const }],
          },
          {
            id: 'ufc-campeones', title: 'Campeones actuales por división', metric: 'División',
            rows: [{ rank: 1, name: 'Cargando…', value: '—', sub: 'ufc.com', trend: 'flat' as const }],
          },
        ],
      },
      {
        id: 'pesos-masc', label: 'Pesos masculinos', icon: '🥊',
        blocks: [
          { id: 'ufc-hw',  title: 'Peso pesado · Top 5',  metric: 'Pos.', rows: [{ rank: 1, name: 'Cargando…', value: '—', sub: 'ufc.com', trend: 'flat' as const }] },
          { id: 'ufc-lhw', title: 'Semipesado · Top 5',   metric: 'Pos.', rows: [{ rank: 1, name: 'Cargando…', value: '—', sub: 'ufc.com', trend: 'flat' as const }] },
          { id: 'ufc-mw',  title: 'Peso medio · Top 5',   metric: 'Pos.', rows: [{ rank: 1, name: 'Cargando…', value: '—', sub: 'ufc.com', trend: 'flat' as const }] },
          { id: 'ufc-ww',  title: 'Wélter · Top 5',       metric: 'Pos.', rows: [{ rank: 1, name: 'Cargando…', value: '—', sub: 'ufc.com', trend: 'flat' as const }] },
          { id: 'ufc-lw',  title: 'Ligero · Top 5',       metric: 'Pos.', rows: [{ rank: 1, name: 'Cargando…', value: '—', sub: 'ufc.com', trend: 'flat' as const }] },
          { id: 'ufc-fw',  title: 'Pluma · Top 5',        metric: 'Pos.', rows: [{ rank: 1, name: 'Cargando…', value: '—', sub: 'ufc.com', trend: 'flat' as const }] },
          { id: 'ufc-bw',  title: 'Gallo · Top 5',        metric: 'Pos.', rows: [{ rank: 1, name: 'Cargando…', value: '—', sub: 'ufc.com', trend: 'flat' as const }] },
          { id: 'ufc-flw', title: 'Mosca · Top 5',        metric: 'Pos.', rows: [{ rank: 1, name: 'Cargando…', value: '—', sub: 'ufc.com', trend: 'flat' as const }] },
        ],
      },
      {
        id: 'pesos-fem', label: 'Pesos femeninos', icon: '🥊',
        blocks: [
          { id: 'ufc-w-bw',  title: 'Gallo · Top 5',  metric: 'Pos.', rows: [{ rank: 1, name: 'Cargando…', value: '—', sub: 'ufc.com', trend: 'flat' as const }] },
          { id: 'ufc-w-flw', title: 'Mosca · Top 5',  metric: 'Pos.', rows: [{ rank: 1, name: 'Cargando…', value: '—', sub: 'ufc.com', trend: 'flat' as const }] },
          { id: 'ufc-w-stw', title: 'Paja · Top 5',   metric: 'Pos.', rows: [{ rank: 1, name: 'Cargando…', value: '—', sub: 'ufc.com', trend: 'flat' as const }] },
        ],
      },
    ],
  },
  {
    id: 'motogp', label: 'MotoGP', emoji: '🏍️', accent: '#dc2626',
    sections: [
      {
        id: 'pilotos-motogp', label: 'Pilotos', icon: '🧑‍✈️',
        blocks: [{
          id: 'motogp-pilotos', title: 'Campeonato MotoGP', metric: 'Pts',
          rows: [{ rank: 1, name: 'Cargando…', value: '—', sub: 'motogp.com (cron lunes)', trend: 'flat' as const }],
        }],
      },
      {
        id: 'constructores-motogp', label: 'Constructores', icon: '🏗️',
        blocks: [{
          id: 'motogp-constructores', title: 'Campeonato Constructores', metric: 'Pts',
          rows: [{ rank: 1, name: 'Cargando…', value: '—', sub: 'motogp.com (cron lunes)', trend: 'flat' as const }],
        }],
      },
    ],
  },
]

const SECTION_BLOCK_COUNT = new Map(
  SPORTS.flatMap(s => s.sections.map(sec => [
    `${s.id}:${sec.id}`,
    sec.groups ? sec.groups.reduce((a, g) => a + g.blocks.length, 0) : (sec.blocks?.length ?? 0),
  ]))
)

// ─────────────────────────────────────────────────────────────────
// COMPONENTES UI
// ─────────────────────────────────────────────────────────────────
// Tendencia honesta: solo flecha cuando el dato lo justifica
// (la sparkline anterior usaba seededRng — pseudoaleatoria, engañosa).
function TrendArrow({ trend }: { trend?: 'up' | 'down' | 'flat' }) {
  if (!trend || trend === 'flat') return <span className="inline-block w-4" aria-hidden />
  const color = trend === 'up' ? '#4ade80' : '#f87171'
  const arrow = trend === 'up' ? '▲' : '▼'
  return (
    <span className="inline-block text-[10px] font-black w-4 text-center leading-none"
      style={{ color }}
      aria-label={trend === 'up' ? 'Tendencia al alza' : 'Tendencia a la baja'}>
      {arrow}
    </span>
  )
}

function MedalBadge({ rank }: { rank: number }) {
  if (rank <= 3) return <PodiumMedal position={rank} size={18} />
  return (
    <span className="font-black tabular-nums text-xs w-5 text-center" style={{ color: '#3A3A52', fontFamily: 'var(--font-display)' }}>
      {rank}
    </span>
  )
}

function PlaceholderBlockCard({ block, accent }: { block: StatBlock; accent: string }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', opacity: 0.7 }}>
      <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2.5">
          <span className="section-accent" style={{ background: accent, opacity: 0.4 }} />
          <h3 className="font-black text-sm" style={{ color: '#6060A0', fontFamily: 'var(--font-display)' }}>
            {block.title}
          </h3>
          <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded"
            style={{ background: 'rgba(124,58,237,0.12)', color: '#7C6EBA', border: '1px solid rgba(124,58,237,0.25)', fontFamily: 'var(--font-sport)' }}>
            PRÓXIMAMENTE
          </span>
        </div>
        <span className="text-[10px] font-black" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>{block.metric}</span>
      </div>
      <div className="px-5 py-8 flex flex-col items-center gap-2">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-lg"
          style={{ background: `${accent}10`, border: `1px solid ${accent}20` }}>
          🔒
        </div>
        <p className="text-xs text-center" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>
          Integración de datos en desarrollo
        </p>
      </div>
    </div>
  )
}

function formatFetchedAt(iso?: string): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short', timeZone: 'Europe/Madrid' })
  } catch { return '' }
}

function BlockJsonLd({ block, rows, isLive }: { block: StatBlock; rows: StatRow[]; isLive?: boolean }) {
  // Emit a structured ItemList per stats block so search engines can parse rankings.
  // Solo para bloques realmente EN VIVO: no inyectamos a Google rankings obsoletos
  // ni el fallback hardcodeado (no mentir / evita rich-results incorrectos).
  if (!isLive || !rows.length || block.placeholder) return null
  const json = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: block.title,
    numberOfItems: rows.length,
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    itemListElement: rows.slice(0, 10).map(r => ({
      '@type': 'ListItem',
      position: r.rank,
      name: `${r.name}${r.team ? ` (${r.team})` : ''}`,
    })),
  }
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />
}

function FreshnessBadge({ isLive, meta }: { isLive?: boolean; meta?: BlockMeta }) {
  // Priority: 1) live → green  2) stale → amber  3) historical → grey  4) unavailable → red  5) no info → nothing
  const base = 'text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded'
  const fetchedAt = formatFetchedAt(meta?.fetchedAt)
  const sourceTitle = meta?.source ? `Fuente: ${meta.source}${fetchedAt ? ` · Actualizado ${fetchedAt}` : ''}` : ''
  if (isLive) {
    return (
      <span className={base} title={sourceTitle || 'Datos en vivo'}
        role="status"
        aria-label={`Datos en vivo${meta?.source ? ` desde ${meta.source}` : ''}${fetchedAt ? `, actualizados ${fetchedAt}` : ''}`}
        style={{ background: 'rgba(74,222,128,0.14)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.32)', fontFamily: 'var(--font-sport)' }}>
        ● LIVE
      </span>
    )
  }
  if (meta?.status === 'stale') {
    return (
      <span className={base} title={sourceTitle}
        role="status"
        aria-label={`Datos del día${meta.asOf ? `, ${meta.asOf}` : ''}${fetchedAt ? `, actualizados ${fetchedAt}` : ''}`}
        style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.30)', fontFamily: 'var(--font-sport)' }}>
        Hoy · {meta.asOf ?? '—'}
      </span>
    )
  }
  if (meta?.status === 'historical') {
    return (
      <span className={base} title={sourceTitle}
        role="status"
        aria-label={`Datos históricos${meta.asOf ? ` ${meta.asOf}` : ''}${meta.source ? ` desde ${meta.source}` : ''}`}
        style={{ background: 'rgba(148,163,184,0.10)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.25)', fontFamily: 'var(--font-sport)' }}>
        Hist · {meta.asOf ?? '—'}
      </span>
    )
  }
  if (meta?.status === 'unavailable') {
    return (
      <span className={base} title={sourceTitle || meta.source}
        role="status"
        aria-label={`Datos no disponibles${meta.source ? ` (${meta.source})` : ''}`}
        style={{ background: 'rgba(248,113,113,0.10)', color: '#f87171', border: '1px solid rgba(248,113,113,0.28)', fontFamily: 'var(--font-sport)' }}>
        No disponible
      </span>
    )
  }
  return null
}

const WC_START = new Date('2026-06-11T17:00:00Z')

function WorldCupCountdown() {
  // now arranca en null para que SSR y el primer render de cliente coincidan
  // (placeholder "--"); los dígitos reales aparecen tras montar. Evita #418.
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const diff = now ? WC_START.getTime() - now.getTime() : 1
  if (diff <= 0) return (
    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full"
      style={{ background: 'rgba(34,197,94,0.2)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>
      ● EN CURSO
    </span>
  )
  const days    = Math.floor(diff / 86400000)
  const hours   = Math.floor((diff % 86400000) / 3600000)
  const minutes = Math.floor((diff % 3600000)  / 60000)
  const seconds = Math.floor((diff % 60000)    / 1000)
  return (
    <div className="flex gap-3">
      {([['días', days], ['h', hours], ['min', minutes], ['seg', seconds]] as [string, number][]).map(([l, v]) => (
        <div key={l} className="text-center min-w-[2rem]">
          <div className="text-2xl font-black tabular-nums leading-none"
            style={{ fontFamily: 'var(--font-sport)', color: '#f59e0b' }}>
            {now ? String(v).padStart(2, '0') : '--'}
          </div>
          <div className="text-[9px] uppercase tracking-widest mt-0.5"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
            {l}
          </div>
        </div>
      ))}
    </div>
  )
}

function WorldCupGroupCard({ block, accent, isLive, meta }: {
  block: StatBlock; accent: string; isLive?: boolean; meta?: BlockMeta
}) {
  const wcStarted = block.rows.some(r => r.sub !== 'Sin jugar')
  const WC_COLS = ['PJ', 'V', 'E', 'D', 'GD', 'PTS']

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="px-4 py-3 flex items-center justify-between gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="section-accent" style={{ background: accent }} />
          <h3 className="font-black text-sm" style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
            {block.title}
          </h3>
          <FreshnessBadge isLive={isLive} meta={meta} />
        </div>
        {wcStarted && (
          <span className="text-[10px] font-black uppercase tracking-widest flex-shrink-0" style={{ color: accent, fontFamily: 'var(--font-sport)' }}>PTS</span>
        )}
      </div>

      {wcStarted && (
        <div className="px-4 pt-1.5 pb-1 flex items-center gap-1 text-[9px] font-black uppercase tracking-widest"
          style={{ color: '#4A4A62', fontFamily: 'var(--font-sport)', borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.015)' }}>
          <span className="w-5 flex-shrink-0" />
          <span className="flex-1">Selección</span>
          {/* Mobile: solo PJ, GD, PTS */}
          <span className="w-6 text-center sm:hidden">PJ</span>
          <span className="w-7 text-center sm:hidden">GD</span>
          <span className="w-7 text-center sm:hidden">PTS</span>
          {/* Desktop: las 6 columnas */}
          {WC_COLS.map(col => (
            <span key={col} className="w-6 text-center hidden sm:block">{col}</span>
          ))}
        </div>
      )}

      <div className="flex flex-col">
        {block.rows.map((row, i) => {
          const pj = row.extra?.PJ ?? '0'
          const v  = row.extra?.V  ?? '0'
          const e  = row.extra?.E  ?? '0'
          const d  = row.extra?.D  ?? '0'
          const gf = parseInt(row.extra?.GF ?? '0')
          const gc = parseInt(row.extra?.GC ?? '0')
          const gdNum = gf - gc
          const pts = row.value
          const isPromoted = i < 2

          return (
            <div key={row.rank}
              className="flex items-center gap-1 px-4 py-2.5 transition-colors hover:bg-white/[0.025]"
              style={{
                borderBottom: i < block.rows.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                background: isPromoted ? `${accent}06` : 'transparent',
                borderLeft: isPromoted ? `3px solid ${accent}50` : '3px solid transparent',
              }}>
              <span className="w-5 flex-shrink-0 text-[10px] font-black tabular-nums"
                style={{ color: isPromoted ? accent : '#5A5A72', fontFamily: 'var(--font-sport)' }}>
                {row.rank}
              </span>
              <span className="flex-1 min-w-0 text-[12px] font-semibold truncate" style={{ color: '#E0E0F0', fontFamily: 'var(--font-display)' }}>
                {row.name}
              </span>
              {wcStarted ? (
                <>
                  {/* Mobile: PJ, GD, PTS */}
                  <span className="w-6 text-center text-[11px] tabular-nums font-semibold sm:hidden" style={{ color: '#5A5A82', fontFamily: 'var(--font-display)' }}>{pj}</span>
                  <span className="w-7 text-center text-[11px] tabular-nums font-semibold sm:hidden" style={{ color: '#5A5A82', fontFamily: 'var(--font-display)' }}>{gdNum >= 0 ? '+' : ''}{gdNum}</span>
                  <span className="w-7 text-center text-[11px] tabular-nums font-black sm:hidden" style={{ color: parseInt(pts) > 0 ? accent : '#7A7A92', fontFamily: 'var(--font-display)' }}>{pts}</span>
                  {/* Desktop: 6 columnas */}
                  {[pj, v, e, d, `${gdNum >= 0 ? '+' : ''}${gdNum}`, pts].map((val, j) => (
                    <span key={j} className="w-6 text-center text-[11px] tabular-nums font-semibold hidden sm:block"
                      style={{ color: j === 5 ? (parseInt(pts) > 0 ? accent : '#7A7A92') : '#5A5A82', fontFamily: 'var(--font-display)' }}>
                      {val}
                    </span>
                  ))}
                </>
              ) : (
                <span className="text-[10px]" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>Sin jugar</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PlayoffSeriesCard({ block, accent, isLive, meta }: {
  block: StatBlock; accent: string; isLive?: boolean; meta?: BlockMeta
}) {
  if (block.placeholder) return <PlaceholderBlockCard block={block} accent={accent} />

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="px-5 py-4 flex items-center justify-between gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="section-accent" style={{ background: accent }} />
          <h3 className="font-black text-sm" style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
            {block.title}
          </h3>
          <FreshnessBadge isLive={isLive} meta={meta} />
        </div>
        <span className="text-[11px] font-black uppercase tracking-widest flex-shrink-0" style={{ color: accent, fontFamily: 'var(--font-sport)' }}>
          SERIE
        </span>
      </div>

      <div className="flex flex-col">
        {block.rows.length === 0 && (
          <p className="px-5 py-8 text-center text-[11px]" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>
            Sin partidos de playoffs activos
          </p>
        )}
        {block.rows.map((row, i) => {
          const isActive = row.extra?.Estado === 'En juego'
          const serieText = row.extra?.Serie ?? ''
          return (
            <div key={i}
              className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-white/[0.025]"
              style={{
                borderBottom: i < block.rows.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                background: isActive ? `${accent}06` : 'transparent',
                borderLeft: isActive ? `3px solid ${accent}50` : '3px solid transparent',
              }}>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[13px]" style={{ color: '#E0E0F0', fontFamily: 'var(--font-display)' }}>
                  {row.name}
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: '#7A7A92', fontFamily: 'var(--font-sport)' }}>
                  {serieText}
                </div>
              </div>
              <div className="text-right flex-shrink-0 flex items-center gap-2">
                <div>
                  <div className="font-black text-sm tabular-nums" style={{ color: isActive ? accent : '#8080A0', fontFamily: 'var(--font-display)' }}>
                    {row.value}
                  </div>
                  <div className="text-[10px]" style={{ color: '#5A5A72', fontFamily: 'var(--font-sport)' }}>
                    {row.sub}
                  </div>
                </div>
                {isActive && (
                  <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)', fontFamily: 'var(--font-sport)' }}>
                    LIVE
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StatBlockCard({ block, accent, expanded, onToggle, leagueFilter, isLive, meta, isFav, onToggleFav }: {
  block: StatBlock; accent: string; expanded: boolean; onToggle: () => void; leagueFilter?: string; isLive?: boolean; meta?: BlockMeta
  isFav?: boolean; onToggleFav?: () => void
}) {
  if (block.placeholder) return <PlaceholderBlockCard block={block} accent={accent} />

  const teamLeague = React.useContext(TeamLeagueContext)
  const filteredRows = leagueFilter && leagueFilter !== 'General'
    ? block.rows.filter(r => teamLeague[r.team ?? ''] === leagueFilter)
    : block.rows
  const displayRows = expanded ? filteredRows : filteredRows.slice(0, 5)
  const hasExtra = filteredRows[0]?.extra && Object.keys(filteredRows[0].extra).length > 0
  const extraKeys = hasExtra ? Object.keys(filteredRows[0]!.extra!) : []

  const onShare = async () => {
    const url = typeof window !== 'undefined' ? `${window.location.origin}/estadisticas#${block.id}` : `#${block.id}`
    const top = displayRows.slice(0, 3).map(r => `${r.rank}. ${r.name}${r.team ? ` (${r.team})` : ''} — ${r.value}`).join('\n')
    const text = `${block.title}\n${top}\n\nVía TakaSports`
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: block.title, text, url })
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(`${text}\n${url}`)
      }
    } catch { /* user cancelled */ }
  }

  return (
    <section id={block.id} aria-labelledby={`${block.id}-title`} className="rounded-2xl overflow-hidden scroll-mt-24" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="px-5 py-4 flex items-center justify-between gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2.5 flex-wrap min-w-0">
          <span className="section-accent" style={{ background: accent }} />
          <h3 id={`${block.id}-title`} className="font-black text-sm truncate" style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
            <a href={`#${block.id}`} className="hover:underline focus:underline outline-none" aria-label={`Enlazar a ${block.title}`}>{block.title}</a>
          </h3>
          <FreshnessBadge isLive={isLive} meta={meta} />
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onToggleFav && (
            <button onClick={onToggleFav} aria-label={isFav ? 'Quitar de favoritos' : 'Añadir a favoritos'}
              className="text-[13px] leading-none px-1.5 py-1 rounded transition-opacity hover:opacity-80"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: isFav ? '#fbbf24' : '#3A3A52' }}>
              {isFav ? '★' : '☆'}
            </button>
          )}
          <button onClick={onShare} aria-label="Compartir bloque"
            className="text-[12px] leading-none px-1.5 py-1 rounded transition-opacity hover:opacity-80"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#5A5A72' }}>
            ⤴
          </button>
          <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: accent, fontFamily: 'var(--font-sport)' }}>
            {block.metric}
          </span>
        </div>
      </div>

      <div className="px-5 pt-2 pb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
        style={{ color: '#5A5A72', fontFamily: 'var(--font-sport)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <span className="w-8 flex-shrink-0">#</span>
        <span className="flex-1">Nombre</span>
        {extraKeys.slice(0, 2).map(k => (
          <span key={k} className="hidden lg:block w-14 text-right">{k}</span>
        ))}
        <span className="w-14 text-right">{block.metric}</span>
        <span className="w-5 flex-shrink-0" />
      </div>

      <div className="flex flex-col">
        {displayRows.length === 0 && (
          <div className="px-5 py-6 text-center" style={{ color: '#5A5A72', fontFamily: 'var(--font-sport)' }}>
            <p className="text-[12px] font-semibold mb-1">
              {meta?.status === 'unavailable'
                ? 'Datos no disponibles ahora'
                : leagueFilter && leagueFilter !== 'General'
                ? `Sin datos para ${leagueFilter}`
                : 'Sin datos disponibles'}
            </p>
            {meta?.fetchedAt && (
              <p className="text-[10px]" style={{ color: '#3A3A52' }}>
                Última comprobación: {formatFetchedAt(meta.fetchedAt)}
              </p>
            )}
            {meta?.source && (
              <p className="text-[10px] mt-0.5" style={{ color: '#3A3A52' }}>{meta.source}</p>
            )}
          </div>
        )}
        {displayRows.map((row, i) => (
          <div key={row.rank}
            className="flex items-center gap-2 px-5 py-2.5 transition-colors hover:bg-white/[0.025]"
            style={{
              borderBottom: i < displayRows.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
              background: row.rank <= 3 ? `linear-gradient(to right, ${accent}06 0%, transparent 100%)` : 'transparent',
              borderLeft: row.rank <= 3 ? `3px solid ${accent}50` : '3px solid transparent',
            }}
          >
            <div className="w-8 flex-shrink-0 flex items-center"><MedalBadge rank={row.rank} /></div>
            {row.logo && (
              <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
                <Image src={row.logo} alt={row.name} width={26} height={26} unoptimized
                  style={{ objectFit: 'contain', width: 26, height: 26 }} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                {row.flag && <span className="text-xs leading-none flex-shrink-0">{row.flag}</span>}
                {row.href ? (
                  <Link href={row.href}
                    className="font-semibold text-[13px] truncate hover:underline focus:underline outline-none"
                    style={{ color: '#E0E0F0', fontFamily: 'var(--font-display)' }}>
                    {row.name}
                  </Link>
                ) : (
                  <span className="font-semibold text-[13px] truncate" style={{ color: '#E0E0F0', fontFamily: 'var(--font-display)' }}>
                    {row.name}
                  </span>
                )}
              </div>
              {(row.team || row.sub) && (
                <span className="block text-[11px] truncate" style={{ color: '#7A7A92', fontFamily: 'var(--font-sport)' }}>
                  {row.team}{row.team && row.sub ? ' · ' : ''}{row.sub}
                </span>
              )}
            </div>
            {extraKeys.slice(0, 2).map(k => (
              <span key={k} className="hidden lg:block w-14 text-right text-[11px] tabular-nums font-semibold"
                style={{ color: '#6060A0', fontFamily: 'var(--font-display)' }}>
                {row.extra?.[k] ?? '—'}
              </span>
            ))}
            <span className="w-14 text-right font-black tabular-nums"
              style={{ color: row.rank <= 3 ? accent : '#8080A0', fontFamily: 'var(--font-display)', fontSize: row.rank === 1 ? 16 : 14 }}>
              {row.value}
            </span>
            <div className="w-5 flex-shrink-0 flex items-center justify-end">
              <TrendArrow trend={row.trend} />
            </div>
          </div>
        ))}
      </div>

      {filteredRows.length > 5 && (
        <button onClick={onToggle}
          className="w-full px-5 py-3 text-[10px] font-black uppercase tracking-widest transition-opacity hover:opacity-70"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)', color: accent, fontFamily: 'var(--font-sport)', background: 'none', cursor: 'pointer' }}>
          {expanded ? 'Ver menos ↑' : `Ver todos (${filteredRows.length}) ↓`}
        </button>
      )}
      <BlockJsonLd block={block} rows={displayRows} isLive={isLive} />
    </section>
  )
}

function MetricGroupAccordion({ group, accent, expanded, onToggle, expandedBlocks, onToggleBlock, leagueFilter, livePlayerData, liveMeta, favorites, onToggleFav, hideUnavailable }: {
  group: MetricGroup
  accent: string
  expanded: boolean
  onToggle: () => void
  expandedBlocks: Record<string, boolean>
  onToggleBlock: (id: string) => void
  leagueFilter?: string
  livePlayerData?: LivePlayerData | null
  liveMeta?: Record<string, BlockMeta>
  favorites?: Set<string>
  onToggleFav?: (id: string) => void
  hideUnavailable?: boolean
}) {
  // Hide pure placeholder blocks (no live data injected, no rows).
  // When hideUnavailable is on, also drop blocks whose meta says 'unavailable'.
  const visibleBlocks = group.blocks.filter(b => {
    if (b.placeholder && b.rows.length === 0) return false
    if (hideUnavailable) {
      const m = getBlockMeta(b.id, liveMeta)
      if (m?.status === 'unavailable') return false
    }
    return true
  })

  if (visibleBlocks.length === 0) return null

  // Apply live player data to group blocks, preserving isLive per block
  const liveVisibleBlocks = visibleBlocks.map(b => {
    if (livePlayerData && LIVE_PLAYER_BLOCK_IDS.has(b.id)) {
      return applyLivePlayerToBlock(b, livePlayerData, leagueFilter)
    }
    return { block: b, isLive: false }
  })

  const dataCount = liveVisibleBlocks.filter(({ block: b }) => !b.placeholder).length
  const soonCount = liveVisibleBlocks.filter(({ block: b }) => b.placeholder).length
  const liveCount = liveVisibleBlocks.filter(({ isLive }) => isLive).length

  return (
    <div className="mb-3">
      <button onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all hover:brightness-110"
        style={{ background: expanded ? `${accent}10` : 'rgba(255,255,255,0.03)', border: expanded ? `1px solid ${accent}30` : '1px solid rgba(255,255,255,0.07)', cursor: 'pointer' }}>
        <div className="flex items-center gap-3">
          <span className="text-lg leading-none">{group.icon}</span>
          <div className="text-left">
            <p className="text-xs font-black uppercase tracking-widest" style={{ color: expanded ? accent : '#9090B0', fontFamily: 'var(--font-sport)' }}>
              {group.label}
            </p>
            {group.description && (
              <p className="text-[10px] mt-0.5 hidden sm:block" style={{ color: '#4A4A62', fontFamily: 'var(--font-sport)' }}>
                {group.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {liveCount > 0 && (
            <span className="text-[8px] font-black px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)', fontFamily: 'var(--font-sport)' }}>
              {liveCount} live
            </span>
          )}
          {dataCount - liveCount > 0 && (
            <span className="text-[8px] font-black px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#5A5A72', border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'var(--font-sport)' }}>
              {dataCount - liveCount} tabla{dataCount - liveCount !== 1 ? 's' : ''}
            </span>
          )}
          {soonCount > 0 && (
            <span className="text-[8px] font-black px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(124,58,237,0.1)', color: '#7C6EBA', border: '1px solid rgba(124,58,237,0.2)', fontFamily: 'var(--font-sport)' }}>
              +{soonCount} prox.
            </span>
          )}
          <span className="font-black text-xs" style={{ color: expanded ? accent : '#4A4A6A' }}>
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {liveVisibleBlocks.map(({ block, isLive }) => (
            <StatBlockBoundary key={block.id} blockId={block.id}>
              <StatBlockCard
                block={block}
                accent={accent}
                expanded={!!expandedBlocks[block.id]}
                onToggle={() => onToggleBlock(block.id)}
                leagueFilter={leagueFilter}
                isLive={isLive}
                meta={getBlockMeta(block.id, liveMeta)}
                isFav={favorites?.has(block.id)}
                onToggleFav={onToggleFav ? () => onToggleFav(block.id) : undefined}
              />
            </StatBlockBoundary>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────
// IDs of blocks that get replaced with live standings/ESPN data
const LIVE_BLOCK_IDS = new Set([
  'tabla-laliga', 'tabla-premier', 'tabla-serie-a', 'tabla-bundesliga', 'tabla-ligue1', 'tabla-ucl', 'tabla-uel',
  'nba-este', 'nba-oeste',
  'f1-campeonato', 'f1-constructores', 'f1-poles', 'f1-calendario', 'f1-sprints',
  'atp-ranking', 'wta-ranking',
  'goles-equipo', 'menos-goles',
  'ranking-fifa',
  'ufc-p4p', 'ufc-campeones',
  'ufc-hw', 'ufc-lhw', 'ufc-mw', 'ufc-ww', 'ufc-lw', 'ufc-fw', 'ufc-bw', 'ufc-flw',
  'ufc-w-bw', 'ufc-w-flw', 'ufc-w-stw',
  'nba-scoring', 'nba-rebounds', 'nba-assists', 'nba-blocks', 'nba-steals', 'nba-efficiency', 'nba-3pt',
  'nba-mvp-race', 'nba-dpoy-race', 'nba-rookie-race',
  'ucl-scorers', 'uel-scorers', 'ucl-assists', 'uel-assists',
  'f-ligaf-tabla', 'f-goleadoras', 'f-asistencias',
  'stats-dt',
  // World Cup 2026 — grupos A-L + goleadores
  'wc-group-a', 'wc-group-b', 'wc-group-c', 'wc-group-d',
  'wc-group-e', 'wc-group-f', 'wc-group-g', 'wc-group-h',
  'wc-group-i', 'wc-group-j', 'wc-group-k', 'wc-group-l',
  'wc-knockout',
  'wc-qualified',
  'wc-schedule',
  'wc-scorers',
  'wc-assists',
  // Snapshots auto-actualizados (cron Vercel)
  'motogp-pilotos', 'motogp-constructores',
  'tenis-slams',
])

interface LiveStandingRow {
  rank: number; name: string; abbr: string; value: string; sub: string
  trend?: 'up' | 'down' | 'flat'; extra: Record<string, string>
  flag?: string
  teamId?: string
  logo?: string
}
interface LiveLeague { id: string; label: string; rows: LiveStandingRow[]; leagueSlug?: string }
type FreshnessStatus = 'live' | 'stale' | 'historical' | 'unavailable'
interface BlockMeta { status: FreshnessStatus; source: string; fetchedAt: string; asOf?: string }
interface LiveStandingsData {
  football: LiveLeague[]
  f1Drivers: LiveStandingRow[]; f1Constructors: LiveStandingRow[]
  f1Poles: LiveStandingRow[]
  nbaEast: LiveStandingRow[];   nbaWest: LiveStandingRow[]
  nbaScoring: LiveStandingRow[];nbaRebounds: LiveStandingRow[]
  nbaAssists: LiveStandingRow[];nbaBlocks: LiveStandingRow[]
  nbaSteals: LiveStandingRow[]; nbaEfficiency: LiveStandingRow[]
  nba3ptMade: LiveStandingRow[]
  atpRanking: LiveStandingRow[]; wtaRanking: LiveStandingRow[]
  fifaRanking: LiveStandingRow[]
  ufcP4P: LiveStandingRow[]
  ufcChampions?: LiveStandingRow[]
  ufcDivisions?: Record<string, LiveStandingRow[]>
  womenLigaF: LiveStandingRow[]
  womenGoals: LiveStandingRow[]; womenAssists: LiveStandingRow[]
  coachesWinRate?: LiveStandingRow[]
  worldCup?: LiveLeague[]
  worldCupKnockout?: LiveStandingRow[]
  uclFixtures?: LiveStandingRow[]
  uelFixtures?: LiveStandingRow[]
  // Nuevos automatizados
  f1Calendar?: LiveStandingRow[]
  f1Sprints?: LiveStandingRow[]
  nbaMvpRace?: LiveStandingRow[]
  nbaDpoyRace?: LiveStandingRow[]
  nbaRookieRace?: LiveStandingRow[]
  uclScorers?: LiveStandingRow[]
  uelScorers?: LiveStandingRow[]
  uclAssists?: LiveStandingRow[]
  uelAssists?: LiveStandingRow[]
  mundialScorers?: LiveStandingRow[]
  mundialAssists?: LiveStandingRow[]
  worldCupQualified?: LiveStandingRow[]
  worldCupSchedule?: LiveStandingRow[]
  motogpRiders?: LiveStandingRow[]
  motogpConstructors?: LiveStandingRow[]
  tennisSlams?: LiveStandingRow[]
  meta?: Record<string, BlockMeta>
  updatedAt?: string
}

// Map block.id -> standings payload key (for meta lookup)
const BLOCK_TO_META_KEY: Record<string, string> = {
  // Cada liga lee su PROPIA meta (no la genérica 'football') para que, si ESPN
  // devuelve una liga vacía, el bloque se marque 'unavailable' y NO muestre el
  // fallback hardcodeado como ● LIVE. (fix Serie A jun 2026)
  'tabla-laliga': 'tabla-laliga', 'tabla-premier': 'tabla-premier', 'tabla-serie-a': 'tabla-serie-a',
  'tabla-bundesliga': 'tabla-bundesliga', 'tabla-ligue1': 'tabla-ligue1', 'tabla-ucl': 'football', 'tabla-uel': 'football',
  'goles-equipo': 'football', 'menos-goles': 'football',
  'nba-este': 'nbaEast', 'nba-oeste': 'nbaWest',
  'nba-scoring': 'nbaScoring', 'nba-rebounds': 'nbaRebounds', 'nba-assists': 'nbaAssists',
  'nba-blocks': 'nbaBlocks', 'nba-steals': 'nbaSteals', 'nba-efficiency': 'nbaEfficiency', 'nba-3pt': 'nba3ptMade',
  'f1-campeonato': 'f1Drivers', 'f1-constructores': 'f1Constructors',
  'f1-poles': 'f1Poles',
  'atp-ranking': 'atpRanking', 'wta-ranking': 'wtaRanking',
  'ranking-fifa': 'fifaRanking',
  'ufc-p4p': 'ufcP4P',
  'ufc-campeones': 'ufcChampions',
  // Divisiones UFC: meta se inyecta por blockId directo (route lo hace en
  // for-loop sobre UFC_DIVISIONS), así que mapeamos blockId → mismo key.
  'ufc-hw': 'ufc-hw', 'ufc-lhw': 'ufc-lhw', 'ufc-mw': 'ufc-mw', 'ufc-ww': 'ufc-ww',
  'ufc-lw': 'ufc-lw', 'ufc-fw': 'ufc-fw', 'ufc-bw': 'ufc-bw', 'ufc-flw': 'ufc-flw',
  'ufc-w-bw': 'ufc-w-bw', 'ufc-w-flw': 'ufc-w-flw', 'ufc-w-stw': 'ufc-w-stw',
  'f-ligaf-tabla': 'womenLigaF', 'f-goleadoras': 'womenGoals', 'f-asistencias': 'womenAssists',
  'stats-dt': 'coachesWinRate',
  'wc-group-a': 'worldCup', 'wc-group-b': 'worldCup', 'wc-group-c': 'worldCup',
  'wc-group-d': 'worldCup', 'wc-group-e': 'worldCup', 'wc-group-f': 'worldCup',
  'wc-group-g': 'worldCup', 'wc-group-h': 'worldCup', 'wc-group-i': 'worldCup',
  'wc-group-j': 'worldCup', 'wc-group-k': 'worldCup', 'wc-group-l': 'worldCup',
  'wc-knockout': 'worldCupKnockout',
  'wc-qualified': 'worldCupQualified',
  'wc-schedule': 'worldCupSchedule',
  'wc-scorers': 'mundialScorers',
  'wc-assists': 'mundialAssists',
  'f1-calendario': 'f1Calendar',
  'f1-sprints': 'f1Sprints',
  'nba-mvp-race': 'nbaMvpRace',
  'nba-dpoy-race': 'nbaDpoyRace',
  'nba-rookie-race': 'nbaRookieRace',
  'ucl-scorers': 'uclScorers', 'uel-scorers': 'uelScorers',
  'ucl-assists': 'uclAssists', 'uel-assists': 'uelAssists',
  'motogp-pilotos': 'motogpRiders',
  'motogp-constructores': 'motogpConstructors',
  'tenis-slams': 'tennisSlams',
}

// (Histórico/estimated block sets removidos: la web ya no muestra bloques editoriales.)
const HISTORICAL_PLAYER_BLOCK_IDS = new Set<string>()
const STATIC_STALE_BLOCK_IDS = new Set<string>()

const FIXTURE_META_KEY: Record<string, string> = {
  'tabla-ucl': 'uclFixtures', 'tabla-uel': 'uelFixtures',
}

const STATIC_HIST_META: BlockMeta  = { status: 'historical', source: 'Estimado',    fetchedAt: '', asOf: 'Temp. 24/25' }
const HIST_PLAYER_META: BlockMeta  = { status: 'historical', source: 'API-Sports',  fetchedAt: '', asOf: 'Temp. 24/25' }

function getBlockMeta(blockId: string, liveMeta?: Record<string, BlockMeta>, cardType?: string): BlockMeta | undefined {
  if (cardType === 'fixtures') {
    const fKey = FIXTURE_META_KEY[blockId]
    if (fKey && liveMeta?.[fKey]) return liveMeta[fKey]
  }
  const key = BLOCK_TO_META_KEY[blockId]
  if (key && liveMeta?.[key]) return liveMeta[key]
  if (HISTORICAL_PLAYER_BLOCK_IDS.has(blockId)) return HIST_PLAYER_META
  if (STATIC_STALE_BLOCK_IDS.has(blockId)) return STATIC_HIST_META
  return undefined
}

// ── Player stats types (from /api/stats/players) ──────────────────
interface PlayerLeader {
  name: string; team: string; value: number; matches: number
  extra?: Record<string, string>
  playerId?: string; teamLogo?: string; leagueSlug?: string
}

// Build the /jugador deep-link slug from an ESPN league slug + athlete id.
function playerHref(p: { playerId?: string; leagueSlug?: string }): string | undefined {
  if (!p.playerId || !p.leagueSlug) return undefined
  return `/jugador/${p.leagueSlug.replaceAll('/', '_')}_${p.playerId}`
}
interface LeaguePlayerData {
  id: string; label: string
  goals: PlayerLeader[]; assists: PlayerLeader[]
}
interface LivePlayerData {
  leagues: LeaguePlayerData[]
  combined?: Record<string, PlayerLeader[]>
}

// IDs of blocks that get player-stats live data (ESPN)
const LIVE_PLAYER_BLOCK_IDS = new Set([
  'pichichi-laliga', 'bota-oro', 'goleadores', 'asistencias',
  'tiros-puerta', 'tiros-totales', 'tarjetas-amarillas', 'tarjetas-rojas', 'faltas', 'paradas',
])

// Combined-ranking blocks → key in livePlayerData.combined
const COMBINED_BLOCK_KEY: Record<string, string> = {
  'tiros-puerta': 'shotsOnTarget', 'tiros-totales': 'totalShots',
  'tarjetas-amarillas': 'yellowCards', 'tarjetas-rojas': 'redCards',
  'faltas': 'foulsCommitted', 'paradas': 'saves',
}

const LEAGUE_FILTER_TO_ID: Record<string, string> = {
  'LaLiga': 'esp.1', 'Premier League': 'eng.1', 'Bundesliga': 'ger.1',
  'Serie A': 'ita.1', 'Ligue 1': 'fra.1',
}

function applyLivePlayerToBlock(
  block: StatBlock,
  lpd: LivePlayerData,
  leagueFilter?: string,
): { block: StatBlock; isLive: boolean } {
  const leagues = lpd.leagues

  const combinedKey = COMBINED_BLOCK_KEY[block.id]
  if (combinedKey) {
    const src = lpd.combined?.[combinedKey] ?? []
    if (!src.length) return { block, isLive: false }
    return { isLive: true, block: { ...block, rows: src.map((g, i) => ({
      rank: i + 1, name: g.name, team: '',
      value: g.value.toString(), trend: 'flat' as const,
      logo: g.teamLogo, href: playerHref(g),
    }))}}
  }

  if (block.id === 'pichichi-laliga') {
    const lg = leagues.find(l => l.id === 'esp.1')
    if (!lg?.goals.length) return { block, isLive: false }
    return { isLive: true, block: { ...block, rows: lg.goals.slice(0, 10).map((g, i) => ({
      rank: i + 1, name: g.name, team: g.team,
      value: g.value.toString(), sub: `${g.matches} PJ`, trend: 'flat' as const,
      logo: g.teamLogo, href: playerHref(g),
    }))}}
  }

  if (block.id === 'bota-oro') {
    const all = leagues
      .flatMap(l => l.goals.slice(0, 10).map(g => ({ ...g, league: l.label })))
      .sort((a, b) => b.value - a.value).slice(0, 10)
    if (!all.length) return { block, isLive: false }
    return { isLive: true, block: { ...block, rows: all.map((g, i) => ({
      rank: i + 1, name: g.name,
      team: `${g.team} · ${g.league}`,
      value: (g.value * 2).toString(),
      sub: `${g.value} goles`,
      trend: 'flat' as const,
      logo: g.teamLogo, href: playerHref(g),
    }))}}
  }

  if (block.id === 'goleadores') {
    const filterId = leagueFilter ? LEAGUE_FILTER_TO_ID[leagueFilter] : null
    const source = filterId
      ? leagues.filter(l => l.id === filterId).flatMap(l => l.goals.slice(0, 10))
      : leagues.flatMap(l => l.goals.slice(0, 6)).sort((a, b) => b.value - a.value).slice(0, 12)
    if (!source.length) return { block, isLive: false }
    return { isLive: true, block: { ...block, rows: source.map((g, i) => ({
      rank: i + 1, name: g.name, team: g.team,
      value: g.value.toString(), sub: `${g.matches} PJ`, trend: 'flat' as const,
      logo: g.teamLogo, href: playerHref(g),
    }))}}
  }

  if (block.id === 'asistencias') {
    const filterId = leagueFilter ? LEAGUE_FILTER_TO_ID[leagueFilter] : null
    const source = filterId
      ? leagues.filter(l => l.id === filterId).flatMap(l => l.assists.slice(0, 10))
      : leagues.flatMap(l => l.assists.slice(0, 5)).sort((a, b) => b.value - a.value).slice(0, 10)
    if (!source.length) return { block, isLive: false }
    return { isLive: true, block: { ...block, rows: source.map((g, i) => ({
      rank: i + 1, name: g.name, team: g.team,
      value: g.value.toString(), sub: `${g.matches} PJ`, trend: 'flat' as const,
      logo: g.teamLogo, href: playerHref(g),
    }))}}
  }

  return { block, isLive: false }
}

function toStatRows(rows: LiveStandingRow[], teamKey?: string, leagueSlug?: string): StatRow[] {
  return rows.map(r => ({
    rank: r.rank, name: r.name,
    team: teamKey ? r.extra[teamKey] : r.abbr || undefined,
    flag: r.flag,
    value: r.value, sub: r.sub, trend: r.trend ?? 'flat',
    extra: Object.fromEntries(Object.entries(r.extra).filter(([k]) => k !== teamKey)),
    href: leagueSlug && r.teamId
      ? `/equipo/${leagueSlug.replaceAll('/', '_')}_${r.teamId}`
      : undefined,
    logo: r.logo,
  }))
}

// ─────────────────────────────────────────────────────────────────
// RESUMEN — landing cross-sport con lo más relevante de cada deporte
// ─────────────────────────────────────────────────────────────────
interface SummaryCard {
  sportId: string
  sportLabel: string
  emoji: string
  accent: string
  title: string
  metric: string
  rows: { rank: number; name: string; sub: string; value: string; flag?: string }[]
  meta?: BlockMeta
  sectionTarget?: string
  gender?: 'm' | 'f'
}

function buildSummaryCards(
  liveData: LiveStandingsData | null,
  livePlayerData: LivePlayerData | null,
): SummaryCard[] {
  const cards: SummaryCard[] = []
  const meta = liveData?.meta ?? {}

  // 🌍 Mundial 2026: clasificados destacados (primero — evento estrella)
  if (liveData?.worldCupQualified?.length) {
    cards.push({
      sportId: 'mundial', sportLabel: 'Mundial 2026', emoji: '🌍', accent: '#f59e0b',
      title: 'Mundial 2026 · Clasificados', metric: 'Grupo',
      rows: liveData.worldCupQualified.slice(0, 5).map(r => ({
        rank: r.rank, name: r.name, sub: r.sub, value: r.value, flag: r.flag,
      })),
      meta: meta.worldCupQualified,
      sectionTarget: 'clasificados',
    })
  }

  // ⚽ Goleadores LaLiga (ESPN, vivo)
  // Fix: league id is 'esp.1', not 'laliga'
  const laliga = livePlayerData?.leagues.find(l => l.id === 'esp.1')
  if (laliga && laliga.goals.length) {
    cards.push({
      sportId: 'futbol', sportLabel: 'LaLiga', emoji: '⚽', accent: '#22c55e',
      title: 'Goleadores LaLiga', metric: 'Goles',
      rows: laliga.goals.slice(0, 5).map((p, i) => ({
        rank: i + 1, name: p.name, sub: p.team, value: String(p.value),
      })),
      meta: { status: 'live', source: 'ESPN · LaLiga', fetchedAt: liveData?.updatedAt ?? '' },
      sectionTarget: 'jugadores',
    })
  }

  // ⚽ Clasificación LaLiga
  const laligaTable = liveData?.football?.find(f => f.id === 'tabla-laliga')
  if (laligaTable && laligaTable.rows.length) {
    cards.push({
      sportId: 'futbol', sportLabel: 'LaLiga', emoji: '⚽', accent: '#22c55e',
      title: 'Clasificación LaLiga', metric: 'Pts',
      rows: laligaTable.rows.slice(0, 5).map(r => ({
        rank: r.rank, name: r.name, sub: r.sub, value: r.value,
      })),
      meta: meta['tabla-laliga'] ?? meta['football'],
      sectionTarget: 'competiciones',
    })
  }

  // ⚽ Clasificación Premier League
  const premierTable = liveData?.football?.find(f => f.id === 'tabla-premier')
  if (premierTable && premierTable.rows.length) {
    cards.push({
      sportId: 'futbol', sportLabel: 'Premier League', emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', accent: '#6C2D91',
      title: 'Clasificación Premier', metric: 'Pts',
      rows: premierTable.rows.slice(0, 5).map(r => ({
        rank: r.rank, name: r.name, sub: r.sub, value: r.value,
      })),
      meta: meta['tabla-premier'] ?? meta['football'],
      sectionTarget: 'competiciones',
    })
  }

  // 🏀 NBA scoring leaders
  if (liveData?.nbaScoring?.length) {
    cards.push({
      sportId: 'baloncesto', sportLabel: 'NBA', emoji: '🏀', accent: '#ef4444',
      title: 'NBA · Anotadores', metric: 'PPG',
      rows: liveData.nbaScoring.slice(0, 5).map(r => ({
        rank: r.rank, name: r.name, sub: r.abbr, value: r.value,
      })),
      meta: meta.nbaScoring,
      sectionTarget: 'jugadores',
    })
  }

  // 🏀 NBA Conferencia Este
  if (liveData?.nbaEast?.length) {
    cards.push({
      sportId: 'baloncesto', sportLabel: 'NBA Este', emoji: '🏀', accent: '#ef4444',
      title: 'NBA · Conferencia Este', metric: 'V-D',
      rows: liveData.nbaEast.slice(0, 5).map(r => ({
        rank: r.rank, name: r.name, sub: r.sub, value: r.value,
      })),
      meta: meta.nbaEast,
      sectionTarget: 'equipos',
    })
  }

  // 🏀 NBA Conferencia Oeste
  if (liveData?.nbaWest?.length) {
    cards.push({
      sportId: 'baloncesto', sportLabel: 'NBA Oeste', emoji: '🏀', accent: '#f59e0b',
      title: 'NBA · Conferencia Oeste', metric: 'V-D',
      rows: liveData.nbaWest.slice(0, 5).map(r => ({
        rank: r.rank, name: r.name, sub: r.sub, value: r.value,
      })),
      meta: meta.nbaWest,
      sectionTarget: 'equipos',
    })
  }

  // 🏎️ F1 pilotos
  if (liveData?.f1Drivers?.length) {
    cards.push({
      sportId: 'f1', sportLabel: 'Fórmula 1', emoji: '🏎️', accent: '#f97316',
      title: 'F1 · Mundial Pilotos', metric: 'Pts',
      rows: liveData.f1Drivers.slice(0, 5).map(r => ({
        rank: r.rank, name: r.name, sub: r.abbr, value: r.value, flag: r.flag,
      })),
      meta: meta.f1Drivers,
      sectionTarget: 'pilotos',
    })
  }

  // 🎾 ATP top
  if (liveData?.atpRanking?.length) {
    cards.push({
      sportId: 'tenis', sportLabel: 'ATP', emoji: '🎾', accent: '#84cc16',
      title: 'Tenis · ATP Ranking', metric: 'Pts',
      rows: liveData.atpRanking.slice(0, 5).map(r => ({
        rank: r.rank, name: r.name, sub: r.abbr, value: r.value, flag: r.flag,
      })),
      meta: meta.atpRanking,
      sectionTarget: 'atp',
    })
  }

  // 🎾 WTA top
  if (liveData?.wtaRanking?.length) {
    cards.push({
      sportId: 'tenis', sportLabel: 'WTA', emoji: '🎾', accent: '#d946ef',
      title: 'Tenis · WTA Ranking', metric: 'Pts',
      rows: liveData.wtaRanking.slice(0, 5).map(r => ({
        rank: r.rank, name: r.name, sub: r.abbr, value: r.value, flag: r.flag,
      })),
      meta: meta.wtaRanking,
      sectionTarget: 'wta',
    })
  }

  // ⚽ Femenino: goleadoras
  if (liveData?.womenGoals?.length) {
    cards.push({
      sportId: 'futbol', sportLabel: 'Liga F', emoji: '⚽', accent: '#ec4899',
      title: 'Liga F · Goleadoras', metric: 'Goles',
      rows: liveData.womenGoals.slice(0, 5).map(r => ({
        rank: r.rank, name: r.name, sub: r.abbr, value: r.value,
      })),
      meta: meta.womenGoals,
      sectionTarget: 'jugadores',
      gender: 'f',
    })
  }

  // 🏎️ F1 Sprint Wins (si hay sprints en el calendario)
  if (liveData?.f1Sprints?.length) {
    cards.push({
      sportId: 'f1', sportLabel: 'F1', emoji: '🏎️', accent: '#f97316',
      title: 'F1 · Sprint Wins', metric: 'Vic',
      rows: liveData.f1Sprints.slice(0, 5).map(r => ({
        rank: r.rank, name: r.name, sub: r.abbr, value: r.value, flag: r.flag,
      })),
      meta: meta.f1Sprints,
      sectionTarget: 'sprints-f1',
    })
  }

  // 🏍️ MotoGP: pilotos top
  if (liveData?.motogpRiders?.length) {
    cards.push({
      sportId: 'motogp', sportLabel: 'MotoGP', emoji: '🏍️', accent: '#dc2626',
      title: 'MotoGP · Mundial Pilotos', metric: 'Pts',
      rows: liveData.motogpRiders.slice(0, 5).map(r => ({
        rank: r.rank, name: r.name, sub: r.abbr, value: r.value, flag: r.flag,
      })),
      meta: meta.motogpRiders,
      sectionTarget: 'pilotos-motogp',
    })
  }

  // 🥊 UFC P4P top
  if (liveData?.ufcP4P?.length) {
    cards.push({
      sportId: 'ufc', sportLabel: 'UFC', emoji: '🥊', accent: '#f97316',
      title: 'UFC · Pound for Pound', metric: 'Pos.',
      rows: liveData.ufcP4P.slice(0, 5).map(r => ({
        rank: r.rank, name: r.name, sub: r.sub, value: `#${r.rank}`, flag: r.flag,
      })),
      meta: meta.ufcP4P,
      sectionTarget: 'ranking-ufc',
    })
  }

  // 🌍 Ranking Mundial Elo (selecciones)
  if (liveData?.fifaRanking?.length) {
    cards.push({
      sportId: 'futbol', sportLabel: 'Selecciones', emoji: '🌍', accent: '#3b82f6',
      title: 'Ranking Mundial · Elo', metric: 'Pts',
      rows: liveData.fifaRanking.slice(0, 5).map(r => ({
        rank: r.rank, name: r.name, sub: r.sub, value: r.value, flag: r.flag,
      })),
      meta: meta.fifaRanking,
      sectionTarget: 'selecciones',
    })
  }

  return cards
}

function ResumenCard({ card, onOpen }: { card: SummaryCard; onOpen: () => void }) {
  return (
    <button onClick={onOpen}
      className="text-left rounded-2xl overflow-hidden transition-all hover:brightness-110 active:scale-[0.99] w-full"
      style={{ background: 'var(--bg-card)', border: `1px solid ${card.accent}20`, cursor: 'pointer' }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-2.5"
        style={{ borderBottom: `1px solid ${card.accent}15`, background: `${card.accent}08` }}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base leading-none">{card.emoji}</span>
          <h3 className="font-black text-[13px] truncate"
            style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
            {card.title}
          </h3>
        </div>
        <FreshnessBadge isLive={card.meta?.status === 'live'} meta={card.meta} />
      </div>
      {/* Rows */}
      <div className="flex flex-col px-4 py-2">
        {card.rows.map((r, idx) => (
          <div key={r.rank} className="flex items-center gap-2 py-1.5"
            style={{ borderBottom: idx < card.rows.length - 1 ? '1px solid rgba(255,255,255,0.035)' : 'none' }}>
            <div className="w-6 flex-shrink-0"><MedalBadge rank={r.rank} /></div>
            <div className="flex-1 min-w-0 flex items-center gap-1.5">
              {r.flag && <span className="text-[11px] leading-none flex-shrink-0">{r.flag}</span>}
              <span className="font-semibold text-[12px] truncate" style={{ color: r.rank === 1 ? '#F0F0FF' : '#B8B8D0', fontFamily: 'var(--font-display)' }}>
                {r.name}
              </span>
              {r.sub && (
                <span className="text-[10px] truncate hidden sm:block" style={{ color: '#5A5A72', fontFamily: 'var(--font-sport)' }}>
                  · {r.sub}
                </span>
              )}
            </div>
            <span className="font-black tabular-nums text-[13px] flex-shrink-0"
              style={{ color: r.rank === 1 ? card.accent : '#6060A0', fontFamily: 'var(--font-display)' }}>
              {r.value}
            </span>
          </div>
        ))}
      </div>
      {/* Footer CTA */}
      <div className="px-4 py-2.5 flex items-center justify-between"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <span className="text-[9px] font-black uppercase tracking-[0.15em]" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>
          {card.metric}
        </span>
        <span className="text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1"
          style={{ color: card.accent, fontFamily: 'var(--font-sport)' }}>
          Ver todo
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4h5M4 1.5l2.5 2.5L4 6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </span>
      </div>
    </button>
  )
}

function ResumenView({
  liveData, livePlayerData, lastUpdated, onPickSport,
}: {
  liveData: LiveStandingsData | null
  livePlayerData: LivePlayerData | null
  lastUpdated: Date | null
  onPickSport: (sportId: string, sectionId?: string, gender?: 'm' | 'f') => void
}) {
  const cards = React.useMemo(
    () => buildSummaryCards(liveData, livePlayerData),
    [liveData, livePlayerData],
  )
  const liveCount = cards.filter(c => c.meta?.status === 'live').length
  const histCount = cards.filter(c => c.meta?.status === 'historical').length

  if (!liveData) {
    return (
      <div className="py-16 text-center" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
        Cargando datos en vivo…
      </div>
    )
  }

  return (
    <div>
      {/* Status bar */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {liveCount > 0 && (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(74,222,128,0.10)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)', fontFamily: 'var(--font-sport)' }}>
            <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#4ade80' }} />
            {liveCount} en vivo
          </span>
        )}
        {histCount > 0 && (
          <span className="text-[10px] px-2.5 py-1 rounded-full font-bold"
            style={{ background: 'rgba(148,163,184,0.08)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.15)', fontFamily: 'var(--font-sport)' }}>
            {histCount} snapshot
          </span>
        )}
        {lastUpdated && (
          <span className="text-[10px]" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>
            · {lastUpdated.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {cards.length === 0 ? (
        <div className="py-12 text-center" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
          Aún no hay datos cargados. Refresca en unos segundos.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {cards.map((c, i) => (
            <ResumenCard key={`${c.sportId}-${c.title}-${i}`} card={c}
              onOpen={() => onPickSport(c.sportId, c.sectionTarget, c.gender)} />
          ))}
        </div>
      )}
    </div>
  )
}

// Construye la dirección de path de estadísticas: /estadisticas/<slug> (la F1 usa
// el slug 'f1' aunque su id interno sea 'formula1'; 'resumen' = portada sin slug).
// Sección y género van como query porque NO son landings SEO.
const SLUG_BY_SPORT_ID: Record<string, string> = { formula1: 'f1' }
function buildStatsUrl(id: string, section?: string, genderF?: boolean): string {
  const slug = id === 'resumen' ? '' : (SLUG_BY_SPORT_ID[id] ?? id)
  const base = slug ? `/estadisticas/${slug}` : '/estadisticas'
  const qs = new URLSearchParams()
  if (section) qs.set('section', section)
  if (genderF) qs.set('gender', 'f')
  const q = qs.toString()
  return q ? `${base}?${q}` : base
}

// Lee deporte/sección/género desde la URL actual (camino inverso de buildStatsUrl).
// Sirve de respaldo del popstate cuando la entrada del historial no trae estado.
function parseStatsLocation(): { sportId: string; sectionId?: string; gender: 'm' | 'f' } {
  if (typeof window === 'undefined') return { sportId: 'resumen', gender: 'm' }
  const m = window.location.pathname.match(/\/estadisticas\/([^/?#]+)/)
  const slug = m?.[1]
  const sportId = slug
    ? (Object.keys(SLUG_BY_SPORT_ID).find(k => SLUG_BY_SPORT_ID[k] === slug) ?? slug)
    : 'resumen'
  const params = new URLSearchParams(window.location.search)
  return {
    sportId,
    sectionId: params.get('section') ?? undefined,
    gender: params.get('gender') === 'f' ? 'f' : 'm',
  }
}

export default function EstadisticasClient({ initialData, initialSport }: { initialData?: LiveStandingsData | null; initialSport?: string }) {
  const searchParams = useSearchParams()

  // El deporte inicial viene del prop (ruta /estadisticas/[sport]); si no, se lee
  // de ?sport= (compatibilidad con enlaces antiguos) y por defecto 'Destacados'.
  const initialSportId = (() => {
    if (initialSport && SPORTS.find(s => s.id === initialSport)) return initialSport
    const sp = searchParams.get('sport') ?? ''
    return SPORTS.find(s => s.id === sp) ? sp : 'resumen'
  })()

  const [sportId, setSportId] = useState<string>(initialSportId)
  const [sectionId, setSectionId] = useState<string>(() => {
    const sec = searchParams.get('section') ?? ''
    const sport = SPORTS.find(s => s.id === initialSportId) ?? SPORTS[0]
    return sport.sections.find(s => s.id === sec) ? sec : sport.sections[0].id
  })
  const [expandedBlocks, setExpandedBlocks]   = useState<Record<string, boolean>>({})
  const [expandedGroups, setExpandedGroups]   = useState<Record<string, boolean>>(() => {
    const firstGroupId = SPORTS[0].sections[0].groups?.[0]?.id
    return firstGroupId ? { [firstGroupId]: true } : {}
  })
  const [leagueFilter, setLeagueFilter]       = useState('General')
  const [gender, setGender]                   = useState<'m' | 'f'>(() =>
    initialSportId === 'futbol' && searchParams.get('gender') === 'f' ? 'f' : 'm'
  )
  const [liveData, setLiveData]               = useState<LiveStandingsData | null>(initialData ?? null)
  const [livePlayerData, setLivePlayerData]   = useState<LivePlayerData | null>(null)
  const [lastUpdated, setLastUpdated]         = useState<Date | null>(null)
  const [fetchError, setFetchError]           = useState<string | null>(null)
  const [refreshing, setRefreshing]           = useState(false)
  const [updatedFlash, setUpdatedFlash]       = useState(false)
  const [searchOpen, setSearchOpen]           = useState(false)
  const [favorites, setFavorites]             = useState<Set<string>>(() => new Set())
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [hideUnavailable, setHideUnavailable] = useState(true)

  // Load favorites + ocultar-vacíos preference from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('ts_stats_favorites')
      if (raw) setFavorites(new Set(JSON.parse(raw)))
    } catch { /* ignore */ }
    try {
      const raw = localStorage.getItem('ts_stats_hide_unavailable')
      if (raw === '0') setHideUnavailable(false)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    try { localStorage.setItem('ts_stats_hide_unavailable', hideUnavailable ? '1' : '0') } catch { /* ignore */ }
  }, [hideUnavailable])

  // Sello "última actualización" solo en cliente: el valor inicial se calcula
  // tras montar para evitar un mismatch de hidratación (hora UTC del servidor en
  // SSR ≠ hora local del cliente, que se renderiza con toLocaleTimeString).
  useEffect(() => {
    if (initialData) setLastUpdated(new Date())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Botón "atrás" del navegador navega por las subsecciones ──────────
  // Antes cada cambio de deporte/sección usaba replaceState, así que el
  // historial no recordaba la ruta interna y "atrás" echaba de Estadísticas
  // de un tirón. Ahora: al montar sellamos la entrada actual con el estado de
  // navegación (preservando los marcadores internos de Next para no forzar
  // recargas en popstate), los cambios hacen pushState, y este listener
  // restaura deporte/sección/género al retroceder. Solo el último "atrás" sale.
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.history.replaceState(
      { ...window.history.state, tsNav: { sportId, sectionId, gender } },
      ''
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onPop = (e: PopStateEvent) => {
      if (!window.location.pathname.startsWith('/estadisticas')) return
      const nav = (e.state as { tsNav?: { sportId?: string; sectionId?: string; gender?: 'm' | 'f' } } | null)?.tsNav
      const loc = nav ?? parseStatsLocation()
      const nextSport = SPORTS.find(s => s.id === loc.sportId) ?? SPORTS[0]
      const nextSec = nextSport.sections.find(s => s.id === loc.sectionId) ?? nextSport.sections[0]
      const g: 'm' | 'f' = nextSport.id === 'futbol' && loc.gender === 'f' ? 'f' : 'm'
      setSportId(nextSport.id)
      setGender(g)
      setSectionId(nextSec.id)
      setExpandedBlocks({})
      setExpandedGroups(nextSec.groups ? { [nextSec.groups[0]?.id ?? '']: true } : {})
      setLeagueFilter('General')
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleFav = React.useCallback((blockId: string) => {
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(blockId)) next.delete(blockId)
      else next.add(blockId)
      try { localStorage.setItem('ts_stats_favorites', JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }, [])

  const POLL_MS = 5 * 60_000

  const refreshOnceRef    = useRef<() => void>(() => {})
  const fetchPlayersRef   = useRef<() => void>(() => {})
  const hasLoadedPlayersRef = useRef(false)

  // Main polling — standings only (always active)
  useEffect(() => {
    let cancelled = false
    const fetchStandings = async () => {
      setRefreshing(true)
      try {
        const standings = await fetch('/api/stats/standings').then(r => r.ok ? r.json() : Promise.reject(new Error(`standings ${r.status}`)))
        if (cancelled) return
        if (standings) {
          // Show flash only if this isn't the very first hydration
          const isUpdate = !!liveData && standings.updatedAt !== liveData.updatedAt
          setLiveData(standings)
          if (isUpdate) {
            setUpdatedFlash(true)
            setTimeout(() => setUpdatedFlash(false), 2200)
          }
        }
        setLastUpdated(new Date())
        setFetchError(null)
      } catch (err) {
        if (cancelled) return
        setFetchError(err instanceof Error ? err.message : 'Error de red')
      } finally {
        if (!cancelled) setRefreshing(false)
      }
    }
    refreshOnceRef.current = fetchStandings
    // initialData puede venir "shardeado" a un solo deporte (SSR de ?sport=X):
    // faltan las keys del resto de deportes. Sin un fetch full tras hidratar,
    // cambiar de pestaña renderiza un deporte sin datos. Traemos el payload
    // completo en background si detectamos un shard parcial.
    const partial = initialData as Partial<LiveStandingsData> | null | undefined
    const isPartialShard = !!partial && (
      partial.football === undefined ||
      partial.nbaEast === undefined ||
      partial.f1Drivers === undefined
    )
    if (!initialData || isPartialShard) fetchStandings()
    const interval = setInterval(fetchStandings, POLL_MS)
    return () => { cancelled = true; clearInterval(interval) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Lazy players — only fetched when viewing fútbol masculino
  useEffect(() => {
    if (sportId !== 'futbol' || gender !== 'm') return
    let cancelled = false
    const fetchPlayers = async () => {
      try {
        const players = await fetch('/api/stats/players').then(r => r.ok ? r.json() : Promise.reject(new Error(`players ${r.status}`)))
        if (cancelled) return
        if (players) { setLivePlayerData(players); hasLoadedPlayersRef.current = true }
      } catch { /* non-critical, silent */ }
    }
    fetchPlayersRef.current = fetchPlayers
    if (!hasLoadedPlayersRef.current) fetchPlayers()
    const interval = setInterval(fetchPlayers, POLL_MS)
    return () => { cancelled = true; clearInterval(interval) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sportId, gender])

  function applyLive(blocks: StatBlock[]): StatBlock[] {
    return blocks.map(block => {
      // Standings data
      if (liveData) {
        const league = liveData.football?.find(l => l.id === block.id)
        if (league?.rows.length) return { ...block, rows: toStatRows(league.rows, undefined, league.leagueSlug), placeholder: false }
        // Knockout phase: standings empty → fallback to live fixtures
        if (block.id === 'tabla-ucl' && liveData.uclFixtures?.length)
          return { ...block, title: 'Champions League · Fase KO', rows: toStatRows(liveData.uclFixtures), placeholder: false, cardType: 'fixtures' }
        if (block.id === 'tabla-uel' && liveData.uelFixtures?.length)
          return { ...block, title: 'Europa League · Fase KO', rows: toStatRows(liveData.uelFixtures), placeholder: false, cardType: 'fixtures' }
        if (block.id === 'nba-este'        && liveData.nbaEast?.length)         return { ...block, rows: toStatRows(liveData.nbaEast, undefined, 'basketball/nba') }
        if (block.id === 'nba-oeste'       && liveData.nbaWest?.length)         return { ...block, rows: toStatRows(liveData.nbaWest, undefined, 'basketball/nba') }
        if (block.id === 'f1-campeonato'   && liveData.f1Drivers?.length)       return { ...block, rows: toStatRows(liveData.f1Drivers, 'Escudería') }
        if (block.id === 'f1-constructores'&& liveData.f1Constructors?.length)  return { ...block, rows: toStatRows(liveData.f1Constructors) }
        if (block.id === 'atp-ranking'       && liveData.atpRanking?.length)     return { ...block, rows: toStatRows(liveData.atpRanking) }
        if (block.id === 'wta-ranking'       && liveData.wtaRanking?.length)     return { ...block, rows: toStatRows(liveData.wtaRanking) }
        if (block.id === 'f1-poles'          && liveData.f1Poles?.length)        return { ...block, rows: toStatRows(liveData.f1Poles, 'Escudería') }
        if (block.id === 'ranking-fifa'      && liveData.fifaRanking?.length)    return { ...block, rows: toStatRows(liveData.fifaRanking) }
        if (block.id === 'nba-scoring'       && liveData.nbaScoring?.length)     return { ...block, rows: toStatRows(liveData.nbaScoring) }
        if (block.id === 'nba-rebounds'      && liveData.nbaRebounds?.length)    return { ...block, rows: toStatRows(liveData.nbaRebounds) }
        if (block.id === 'nba-assists'       && liveData.nbaAssists?.length)     return { ...block, rows: toStatRows(liveData.nbaAssists) }
        if (block.id === 'nba-blocks'        && liveData.nbaBlocks?.length)      return { ...block, rows: toStatRows(liveData.nbaBlocks) }
        if (block.id === 'nba-steals'        && liveData.nbaSteals?.length)      return { ...block, rows: toStatRows(liveData.nbaSteals) }
        if (block.id === 'nba-efficiency'    && liveData.nbaEfficiency?.length)  return { ...block, rows: toStatRows(liveData.nbaEfficiency) }
        if (block.id === 'nba-3pt'           && liveData.nba3ptMade?.length)     return { ...block, rows: toStatRows(liveData.nba3ptMade) }
        if (block.id === 'f-ligaf-tabla'     && liveData.womenLigaF?.length)          return { ...block, rows: toStatRows(liveData.womenLigaF),          placeholder: false }
        if (block.id === 'f-goleadoras'      && liveData.womenGoals?.length)          return { ...block, rows: toStatRows(liveData.womenGoals),           placeholder: false }
        if (block.id === 'f-asistencias'     && liveData.womenAssists?.length)        return { ...block, rows: toStatRows(liveData.womenAssists),         placeholder: false }
        if (block.id === 'stats-dt'          && liveData.coachesWinRate?.length)      return { ...block, rows: toStatRows(liveData.coachesWinRate!, 'Club') }

        if (block.id === 'goles-equipo') {
          const allTeams = (liveData.football ?? []).flatMap(league =>
            league.rows.map(row => {
              const gf = parseInt(row.extra?.GF ?? '0') || 0
              const gp = (parseInt(row.extra?.V ?? '0') || 0) + (parseInt(row.extra?.E ?? '0') || 0) + (parseInt(row.extra?.D ?? '0') || 0)
              return { name: row.name, league: league.label, gf, gp }
            })
          ).filter(t => t.gf > 0).sort((a, b) => b.gf - a.gf).slice(0, 7)
          if (allTeams.length) return { ...block, rows: allTeams.map((t, i) => ({
            rank: i + 1, name: t.name, team: t.league,
            value: String(t.gf),
            sub: `${t.gp} PJ · ${t.gp > 0 ? (t.gf / t.gp).toFixed(2) : '0'}/PJ`,
            trend: 'flat' as const,
          }))}
        }

        if (block.id === 'menos-goles') {
          const allTeams = (liveData.football ?? []).flatMap(league =>
            league.rows.map(row => {
              const gc = parseInt(row.extra?.GC ?? '0') || 0
              const gp = (parseInt(row.extra?.V ?? '0') || 0) + (parseInt(row.extra?.E ?? '0') || 0) + (parseInt(row.extra?.D ?? '0') || 0)
              return { name: row.name, league: league.label, gc, gp }
            })
          ).filter(t => t.gp > 0).sort((a, b) => a.gc - b.gc).slice(0, 7)
          if (allTeams.length) return { ...block, rows: allTeams.map((t, i) => ({
            rank: i + 1, name: t.name, team: t.league,
            value: String(t.gc),
            sub: `${t.gp} PJ · ${t.gp > 0 ? (t.gc / t.gp).toFixed(2) : '0'}/PJ`,
            trend: 'flat' as const,
          }))}
        }

        if (block.id === 'ufc-p4p' && liveData.ufcP4P?.length)
          return { ...block, rows: toStatRows(liveData.ufcP4P) }

        if (block.id === 'ufc-campeones' && liveData.ufcChampions?.length)
          return { ...block, rows: toStatRows(liveData.ufcChampions, 'División') }

        // Cualquier división UFC (ufc-hw, ufc-lhw, ..., ufc-w-stw) viene en
        // el agregator liveData.ufcDivisions keyed por blockId.
        if (block.id.startsWith('ufc-') && block.id !== 'ufc-p4p' && block.id !== 'ufc-campeones') {
          const rows = liveData.ufcDivisions?.[block.id]
          if (rows?.length) return { ...block, rows: toStatRows(rows) }
        }

        if (block.id.startsWith('wc-group-') && liveData.worldCup?.length) {
          const group = liveData.worldCup.find(g => g.id === block.id)
          if (group?.rows.length) return { ...block, rows: toStatRows(group.rows) }
        }
        if (block.id === 'wc-knockout' && liveData.worldCupKnockout?.length)
          return { ...block, rows: toStatRows(liveData.worldCupKnockout), placeholder: false }

        // ── Nuevos automatizados ────────────────────────────────────────
        if (block.id === 'f1-calendario'    && liveData.f1Calendar?.length)        return { ...block, rows: toStatRows(liveData.f1Calendar) }
        if (block.id === 'f1-sprints'       && liveData.f1Sprints?.length)         return { ...block, rows: toStatRows(liveData.f1Sprints, 'Escudería') }
        if (block.id === 'nba-mvp-race'     && liveData.nbaMvpRace?.length)        return { ...block, rows: toStatRows(liveData.nbaMvpRace) }
        if (block.id === 'nba-dpoy-race'    && liveData.nbaDpoyRace?.length)       return { ...block, rows: toStatRows(liveData.nbaDpoyRace) }
        if (block.id === 'nba-rookie-race'  && liveData.nbaRookieRace?.length)     return { ...block, rows: toStatRows(liveData.nbaRookieRace) }
        if (block.id === 'ucl-scorers'      && liveData.uclScorers?.length)        return { ...block, rows: toStatRows(liveData.uclScorers) }
        if (block.id === 'uel-scorers'      && liveData.uelScorers?.length)        return { ...block, rows: toStatRows(liveData.uelScorers) }
        if (block.id === 'ucl-assists'      && liveData.uclAssists?.length)        return { ...block, rows: toStatRows(liveData.uclAssists) }
        if (block.id === 'uel-assists'      && liveData.uelAssists?.length)        return { ...block, rows: toStatRows(liveData.uelAssists) }
        if (block.id === 'wc-scorers'       && liveData.mundialScorers?.length)     return { ...block, rows: toStatRows(liveData.mundialScorers) }
        if (block.id === 'wc-assists'       && liveData.mundialAssists?.length)     return { ...block, rows: toStatRows(liveData.mundialAssists) }
        if (block.id === 'wc-qualified'     && liveData.worldCupQualified?.length) return { ...block, rows: toStatRows(liveData.worldCupQualified) }
        if (block.id === 'wc-schedule'      && liveData.worldCupSchedule?.length)  return { ...block, rows: toStatRows(liveData.worldCupSchedule) }
        if (block.id === 'motogp-pilotos'        && liveData.motogpRiders?.length)        return { ...block, rows: toStatRows(liveData.motogpRiders, 'Escudería') }
        if (block.id === 'motogp-constructores'  && liveData.motogpConstructors?.length)  return { ...block, rows: toStatRows(liveData.motogpConstructors) }
        if (block.id === 'tenis-slams'           && liveData.tennisSlams?.length)         return { ...block, rows: toStatRows(liveData.tennisSlams) }
      }
      // Player stats data
      if (livePlayerData && LIVE_PLAYER_BLOCK_IDS.has(block.id)) {
        const { block: updated, isLive } = applyLivePlayerToBlock(block, livePlayerData, leagueFilter)
        if (isLive) return updated
      }
      // No mentir: si el servidor marca el bloque 'unavailable' (su fuente devolvió
      // vacío), NO mostramos las filas hardcodeadas del config como si fueran
      // actuales. Las vaciamos → el bloque pinta "Datos no disponibles" y el toggle
      // de vacíos lo oculta, en vez de datos viejos (NBA 24/25, femenino Sam Kerr…).
      if (liveData && !block.placeholder && block.rows.length > 0) {
        const m = getBlockMeta(block.id, liveData.meta, block.cardType)
        if (m?.status === 'unavailable') return { ...block, rows: [] }
      }
      return block
    })
  }

  function isBlockLive(block: StatBlock): boolean {
    const metaKey = block.cardType === 'fixtures'
      ? ({ 'tabla-ucl': 'uclFixtures', 'tabla-uel': 'uelFixtures' } as Record<string, string>)[block.id] ?? BLOCK_TO_META_KEY[block.id]
      : BLOCK_TO_META_KEY[block.id]
    const meta = liveData?.meta?.[metaKey]
    if (meta?.status === 'unavailable' || meta?.status === 'stale' || meta?.status === 'historical') return false
    if (liveData && LIVE_BLOCK_IDS.has(block.id) && block.rows.length > 0) return true
    if (livePlayerData && LIVE_PLAYER_BLOCK_IDS.has(block.id) && block.rows.length > 0) return true
    return false
  }

  const sport = SPORTS.find(s => s.id === sportId) ?? SPORTS[0]
  // Fondo atmosférico por deporte para el hero (reusa los WebP de /calendario).
  const statsBackdrop = ({ futbol: 'futbol', baloncesto: 'nba', formula1: 'f1', tenis: 'tenis', ufc: 'ufc' } as Record<string, string>)[sportId] ?? null
  const isFemenino = gender === 'f' && sportId === 'futbol'

  const handleSportChange = (id: string, targetSection?: string, targetGender?: 'm' | 'f') => {
    const nextSport = SPORTS.find(s => s.id === id)
    const sec = (targetSection && nextSport?.sections.find(s => s.id === targetSection))
      ? nextSport.sections.find(s => s.id === targetSection)!
      : nextSport?.sections[0]
    // El femenino solo existe en fútbol; en cualquier otro deporte volvemos a 'm'.
    const g: 'm' | 'f' = (id === 'futbol' && targetGender === 'f') ? 'f' : 'm'
    setSportId(id)
    setGender(g)
    setSectionId(sec?.id ?? 'jugadores')
    setExpandedBlocks({})
    setExpandedGroups(sec?.groups ? { [sec.groups[0]?.id ?? '']: true } : {})
    setLeagueFilter('General')
    // URL de path limpia (/estadisticas/<slug>) sin recargar: las pestañas siguen
    // siendo instantáneas (no remonta la página). La sección se omite aquí para
    // que la dirección del deporte coincida con su canonical. pushState (no
    // replaceState) para que "atrás" del navegador retroceda al deporte anterior;
    // preservamos window.history.state (marcadores de Next) para no forzar recarga.
    if (typeof window !== 'undefined') {
      window.history.pushState(
        { ...window.history.state, tsNav: { sportId: id, sectionId: sec?.id, gender: g } },
        '', buildStatsUrl(id, undefined, g === 'f')
      )
    }
  }

  const handleSectionChange = (id: string) => {
    if (id === sectionId) return  // misma sección → no duplicar entrada de historial
    const sec = sport.sections.find(s => s.id === id)
    setSectionId(id)
    setExpandedBlocks({})
    setExpandedGroups(sec?.groups ? { [sec.groups[0]?.id ?? '']: true } : {})
    setLeagueFilter('General')
    if (typeof window !== 'undefined') {
      window.history.pushState(
        { ...window.history.state, tsNav: { sportId, sectionId: id, gender } },
        '', buildStatsUrl(sportId, id, gender === 'f')
      )
    }
  }

  const section = sport.sections.find(s => s.id === sectionId) ?? sport.sections[0]
  const isFutbol = sportId === 'futbol'
  const isFutbolJugadores = isFutbol && sectionId === 'jugadores'
  const hasGroups = !!(section?.groups && section.groups.length > 0)

  // Cuenta de bloques con datos verificables por deporte (meta != 'unavailable').
  // Permite mostrar un badge en cada pestaña de deporte y dimear los vacíos.
  const liveMeta = liveData?.meta
  const sportAvailableCounts = React.useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {}
    for (const sp of SPORTS) {
      let n = 0
      for (const sec of sp.sections) {
        const blocks: StatBlock[] = sec.groups
          ? sec.groups.flatMap(g => g.blocks)
          : (sec.blocks ?? [])
        for (const b of blocks) {
          if (b.placeholder && b.rows.length === 0) continue
          const m = getBlockMeta(b.id, liveMeta, b.cardType)
          if (m?.status === 'unavailable') continue
          n++
        }
      }
      out[sp.id] = n
    }
    return out
  }, [liveMeta])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const flatBlocks = React.useMemo(() => applyLive(section?.blocks ?? []), [section, liveData, livePlayerData, leagueFilter])
  const leagueFilteredBlocks = (sectionId === 'competiciones' && leagueFilter !== 'General')
    ? flatBlocks.filter(b => !b.league || b.league === leagueFilter)
    : flatBlocks
  const favoriteFilteredBlocks = showFavoritesOnly
    ? leagueFilteredBlocks.filter(b => favorites.has(b.id))
    : leagueFilteredBlocks
  // Auto-ocultar bloques marcados como "unavailable" cuando el toggle está activo.
  // Conserva los favoritos aunque estén unavailable: si el usuario lo guardó, lo verá.
  const filteredFlatBlocks = hideUnavailable
    ? favoriteFilteredBlocks.filter(b => {
        if (favorites.has(b.id)) return true
        const m = getBlockMeta(b.id, liveData?.meta, b.cardType)
        return m?.status !== 'unavailable'
      })
    : favoriteFilteredBlocks
  const hiddenFlatCount = favoriteFilteredBlocks.length - filteredFlatBlocks.length

  const toggleBlock = (id: string) => {
    setExpandedBlocks(prev => {
      const next = !prev[id]
      if (next) trackStatsBlockOpen({ block_id: id, sport: sportId, section: sectionId })
      return { ...prev, [id]: next }
    })
  }
  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => {
      const next = !prev[id]
      if (next) trackStatsGroupOpen({ group_id: id, sport: sportId })
      return { ...prev, [id]: next }
    })
  }

  const teamLeague = React.useMemo(
    () => buildTeamLeague(liveData?.football ?? []),
    [liveData?.football],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const searchableRows = React.useMemo<SearchableRow[]>(() => {
    const out: SearchableRow[] = []
    const collect = (blocks: StatBlock[]) => {
      for (const b of applyLive(blocks)) {
        if (b.placeholder || !b.rows.length) continue
        for (const r of b.rows) {
          out.push({ blockId: b.id, blockTitle: b.title, rowName: r.name, rowTeam: r.team, rowValue: r.value, metric: b.metric })
        }
      }
    }
    for (const sec of sport.sections) {
      if (sec.blocks) collect(sec.blocks)
      if (sec.groups) for (const g of sec.groups) collect(g.blocks)
    }
    return out
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sport, liveData, livePlayerData, leagueFilter])

  const handleSearchPick = (blockId: string) => {
    trackSearch(`stats:${blockId}`)
    setExpandedBlocks(prev => ({ ...prev, [blockId]: true }))
    for (const sec of sport.sections) {
      const group = sec.groups?.find(g => g.blocks.some(b => b.id === blockId))
      if (group) {
        setExpandedGroups(prev => ({ ...prev, [group.id]: true }))
        break
      }
    }
    requestAnimationFrame(() => {
      const el = document.getElementById(blockId)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      else window.location.hash = `#${blockId}`
    })
  }

  return (
    <TeamLeagueContext.Provider value={teamLeague}>
    <StatsSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} rows={searchableRows} onPick={handleSearchPick} />
    <div data-sport={sportId || undefined} style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 pb-24">

        {/* ── HERO ──────────────────────────────────────── */}
        <div className="relative pt-8 pb-5 overflow-hidden">
          {/* Fondo atmosférico del deporte (broadcast) — solo en deportes con
              asset; en Destacados/Mundial/MotoGP queda el look base. */}
          {statsBackdrop && (
            <>
              <div aria-hidden="true" className="absolute inset-0 pointer-events-none"
                style={{ backgroundImage: `url(/banners/signal/${statsBackdrop}.webp)`, backgroundSize: 'cover', backgroundPosition: 'center 32%', opacity: 0.4 }} />
              <div aria-hidden="true" className="absolute inset-0 pointer-events-none"
                style={{ background: 'linear-gradient(180deg, rgba(9,9,15,0.40) 0%, rgba(9,9,15,0.72) 62%, var(--bg-base) 100%)' }} />
            </>
          )}
          {/* Accent glow */}
          <div className="absolute -top-8 left-0 w-[500px] h-64 pointer-events-none"
            style={{ background: `radial-gradient(ellipse at 15% 50%, ${sport.accent}12 0%, transparent 65%)`, filter: 'blur(24px)', transition: 'background 0.5s ease' }} />
          <div className="relative">
            {/* Title row */}
            <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-3">
              <div>
                <h1 className="font-black leading-none"
                  style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem,5vw,3.2rem)', letterSpacing: '-0.03em' }}>
                  <span style={{ color: '#F8F8FF' }}>Estad</span><span style={{ color: sport.accent }}>ísticas</span>
                </h1>
                <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
                  ESPN · NBA.com · Jolpica · F1 oficial · Actualizado automáticamente
                </p>
              </div>
              {/* Freshness chip */}
              {lastUpdated && (
                <span className="text-[10px] inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full sm:mb-0.5"
                  style={{ background: fetchError ? 'rgba(248,113,113,0.08)' : 'rgba(74,222,128,0.08)', color: fetchError ? '#f87171' : '#4ade80', border: `1px solid ${fetchError ? 'rgba(248,113,113,0.2)' : 'rgba(74,222,128,0.2)'}`, fontFamily: 'var(--font-sport)' }}>
                  <span className={refreshing ? 'animate-spin' : ''} style={{ display: 'inline-block' }}>⟳</span>
                  {lastUpdated.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              {updatedFlash && (
                <span aria-live="polite" className="text-[10px] inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(74,222,128,0.14)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.32)', fontFamily: 'var(--font-sport)', animation: 'fadeOut 2.2s forwards' }}>
                  ● Actualizado
                </span>
              )}
            </div>
            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => { refreshOnceRef.current(); fetchPlayersRef.current() }} disabled={refreshing}
                className="text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-opacity hover:opacity-80 disabled:opacity-40 inline-flex items-center gap-1"
                style={{ background: 'rgba(34,197,94,0.08)', color: '#86efac', border: '1px solid rgba(34,197,94,0.2)', fontFamily: 'var(--font-sport)', cursor: refreshing ? 'wait' : 'pointer' }}>
                {refreshing ? '⟳ Refrescando…' : '⟳ Refrescar'}
              </button>
              <button onClick={() => setSearchOpen(true)}
                className="text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-opacity hover:opacity-80 inline-flex items-center gap-1.5"
                style={{ background: 'rgba(255,255,255,0.04)', color: '#9090B0', border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'var(--font-sport)', cursor: 'pointer' }}
                aria-label="Buscar (⌘K)">
                🔍 Buscar
                <kbd className="hidden sm:inline text-[9px] font-mono px-1 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: '#5A5A72' }}>⌘K</kbd>
              </button>
              {favorites.size > 0 && (
                <button onClick={() => setShowFavoritesOnly(v => !v)}
                  className="text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-opacity hover:opacity-80 inline-flex items-center gap-1.5"
                  style={{
                    background: showFavoritesOnly ? 'rgba(251,191,36,0.14)' : 'rgba(255,255,255,0.04)',
                    color: showFavoritesOnly ? '#fbbf24' : '#9090B0',
                    border: showFavoritesOnly ? '1px solid rgba(251,191,36,0.32)' : '1px solid rgba(255,255,255,0.08)',
                    fontFamily: 'var(--font-sport)', cursor: 'pointer',
                  }}>
                  {showFavoritesOnly ? '★' : '☆'} Favoritos
                  {favorites.size > 0 && <span className="text-[9px] font-mono px-1 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)' }}>{favorites.size}</span>}
                </button>
              )}
              <button onClick={() => setHideUnavailable(v => !v)}
                className="text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-opacity hover:opacity-80 inline-flex items-center gap-1.5"
                style={{
                  background: hideUnavailable ? 'rgba(255,255,255,0.04)' : 'rgba(248,113,113,0.10)',
                  color: hideUnavailable ? '#9090B0' : '#f87171',
                  border: hideUnavailable ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(248,113,113,0.28)',
                  fontFamily: 'var(--font-sport)', cursor: 'pointer',
                }}
                title={hideUnavailable ? 'Mostrar también bloques sin datos' : 'Ocultar bloques sin datos'}
                aria-pressed={!hideUnavailable}>
                {hideUnavailable ? '⊘ Vacíos' : '⊕ Ver todos'}
              </button>
              {fetchError && (
                <span className="text-[11px]" style={{ color: '#f87171', fontFamily: 'var(--font-sport)' }}>
                  ⚠ {fetchError}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── NAVEGACIÓN STICKY (deporte + sección) ─── */}
        <div className="sticky z-30 -mx-4 sm:-mx-6 xl:-mx-10 px-4 sm:px-6 xl:px-10"
          style={{ top: 56, background: 'var(--bg-base)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>

          {/* TAB 1: DEPORTE — wrap a 2 filas en móvil, scroll horizontal en desktop */}
          <div className="flex flex-wrap sm:flex-nowrap gap-1 sm:overflow-x-auto scrollbar-hide pb-0"
            style={{ borderBottom: '1px solid var(--border)' }}>
            {SPORTS.map(s => {
              const count = sportAvailableCounts[s.id] ?? 0
              const isEmpty = count === 0 && s.id !== 'mundial'
              const isActive = sportId === s.id
              return (
                <button key={s.id} onClick={() => handleSportChange(s.id)}
                  aria-label={isEmpty ? `${s.label}, sin datos verificables hoy` : `${s.label}, ${count} ${count === 1 ? 'bloque' : 'bloques'} con datos`}
                  aria-current={isActive ? 'true' : undefined}
                  className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap"
                  style={{
                    fontFamily: 'var(--font-sport)',
                    color: isActive ? s.accent : s.id === 'mundial' ? '#f59e0b' : 'var(--text-muted)',
                    background: s.id === 'mundial' && !isActive ? 'rgba(245,158,11,0.08)' : 'none',
                    border: 'none',
                    borderBottom: isActive ? `2px solid ${s.accent}` : s.id === 'mundial' ? '2px solid rgba(245,158,11,0.35)' : '2px solid transparent',
                    borderRadius: s.id === 'mundial' && !isActive ? '6px 6px 0 0' : undefined,
                    marginBottom: -1, cursor: 'pointer',
                    opacity: isEmpty && !isActive ? 0.45 : 1,
                  }}
                  title={isEmpty ? `${s.label}: sin datos verificables hoy` : `${s.label}: ${count} bloques con datos`}>
                  <span className="text-sm leading-none">{s.emoji}</span>
                  {s.label}
                  {s.id === 'mundial' && <span className="text-[9px] font-black px-1 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b', letterSpacing: '0.05em' }}>🔜</span>}
                  {s.id !== 'mundial' && count > 0 && (
                    <span className="text-[9px] font-black tabular-nums px-1.5 py-0.5 rounded-full"
                      style={{
                        background: isActive ? `${s.accent}1f` : 'rgba(74,222,128,0.10)',
                        color: isActive ? s.accent : '#4ade80',
                        border: `1px solid ${isActive ? s.accent + '40' : 'rgba(74,222,128,0.25)'}`,
                      }}>
                      {count}
                    </span>
                  )}
                  {s.id !== 'mundial' && isEmpty && (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                      style={{ background: 'rgba(248,113,113,0.10)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }}>
                      —
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* TAB 2: SECCIÓN */}
          {!isFemenino && sport.sections.length > 1 && (
            <div className="py-2.5 flex items-center gap-1 overflow-x-auto scrollbar-hide">
              <div className="flex items-center gap-1 p-1 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                {sport.sections.map(sec => (
                  <button key={sec.id}
                    onClick={() => handleSectionChange(sec.id)}
                    aria-label={`${sec.label}, ${SECTION_BLOCK_COUNT.get(`${sport.id}:${sec.id}`) ?? 0} tablas`}
                    aria-current={sectionId === sec.id ? 'true' : undefined}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                    style={{
                      background: sectionId === sec.id ? `${sport.accent}18` : 'transparent',
                      color: sectionId === sec.id ? sport.accent : '#4A4A6A',
                      border: sectionId === sec.id ? `1px solid ${sport.accent}35` : '1px solid transparent',
                      fontFamily: 'var(--font-sport)', cursor: 'pointer',
                    }}>
                    <span className="text-xs">{sec.icon}</span>
                    {sec.label}
                    <span className="text-[8px] px-1 py-0.5 rounded font-black ml-0.5"
                      style={{ background: sectionId === sec.id ? `${sport.accent}20` : 'rgba(255,255,255,0.05)', color: sectionId === sec.id ? sport.accent : '#3A3A52' }}>
                      {SECTION_BLOCK_COUNT.get(`${sport.id}:${sec.id}`) ?? 0}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RESUMEN — landing cross-sport ───────────── */}
        {sportId === 'resumen' ? (
          <div className="mt-5">
            <ResumenView
              liveData={liveData}
              livePlayerData={livePlayerData}
              lastUpdated={lastUpdated}
              onPickSport={handleSportChange}
            />
          </div>
        ) : null}

        {/* ── Banner Mundial 2026 ─────────────────────── */}
        {sportId === 'mundial' && (
          <div className="mt-5 mb-6 rounded-xl overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(239,68,68,0.08) 100%)', border: '1px solid rgba(245,158,11,0.3)' }}>
            <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span style={{ fontSize: 22 }}>🏆</span>
                  <span className="font-black text-sm uppercase tracking-widest" style={{ fontFamily: 'var(--font-sport)', color: '#f59e0b' }}>
                    FIFA World Cup 2026
                  </span>
                  {WC_START.getTime() - Date.now() <= 0
                    ? null
                    : <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>PRÓXIMO</span>
                  }
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {WC_START.getTime() - Date.now() <= 0
                    ? 'Grupos en juego · Datos en vivo desde ESPN'
                    : '11 jun – 19 jul 2026 · USA, Canadá, México · 48 selecciones · 12 grupos'
                  }
                </p>
              </div>
              <WorldCupCountdown />
            </div>
          </div>
        )}

        {/* ── Toggle Femenino — solo Fútbol ────────────── */}
        {sportId === 'futbol' && (
          <div className="flex items-center gap-1.5 mt-5 mb-5">
            {(['m', 'f'] as const).map(g => {
              const isActive = gender === g
              return (
                <button key={g} onClick={() => {
                  setGender(g); setExpandedBlocks({})
                  if (typeof window !== 'undefined') {
                    window.history.replaceState(
                      { ...window.history.state, tsNav: { sportId, sectionId, gender: g } },
                      '', buildStatsUrl(sportId, sectionId, g === 'f')
                    )
                  }
                }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all"
                  style={{
                    background: isActive ? 'rgba(34,197,94,0.14)' : 'rgba(255,255,255,0.04)',
                    color: isActive ? '#22c55e' : 'var(--text-muted)',
                    border: isActive ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,255,255,0.07)',
                    cursor: 'pointer', fontFamily: 'var(--font-sport)',
                  }}>
                  {g === 'm' ? '♂ Masculino' : '♀ Femenino'}
                </button>
              )
            })}
          </div>
        )}

        {/* ── Fútbol Femenino — grid directo ──────────── */}
        {isFemenino && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-2">
            {applyLive(FUTBOL_FEMENINO_BLOCKS).map(block => (
              <StatBlockBoundary key={block.id} blockId={block.id}>
                <StatBlockCard block={block} accent="#22c55e" expanded={!!expandedBlocks[block.id]} onToggle={() => toggleBlock(block.id)} isLive={isBlockLive(block)} meta={getBlockMeta(block.id, liveData?.meta)} isFav={favorites.has(block.id)} onToggleFav={() => toggleFav(block.id)} />
              </StatBlockBoundary>
            ))}
          </div>
        )}

        {sportId !== 'resumen' && !isFemenino && (isFutbolJugadores || (isFutbol && sectionId === 'competiciones')) && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5 mb-5">
            {LEAGUE_FILTERS.map(liga => (
              <button key={liga} onClick={() => setLeagueFilter(liga)}
                className="flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-semibold transition-all"
                style={{
                  background: leagueFilter === liga ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.03)',
                  color: leagueFilter === liga ? '#86efac' : '#3A3A52',
                  border: leagueFilter === liga ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(255,255,255,0.05)',
                  cursor: 'pointer', fontFamily: 'var(--font-sport)',
                }}>
                {liga}
              </button>
            ))}
          </div>
        )}

        {sportId !== 'resumen' && !isFemenino && hasGroups && section.groups ? (
          <div className="flex flex-col gap-1">
            {section.groups.map(group => (
              <MetricGroupAccordion
                key={group.id}
                group={group}
                accent={sport.accent}
                expanded={!!expandedGroups[group.id]}
                onToggle={() => toggleGroup(group.id)}
                expandedBlocks={expandedBlocks}
                onToggleBlock={toggleBlock}
                leagueFilter={leagueFilter}
                livePlayerData={livePlayerData}
                liveMeta={liveData?.meta}
                favorites={favorites}
                onToggleFav={toggleFav}
                hideUnavailable={hideUnavailable}
              />
            ))}
          </div>
        ) : sportId === 'resumen' ? null : (
          <>
            <div className={`grid gap-5 ${
              sportId === 'mundial' && sectionId === 'grupos'
                ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
                : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'
            }`}>
              {filteredFlatBlocks.map(block => {
                const blockMeta = getBlockMeta(block.id, liveData?.meta, block.cardType)
                const live = isBlockLive(block)
                let inner: React.ReactNode
                if (block.id.startsWith('wc-group-'))
                  inner = <WorldCupGroupCard block={block} accent={sport.accent} isLive={live} meta={blockMeta} />
                else if (block.id === 'wc-knockout' || block.cardType === 'fixtures')
                  inner = <PlayoffSeriesCard block={block} accent={sport.accent} isLive={live} meta={blockMeta} />
                else
                  inner = (
                    <StatBlockCard
                      block={block}
                      accent={sport.accent}
                      expanded={!!expandedBlocks[block.id]}
                      onToggle={() => toggleBlock(block.id)}
                      leagueFilter={leagueFilter}
                      isLive={live}
                      meta={blockMeta}
                      isFav={favorites.has(block.id)}
                      onToggleFav={() => toggleFav(block.id)}
                    />
                  )
                return <StatBlockBoundary key={block.id} blockId={block.id}>{inner}</StatBlockBoundary>
              })}
            </div>
            {filteredFlatBlocks.length === 0 && (
              <div className="py-16 text-center max-w-md mx-auto">
                {hideUnavailable && hiddenFlatCount > 0 ? (
                  <>
                    <p className="text-sm mb-3" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
                      Esta sección no tiene datos verificables en vivo todavía.
                    </p>
                    <p className="text-[11px] mb-4" style={{ color: '#5A5A72', fontFamily: 'var(--font-sport)' }}>
                      Hay {hiddenFlatCount} bloque{hiddenFlatCount !== 1 ? 's' : ''} ocult{hiddenFlatCount !== 1 ? 'os' : 'o'} por falta de fuente gratuita confiable.
                    </p>
                    <button onClick={() => setHideUnavailable(false)}
                      className="text-[11px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full transition-opacity hover:opacity-80"
                      style={{ background: 'rgba(248,113,113,0.10)', color: '#f87171', border: '1px solid rgba(248,113,113,0.28)', fontFamily: 'var(--font-sport)', cursor: 'pointer' }}>
                      ⊕ Ver bloques ocultos
                    </button>
                  </>
                ) : (
                  <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
                    No hay datos disponibles para esta combinación.
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {/* ── ROADMAP ───────────────────────────────── */}
        <div className="mt-14 rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2 mb-5">
            <span className="section-accent" />
            <h2 className="section-label">Próximas integraciones</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              { icon: '📊', label: 'Gráficos de evolución', sub: 'Por temporada' },
              { icon: '⚔️', label: 'Comparativas H2H', sub: 'Jugador vs jugador' },
              { icon: '🗂️', label: 'Fichas individuales', sub: 'Historial completo' },
              { icon: '🌐', label: 'Datos avanzados', sub: 'Opta · StatsBomb · WhoScored' },
              { icon: '📈', label: 'Rendimiento reciente', sub: 'Últimos 5 partidos' },
              { icon: '🏅', label: 'Palmarés histórico', sub: 'Títulos y logros' },
              { icon: '📐', label: 'Mapas de calor', sub: 'Posicionamiento' },
              { icon: '🔔', label: 'Alertas personalizadas', sub: 'Sigue jugadores clave' },
            ].map(({ icon, label, sub }) => (
              <div key={label} className="flex items-start gap-3 px-3.5 py-3 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span className="text-xl flex-shrink-0">{icon}</span>
                <div>
                  <p className="text-xs font-semibold leading-tight" style={{ color: '#A0A0C0', fontFamily: 'var(--font-sport)' }}>{label}</p>
                  <p className="text-[9px] mt-0.5" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      <NewsletterSection source="estadisticas" />
      <ScrollToTop />
    </div>
    </TeamLeagueContext.Provider>
  )
}
