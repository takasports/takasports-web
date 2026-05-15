'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Header from '@/components/Header'
import LiveStrip from '@/components/LiveStrip'
import Footer from '@/components/Footer'
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
        rows: [
          { rank: 1, name: 'Erling Haaland',    team: 'Man City',     value: '27', sub: '30 PJ', flag: '🇳🇴', trend: 'up',   extra: { Asist: '8' } },
          { rank: 2, name: 'Kylian Mbappé',     team: 'Real Madrid',  value: '24', sub: '28 PJ', flag: '🇫🇷', trend: 'up',   extra: { Asist: '10' } },
          { rank: 3, name: 'Vinicius Jr',        team: 'Real Madrid',  value: '21', sub: '27 PJ', flag: '🇧🇷', trend: 'flat' },
          { rank: 4, name: 'Lamine Yamal',       team: 'FC Barcelona', value: '18', sub: '30 PJ', flag: '🇪🇸', trend: 'up',   extra: { Asist: '12' } },
          { rank: 5, name: 'Robert Lewandowski', team: 'FC Barcelona', value: '17', sub: '28 PJ', flag: '🇵🇱', trend: 'flat' },
          { rank: 6, name: 'Antoine Griezmann',  team: 'Atlético',     value: '15', sub: '27 PJ', flag: '🇫🇷', trend: 'up',   extra: { Asist: '7' } },
          { rank: 7, name: 'Harry Kane',         team: 'Bayern Munich',value: '14', sub: '26 PJ', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'down' },
          { rank: 8, name: 'Son Heung-min',      team: 'Tottenham',    value: '13', sub: '27 PJ', flag: '🇰🇷', trend: 'flat' },
          { rank: 9, name: 'Raphinha',           team: 'FC Barcelona', value: '13', sub: '28 PJ', flag: '🇧🇷', trend: 'up',   extra: { Asist: '8' } },
          { rank: 10, name: 'Bukayo Saka',       team: 'Arsenal',      value: '12', sub: '28 PJ', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'up',   extra: { Asist: '9' } },
          { rank: 11, name: 'Lautaro Martínez',  team: 'Inter Milán',  value: '22', sub: '27 PJ', flag: '🇦🇷', trend: 'up',   extra: { Asist: '4' } },
          { rank: 12, name: 'Florian Wirtz',     team: 'Leverkusen',   value: '11', sub: '26 PJ', flag: '🇩🇪', trend: 'up',  extra: { Asist: '10' } },
          { rank: 13, name: 'Jonathan David',    team: 'Lille',        value: '24', sub: '28 PJ', flag: '🇨🇦', trend: 'up',  extra: { Asist: '5' } },
          { rank: 14, name: 'Bradley Barcola',   team: 'PSG',          value: '15', sub: '27 PJ', flag: '🇫🇷', trend: 'up',  extra: { Asist: '9' } },
        ],
      },
      {
        id: 'asistencias', title: 'Asistencias', metric: 'Asist.',
        rows: [
          { rank: 1, name: 'Kevin De Bruyne',  team: 'Man City',     value: '16', sub: '25 PJ', flag: '🇧🇪', trend: 'up' },
          { rank: 2, name: 'Pedri',            team: 'FC Barcelona', value: '13', sub: '29 PJ', flag: '🇪🇸', trend: 'up' },
          { rank: 3, name: 'Lamine Yamal',     team: 'FC Barcelona', value: '12', sub: '30 PJ', flag: '🇪🇸', trend: 'up' },
          { rank: 4, name: 'Jude Bellingham',  team: 'Real Madrid',  value: '11', sub: '26 PJ', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'flat' },
          { rank: 5, name: 'Phil Foden',       team: 'Man City',     value: '10', sub: '24 PJ', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'down' },
          { rank: 6, name: 'Raphinha',         team: 'FC Barcelona', value: '9',  sub: '28 PJ', flag: '🇧🇷', trend: 'up' },
          { rank: 7, name: 'Mohamed Salah',    team: 'Liverpool',    value: '9',  sub: '27 PJ', flag: '🇪🇬', trend: 'flat' },
          { rank: 8, name: 'Bukayo Saka',      team: 'Arsenal',      value: '8',  sub: '28 PJ', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'up' },
          { rank: 9, name: 'Florian Wirtz',    team: 'Leverkusen',   value: '8',  sub: '26 PJ', flag: '🇩🇪', trend: 'up' },
          { rank: 10, name: 'Bernardo Silva',  team: 'Man City',     value: '7',  sub: '27 PJ', flag: '🇵🇹', trend: 'flat' },
          { rank: 11, name: 'Ousmane Dembélé', team: 'PSG',          value: '7',  sub: '26 PJ', flag: '🇫🇷', trend: 'up' },
          { rank: 12, name: 'Nicolo Barella',  team: 'Inter Milán',  value: '6',  sub: '25 PJ', flag: '🇮🇹', trend: 'up' },
        ],
      },
    ],
  },
]

