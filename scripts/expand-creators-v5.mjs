#!/usr/bin/env node
// expand-creators-v5.mjs
// Quinta ronda de expansión — cubre huecos detectados:
//   · Periodistas El Chiringuito no añadidos (Roncero, Juanfe, Duro)
//   · Programas/marcas de radio-TV que faltan (El Larguero, Jugones, Tiempo de Juego)
//   · Periodismo MX/AR ampliado (Álvaro Morales, más TyC, más ESPN Deportes)
//   · Jugadores con enorme presencia social que faltaban (Bernardo Silva, etc.)
//   · Más creadoras femeninas y atletas
//   · TikTokers deportivos aún no cubiertos
//   · Golf ampliado (Sergio García, Carlota Ciganda)
//   · Atletismo y deportes olímpicos

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env.local') })

const APPLY = process.argv.includes('--apply')
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const NEW_ENTRIES = [
  // ── El Chiringuito / Periodistas ES ──────────────────────────────
  {
    id: 'tomas-roncero', name: 'Tomás Roncero', sport: 'futbol', category: 'periodistas',
    handles: { twitter: 'tomasroncero', instagram: 'tomasroncero', tiktok: '@tomasroncero' },
    mediatico_auto: 50, narrativa_auto: 50,
  },
  {
    id: 'juanfe-sanz', name: 'Juanfe Sanz', sport: 'futbol', category: 'periodistas',
    handles: { twitter: 'juanfesanz', instagram: 'juanfesanz', tiktok: '@juanfesanz' },
    mediatico_auto: 50, narrativa_auto: 50,
  },
  {
    id: 'alfredo-duro', name: 'Alfredo Duro', sport: 'futbol', category: 'periodistas',
    handles: { twitter: 'AlfredoDuro', instagram: 'alfredo_duro' },
    mediatico_auto: 50, narrativa_auto: 50,
  },
  // El Chiringuito TV ya existe con id=elchiringuitotv — no duplicar

  // ── Programas/Marcas Radio-TV España ─────────────────────────────
  {
    id: 'el-larguero-ser', name: 'El Larguero', sport: 'futbol', category: 'periodistas',
    handles: { twitter: 'ellarguero', instagram: 'ellargueroser', youtube: '@ElLargueroSER' },
    mediatico_auto: 50, narrativa_auto: 50,
  },
  {
    id: 'jugones-la-sexta', name: 'Jugones', sport: 'futbol', category: 'periodistas',
    handles: { twitter: 'jugones', instagram: 'jugones', youtube: '@JugonesTV' },
    mediatico_auto: 50, narrativa_auto: 50,
  },
  {
    id: 'tiempo-de-juego', name: 'Tiempo de Juego', sport: 'futbol', category: 'periodistas',
    handles: { twitter: 'TiempodeJuego', instagram: 'tiempodejuego', youtube: '@TiempodeJuegoCOPE' },
    mediatico_auto: 50, narrativa_auto: 50,
  },
  {
    id: 'carrusel-deportivo', name: 'Carrusel Deportivo', sport: 'futbol', category: 'periodistas',
    handles: { twitter: 'CarruselDep', instagram: 'carruseldeportivo' },
    mediatico_auto: 50, narrativa_auto: 50,
  },
  {
    id: 'radio-marca', name: 'Radio MARCA', sport: 'futbol', category: 'periodistas',
    handles: { twitter: 'RadioMARCA', instagram: 'radiomarca', youtube: '@RadioMARCA' },
    mediatico_auto: 50, narrativa_auto: 50,
  },

  // ── Periodistas MX extra ──────────────────────────────────────────
  {
    id: 'alvaro-morales', name: 'Álvaro Morales', sport: 'futbol', category: 'periodistas',
    handles: { twitter: 'AlvaroMoralesMX', instagram: 'alvaromoralesmx', tiktok: '@alvaromoralesmx' },
    mediatico_auto: 50, narrativa_auto: 50,
  },
  {
    id: 'blanca-sevilla', name: 'Blanca Sevilla', sport: 'futbol', category: 'periodistas',
    handles: { twitter: 'BlancaSevillaTV', instagram: 'blancasevillatv' },
    mediatico_auto: 50, narrativa_auto: 50,
  },
  {
    id: 'carlos-hermosillo', name: 'Carlos Hermosillo', sport: 'futbol', category: 'periodistas',
    handles: { twitter: 'CarlosHermosillo', instagram: 'carloshermosillo9' },
    mediatico_auto: 50, narrativa_auto: 50,
  },
  // Farsantes con Gloria ya existe con id=martinoli-garcia — no duplicar

  // ── Periodistas AR extra ──────────────────────────────────────────
  {
    id: 'julio-pavoni', name: 'Julio Pavoni', sport: 'futbol', category: 'periodistas',
    handles: { twitter: 'JulioPavoni', instagram: 'juliopavoni' },
    mediatico_auto: 50, narrativa_auto: 50,
  },
  {
    id: 'ttn-deportivo', name: 'TN Deportivo', sport: 'futbol', category: 'creadores',
    handles: { twitter: 'TNDeportes', instagram: 'tn_deportes', youtube: '@TNDeportes', tiktok: '@tndeportes' },
    mediatico_auto: 50, narrativa_auto: 50,
  },

  // ── Jugadores con presencia social relevante ──────────────────────
  {
    id: 'bernardo-silva', name: 'Bernardo Silva', sport: 'futbol', category: 'creadores',
    handles: { instagram: 'bernardo.silva', twitter: 'BernardoSilvaM20', tiktok: '@bernardosilva' },
    mediatico_auto: 50, narrativa_auto: 50,
  },
  {
    id: 'marcos-llorente', name: 'Marcos Llorente', sport: 'futbol', category: 'creadores',
    handles: { instagram: 'marcosllorente14', twitter: 'marcosllorente', tiktok: '@marcosllorente14' },
    mediatico_auto: 50, narrativa_auto: 50,
  },
  {
    id: 'alvaro-morata', name: 'Álvaro Morata', sport: 'futbol', category: 'creadores',
    handles: { instagram: 'alvaromorata', twitter: 'AlvaroMorata9', tiktok: '@alvaromorata' },
    mediatico_auto: 50, narrativa_auto: 50,
  },
  {
    id: 'oscar-mingueza', name: 'Óscar Mingueza', sport: 'futbol', category: 'creadores',
    handles: { instagram: 'oscarmingueza', twitter: 'oscarmingueza', tiktok: '@oscarmingueza' },
    mediatico_auto: 50, narrativa_auto: 50,
  },
  {
    id: 'gabri-veiga', name: 'Gabri Veiga', sport: 'futbol', category: 'creadores',
    handles: { instagram: 'gabri.veiga', twitter: 'gabriveiga', tiktok: '@gabriveiga' },
    mediatico_auto: 50, narrativa_auto: 50,
  },

  // ── Más mujeres fútbol ────────────────────────────────────────────
  {
    id: 'lucia-garcia', name: 'Lucía García', sport: 'futbol', category: 'creadores',
    handles: { instagram: 'luciagarciaoficial', twitter: 'luciagarcia_18', tiktok: '@luciagarcia18' },
    mediatico_auto: 50, narrativa_auto: 50,
  },
  {
    id: 'irene-paredes', name: 'Irene Paredes', sport: 'futbol', category: 'creadores',
    handles: { instagram: 'ireneparedesc', twitter: 'IreneParedesC', tiktok: '@ireneparedes' },
    mediatico_auto: 50, narrativa_auto: 50,
  },
  {
    id: 'sandra-panos', name: 'Sandra Paños', sport: 'futbol', category: 'creadores',
    handles: { instagram: 'sandrapanos', twitter: 'SandraPanos', tiktok: '@sandrapanos' },
    mediatico_auto: 50, narrativa_auto: 50,
  },
  {
    id: 'asisat-oshoala', name: 'Asisat Oshoala', sport: 'futbol', category: 'creadores',
    handles: { instagram: 'asisat_oshoala', twitter: 'AsisatOshoala', tiktok: '@asioshoala' },
    mediatico_auto: 50, narrativa_auto: 50,
  },

  // ── Golf ampliado ─────────────────────────────────────────────────
  {
    id: 'sergio-garcia', name: 'Sergio García', sport: 'golf', category: 'creadores',
    handles: { instagram: 'thegarciasg', twitter: 'TheSergioGarcia', tiktok: '@sergiogarcia' },
    mediatico_auto: 50, narrativa_auto: 50,
  },
  {
    id: 'carlota-ciganda', name: 'Carlota Ciganda', sport: 'golf', category: 'creadores',
    handles: { instagram: 'carlotaciganda', twitter: 'CarlotaCiganda', tiktok: '@carlotaciganda' },
    mediatico_auto: 50, narrativa_auto: 50,
  },
  // Golf en Español ya existe con id=golf-espanol — no duplicar

  // ── Atletismo y deportes olímpicos ────────────────────────────────
  {
    id: 'yulimar-rojas', name: 'Yulimar Rojas', sport: 'atletismo', category: 'creadores',
    handles: { instagram: 'yulimar_rojas', twitter: 'Yulimarrojas', tiktok: '@yulimar_rojas' },
    mediatico_auto: 50, narrativa_auto: 50,
  },
  {
    id: 'asier-martinez', name: 'Asier Martínez', sport: 'atletismo', category: 'creadores',
    handles: { instagram: 'asier_martinez_', twitter: 'asier_martinez_', tiktok: '@asiermartinez' },
    mediatico_auto: 50, narrativa_auto: 50,
  },
  {
    id: 'david-gomez-atletismo', name: 'David Díaz Atletismo', sport: 'atletismo', category: 'creadores',
    handles: { youtube: '@atletismoenvivo', instagram: 'atletismoenvivo', tiktok: '@atletismoenvivo' },
    mediatico_auto: 50, narrativa_auto: 50,
  },
  {
    id: 'alejandro-davidovich', name: 'Alejandro Davidovich', sport: 'tenis', category: 'creadores',
    handles: { instagram: 'alejandrodavidovich', twitter: 'adavidovichf', tiktok: '@alejandrodavidovich' },
    mediatico_auto: 50, narrativa_auto: 50,
  },
  {
    id: 'roberto-bautista', name: 'Roberto Bautista Agut', sport: 'tenis', category: 'creadores',
    handles: { instagram: 'roberto_bautista_agut', twitter: 'BautistaAgut', tiktok: '@robertobautistaagut' },
    mediatico_auto: 50, narrativa_auto: 50,
  },

  // ── MotoGP ampliado ───────────────────────────────────────────────
  {
    id: 'maverick-vinales', name: 'Maverick Viñales', sport: 'motogp', category: 'creadores',
    handles: { instagram: 'maverickvinales12', twitter: 'mvkoficial12', tiktok: '@maverickvinales' },
    mediatico_auto: 50, narrativa_auto: 50,
  },
  {
    id: 'aleix-espargaro', name: 'Aleix Espargaró', sport: 'motogp', category: 'creadores',
    handles: { instagram: 'aleixespargaro', twitter: 'AleixEspargaro', tiktok: '@aleixespargaro' },
    mediatico_auto: 50, narrativa_auto: 50,
  },
  {
    id: 'crash-net-es', name: 'Crash.net MotoGP', sport: 'motogp', category: 'creadores',
    handles: { youtube: '@motogpvideos', twitter: 'MotoGPVideos', instagram: 'motogpvideos' },
    mediatico_auto: 50, narrativa_auto: 50,
  },

  // ── Fútbol sala / otros ───────────────────────────────────────────
  {
    id: 'futsal-espana', name: 'Fútbol Sala España', sport: 'futbol', category: 'creadores',
    handles: { youtube: '@futbolsalaespana', instagram: 'futbolsalaespana', twitter: 'futbolsalaESP', tiktok: '@futbolsalaespana' },
    mediatico_auto: 50, narrativa_auto: 50,
  },

  // ── Creadores TikTok sport adicionales ───────────────────────────
  {
    id: 'ivan-ruiz-creator', name: 'Iván Ruiz (creador)', sport: 'futbol', category: 'creadores',
    handles: { tiktok: '@ivan_ruizz', instagram: 'ivan_ruizz', twitter: 'ivan_ruizz' },
    mediatico_auto: 50, narrativa_auto: 50,
  },
  {
    id: 'la-cueva-del-basket', name: 'La Cueva del Basket', sport: 'baloncesto', category: 'creadores',
    handles: { youtube: '@LaCuevadelBasket', instagram: 'lacuevadelbasket', twitter: 'LaCuevadelBasket', tiktok: '@lacuevadelbasket' },
    mediatico_auto: 50, narrativa_auto: 50,
  },
  {
    id: 'basket-emotion', name: 'Basket Emotion', sport: 'baloncesto', category: 'creadores',
    handles: { youtube: '@BasketEmotion', instagram: 'basketemotion', twitter: 'BasketEmotion', tiktok: '@basketemotion' },
    mediatico_auto: 50, narrativa_auto: 50,
  },
  {
    id: 'nba-memes-es', name: 'NBA España', sport: 'baloncesto', category: 'creadores',
    handles: { youtube: '@NBAespana', instagram: 'nbaespana', twitter: 'NBAspain', tiktok: '@nbaespana' },
    mediatico_auto: 50, narrativa_auto: 50,
  },
]

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}\n`)

  const { data: existing } = await sb
    .from('ranking_entries')
    .select('id, name')
    .in('id', NEW_ENTRIES.map(e => e.id))

  const existingIds = new Set((existing || []).map(e => e.id))
  const toInsert = NEW_ENTRIES.filter(e => !existingIds.has(e.id))
  const skipped  = NEW_ENTRIES.filter(e =>  existingIds.has(e.id))

  console.log(`Nuevas: ${toInsert.length} | Ya existen: ${skipped.length}`)
  if (skipped.length) console.log('  Skip:', skipped.map(e => e.name).join(', '))

  if (toInsert.length === 0) { console.log('\nNada que insertar.'); return }

  toInsert.forEach(e => console.log(`  + ${e.name.padEnd(30)} [${e.sport}]`))

  if (!APPLY) { console.log('\nDRY RUN — pasa --apply para escribir.'); return }

  const rows = toInsert.map(e => ({
    id: e.id, name: e.name, sport: e.sport, category: e.category,
    handles: e.handles,
    rendimiento_auto: null,
    mediatico_auto: e.mediatico_auto,
    narrativa_auto: e.narrativa_auto,
    contexto_auto: null,
    active: true,
  }))

  const { error } = await sb.from('ranking_entries').insert(rows)
  if (error) { console.error('INSERT FAIL:', error.message); process.exit(1) }
  console.log(`\nInsertadas ${rows.length} entradas.`)
}

main().catch(err => { console.error(err); process.exit(1) })
