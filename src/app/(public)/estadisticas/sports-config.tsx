'use client'

// Catálogo estático de deportes/secciones/bloques de /estadisticas + aliases de
// equipos y contexto de liga. Extraído del monolito EstadisticasClient.

import React from 'react'
import type { MetricGroup, SportConfig, StatBlock } from './stats-types'


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
// FILTROS
// ─────────────────────────────────────────────────────────────────
export const LEAGUE_FILTERS   = ['General', 'LaLiga', 'Premier League', 'Bundesliga', 'Serie A', 'Ligue 1']

// Short-name aliases that don't appear in ESPN's standings response.
// Used for tables (goleadores, etc.) where the player's `team` field comes
// from a different source (api-sports, editorial) and uses a casual nickname.
export const TEAM_ALIASES: Record<string, string> = {
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
export const TeamLeagueContext = React.createContext<Record<string, string>>(TEAM_ALIASES)

export function buildTeamLeague(football: { label: string; rows: { name: string; abbr?: string }[] }[]): Record<string, string> {
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
export const FUTBOL_JUGADORES_GROUPS: MetricGroup[] = [
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
export const FUTBOL_FEMENINO_BLOCKS: StatBlock[] = [
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
export const WC_GROUPS_FALLBACK = (['A','B','C','D','E','F','G','H','I','J','K','L'] as const).map(L => ({
  id: `wc-group-${L.toLowerCase()}`,
  label: `Grupo ${L}`,
}))

export const SPORTS: SportConfig[] = [
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
      // "Cuadro" es la pestaña de entrada del Mundial (sections[0] = default):
      // la llave de eliminatorias renderizada por <MundialBracket/> (sin StatBlocks).
      { id: 'cuadro', label: 'Cuadro', icon: '🗺️', blocks: [] },
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
        id: 'clasificados', label: 'Clasificados', icon: '✅',
        blocks: [{
          id: 'wc-qualified', title: 'Selecciones clasificadas · 48 plazas',
          metric: 'Grupo', rows: [],
        }],
      },
    ],
  },
  {
    id: 'futbol', label: 'Fútbol', emoji: '⚽', accent: '#34D399',
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
    id: 'tenis', label: 'Tenis', emoji: '🎾', accent: '#E0B33A',
    sections: [
      {
        id: 'atp', label: 'ATP', icon: '👨',
        blocks: [
          {
            // NO MENTIR (misma regla que femenino y "SPORTS COMPLETO"): sin filas
            // hardcodeadas. applyLive rellena desde atpRanking (ESPN
            // /tennis/atp/rankings); si el live no responde, StatBlockCard muestra
            // "Sin datos disponibles" en vez de un ranking caducado como si fuera real.
            id: 'atp-ranking', title: 'Ranking ATP (Top 10)', metric: 'Pts',
            rows: [],
          },
        ],
      },
      {
        id: 'wta', label: 'WTA', icon: '👩',
        blocks: [
          {
            // NO MENTIR: sin filas hardcodeadas. applyLive rellena desde wtaRanking
            // (ESPN /tennis/wta/rankings); si el live no responde, StatBlockCard
            // muestra "Sin datos disponibles" en vez de un ranking caducado.
            id: 'wta-ranking', title: 'Ranking WTA (Top 10)', metric: 'Pts',
            rows: [],
          },
        ],
      },
    ],
  },
  {
    id: 'ufc', label: 'MMA', emoji: '🥊', accent: '#D4AF37',
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

export const SECTION_BLOCK_COUNT = new Map(
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
