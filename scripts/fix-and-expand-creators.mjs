#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// fix-and-expand-creators.mjs
//
// 1. Elimina entradas no deportivas (Luisito Comunica, MDRK, JOMA)
// 2. Elimina duplicados (mantiene el que tiene handles)
// 3. Corrige entradas con sport=null/undefined
// 4. Añade creadores populares que faltaban
//
// Uso:
//   node scripts/fix-and-expand-creators.mjs           # DRY RUN
//   node scripts/fix-and-expand-creators.mjs --apply
// ─────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const APPLY = process.argv.includes('--apply')
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE keys'); process.exit(1) }

// ── 1. Entradas a ELIMINAR ────────────────────────────────────────
// No deportivas o duplicados sin handles (se conserva el gemelo con handles)
const DELETE_IDS = [
  // No deportivos
  'luisito-com',       // Luisito Comunica — viajes/entretenimiento, no deportes
  'mdrk',              // MDRK — no deportivo
  // Duplicados — conservamos el que tiene handles
  'djmario',           // duplicado de djmariio
  'guillemBalague',    // duplicado de guillembalague
  'helenaCondis',      // duplicado de helenacondis
  'tomasRoncero',      // duplicado de tomasroncero
  'nba-journalist',    // duplicado de shamscharania
  'tenis-journalist',  // duplicado de josemorgado
  'nicorosberg',       // duplicado de f1-journalist (Nico Rosberg)
  'jijantes',          // duplicado de gerardromero (canal Jijantes = Gerard Romero)
]

// ── 2. Correcciones de sport/category ────────────────────────────
const PATCH_SPORT = [
  { id: 'resumen-canal',  sport: 'futbol',  category: 'creadores',  name: 'El Chiringuito (resumen)' },
  { id: 'reaccionando',   sport: 'futbol',  category: 'creadores',  name: 'Reacciona Sport' },
]

