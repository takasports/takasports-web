#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// expand-creator-roster.mjs
//
// Añade nuevos creadores y periodistas digitales al Índice Taka.
// Enfoque: creadores nativos de redes sociales (TikTok, YouTube,
// Instagram, Twitter) — no TV clásica.
//
// Uso:
//   node scripts/expand-creator-roster.mjs           # DRY RUN
//   node scripts/expand-creator-roster.mjs --apply
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

// ── Nuevas entradas ───────────────────────────────────────────────
// Cada entrada: { id, name, subtitle, sport, category, country, emoji, handles }
// El campo `handles` se guarda en ranking_entries.handles (JSONB)

const NEW_CREATORS = [

  // ── FÚTBOL ESPAÑA — Streamers / creadores digitales ──────────────
  {
    id: 'auronplay', name: 'AuronPlay', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'El mayor streamer de España. Impulsor de la Kings League.',
    handles: { youtube: '@auronplay', twitch: 'auronplay', instagram: 'auronplay', tiktok: '@auronplay', twitter: 'AuronPlay' },
  },
  {
    id: 'illojuan', name: 'IlloJuan', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Streamer y creador de contenido. Escudería Kings League.',
    handles: { youtube: '@IlloJuan', twitch: 'illojuan', instagram: 'illojuan', tiktok: '@illojuan', twitter: 'IlloJuan' },
  },
  {
    id: 'luzu', name: 'Luzu', country: 'AR', emoji: '🇦🇷',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Streamer argentino afincado en España. Kings League.',
    handles: { youtube: '@LuzuTV', twitch: 'luzu', instagram: 'luzu', tiktok: '@luzu', twitter: 'luzu' },
  },
  {
    id: 'spreen', name: 'Spreen', country: 'AR', emoji: '🇦🇷',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Streamer argentino con millones de seguidores. Fútbol y gaming.',
    handles: { youtube: '@spreen', twitch: 'spreen', instagram: 'spreen', tiktok: '@spreen', twitter: 'SpreenDMC' },
  },
  {
    id: 'rivers-futbol', name: 'Rivers', country: 'AR', emoji: '🇦🇷',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Creador de contenido de fútbol latinoamericano.',
    handles: { youtube: '@rivers', twitch: 'rivers', instagram: 'rivers', tiktok: '@rivers', twitter: 'RiversGaming' },
  },
  {
    id: 'gento-futbol', name: 'Gento', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Canal de análisis y tácticas de fútbol en español.',
    handles: { youtube: '@GentoyFutbol', instagram: 'gentofutbol', tiktok: '@gento', twitter: 'Gento' },
  },
  {
    id: 'elchiringuitotv', name: 'El Chiringuito TV', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'El programa de debate futbolístico más viral de España.',
    handles: { youtube: '@ElChiringuitoOficial', instagram: 'elchiringuitotv', tiktok: '@elchiringuitotv', twitter: 'elchiringuitotv' },
  },
  {
    id: 'misterchip', name: 'Míster Chip', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'periodistas',
    subtitle: 'El gurú de las estadísticas de fútbol. Icono de Twitter.',
    handles: { instagram: 'misterchip_es', twitter: 'misterchip_es' },
  },
  {
    id: 'javi-ruiz', name: 'Javi Ruiz', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Creador de contenido de fútbol. Análisis y entretenimiento.',
    handles: { youtube: '@JaviRuizFutbol', instagram: 'javiruizfutbol', tiktok: '@javiruizfutbol', twitter: 'JaviRuizFutbol' },
  },
  {
    id: 'latribufutbol', name: 'La Tribu de Fremen', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Podcast y canal de fútbol más escuchado de España.',
    handles: { youtube: '@LaTribuDeFremen', instagram: 'latribudefremen', twitter: 'LaTribudeFremen' },
  },
  {
    id: 'fuera-de-juego', name: 'Fuera de Juego', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Podcast y contenido de fútbol con humor y análisis.',
    handles: { youtube: '@FueradeJuegoPodcast', instagram: 'fueradejuego', twitter: 'FueradeJuego' },
  },

  // ── FÚTBOL LATAM ─────────────────────────────────────────────────
  {
    id: 'bolavip', name: 'Bolavip', country: 'AR', emoji: '🇦🇷',
    sport: 'futbol', category: 'creadores',
    subtitle: 'El canal de fútbol latinoamericano con más suscriptores.',
    handles: { youtube: '@Bolavip', instagram: 'bolavip', tiktok: '@bolavip', twitter: 'bolavip' },
  },
  {
    id: 'el-trinche', name: 'El Trinche', country: 'AR', emoji: '🇦🇷',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Análisis y contenido del fútbol argentino y mundial.',
    handles: { youtube: '@ElTrinche', instagram: 'eltrinchefutbol', tiktok: '@eltrinche', twitter: 'ElTrincheFutbol' },
  },
  {
    id: 'burrito-martinez', name: 'Burrito Martínez', country: 'MX', emoji: '🇲🇽',
    sport: 'futbol', category: 'creadores',
    subtitle: 'El creador de fútbol más entretenido de México.',
    handles: { youtube: '@BurritoMartinez', instagram: 'burritomartinez', tiktok: '@burritomartinez', twitter: 'BurritoMartinez' },
  },
  {
    id: 'imagen-del-futbol', name: 'Imagen del Fútbol', country: 'MX', emoji: '🇲🇽',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Canal de fútbol de Imagen Televisión con enorme audiencia digital.',
    handles: { youtube: '@ImagendelFutbol', instagram: 'imagendelfutbol', tiktok: '@imagendelfutbol', twitter: 'ImagenFutbol' },
  },
  {
    id: 'planeta-futbol', name: 'Planeta Fútbol', country: 'CO', emoji: '🇨🇴',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Canal de entretenimiento y análisis del fútbol LATAM.',
    handles: { youtube: '@PlanetaFutbol', instagram: 'planetafutbol', twitter: 'PlanetaFutbol' },
  },
  {
    id: 'transfermarkt-esp', name: 'Transfermarkt ES', country: 'DE', emoji: '🇩🇪',
    sport: 'futbol', category: 'periodistas',
    subtitle: 'La referencia mundial de valores de mercado del fútbol.',
    handles: { instagram: 'transfermarkt_es', twitter: 'TMespana', tiktok: '@transfermarkt_es' },
  },

  // ── MOTOGP (nuevo deporte) ────────────────────────────────────────
  {
    id: 'jorgelorenzo-moto', name: 'Jorge Lorenzo', country: 'ES', emoji: '🇪🇸',
    sport: 'motogp', category: 'creadores',
    subtitle: '5x campeón del mundo. Su canal de YouTube supera millones de vistas.',
    handles: { youtube: '@JorgeLorenzo99', instagram: 'jorgelorenzo99', tiktok: '@jorgelorenzo99', twitter: 'lorenzo99' },
  },
  {
    id: 'marc-marquez-moto', name: 'Marc Márquez', country: 'ES', emoji: '🇪🇸',
    sport: 'motogp', category: 'creadores',
    subtitle: 'El piloto de MotoGP más seguido en redes sociales del mundo.',
    handles: { instagram: 'marcmarquez93', tiktok: '@marcmarquez93', twitter: 'marcmarquez93' },
  },
  {
    id: 'alex-marquez-moto', name: 'Álex Márquez', country: 'ES', emoji: '🇪🇸',
    sport: 'motogp', category: 'creadores',
    subtitle: 'Piloto de MotoGP y creador de contenido junto a su hermano Marc.',
    handles: { instagram: 'alexmarquez73', tiktok: '@alexmarquez73', twitter: 'alexmarquez73' },
  },
  {
    id: 'rush-moto', name: 'Rush Moto', country: 'ES', emoji: '🇪🇸',
    sport: 'motogp', category: 'creadores',
    subtitle: 'El mayor canal de YouTube de MotoGP en español.',
    handles: { youtube: '@RushMoto', instagram: 'rushmoto', tiktok: '@rushmoto', twitter: 'RushMotoYT' },
  },
  {
    id: 'motofull-moto', name: 'Motofull', country: 'ES', emoji: '🇪🇸',
    sport: 'motogp', category: 'creadores',
    subtitle: 'Análisis, noticias y entretenimiento de MotoGP en español.',
    handles: { youtube: '@Motofull', instagram: 'motofull', tiktok: '@motofull', twitter: 'Motofull' },
  },
  {
    id: 'valentino-rossi-content', name: 'Valentino Rossi', country: 'IT', emoji: '🇮🇹',
    sport: 'motogp', category: 'creadores',
    subtitle: 'Leyenda de MotoGP y creador de contenido con millones de seguidores.',
    handles: { instagram: 'valeyellow46', tiktok: '@valeyellow46', twitter: 'valeyellow46' },
  },

  // ── GOLF ─────────────────────────────────────────────────────────
  {
    id: 'jon-rahm', name: 'Jon Rahm', country: 'ES', emoji: '🇪🇸',
    sport: 'golf', category: 'creadores',
    subtitle: 'El mejor golfista español de la historia. Millones de seguidores.',
    handles: { instagram: 'jonrahm', tiktok: '@jonrahm', twitter: 'JonRahmpga' },
  },
  {
    id: 'golf-espanol', name: 'Golf en Español', country: 'ES', emoji: '🇪🇸',
    sport: 'golf', category: 'creadores',
    subtitle: 'El principal canal de YouTube de golf en español.',
    handles: { youtube: '@GolfEnEspanol', instagram: 'golfenespanol', twitter: 'GolfEnEspanol' },
  },
  {
    id: 'good-good-golf', name: 'Good Good Golf', country: 'US', emoji: '🇺🇸',
    sport: 'golf', category: 'creadores',
    subtitle: 'El canal de golf de entretenimiento más viral del mundo.',
    handles: { youtube: '@GoodGoodGolf', instagram: 'goodgoodgolf', tiktok: '@goodgoodgolf', twitter: 'GoodGoodGolf' },
  },

  // ── FÚTBOL AMERICANO / NFL EN ESPAÑOL ────────────────────────────
  {
    id: 'zona-roja-nfl', name: 'Zona Roja NFL', country: 'MX', emoji: '🇲🇽',
    sport: 'futbol_americano', category: 'creadores',
    subtitle: 'El canal de NFL en español con mayor audiencia en LATAM.',
    handles: { youtube: '@ZonaRojaNFL', instagram: 'zonarojaNFL', tiktok: '@zonarojaNFL', twitter: 'ZonaRojaNFL' },
  },
  {
    id: 'nfl-en-espanol', name: 'NFL en Español', country: 'US', emoji: '🇺🇸',
    sport: 'futbol_americano', category: 'creadores',
    subtitle: 'Canal oficial de la NFL para hispanohablantes.',
    handles: { youtube: '@NFLenEspanol', instagram: 'nflenespanol', tiktok: '@nflenespanol', twitter: 'NFLenEspanol' },
  },
  {
    id: 'la-nfl-de-lili', name: 'La NFL de Lili', country: 'MX', emoji: '🇲🇽',
    sport: 'futbol_americano', category: 'periodistas',
    subtitle: 'Creadora de contenido que popularizó la NFL para mujeres en LATAM.',
    handles: { youtube: '@LaNFLdeLili', instagram: 'lanfldelili', tiktok: '@lanfldelili', twitter: 'laNFLdeLili' },
  },

  // ── BOXEO ────────────────────────────────────────────────────────
  {
    id: 'canelo-alvarez', name: 'Canelo Álvarez', country: 'MX', emoji: '🇲🇽',
    sport: 'boxeo', category: 'creadores',
    subtitle: 'El boxeador con mayor seguimiento en redes sociales del mundo.',
    handles: { instagram: 'canelo', tiktok: '@canelo', twitter: 'Canelo' },
  },
  {
    id: 'world-boxing-esp', name: 'Boxeo Mundial', country: 'MX', emoji: '🇲🇽',
    sport: 'boxeo', category: 'creadores',
    subtitle: 'Canal de YouTube con highlights y análisis del boxeo en español.',
    handles: { youtube: '@BoxeoMundial', instagram: 'boxeomundial', tiktok: '@boxeomundial', twitter: 'BoxeoMundialYT' },
  },
  {
    id: 'jose-sulaiman-box', name: 'Zanfer Boxing', country: 'MX', emoji: '🇲🇽',
    sport: 'boxeo', category: 'creadores',
    subtitle: 'La promotora de boxeo más importante de México con enorme audiencia digital.',
    handles: { youtube: '@ZanferBoxing', instagram: 'zanferboxing', tiktok: '@zanferboxing', twitter: 'ZanferBoxing' },
  },

  // ── PÁDEL (ampliación) ────────────────────────────────────────────
  {
    id: 'juan-lebron', name: 'Juan Lebrón', country: 'ES', emoji: '🇪🇸',
    sport: 'padel', category: 'creadores',
    subtitle: 'El mejor padelista del mundo. Contenido en redes y entretenimiento.',
    handles: { instagram: 'juanlebron10', tiktok: '@juanlebron10', twitter: 'JuanLebron10' },
  },
  {
    id: 'sanyo-gutierrez', name: 'Sanyo Gutiérrez', country: 'AR', emoji: '🇦🇷',
    sport: 'padel', category: 'creadores',
    subtitle: 'Padelista élite argentino y creador de contenido viral.',
    handles: { instagram: 'sanyogutierrez', tiktok: '@sanyogutierrez', twitter: 'SanyoGutierrez' },
  },
  {
    id: 'premier-padel-oficial', name: 'Premier Padel', country: 'ES', emoji: '🇪🇸',
    sport: 'padel', category: 'creadores',
    subtitle: 'El circuito internacional de pádel más seguido en redes.',
    handles: { youtube: '@PremierPadel', instagram: 'premierpadel', tiktok: '@premierpadel', twitter: 'PremierPadel' },
  },
  {
    id: 'setpoint-padel', name: 'Set Point Pádel', country: 'ES', emoji: '🇪🇸',
    sport: 'padel', category: 'creadores',
    subtitle: 'Canal de YouTube de pádel con análisis, partidos y entretenimiento.',
    handles: { youtube: '@SetPointPadel', instagram: 'setpointpadel', tiktok: '@setpointpadel', twitter: 'SetPointPadel' },
  },

  // ── CICLISMO (ampliación) ─────────────────────────────────────────
  {
    id: 'alejandro-valverde', name: 'Alejandro Valverde', country: 'ES', emoji: '🇪🇸',
    sport: 'ciclismo', category: 'creadores',
    subtitle: 'Leyenda del ciclismo español. Activo en redes tras su retirada.',
    handles: { instagram: 'alejandrovallverde', tiktok: '@alejandrovallverde', twitter: 'alejanvalverde' },
  },
  {
    id: 'nairo-quintana', name: 'Nairo Quintana', country: 'CO', emoji: '🇨🇴',
    sport: 'ciclismo', category: 'creadores',
    subtitle: 'El ciclista colombiano más icónico. Millones de seguidores.',
    handles: { instagram: 'nairoquintana', tiktok: '@nairoquintana', twitter: 'NairoQuinCo' },
  },
  {
    id: 'cycling-espanol', name: 'Cycling Weekly ES', country: 'ES', emoji: '🇪🇸',
    sport: 'ciclismo', category: 'creadores',
    subtitle: 'Contenido de ciclismo profesional y amateur en español.',
    handles: { youtube: '@CyclingEspanol', instagram: 'cyclingespanol', twitter: 'CyclingEspanol' },
  },

  // ── BALONCESTO (ampliación) ───────────────────────────────────────
  {
    id: 'ricky-rubio', name: 'Ricky Rubio', country: 'ES', emoji: '🇪🇸',
    sport: 'baloncesto', category: 'creadores',
    subtitle: 'Estrella de la NBA. Activista y creador de contenido tras retirarse.',
    handles: { instagram: 'rickyrubio9', tiktok: '@rickyrubio9', twitter: 'rickyrubio9' },
  },
  {
    id: 'bleacher-report-es', name: 'House of Highlights ES', country: 'US', emoji: '🇺🇸',
    sport: 'baloncesto', category: 'creadores',
    subtitle: 'Canal de highlights de la NBA en español con millones de seguidores.',
    handles: { instagram: 'houseofhighlights', tiktok: '@houseofhighlights', twitter: 'HouseofHighlights' },
  },
  {
    id: 'nba-en-espanol', name: 'NBA en Español', country: 'US', emoji: '🇺🇸',
    sport: 'baloncesto', category: 'creadores',
    subtitle: 'Canal oficial de la NBA para audiencia hispanohablante.',
    handles: { youtube: '@NBAenEspanol', instagram: 'nbaenespanol', tiktok: '@nbaenespanol', twitter: 'NBAenEspanol' },
  },
  {
    id: 'juan-hernangomez', name: 'Juan Hernangómez', country: 'ES', emoji: '🇪🇸',
    sport: 'baloncesto', category: 'creadores',
    subtitle: 'Jugador español de la NBA. Gran presencia en redes sociales.',
    handles: { instagram: 'juanhernan14', tiktok: '@juanhernan14', twitter: 'juanhernan14' },
  },

  // ── TENIS (ampliación) ────────────────────────────────────────────
  {
    id: 'rafa-nadal-content', name: 'Rafa Nadal', country: 'ES', emoji: '🇪🇸',
    sport: 'tenis', category: 'creadores',
    subtitle: 'El mayor tenista de la historia. Activo en redes tras retirarse.',
    handles: { instagram: 'rafaelnadal', tiktok: '@rafaelnadal', twitter: 'RafaelNadal' },
  },
  {
    id: 'carlos-alcaraz-content', name: 'Carlos Alcaraz', country: 'ES', emoji: '🇪🇸',
    sport: 'tenis', category: 'creadores',
    subtitle: 'El mejor tenista joven del mundo. Millones de seguidores en Instagram.',
    handles: { instagram: 'carlitosalcarazz', tiktok: '@carlitosalcarazz', twitter: 'carlosalcaraz' },
  },
  {
    id: 'tennis-world-esp', name: 'Tennis World España', country: 'ES', emoji: '🇪🇸',
    sport: 'tenis', category: 'periodistas',
    subtitle: 'El portal de tenis en español con mayor audiencia digital.',
    handles: { youtube: '@TennisWorldES', instagram: 'tennisworldes', tiktok: '@tennisworldes', twitter: 'TennisWorldES' },
  },

  // ── UFC / MMA (ampliación) ────────────────────────────────────────
  {
    id: 'alex-pereira-content', name: 'Alex Pereira', country: 'BR', emoji: '🇧🇷',
    sport: 'ufc', category: 'creadores',
    subtitle: 'Campeón de la UFC. Uno de los luchadores más seguidos en redes.',
    handles: { instagram: 'alexpoatanpereira', tiktok: '@alexpoatanpereira', twitter: 'AlexPereiraUFC' },
  },
  {
    id: 'mma-fighting-esp', name: 'MMA Fighting ES', country: 'US', emoji: '🇺🇸',
    sport: 'ufc', category: 'periodistas',
    subtitle: 'El medio de MMA más influyente con cobertura en español.',
    handles: { youtube: '@MMAFightingES', instagram: 'mmafighting', tiktok: '@mmafighting', twitter: 'MMAFighting' },
  },
  {
    id: 'chito-vera-content', name: 'Chito Vera', country: 'EC', emoji: '🇪🇨',
    sport: 'ufc', category: 'creadores',
    subtitle: 'Luchador ecuatoriano de la UFC con gran seguimiento en LATAM.',
    handles: { instagram: 'chitoveramma', tiktok: '@chitoveramma', twitter: 'chitoverammaec' },
  },

  // ── FÚTBOL FEMENINO ───────────────────────────────────────────────
  {
    id: 'alexia-creator', name: 'Alexia Putellas', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: '2x Balón de Oro. Una de las futbolistas con mayor influencia digital.',
    handles: { instagram: 'alexiaputellas11', tiktok: '@alexiaputellas11', twitter: 'alexiapu' },
  },
  {
    id: 'jenni-hermoso-content', name: 'Jenni Hermoso', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'La futbolista española con mayor seguimiento en redes sociales.',
    handles: { instagram: 'jennihermoso', tiktok: '@jennihermoso', twitter: 'Jennihermoso9' },
  },
  {
    id: 'futfem-españa', name: 'Fútbol Femenino TV', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Canal dedicado al fútbol femenino español con crecimiento viral.',
    handles: { youtube: '@FutbolFemeninoTV', instagram: 'futfemtv', tiktok: '@futfemtv', twitter: 'FutFemTV' },
  },
]

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`)
  console.log(`Nuevos creadores a añadir: ${NEW_CREATORS.length}\n`)

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  // Obtener IDs existentes para detectar duplicados
  const { data: existing } = await sb.from('ranking_entries').select('id').in('category', ['creadores','periodistas','creadores_wwe'])
  const existingIds = new Set((existing ?? []).map(e => e.id))

  const toInsert = []
  const toUpdate = []

  for (const c of NEW_CREATORS) {
    const { handles, ...entry } = c
    const isNew = !existingIds.has(c.id)
    const row = {
      ...entry,
      handles,
      active: true,
      mediatico_auto: 50,   // placeholder inicial
      narrativa_auto:  50,  // placeholder inicial
    }
    if (isNew) {
      toInsert.push(row)
      console.log(`  + NEW  [${c.sport.padEnd(18)}] ${c.name}`)
    } else {
      // Solo actualizar handles si ya existe
      toUpdate.push({ id: c.id, handles })
      console.log(`  ~ UPD  [${c.sport.padEnd(18)}] ${c.name} (solo handles)`)
    }
  }

  console.log(`\nNuevos: ${toInsert.length} | Actualizaciones de handles: ${toUpdate.length}`)

  if (!APPLY) { console.log('\nDRY RUN.'); return }

  // Insertar nuevas entradas
  if (toInsert.length > 0) {
    const { error } = await sb.from('ranking_entries').insert(toInsert)
    if (error) { console.error('INSERT error:', error.message); return }
    console.log(`\nInsertados: ${toInsert.length} OK`)
  }

  // Actualizar handles de existentes
  for (const u of toUpdate) {
    const { error } = await sb.from('ranking_entries').update({ handles: u.handles }).eq('id', u.id)
    if (error) console.error(`UPD handles ${u.id}:`, error.message)
  }
  if (toUpdate.length > 0) console.log(`Handles actualizados: ${toUpdate.length} OK`)

  console.log('\nListo. Ejecuta ahora:')
  console.log('  node scripts/ingest-creator-social.mjs --apply')
  console.log('  node scripts/curate-active-entries.mjs --apply')
}

main().catch(err => { console.error(err); process.exit(1) })