// ─────────────────────────────────────────────────────────────────
// DATOS — FÚTBOL FEMENINO
// ─────────────────────────────────────────────────────────────────
const FUTBOL_FEMENINO_BLOCKS: StatBlock[] = [
  {
    id: 'f-goleadoras', title: 'Goleadoras', metric: 'Goles',
    rows: [
      { rank: 1, name: 'Aitana Bonmatí',          team: 'FC Barcelona',   value: '22', sub: '25 PJ', flag: '🇪🇸', trend: 'up',   extra: { Asist: '14' } },
      { rank: 2, name: 'Salma Paralluelo',         team: 'FC Barcelona',   value: '19', sub: '24 PJ', flag: '🇪🇸', trend: 'up',   extra: { Asist: '8' } },
      { rank: 3, name: 'Sam Kerr',                 team: 'Chelsea Women',  value: '17', sub: '22 PJ', flag: '🇦🇺', trend: 'flat' },
      { rank: 4, name: 'Ada Hegerberg',            team: 'Lyon',           value: '16', sub: '20 PJ', flag: '🇳🇴', trend: 'up',   extra: { Asist: '6' } },
      { rank: 5, name: 'Caroline Graham Hansen',   team: 'FC Barcelona',   value: '14', sub: '23 PJ', flag: '🇳🇴', trend: 'flat' },
      { rank: 6, name: 'Pernille Harder',          team: 'Wolfsburg',      value: '13', sub: '22 PJ', flag: '🇩🇰', trend: 'up',   extra: { Asist: '9' } },
      { rank: 7, name: 'Alexia Putellas',          team: 'FC Barcelona',   value: '11', sub: '21 PJ', flag: '🇪🇸', trend: 'up',   extra: { Asist: '10' } },
      { rank: 8, name: 'Mariona Caldentey',        team: 'Arsenal Women',  value: '10', sub: '24 PJ', flag: '🇪🇸', trend: 'up',   extra: { Asist: '8' } },
    ],
  },
  {
    id: 'f-asistencias', title: 'Asistencias', metric: 'Asist.',
    rows: [
      { rank: 1, name: 'Aitana Bonmatí',           team: 'FC Barcelona',  value: '14', sub: '25 PJ', flag: '🇪🇸', trend: 'up' },
      { rank: 2, name: 'Alexia Putellas',           team: 'FC Barcelona',  value: '10', sub: '21 PJ', flag: '🇪🇸', trend: 'up' },
      { rank: 3, name: 'Caroline Graham Hansen',    team: 'FC Barcelona',  value: '12', sub: '23 PJ', flag: '🇳🇴', trend: 'flat' },
      { rank: 4, name: 'Pernille Harder',           team: 'Wolfsburg',     value: '9',  sub: '22 PJ', flag: '🇩🇰', trend: 'up' },
      { rank: 5, name: 'Mariona Caldentey',         team: 'Arsenal Women', value: '8',  sub: '24 PJ', flag: '🇪🇸', trend: 'up' },
      { rank: 6, name: 'Lauren James',              team: 'Chelsea Women', value: '7',  sub: '20 PJ', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'up' },
    ],
  },
  {
    id: 'f-ga90', title: 'G+A por 90 minutos', metric: 'G+A/90',
    rows: [
      { rank: 1, name: 'Aitana Bonmatí',           team: 'FC Barcelona',  value: '1.54', sub: '25 PJ', flag: '🇪🇸', trend: 'up' },
      { rank: 2, name: 'Ada Hegerberg',             team: 'Lyon',          value: '1.42', sub: '20 PJ', flag: '🇳🇴', trend: 'up' },
      { rank: 3, name: 'Salma Paralluelo',          team: 'FC Barcelona',  value: '1.38', sub: '24 PJ', flag: '🇪🇸', trend: 'up' },
      { rank: 4, name: 'Sam Kerr',                  team: 'Chelsea Women', value: '1.24', sub: '22 PJ', flag: '🇦🇺', trend: 'flat' },
      { rank: 5, name: 'Caroline Graham Hansen',    team: 'FC Barcelona',  value: '1.22', sub: '23 PJ', flag: '🇳🇴', trend: 'flat' },
      { rank: 6, name: 'Pernille Harder',           team: 'Wolfsburg',     value: '1.18', sub: '22 PJ', flag: '🇩🇰', trend: 'up' },
    ],
  },
  {
    id: 'f-champions-goleadoras', title: 'Champions F — Goleadoras', metric: 'Goles', league: 'Champions F',
    rows: [
      { rank: 1, name: 'Ada Hegerberg',             team: 'Lyon',          value: '8', sub: '7 PJ',  flag: '🇳🇴', trend: 'up' },
      { rank: 2, name: 'Aitana Bonmatí',            team: 'FC Barcelona',  value: '7', sub: '7 PJ',  flag: '🇪🇸', trend: 'up' },
      { rank: 3, name: 'Sam Kerr',                  team: 'Chelsea Women', value: '6', sub: '6 PJ',  flag: '🇦🇺', trend: 'flat' },
      { rank: 4, name: 'Salma Paralluelo',          team: 'FC Barcelona',  value: '5', sub: '7 PJ',  flag: '🇪🇸', trend: 'up' },
      { rank: 5, name: 'Pernille Harder',           team: 'Wolfsburg',     value: '5', sub: '6 PJ',  flag: '🇩🇰', trend: 'up' },
      { rank: 6, name: 'Lauren Hemp',               team: 'Man City Women',value: '4', sub: '5 PJ',  flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'up' },
    ],
  },
  {
    id: 'f-ligaf-tabla', title: 'Tabla Liga F', metric: 'Puntos', placeholder: false,
    rows: [
      { rank: 1, name: 'FC Barcelona',              value: '72', sub: '26 PJ', trend: 'up',   extra: { V: '24', E: '0', D: '2' } },
      { rank: 2, name: 'Real Madrid',               value: '54', sub: '26 PJ', trend: 'up',   extra: { V: '17', E: '3', D: '6' } },
      { rank: 3, name: 'Atlético Madrid',           value: '49', sub: '26 PJ', trend: 'flat', extra: { V: '15', E: '4', D: '7' } },
      { rank: 4, name: 'Levante',                   value: '44', sub: '26 PJ', trend: 'flat', extra: { V: '13', E: '5', D: '8' } },
      { rank: 5, name: 'Athletic Club',             value: '38', sub: '26 PJ', trend: 'down', extra: { V: '11', E: '5', D: '10' } },
      { rank: 6, name: 'Valencia',                  value: '34', sub: '26 PJ', trend: 'down', extra: { V: '10', E: '4', D: '12' } },
    ],
  },
]

