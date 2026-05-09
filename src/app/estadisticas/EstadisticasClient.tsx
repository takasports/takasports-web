'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Header from '@/components/Header'
import LiveStrip from '@/components/LiveStrip'
import Footer from '@/components/Footer'
import ScrollToTop from '@/components/ScrollToTop'

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
  positions?: string[]
  league?: string
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
const POSITION_FILTERS = ['Todos', 'Porteros', 'Defensas', 'Mediocampistas', 'Delanteros']
const LEAGUE_FILTERS   = ['General', 'LaLiga', 'Premier League', 'Bundesliga', 'Serie A', 'Ligue 1']

const TEAM_LEAGUE: Record<string, string> = {
  // LaLiga
  'FC Barcelona': 'LaLiga',   'Barcelona': 'LaLiga',      'Real Madrid': 'LaLiga',
  'Atlético': 'LaLiga',       'Atlético Madrid': 'LaLiga','Athletic Club': 'LaLiga',
  'Villarreal': 'LaLiga',     'Real Sociedad': 'LaLiga',  'Real Betis': 'LaLiga',
  'Betis': 'LaLiga',          'Rayo': 'LaLiga',           'Rayo Vallecano': 'LaLiga',
  'Valencia': 'LaLiga',       'Osasuna': 'LaLiga',        'Getafe': 'LaLiga',
  'Celta Vigo': 'LaLiga',     'Girona': 'LaLiga',         'Las Palmas': 'LaLiga',
  'Alavés': 'LaLiga',         'Leganés': 'LaLiga',        'Espanyol': 'LaLiga',
  'Valladolid': 'LaLiga',     'Sevilla': 'LaLiga',        'Mallorca': 'LaLiga',
  'Elche': 'LaLiga',          'Levante': 'LaLiga',        'Real Oviedo': 'LaLiga',
  // Premier League
  'Man City': 'Premier League','Manchester City': 'Premier League',
  'Arsenal': 'Premier League','Liverpool': 'Premier League',
  'Aston Villa': 'Premier League','Chelsea': 'Premier League',
  'Tottenham': 'Premier League','Tottenham Hotspur': 'Premier League',
  'Newcastle': 'Premier League','Newcastle United': 'Premier League',
  'Man United': 'Premier League','Manchester United': 'Premier League',
  'Brighton': 'Premier League','Brighton & Hove Albion': 'Premier League',
  'West Ham': 'Premier League','West Ham United': 'Premier League',
  'Nottingham Forest': 'Premier League','Fulham': 'Premier League',
  'Bournemouth': 'Premier League','AFC Bournemouth': 'Premier League',
  'Crystal Palace': 'Premier League','Everton': 'Premier League',
  'Brentford': 'Premier League','Wolves': 'Premier League',
  'Wolverhampton': 'Premier League','Leicester': 'Premier League',
  'Ipswich': 'Premier League','Southampton': 'Premier League',
  'Sunderland': 'Premier League','Leeds United': 'Premier League',
  'Burnley': 'Premier League',
  // Bundesliga
  'Bayern Munich': 'Bundesliga','Bayern': 'Bundesliga',
  'Leverkusen': 'Bundesliga', 'Bayer Leverkusen': 'Bundesliga',
  'Borussia Dortmund': 'Bundesliga','Dortmund': 'Bundesliga',
  'RB Leipzig': 'Bundesliga', 'Stuttgart': 'Bundesliga',  'VfB Stuttgart': 'Bundesliga',
  'Eintracht Frankfurt': 'Bundesliga','Freiburg': 'Bundesliga','SC Freiburg': 'Bundesliga',
  'Hoffenheim': 'Bundesliga', 'TSG Hoffenheim': 'Bundesliga',
  'Augsburg': 'Bundesliga',   'FC Augsburg': 'Bundesliga',
  'Wolfsburg': 'Bundesliga',  'VfL Wolfsburg': 'Bundesliga',
  'Mainz': 'Bundesliga',      'Werder Bremen': 'Bundesliga',
  'Borussia Mönchengladbach': 'Bundesliga',
  'Union Berlin': 'Bundesliga','1. FC Union Berlin': 'Bundesliga',
  'FC Cologne': 'Bundesliga', 'St. Pauli': 'Bundesliga',  'Hamburg SV': 'Bundesliga',
  // Serie A
  'Inter Milán': 'Serie A',   'Inter Milan': 'Serie A',   'Internazionale': 'Serie A',
  'AC Milan': 'Serie A',      'Juventus': 'Serie A',      'Atalanta': 'Serie A',
  'Napoli': 'Serie A',        'Roma': 'Serie A',          'AS Roma': 'Serie A',
  'Lazio': 'Serie A',         'Fiorentina': 'Serie A',    'Torino': 'Serie A',
  'Bologna': 'Serie A',       'Udinese': 'Serie A',       'Como': 'Serie A',
  'Parma': 'Serie A',         'Cagliari': 'Serie A',      'Genoa': 'Serie A',
  'Venezia': 'Serie A',       'Empoli': 'Serie A',        'Lecce': 'Serie A',
  'Monza': 'Serie A',         'Cremonese': 'Serie A',     'Sassuolo': 'Serie A',
  'Hellas Verona': 'Serie A', 'Pisa': 'Serie A',          'Salernitana': 'Serie A',
  // Ligue 1
  'Paris Saint-Germain': 'Ligue 1','PSG': 'Ligue 1',
  'Monaco': 'Ligue 1',        'AS Monaco': 'Ligue 1',
  'Marseille': 'Ligue 1',     'Olympique Marseille': 'Ligue 1',
  'Lyon': 'Ligue 1',          'Olympique Lyonnais': 'Ligue 1',
  'Lens': 'Ligue 1',          'Brest': 'Ligue 1',         'Lille': 'Ligue 1',
  'Nice': 'Ligue 1',          'Rennes': 'Ligue 1',        'Stade Rennais': 'Ligue 1',
  'Strasbourg': 'Ligue 1',    'Reims': 'Ligue 1',         'Toulouse': 'Ligue 1',
  'Nantes': 'Ligue 1',        'Angers': 'Ligue 1',        'Saint-Étienne': 'Ligue 1',
  'Montpellier': 'Ligue 1',   'Auxerre': 'Ligue 1',       'AJ Auxerre': 'Ligue 1',
  'Le Havre': 'Ligue 1',      'Le Havre AC': 'Ligue 1',   'Lorient': 'Ligue 1',
  'Metz': 'Ligue 1',          'Paris FC': 'Ligue 1',
}

