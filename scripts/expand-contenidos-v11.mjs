#!/usr/bin/env node
// expand-contenidos-v11.mjs
// Creadores GRANDES hispanohablantes aún no cubiertos.
//
// FÚTBOL (8):
//   La Gambeta Sports    (6.5M TikTok — el mayor de fútbol en TikTok hispanohablante)
//   Iker Ruiz del Barco  (5.3M TikTok — análisis táctico viral)
//   Los Displicentes     (570K YT — podcast irreverente fútbol mexicano)
//   Cábala Futbolera     (700K YT — análisis fútbol Mexico / LATAM)
//   Toto Bordieri        (523K YT — fútbol argentino, entrevistas)
//   Mernuel              (1.3M YT — contenido fútbol + humor, España)
//   MarkitoNavaja        (2M IG — fútbol urbano, México)
//   Fútbol Al Chile      (635K TikTok — análisis LigaMX estilo directo)
//
// UFC/BOXEO (2):
//   Box Azteca           (canal oficial boxeo TV Azteca, mayor audiencia México)
//   Christian Tetzpa     (periodista UFC Español / ESPN, cara de UFC LATAM)
//
// WWE (3):
//   Diego Aranís         (425K YT — wrestling español análisis serio)
//   TP Wrestling         (noticias wrestling en español, portal + podcast)
//   Luigi Wrestling      (contenido WWE en español, Argentina)
//
// Uso:
//   node scripts/expand-contenidos-v11.mjs
//   node scripts/expand-contenidos-v11.mjs --apply

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

  // ══════════════════════════════════════════════════════════════════
  // FÚTBOL — GRANDES SIN CUBRIR
  // ══════════════════════════════════════════════════════════════════

  {
    id: 'la-gambeta-sports',
    name: 'La Gambeta Sports', sport: 'futbol', category: 'creadores',
    handles: {
      tiktok:    '@lagambetasports',    // 6.5M seguidores — el mayor de fútbol hispano en TikTok
      youtube:   '@LaGambetaSports',
      instagram: 'lagambetasports',
      twitter:   'lagambetasports',
    },
    rendimiento_auto: 88, contexto_auto: 68, mediatico_auto: 96, narrativa_auto: 60,
    // El mayor canal de fútbol hispanohablante en TikTok con 6.5M seguidores.
    // Contenido rápido: highlights, clips virales, noticias del momento.
    // Argentina. Formato nativo TikTok adaptado al consumo móvil masivo.
    // Mayor alcance bruto de todos los creadores de fútbol en español en TikTok.
  },
  {
    id: 'iker-ruiz-futbol',
    name: 'Iker Ruiz del Barco', sport: 'futbol', category: 'creadores',
    handles: {
      tiktok:    '@ikerruizdelbarco',   // 5.3M seguidores
      youtube:   '@IkerRuizDelBarco',
      instagram: 'ikerruizdelbarco',
      twitter:   'ikerruizdelbarco',
    },
    rendimiento_auto: 85, contexto_auto: 68, mediatico_auto: 94, narrativa_auto: 72,
    // 5.3M TikTok — análisis táctico y narrativo en formato corto.
    // Explica fútbol complejo de forma sencilla y viral. España.
    // El puente entre el análisis serio y el formato nativo de TikTok.
    // Gran alcance joven. Crecimiento explosivo en 2024-2025.
  },
  {
    id: 'mernuel',
    name: 'Mernuel', sport: 'futbol', category: 'creadores',
    handles: {
      youtube:   '@Mernuel',            // 1.3M suscriptores
      tiktok:    '@mernuel',
      instagram: 'mernuel',
      twitter:   'mernuel',
    },
    rendimiento_auto: 78, contexto_auto: 68, mediatico_auto: 88, narrativa_auto: 70,
    // 1.3M YouTube. Contenido fútbol + humor + cultura pop. España.
    // Mezcla el análisis deportivo con entretenimiento puro.
    // Gran presencia en la comunidad gamer/streamer española que consume fútbol.
    // Muy seguido entre 18-30 años. Tono irreverente y directo.
  },
  {
    id: 'los-displicentes',
    name: 'Los Displicentes', sport: 'futbol', category: 'creadores',
    handles: {
      youtube:   '@LosDisplicentes',    // ~570K suscriptores
      spotify:   'los-displicentes',
      instagram: 'losdisplicentes',
      twitter:   'losdisplicentes',
    },
    rendimiento_auto: 68, contexto_auto: 68, mediatico_auto: 72, narrativa_auto: 75,
    // Podcast/canal de fútbol mexicano con tono irreverente y sin filtros.
    // ~570K YouTube. Cubre Liga MX, selección mexicana y fútbol internacional.
    // El humor negro y la crítica sin complejos los distingue de otros podcasts MX.
    // Comunidad muy fiel. Formato largo que compite con Ibai en calidad.
  },
  {
    id: 'cabala-futbolera',
    name: 'Cábala Futbolera', sport: 'futbol', category: 'creadores',
    handles: {
      youtube:   '@CabalaFutbolera',    // ~700K suscriptores
      instagram: 'cabalafutbolera',
      twitter:   'cabalafutbolera',
    },
    rendimiento_auto: 70, contexto_auto: 68, mediatico_auto: 75, narrativa_auto: 72,
    // 700K YouTube. Análisis táctico profundo + entrevistas + datos.
    // Fútbol mexicano (Liga MX) y LATAM. El referente del análisis serio en México.
    // Audiencia de fanáticos inteligentes. Uno de los canales de análisis más influyentes.
  },
  {
    id: 'toto-bordieri',
    name: 'Toto Bordieri', sport: 'futbol', category: 'creadores',
    handles: {
      youtube:   '@TotoBordieri',       // ~523K suscriptores
      instagram: 'totobordieri',
      twitter:   'totobordieri',
    },
    rendimiento_auto: 68, contexto_auto: 68, mediatico_auto: 72, narrativa_auto: 74,
    // 523K YouTube. Entrevistas y análisis del fútbol argentino.
    // El periodismo de largo aliento aplicado a YouTube. Buenos Aires.
    // Entrevistas exclusivas con jugadores y referentes del fútbol argentino.
    // Sigue el modelo "periodismo de calidad en formato digital".
  },
  {
    id: 'markitonavaja',
    name: 'MarkitoNavaja', sport: 'futbol', category: 'creadores',
    handles: {
      instagram: 'markitonavaja',       // ~2M seguidores
      tiktok:    '@markitonavaja',
      youtube:   '@MarkitoNavaja',
    },
    rendimiento_auto: 80, contexto_auto: 68, mediatico_auto: 90, narrativa_auto: 58,
    // 2M Instagram. Fútbol urbano y popular en México.
    // Mezcla noticias rápidas, humor y cultura futbolera mexicana.
    // Formato nativo IG/TikTok. Enorme alcance en el segmento 18-35 México.
    // Diferente de los analistas tácticos: más entretenimiento puro.
  },
  {
    id: 'futbol-al-chile',
    name: 'Fútbol Al Chile', sport: 'futbol', category: 'creadores',
    handles: {
      tiktok:    '@futbotalchile',      // ~635K seguidores
      instagram: 'futbotalchile',
      youtube:   '@FutbolAlChile',
    },
    rendimiento_auto: 65, contexto_auto: 68, mediatico_auto: 70, narrativa_auto: 65,
    // 635K TikTok. Análisis Liga MX y fútbol mexicano con estilo directo ("al chile").
    // Nombre juega con la expresión mexicana "al chile" (sin rodeos).
    // Formato nativo TikTok. Audiencia mexicana comprometida.
    // Cubre mercado, resultados, polémica deportiva de Liga MX.
  },

  // ══════════════════════════════════════════════════════════════════
  // UFC / BOXEO
  // ══════════════════════════════════════════════════════════════════

  {
    id: 'box-azteca',
    name: 'Box Azteca', sport: 'ufc', category: 'creadores',
    handles: {
      youtube:   '@BoxAzteca',
      twitter:   'BoxAzteca',
      instagram: 'boxazteca',
    },
    rendimiento_auto: 70, contexto_auto: 72, mediatico_auto: 82, narrativa_auto: 65,
    // Canal oficial de boxeo de TV Azteca — la mayor cadena de televisión mexicana.
    // Mayor audiencia de boxeo en México. Transmite peleas de peso histórico.
    // Palomino, Vergara, Canelo (antes). El boxing mainstream en español.
    // Puente entre televisión tradicional y digital. YouTube + app Azteca.
  },
  {
    id: 'christian-tetzpa',
    name: 'Christian Tetzpa', sport: 'ufc', category: 'periodistas',
    handles: {
      twitter:   'ChristianTetzpa',
      instagram: 'christiantetzpa',
      youtube:   '@ChristianTetzpa',
    },
    rendimiento_auto: 68, contexto_auto: 72, mediatico_auto: 72, narrativa_auto: 74,
    // Periodista de UFC Español y ESPN MMA para audiencia hispanohablante.
    // La cara más reconocible del MMA en español en redes sociales.
    // Entrevistas con luchadores, cobertura de eventos, insider de la UFC.
    // Co-conduce Área de Combate ESPN. Referente del periodismo MMA en español. México.
  },

  // ══════════════════════════════════════════════════════════════════
  // WWE / WRESTLING
  // ══════════════════════════════════════════════════════════════════

  {
    id: 'diego-aranis-wwe',
    name: 'Diego Aranís', sport: 'wwe', category: 'creadores_wwe',
    handles: {
      youtube:   '@DiegoAranis',        // ~425K suscriptores
      instagram: 'diegoaranis',
      twitter:   'diegoaranis',
    },
    rendimiento_auto: 68, contexto_auto: 70, mediatico_auto: 75, narrativa_auto: 72,
    // 425K YouTube. Análisis profundo de WWE, AEW, storylines y booking.
    // Uno de los canales de wrestling más serios y consolidados en español.
    // Cobertura en directo de PPVs. Formato de análisis post-evento.
    // Competidor directo de UHEP y Laberinto de Minotaurovk. México/LATAM.
  },
  {
    id: 'tp-wrestling',
    name: 'TP Wrestling', sport: 'wwe', category: 'creadores_wwe',
    handles: {
      twitter:   'TPWrestling',
      instagram: 'tpwrestling',
      youtube:   '@TPWrestling',
    },
    rendimiento_auto: 55, contexto_auto: 70, mediatico_auto: 58, narrativa_auto: 68,
    // Portal de noticias de wrestling en español + podcast.
    // Cubre WWE, AEW, NJPW, TNA. Rumores, resultados, análisis.
    // Modelo periodístico: novedades del día + opinión editorial.
    // Complementario de TurnHeel (más dirt sheet) y UHEP (más análisis).
  },
  {
    id: 'luigi-wrestling',
    name: 'LuigiWrestling', sport: 'wwe', category: 'creadores_wwe',
    handles: {
      youtube:   '@LuigiWrestling',
      instagram: 'luigiwrestling',
      twitter:   'luigiwrestling',
    },
    rendimiento_auto: 52, contexto_auto: 70, mediatico_auto: 55, narrativa_auto: 65,
    // Canal de wrestling en español con foco en WWE y lucha libre.
    // Argentina. Tops, rankings, historias, reacciones a eventos.
    // Formato YouTube nativo. Comunidad activa en LATAM.
    // Complementa el ecosistema hispanohablante de wrestling digital.
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

  console.log('\n  ⚽ Fútbol:')
  toInsert.filter(e => e.sport === 'futbol').forEach(e =>
    console.log(`    + ${e.name.padEnd(32)} med:${e.mediatico_auto}  nar:${e.narrativa_auto}`))
  console.log('\n  🥊 UFC/Boxeo:')
  toInsert.filter(e => e.sport === 'ufc').forEach(e =>
    console.log(`    + ${e.name.padEnd(32)} med:${e.mediatico_auto}  nar:${e.narrativa_auto}`))
  console.log('\n  🤼 WWE/Wrestling:')
  toInsert.filter(e => e.sport === 'wwe').forEach(e =>
    console.log(`    + ${e.name.padEnd(32)} med:${e.mediatico_auto}  nar:${e.narrativa_auto}`))

  if (!APPLY) { console.log('\nDRY RUN — pasa --apply para escribir.'); return }

  const rows = toInsert.map(e => ({
    id:              e.id,
    name:            e.name,
    sport:           e.sport,
    category:        e.category,
    handles:         e.handles ?? null,
    rendimiento_auto: e.rendimiento_auto,
    contexto_auto:   e.contexto_auto,
    mediatico_auto:  e.mediatico_auto,
    narrativa_auto:  e.narrativa_auto,
    active:          true,
  }))

  const { error } = await sb.from('ranking_entries').insert(rows)
  if (error) { console.error('INSERT FAIL:', error.message); process.exit(1) }
  console.log(`\nInsertadas ${rows.length} entradas.`)
}

main().catch(err => { console.error(err); process.exit(1) })