// ─────────────────────────────────────────────────────────────────
// DATOS — SPORTS COMPLETO
// ─────────────────────────────────────────────────────────────────
const WC_GROUPS_FALLBACK = [
  { id: 'wc-group-a', label: 'Grupo A', teams: ['México', 'Chequia', 'Corea del Sur', 'Sudáfrica'] },
  { id: 'wc-group-b', label: 'Grupo B', teams: ['Canadá', 'Bosnia-Herzegovina', 'Suiza', 'Qatar'] },
  { id: 'wc-group-c', label: 'Grupo C', teams: ['Brasil', 'Escocia', 'Haití', 'Marruecos'] },
  { id: 'wc-group-d', label: 'Grupo D', teams: ['Paraguay', 'Turquía', 'Australia', 'Estados Unidos'] },
  { id: 'wc-group-e', label: 'Grupo E', teams: ['Ecuador', 'Alemania', 'Costa de Marfil', 'Curazao'] },
  { id: 'wc-group-f', label: 'Grupo F', teams: ['Países Bajos', 'Suecia', 'Japón', 'Túnez'] },
  { id: 'wc-group-g', label: 'Grupo G', teams: ['Bélgica', 'Irán', 'Egipto', 'Nueva Zelanda'] },
  { id: 'wc-group-h', label: 'Grupo H', teams: ['España', 'Uruguay', 'Arabia Saudita', 'Cabo Verde'] },
  { id: 'wc-group-i', label: 'Grupo I', teams: ['Noruega', 'Francia', 'Senegal', 'Irak'] },
  { id: 'wc-group-j', label: 'Grupo J', teams: ['Argentina', 'Austria', 'Argelia', 'Jordania'] },
  { id: 'wc-group-k', label: 'Grupo K', teams: ['Colombia', 'Portugal', 'Uzbekistán', 'Congo RD'] },
  { id: 'wc-group-l', label: 'Grupo L', teams: ['Inglaterra', 'Croacia', 'Panamá', 'Ghana'] },
]

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
          rows: g.teams.map((name, i) => ({
            rank: i + 1, name, value: '0', sub: 'Sin jugar', trend: 'flat' as const,
            extra: { PJ: '0', V: '0', E: '0', D: '0', GF: '0', GC: '0' },
          })),
        })),
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
          id: 'wc-qualified', title: 'Selecciones clasificadas (Top 16 ranking FIFA)', metric: 'Pos.',
          rows: [
            { rank: 1,  name: 'Argentina',     team: 'CONMEBOL',   value: 'Campeona', sub: 'Defiende título 2022',   flag: '🇦🇷', trend: 'flat' },
            { rank: 2,  name: 'Francia',       team: 'UEFA',       value: 'Top FIFA', sub: 'Subcampeona 2022',       flag: '🇫🇷', trend: 'up' },
            { rank: 3,  name: 'España',        team: 'UEFA',       value: 'Top FIFA', sub: 'Campeona Eurocopa 2024', flag: '🇪🇸', trend: 'up' },
            { rank: 4,  name: 'Inglaterra',    team: 'UEFA',       value: 'Top FIFA', sub: 'Subcampeona Eurocopa 2024', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'flat' },
            { rank: 5,  name: 'Portugal',      team: 'UEFA',       value: 'Top FIFA', sub: 'Campeona Nations League', flag: '🇵🇹', trend: 'up' },
            { rank: 6,  name: 'Brasil',        team: 'CONMEBOL',   value: 'Top FIFA', sub: '5 títulos mundiales',    flag: '🇧🇷', trend: 'down' },
            { rank: 7,  name: 'Países Bajos',  team: 'UEFA',       value: 'Top FIFA', sub: 'Cuartos 2022',           flag: '🇳🇱', trend: 'flat' },
            { rank: 8,  name: 'Alemania',      team: 'UEFA',       value: 'Top FIFA', sub: 'Anfitriona Euro 2024',   flag: '🇩🇪', trend: 'up' },
            { rank: 9,  name: 'EEUU',           team: 'CONCACAF',  value: 'Anfitrión', sub: 'Co-anfitrión',          flag: '🇺🇸', trend: 'flat' },
            { rank: 10, name: 'México',         team: 'CONCACAF',  value: 'Anfitrión', sub: 'Co-anfitrión',          flag: '🇲🇽', trend: 'flat' },
            { rank: 11, name: 'Canadá',         team: 'CONCACAF',  value: 'Anfitrión', sub: 'Co-anfitrión',          flag: '🇨🇦', trend: 'flat' },
            { rank: 12, name: 'Marruecos',      team: 'CAF',       value: 'Top FIFA', sub: 'Semifinalista 2022',     flag: '🇲🇦', trend: 'up' },
          ],
        }],
      },
      {
        id: 'goleadores', label: 'Goleadores', icon: '⚽',
        blocks: [{
          id: 'wc-scorers',
          title: 'Goleadores del Mundial 2026',
          metric: 'Goles',
          placeholder: true,
          rows: [],
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
            id: 'tabla-uecl', title: 'Conference League', metric: 'Pts',
            rows: [
              { rank: 1,  name: 'Chelsea',            value: '—', sub: 'Fase de liga', trend: 'flat' as const, extra: {} },
              { rank: 2,  name: 'Real Betis',          value: '—', sub: 'Fase de liga', trend: 'flat' as const, extra: {} },
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
            id: 'uecl-scorers', title: 'Conference · Goleadores', metric: 'Goles',
            rows: [{ rank: 1, name: 'Cargando…', value: '—', sub: 'ESPN', trend: 'flat' as const }],
          },
          {
            id: 'uecl-assists', title: 'Conference · Asistencias', metric: 'Asist.',
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
            rows: [
              { rank: 1, name: 'Robert Lewandowski', team: 'FC Barcelona', value: '26', sub: '30 PJ', flag: '🇵🇱', trend: 'flat' },
              { rank: 2, name: 'Kylian Mbappé',      team: 'Real Madrid',  value: '21', sub: '27 PJ', flag: '🇫🇷', trend: 'up' },
              { rank: 3, name: 'Vinicius Jr',         team: 'Real Madrid',  value: '16', sub: '26 PJ', flag: '🇧🇷', trend: 'flat' },
              { rank: 4, name: 'Antoine Griezmann',   team: 'Atlético',     value: '15', sub: '28 PJ', flag: '🇫🇷', trend: 'up' },
              { rank: 5, name: 'Lamine Yamal',        team: 'FC Barcelona', value: '12', sub: '30 PJ', flag: '🇪🇸', trend: 'up' },
              { rank: 6, name: 'Alexander Sørloth',   team: 'Villarreal',   value: '11', sub: '26 PJ', flag: '🇳🇴', trend: 'up' },
              { rank: 7, name: 'Gorka Guruzeta',      team: 'Athletic Club',value: '10', sub: '28 PJ', flag: '🇪🇸', trend: 'up' },
            ],
          },
          {
            id: 'bota-oro', title: 'Bota de Oro Europa', metric: 'Goles×2',
            rows: [
              { rank: 1, name: 'Erling Haaland',    team: 'Man City · Premier',    value: '54', sub: '27 goles', flag: '🇳🇴', trend: 'up' },
              { rank: 2, name: 'Harry Kane',         team: 'Bayern · Bundesliga',   value: '52', sub: '26 goles', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'flat' },
              { rank: 3, name: 'Robert Lewandowski', team: 'Barcelona · LaLiga',    value: '52', sub: '26 goles', flag: '🇵🇱', trend: 'up' },
              { rank: 4, name: 'Jonathan David',     team: 'Lille · Ligue 1',       value: '48', sub: '24 goles', flag: '🇨🇦', trend: 'up' },
              { rank: 5, name: 'Lautaro Martínez',   team: 'Inter · Serie A',       value: '44', sub: '22 goles', flag: '🇦🇷', trend: 'up' },
              { rank: 6, name: 'Kylian Mbappé',      team: 'Real Madrid · LaLiga',  value: '42', sub: '21 goles', flag: '🇫🇷', trend: 'up' },
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
          {
            id: 'nations-a1', title: 'Nations League · Grupo A1 (Ed. 2026-27, sep 2026)', metric: 'Pts', placeholder: true,
            rows: [],
          },
          {
            id: 'nations-a2', title: 'Nations League · Grupo A2 (Ed. 2026-27, sep 2026)', metric: 'Pts', placeholder: true,
            rows: [],
          },
          {
            id: 'nations-a3', title: 'Nations League · Grupo A3 (Ed. 2026-27, sep 2026)', metric: 'Pts', placeholder: true,
            rows: [],
          },
          {
            id: 'nations-a4', title: 'Nations League · Grupo A4 (Ed. 2026-27, sep 2026)', metric: 'Pts', placeholder: true,
            rows: [],
          },
        ],
      },
      {
        id: 'entrenadores', label: 'Entrenadores', icon: '🧠',
        blocks: [
          {
            id: 'stats-dt', title: 'Rendimiento entrenadores · % victorias', metric: '% Vic.',
            rows: [
              { rank: 1, name: 'Hansi Flick',        team: 'FC Barcelona', value: '73%', sub: 'Temp. 25/26', flag: '🇩🇪', trend: 'up',   extra: { GF: '2.88', GC: '0.74' } },
              { rank: 2, name: 'Luis Enrique',        team: 'PSG',          value: '70%', sub: 'Temp. 25/26', flag: '🇪🇸', trend: 'up',   extra: { GF: '2.44', GC: '0.82' } },
              { rank: 3, name: 'Pep Guardiola',       team: 'Man City',     value: '68%', sub: 'Temp. 25/26', flag: '🇪🇸', trend: 'flat', extra: { GF: '2.54', GC: '0.74' } },
              { rank: 4, name: 'Mikel Arteta',        team: 'Arsenal',      value: '66%', sub: 'Temp. 25/26', flag: '🇪🇸', trend: 'up',   extra: { GF: '2.41', GC: '0.66' } },
              { rank: 5, name: 'Vincent Kompany',     team: 'Bayern Munich',value: '61%', sub: 'Temp. 25/26', flag: '🇧🇪', trend: 'up',   extra: { GF: '2.31', GC: '0.98' } },
              { rank: 6, name: 'Diego Simeone',       team: 'Atlético',     value: '58%', sub: 'Temp. 25/26', flag: '🇦🇷', trend: 'flat', extra: { GF: '1.82', GC: '0.91' } },
              { rank: 7, name: 'Arne Slot',           team: 'Liverpool',    value: '53%', sub: 'Temp. 25/26', flag: '🇳🇱', trend: 'flat', extra: { GF: '1.74', GC: '1.12' } },
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
        id: 'playoffs', label: 'Playoffs', icon: '🏆',
        blocks: [{
          id: 'nba-playoffs',
          title: 'Series de Playoffs NBA',
          metric: 'Serie',
          rows: [
            { rank: 1, name: 'PHI @ NYK', value: '2-1', sub: 'Game 4 · 7:30 PM ET', trend: 'flat' as const, extra: { Serie: 'NY leads series 2-1', Estado: 'Programado' } },
            { rank: 2, name: 'MIN @ SA',  value: '1-1', sub: 'Game 3 · 9:30 PM ET', trend: 'flat' as const, extra: { Serie: 'Series tied 1-1',    Estado: 'Programado' } },
          ],
        }],
      },
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
          rows: [
            { rank: 1, name: 'GP de Mónaco · Mónaco',          value: '24 may', sub: 'R5 · Circuit de Monaco', trend: 'up' },
            { rank: 2, name: 'GP de España · Barcelona',       value: '7 jun',  sub: 'R6 · Catalunya',          trend: 'flat' },
            { rank: 3, name: 'GP de Canadá · Montreal',        value: '14 jun', sub: 'R7 · Gilles Villeneuve',  trend: 'flat' },
            { rank: 4, name: 'GP de Austria · Spielberg',      value: '28 jun', sub: 'R8 · Red Bull Ring',      trend: 'flat' },
            { rank: 5, name: 'GP de Gran Bretaña · Silverstone',value: '5 jul',  sub: 'R9 · Silverstone',        trend: 'flat' },
          ],
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
      {
        id: 'grand-slams', label: 'Grand Slams', icon: '🏆',
        blocks: [{
          id: 'tenis-slams', title: 'Calendario Grand Slams 2026', metric: 'Fecha',
          rows: [
            { rank: 1, name: 'Australian Open · Melbourne',  value: '19 ene – 1 feb', sub: 'Pista dura · Completado',  trend: 'flat' },
            { rank: 2, name: 'Roland Garros · París',         value: '24 may – 7 jun', sub: 'Tierra batida · Próximo',  trend: 'up' },
            { rank: 3, name: 'Wimbledon · Londres',           value: '29 jun – 12 jul', sub: 'Hierba',                  trend: 'flat' },
            { rank: 4, name: 'US Open · Nueva York',          value: '24 ago – 6 sep', sub: 'Pista dura',               trend: 'flat' },
          ],
        }],
      },
    ],
  },
  {
    id: 'ufc', label: 'UFC', emoji: '🥊', accent: '#f97316',
    sections: [
      {
        id: 'ranking-ufc', label: 'Rankings', icon: '🏆',
        blocks: [
          {
            id: 'ufc-p4p', title: 'Pound for Pound (Top 10)', metric: 'Pos.',
            rows: [
              { rank: 1, name: 'Cargando…', value: '—', sub: 'ufc.com', trend: 'flat' as const },
            ],
          },
          {
            id: 'ufc-campeones', title: 'Campeones actuales por división', metric: 'División',
            rows: [{ rank: 1, name: 'Cargando…', value: '—', sub: 'ufc.com', trend: 'flat' as const }],
          },
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
          rows: [
            { rank: 1, name: 'Marc Márquez',    team: 'Ducati Lenovo',     value: '171', sub: 'Temp. 2026 · R5', flag: '🇪🇸', trend: 'up',   extra: { Vic: '4', Podios: '5' } },
            { rank: 2, name: 'Pecco Bagnaia',   team: 'Ducati Lenovo',     value: '120', sub: 'Temp. 2026 · R5', flag: '🇮🇹', trend: 'flat', extra: { Vic: '1', Podios: '3' } },
            { rank: 3, name: 'Álex Márquez',    team: 'Gresini Ducati',    value: '108', sub: 'Temp. 2026 · R5', flag: '🇪🇸', trend: 'up',   extra: { Vic: '0', Podios: '4' } },
            { rank: 4, name: 'Jorge Martín',    team: 'Aprilia Racing',    value: '79',  sub: 'Temp. 2026 · R5', flag: '🇪🇸', trend: 'up',   extra: { Vic: '0', Podios: '2' } },
            { rank: 5, name: 'Pedro Acosta',    team: 'KTM Factory',       value: '72',  sub: 'Temp. 2026 · R5', flag: '🇪🇸', trend: 'up',   extra: { Vic: '0', Podios: '2' } },
            { rank: 6, name: 'Marco Bezzecchi', team: 'Aprilia Racing',    value: '64',  sub: 'Temp. 2026 · R5', flag: '🇮🇹', trend: 'flat', extra: { Vic: '0', Podios: '1' } },
            { rank: 7, name: 'Fabio Quartararo', team: 'Yamaha Factory',   value: '48',  sub: 'Temp. 2026 · R5', flag: '🇫🇷', trend: 'flat', extra: { Vic: '0', Podios: '0' } },
          ],
        }],
      },
      {
        id: 'constructores-motogp', label: 'Constructores', icon: '🏗️',
        blocks: [{
          id: 'motogp-constructores', title: 'Campeonato Constructores', metric: 'Pts',
          rows: [
            { rank: 1, name: 'Ducati',  value: '291', sub: 'Temp. 2026 · R5', trend: 'up' },
            { rank: 2, name: 'Aprilia', value: '143', sub: 'Temp. 2026 · R5', trend: 'up' },
            { rank: 3, name: 'KTM',     value: '95',  sub: 'Temp. 2026 · R5', trend: 'flat' },
            { rank: 4, name: 'Yamaha',  value: '54',  sub: 'Temp. 2026 · R5', trend: 'down' },
            { rank: 5, name: 'Honda',   value: '38',  sub: 'Temp. 2026 · R5', trend: 'down' },
          ],
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
  if (rank === 1) return <span className="text-sm leading-none">🥇</span>
  if (rank === 2) return <span className="text-sm leading-none">🥈</span>
  if (rank === 3) return <span className="text-sm leading-none">🥉</span>
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

function BlockJsonLd({ block, rows }: { block: StatBlock; rows: StatRow[] }) {
  // Emit a structured ItemList per stats block so search engines can parse rankings.
  // Only produce schema for blocks with real data and where ranks are meaningful.
  if (!rows.length || block.placeholder) return null
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
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const diff = WC_START.getTime() - now.getTime()
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
            {String(v).padStart(2, '0')}
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
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                {row.flag && <span className="text-xs leading-none flex-shrink-0">{row.flag}</span>}
                <span className="font-semibold text-[13px] truncate" style={{ color: '#E0E0F0', fontFamily: 'var(--font-display)' }}>
                  {row.name}
                </span>
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
      <BlockJsonLd block={block} rows={displayRows} />
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
        <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
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
  'tabla-laliga', 'tabla-premier', 'tabla-serie-a', 'tabla-bundesliga', 'tabla-ligue1', 'tabla-ucl', 'tabla-uel', 'tabla-uecl',
  'nba-este', 'nba-oeste',
  'f1-campeonato', 'f1-constructores', 'f1-poles', 'f1-calendario',
  'atp-ranking', 'wta-ranking',
  'goles-equipo', 'menos-goles',
  'ranking-fifa',
  'ufc-p4p', 'ufc-campeones',
  'nba-scoring', 'nba-rebounds', 'nba-assists', 'nba-blocks', 'nba-steals', 'nba-efficiency', 'nba-3pt',
  'nba-mvp-race', 'nba-dpoy-race', 'nba-rookie-race',
  'ucl-scorers', 'uel-scorers', 'uecl-scorers', 'ucl-assists', 'uel-assists', 'uecl-assists',
  'f-ligaf-tabla', 'f-goleadoras', 'f-asistencias',
  'nations-a1', 'nations-a2', 'nations-a3', 'nations-a4',
  'stats-dt',
  'ufc-p4p',
  // World Cup 2026 — grupos A-L + goleadores
  'wc-group-a', 'wc-group-b', 'wc-group-c', 'wc-group-d',
  'wc-group-e', 'wc-group-f', 'wc-group-g', 'wc-group-h',
  'wc-group-i', 'wc-group-j', 'wc-group-k', 'wc-group-l',
  'wc-scorers',
  'wc-knockout',
  'wc-qualified',
  // NBA Playoffs
  'nba-playoffs',
  // Snapshots auto-actualizados (cron Vercel)
  'motogp-pilotos', 'motogp-constructores',
  'tenis-slams',
])

interface LiveStandingRow {
  rank: number; name: string; abbr: string; value: string; sub: string
  trend?: 'up' | 'down' | 'flat'; extra: Record<string, string>
  flag?: string
}
interface LiveLeague { id: string; label: string; rows: LiveStandingRow[] }
type FreshnessStatus = 'live' | 'stale' | 'historical' | 'unavailable'
interface BlockMeta { status: FreshnessStatus; source: string; fetchedAt: string; asOf?: string }
interface LiveStandingsData {
  football: LiveLeague[]
  f1Drivers: LiveStandingRow[]; f1Constructors: LiveStandingRow[]
  f1Poles: LiveStandingRow[];   f1FastestLaps: LiveStandingRow[]
  nbaEast: LiveStandingRow[];   nbaWest: LiveStandingRow[]
  nbaScoring: LiveStandingRow[];nbaRebounds: LiveStandingRow[]
  nbaAssists: LiveStandingRow[];nbaBlocks: LiveStandingRow[]
  nbaSteals: LiveStandingRow[]; nbaEfficiency: LiveStandingRow[]
  nba3ptMade: LiveStandingRow[]
  atpRanking: LiveStandingRow[]; wtaRanking: LiveStandingRow[]
  fifaRanking: LiveStandingRow[]
  ufcP4P: LiveStandingRow[]
  ufcChampions?: LiveStandingRow[]
  womenLigaF: LiveStandingRow[]
  womenGoals: LiveStandingRow[]; womenAssists: LiveStandingRow[]
  nationsLeague?: LiveLeague[]
  coachesWinRate?: LiveStandingRow[]
  worldCup?: LiveLeague[]
  worldCupScorers?: LiveStandingRow[]
  worldCupKnockout?: LiveStandingRow[]
  nbaPlayoffSeries?: LiveStandingRow[]
  uclFixtures?: LiveStandingRow[]
  uelFixtures?: LiveStandingRow[]
  ueclFixtures?: LiveStandingRow[]
  // Nuevos automatizados
  f1Calendar?: LiveStandingRow[]
  nbaMvpRace?: LiveStandingRow[]
  nbaDpoyRace?: LiveStandingRow[]
  nbaRookieRace?: LiveStandingRow[]
  uclScorers?: LiveStandingRow[]
  uelScorers?: LiveStandingRow[]
  ueclScorers?: LiveStandingRow[]
  uclAssists?: LiveStandingRow[]
  uelAssists?: LiveStandingRow[]
  ueclAssists?: LiveStandingRow[]
  worldCupQualified?: LiveStandingRow[]
  motogpRiders?: LiveStandingRow[]
  motogpConstructors?: LiveStandingRow[]
  tennisSlams?: LiveStandingRow[]
  meta?: Record<string, BlockMeta>
  updatedAt?: string
}

// Map block.id -> standings payload key (for meta lookup)
const BLOCK_TO_META_KEY: Record<string, string> = {
  'tabla-laliga': 'football', 'tabla-premier': 'football', 'tabla-serie-a': 'football',
  'tabla-bundesliga': 'football', 'tabla-ligue1': 'football', 'tabla-ucl': 'football', 'tabla-uel': 'football', 'tabla-uecl': 'football',
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
  'f-ligaf-tabla': 'womenLigaF', 'f-goleadoras': 'womenGoals', 'f-asistencias': 'womenAssists',
  'nations-a1': 'nationsLeague', 'nations-a2': 'nationsLeague', 'nations-a3': 'nationsLeague', 'nations-a4': 'nationsLeague',
  'stats-dt': 'coachesWinRate',
  'wc-group-a': 'worldCup', 'wc-group-b': 'worldCup', 'wc-group-c': 'worldCup',
  'wc-group-d': 'worldCup', 'wc-group-e': 'worldCup', 'wc-group-f': 'worldCup',
  'wc-group-g': 'worldCup', 'wc-group-h': 'worldCup', 'wc-group-i': 'worldCup',
  'wc-group-j': 'worldCup', 'wc-group-k': 'worldCup', 'wc-group-l': 'worldCup',
  'wc-scorers':  'worldCupScorers',
  'wc-knockout': 'worldCupKnockout',
  'wc-qualified': 'worldCupQualified',
  'nba-playoffs': 'nbaPlayoffSeries',
  'f1-calendario': 'f1Calendar',
  'nba-mvp-race': 'nbaMvpRace',
  'nba-dpoy-race': 'nbaDpoyRace',
  'nba-rookie-race': 'nbaRookieRace',
  'ucl-scorers': 'uclScorers', 'uel-scorers': 'uelScorers', 'uecl-scorers': 'ueclScorers',
  'ucl-assists': 'uclAssists', 'uel-assists': 'uelAssists', 'uecl-assists': 'ueclAssists',
  'motogp-pilotos': 'motogpRiders',
  'motogp-constructores': 'motogpConstructors',
  'tenis-slams': 'tennisSlams',
}

// (Histórico/estimated block sets removidos: la web ya no muestra bloques editoriales.)
const HISTORICAL_PLAYER_BLOCK_IDS = new Set<string>()
const STATIC_STALE_BLOCK_IDS = new Set<string>()

const FIXTURE_META_KEY: Record<string, string> = {
  'tabla-ucl': 'uclFixtures', 'tabla-uel': 'uelFixtures', 'tabla-uecl': 'ueclFixtures',
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
interface PlayerLeader { name: string; team: string; value: number; matches: number; extra?: Record<string, string> }
interface LeaguePlayerData {
  id: string; label: string
  goals: PlayerLeader[]; assists: PlayerLeader[]
  yellowCards: PlayerLeader[]; redCards: PlayerLeader[]
  shots: PlayerLeader[]; goalsPerGame: PlayerLeader[]
}
interface LivePlayerData { leagues: LeaguePlayerData[] }

// IDs of blocks that get player-stats live data (ESPN /statistics)
const LIVE_PLAYER_BLOCK_IDS = new Set([
  'pichichi-laliga', 'bota-oro', 'goleadores', 'asistencias',
])

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

  if (block.id === 'pichichi-laliga') {
    const lg = leagues.find(l => l.id === 'esp.1')
    if (!lg?.goals.length) return { block, isLive: false }
    return { isLive: true, block: { ...block, rows: lg.goals.slice(0, 10).map((g, i) => ({
      rank: i + 1, name: g.name, team: g.team,
      value: g.value.toString(), sub: `${g.matches} PJ`, trend: 'flat' as const,
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
    }))}}
  }

  // API-Sports data covers season 2024 only (free tier). Return isLive: false so badge shows "Hist · 24/25", not "● LIVE"
  if (block.id === 'tarjetas-amarillas') {
    const all = leagues
      .flatMap(l => (l.yellowCards ?? []).slice(0, 5).map(g => ({ ...g })))
      .sort((a, b) => b.value - a.value).slice(0, 10)
    if (!all.length) return { block, isLive: false }
    return { isLive: false, block: { ...block, rows: all.map((g, i) => ({
      rank: i + 1, name: g.name, team: g.team,
      value: g.value.toString(), sub: `${g.matches} PJ`, trend: 'flat' as const,
    }))}}
  }

  if (block.id === 'tarjetas-rojas') {
    const all = leagues
      .flatMap(l => (l.redCards ?? []).slice(0, 5).map(g => ({ ...g })))
      .sort((a, b) => b.value - a.value).slice(0, 8)
    if (!all.length) return { block, isLive: false }
    return { isLive: false, block: { ...block, rows: all.map((g, i) => ({
      rank: i + 1, name: g.name, team: g.team,
      value: g.value.toString(), sub: `${g.matches} PJ`, trend: 'flat' as const,
    }))}}
  }

  if (block.id === 'tiros-puerta') {
    const all = leagues
      .flatMap(l => (l.shots ?? []).slice(0, 5).map(g => ({ ...g })))
      .sort((a, b) => b.value - a.value).slice(0, 8)
    if (!all.length) return { block, isLive: false }
    return { isLive: false, block: { ...block, rows: all.map((g, i) => ({
      rank: i + 1, name: g.name, team: g.team,
      value: g.value.toFixed(1), sub: `${g.matches} PJ`, trend: 'flat' as const,
    }))}}
  }

  if (block.id === 'goles-90') {
    const all = leagues
      .flatMap(l => (l.goalsPerGame ?? []).slice(0, 5).map(g => ({ ...g })))
      .sort((a, b) => b.value - a.value).slice(0, 8)
    if (!all.length) return { block, isLive: false }
    return { isLive: false, block: { ...block, rows: all.map((g, i) => ({
      rank: i + 1, name: g.name, team: g.team,
      value: g.value.toFixed(2), sub: `${g.matches} PJ`, trend: 'flat' as const,
    }))}}
  }

  return { block, isLive: false }
}

function toStatRows(rows: LiveStandingRow[], teamKey?: string): StatRow[] {
  return rows.map(r => ({
    rank: r.rank, name: r.name,
    team: teamKey ? r.extra[teamKey] : r.abbr || undefined,
    flag: r.flag,
    value: r.value, sub: r.sub, trend: r.trend ?? 'flat',
    extra: Object.fromEntries(Object.entries(r.extra).filter(([k]) => k !== teamKey)),
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
}

function buildSummaryCards(
  liveData: LiveStandingsData | null,
  livePlayerData: LivePlayerData | null,
): SummaryCard[] {
  const cards: SummaryCard[] = []
  const meta = liveData?.meta ?? {}

  // ⚽ Goleadores LaLiga (ESPN, vivo)
  const laliga = livePlayerData?.leagues.find(l => l.id === 'laliga')
  if (laliga && laliga.goals.length) {
    cards.push({
      sportId: 'futbol', sportLabel: 'LaLiga', emoji: '⚽', accent: '#22c55e',
      title: 'Goleadores LaLiga', metric: 'Goles',
      rows: laliga.goals.slice(0, 3).map((p, i) => ({
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
      rows: laligaTable.rows.slice(0, 3).map(r => ({
        rank: r.rank, name: r.name, sub: r.sub, value: r.value,
      })),
      meta: meta['tabla-laliga'] ?? meta['football'],
      sectionTarget: 'competiciones',
    })
  }

  // 🏀 NBA scoring leaders
  if (liveData?.nbaScoring?.length) {
    cards.push({
      sportId: 'baloncesto', sportLabel: 'NBA', emoji: '🏀', accent: '#ef4444',
      title: 'NBA · Anotadores', metric: 'PPP',
      rows: liveData.nbaScoring.slice(0, 3).map(r => ({
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
      rows: liveData.nbaEast.slice(0, 3).map(r => ({
        rank: r.rank, name: r.name, sub: r.sub, value: r.value,
      })),
      meta: meta.nbaEast,
      sectionTarget: 'conferencias',
    })
  }

  // 🏎️ F1 pilotos
  if (liveData?.f1Drivers?.length) {
    cards.push({
      sportId: 'f1', sportLabel: 'Fórmula 1', emoji: '🏎️', accent: '#f97316',
      title: 'F1 · Mundial Pilotos', metric: 'Pts',
      rows: liveData.f1Drivers.slice(0, 3).map(r => ({
        rank: r.rank, name: r.name, sub: r.abbr, value: r.value, flag: r.flag,
      })),
      meta: meta.f1Drivers,
      sectionTarget: 'campeonato',
    })
  }

  // 🎾 ATP top
  if (liveData?.atpRanking?.length) {
    cards.push({
      sportId: 'tenis', sportLabel: 'ATP', emoji: '🎾', accent: '#84cc16',
      title: 'Tenis · ATP Ranking', metric: 'Pts',
      rows: liveData.atpRanking.slice(0, 3).map(r => ({
        rank: r.rank, name: r.name, sub: r.abbr, value: r.value, flag: r.flag,
      })),
      meta: meta.atpRanking,
      sectionTarget: 'ranking',
    })
  }

  // 🌍 Mundial 2026: clasificados destacados
  if (liveData?.worldCupQualified?.length) {
    cards.push({
      sportId: 'mundial', sportLabel: 'Mundial 2026', emoji: '🌍', accent: '#f59e0b',
      title: 'Mundial 2026 · Top selecciones', metric: 'Ranking',
      rows: liveData.worldCupQualified.slice(0, 3).map(r => ({
        rank: r.rank, name: r.name, sub: r.sub, value: r.value, flag: r.flag,
      })),
      meta: meta.worldCupQualified,
      sectionTarget: 'clasificados',
    })
  }

  // ⚽ Femenino: goleadoras
  if (liveData?.womenGoals?.length) {
    cards.push({
      sportId: 'futbol', sportLabel: 'Liga F', emoji: '⚽', accent: '#ec4899',
      title: 'Liga F · Goleadoras', metric: 'Goles',
      rows: liveData.womenGoals.slice(0, 3).map(r => ({
        rank: r.rank, name: r.name, sub: r.abbr, value: r.value,
      })),
      meta: meta.womenGoals,
      sectionTarget: 'femenino',
    })
  }

  // 🏍️ MotoGP: pilotos top 3
  if (liveData?.motogpRiders?.length) {
    cards.push({
      sportId: 'motogp', sportLabel: 'MotoGP', emoji: '🏍️', accent: '#dc2626',
      title: 'MotoGP · Mundial Pilotos', metric: 'Pts',
      rows: liveData.motogpRiders.slice(0, 3).map(r => ({
        rank: r.rank, name: r.name, sub: r.abbr, value: r.value, flag: r.flag,
      })),
      meta: meta.motogpRiders,
      sectionTarget: 'pilotos-motogp',
    })
  }

  // 🥊 UFC P4P top 3
  if (liveData?.ufcP4P?.length) {
    cards.push({
      sportId: 'ufc', sportLabel: 'UFC', emoji: '🥊', accent: '#f97316',
      title: 'UFC · Pound for Pound', metric: 'Pos.',
      rows: liveData.ufcP4P.slice(0, 3).map(r => ({
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
      rows: liveData.fifaRanking.slice(0, 3).map(r => ({
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
      className="text-left rounded-2xl p-4 transition-all hover:brightness-110 active:scale-[0.99]"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', cursor: 'pointer' }}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base leading-none">{card.emoji}</span>
          <h3 className="font-black text-[13px] truncate"
            style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
            {card.title}
          </h3>
        </div>
        <FreshnessBadge isLive={card.meta?.status === 'live'} meta={card.meta} />
      </div>
      <div className="flex flex-col gap-1.5">
        {card.rows.map(r => (
          <div key={r.rank} className="flex items-center gap-2 py-1"
            style={{ borderBottom: r.rank < 3 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
            <div className="w-6 flex-shrink-0"><MedalBadge rank={r.rank} /></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                {r.flag && <span className="text-[11px] leading-none flex-shrink-0">{r.flag}</span>}
                <span className="font-semibold text-[12px] truncate" style={{ color: '#E0E0F0', fontFamily: 'var(--font-display)' }}>
                  {r.name}
                </span>
              </div>
              {r.sub && (
                <span className="block text-[10px] truncate" style={{ color: '#7A7A92', fontFamily: 'var(--font-sport)' }}>
                  {r.sub}
                </span>
              )}
            </div>
            <span className="font-black tabular-nums text-[13px] flex-shrink-0"
              style={{ color: r.rank === 1 ? card.accent : '#8080A0', fontFamily: 'var(--font-display)' }}>
              {r.value}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-right"
        style={{ color: card.accent, fontFamily: 'var(--font-sport)' }}>
        Ver {card.sportLabel} →
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
  onPickSport: (sportId: string, sectionId?: string) => void
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
      <div className="mb-4 px-1 flex flex-wrap items-center gap-3 text-[11px]"
        style={{ color: '#7A7A92', fontFamily: 'var(--font-sport)' }}>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#4ade80' }} />
          <strong style={{ color: '#86efac' }}>{liveCount}</strong> en vivo
        </span>
        {histCount > 0 && (
          <span>· <strong style={{ color: '#94a3b8' }}>{histCount}</strong> snapshot</span>
        )}
        {lastUpdated && (
          <span>· última carga {lastUpdated.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
        )}
      </div>

      {cards.length === 0 ? (
        <div className="py-12 text-center" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
          Aún no hay datos cargados. Refresca en unos segundos.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cards.map((c, i) => (
            <ResumenCard key={`${c.sportId}-${c.title}-${i}`} card={c}
              onOpen={() => onPickSport(c.sportId, c.sectionTarget)} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function EstadisticasClient({ initialData }: { initialData?: LiveStandingsData | null }) {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [sportId, setSportId] = useState<string>(() => {
    const sp = searchParams.get('sport') ?? ''
    return SPORTS.find(s => s.id === sp) ? sp : 'resumen'
  })
  const [sectionId, setSectionId] = useState<string>(() => {
    const sp = searchParams.get('sport') ?? 'resumen'
    const sec = searchParams.get('section') ?? ''
    const sport = SPORTS.find(s => s.id === sp) ?? SPORTS[0]
    return sport.sections.find(s => s.id === sec) ? sec : sport.sections[0].id
  })
  const [expandedBlocks, setExpandedBlocks]   = useState<Record<string, boolean>>({})
  const [expandedGroups, setExpandedGroups]   = useState<Record<string, boolean>>(() => {
    const firstGroupId = SPORTS[0].sections[0].groups?.[0]?.id
    return firstGroupId ? { [firstGroupId]: true } : {}
  })
  const [leagueFilter, setLeagueFilter]       = useState('General')
  const [gender, setGender]                   = useState<'m' | 'f'>('m')
  const [liveData, setLiveData]               = useState<LiveStandingsData | null>(initialData ?? null)
  const [livePlayerData, setLivePlayerData]   = useState<LivePlayerData | null>(null)
  const [lastUpdated, setLastUpdated]         = useState<Date | null>(initialData ? new Date() : null)
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
    if (!initialData) fetchStandings()
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
        const league = liveData.football.find(l => l.id === block.id)
        if (league?.rows.length) return { ...block, rows: toStatRows(league.rows), placeholder: false }
        // Knockout phase: standings empty → fallback to live fixtures
        if (block.id === 'tabla-ucl' && liveData.uclFixtures?.length)
          return { ...block, title: 'Champions League · Fase KO', rows: toStatRows(liveData.uclFixtures), placeholder: false, cardType: 'fixtures' }
        if (block.id === 'tabla-uel' && liveData.uelFixtures?.length)
          return { ...block, title: 'Europa League · Fase KO', rows: toStatRows(liveData.uelFixtures), placeholder: false, cardType: 'fixtures' }
        if (block.id === 'tabla-uecl' && liveData.ueclFixtures?.length)
          return { ...block, title: 'Conference League · Fase KO', rows: toStatRows(liveData.ueclFixtures), placeholder: false, cardType: 'fixtures' }
        if (block.id === 'nba-este'        && liveData.nbaEast.length)         return { ...block, rows: toStatRows(liveData.nbaEast) }
        if (block.id === 'nba-oeste'       && liveData.nbaWest.length)         return { ...block, rows: toStatRows(liveData.nbaWest) }
        if (block.id === 'f1-campeonato'   && liveData.f1Drivers.length)       return { ...block, rows: toStatRows(liveData.f1Drivers, 'Escudería') }
        if (block.id === 'f1-constructores'&& liveData.f1Constructors.length)  return { ...block, rows: toStatRows(liveData.f1Constructors) }
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
        if (block.id.startsWith('nations-') && liveData.nationsLeague?.length) {
          const group = liveData.nationsLeague.find(g => g.id === block.id)
          if (group?.rows.length) return { ...block, rows: toStatRows(group.rows) }
        }

        if (block.id === 'goles-equipo') {
          const allTeams = liveData.football.flatMap(league =>
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
          const allTeams = liveData.football.flatMap(league =>
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

        if (block.id.startsWith('wc-group-') && liveData.worldCup?.length) {
          const group = liveData.worldCup.find(g => g.id === block.id)
          if (group?.rows.length) return { ...block, rows: toStatRows(group.rows) }
        }
        if (block.id === 'wc-scorers' && liveData.worldCupScorers?.length)
          return { ...block, rows: toStatRows(liveData.worldCupScorers), placeholder: false }
        if (block.id === 'wc-knockout' && liveData.worldCupKnockout?.length)
          return { ...block, rows: toStatRows(liveData.worldCupKnockout), placeholder: false }
        if (block.id === 'nba-playoffs' && liveData.nbaPlayoffSeries?.length)
          return { ...block, rows: toStatRows(liveData.nbaPlayoffSeries), placeholder: false }

        // ── Nuevos automatizados ────────────────────────────────────────
        if (block.id === 'f1-calendario'    && liveData.f1Calendar?.length)        return { ...block, rows: toStatRows(liveData.f1Calendar) }
        if (block.id === 'nba-mvp-race'     && liveData.nbaMvpRace?.length)        return { ...block, rows: toStatRows(liveData.nbaMvpRace) }
        if (block.id === 'nba-dpoy-race'    && liveData.nbaDpoyRace?.length)       return { ...block, rows: toStatRows(liveData.nbaDpoyRace) }
        if (block.id === 'nba-rookie-race'  && liveData.nbaRookieRace?.length)     return { ...block, rows: toStatRows(liveData.nbaRookieRace) }
        if (block.id === 'ucl-scorers'      && liveData.uclScorers?.length)        return { ...block, rows: toStatRows(liveData.uclScorers) }
        if (block.id === 'uel-scorers'      && liveData.uelScorers?.length)        return { ...block, rows: toStatRows(liveData.uelScorers) }
        if (block.id === 'uecl-scorers'     && liveData.ueclScorers?.length)       return { ...block, rows: toStatRows(liveData.ueclScorers) }
        if (block.id === 'ucl-assists'      && liveData.uclAssists?.length)        return { ...block, rows: toStatRows(liveData.uclAssists) }
        if (block.id === 'uel-assists'      && liveData.uelAssists?.length)        return { ...block, rows: toStatRows(liveData.uelAssists) }
        if (block.id === 'uecl-assists'     && liveData.ueclAssists?.length)       return { ...block, rows: toStatRows(liveData.ueclAssists) }
        if (block.id === 'wc-qualified'     && liveData.worldCupQualified?.length) return { ...block, rows: toStatRows(liveData.worldCupQualified) }
        if (block.id === 'motogp-pilotos'        && liveData.motogpRiders?.length)        return { ...block, rows: toStatRows(liveData.motogpRiders, 'Escudería') }
        if (block.id === 'motogp-constructores'  && liveData.motogpConstructors?.length)  return { ...block, rows: toStatRows(liveData.motogpConstructors) }
        if (block.id === 'tenis-slams'           && liveData.tennisSlams?.length)         return { ...block, rows: toStatRows(liveData.tennisSlams) }
      }
      // Player stats data
      if (livePlayerData && LIVE_PLAYER_BLOCK_IDS.has(block.id)) {
        const { block: updated, isLive } = applyLivePlayerToBlock(block, livePlayerData, leagueFilter)
        if (isLive) return updated
      }
      return block
    })
  }

  function isBlockLive(block: StatBlock): boolean {
    const metaKey = block.cardType === 'fixtures'
      ? ({ 'tabla-ucl': 'uclFixtures', 'tabla-uel': 'uelFixtures', 'tabla-uecl': 'ueclFixtures' } as Record<string, string>)[block.id] ?? BLOCK_TO_META_KEY[block.id]
      : BLOCK_TO_META_KEY[block.id]
    const meta = liveData?.meta?.[metaKey]
    if (meta?.status === 'unavailable' || meta?.status === 'stale') return false
    if (liveData && LIVE_BLOCK_IDS.has(block.id) && block.rows.length > 0) return true
    if (livePlayerData && LIVE_PLAYER_BLOCK_IDS.has(block.id) && block.rows.length > 0) return true
    return false
  }

  const sport = SPORTS.find(s => s.id === sportId) ?? SPORTS[0]
  const isFemenino = gender === 'f' && sportId === 'futbol'

  const handleSportChange = (id: string, targetSection?: string) => {
    const nextSport = SPORTS.find(s => s.id === id)
    const sec = (targetSection && nextSport?.sections.find(s => s.id === targetSection))
      ? nextSport.sections.find(s => s.id === targetSection)!
      : nextSport?.sections[0]
    setSportId(id)
    setGender('m')
    setSectionId(sec?.id ?? 'jugadores')
    setExpandedBlocks({})
    setExpandedGroups(sec?.groups ? { [sec.groups[0]?.id ?? '']: true } : {})
    setLeagueFilter('General')
    const qs = sec ? `?sport=${id}&section=${sec.id}` : `?sport=${id}`
    router.push(`/estadisticas${qs}`, { scroll: false })
  }

  const handleSectionChange = (id: string) => {
    const sec = sport.sections.find(s => s.id === id)
    setSectionId(id)
    setExpandedBlocks({})
    setExpandedGroups(sec?.groups ? { [sec.groups[0]?.id ?? '']: true } : {})
    setLeagueFilter('General')
    router.push(`/estadisticas?sport=${sportId}&section=${id}`, { scroll: false })
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

  const flatBlocks = applyLive(section?.blocks ?? [])
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
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <Header />
      <LiveStrip />

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 pb-24">

        {/* ── HERO ──────────────────────────────────────── */}
        <div className="relative pt-8 pb-6">
          <div className="absolute -top-8 left-0 w-96 h-56 pointer-events-none"
            style={{ background: `radial-gradient(ellipse at 20% 40%, ${sport.accent}0A 0%, transparent 70%)`, filter: 'blur(20px)', transition: 'background 0.5s ease' }} />
          <div className="relative">
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="section-accent" style={{ background: sport.accent }} />
              <span className="section-label">Hub de estadísticas</span>
            </div>
            <h1 className="font-black leading-none mb-2"
              style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem,4vw,2.8rem)', color: '#F8F8FF', letterSpacing: '-0.02em' }}>
              Estadísticas
            </h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)', maxWidth: 460 }}>
              Datos en vivo desde ESPN, NBA.com y Jolpica · Bloques marcados <span style={{ color: '#94a3b8' }}>Hist</span> son snapshots manuales con su fecha visible.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {lastUpdated && (
                <span className="text-[11px] inline-flex items-center gap-1.5"
                  style={{ color: fetchError ? '#f87171' : 'rgba(34,197,94,0.75)', fontFamily: 'var(--font-sport)' }}>
                  <span className={refreshing ? 'animate-pulse' : ''}>⟳</span>
                  Última actualización: {lastUpdated.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              <button onClick={() => { refreshOnceRef.current(); fetchPlayersRef.current() }} disabled={refreshing}
                className="text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full transition-opacity hover:opacity-80 disabled:opacity-40"
                style={{ background: 'rgba(34,197,94,0.08)', color: '#86efac', border: '1px solid rgba(34,197,94,0.2)', fontFamily: 'var(--font-sport)', cursor: refreshing ? 'wait' : 'pointer' }}>
                {refreshing ? 'Refrescando…' : 'Refrescar'}
              </button>
              <button onClick={() => setSearchOpen(true)}
                className="text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full transition-opacity hover:opacity-80 inline-flex items-center gap-1.5"
                style={{ background: 'rgba(255,255,255,0.04)', color: '#9090B0', border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'var(--font-sport)', cursor: 'pointer' }}
                aria-label="Buscar (⌘K)">
                🔍 Buscar
                <kbd className="hidden sm:inline text-[9px] font-mono px-1 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: '#5A5A72' }}>⌘K</kbd>
              </button>
              {favorites.size > 0 && (
                <button onClick={() => setShowFavoritesOnly(v => !v)}
                  className="text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full transition-opacity hover:opacity-80 inline-flex items-center gap-1.5"
                  style={{
                    background: showFavoritesOnly ? 'rgba(251,191,36,0.14)' : 'rgba(255,255,255,0.04)',
                    color: showFavoritesOnly ? '#fbbf24' : '#9090B0',
                    border: showFavoritesOnly ? '1px solid rgba(251,191,36,0.32)' : '1px solid rgba(255,255,255,0.08)',
                    fontFamily: 'var(--font-sport)', cursor: 'pointer',
                  }}>
                  {showFavoritesOnly ? '★' : '☆'} Favoritos
                  <span className="text-[9px] font-mono px-1 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)' }}>{favorites.size}</span>
                </button>
              )}
              <button onClick={() => setHideUnavailable(v => !v)}
                className="text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full transition-opacity hover:opacity-80 inline-flex items-center gap-1.5"
                style={{
                  background: hideUnavailable ? 'rgba(255,255,255,0.04)' : 'rgba(248,113,113,0.10)',
                  color: hideUnavailable ? '#9090B0' : '#f87171',
                  border: hideUnavailable ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(248,113,113,0.28)',
                  fontFamily: 'var(--font-sport)', cursor: 'pointer',
                }}
                title={hideUnavailable ? 'Mostrar también bloques sin datos' : 'Ocultar bloques sin datos'}
                aria-pressed={!hideUnavailable}>
                {hideUnavailable ? '⊘ Ocultar vacíos' : '⊕ Ver todos'}
              </button>
              {fetchError && (
                <span className="text-[11px]" style={{ color: '#f87171', fontFamily: 'var(--font-sport)' }}>
                  ⚠ Algunos datos no se han podido actualizar ({fetchError})
                </span>
              )}
              {updatedFlash && (
                <span aria-live="polite" className="text-[11px] inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(74,222,128,0.14)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.32)', fontFamily: 'var(--font-sport)', animation: 'fadeOut 2.2s forwards' }}>
                  ● Datos actualizados
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
                <button key={g} onClick={() => { setGender(g); setExpandedBlocks({}) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all"
                  style={{
                    background: isActive ? 'rgba(34,197,94,0.14)' : 'rgba(255,255,255,0.04)',
                    color: isActive ? '#22c55e' : '#5A5A6A',
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
                <StatBlockCard block={block} accent="#22c55e" expanded={!!expandedBlocks[block.id]} onToggle={() => toggleBlock(block.id)} isLive={LIVE_BLOCK_IDS.has(block.id) && !!liveData} meta={getBlockMeta(block.id, liveData?.meta)} isFav={favorites.has(block.id)} onToggleFav={() => toggleFav(block.id)} />
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
                : 'grid-cols-1 lg:grid-cols-2'
            }`}>
              {filteredFlatBlocks.map(block => {
                const blockMeta = getBlockMeta(block.id, liveData?.meta, block.cardType)
                const live = isBlockLive(block)
                let inner: React.ReactNode
                if (block.id.startsWith('wc-group-'))
                  inner = <WorldCupGroupCard block={block} accent={sport.accent} isLive={live} meta={blockMeta} />
                else if (block.id === 'nba-playoffs' || block.id === 'wc-knockout' || block.cardType === 'fixtures')
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
              { icon: '🌐', label: 'APIs en tiempo real', sub: 'Opta · StatsBomb · NBA.com' },
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

      </main>

      <Footer />
      <ScrollToTop />
    </div>
    </TeamLeagueContext.Provider>
  )
}