// ─────────────────────────────────────────────────────────────────
// DATOS — FÚTBOL
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
        positions: ['Delanteros', 'Centrocampistas'],
        rows: [
          { rank: 1, name: 'Erling Haaland',    team: 'Man City',     value: '27', sub: '30 PJ', flag: '🇳🇴', trend: 'up',   extra: { Asist: '8',  xG: '24.2' } },
          { rank: 2, name: 'Kylian Mbappé',     team: 'Real Madrid',  value: '24', sub: '28 PJ', flag: '🇫🇷', trend: 'up',   extra: { Asist: '10', xG: '21.8' } },
          { rank: 3, name: 'Vinicius Jr',        team: 'Real Madrid',  value: '21', sub: '27 PJ', flag: '🇧🇷', trend: 'flat', extra: { Asist: '11', xG: '18.4' } },
          { rank: 4, name: 'Lamine Yamal',       team: 'FC Barcelona', value: '18', sub: '30 PJ', flag: '🇪🇸', trend: 'up',   extra: { Asist: '12', xG: '14.1' } },
          { rank: 5, name: 'Robert Lewandowski', team: 'FC Barcelona', value: '17', sub: '28 PJ', flag: '🇵🇱', trend: 'flat', extra: { Asist: '5',  xG: '16.9' } },
          { rank: 6, name: 'Antoine Griezmann',  team: 'Atlético',     value: '15', sub: '27 PJ', flag: '🇫🇷', trend: 'up',   extra: { Asist: '7',  xG: '13.3' } },
          { rank: 7, name: 'Harry Kane',         team: 'Bayern Munich',value: '14', sub: '26 PJ', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'down', extra: { Asist: '6',  xG: '15.2' } },
          { rank: 8, name: 'Son Heung-min',      team: 'Tottenham',    value: '13', sub: '27 PJ', flag: '🇰🇷', trend: 'flat', extra: { Asist: '7',  xG: '11.8' } },
          { rank: 9, name: 'Raphinha',           team: 'FC Barcelona', value: '13', sub: '28 PJ', flag: '🇧🇷', trend: 'up',   extra: { Asist: '8',  xG: '10.9' } },
          { rank: 10, name: 'Bukayo Saka',       team: 'Arsenal',      value: '12', sub: '28 PJ', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'up',   extra: { Asist: '9',  xG: '11.4' } },
          { rank: 11, name: 'Lautaro Martínez',  team: 'Inter Milán',  value: '22', sub: '27 PJ', flag: '🇦🇷', trend: 'up',   extra: { Asist: '4',  xG: '18.4' } },
          { rank: 12, name: 'Florian Wirtz',     team: 'Leverkusen',   value: '11', sub: '26 PJ', flag: '🇩🇪', trend: 'up',  extra: { Asist: '10', xG: '9.8' } },
          { rank: 13, name: 'Jonathan David',    team: 'Lille',        value: '24', sub: '28 PJ', flag: '🇨🇦', trend: 'up',  extra: { Asist: '5',  xG: '21.2' } },
          { rank: 14, name: 'Bradley Barcola',   team: 'PSG',          value: '15', sub: '27 PJ', flag: '🇫🇷', trend: 'up',  extra: { Asist: '9',  xG: '12.8' } },
        ],
      },
      {
        id: 'asistencias', title: 'Asistencias', metric: 'Asist.',
        positions: ['Centrocampistas', 'Delanteros'],
        rows: [
          { rank: 1, name: 'Kevin De Bruyne',  team: 'Man City',     value: '16', sub: '25 PJ', flag: '🇧🇪', trend: 'up',   extra: { xA: '14.2', 'P.clave': '82' } },
          { rank: 2, name: 'Pedri',            team: 'FC Barcelona', value: '13', sub: '29 PJ', flag: '🇪🇸', trend: 'up',   extra: { xA: '11.8', 'P.clave': '76' } },
          { rank: 3, name: 'Lamine Yamal',     team: 'FC Barcelona', value: '12', sub: '30 PJ', flag: '🇪🇸', trend: 'up',   extra: { xA: '10.4', 'P.clave': '68' } },
          { rank: 4, name: 'Jude Bellingham',  team: 'Real Madrid',  value: '11', sub: '26 PJ', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'flat', extra: { xA: '9.7',  'P.clave': '59' } },
          { rank: 5, name: 'Phil Foden',       team: 'Man City',     value: '10', sub: '24 PJ', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'down', extra: { xA: '9.1',  'P.clave': '54' } },
          { rank: 6, name: 'Raphinha',         team: 'FC Barcelona', value: '9',  sub: '28 PJ', flag: '🇧🇷', trend: 'up',   extra: { xA: '7.8',  'P.clave': '52' } },
          { rank: 7, name: 'Mohamed Salah',    team: 'Liverpool',    value: '9',  sub: '27 PJ', flag: '🇪🇬', trend: 'flat', extra: { xA: '8.3',  'P.clave': '48' } },
          { rank: 8, name: 'Bukayo Saka',      team: 'Arsenal',      value: '8',  sub: '28 PJ', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'up',   extra: { xA: '7.6',  'P.clave': '51' } },
          { rank: 9, name: 'Florian Wirtz',    team: 'Leverkusen',   value: '8',  sub: '26 PJ', flag: '🇩🇪', trend: 'up',  extra: { xA: '7.1',  'P.clave': '47' } },
          { rank: 10, name: 'Bernardo Silva',  team: 'Man City',     value: '7',  sub: '27 PJ', flag: '🇵🇹', trend: 'flat', extra: { xA: '6.4',  'P.clave': '44' } },
          { rank: 11, name: 'Ousmane Dembélé', team: 'PSG',          value: '7',  sub: '26 PJ', flag: '🇫🇷', trend: 'up',  extra: { xA: '6.2',  'P.clave': '48' } },
          { rank: 12, name: 'Nicolo Barella',  team: 'Inter Milán',  value: '6',  sub: '25 PJ', flag: '🇮🇹', trend: 'up',  extra: { xA: '5.8',  'P.clave': '39' } },
        ],
      },
      {
        id: 'xg-ranking', title: 'Expected Goals (xG)', metric: 'xG',
        positions: ['Delanteros'],
        rows: [
          { rank: 1, name: 'Harry Kane',         team: 'Bayern Munich', value: '27.4', sub: '27 PJ', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'up' },
          { rank: 2, name: 'Erling Haaland',    team: 'Man City',      value: '25.8', sub: '32 PJ', flag: '🇳🇴', trend: 'up' },
          { rank: 3, name: 'Jonathan David',    team: 'Lille',         value: '22.1', sub: '28 PJ', flag: '🇨🇦', trend: 'up' },
          { rank: 4, name: 'Kylian Mbappé',     team: 'Real Madrid',   value: '21.3', sub: '28 PJ', flag: '🇫🇷', trend: 'flat' },
          { rank: 5, name: 'Lautaro Martínez',  team: 'Inter Milán',   value: '18.9', sub: '26 PJ', flag: '🇦🇷', trend: 'up' },
          { rank: 6, name: 'Robert Lewandowski',team: 'FC Barcelona',  value: '18.4', sub: '28 PJ', flag: '🇵🇱', trend: 'flat' },
          { rank: 7, name: 'Mohamed Salah',     team: 'Liverpool',     value: '17.8', sub: '27 PJ', flag: '🇪🇬', trend: 'up' },
          { rank: 8, name: 'Vinicius Jr',       team: 'Real Madrid',   value: '16.2', sub: '27 PJ', flag: '🇧🇷', trend: 'flat' },
        ],
      },
      {
        id: 'tiros-puerta', title: 'Tiros a puerta / partido', metric: 'T/PJ',
        positions: ['Delanteros'],
        rows: [
          { rank: 1, name: 'Erling Haaland',    team: 'Man City',     value: '3.8', sub: '30 PJ', flag: '🇳🇴', trend: 'up' },
          { rank: 2, name: 'Kylian Mbappé',     team: 'Real Madrid',  value: '3.4', sub: '28 PJ', flag: '🇫🇷', trend: 'flat' },
          { rank: 3, name: 'Mohamed Salah',     team: 'Liverpool',    value: '3.1', sub: '27 PJ', flag: '🇪🇬', trend: 'up' },
          { rank: 4, name: 'Lautaro Martínez',  team: 'Inter Milán',  value: '2.9', sub: '27 PJ', flag: '🇦🇷', trend: 'up' },
          { rank: 5, name: 'Harry Kane',         team: 'Bayern Munich',value: '2.8', sub: '26 PJ', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'down' },
          { rank: 6, name: 'Vinicius Jr',        team: 'Real Madrid',  value: '2.7', sub: '27 PJ', flag: '🇧🇷', trend: 'flat' },
        ],
      },
      {
        id: 'goles-90', title: 'Goles por 90 minutos', metric: 'G/90',
        positions: ['Delanteros'],
        rows: [
          { rank: 1, name: 'Erling Haaland',    team: 'Man City',     value: '1.08', sub: '30 PJ · 2250 min', flag: '🇳🇴', trend: 'up' },
          { rank: 2, name: 'Kylian Mbappé',     team: 'Real Madrid',  value: '0.94', sub: '28 PJ · 2300 min', flag: '🇫🇷', trend: 'flat' },
          { rank: 3, name: 'Lautaro Martínez',  team: 'Inter Milán',  value: '0.86', sub: '27 PJ · 2160 min', flag: '🇦🇷', trend: 'up' },
          { rank: 4, name: 'Vinicius Jr',       team: 'Real Madrid',  value: '0.84', sub: '27 PJ · 2090 min', flag: '🇧🇷', trend: 'flat' },
          { rank: 5, name: 'Antoine Griezmann', team: 'Atlético',     value: '0.72', sub: '27 PJ · 1950 min', flag: '🇫🇷', trend: 'up' },
          { rank: 6, name: 'Lamine Yamal',      team: 'FC Barcelona', value: '0.68', sub: '30 PJ · 2390 min', flag: '🇪🇸', trend: 'up' },
          { rank: 7, name: 'Robert Lewandowski',team: 'FC Barcelona', value: '0.66', sub: '28 PJ · 2200 min', flag: '🇵🇱', trend: 'flat' },
          { rank: 8, name: 'Harry Kane',        team: 'Bayern Munich',value: '0.58', sub: '26 PJ · 2160 min', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'down' },
        ],
      },
      {
        id: 'toques-area', title: 'Toques en área rival / partido', metric: 'Toques/PJ',
        positions: ['Delanteros'],
        rows: [
          { rank: 1, name: 'Erling Haaland',    team: 'Man City',     value: '6.8', sub: '30 PJ', flag: '🇳🇴', trend: 'up' },
          { rank: 2, name: 'Robert Lewandowski',team: 'FC Barcelona', value: '5.9', sub: '28 PJ', flag: '🇵🇱', trend: 'flat' },
          { rank: 3, name: 'Lautaro Martínez',  team: 'Inter Milán',  value: '5.6', sub: '27 PJ', flag: '🇦🇷', trend: 'up' },
          { rank: 4, name: 'Harry Kane',        team: 'Bayern Munich',value: '5.4', sub: '26 PJ', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'down' },
          { rank: 5, name: 'Kylian Mbappé',     team: 'Real Madrid',  value: '5.1', sub: '28 PJ', flag: '🇫🇷', trend: 'flat' },
          { rank: 6, name: 'Vinicius Jr',       team: 'Real Madrid',  value: '4.8', sub: '27 PJ', flag: '🇧🇷', trend: 'flat' },
        ],
      },
      {
        id: 'regates', title: 'Regates completados / partido', metric: 'Reg./PJ',
        positions: ['Delanteros', 'Mediocampistas'],
        rows: [
          { rank: 1, name: 'Vinicius Jr',       team: 'Real Madrid',  value: '4.8', sub: '27 PJ · 68%', flag: '🇧🇷', trend: 'up',   extra: { '% éxito': '68%', Intentos: '7.1' } },
          { rank: 2, name: 'Kylian Mbappé',     team: 'Real Madrid',  value: '4.2', sub: '28 PJ · 65%', flag: '🇫🇷', trend: 'flat', extra: { '% éxito': '65%', Intentos: '6.5' } },
          { rank: 3, name: 'Lamine Yamal',      team: 'FC Barcelona', value: '3.8', sub: '30 PJ · 62%', flag: '🇪🇸', trend: 'up',   extra: { '% éxito': '62%', Intentos: '6.1' } },
          { rank: 4, name: 'Mohamed Salah',     team: 'Liverpool',    value: '3.4', sub: '27 PJ · 58%', flag: '🇪🇬', trend: 'flat', extra: { '% éxito': '58%', Intentos: '5.9' } },
          { rank: 5, name: 'Bukayo Saka',       team: 'Arsenal',      value: '3.1', sub: '28 PJ · 61%', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'up',   extra: { '% éxito': '61%', Intentos: '5.1' } },
          { rank: 6, name: 'Rafael Leão',       team: 'AC Milan',     value: '2.8', sub: '24 PJ · 55%', flag: '🇵🇹', trend: 'flat', extra: { '% éxito': '55%', Intentos: '5.1' } },
        ],
      },
      {
        id: 'contribucion-90', title: 'G+A por 90 minutos', metric: 'G+A/90',
        positions: ['Delanteros', 'Mediocampistas'],
        rows: [
          { rank: 1, name: 'Erling Haaland',    team: 'Man City',     value: '1.40', sub: '30 PJ', flag: '🇳🇴', trend: 'up' },
          { rank: 2, name: 'Kevin De Bruyne',   team: 'Man City',     value: '1.28', sub: '25 PJ', flag: '🇧🇪', trend: 'up' },
          { rank: 3, name: 'Lamine Yamal',      team: 'FC Barcelona', value: '1.24', sub: '30 PJ', flag: '🇪🇸', trend: 'up' },
          { rank: 4, name: 'Kylian Mbappé',     team: 'Real Madrid',  value: '1.22', sub: '28 PJ', flag: '🇫🇷', trend: 'flat' },
          { rank: 5, name: 'Vinicius Jr',       team: 'Real Madrid',  value: '1.20', sub: '27 PJ', flag: '🇧🇷', trend: 'flat' },
          { rank: 6, name: 'Florian Wirtz',     team: 'Leverkusen',   value: '1.16', sub: '26 PJ', flag: '🇩🇪', trend: 'up' },
          { rank: 7, name: 'Lautaro Martínez',  team: 'Inter Milán',  value: '1.10', sub: '27 PJ', flag: '🇦🇷', trend: 'up' },
          { rank: 8, name: 'Mohamed Salah',     team: 'Liverpool',    value: '1.08', sub: '27 PJ', flag: '🇪🇬', trend: 'flat' },
        ],
      },
    ],
  },
  {
    id: 'pases',
    label: 'Pases & Creación',
    icon: '🎯',
    description: 'Pases clave, progresión y creación de ocasiones',
    blocks: [
      {
        id: 'pases-clave', title: 'Pases clave / partido', metric: 'P.clave/PJ',
        positions: ['Centrocampistas'],
        rows: [
          { rank: 1, name: 'Kevin De Bruyne', team: 'Man City',     value: '3.9', sub: '25 PJ', flag: '🇧🇪', trend: 'up' },
          { rank: 2, name: 'Florian Wirtz',   team: 'Leverkusen',   value: '3.6', sub: '26 PJ', flag: '🇩🇪', trend: 'up' },
          { rank: 3, name: 'Pedri',           team: 'FC Barcelona', value: '3.2', sub: '29 PJ', flag: '🇪🇸', trend: 'up' },
          { rank: 4, name: 'Jude Bellingham', team: 'Real Madrid',  value: '3.0', sub: '26 PJ', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'flat' },
          { rank: 5, name: 'Phil Foden',      team: 'Man City',     value: '2.8', sub: '24 PJ', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'down' },
          { rank: 6, name: 'Bernardo Silva',  team: 'Man City',     value: '2.6', sub: '27 PJ', flag: '🇵🇹', trend: 'flat' },
          { rank: 7, name: 'Lamine Yamal',    team: 'FC Barcelona', value: '2.4', sub: '30 PJ', flag: '🇪🇸', trend: 'up' },
          { rank: 8, name: 'Gavi',            team: 'FC Barcelona', value: '2.3', sub: '22 PJ', flag: '🇪🇸', trend: 'up' },
          { rank: 9, name: 'Nicolo Barella',  team: 'Inter Milán',  value: '2.2', sub: '25 PJ', flag: '🇮🇹', trend: 'up' },
          { rank: 10, name: 'Vitinha',        team: 'PSG',          value: '2.1', sub: '26 PJ', flag: '🇵🇹', trend: 'up' },
        ],
      },
      {
        id: 'precision-pases', title: '% Precisión en pases', metric: '% Prec.',
        positions: ['Mediocampistas', 'Defensas'],
        rows: [
          { rank: 1, name: 'Rodri',           team: 'Man City',     value: '94.2%', sub: '28 PJ', flag: '🇪🇸', trend: 'flat' },
          { rank: 2, name: 'Joshua Kimmich',  team: 'Bayern',       value: '92.6%', sub: '27 PJ', flag: '🇩🇪', trend: 'flat' },
          { rank: 3, name: 'Bernardo Silva',  team: 'Man City',     value: '91.4%', sub: '27 PJ', flag: '🇵🇹', trend: 'flat' },
          { rank: 4, name: 'Pedri',           team: 'FC Barcelona', value: '90.8%', sub: '29 PJ', flag: '🇪🇸', trend: 'up' },
          { rank: 5, name: 'Granit Xhaka',    team: 'Leverkusen',   value: '90.1%', sub: '27 PJ', flag: '🇨🇭', trend: 'flat' },
          { rank: 6, name: 'Frenkie de Jong', team: 'FC Barcelona', value: '89.4%', sub: '24 PJ', flag: '🇳🇱', trend: 'flat' },
        ],
      },
      {
        id: 'progresion', title: 'Porteo progresivo (m/partido)', metric: 'm/PJ',
        positions: ['Mediocampistas', 'Delanteros'],
        rows: [
          { rank: 1, name: 'Jude Bellingham', team: 'Real Madrid',  value: '142', sub: '26 PJ', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'up' },
          { rank: 2, name: 'Florian Wirtz',   team: 'Leverkusen',   value: '128', sub: '26 PJ', flag: '🇩🇪', trend: 'up' },
          { rank: 3, name: 'Phil Foden',      team: 'Man City',     value: '118', sub: '24 PJ', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'flat' },
          { rank: 4, name: 'Pedri',           team: 'FC Barcelona', value: '112', sub: '29 PJ', flag: '🇪🇸', trend: 'up' },
          { rank: 5, name: 'Gavi',            team: 'FC Barcelona', value: '98',  sub: '22 PJ', flag: '🇪🇸', trend: 'up' },
          { rank: 6, name: 'Bernardo Silva',  team: 'Man City',     value: '89',  sub: '27 PJ', flag: '🇵🇹', trend: 'flat' },
        ],
      },
      {
        id: 'presiones', title: 'Presiones completadas / partido', metric: 'Pres./PJ',
        positions: ['Mediocampistas'],
        rows: [
          { rank: 1, name: 'Rodri',           team: 'Man City',     value: '28.4', sub: '28 PJ', flag: '🇪🇸', trend: 'flat' },
          { rank: 2, name: 'Gavi',            team: 'FC Barcelona', value: '26.8', sub: '22 PJ', flag: '🇪🇸', trend: 'up' },
          { rank: 3, name: 'Granit Xhaka',    team: 'Leverkusen',   value: '25.2', sub: '27 PJ', flag: '🇨🇭', trend: 'flat' },
          { rank: 4, name: 'Joshua Kimmich',  team: 'Bayern',       value: '24.6', sub: '27 PJ', flag: '🇩🇪', trend: 'flat' },
          { rank: 5, name: 'Pedri',           team: 'FC Barcelona', value: '23.4', sub: '29 PJ', flag: '🇪🇸', trend: 'up' },
          { rank: 6, name: 'Declan Rice',     team: 'Arsenal',      value: '22.8', sub: '26 PJ', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'up' },
          { rank: 7, name: 'Frenkie de Jong', team: 'FC Barcelona', value: '21.4', sub: '24 PJ', flag: '🇳🇱', trend: 'flat' },
          { rank: 8, name: 'Nicolo Barella',  team: 'Inter Milán',  value: '20.8', sub: '25 PJ', flag: '🇮🇹', trend: 'up' },
          { rank: 9, name: 'Fabian Ruiz',     team: 'PSG',          value: '19.6', sub: '25 PJ', flag: '🇪🇸', trend: 'flat' },
        ],
      },
      {
        id: 'duelos-centrocampistas', title: 'Duelos ganados % (centro)', metric: '% Duelos',
        positions: ['Mediocampistas'],
        rows: [
          { rank: 1, name: 'Rodri',           team: 'Man City',     value: '68%', sub: '28 PJ · 7.2/PJ', flag: '🇪🇸', trend: 'flat' },
          { rank: 2, name: 'Joshua Kimmich',  team: 'Bayern',       value: '62%', sub: '27 PJ · 6.8/PJ', flag: '🇩🇪', trend: 'flat' },
          { rank: 3, name: 'Granit Xhaka',    team: 'Leverkusen',   value: '61%', sub: '27 PJ · 7.4/PJ', flag: '🇨🇭', trend: 'flat' },
          { rank: 4, name: 'Casemiro',        team: 'Man United',   value: '59%', sub: '26 PJ · 8.1/PJ', flag: '🇧🇷', trend: 'flat' },
          { rank: 5, name: 'Tchouaméni',      team: 'Real Madrid',  value: '57%', sub: '27 PJ · 6.4/PJ', flag: '🇫🇷', trend: 'up' },
          { rank: 6, name: 'Jude Bellingham', team: 'Real Madrid',  value: '55%', sub: '26 PJ · 5.8/PJ', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'flat' },
          { rank: 7, name: 'Pedri',           team: 'FC Barcelona', value: '54%', sub: '29 PJ · 5.6/PJ', flag: '🇪🇸', trend: 'up' },
          { rank: 8, name: 'Hakan Calhanoglu',team: 'Inter Milán', value: '53%', sub: '24 PJ · 7.1/PJ', flag: '🇹🇷', trend: 'flat' },
          { rank: 9, name: 'Warren Zaïre-Emery',team: 'PSG',       value: '52%', sub: '22 PJ · 6.8/PJ', flag: '🇫🇷', trend: 'up' },
        ],
      },
    ],
  },
  {
    id: 'defensa',
    label: 'Defensas',
    icon: '🛡️',
    description: 'Duelos, intercepciones y recuperaciones defensivas',
    blocks: [
      {
        id: 'defensores', title: 'Defensas · Nota media', metric: 'Nota',
        positions: ['Defensas'],
        rows: [
          { rank: 1, name: 'Rúben Dias',        team: 'Man City',     value: '9.1', sub: '22 PJ', flag: '🇵🇹', trend: 'up',   extra: { Intepc: '2.1', Duelos: '73%' } },
          { rank: 2, name: 'William Saliba',    team: 'Arsenal',      value: '8.9', sub: '23 PJ', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'up',   extra: { Intepc: '1.8', Duelos: '71%' } },
          { rank: 3, name: 'Virgil van Dijk',   team: 'Liverpool',    value: '8.7', sub: '21 PJ', flag: '🇳🇱', trend: 'flat', extra: { Intepc: '1.6', Duelos: '78%' } },
          { rank: 4, name: 'Antonio Rüdiger',   team: 'Real Madrid',  value: '8.5', sub: '22 PJ', flag: '🇩🇪', trend: 'flat', extra: { Intepc: '1.9', Duelos: '69%' } },
          { rank: 5, name: 'Jules Koundé',      team: 'FC Barcelona', value: '8.4', sub: '24 PJ', flag: '🇫🇷', trend: 'up',   extra: { Intepc: '1.7', Duelos: '65%' } },
          { rank: 6, name: 'Pau Cubarsí',       team: 'FC Barcelona', value: '8.2', sub: '20 PJ', flag: '🇪🇸', trend: 'up',  extra: { Intepc: '1.5', Duelos: '72%' } },
          { rank: 7, name: 'Lisandro Martínez', team: 'Man United',   value: '8.0', sub: '18 PJ', flag: '🇦🇷', trend: 'up',   extra: { Intepc: '2.2', Duelos: '74%' } },
          { rank: 8, name: 'Dayot Upamecano',   team: 'Bayern',       value: '7.9', sub: '21 PJ', flag: '🇫🇷', trend: 'flat', extra: { Intepc: '1.6', Duelos: '66%' } },
          { rank: 9, name: 'Micky van de Ven',  team: 'Tottenham',    value: '7.8', sub: '19 PJ', flag: '🇳🇱', trend: 'up',   extra: { Intepc: '1.4', Duelos: '63%' } },
          { rank: 10, name: 'Ezri Konsa',       team: 'Aston Villa',  value: '7.7', sub: '20 PJ', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'up',   extra: { Intepc: '1.5', Duelos: '67%' } },
        ],
      },
      {
        id: 'recuperaciones', title: 'Recuperaciones / partido', metric: 'Recup./PJ',
        positions: ['Defensas', 'Mediocampistas'],
        rows: [
          { rank: 1, name: 'Rodri',             team: 'Man City',     value: '8.4', sub: '/partido', flag: '🇪🇸', trend: 'flat' },
          { rank: 2, name: 'Casemiro',          team: 'Man United',   value: '7.9', sub: '/partido', flag: '🇧🇷', trend: 'flat' },
          { rank: 3, name: 'Granit Xhaka',      team: 'Leverkusen',   value: '7.6', sub: '/partido', flag: '🇨🇭', trend: 'flat' },
          { rank: 4, name: 'Joshua Kimmich',    team: 'Bayern',       value: '7.2', sub: '/partido', flag: '🇩🇪', trend: 'flat' },
          { rank: 5, name: 'Virgil van Dijk',   team: 'Liverpool',    value: '6.9', sub: '/partido', flag: '🇳🇱', trend: 'flat' },
          { rank: 6, name: 'Aurélien Tchouaméni', team: 'Real Madrid',value: '6.7', sub: '/partido', flag: '🇫🇷', trend: 'up' },
          { rank: 7, name: 'William Saliba',    team: 'Arsenal',      value: '6.4', sub: '/partido', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'up' },
          { rank: 8, name: 'Rúben Dias',        team: 'Man City',     value: '6.2', sub: '/partido', flag: '🇵🇹', trend: 'up' },
          { rank: 9, name: 'Alessandro Bastoni',team: 'Inter Milán', value: '5.9', sub: '/partido', flag: '🇮🇹', trend: 'up' },
          { rank: 10, name: 'Marquinhos',       team: 'PSG',         value: '5.7', sub: '/partido', flag: '🇧🇷', trend: 'flat' },
        ],
      },
      {
        id: 'duelos-aereos', title: 'Duelos aéreos ganados %', metric: '% Aéreo',
        positions: ['Defensas'],
        rows: [
          { rank: 1, name: 'Virgil van Dijk',   team: 'Liverpool',    value: '82%', sub: '28 PJ · 4.1/PJ', flag: '🇳🇱', trend: 'flat' },
          { rank: 2, name: 'William Saliba',    team: 'Arsenal',      value: '78%', sub: '23 PJ · 3.6/PJ', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'up' },
          { rank: 3, name: 'Lisandro Martínez', team: 'Man United',   value: '76%', sub: '18 PJ · 4.2/PJ', flag: '🇦🇷', trend: 'up' },
          { rank: 4, name: 'Rúben Dias',        team: 'Man City',     value: '74%', sub: '22 PJ · 3.8/PJ', flag: '🇵🇹', trend: 'flat' },
          { rank: 5, name: 'Antonio Rüdiger',   team: 'Real Madrid',  value: '72%', sub: '22 PJ · 3.5/PJ', flag: '🇩🇪', trend: 'flat' },
          { rank: 6, name: 'Dayot Upamecano',   team: 'Bayern',       value: '70%', sub: '21 PJ · 3.2/PJ', flag: '🇫🇷', trend: 'flat' },
          { rank: 7, name: 'Jules Koundé',      team: 'FC Barcelona', value: '65%', sub: '24 PJ · 2.9/PJ', flag: '🇫🇷', trend: 'up' },
        ],
      },
      {
        id: 'intercepciones', title: 'Intercepciones / partido', metric: 'Int./PJ',
        positions: ['Defensas'],
        rows: [
          { rank: 1, name: 'Lisandro Martínez', team: 'Man United',   value: '2.2', sub: '18 PJ', flag: '🇦🇷', trend: 'up' },
          { rank: 2, name: 'Rúben Dias',        team: 'Man City',     value: '2.1', sub: '22 PJ', flag: '🇵🇹', trend: 'up' },
          { rank: 3, name: 'Antonio Rüdiger',   team: 'Real Madrid',  value: '1.9', sub: '22 PJ', flag: '🇩🇪', trend: 'flat' },
          { rank: 4, name: 'William Saliba',    team: 'Arsenal',      value: '1.8', sub: '23 PJ', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'up' },
          { rank: 5, name: 'Jules Koundé',      team: 'FC Barcelona', value: '1.7', sub: '24 PJ', flag: '🇫🇷', trend: 'up' },
          { rank: 6, name: 'Virgil van Dijk',   team: 'Liverpool',    value: '1.6', sub: '28 PJ', flag: '🇳🇱', trend: 'flat' },
          { rank: 7, name: 'Pau Cubarsí',       team: 'FC Barcelona', value: '1.5', sub: '20 PJ', flag: '🇪🇸', trend: 'up' },
          { rank: 8, name: 'Micky van de Ven',  team: 'Tottenham',    value: '1.4', sub: '19 PJ', flag: '🇳🇱', trend: 'up' },
        ],
      },
      {
        id: 'despejes', title: 'Despejes / partido', metric: 'Desp./PJ',
        positions: ['Defensas'],
        rows: [
          { rank: 1, name: 'Virgil van Dijk',   team: 'Liverpool',    value: '5.8', sub: '28 PJ', flag: '🇳🇱', trend: 'flat' },
          { rank: 2, name: 'Rúben Dias',        team: 'Man City',     value: '5.4', sub: '22 PJ', flag: '🇵🇹', trend: 'up' },
          { rank: 3, name: 'William Saliba',    team: 'Arsenal',      value: '5.1', sub: '23 PJ', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'up' },
          { rank: 4, name: 'Antonio Rüdiger',   team: 'Real Madrid',  value: '4.8', sub: '22 PJ', flag: '🇩🇪', trend: 'flat' },
          { rank: 5, name: 'Jules Koundé',      team: 'FC Barcelona', value: '4.2', sub: '24 PJ', flag: '🇫🇷', trend: 'flat' },
          { rank: 6, name: 'Dayot Upamecano',   team: 'Bayern',       value: '4.0', sub: '21 PJ', flag: '🇫🇷', trend: 'flat' },
        ],
      },
      {
        id: 'pases-progresivos-def', title: 'Pases progresivos / partido', metric: 'PP/PJ',
        positions: ['Defensas'],
        rows: [
          { rank: 1, name: 'Trent Alexander-Arnold', team: 'Real Madrid',  value: '8.4', sub: '28 PJ', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'up' },
          { rank: 2, name: 'Joshua Kimmich',         team: 'Bayern',       value: '7.8', sub: '27 PJ', flag: '🇩🇪', trend: 'flat' },
          { rank: 3, name: 'Jules Koundé',           team: 'FC Barcelona', value: '6.9', sub: '24 PJ', flag: '🇫🇷', trend: 'up' },
          { rank: 4, name: 'Dani Carvajal',          team: 'Real Madrid',  value: '6.4', sub: '27 PJ', flag: '🇪🇸', trend: 'flat' },
          { rank: 5, name: 'William Saliba',         team: 'Arsenal',      value: '5.8', sub: '23 PJ', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'up' },
          { rank: 6, name: 'Rúben Dias',             team: 'Man City',     value: '5.6', sub: '22 PJ', flag: '🇵🇹', trend: 'flat' },
          { rank: 7, name: 'Virgil van Dijk',        team: 'Liverpool',    value: '5.2', sub: '28 PJ', flag: '🇳🇱', trend: 'flat' },
        ],
      },
      {
        id: 'bloqueos', title: 'Bloqueos de tiro / partido', metric: 'Bloq./PJ',
        positions: ['Defensas'],
        rows: [
          { rank: 1, name: 'Lisandro Martínez', team: 'Man United',   value: '2.4', sub: '18 PJ', flag: '🇦🇷', trend: 'up' },
          { rank: 2, name: 'Rúben Dias',        team: 'Man City',     value: '2.1', sub: '22 PJ', flag: '🇵🇹', trend: 'flat' },
          { rank: 3, name: 'Ezri Konsa',        team: 'Aston Villa',  value: '1.9', sub: '20 PJ', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'up' },
          { rank: 4, name: 'William Saliba',    team: 'Arsenal',      value: '1.8', sub: '23 PJ', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'up' },
          { rank: 5, name: 'Dayot Upamecano',   team: 'Bayern',       value: '1.6', sub: '21 PJ', flag: '🇫🇷', trend: 'flat' },
          { rank: 6, name: 'Virgil van Dijk',   team: 'Liverpool',    value: '1.5', sub: '28 PJ', flag: '🇳🇱', trend: 'flat' },
        ],
      },
    ],
  },
  {
    id: 'porteros',
    label: 'Porteros',
    icon: '🧤',
    description: 'Porterías a cero, paradas, goles encajados y distribución',
    blocks: [
      {
        id: 'porteria', title: 'Porterías a cero', metric: 'P/0',
        positions: ['Porteros'],
        rows: [
          { rank: 1, name: 'Thibaut Courtois',      team: 'Real Madrid',  value: '14', sub: '30 PJ', flag: '🇧🇪', trend: 'up',   extra: { GE: '18', Min: '2700' } },
          { rank: 2, name: 'Ederson',               team: 'Man City',     value: '13', sub: '29 PJ', flag: '🇧🇷', trend: 'flat', extra: { GE: '19', Min: '2610' } },
          { rank: 3, name: 'Alisson Becker',        team: 'Liverpool',    value: '11', sub: '28 PJ', flag: '🇧🇷', trend: 'up',   extra: { GE: '22', Min: '2520' } },
          { rank: 4, name: 'David Raya',            team: 'Arsenal',      value: '10', sub: '28 PJ', flag: '🇪🇸', trend: 'up',   extra: { GE: '20', Min: '2520' } },
          { rank: 5, name: 'Mike Maignan',          team: 'AC Milan',     value: '10', sub: '27 PJ', flag: '🇫🇷', trend: 'flat', extra: { GE: '24', Min: '2430' } },
          { rank: 6, name: 'Yann Sommer',           team: 'Inter Milán',  value: '9',  sub: '26 PJ', flag: '🇨🇭', trend: 'up',   extra: { GE: '23', Min: '2340' } },
          { rank: 7, name: 'Gianluigi Donnarumma', team: 'PSG', value: '8',  sub: '29 PJ', flag: '🇮🇹', trend: 'flat', extra: { GE: '21', Min: '2610' } },
          { rank: 8, name: 'Gregor Kobel',          team: 'Dortmund',     value: '8',  sub: '24 PJ', flag: '🇨🇭', trend: 'up',   extra: { GE: '26', Min: '2160' } },
        ],
      },
      {
        id: 'porcentaje-paradas', title: '% Paradas', metric: '% Par.',
        positions: ['Porteros'],
        rows: [
          { rank: 1, name: 'David Raya',            team: 'Arsenal',      value: '76%', sub: '28 PJ · 88 par.', flag: '🇪🇸', trend: 'up',   extra: { Paradas: '88', GE: '20' } },
          { rank: 2, name: 'Alisson Becker',        team: 'Liverpool',    value: '74%', sub: '28 PJ · 82 par.', flag: '🇧🇷', trend: 'up',   extra: { Paradas: '82', GE: '22' } },
          { rank: 3, name: 'Gianluigi Donnarumma', team: 'PSG', value: '73%', sub: '29 PJ · 71 par.', flag: '🇮🇹', trend: 'flat', extra: { Paradas: '71', GE: '21' } },
          { rank: 4, name: 'Gregor Kobel',          team: 'Dortmund',     value: '72%', sub: '24 PJ · 68 par.', flag: '🇨🇭', trend: 'up',   extra: { Paradas: '68', GE: '26' } },
          { rank: 5, name: 'Mike Maignan',          team: 'AC Milan',     value: '71%', sub: '27 PJ · 76 par.', flag: '🇫🇷', trend: 'flat', extra: { Paradas: '76', GE: '24' } },
          { rank: 6, name: 'Ederson',               team: 'Man City',     value: '70%', sub: '29 PJ · 65 par.', flag: '🇧🇷', trend: 'flat', extra: { Paradas: '65', GE: '19' } },
          { rank: 7, name: 'Yann Sommer',           team: 'Inter Milán',  value: '69%', sub: '26 PJ · 70 par.', flag: '🇨🇭', trend: 'up',   extra: { Paradas: '70', GE: '23' } },
          { rank: 8, name: 'Thibaut Courtois',      team: 'Real Madrid',  value: '68%', sub: '30 PJ · 62 par.', flag: '🇧🇪', trend: 'flat', extra: { Paradas: '62', GE: '18' } },
        ],
      },
      {
        id: 'goles-encajados', title: 'Goles encajados / 90 min', metric: 'GE/90',
        positions: ['Porteros'],
        rows: [
          { rank: 1, name: 'Thibaut Courtois',      team: 'Real Madrid',  value: '0.60', sub: '30 PJ · 18 GE',  flag: '🇧🇪', trend: 'up' },
          { rank: 2, name: 'Ederson',               team: 'Man City',     value: '0.66', sub: '29 PJ · 19 GE',  flag: '🇧🇷', trend: 'flat' },
          { rank: 3, name: 'David Raya',            team: 'Arsenal',      value: '0.71', sub: '28 PJ · 20 GE',  flag: '🇪🇸', trend: 'up' },
          { rank: 4, name: 'Gianluigi Donnarumma', team: 'PSG', value: '0.72', sub: '29 PJ · 21 GE',  flag: '🇮🇹', trend: 'flat' },
          { rank: 5, name: 'Alisson Becker',        team: 'Liverpool',    value: '0.79', sub: '28 PJ · 22 GE',  flag: '🇧🇷', trend: 'up' },
          { rank: 6, name: 'Yann Sommer',           team: 'Inter Milán',  value: '0.88', sub: '26 PJ · 23 GE',  flag: '🇨🇭', trend: 'up' },
          { rank: 7, name: 'Mike Maignan',          team: 'AC Milan',     value: '0.89', sub: '27 PJ · 24 GE',  flag: '🇫🇷', trend: 'flat' },
          { rank: 8, name: 'Gregor Kobel',          team: 'Dortmund',     value: '1.08', sub: '24 PJ · 26 GE',  flag: '🇨🇭', trend: 'up' },
        ],
      },
      {
        id: 'porteros-nota', title: 'Porteros · Nota media', metric: 'Nota',
        positions: ['Porteros'],
        rows: [
          { rank: 1, name: 'Thibaut Courtois',      team: 'Real Madrid',  value: '9.3', sub: '30 PJ', flag: '🇧🇪', trend: 'up',   extra: { 'P/0': '14', GE: '18' } },
          { rank: 2, name: 'Alisson Becker',        team: 'Liverpool',    value: '9.1', sub: '28 PJ', flag: '🇧🇷', trend: 'up',   extra: { 'P/0': '11', GE: '22' } },
          { rank: 3, name: 'Mike Maignan',          team: 'AC Milan',     value: '8.8', sub: '27 PJ', flag: '🇫🇷', trend: 'flat', extra: { 'P/0': '10', GE: '24' } },
          { rank: 4, name: 'David Raya',            team: 'Arsenal',      value: '8.7', sub: '28 PJ', flag: '🇪🇸', trend: 'up',   extra: { 'P/0': '10', GE: '20' } },
          { rank: 5, name: 'Ederson',               team: 'Man City',     value: '8.6', sub: '29 PJ', flag: '🇧🇷', trend: 'flat', extra: { 'P/0': '13', GE: '19' } },
          { rank: 6, name: 'Gianluigi Donnarumma', team: 'PSG', value: '8.4', sub: '29 PJ', flag: '🇮🇹', trend: 'flat', extra: { 'P/0': '8',  GE: '21' } },
          { rank: 7, name: 'Yann Sommer',           team: 'Inter Milán',  value: '8.2', sub: '26 PJ', flag: '🇨🇭', trend: 'up',   extra: { 'P/0': '9',  GE: '23' } },
          { rank: 8, name: 'Gregor Kobel',          team: 'Dortmund',     value: '8.0', sub: '24 PJ', flag: '🇨🇭', trend: 'up',   extra: { 'P/0': '8',  GE: '26' } },
        ],
      },
      {
        id: 'psxg-ga', title: 'PSxG − GA (Paradas sobre esperado)', metric: 'PSxG-GA',
        positions: ['Porteros'],
        rows: [
          { rank: 1, name: 'David Raya',            team: 'Arsenal',      value: '+8.4', sub: '28 PJ', flag: '🇪🇸', trend: 'up',   extra: { PSxG: '28.4', GA: '20' } },
          { rank: 2, name: 'Alisson Becker',        team: 'Liverpool',    value: '+6.1', sub: '28 PJ', flag: '🇧🇷', trend: 'up',   extra: { PSxG: '28.1', GA: '22' } },
          { rank: 3, name: 'Thibaut Courtois',      team: 'Real Madrid',  value: '+5.8', sub: '30 PJ', flag: '🇧🇪', trend: 'up',   extra: { PSxG: '23.8', GA: '18' } },
          { rank: 4, name: 'Mike Maignan',          team: 'AC Milan',     value: '+4.2', sub: '27 PJ', flag: '🇫🇷', trend: 'flat', extra: { PSxG: '28.2', GA: '24' } },
          { rank: 5, name: 'Yann Sommer',           team: 'Inter Milán',  value: '+3.7', sub: '26 PJ', flag: '🇨🇭', trend: 'up',   extra: { PSxG: '26.7', GA: '23' } },
          { rank: 6, name: 'Ederson',               team: 'Man City',     value: '+2.9', sub: '29 PJ', flag: '🇧🇷', trend: 'flat', extra: { PSxG: '21.9', GA: '19' } },
          { rank: 7, name: 'Gianluigi Donnarumma', team: 'PSG', value: '+1.4', sub: '29 PJ', flag: '🇮🇹', trend: 'flat', extra: { PSxG: '22.4', GA: '21' } },
          { rank: 8, name: 'Gregor Kobel',          team: 'Dortmund',     value: '-1.2', sub: '24 PJ', flag: '🇨🇭', trend: 'down', extra: { PSxG: '24.8', GA: '26' } },
        ],
      },
      {
        id: 'sweeper', title: 'Salidas / acciones de sweeper por PJ', metric: 'Salidas/PJ',
        positions: ['Porteros'],
        rows: [
          { rank: 1, name: 'Alisson Becker',        team: 'Liverpool',    value: '3.2', sub: '28 PJ', flag: '🇧🇷', trend: 'up' },
          { rank: 2, name: 'Gianluigi Donnarumma', team: 'PSG', value: '2.9', sub: '29 PJ', flag: '🇮🇹', trend: 'up' },
          { rank: 3, name: 'Ederson',               team: 'Man City',     value: '2.7', sub: '29 PJ', flag: '🇧🇷', trend: 'flat' },
          { rank: 4, name: 'David Raya',            team: 'Arsenal',      value: '2.4', sub: '28 PJ', flag: '🇪🇸', trend: 'up' },
          { rank: 5, name: 'Thibaut Courtois',      team: 'Real Madrid',  value: '1.8', sub: '30 PJ', flag: '🇧🇪', trend: 'flat' },
          { rank: 6, name: 'Yann Sommer',           team: 'Inter Milán',  value: '1.6', sub: '26 PJ', flag: '🇨🇭', trend: 'flat' },
          { rank: 7, name: 'Mike Maignan',          team: 'AC Milan',     value: '1.5', sub: '27 PJ', flag: '🇫🇷', trend: 'flat' },
        ],
      },
      {
        id: 'distribucion-portero', title: 'Pases largos precisos %', metric: '% P.largos',
        positions: ['Porteros'],
        rows: [
          { rank: 1, name: 'Gianluigi Donnarumma', team: 'PSG', value: '78%', sub: '29 PJ', flag: '🇮🇹', trend: 'flat' },
          { rank: 2, name: 'Alisson Becker',        team: 'Liverpool',    value: '74%', sub: '28 PJ', flag: '🇧🇷', trend: 'up' },
          { rank: 3, name: 'Ederson',               team: 'Man City',     value: '72%', sub: '29 PJ', flag: '🇧🇷', trend: 'flat' },
          { rank: 4, name: 'Thibaut Courtois',      team: 'Real Madrid',  value: '68%', sub: '30 PJ', flag: '🇧🇪', trend: 'flat' },
          { rank: 5, name: 'David Raya',            team: 'Arsenal',      value: '65%', sub: '28 PJ', flag: '🇪🇸', trend: 'up' },
          { rank: 6, name: 'Mike Maignan',          team: 'AC Milan',     value: '63%', sub: '27 PJ', flag: '🇫🇷', trend: 'flat' },
          { rank: 7, name: 'Gregor Kobel',          team: 'Dortmund',     value: '61%', sub: '24 PJ', flag: '🇨🇭', trend: 'flat' },
        ],
      },
    ],
  },
  {
    id: 'presencia',
    label: 'Presencia & Regularidad',
    icon: '📅',
    description: 'Minutos, partidos jugados y titularidades',
    blocks: [
      {
        id: 'minutos', title: 'Minutos jugados', metric: 'Min',
        positions: ['Todos', 'Defensas', 'Mediocampistas', 'Delanteros', 'Porteros'],
        rows: [
          { rank: 1, name: 'Thibaut Courtois',       team: 'Real Madrid',  value: '2700', sub: '30 PJ', flag: '🇧🇪', trend: 'flat' },
          { rank: 2, name: 'Gianluigi Donnarumma',    team: 'PSG',          value: '2610', sub: '29 PJ', flag: '🇮🇹', trend: 'flat' },
          { rank: 3, name: 'Declan Rice',             team: 'Arsenal',      value: '2520', sub: '28 PJ', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'flat' },
          { rank: 4, name: 'Alisson',                team: 'Liverpool',    value: '2520', sub: '28 PJ', flag: '🇧🇷', trend: 'up' },
          { rank: 5, name: 'Virgil van Dijk',        team: 'Liverpool',    value: '2500', sub: '28 PJ', flag: '🇳🇱', trend: 'flat' },
          { rank: 6, name: 'Trent Alexander-Arnold', team: 'Real Madrid',  value: '2480', sub: '28 PJ', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'up' },
          { rank: 7, name: 'Dani Carvajal',          team: 'Real Madrid',  value: '2450', sub: '27 PJ', flag: '🇪🇸', trend: 'flat' },
          { rank: 8, name: 'Joshua Kimmich',         team: 'Bayern',       value: '2420', sub: '27 PJ', flag: '🇩🇪', trend: 'flat' },
          { rank: 9, name: 'Lamine Yamal',           team: 'FC Barcelona', value: '2390', sub: '30 PJ', flag: '🇪🇸', trend: 'up' },
          { rank: 10, name: 'Jules Koundé',          team: 'FC Barcelona', value: '2360', sub: '26 PJ', flag: '🇫🇷', trend: 'flat' },
        ],
      },
      {
        id: 'partidos-titular', title: 'Partidos de titular', metric: 'Titular',
        positions: ['Todos', 'Defensas', 'Mediocampistas', 'Delanteros', 'Porteros'],
        rows: [
          { rank: 1, name: 'Thibaut Courtois',  team: 'Real Madrid',  value: '30', sub: '30 PJ', flag: '🇧🇪', trend: 'flat' },
          { rank: 2, name: 'Lamine Yamal',      team: 'FC Barcelona', value: '29', sub: '30 PJ', flag: '🇪🇸', trend: 'up' },
          { rank: 3, name: 'Rodri',             team: 'Man City',     value: '28', sub: '28 PJ', flag: '🇪🇸', trend: 'flat' },
          { rank: 4, name: 'Virgil van Dijk',   team: 'Liverpool',    value: '28', sub: '28 PJ', flag: '🇳🇱', trend: 'flat' },
          { rank: 5, name: 'Dani Carvajal',     team: 'Real Madrid',  value: '27', sub: '27 PJ', flag: '🇪🇸', trend: 'flat' },
          { rank: 6, name: 'Joshua Kimmich',    team: 'Bayern',       value: '27', sub: '27 PJ', flag: '🇩🇪', trend: 'flat' },
          { rank: 7, name: 'Erling Haaland',    team: 'Man City',     value: '27', sub: '30 PJ', flag: '🇳🇴', trend: 'up' },
          { rank: 8, name: 'William Saliba',    team: 'Arsenal',      value: '26', sub: '27 PJ', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'up' },
        ],
      },
    ],
  },
  {
    id: 'disciplina',
    label: 'Disciplina',
    icon: '🟨',
    description: 'Tarjetas, faltas y suspensiones',
    blocks: [
      {
        id: 'tarjetas-amarillas', title: 'Tarjetas amarillas', metric: 'TA',
        positions: ['Defensas', 'Mediocampistas'],
        rows: [
          { rank: 1, name: 'Casemiro',       team: 'Man United',    value: '12', sub: '29 PJ', flag: '🇧🇷', trend: 'flat' },
          { rank: 2, name: 'Sandro Tonali',  team: 'Newcastle',     value: '11', sub: '28 PJ', flag: '🇮🇹', trend: 'down' },
          { rank: 3, name: 'Tchouaméni',     team: 'Real Madrid',   value: '10', sub: '27 PJ', flag: '🇫🇷', trend: 'flat' },
          { rank: 4, name: 'Marcos Llorente',team: 'Atlético',      value: '9',  sub: '26 PJ', flag: '🇪🇸', trend: 'up' },
          { rank: 5, name: 'Granit Xhaka',   team: 'Leverkusen',    value: '9',  sub: '27 PJ', flag: '🇨🇭', trend: 'flat' },
          { rank: 6, name: 'Dani Parejo',    team: 'Villarreal',    value: '9',  sub: '27 PJ', flag: '🇪🇸', trend: 'flat' },
          { rank: 7, name: 'Rodri',           team: 'Man City',     value: '7',  sub: '28 PJ', flag: '🇪🇸', trend: 'flat' },
        ],
      },
      {
        id: 'tarjetas-rojas', title: 'Tarjetas rojas', metric: 'TR',
        positions: ['Defensas', 'Mediocampistas', 'Delanteros'],
        rows: [
          { rank: 1, name: 'Casemiro',         team: 'Man United',  value: '3', sub: '29 PJ', flag: '🇧🇷', trend: 'flat' },
          { rank: 2, name: 'Marcos Llorente',  team: 'Atlético',    value: '2', sub: '26 PJ', flag: '🇪🇸', trend: 'flat' },
          { rank: 3, name: 'Sandro Tonali',    team: 'Newcastle',   value: '2', sub: '28 PJ', flag: '🇮🇹', trend: 'down' },
          { rank: 4, name: 'Granit Xhaka',     team: 'Leverkusen',  value: '2', sub: '27 PJ', flag: '🇨🇭', trend: 'flat' },
          { rank: 5, name: 'Tchouaméni',       team: 'Real Madrid', value: '1', sub: '27 PJ', flag: '🇫🇷', trend: 'flat' },
        ],
      },
    ],
  },
  {
    id: 'promesas',
    label: 'Promesas Sub-21',
    icon: '🌟',
    description: 'Los mejores talentos menores de 21 años',
    blocks: [
      {
        id: 'promesas-nota', title: 'Promesas Sub-21 · Nota media', metric: 'Nota',
        positions: ['Todos'],
        rows: [
          { rank: 1, name: 'Lamine Yamal',  team: 'FC Barcelona', value: '9.4', sub: '24 PJ', flag: '🇪🇸', trend: 'up', extra: { Edad: '17', Goles: '18' } },
          { rank: 2, name: 'Pau Cubarsí',   team: 'FC Barcelona', value: '8.6', sub: '20 PJ', flag: '🇪🇸', trend: 'up',  extra: { Edad: '17', Goles: '1' } },
          { rank: 3, name: 'Gavi',          team: 'FC Barcelona', value: '8.4', sub: '19 PJ', flag: '🇪🇸', trend: 'up',  extra: { Edad: '20', Goles: '4' } },
          { rank: 4, name: 'Jude Bellingham',team: 'Real Madrid', value: '8.3', sub: '22 PJ', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'flat', extra: { Edad: '21', Goles: '12' } },
          { rank: 5, name: 'Kenan Yıldız',  team: 'Juventus',     value: '8.1', sub: '22 PJ', flag: '🇹🇷', trend: 'up',  extra: { Edad: '19', Goles: '7' } },
          { rank: 6, name: 'Endrick',       team: 'Real Madrid',  value: '7.9', sub: '15 PJ', flag: '🇧🇷', trend: 'up',  extra: { Edad: '18', Goles: '4' } },
          { rank: 7, name: 'Florian Wirtz', team: 'Leverkusen',   value: '7.8', sub: '26 PJ', flag: '🇩🇪', trend: 'up', extra: { Edad: '21', Goles: '11' } },
          { rank: 8, name: 'Warren Zaïre-Emery', team: 'PSG',     value: '7.6', sub: '18 PJ', flag: '🇫🇷', trend: 'up',  extra: { Edad: '18', Goles: '3' } },
          { rank: 9, name: 'Julio Enciso',  team: 'Brighton',     value: '7.3', sub: '14 PJ', flag: '🇵🇾', trend: 'up',  extra: { Edad: '20', Goles: '5' } },
          { rank: 10, name: 'Mauro Icardi', team: 'Sub-21',       value: '7.1', sub: 'Demo',  flag: '🌐', trend: 'flat', extra: { Edad: '21', Goles: '—' } },
        ],
      },
      {
        id: 'promesas-goles', title: 'Promesas · Goles en liga', metric: 'Goles',
        positions: ['Todos'],
        rows: [
          { rank: 1, name: 'Lamine Yamal',  team: 'LaLiga',        value: '18', sub: '30 PJ', flag: '🇪🇸', trend: 'up',  extra: { Edad: '17' } },
          { rank: 2, name: 'Florian Wirtz', team: 'Bundesliga',    value: '11', sub: '26 PJ', flag: '🇩🇪', trend: 'up', extra: { Edad: '21' } },
          { rank: 3, name: 'Jude Bellingham',team: 'LaLiga',       value: '12', sub: '22 PJ', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'flat', extra: { Edad: '21' } },
          { rank: 4, name: 'Kenan Yıldız',  team: 'Serie A',       value: '7',  sub: '22 PJ', flag: '🇹🇷', trend: 'up',  extra: { Edad: '19' } },
          { rank: 5, name: 'Gavi',          team: 'LaLiga',        value: '4',  sub: '19 PJ', flag: '🇪🇸', trend: 'up',  extra: { Edad: '20' } },
          { rank: 6, name: 'Endrick',       team: 'LaLiga',        value: '4',  sub: '15 PJ', flag: '🇧🇷', trend: 'up',  extra: { Edad: '18' } },
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
      { rank: 1, name: 'Aitana Bonmatí',          team: 'FC Barcelona',   value: '22', sub: '25 PJ', flag: '🇪🇸', trend: 'up',   extra: { Asist: '14', xG: '18.4' } },
      { rank: 2, name: 'Salma Paralluelo',         team: 'FC Barcelona',   value: '19', sub: '24 PJ', flag: '🇪🇸', trend: 'up',   extra: { Asist: '8',  xG: '16.1' } },
      { rank: 3, name: 'Sam Kerr',                 team: 'Chelsea Women',  value: '17', sub: '22 PJ', flag: '🇦🇺', trend: 'flat', extra: { Asist: '5',  xG: '15.8' } },
      { rank: 4, name: 'Ada Hegerberg',            team: 'Lyon',           value: '16', sub: '20 PJ', flag: '🇳🇴', trend: 'up',   extra: { Asist: '6',  xG: '14.2' } },
      { rank: 5, name: 'Caroline Graham Hansen',   team: 'FC Barcelona',   value: '14', sub: '23 PJ', flag: '🇳🇴', trend: 'flat', extra: { Asist: '12', xG: '11.8' } },
      { rank: 6, name: 'Pernille Harder',          team: 'Wolfsburg',      value: '13', sub: '22 PJ', flag: '🇩🇰', trend: 'up',   extra: { Asist: '9',  xG: '11.2' } },
      { rank: 7, name: 'Alexia Putellas',          team: 'FC Barcelona',   value: '11', sub: '21 PJ', flag: '🇪🇸', trend: 'up',   extra: { Asist: '10', xG: '9.4' } },
      { rank: 8, name: 'Mariona Caldentey',        team: 'Arsenal Women',  value: '10', sub: '24 PJ', flag: '🇪🇸', trend: 'up',   extra: { Asist: '8',  xG: '8.7' } },
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
            id: 'ranking-fifa', title: 'Ranking FIFA (Top 10)', metric: 'Puntos',
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
          {
            id: 'goleadores-selecciones', title: 'Máximos goleadores internacionales (activos)', metric: 'Goles',
            rows: [
              { rank: 1, name: 'Cristiano Ronaldo',  team: 'Portugal',  value: '135', sub: 'Récord mundial', flag: '🇵🇹', trend: 'flat' },
              { rank: 2, name: 'Lionel Messi',       team: 'Argentina', value: '112', sub: 'Campeón del Mundo', flag: '🇦🇷', trend: 'flat' },
              { rank: 3, name: 'Sunil Chhetri',      team: 'India',     value: '94',  flag: '🇮🇳', trend: 'flat' },
              { rank: 4, name: 'Ali Mabkhout',       team: 'Emiratos',  value: '88',  flag: '🇦🇪', trend: 'flat' },
              { rank: 5, name: 'Romelu Lukaku',      team: 'Bélgica',   value: '87',  flag: '🇧🇪', trend: 'flat' },
              { rank: 6, name: 'Robert Lewandowski', team: 'Polonia',   value: '82',  flag: '🇵🇱', trend: 'up' },
              { rank: 7, name: 'Neymar',             team: 'Brasil',    value: '79',  flag: '🇧🇷', trend: 'down' },
              { rank: 8, name: 'Harry Kane',         team: 'Inglaterra',value: '72',  flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'up' },
            ],
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
          {
            id: 'dt-trofeos', title: 'DT con más trofeos activos', metric: 'Trofeos',
            rows: [
              { rank: 1, name: 'Pep Guardiola',  team: 'Man City',     value: '40', sub: 'en activo', flag: '🇪🇸', trend: 'up' },
              { rank: 2, name: 'Carlo Ancelotti', team: 'Brasil',       value: '28', sub: 'en activo', flag: '🇮🇹', trend: 'flat' },
              { rank: 3, name: 'José Mourinho',   team: 'Benfica',      value: '26', sub: 'en activo',  flag: '🇵🇹', trend: 'flat' },
              { rank: 4, name: 'Diego Simeone',   team: 'Atlético',     value: '13', sub: 'en activo', flag: '🇦🇷', trend: 'flat' },
              { rank: 5, name: 'Hansi Flick',     team: 'FC Barcelona', value: '11', sub: 'en activo', flag: '🇩🇪', trend: 'up' },
              { rank: 6, name: 'Xabi Alonso',     team: 'Sin equipo',   value: '3',  sub: 'en activo', flag: '🇪🇸', trend: 'flat' },
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
            id: 'nba-efficiency', title: 'Eficiencia PER', metric: 'PER',
            rows: [
              { rank: 1, name: 'Nikola Jokić',          team: 'Denver',     value: '31.2', sub: '61 PJ', flag: '🇷🇸', trend: 'up' },
              { rank: 2, name: 'Giannis Antetokounmpo', team: 'Milwaukee',  value: '29.4', sub: '60 PJ', flag: '🇬🇷', trend: 'flat' },
              { rank: 3, name: 'SGA',                   team: 'OKC',        value: '28.7', sub: '65 PJ', flag: '🇨🇦', trend: 'up' },
              { rank: 4, name: 'Luka Dončić',           team: 'LA Lakers',  value: '27.9', sub: '62 PJ', flag: '🇸🇮', trend: 'flat' },
              { rank: 5, name: 'Victor Wembanyama',     team: 'San Antonio',value: '26.8', sub: '58 PJ', flag: '🇫🇷', trend: 'up' },
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
          {
            id: 'f1-vueltas-rapidas', title: 'Vueltas rápidas', metric: 'VR',
            rows: [
              { rank: 1, name: 'Kimi Antonelli',  team: 'Mercedes',  value: '2', sub: 'Temp. 2026 · R4', flag: '🇮🇹', trend: 'up' },
              { rank: 2, name: 'Max Verstappen',  team: 'Red Bull',  value: '1', sub: 'Temp. 2026 · R4', flag: '🇳🇱', trend: 'flat' },
              { rank: 3, name: 'Lando Norris',    team: 'McLaren',   value: '1', sub: 'Temp. 2026 · R4', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'flat' },
            ],
          },
        ],
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
          {
            id: 'atp-wins-surface', title: 'Victorias por superficie (ATP)', metric: '% Vic.',
            rows: [
              { rank: 1, name: 'Carlos Alcaraz', value: '88%', sub: 'Tierra · 2024-25', flag: '🇪🇸', trend: 'up',   extra: { Dura: '74%', Hierba: '82%' } },
              { rank: 2, name: 'Jannik Sinner',  value: '86%', sub: 'Dura · 2024-25',   flag: '🇮🇹', trend: 'up',   extra: { Dura: '86%', Tierra: '71%' } },
              { rank: 3, name: 'Novak Djokovic', value: '84%', sub: 'Global · 2024-25', flag: '🇷🇸', trend: 'flat', extra: { Dura: '82%', Tierra: '85%' } },
              { rank: 4, name: 'Alexander Zverev', value: '76%', sub: 'Tierra · 2024-25', flag: '🇩🇪', trend: 'up',   extra: { Dura: '68%', Tierra: '76%' } },
              { rank: 5, name: 'Daniil Medvedev', value: '79%', sub: 'Dura · 2024-25',   flag: '🇷🇺', trend: 'flat', extra: { Dura: '79%', Tierra: '60%' } },
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
        id: 'ranking-ufc', label: 'Rankings', icon: '🏆',
        blocks: [
          {
            id: 'ufc-p4p', title: 'Pound for Pound (Top 10)', metric: 'Pos.',
            rows: [
              { rank: 1,  name: 'Islam Makhachev',   team: 'Ligero',        value: '#1',  sub: 'Ref. May-2025', flag: '🇷🇺', trend: 'flat' },
              { rank: 2,  name: 'Jon Jones',          team: 'Peso completo', value: '#2',  sub: 'Ref. May-2025', flag: '🇺🇸', trend: 'flat' },
              { rank: 3,  name: 'Alex Pereira',       team: 'Semi-pesado',   value: '#3',  sub: 'Ref. May-2025', flag: '🇧🇷', trend: 'up' },
              { rank: 4,  name: 'Dricus du Plessis',  team: 'Medio',         value: '#4',  sub: 'Ref. May-2025', flag: '🇿🇦', trend: 'up' },
              { rank: 5,  name: 'Ilia Topuria',       team: 'Pluma',         value: '#5',  sub: 'Ref. May-2025', flag: '🇬🇪', trend: 'up' },
              { rank: 6,  name: "Sean O'Malley",      team: 'Gallo',         value: '#6',  sub: 'Ref. May-2025', flag: '🇺🇸', trend: 'flat' },
              { rank: 7,  name: 'Tom Aspinall',       team: 'Pesado (I)',    value: '#7',  sub: 'Ref. May-2025', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', trend: 'up' },
              { rank: 8,  name: 'Merab Dvalishvili',  team: 'Gallo',         value: '#8',  sub: 'Ref. May-2025', flag: '🇬🇪', trend: 'up' },
              { rank: 9,  name: 'Belal Muhammad',     team: 'Wélter',        value: '#9',  sub: 'Ref. May-2025', flag: '🇺🇸', trend: 'flat' },
              { rank: 10, name: 'Alexandre Pantoja',  team: 'Mosca',         value: '#10', sub: 'Ref. May-2025', flag: '🇧🇷', trend: 'flat' },
            ],
          },
          {
            id: 'ufc-ko', title: 'Más KO/TKO en activo', metric: 'KOs',
            rows: [
              { rank: 1, name: 'Derrick Lewis',     value: '14', sub: '28 victorias', flag: '🇺🇸', trend: 'flat' },
              { rank: 2, name: 'Jon Jones',         value: '11', sub: '18 victorias', flag: '🇺🇸', trend: 'flat' },
              { rank: 3, name: 'Francis Ngannou',   value: '10', sub: '17 victorias', flag: '🇨🇲', trend: 'flat' },
              { rank: 4, name: 'Israel Adesanya',   value: '10', sub: '24 victorias', flag: '🇳🇬', trend: 'down' },
              { rank: 5, name: 'Max Holloway',      value: '9',  sub: '26 victorias', flag: '🇺🇸', trend: 'up' },
              { rank: 6, name: 'Ciryl Gane',        value: '8',  sub: '13 victorias', flag: '🇫🇷', trend: 'flat' },
            ],
          },
          {
            id: 'ufc-campeones', title: 'Campeones actuales por división', metric: 'División',
            rows: [
              { rank: 1, name: 'Jon Jones',           team: 'Peso completo',   value: 'Campeón', flag: '🇺🇸', trend: 'flat' },
              { rank: 2, name: 'Magomed Ankalaev',    team: 'Semipesado',      value: 'Campeón', flag: '🇷🇺', trend: 'up' },
              { rank: 3, name: 'Dricus du Plessis',   team: 'Medio',           value: 'Campeón', flag: '🇿🇦', trend: 'up' },
              { rank: 4, name: 'Belal Muhammad',      team: 'Wélter',          value: 'Campeón', flag: '🇺🇸', trend: 'up' },
              { rank: 5, name: 'Islam Makhachev',     team: 'Ligero',          value: 'Campeón', flag: '🇷🇺', trend: 'flat' },
              { rank: 6, name: 'Ilia Topuria',        team: 'Pluma',           value: 'Campeón', flag: '🇬🇪', trend: 'up' },
              { rank: 7, name: 'Alexandre Pantoja',   team: 'Mosca',           value: 'Campeón', flag: '🇧🇷', trend: 'flat' },
              { rank: 8, name: 'Merab Dvalishvili',   team: 'Gallo',           value: 'Campeón', flag: '🇬🇪', trend: 'up' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'golf', label: 'Golf', emoji: '⛳', accent: '#84cc16',
    sections: [
      {
        id: 'pga', label: 'PGA Tour', icon: '🏌️',
        blocks: [
          {
            id: 'pga-leaderboard', title: 'Leaderboard torneo activo', metric: 'Score',
            rows: [
              { rank: 1, name: 'Scottie Scheffler',  value: '-12', sub: 'Completado', flag: '🇺🇸', trend: 'up' },
              { rank: 2, name: 'Rory McIlroy',        value: '-10', sub: 'Completado', flag: '🇬🇧', trend: 'up' },
              { rank: 3, name: 'Collin Morikawa',     value: '-8',  sub: 'Completado', flag: '🇺🇸', trend: 'flat' },
              { rank: 4, name: 'Xander Schauffele',   value: '-7',  sub: 'Completado', flag: '🇺🇸', trend: 'flat' },
              { rank: 5, name: 'Jon Rahm',            value: '-6',  sub: 'Completado', flag: '🇪🇸', trend: 'flat' },
            ],
          },
          {
            id: 'pga-fedex', title: 'FedEx Cup (clasificación)', metric: 'Puntos',
            rows: [
              { rank: 1, name: 'Scottie Scheffler',  value: '2850', sub: 'Puntos FedEx', flag: '🇺🇸', trend: 'up' },
              { rank: 2, name: 'Rory McIlroy',        value: '2340', sub: 'Puntos FedEx', flag: '🇬🇧', trend: 'up' },
              { rank: 3, name: 'Collin Morikawa',     value: '2110', sub: 'Puntos FedEx', flag: '🇺🇸', trend: 'flat' },
              { rank: 4, name: 'Xander Schauffele',   value: '1980', sub: 'Puntos FedEx', flag: '🇺🇸', trend: 'flat' },
              { rank: 5, name: 'Jon Rahm',            value: '1720', sub: 'Puntos FedEx', flag: '🇪🇸', trend: 'flat' },
            ],
          },
        ],
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
function seededRng(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0
  return () => { h ^= h << 13; h ^= h >> 17; h ^= h << 5; return (h >>> 0) / 4294967296 }
}

function Sparkline({ trend, seed = '', width = 44, height = 16 }: {
  trend?: 'up' | 'down' | 'flat'; seed?: string; width?: number; height?: number
}) {
  const rng = seededRng(seed || 'x')
  const n = 6
  const pts: number[] = []
  let v = 30 + rng() * 40
  for (let i = 0; i < n; i++) {
    const bias = trend === 'up' ? 9 / n : trend === 'down' ? -9 / n : 0
    v = Math.max(5, Math.min(95, v + (rng() - 0.5) * 18 + bias))
    pts.push(v)
  }
  const min = Math.min(...pts), max = Math.max(...pts), range = max - min || 1
  const pad = 2
  const coords = pts.map((val, i) => [
    (i / (n - 1)) * (width - pad * 2) + pad,
    height - pad - ((val - min) / range) * (height - pad * 2),
  ])
  const points = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const color = trend === 'up' ? '#4ade80' : trend === 'down' ? '#f87171' : '#3A3A52'
  const [lx, ly] = coords[n - 1]
  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" opacity="0.75" />
      <circle cx={lx.toFixed(1)} cy={ly.toFixed(1)} r="1.8" fill={color} />
    </svg>
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

function FreshnessBadge({ isLive, meta }: { isLive?: boolean; meta?: BlockMeta }) {
  // Order of priority:
  //  1) live override active in client → LIVE green
  //  2) meta.status === 'historical' → HIST · {asOf} grey
  //  3) meta.status === 'unavailable' → NO DISPONIBLE neutral red
  //  4) default fallback → "Ref. 24/25" silenced
  const base = 'text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded'
  if (isLive) {
    return (
      <span className={base} title={meta?.source ? `Fuente: ${meta.source}` : 'Datos en vivo'}
        style={{ background: 'rgba(74,222,128,0.14)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.32)', fontFamily: 'var(--font-sport)' }}>
        ● LIVE
      </span>
    )
  }
  if (meta?.status === 'historical') {
    return (
      <span className={base} title={meta.source ? `Fuente: ${meta.source}` : ''}
        style={{ background: 'rgba(148,163,184,0.10)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.25)', fontFamily: 'var(--font-sport)' }}>
        Hist · {meta.asOf ?? '—'}
      </span>
    )
  }
  if (meta?.status === 'unavailable') {
    return (
      <span className={base} title={meta.source}
        style={{ background: 'rgba(248,113,113,0.10)', color: '#f87171', border: '1px solid rgba(248,113,113,0.28)', fontFamily: 'var(--font-sport)' }}>
        No disponible
      </span>
    )
  }
  return (
    <span className={base}
      style={{ background: 'rgba(255,255,255,0.04)', color: '#6A6A82', border: '1px solid rgba(255,255,255,0.07)', fontFamily: 'var(--font-sport)' }}>
      Ref. 24/25
    </span>
  )
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
          {WC_COLS.map(col => (
            <span key={col} className="w-6 text-center">{col}</span>
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
                  {[pj, v, e, d, `${gdNum >= 0 ? '+' : ''}${gdNum}`, pts].map((val, j) => (
                    <span key={j} className="w-6 text-center text-[11px] tabular-nums font-semibold"
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

function StatBlockCard({ block, accent, expanded, onToggle, leagueFilter, isLive, meta }: {
  block: StatBlock; accent: string; expanded: boolean; onToggle: () => void; leagueFilter?: string; isLive?: boolean; meta?: BlockMeta
}) {
  if (block.placeholder) return <PlaceholderBlockCard block={block} accent={accent} />

  const filteredRows = leagueFilter && leagueFilter !== 'General'
    ? block.rows.filter(r => TEAM_LEAGUE[r.team ?? ''] === leagueFilter)
    : block.rows
  const displayRows = expanded ? filteredRows : filteredRows.slice(0, 5)
  const hasExtra = filteredRows[0]?.extra && Object.keys(filteredRows[0].extra).length > 0
  const extraKeys = hasExtra ? Object.keys(filteredRows[0]!.extra!) : []

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="px-5 py-4 flex items-center justify-between gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2.5 flex-wrap min-w-0">
          <span className="section-accent" style={{ background: accent }} />
          <h3 className="font-black text-sm truncate" style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
            {block.title}
          </h3>
          <FreshnessBadge isLive={isLive} meta={meta} />
        </div>
        <span className="text-[11px] font-black uppercase tracking-widest flex-shrink-0" style={{ color: accent, fontFamily: 'var(--font-sport)' }}>
          {block.metric}
        </span>
      </div>

      <div className="px-5 pt-2 pb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
        style={{ color: '#5A5A72', fontFamily: 'var(--font-sport)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <span className="w-8 flex-shrink-0">#</span>
        <span className="flex-1">Nombre</span>
        {extraKeys.slice(0, 2).map(k => (
          <span key={k} className="hidden lg:block w-14 text-right">{k}</span>
        ))}
        <span className="w-14 text-right">{block.metric}</span>
        <span className="w-11 flex-shrink-0" />
      </div>

      <div className="flex flex-col">
        {displayRows.length === 0 && (
          <p className="px-5 py-6 text-center text-[11px]" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>
            Sin datos para {leagueFilter}
          </p>
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
                <span className="text-[11px]" style={{ color: '#7A7A92', fontFamily: 'var(--font-sport)' }}>
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
            <div className="w-11 flex-shrink-0 flex items-center justify-end">
              <Sparkline trend={row.trend} seed={row.name} />
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
    </div>
  )
}

function MetricGroupAccordion({ group, accent, expanded, onToggle, expandedBlocks, onToggleBlock, positionFilter, leagueFilter, livePlayerData, liveMeta }: {
  group: MetricGroup
  accent: string
  expanded: boolean
  onToggle: () => void
  expandedBlocks: Record<string, boolean>
  onToggleBlock: (id: string) => void
  positionFilter?: string
  leagueFilter?: string
  livePlayerData?: LivePlayerData | null
  liveMeta?: Record<string, BlockMeta>
}) {
  const visibleBlocks = positionFilter && positionFilter !== 'Todos'
    ? group.blocks.filter(b => !b.positions || b.positions.includes(positionFilter))
    : group.blocks

  if (visibleBlocks.length === 0) return null

  // Apply live player data to group blocks
  const liveVisibleBlocks = visibleBlocks.map(b => {
    if (livePlayerData && LIVE_PLAYER_BLOCK_IDS.has(b.id)) {
      const { block: updated } = applyLivePlayerToBlock(b, livePlayerData, leagueFilter)
      return updated
    }
    return b
  })

  const dataCount  = liveVisibleBlocks.filter(b => !b.placeholder).length
  const soonCount  = liveVisibleBlocks.filter(b => b.placeholder).length
  const liveCount  = livePlayerData ? liveVisibleBlocks.filter(b => LIVE_PLAYER_BLOCK_IDS.has(b.id) && b.rows.length > 0).length : 0

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
          {liveVisibleBlocks.map(block => (
            <StatBlockCard
              key={block.id}
              block={block}
              accent={accent}
              expanded={!!expandedBlocks[block.id]}
              onToggle={() => onToggleBlock(block.id)}
              leagueFilter={leagueFilter}
              isLive={!!livePlayerData && LIVE_PLAYER_BLOCK_IDS.has(block.id) && block.rows.length > 0}
              meta={liveMeta?.[BLOCK_TO_META_KEY[block.id]]}
            />
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
  'f1-campeonato', 'f1-constructores', 'f1-poles', 'f1-vueltas-rapidas',
  'atp-ranking', 'wta-ranking',
  'goles-equipo', 'menos-goles',
  'ranking-fifa',
  'nba-scoring', 'nba-rebounds', 'nba-assists', 'nba-blocks', 'nba-steals', 'nba-efficiency', 'nba-3pt',
  'f-ligaf-tabla', 'f-goleadoras', 'f-asistencias',
  'pga-leaderboard', 'pga-fedex',
  'nations-a1', 'nations-a2', 'nations-a3', 'nations-a4',
  'stats-dt',
  'ufc-p4p',
  // World Cup 2026 — grupos A-L + goleadores
  'wc-group-a', 'wc-group-b', 'wc-group-c', 'wc-group-d',
  'wc-group-e', 'wc-group-f', 'wc-group-g', 'wc-group-h',
  'wc-group-i', 'wc-group-j', 'wc-group-k', 'wc-group-l',
  'wc-scorers',
  'wc-knockout',
  // NBA Playoffs
  'nba-playoffs',
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
  womenLigaF: LiveStandingRow[]
  womenGoals: LiveStandingRow[]; womenAssists: LiveStandingRow[]
  pgaTourLeaderboard?: LiveStandingRow[]
  pgaFedExCup?: LiveStandingRow[]
  nationsLeague?: LiveLeague[]
  coachesWinRate?: LiveStandingRow[]
  worldCup?: LiveLeague[]
  worldCupScorers?: LiveStandingRow[]
  worldCupKnockout?: LiveStandingRow[]
  nbaPlayoffSeries?: LiveStandingRow[]
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
  'f1-poles': 'f1Poles', 'f1-vueltas-rapidas': 'f1FastestLaps',
  'atp-ranking': 'atpRanking', 'wta-ranking': 'wtaRanking',
  'ranking-fifa': 'fifaRanking',
  'ufc-p4p': 'ufcP4P',
  'f-ligaf-tabla': 'womenLigaF', 'f-goleadoras': 'womenGoals', 'f-asistencias': 'womenAssists',
  'pga-leaderboard': 'pgaTourLeaderboard', 'pga-fedex': 'pgaFedExCup',
  'nations-a1': 'nationsLeague', 'nations-a2': 'nationsLeague', 'nations-a3': 'nationsLeague', 'nations-a4': 'nationsLeague',
  'stats-dt': 'coachesWinRate',
  'wc-group-a': 'worldCup', 'wc-group-b': 'worldCup', 'wc-group-c': 'worldCup',
  'wc-group-d': 'worldCup', 'wc-group-e': 'worldCup', 'wc-group-f': 'worldCup',
  'wc-group-g': 'worldCup', 'wc-group-h': 'worldCup', 'wc-group-i': 'worldCup',
  'wc-group-j': 'worldCup', 'wc-group-k': 'worldCup', 'wc-group-l': 'worldCup',
  'wc-scorers':  'worldCupScorers',
  'wc-knockout': 'worldCupKnockout',
  'nba-playoffs': 'nbaPlayoffSeries',
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

// IDs of blocks that get player-stats live data
const LIVE_PLAYER_BLOCK_IDS = new Set([
  'pichichi-laliga', 'bota-oro', 'goleadores', 'asistencias',
  'tarjetas-amarillas', 'tarjetas-rojas', 'tiros-puerta', 'goles-90',
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

export default function EstadisticasClient({ initialData }: { initialData?: LiveStandingsData | null }) {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [sportId, setSportId] = useState<string>(() => {
    const sp = searchParams.get('sport') ?? ''
    return SPORTS.find(s => s.id === sp) ? sp : 'futbol'
  })
  const [sectionId, setSectionId] = useState<string>(() => {
    const sp = searchParams.get('sport') ?? 'futbol'
    const sec = searchParams.get('section') ?? ''
    const sport = SPORTS.find(s => s.id === sp) ?? SPORTS[1]
    return sport.sections.find(s => s.id === sec) ? sec : sport.sections[0].id
  })
  const [expandedBlocks, setExpandedBlocks]   = useState<Record<string, boolean>>({})
  const [expandedGroups, setExpandedGroups]   = useState<Record<string, boolean>>(() => {
    const firstGroupId = SPORTS[0].sections[0].groups?.[0]?.id
    return firstGroupId ? { [firstGroupId]: true } : {}
  })
  const [positionFilter, setPositionFilter]   = useState('Todos')
  const [leagueFilter, setLeagueFilter]       = useState('General')
  const [gender, setGender]                   = useState<'m' | 'f'>('m')
  const [liveData, setLiveData]               = useState<LiveStandingsData | null>(initialData ?? null)
  const [livePlayerData, setLivePlayerData]   = useState<LivePlayerData | null>(null)
  const [lastUpdated, setLastUpdated]         = useState<Date | null>(initialData ? new Date() : null)
  const [fetchError, setFetchError]           = useState<string | null>(null)
  const [refreshing, setRefreshing]           = useState(false)

  const POLL_MS = 5 * 60_000

  const refreshOnceRef = useRef<() => void>(() => {})

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      setRefreshing(true)
      try {
        const [standings, players] = await Promise.all([
          fetch('/api/stats/standings').then(r => r.ok ? r.json() : Promise.reject(new Error(`standings ${r.status}`))),
          fetch('/api/stats/players').then(r => r.ok ? r.json() : Promise.reject(new Error(`players ${r.status}`))),
        ])
        if (cancelled) return
        if (standings) setLiveData(standings)
        if (players)   setLivePlayerData(players)
        setLastUpdated(new Date())
        setFetchError(null)
      } catch (err) {
        if (cancelled) return
        setFetchError(err instanceof Error ? err.message : 'Error de red')
      } finally {
        if (!cancelled) setRefreshing(false)
      }
    }
    refreshOnceRef.current = fetchData
    if (!initialData) fetchData()
    const interval = setInterval(fetchData, POLL_MS)
    return () => { cancelled = true; clearInterval(interval) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function applyLive(blocks: StatBlock[]): StatBlock[] {
    return blocks.map(block => {
      // Standings data
      if (liveData) {
        const league = liveData.football.find(l => l.id === block.id)
        if (league?.rows.length) return { ...block, rows: toStatRows(league.rows), placeholder: false }
        if (block.id === 'nba-este'        && liveData.nbaEast.length)         return { ...block, rows: toStatRows(liveData.nbaEast) }
        if (block.id === 'nba-oeste'       && liveData.nbaWest.length)         return { ...block, rows: toStatRows(liveData.nbaWest) }
        if (block.id === 'f1-campeonato'   && liveData.f1Drivers.length)       return { ...block, rows: toStatRows(liveData.f1Drivers, 'Escudería') }
        if (block.id === 'f1-constructores'&& liveData.f1Constructors.length)  return { ...block, rows: toStatRows(liveData.f1Constructors) }
        if (block.id === 'atp-ranking'       && liveData.atpRanking?.length)     return { ...block, rows: toStatRows(liveData.atpRanking) }
        if (block.id === 'wta-ranking'       && liveData.wtaRanking?.length)     return { ...block, rows: toStatRows(liveData.wtaRanking) }
        if (block.id === 'f1-poles'          && liveData.f1Poles?.length)        return { ...block, rows: toStatRows(liveData.f1Poles, 'Escudería') }
        if (block.id === 'f1-vueltas-rapidas'&& liveData.f1FastestLaps?.length)  return { ...block, rows: toStatRows(liveData.f1FastestLaps, 'Escudería') }
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
        if (block.id === 'pga-leaderboard'   && liveData.pgaTourLeaderboard?.length) {
          const tournamentName = liveData.pgaTourLeaderboard![0]?.extra?.Torneo ?? ''
          return { ...block, title: tournamentName || 'Leaderboard PGA Tour', rows: toStatRows(liveData.pgaTourLeaderboard!) }
        }
        if (block.id === 'pga-fedex'         && liveData.pgaFedExCup?.length)         return { ...block, rows: toStatRows(liveData.pgaFedExCup!) }
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
    const meta = liveData?.meta?.[BLOCK_TO_META_KEY[block.id]]
    if (meta?.status === 'unavailable') return false
    if (liveData && LIVE_BLOCK_IDS.has(block.id) && block.rows.length > 0) return true
    if (livePlayerData && LIVE_PLAYER_BLOCK_IDS.has(block.id) && block.rows.length > 0) return true
    return false
  }

  const sport = SPORTS.find(s => s.id === sportId) ?? SPORTS[0]
  const isFemenino = gender === 'f' && sportId === 'futbol'

  const handleSportChange = (id: string) => {
    const firstSport = SPORTS.find(s => s.id === id)
    const firstSection = firstSport?.sections[0]
    setSportId(id)
    setGender('m')
    setSectionId(firstSection?.id ?? 'jugadores')
    setExpandedBlocks({})
    setExpandedGroups(firstSection?.groups ? { [firstSection.groups[0]?.id ?? '']: true } : {})
    setPositionFilter('Todos')
    setLeagueFilter('General')
    router.push(`/estadisticas?sport=${id}`, { scroll: false })
  }

  const handleSectionChange = (id: string) => {
    const sec = sport.sections.find(s => s.id === id)
    setSectionId(id)
    setExpandedBlocks({})
    setExpandedGroups(sec?.groups ? { [sec.groups[0]?.id ?? '']: true } : {})
    setPositionFilter('Todos')
    setLeagueFilter('General')
    router.push(`/estadisticas?sport=${sportId}&section=${id}`, { scroll: false })
  }

  const section = sport.sections.find(s => s.id === sectionId) ?? sport.sections[0]
  const isFutbol = sportId === 'futbol'
  const isFutbolJugadores = isFutbol && sectionId === 'jugadores'
  const hasGroups = !!(section?.groups && section.groups.length > 0)

  const flatBlocks = applyLive(section?.blocks ?? [])
  const filteredFlatBlocks = (sectionId === 'competiciones' && leagueFilter !== 'General')
    ? flatBlocks.filter(b => !b.league || b.league === leagueFilter)
    : flatBlocks

  const positionFilteredBlocks = (hasGroups && positionFilter !== 'Todos' && section?.groups)
    ? section.groups.flatMap(g => g.blocks).filter(b => !b.positions || b.positions.includes(positionFilter))
    : []

  const toggleBlock = (id: string) => setExpandedBlocks(prev => ({ ...prev, [id]: !prev[id] }))
  const toggleGroup = (id: string) => setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }))

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <Header />
      <LiveStrip />

      <main className="max-w-[1440px] mx-auto px-6 xl:px-10 pb-24">

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
              <button onClick={() => refreshOnceRef.current()} disabled={refreshing}
                className="text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full transition-opacity hover:opacity-80 disabled:opacity-40"
                style={{ background: 'rgba(34,197,94,0.08)', color: '#86efac', border: '1px solid rgba(34,197,94,0.2)', fontFamily: 'var(--font-sport)', cursor: refreshing ? 'wait' : 'pointer' }}>
                {refreshing ? 'Refrescando…' : 'Refrescar'}
              </button>
              {fetchError && (
                <span className="text-[11px]" style={{ color: '#f87171', fontFamily: 'var(--font-sport)' }}>
                  ⚠ Algunos datos no se han podido actualizar ({fetchError})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── NAVEGACIÓN STICKY (deporte + sección) ─── */}
        <div className="sticky z-30 -mx-6 xl:-mx-10 px-6 xl:px-10"
          style={{ top: 56, background: 'var(--bg-base)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>

          {/* TAB 1: DEPORTE */}
          <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-0"
            style={{ borderBottom: '1px solid var(--border)' }}>
            {SPORTS.map(s => (
              <button key={s.id} onClick={() => handleSportChange(s.id)}
                className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap"
                style={{
                  fontFamily: 'var(--font-sport)',
                  color: sportId === s.id ? s.accent : s.id === 'mundial' ? '#f59e0b' : 'var(--text-muted)',
                  background: s.id === 'mundial' && sportId !== 'mundial' ? 'rgba(245,158,11,0.08)' : 'none',
                  border: 'none',
                  borderBottom: sportId === s.id ? `2px solid ${s.accent}` : s.id === 'mundial' ? '2px solid rgba(245,158,11,0.35)' : '2px solid transparent',
                  borderRadius: s.id === 'mundial' && sportId !== 'mundial' ? '6px 6px 0 0' : undefined,
                  marginBottom: -1, cursor: 'pointer',
                }}>
                <span className="text-sm leading-none">{s.emoji}</span>
                {s.label}
                {s.id === 'mundial' && <span className="text-[9px] font-black px-1 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b', letterSpacing: '0.05em' }}>🔜</span>}
              </button>
            ))}
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
              <StatBlockCard key={block.id} block={block} accent="#22c55e" expanded={!!expandedBlocks[block.id]} onToggle={() => toggleBlock(block.id)} isLive={LIVE_BLOCK_IDS.has(block.id) && !!liveData} meta={liveData?.meta?.[BLOCK_TO_META_KEY[block.id]]} />
            ))}
          </div>
        )}

        {isFutbolJugadores && !isFemenino && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5 mb-3">
            {POSITION_FILTERS.map(pos => (
              <button key={pos} onClick={() => setPositionFilter(pos)}
                className="flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-semibold transition-all"
                style={{
                  background: positionFilter === pos ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.04)',
                  color: positionFilter === pos ? '#22c55e' : '#5A5A72',
                  border: positionFilter === pos ? '1px solid rgba(34,197,94,0.35)' : '1px solid rgba(255,255,255,0.05)',
                  boxShadow: positionFilter === pos ? '0 2px 10px rgba(34,197,94,0.15)' : 'none',
                  cursor: 'pointer', fontFamily: 'var(--font-sport)',
                }}>
                {pos}
              </button>
            ))}
          </div>
        )}
        {!isFemenino && (isFutbolJugadores || (isFutbol && sectionId === 'competiciones')) && (
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

        {!isFemenino && hasGroups && section.groups ? (
          positionFilter !== 'Todos' ? (
            positionFilteredBlocks.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {positionFilteredBlocks.map(block => {
                  const resolved = livePlayerData && LIVE_PLAYER_BLOCK_IDS.has(block.id)
                    ? applyLivePlayerToBlock(block, livePlayerData, leagueFilter)
                    : { block, isLive: false }
                  return (
                    <StatBlockCard
                      key={block.id}
                      block={resolved.block}
                      accent={sport.accent}
                      expanded={!!expandedBlocks[block.id]}
                      onToggle={() => toggleBlock(block.id)}
                      leagueFilter={leagueFilter}
                      isLive={resolved.isLive}
                      meta={liveData?.meta?.[BLOCK_TO_META_KEY[block.id]]}
                    />
                  )
                })}
              </div>
            ) : (
              <div className="py-16 text-center">
                <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
                  No hay métricas para esta posición todavía.
                </p>
              </div>
            )
          ) : (
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
                  positionFilter={positionFilter}
                  leagueFilter={leagueFilter}
                  livePlayerData={livePlayerData}
                  liveMeta={liveData?.meta}
                />
              ))}
            </div>
          )
        ) : (
          <>
            <div className={`grid gap-5 ${
              sportId === 'mundial' && sectionId === 'grupos'
                ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
                : 'grid-cols-1 lg:grid-cols-2'
            }`}>
              {filteredFlatBlocks.map(block => {
                const blockMeta = liveData?.meta?.[BLOCK_TO_META_KEY[block.id]]
                const live = isBlockLive(block)
                if (block.id.startsWith('wc-group-'))
                  return <WorldCupGroupCard key={block.id} block={block} accent={sport.accent} isLive={live} meta={blockMeta} />
                if (block.id === 'nba-playoffs' || block.id === 'wc-knockout')
                  return <PlayoffSeriesCard key={block.id} block={block} accent={sport.accent} isLive={live} meta={blockMeta} />
                return (
                  <StatBlockCard
                    key={block.id}
                    block={block}
                    accent={sport.accent}
                    expanded={!!expandedBlocks[block.id]}
                    onToggle={() => toggleBlock(block.id)}
                    leagueFilter={leagueFilter}
                    isLive={live}
                    meta={blockMeta}
                  />
                )
              })}
            </div>
            {filteredFlatBlocks.length === 0 && (
              <div className="py-16 text-center">
                <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
                  No hay datos disponibles para esta combinación.
                </p>
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
  )
}
