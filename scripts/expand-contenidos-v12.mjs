#!/usr/bin/env node
// expand-contenidos-v12.mjs
// Nuevos creadores para el ranking final de Contenidos.
//
// FÚTBOL (3):
//   Javi Bridge / Javi Díaz  — TikTok 3.3M (@javibridgee3), DAZN España, "El Brujo"
//   Fútbol con Temo          — TikTok 2M+, YouTube 360-510K, entretenimiento fútbol
//   Alex Pérez Poza          — Instagram 712K, creative director @sefutbol, España
//
// WWE (3):
//   NoahClub                 — WWE en español, comunidad activa
//   TioAllende               — WWE/wrestling mexicano, nicho fiel
//   Soyalekay (Alex García)  — TikTok 905K, WWE en vivo CDMX, México
//
// UFC/MMA (4):
//   GenioMMA                 — TikTok 163K / 11.4M likes, YouTube 67K, 33M vistas, Chile
//   Imperator MMA            — análisis UFC en español, España
//   GreenVids                — contenido MMA/combate en español
//   Guante a Guante          — podcast boxeo/MMA hispano
//
// Uso:
//   node scripts/expand-contenidos-v12.mjs
//   node scripts/expand-contenidos-v12.mjs --apply

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
  // FÚTBOL
  // ══════════════════════════════════════════════════════════════════

  {
    id: 'javibridge',
    name: 'Javi Bridge', sport: 'futbol', category: 'creadores',
    handles: {
      tiktok:    '@javibridgee3',     // 3.3M+ seguidores — vídeo viral 18M vistas
      instagram: 'javibridgee',       // ~730K
      youtube:   '@javibridgee',
    },
    rendimiento_auto: 85, contexto_auto: 68, mediatico_auto: 96, narrativa_auto: 65,
    score_auto: 81.4,
    // Javi Díaz, conocido como "El Brujo". TikTok 3.3M. DAZN España.
    // Reacciones, comparativas de jugadores, comentario de partidos.
    // Vídeo viral con 18M vistas. Madrid. Uno de los TikTokers de fútbol más grandes de España.
  },
  {
    id: 'futbolcontemo',
    name: 'Fútbol con Temo', sport: 'futbol', category: 'creadores',
    handles: {
      tiktok:    '@futbolcontemo',    // 2M+ seguidores
      youtube:   '@futbolcontemo',    // 360-510K suscriptores
      instagram: 'futbolcontemo',     // ~640K
    },
    rendimiento_auto: 80, contexto_auto: 68, mediatico_auto: 90, narrativa_auto: 62,
    score_auto: 78.2,
    // "Temo" — uno de los mayores TikTokers de fútbol en español. 2M+ TikTok.
    // Entretenimiento, reacciones, trivial futbolero, humor.
    // Representado por etalentm.com. España (Barcelona/Madrid).
    // Perfil nativo TikTok con canal YouTube consolidado.
  },
  {
    id: 'alexperezpoza',
    name: 'Alex Pérez Poza', sport: 'futbol', category: 'creadores',
    handles: {
      instagram: 'alexperezpoza',     // ~712K seguidores
      youtube:   '@alexperezpoza',
      twitter:   'alexperezpoza',
    },
    rendimiento_auto: 70, contexto_auto: 68, mediatico_auto: 78, narrativa_auto: 62,
    score_auto: 72.0,
    // Director creativo de @sefutbol (Selección Española de Fútbol).
    // 712K Instagram. Contenido visual/creativo del fútbol español.
    // Vlogs, behind-the-scenes en el Bernabéu y concentraciones de la selección.
    // Puente entre el mundo profesional del fútbol y las redes sociales.
  },

  // ══════════════════════════════════════════════════════════════════
  // WWE / WRESTLING
  // ══════════════════════════════════════════════════════════════════

  {
    id: 'noahclub-wwe',
    name: 'NoahClub', sport: 'wwe', category: 'creadores_wwe',
    handles: {
      tiktok:    '@noahclubwwe',
      youtube:   '@NoahClub',
      instagram: 'noahclubwwe',
    },
    rendimiento_auto: 55, contexto_auto: 70, mediatico_auto: 62, narrativa_auto: 62,
    score_auto: 60.8,
    // Creador WWE en español con comunidad fiel.
    // Reacciones a eventos, análisis de storylines, tops.
    // Contenido WWE para audiencia hispanohablante.
  },
  {
    id: 'tioallende-wwe',
    name: 'TioAllende', sport: 'wwe', category: 'creadores_wwe',
    handles: {
      tiktok:    '@tioallende',
      youtube:   '@TioAllende',
      instagram: 'tioallende',
    },
    rendimiento_auto: 52, contexto_auto: 70, mediatico_auto: 58, narrativa_auto: 62,
    score_auto: 58.6,
    // Creador de wrestling en español con enfoque mexicano.
    // WWE, lucha libre AAA/CMLL, cobertura de eventos en México.
    // Comunidad wrestling hispanohablante.
  },
  {
    id: 'soyalekay',
    name: 'Soyalekay', sport: 'wwe', category: 'creadores_wwe',
    handles: {
      tiktok:    '@soyalekay',        // ~905K-930K seguidores
      youtube:   '@soyalekay',        // ~195K
      instagram: 'soyalekay',         // ~20K
    },
    rendimiento_auto: 72, contexto_auto: 70, mediatico_auto: 80, narrativa_auto: 68,
    score_auto: 73.0,
    // Alex García, México (CDMX). TikTok 905K. WWE reactions y vlogs.
    // Coberturas en vivo de eventos WWE en Arena CDMX.
    // Narrativas crossover entre wrestling y storytelling visual.
    // Perfil TikTok-first con fuerte crecimiento YouTube.
  },

  // ══════════════════════════════════════════════════════════════════
  // UFC / MMA
  // ══════════════════════════════════════════════════════════════════

  {
    id: 'geniomma',
    name: 'GenioMMA', sport: 'ufc', category: 'creadores',
    handles: {
      tiktok:    '@geniomma_',        // ~163K seguidores / 11.4M likes
      youtube:   '@GenioMMA',         // ~67K suscriptores / 33M vistas
      instagram: 'geniomma_',
    },
    rendimiento_auto: 58, contexto_auto: 72, mediatico_auto: 62, narrativa_auto: 62,
    score_auto: 62.4,
    // Chile. TikTok 163K / 11.4M likes. YouTube 67K con 33M vistas (ratio excepcional).
    // Análisis MMA/UFC, knockouts, predicciones. "Todo MMA".
    // Formato análisis profundo con alcance viral. Canal activo desde 2024.
  },
  {
    id: 'imperator-mma',
    name: 'Imperator MMA', sport: 'ufc', category: 'creadores',
    handles: {
      instagram: 'imperator_mma_',
      tiktok:    '@imperator_mma',
      youtube:   '@ImperatorMMA',
    },
    rendimiento_auto: 40, contexto_auto: 72, mediatico_auto: 42, narrativa_auto: 55,
    score_auto: 49.2,
    // Creador MMA/UFC en español. "Bienvenido al mundo de las MMA."
    // Noticias, análisis y comentario. España o LATAM.
    // Perfil emergente en el nicho MMA hispano.
  },
  {
    id: 'greenvids-mma',
    name: 'GreenVids', sport: 'ufc', category: 'creadores',
    handles: {
      tiktok:    '@greenvids',
      youtube:   '@GreenVids',
      instagram: 'greenvids',
    },
    rendimiento_auto: 45, contexto_auto: 70, mediatico_auto: 50, narrativa_auto: 55,
    score_auto: 52.8,
    // Contenido deportivo/MMA en español.
    // Creador mencionado en el radar de UFC/combate hispanohablante.
  },
  {
    id: 'guante-a-guante',
    name: 'Guante a Guante', sport: 'ufc', category: 'creadores',
    handles: {
      spotify:   'guante-a-guante',
      instagram: 'guanteaguante',
      twitter:   'guanteaguante',
    },
    rendimiento_auto: 42, contexto_auto: 72, mediatico_auto: 45, narrativa_auto: 60,
    score_auto: 51.5,
    // Podcast de boxeo y MMA en español.
    // Análisis, entrevistas, cobertura de peleas.
    // Nicho combate hispano con audiencia fiel.
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
    console.log(`    + ${e.name.padEnd(28)} TikTok/IG med:${e.mediatico_auto}`))
  console.log('\n  🤼 WWE:')
  toInsert.filter(e => e.sport === 'wwe').forEach(e =>
    console.log(`    + ${e.name.padEnd(28)} med:${e.mediatico_auto}`))
  console.log('\n  🥊 UFC/MMA:')
  toInsert.filter(e => e.sport === 'ufc').forEach(e =>
    console.log(`    + ${e.name.padEnd(28)} med:${e.mediatico_auto}`))

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
    score_auto:      e.score_auto,
    active:          true,
  }))

  const { error } = await sb.from('ranking_entries').insert(rows)
  if (error) { console.error('INSERT FAIL:', error.message); process.exit(1) }
  console.log(`\nInsertadas ${rows.length} entradas.`)
}

main().catch(err => { console.error(err); process.exit(1) })