// ── 3. Nuevos creadores ───────────────────────────────────────────
const NEW_CREATORS = [

  // ── FÚTBOL — grandes streamers que faltaban ───────────────────
  {
    id: 'nexxuzHD', name: 'NexxuzHD', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Uno de los mayores YouTubers de España. Presidente de la Kings League.',
    handles: { youtube: 'UCdE6j8mfmGHBPgMKlDWJxEA', twitch: 'nexxuz', instagram: 'nexxuz', tiktok: '@nexxuz', twitter: 'Nexxuz' },
  },
  {
    id: 'quenco', name: 'Quenco', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Creador de contenido de fútbol. Análisis, tácticas y humor.',
    handles: { youtube: '@Quenco', twitch: 'quenco', instagram: 'quenco', tiktok: '@quenco', twitter: 'Quenco' },
  },
  {
    id: 'ampeter', name: 'Ampeter', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'YouTuber de fútbol español. Pack aperturas y contenido viral.',
    handles: { youtube: '@Ampeter', instagram: 'ampeteryt', tiktok: '@ampeter', twitter: 'Ampeter' },
  },
  {
    id: 'kings-league', name: 'Kings League', country: 'ES', emoji: '🌍',
    sport: 'futbol', category: 'creadores',
    subtitle: 'La liga de fútbol 7 de los streamers, fundada por Piqué e Ibai.',
    handles: { youtube: '@KingsLeague', twitch: 'kingsleague', instagram: 'kingsleague', tiktok: '@kingsleague', twitter: 'KingsLeague' },
  },
  {
    id: 'pique-content', name: 'Gerard Piqué', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Exjugador del Barça y fundador de la Kings League. Empresario digital.',
    handles: { youtube: '@3gerardpique', instagram: 'pique', tiktok: '@pique', twitter: '3gerardpique' },
  },
  {
    id: 'sergio-ramos-content', name: 'Sergio Ramos', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Leyenda del Real Madrid y España. Activo creador de contenido.',
    handles: { youtube: '@sergioramos', instagram: 'sergioramos', tiktok: '@sergioramos', twitter: 'SergioRamos' },
  },
  {
    id: 'relevo-media', name: 'Relevo', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'periodistas',
    subtitle: 'El nuevo medio deportivo digital de referencia en España.',
    handles: { youtube: '@Relevo', instagram: 'relevo_es', tiktok: '@relevo', twitter: 'relevo' },
  },
  {
    id: 'goal-espanol', name: 'Goal en Español', country: 'ES', emoji: '🌍',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Versión en español del mayor medio de fútbol digital del mundo.',
    handles: { youtube: '@goalenespanol', instagram: 'goalenespanol', tiktok: '@goalenespanol', twitter: 'goalenespanol' },
  },
  {
    id: 'sportstcenter-es', name: 'SportsCenter en Español', country: 'US', emoji: '🌎',
    sport: 'futbol', category: 'creadores',
    subtitle: 'ESPN en español. El canal de deportes en español con más alcance.',
    handles: { youtube: '@SportsCenter', instagram: 'sportscenter_es', tiktok: '@sportscenter_es', twitter: 'SportsCenter_Es' },
  },
  {
    id: 'la-pizarra', name: 'La Pizarra de Juanma', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Canal de análisis táctico de fútbol más reconocido en español.',
    handles: { youtube: '@LaPizarradeJuanma', instagram: 'lapizarradejuanma', twitter: 'LaPizarraJuanma' },
  },
  {
    id: 'agustin51', name: 'Agustín51', country: 'AR', emoji: '🇦🇷',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Streamer argentino con millones de seguidores. Fútbol y entretenimiento.',
    handles: { youtube: '@AgustinFN', twitch: 'agustin51', instagram: 'agustin51', tiktok: '@agustin51', twitter: 'Agustin51' },
  },
  {
    id: 'messi-content', name: 'Leo Messi', country: 'AR', emoji: '🇦🇷',
    sport: 'futbol', category: 'creadores',
    subtitle: 'El mejor jugador de la historia. Presencia masiva en redes sociales.',
    handles: { instagram: 'leomessi', tiktok: '@leomessi', twitter: 'TeamMessi' },
  },
  {
    id: 'cristiano-content', name: 'Cristiano Ronaldo', country: 'PT', emoji: '🇵🇹',
    sport: 'futbol', category: 'creadores',
    subtitle: 'El deportista con más seguidores del mundo. Creador de contenido global.',
    handles: { youtube: '@CR7', instagram: 'cristiano', tiktok: '@cristiano', twitter: 'Cristiano' },
  },
  {
    id: 'dazn-espana', name: 'DAZN España', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Plataforma de streaming deportivo. Contenido LaLiga y deportes de combate.',
    handles: { youtube: '@DAZNEspana', instagram: 'dazn_esp', tiktok: '@dazn_esp', twitter: 'DAZN_ES' },
  },

  // ── FÓRMULA 1 — grandes que faltaban ─────────────────────────
  {
    id: 'fernando-alonso-content', name: 'Fernando Alonso', country: 'ES', emoji: '🇪🇸',
    sport: 'formula1', category: 'creadores',
    subtitle: 'Bicampeón del mundo de F1 y leyenda del automovilismo mundial.',
    handles: { youtube: '@FernandoAlonso', instagram: 'fernandoalo_oficial', tiktok: '@fernandoalonso', twitter: 'alo_oficial' },
  },
  {
    id: 'carlos-sainz-f1', name: 'Carlos Sainz Jr.', country: 'ES', emoji: '🇪🇸',
    sport: 'formula1', category: 'creadores',
    subtitle: 'Piloto de F1. Uno de los referentes españoles del automovilismo actual.',
    handles: { youtube: '@CarlosSainz', instagram: 'carlossainz55', tiktok: '@carlossainz55', twitter: 'Carlossainz55' },
  },
  {
    id: 'lando-norris-f1', name: 'Lando Norris', country: 'GB', emoji: '🇬🇧',
    sport: 'formula1', category: 'creadores',
    subtitle: 'Piloto McLaren F1. El piloto más popular en redes sociales de la parrilla.',
    handles: { youtube: '@LandoNorris', twitch: 'landonorris', instagram: 'landonorris', tiktok: '@landonorris', twitter: 'LandoNorris' },
  },

  // ── MOTOGP — grandes que faltaban ────────────────────────────
  {
    id: 'jorge-martin-moto', name: 'Jorge Martín', country: 'ES', emoji: '🇪🇸',
    sport: 'motogp', category: 'creadores',
    subtitle: 'Campeón del Mundo de MotoGP 2024. Piloto Aprilia.',
    handles: { instagram: 'jorgemartinofficial', tiktok: '@jorgemartinofficial', twitter: '88jorgemartin' },
  },
  {
    id: 'pedro-acosta-moto', name: 'Pedro Acosta', country: 'ES', emoji: '🇪🇸',
    sport: 'motogp', category: 'creadores',
    subtitle: 'La nueva estrella española de MotoGP. Considerado el nuevo Márquez.',
    handles: { instagram: 'pedrito_acosta37', tiktok: '@pedritoacosta37', twitter: 'Pedrito_Acosta' },
  },

  // ── TENIS — que faltaban ──────────────────────────────────────
  {
    id: 'garbine-muguruza', name: 'Garbiñe Muguruza', country: 'ES', emoji: '🇪🇸',
    sport: 'tenis', category: 'creadores',
    subtitle: 'Ex nº1 del mundo, ganadora de Wimbledon y Roland Garros.',
    handles: { instagram: 'garbinemuguruza', tiktok: '@garbinemuguruza', twitter: 'GarbiMuguruza' },
  },
  {
    id: 'paula-badosa', name: 'Paula Badosa', country: 'ES', emoji: '🇪🇸',
    sport: 'tenis', category: 'creadores',
    subtitle: 'Tenista española y ex top-2 WTA. Gran presencia en redes.',
    handles: { instagram: 'paulabadosa', tiktok: '@paulabadosa', twitter: 'paulabadosa9' },
  },

  // ── BALONCESTO — que faltaban ─────────────────────────────────
  {
    id: 'pau-gasol-content', name: 'Pau Gasol', country: 'ES', emoji: '🇪🇸',
    sport: 'baloncesto', category: 'creadores',
    subtitle: 'Leyenda del baloncesto mundial. Activo creador de contenido e inversor.',
    handles: { youtube: '@PauGasol', instagram: 'paugasol', tiktok: '@paugasol', twitter: 'paugasol' },
  },
  {
    id: 'marc-gasol-content', name: 'Marc Gasol', country: 'ES', emoji: '🇪🇸',
    sport: 'baloncesto', category: 'creadores',
    subtitle: 'Campeón NBA y del Mundo con España. Embajador del baloncesto.',
    handles: { instagram: 'marcgasol', tiktok: '@marcgasol', twitter: 'MarcGasol' },
  },
  {
    id: 'manu-ginobili', name: 'Manu Ginóbili', country: 'AR', emoji: '🇦🇷',
    sport: 'baloncesto', category: 'creadores',
    subtitle: 'Leyenda NBA con San Antonio Spurs. Miembro del Hall of Fame.',
    handles: { instagram: 'manuginobili', twitter: 'manuginobili' },
  },

  // ── CICLISMO — que faltaban ───────────────────────────────────
  {
    id: 'pogacar-content', name: 'Tadej Pogačar', country: 'SI', emoji: '🇸🇮',
    sport: 'ciclismo', category: 'creadores',
    subtitle: 'El ciclista más dominante del mundo. Tricampeón del Tour de Francia.',
    handles: { instagram: 'tadej_pogacar', tiktok: '@tadej.pogacar', twitter: 'TamauPogi' },
  },
  {
    id: 'primoz-roglic', name: 'Primož Roglič', country: 'SI', emoji: '🇸🇮',
    sport: 'ciclismo', category: 'creadores',
    subtitle: 'Ganador múltiple de la Vuelta a España y referente del ciclismo mundial.',
    handles: { instagram: 'primozroglic', tiktok: '@primozroglic', twitter: 'rogla40' },
  },
  {
    id: 'cicli-espana', name: 'Ciclismo Total', country: 'ES', emoji: '🇪🇸',
    sport: 'ciclismo', category: 'creadores',
    subtitle: 'Canal de referencia del ciclismo en español con análisis y carreras.',
    handles: { youtube: '@CiclismoTotal', instagram: 'ciclismototal', tiktok: '@ciclismototal', twitter: 'CiclismoTotal' },
  },

  // ── BOXEO — que faltaban ──────────────────────────────────────
  {
    id: 'jake-paul-box', name: 'Jake Paul', country: 'US', emoji: '🇺🇸',
    sport: 'boxeo', category: 'creadores',
    subtitle: 'El youtuber convertido en boxeador profesional. El fenómeno del boxeo actual.',
    handles: { youtube: '@JakePaul', instagram: 'jakepaul', tiktok: '@jakepaul', twitter: 'jakepaul' },
  },
  {
    id: 'canelo-team', name: 'Team Canelo', country: 'MX', emoji: '🇲🇽',
    sport: 'boxeo', category: 'creadores',
    subtitle: 'Canal oficial del equipo de Saúl "Canelo" Álvarez.',
    handles: { youtube: '@CaneloTeam', instagram: 'caneloalvarez', tiktok: '@caneloteam', twitter: 'CaneloTeam' },
  },

  // ── UFC/MMA — que faltaban ────────────────────────────────────
  {
    id: 'ufc-espanol', name: 'UFC en Español', country: 'US', emoji: '🌎',
    sport: 'ufc', category: 'creadores',
    subtitle: 'Canal oficial de la UFC en español para LATAM y España.',
    handles: { youtube: '@UFCEspanol', instagram: 'ufc_espanol', tiktok: '@ufcespanol', twitter: 'UFCEspanol' },
  },
  {
    id: 'israel-adesanya', name: 'Israel Adesanya', country: 'NZ', emoji: '🇳🇿',
    sport: 'ufc', category: 'creadores',
    subtitle: 'Ex campeón del mundo peso mediano UFC. Enorme presencia en redes.',
    handles: { youtube: '@IzzyAdesanya', instagram: 'stylebender', tiktok: '@izzy_adesanya', twitter: 'stylebender' },
  },

  // ── PÁDEL — que faltaban ──────────────────────────────────────
  {
    id: 'world-padel-tour', name: 'World Padel Tour', country: 'ES', emoji: '🇪🇸',
    sport: 'padel', category: 'creadores',
    subtitle: 'El circuito profesional de pádel más importante del mundo.',
    handles: { youtube: '@WorldPadelTour', instagram: 'worldpadeltour', tiktok: '@worldpadeltour', twitter: 'WorldPadelTour' },
  },
  {
    id: 'coki-nieto', name: 'Coki Nieto', country: 'ES', emoji: '🇪🇸',
    sport: 'padel', category: 'creadores',
    subtitle: 'Jugador profesional de pádel y gran creador de contenido del deporte.',
    handles: { instagram: 'coki_nieto_padel', tiktok: '@coki_nieto', twitter: 'coki_nieto' },
  },

  // ── NFL / FÚTBOL AMERICANO — que faltaban ─────────────────────
  {
    id: 'nfl-rush-esp', name: 'NFL Rush España', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol_americano', category: 'creadores',
    subtitle: 'Canal de la NFL en español para España y Europa.',
    handles: { youtube: '@NFLRushEspana', instagram: 'nfl_espana', tiktok: '@nfl_espana', twitter: 'NFL_Espana' },
  },
  {
    id: 'dani-de-la-torre-nfl', name: 'Dani de la Torre', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol_americano', category: 'periodistas',
    subtitle: 'El periodista de la NFL más reconocido en España.',
    handles: { youtube: '@DanidelaTorreNFL', instagram: 'danidelatorre', tiktok: '@danidelatorre', twitter: 'DanidelaTorre' },
  },

  // ── BEISBOL — que faltaban ────────────────────────────────────
  {
    id: 'mlb-en-espanol', name: 'MLB en Español', country: 'US', emoji: '🌎',
    sport: 'beisbol', category: 'creadores',
    subtitle: 'Canal oficial de la MLB para fans hispanohablantes.',
    handles: { youtube: '@MLBenEspanol', instagram: 'mlb_espanol', tiktok: '@mlb_espanol', twitter: 'MLBenEspanol' },
  },
]

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}\n`)
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  // ── Fetch all creator IDs ─────────────────────────────────────
  const { data: existing } = await sb.from('ranking_entries')
    .select('id, name, sport, handles')
    .in('category', ['creadores','periodistas','creadores_wwe'])
  const existingIds = new Set((existing ?? []).map(e => e.id))

  // ── 1. ELIMINAR ───────────────────────────────────────────────
  const toDelete = DELETE_IDS.filter(id => existingIds.has(id))
  const notFound = DELETE_IDS.filter(id => !existingIds.has(id))
  console.log(`── ELIMINAR (${toDelete.length}) ──────────────────`)
  for (const id of toDelete) {
    const e = existing.find(x => x.id === id)
    console.log(`  DEL  ${id.padEnd(26)} ${e?.name ?? ''}`)
  }
  if (notFound.length > 0) console.log(`  (no encontrados: ${notFound.join(', ')})`)

  if (APPLY && toDelete.length > 0) {
    const { error } = await sb.from('ranking_entries').delete().in('id', toDelete)
    if (error) console.error('DELETE error:', error.message)
    else console.log(`  → ${toDelete.length} eliminados OK`)
  }

  // ── 2. PARCHEAR sport ─────────────────────────────────────────
  console.log(`\n── CORREGIR sport (${PATCH_SPORT.length}) ────────────`)
  for (const p of PATCH_SPORT) {
    const e = existing.find(x => x.id === p.id)
    if (!e) { console.log(`  ⚠  ${p.id} no encontrado`); continue }
    console.log(`  FIX  ${p.id.padEnd(26)} sport=null → ${p.sport}`)
    if (APPLY) {
      const { error } = await sb.from('ranking_entries')
        .update({ sport: p.sport, category: p.category })
        .eq('id', p.id)
      if (error) console.error(`  FAIL ${p.id}: ${error.message}`)
    }
  }

  // ── 3. NUEVOS ─────────────────────────────────────────────────
  const toInsert = []
  const toUpdate = []
  console.log(`\n── NUEVOS / ACTUALIZACIONES ─────────────────`)
  for (const c of NEW_CREATORS) {
    if (existingIds.has(c.id)) {
      toUpdate.push({ id: c.id, handles: c.handles })
      console.log(`  ~ UPD  [${c.sport.padEnd(18)}] ${c.name} (actualiza handles)`)
    } else {
      const { handles, ...entry } = c
      toInsert.push({ ...entry, handles, active: true, mediatico_auto: 50, narrativa_auto: 50 })
      console.log(`  + NEW  [${c.sport.padEnd(18)}] ${c.name}`)
    }
  }

  console.log(`\nNuevos: ${toInsert.length} | Actualizaciones: ${toUpdate.length}`)

  if (!APPLY) { console.log('\nDRY RUN.'); return }

  if (toInsert.length > 0) {
    const { error } = await sb.from('ranking_entries').insert(toInsert)
    if (error) { console.error('INSERT error:', error.message); return }
    console.log(`\nInsertados: ${toInsert.length} OK`)
  }
  for (const u of toUpdate) {
    const { error } = await sb.from('ranking_entries').update({ handles: u.handles }).eq('id', u.id)
    if (error) console.error(`UPD handles ${u.id}: ${error.message}`)
  }

  console.log('\nListo. Ejecuta:')
  console.log('  node scripts/ingest-creator-social.mjs --apply')
}

main().catch(err => { console.error(err); process.exit(1) })
