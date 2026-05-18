#!/usr/bin/env node
// expand-contenidos-v9.mjs
// Segunda tanda de creadores y periodistas PUROS hispanohablantes.
//
// FÚTBOL (8): PaulFerrerZ, La Cobra, Rodrigo Fáez, Rafa Escrig (fútbol),
//             Sara Nogark, Fútbol Living, Alberto Edjogo, Fútbol Infinito
//
// UFC (2): Enrique Gimeno MMA, UFC Español (TikTok)
//
// WWE (2): Eduardo Bates, Fronzak WWE
//
// Uso:
//   node scripts/expand-contenidos-v9.mjs
//   node scripts/expand-contenidos-v9.mjs --apply

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
  // FÚTBOL — CREADORES/PERIODISTAS DIGITALES
  // ══════════════════════════════════════════════════════════════════

  {
    id: 'paulferrerz',
    name: 'Paul Ferrer Z', sport: 'futbol', category: 'creadores',
    handles: {
      youtube:   '@paulferrerz',     // ~12M suscriptores
      tiktok:    '@paulferrerz',
      instagram: 'paulferrerz',
    },
    mediatico_auto: 92, narrativa_auto: 65,
    // El rey del humor futbolero en formato corto. 12M en YouTube.
    // POVs virales sobre situaciones futboleras cotidianas.
    // Perfil diferente a David Suárez (más sketch que commentary), alcance juvenil enorme.
  },
  {
    id: 'lacobra-futbol',
    name: 'La Cobra', sport: 'futbol', category: 'creadores',
    handles: {
      youtube:   '@lacobraoficial',  // ~860K suscriptores
      tiktok:    '@lacobraoficial',
      instagram: 'lacobraoficial',
    },
    mediatico_auto: 80, narrativa_auto: 70,
    // Referente del debate futbolero (Boca, River, Selección Argentina) en la nueva generación.
    // ~860K YouTube + 600K Kick. Participó en La Velada del Año (Ibai).
    // Perfil híbrido streamer/analista para audiencia LATAM.
  },
  {
    id: 'rodrigofaez',
    name: 'Rodrigo Fáez', sport: 'futbol', category: 'periodistas',
    handles: {
      youtube:   '@RodrigoFaez',     // ~415K suscriptores
      instagram: 'rodrigofaez',
      twitter:   'rodrigofaez',
    },
    mediatico_auto: 75, narrativa_auto: 78,
    // Periodista ESPN Madrid. ~415K YouTube. Historias de futbolistas como protagonistas.
    // "El único canal donde los futbolistas son los protagonistas."
    // Puente entre medios tradicionales y YouTube, gran alcance latinoamericano vía ESPN.
  },
  {
    id: 'rafaescrig-futbol',
    name: 'Rafa Escrig', sport: 'futbol', category: 'periodistas',
    handles: {
      youtube:   '@RafaEscrig',      // ~420K suscriptores
      instagram: 'rafaescrig',
      twitter:   'rafaescrig',
    },
    mediatico_auto: 72, narrativa_auto: 75,
    // Periodista-youtuber español. ~420K YouTube. Colaboraciones con DAZN.
    // Reportajes viajando a estadios del mundo entero. Historias humanas del fútbol.
    // Mezcla periodismo de calle con YouTube. Tono único, muy diferente al análisis táctico.
    // NOTA: distinto de Rafael Escrig (tenis), que ya existe en la DB.
  },
  {
    id: 'saranogark',
    name: 'Sara Nogark', sport: 'futbol', category: 'creadores',
    handles: {
      youtube:   '@SaraNogark',      // ~144K suscriptores
      instagram: 'saranogark',
      tiktok:    '@saranogark',
    },
    mediatico_auto: 58, narrativa_auto: 60,
    // Creadora española de contenido de fútbol desde perspectiva femenina.
    // 144K YouTube. Análisis, actualidad, tono directo y personal.
    // Referente femenina del fútbol digital español junto a Lorena Escoz.
  },
  {
    id: 'futbol-living',
    name: 'Fútbol Living', sport: 'futbol', category: 'creadores',
    handles: {
      youtube:   '@FutbolLiving',    // ~249K suscriptores
      instagram: 'futbolliving',
      tiktok:    '@futbolliving',
    },
    mediatico_auto: 65, narrativa_auto: 58,
    // Canal español con mayor volumen de views en deporte (ene 2026, España).
    // ~249K suscriptores. Noticias y análisis de fútbol español y europeo.
    // Emergente de alto rendimiento en visualizaciones.
  },
  {
    id: 'alberto-edjogo',
    name: 'Alberto Edjogo', sport: 'futbol', category: 'periodistas',
    handles: {
      youtube:   '@AlbertoEdjogo',
      instagram: 'albertoedjogo',
      twitter:   'AlbertoEdjogo',
    },
    mediatico_auto: 48, narrativa_auto: 62,
    // Analista táctico español con raíces ecuatoguineanas. Colaborador DAZN.
    // Especialidad única: AfroRadar (análisis del fútbol africano).
    // Voz respetada por su imparcialidad. Emergente de calidad editorial.
  },
  {
    id: 'futbol-infinito',
    name: 'Fútbol Infinito', sport: 'futbol', category: 'creadores',
    handles: {
      youtube:   '@futbolinfinito',
      spotify:   'futbol-infinito',
      instagram: 'futbolinfinito',
    },
    mediatico_auto: 42, narrativa_auto: 65,
    // Podcast/canal de Eduardo Biscayart y Jaime Macías. Conversaciones reflexivas
    // sobre fútbol desde perspectiva periodística adulta. Historias, análisis de eventos.
    // Estilo más pausado que La Media Inglesa. Público cultivado y adulto.
  },

  // ══════════════════════════════════════════════════════════════════
  // UFC / MMA — CREADORES PUROS
  // ══════════════════════════════════════════════════════════════════

  {
    id: 'enrique-gimeno-mma',
    name: 'Enrique Gimeno MMA', sport: 'ufc', category: 'creadores',
    handles: {
      youtube:   '@EnriqueGimenoMMA',
      instagram: 'enriquegimenomma',
      twitter:   'enriquegimenomma',
    },
    mediatico_auto: 45, narrativa_auto: 60,
    // Periodista independiente español. Uno de los más longevos en el espacio MMA.
    // Análisis profundos, entrevistas, predicciones. Comunidad fiel de hardcore fans.
    // Tono opinativo y directo. Blog propio + YouTube + redes.
  },
  {
    id: 'ufc-espanol-tiktok',
    name: 'UFC Español', sport: 'ufc', category: 'creadores',
    handles: {
      tiktok:    '@ufcespanol',      // 5M seguidores, 88.2M likes
      instagram: 'ufcespanol',
      youtube:   '@ufcespanol',
    },
    mediatico_auto: 90, narrativa_auto: 68,
    // Cuenta oficial de UFC para audiencia hispanohablante en TikTok.
    // 5M seguidores, 88.2M likes. La mayor cuenta de MMA en español en TikTok.
    // Highlights, momentos históricos, contenido editorial hispanohablante.
  },

  // ══════════════════════════════════════════════════════════════════
  // WWE — CREADORES PUROS
  // ══════════════════════════════════════════════════════════════════

  {
    id: 'eduardo-bates-wwe',
    name: 'Eduardo Bates', sport: 'wwe', category: 'creadores_wwe',
    handles: {
      tiktok:    '@soyeduardobates',  // 1.1M seguidores / 64.2M likes
      youtube:   '@SoyEduardoBates',
      instagram: 'soyeduardobates',
    },
    mediatico_auto: 82, narrativa_auto: 75,
    // TikTok 1.1M, 64.2M likes — el mayor creador WWE en español no cubierto.
    // Coberturas en vivo de eventos WWE en México. Podcasts: "Sin Límite de Tiempo",
    // "El Show de Eduardo Bates", "Una Caída Más". Debates con Uke Wrestling.
    // Referente absoluto del wrestling hispano en TikTok. México.
  },
  {
    id: 'fronzak-wwe',
    name: 'Fronzak WWE', sport: 'wwe', category: 'creadores_wwe',
    handles: {
      tiktok:    '@fronzakwwe',      // 352K seguidores / 10.5M likes
      youtube:   '@FronzakWWE',      // ~331K suscriptores (+42K en 90 días)
      instagram: 'fronzakwwe',
    },
    mediatico_auto: 72, narrativa_auto: 68,
    // TikTok 352K + YouTube 331K con crecimiento acelerado (+42K subs en 90 días).
    // Tops, noticias WWE, curiosidades, WWE Latinoamérica, "¿Leyenda o no?".
    // Lucha libre mexicana. Uno de los mayores momentos de crecimiento del wrestling hispano.
    // México. Perfil nativo TikTok con fuerte YouTube.
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

  console.log('\n  ⚽ Fútbol creadores:')
  toInsert.filter(e => e.sport === 'futbol').forEach(e => console.log(`    + ${e.name.padEnd(28)} [${e.category}]`))
  console.log('\n  🥊 UFC creadores:')
  toInsert.filter(e => e.sport === 'ufc').forEach(e => console.log(`    + ${e.name.padEnd(28)} [${e.category}]`))
  console.log('\n  🤼 WWE creadores:')
  toInsert.filter(e => e.sport === 'wwe').forEach(e => console.log(`    + ${e.name.padEnd(28)} [${e.category}]`))

  if (!APPLY) { console.log('\nDRY RUN — pasa --apply para escribir.'); return }

  const rows = toInsert.map(e => ({
    id: e.id, name: e.name, sport: e.sport, category: e.category,
    handles: e.handles ?? null,
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
