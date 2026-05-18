#!/usr/bin/env node
// expand-ufc-wwe-v7.mjs
// Expansión definitiva — UFC/WWE hispanohablantes.
// Separa claramente PERSONAS (creadores/periodistas con marca personal)
// de MEDIOS DIGITALES (canales, portales, podcasts de marca).
// Solo digitales: YouTube, TikTok, IG, Twitch, podcast, web.
//
// Uso:
//   node scripts/expand-ufc-wwe-v7.mjs
//   node scripts/expand-ufc-wwe-v7.mjs --apply

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

// ── Helpers ──────────────────────────────────────────────────────────
// category: 'creadores' → sport: 'ufc'/'wwe'/...  → "Creador" badge
// category: 'periodistas' → "Periodista" badge
// category: 'creadores_wwe' → "Creador" badge, WWE section
// mediatico_auto = alcance social estimado manual (ingest lo sobreescribirá)
// narrativa_auto  = relevancia editorial/cultural
// ─────────────────────────────────────────────────────────────────────

const NEW_ENTRIES = [

  // ══════════════════════════════════════════════════════════════════
  // UFC / MMA — PERSONAS
  // ══════════════════════════════════════════════════════════════════

  {
    id: 'gonzalo-campos-mma',
    name: 'Gonzalo Campos', sport: 'ufc', category: 'periodistas',
    handles: {
      instagram: 'mmagonzalocampos',  // 33K
      youtube:   '@GonzaloCamposMMA', // 17K
      twitter:   'campos_gon',
    },
    mediatico_auto: 50, narrativa_auto: 65,
    // Host de Generación MMA (Radio Marca + podcast). Director de DWT Fighting.
    // El periodista de MMA en España con mayor presencia en radio y podcast.
    // Colabora con Eurosport y Marca. Emisión diaria de lunes a jueves.
  },
  {
    id: 'doberdan-mma',
    name: 'Doberdan', sport: 'ufc', category: 'creadores',
    handles: {
      instagram: 'eldoberdan13',
      tiktok:    '@el_doberdan',
      twitter:   'harakiri_y',
    },
    mediatico_auto: 55, narrativa_auto: 60,
    // Creador de contenido MMA nativo digital. Streams en Twitch (doberdan13).
    // Colabora con Jaula Magazine. Referente del MMA en formato streaming para
    // audiencia joven española. Perfil creator puro (no periodista tradicional).
  },
  {
    id: 'irati-prat-mma',
    name: 'Irati Prat', sport: 'ufc', category: 'periodistas',
    handles: {
      twitter:   'IratiPratSC',  // 37.5K
      instagram: 'irati_21',     // 2.6K
    },
    mediatico_auto: 48, narrativa_auto: 58,
    // Periodista de MARCA y DAZN especializada en MMA. Colabora con Jaula Magazine.
    // Una de las pocas periodistas especializadas en MMA en España con presencia
    // en medios nacionales. Voz informativa del sector en España.
  },
  {
    id: 'fabricio-werdum-content',
    name: 'Fabricio Werdum', sport: 'ufc', category: 'creadores',
    handles: {
      instagram: 'werdum',         // 2M
      twitter:   'FabricioWerdum',
      youtube:   '@FabricioWerdum',
    },
    mediatico_auto: 82, narrativa_auto: 78,
    // Ex-campeón mundial UFC peso pesado (2015-2016). Radicado en España.
    // Analista en transmisiones PPV de UFC en español (ESPN). Canal YouTube propio.
    // El ex-peleador hispanohablante más mediático que actualmente hace contenido.
  },
  {
    id: 'alexa-grasso-content',
    name: 'Alexa Grasso', sport: 'ufc', category: 'creadores',
    handles: {
      instagram: 'alexa_grasso',   // 2M
      twitter:   'Alexa_Grasso',
      tiktok:    '@alexa_grasso',
    },
    mediatico_auto: 82, narrativa_auto: 80,
    // Ex-campeona UFC peso mosca femenino (2023-2024). Luchadora mexicana más seguida.
    // 2M en Instagram. La atleta hispana activa de UFC con más audiencia social propia.
    // Sus peleas vs. Shevchenko fueron los eventos de MMA más vistos en LATAM.
  },
  {
    id: 'yair-rodriguez-content',
    name: 'Yair Rodríguez', sport: 'ufc', category: 'creadores',
    handles: {
      instagram: 'panteraufc',   // 740K
      twitter:   'panteraufc',
    },
    mediatico_auto: 72, narrativa_auto: 75,
    // "El Pantera" — ex-campeón interino UFC pluma. El featherweight mexicano
    // con más seguidores (740K IG). Su KO de codo a Frankie Edgar es viral perenne.
    // Activo y relevante para la narrativa del MMA mexicano.
  },

  // ══════════════════════════════════════════════════════════════════
  // UFC / MMA — MEDIOS DIGITALES
  // ══════════════════════════════════════════════════════════════════

  {
    id: 'espn-knockout-digital',
    name: 'ESPN Knockout', sport: 'ufc', category: 'periodistas',
    handles: {
      instagram: 'espnknockout',   // 861K
      youtube:   '@espnknockout',
      twitter:   'ESPNKnockOut',
    },
    mediatico_auto: 82, narrativa_auto: 72,
    // Programa digital y TV de UFC y boxeo de ESPN Latinoamérica.
    // 861K IG. El medio con mayor audiencia latinoamericana de MMA/boxeo.
    // Narra todos los PPVs de UFC para LATAM. Home de Reyno, Hernández, Bermúdez.
  },
  {
    id: 'jaula-magazine',
    name: 'Jaula Magazine', sport: 'ufc', category: 'creadores',
    handles: {
      instagram: 'jaulamagazine',
      youtube:   '@jaulamagazine',
      tiktok:    '@jaulamagazine',
      twitter:   'JaulaMagazine',
    },
    mediatico_auto: 52, narrativa_auto: 62,
    // Medio exclusivamente dedicado a MMA en España. Enfoque periodístico de calidad.
    // Podcast "Eye Poke" y "MMA: Más allá de la Jaula". Plataforma multicanal.
    // Colaboradores: Doberdan, Irati Prat. La referencia editorial MMA independiente en ES.
  },
  {
    id: 'combate-global-mx',
    name: 'Combate Global', sport: 'ufc', category: 'creadores',
    handles: {
      instagram: 'combateglobal',  // 172K
      youtube:   '@CombateGlobal',
      twitter:   'CombateGlobal',
      tiktok:    '@combateglobal',
    },
    mediatico_auto: 65, narrativa_auto: 60,
    // Primera franquicia de MMA diseñada específicamente para el mercado hispano.
    // Desde 2025 emite todos sus eventos en vivo y gratis en YouTube globalmente.
    // Top 5 países: EE.UU., México, Chile, Argentina, Ecuador. +24% watch time en 2024.
  },
  {
    id: 'mma-es-portal',
    name: 'MMA.es', sport: 'ufc', category: 'periodistas',
    handles: {
      twitter:   'mmaes',
      instagram: 'mma.es',
      youtube:   '@mmaes',
    },
    mediatico_auto: 45, narrativa_auto: 55,
    // Portal web de referencia en España para resultados, rankings y noticias de MMA.
    // Posicionado como el sitio de MMA en español más consultado en España.
    // Contenido informativo y rankings de todos los deportes de combate.
  },

  // ══════════════════════════════════════════════════════════════════
  // WWE / WRESTLING — PERSONAS
  // ══════════════════════════════════════════════════════════════════

  {
    id: 'sebastian-martinez-wwe',
    name: 'Sebastián Martínez', sport: 'wwe', category: 'periodistas',
    handles: {
      twitter:   'solowrestling',
      instagram: 'solowrestling_oficial',
      youtube:   '@SoloWrestling',
    },
    mediatico_auto: 62, narrativa_auto: 72,
    // Fundador y director de SoloWrestling.com (desde 2004, 20+ años).
    // Fue comentarista de WWE en Antena 3, Gol TV y Netflix España.
    // La persona que más años lleva cubriendo wrestling en español en Europa.
  },
  {
    id: 'rolsogames-wwe',
    name: 'Rolso Games', sport: 'wwe', category: 'creadores_wwe',
    handles: {
      tiktok:    '@rolsogamesoficial',  // 122K
      youtube:   '@Rolsogames',
      instagram: 'rolsogamesoficial',
    },
    mediatico_auto: 55, narrativa_auto: 50,
    // YouTuber y tiktoker de wrestling + videojuegos WWE (122K TikTok).
    // Colabora con Planeta Wrestling (WrestleMania 39). Perfil gaming + wrestling.
    // Representa la nueva audiencia hispana de wrestling que entró por los juegos.
  },
  {
    id: 'stephanie-vaquer-wwe',
    name: 'Stephanie Vaquer', sport: 'wwe', category: 'creadores_wwe',
    handles: {
      instagram: 'stephanie.vaquer',  // 2M
      tiktok:    '@stephanievaquer',
      twitter:   'StephanieVaquer',
    },
    mediatico_auto: 85, narrativa_auto: 80,
    // NXT Women's Champion. Primera luchadora en sostener simultáneamente el
    // NXT Women's Championship y NXT Women's North American Championship.
    // Chilena. La wrestler hispana con más seguidores propios en WWE actualmente (2M IG).
  },

  // ══════════════════════════════════════════════════════════════════
  // WWE / WRESTLING — MEDIOS DIGITALES
  // ══════════════════════════════════════════════════════════════════

  {
    id: 'mas-lucha-yt',
    name: 'Más Lucha', sport: 'wwe', category: 'creadores_wwe',
    handles: {
      youtube:   '@MasLucha',         // ~550K subs — el mayor canal independiente ES wrestling
      instagram: 'maslucha',
      twitter:   'maslucha',
      tiktok:    '@maslucha',
    },
    mediatico_auto: 78, narrativa_auto: 70,
    // El canal independiente de wrestling en español con más suscriptores en YouTube (~550K).
    // La empresa más grande de producción audiovisual de lucha libre en América Latina.
    // Alianza con Planeta Wrestling. Cubre WWE, AEW, AAA, CMLL, NJPW.
  },
  {
    id: 'solowrestling-es',
    name: 'SoloWrestling', sport: 'wwe', category: 'creadores_wwe',
    handles: {
      youtube:   '@SoloWrestling',
      twitter:   'solowrestling',
      instagram: 'solowrestling_oficial',
    },
    mediatico_auto: 65, narrativa_auto: 70,
    // El medio de wrestling en español más consolidado de España (desde 2004).
    // Podcast semanal gratuito + "SoloWrestling PRIME" de pago.
    // Sebastián Martínez fue narrador de WWE en Netflix España.
  },
  {
    id: 'wwe-espanol-oficial',
    name: 'WWE Español', sport: 'wwe', category: 'creadores_wwe',
    handles: {
      instagram: 'wweespanol',    // 3M
      youtube:   '@wweespanol',
      twitter:   'WWEespanol',
      tiktok:    '@wweespanol',
    },
    mediatico_auto: 90, narrativa_auto: 75,
    // Canal oficial de WWE para el mercado hispano.
    // 3M IG. Emite RAW y SmackDown gratis en YouTube para toda Sudamérica y Centroamérica.
    // El canal de wrestling en español con mayor audiencia. Benchmark del mercado.
  },
  {
    id: 'lucha-central-podcast',
    name: 'Lucha Central', sport: 'wwe', category: 'creadores_wwe',
    handles: {
      twitter:   'LuchaCentral',
      instagram: 'luchacentral',
      youtube:   '@LuchaCentral',
    },
    mediatico_auto: 55, narrativa_auto: 62,
    // Red de podcasts de lucha libre (Lucha Central Podcast Network).
    // Su programa semanal en español llegó a #1 en iTunes para wrestling en EE.UU.
    // Cubre WWE, AAA, CMLL, NJPW y todo el espectro de la lucha libre hispanohablante.
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

  const ufcPersonas = toInsert.filter(e => e.sport === 'ufc' && e.category !== 'creadores_wwe')
  const ufcMedias   = toInsert.filter(e => e.sport === 'ufc' && e.category === 'creadores_wwe')
  const wwePersonas = toInsert.filter(e => e.sport === 'wwe' && ['periodistas', 'creadores'].includes(e.category) && !e.category.includes('_wwe'))
  const wweMedias   = toInsert.filter(e => e.sport === 'wwe' && e.category === 'creadores_wwe')

  console.log(`\n  UFC Personas (${ufcPersonas.length}):`)
  ufcPersonas.forEach(e => console.log(`    + ${e.name.padEnd(28)} [${e.category}]`))
  // Mixed UFC medias (category: periodistas/creadores with sport ufc)
  const ufcMediasMixed = toInsert.filter(e => e.sport === 'ufc').filter(e => !ufcPersonas.includes(e))
  console.log(`\n  UFC Medios/Canales (${ufcMediasMixed.length}):`)
  ufcMediasMixed.forEach(e => console.log(`    + ${e.name.padEnd(28)} [${e.category}]`))
  console.log(`\n  WWE Personas (${wwePersonas.length}):`)
  wwePersonas.forEach(e => console.log(`    + ${e.name.padEnd(28)} [${e.category}]`))
  console.log(`\n  WWE Medios/Canales (${wweMedias.length}):`)
  wweMedias.forEach(e => console.log(`    + ${e.name.padEnd(28)} [${e.category}]`))

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
