#!/usr/bin/env node
// expand-contenidos-v10-nicho.mjs
// Creadores de NICHO hispanohablantes — fútbol, UFC/MMA y WWE.
// Canales pequeños/medianos con comunidades muy específicas y fieles.
//
// FÚTBOL (8):
//   Pedro El Ingeniero (big data fútbol, 185K YT, viral Shorts)
//   futvox Argentina (podcast fútbol argentino)
//   futvox Chile (podcast fútbol chileno)
//   Pasión MX (Liga MX podcast)
//   Gerynna Sotelo (fútbol femenino TikTok México)
//   CampeonasMX (Liga MX Femenil)
//   Vintage Football Stories (fútbol vintage YouTube)
//   Objetivo Analista (canal para analistas y entrenadores)
//
// UFC/MMA (4):
//   MMARC (TikTok 284K + YT 145K, colabora Eurosport)
//   Área de Combate ESPN (podcast oficial ESPN MMA/boxeo LATAM)
//   Jiu-Jitsu en Español (BJJ en español, monopolio de nicho)
//   La Zona de Combate (boxeo mexicano podcast)
//
// WWE/WRESTLING (5):
//   Último Hombre En Pie (UHEP) (1.400+ episodios, más prolífico ES)
//   TurnHeel Wrestling (dirt sheet español, 2º medio wrestling ES)
//   El Laberinto de Minotaurovk (análisis booking/storylines)
//   Lucha Jobbers (CMLL/AAA/NJPW en español, red Voices of Wrestling)
//   Desde los Territorios (historia territorios wrestling, Puerto Rico)
//
// Uso:
//   node scripts/expand-contenidos-v10-nicho.mjs
//   node scripts/expand-contenidos-v10-nicho.mjs --apply

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
  // FÚTBOL — NICHOS
  // ══════════════════════════════════════════════════════════════════

  {
    id: 'pedro-el-ingeniero',
    name: 'Pedro El Ingeniero', sport: 'futbol', category: 'creadores',
    handles: {
      youtube:   '@PedroElIngeniero',  // ~185K — creció 600% en un año
      tiktok:    '@pedroelIngeniero',
      twitter:   'pedrosaezarenas',
    },
    mediatico_auto: 60, narrativa_auto: 68,
    // Big data y estadísticas avanzadas aplicadas al fútbol.
    // Análisis de jugadas con IA y software propio. Shorts virales.
    // Colabora con Kings League. El referente del cruce ingeniería + fútbol en español.
    // Crecimiento 600% en un año. España (Andújar, Jaén).
  },
  {
    id: 'futvox-argentina',
    name: 'futvox Argentina', sport: 'futbol', category: 'creadores',
    handles: {
      spotify:   'futvox-argentina',
      instagram: 'futvoxargentina',
      twitter:   'futvoxargentina',
    },
    mediatico_auto: 45, narrativa_auto: 62,
    // Rama argentina de la red futvox — la mayor red de podcasts de fútbol LATAM.
    // Boca, River, Selección, mercado nacional. Conducido por Maxi Palma y Martín Reich.
    // Parte de la red fundada por Carlos Martínez. 2x semana.
  },
  {
    id: 'futvox-chile',
    name: 'futvox Chile', sport: 'futbol', category: 'creadores',
    handles: {
      spotify:   'futvox-chile',
      instagram: 'futvoxchile',
      twitter:   'futvoxchile',
    },
    mediatico_auto: 40, narrativa_auto: 58,
    // Rama chilena de la red futvox. Fútbol chileno y La Roja.
    // Conducido por Fernando Solabarrieta. 2x semana. Podcast de referencia del fútbol chileno.
  },
  {
    id: 'pasion-mx-futbol',
    name: 'Pasión MX', sport: 'futbol', category: 'creadores',
    handles: {
      spotify:   'pasion-mx',
      twitter:   'pasionmxpodcast',
      instagram: 'pasionmxpodcast',
    },
    mediatico_auto: 45, narrativa_auto: 60,
    // Podcast de Liga MX y fútbol mexicano. Entrevistas con ex jugadores y figuras.
    // Conducido por Luis Urbano y Danny Troy. Comunidad fiel de fans Liga MX.
    // Uno de los podcasts de referencia del fútbol mexicano.
  },
  {
    id: 'gerynna-sotelo',
    name: 'Gerynna Sotelo', sport: 'futbol', category: 'creadores',
    handles: {
      tiktok:    '@gerynnasotelo',
      youtube:   '@GerynnaSotelo',
      instagram: 'gerynnasotelo',
    },
    mediatico_auto: 48, narrativa_auto: 55,
    // Creadora mexicana de fútbol. Apodo "señora factos". Fútbol femenino + general.
    // Cubre estadios históricos (Bombonera, etc.), Copa de la Reina, fútbol internacional.
    // Mezcla análisis con humor. Aficionada Bayern y Pumas. Perfil femenino nativo TikTok.
  },
  {
    id: 'campeonas-mx',
    name: 'CampeonasMX', sport: 'futbol', category: 'creadores',
    handles: {
      spotify:   'campeonasmx',
      youtube:   '@campeonasmx',
      instagram: 'campeonasmx',
    },
    mediatico_auto: 38, narrativa_auto: 55,
    // El único podcast/canal dedicado específicamente a la Liga MX Femenil.
    // Historias de mujeres que rompen paradigmas en el deporte mexicano.
    // Crece con el boom del fútbol femenino en México.
  },
  {
    id: 'vintage-football-stories',
    name: 'Vintage Football Stories', sport: 'futbol', category: 'creadores',
    handles: {
      youtube:   '@VintageFootballStories92',
      instagram: 'vintagefootballstories',
    },
    mediatico_auto: 42, narrativa_auto: 65,
    // Fútbol vintage en español: jugadores icónicos, historias clásicas, Mundiales históricos.
    // Secciones: Football Tales, Glory Years, Major Tournaments, Pure Talent.
    // Formato narrativo bien estructurado. Diferente de Memorias de Fútbol por enfoque más internacional.
  },
  {
    id: 'objetivo-analista',
    name: 'Objetivo Analista', sport: 'futbol', category: 'creadores',
    handles: {
      youtube:   '@ObjetivoAnalista',
      twitter:   'ObjetivoAnalista',
      instagram: 'objetivoanalista',
    },
    mediatico_auto: 35, narrativa_auto: 62,
    // Canal para analistas y entrenadores de fútbol profesionales.
    // Explica xG, métricas Opta, metodología de análisis profesional.
    // El único canal en español que habla para entrenadores UEFA Pro, no para fans.
    // Alta autoridad en el segmento profesional. Blog objetivoanalista.com.
  },

  // ══════════════════════════════════════════════════════════════════
  // UFC / MMA / BOXEO — NICHOS
  // ══════════════════════════════════════════════════════════════════

  {
    id: 'mmarc-creator',
    name: 'MMARC', sport: 'ufc', category: 'creadores',
    handles: {
      tiktok:    '@marcmma',          // 284K seguidores / 20M likes
      youtube:   '@marcmma',          // ~145K suscriptores
      instagram: 'marcmma',
    },
    mediatico_auto: 68, narrativa_auto: 62,
    // El creador de MMA en español con mayor presencia en TikTok (284K, 20M likes).
    // 145K YouTube. Colaborador de Eurosport. Foco en luchadores hispanohablantes (Topuria, etc.).
    // Predicciones, análisis, actualidad. Crecimiento ligado al boom de Topuria. España.
  },
  {
    id: 'area-de-combate-espn',
    name: 'Área de Combate', sport: 'ufc', category: 'creadores',
    handles: {
      spotify:   'area-de-combate',
      instagram: 'areadecombateespn',
      twitter:   'areadecombate',
    },
    mediatico_auto: 58, narrativa_auto: 65,
    // Podcast oficial ESPN Digital para MMA y boxeo latinoamericano.
    // Carlos Contreras Legaspi (insider MMA ESPN México) + Christian Tetzpa (UFC Español).
    // El más profesional de los podcasts de MMA en español. Invitados de la UFC.
    // Respaldo institucional ESPN + formato íntimo de podcast.
  },
  {
    id: 'jiujitsu-en-espanol',
    name: 'Jiu-Jitsu en Español', sport: 'ufc', category: 'creadores',
    handles: {
      youtube:   '@JiuJitsuEnEspanol',
      instagram: 'jiujitsuenespa',
      twitter:   'jiujitsuenespa',
    },
    mediatico_auto: 35, narrativa_auto: 58,
    // El único canal de BJJ/grappling 100% en español.
    // Técnicas, highlights de eventos, entrevistas, noticias de BJJ.
    // Monopolio de facto en el nicho del grappling hispano.
    // Potencial enorme con el crecimiento de Gordon Ryan, ADCC, etc.
  },
  {
    id: 'la-zona-de-combate',
    name: 'La Zona de Combate', sport: 'ufc', category: 'creadores',
    handles: {
      spotify:   'la-zona-de-combate',
      instagram: 'lazonadecombate',
      twitter:   'lazonadecombate',
    },
    mediatico_auto: 42, narrativa_auto: 58,
    // Podcast de boxeo y MMA con entrevistas a protagonistas.
    // Iñaki Arzate y comentaristas especializados. Foco en el mercado mexicano del boxeo.
    // México es históricamente el mayor mercado mundial del boxeo — nicho clave.
  },

  // ══════════════════════════════════════════════════════════════════
  // WWE / WRESTLING — NICHOS
  // ══════════════════════════════════════════════════════════════════

  {
    id: 'uhep-wrestling',
    name: 'Último Hombre En Pie', sport: 'wwe', category: 'creadores_wwe',
    handles: {
      youtube:   '@UltimoHombreEnPie',
      spotify:   'uhep-wrestling',
      instagram: 'uhep_podcast',
      twitter:   'uhep_podcast',
    },
    mediatico_auto: 52, narrativa_auto: 72,
    // El podcast de wrestling más prolífico en español: 1.432+ episodios DIARIOS.
    // Alejandro Gómez (Barcelona). WWE, AEW, NJPW, TNA y más.
    // Modelo freemium: suscripción 1,49€/mes + Discord activo.
    // El creador individual de wrestling más constante y longevo en español.
  },
  {
    id: 'turnheel-wrestling',
    name: 'TurnHeel Wrestling', sport: 'wwe', category: 'creadores_wwe',
    handles: {
      twitter:   'TurnHeelW',
      instagram: 'turnheelwrestling',
      youtube:   '@TurnHeelWrestling',
    },
    mediatico_auto: 48, narrativa_auto: 68,
    // El único "dirt sheet" (rumores y bastidores) sistematizado en español.
    // 2º medio de wrestling más consultado en español (tras SoloWrestling y SuperLuchas).
    // Podcasts Stunner y Chokeslam. Web turnheelwrestling.com.
    // Cubre el hueco que en inglés llena Dave Meltzer / Sean Ross Sapp.
  },
  {
    id: 'laberinto-minotaurovk',
    name: 'El Laberinto de Minotaurovk', sport: 'wwe', category: 'creadores_wwe',
    handles: {
      spotify:   'el-laberinto-de-minotaurovk',
      instagram: 'minotaurovk',
      twitter:   'minotaurovk',
    },
    mediatico_auto: 35, narrativa_auto: 70,
    // El podcast más analítico del wrestling en español. 557+ episodios (2025).
    // Análisis de booking, storylines y condiciones laborales.
    // Cubre WWE, AEW, NJPW y especialmente la escena de lucha española.
    // Perspectiva crítica y académica. Audiencia culta y comprometida. España.
  },
  {
    id: 'lucha-jobbers',
    name: 'Lucha Jobbers', sport: 'wwe', category: 'creadores_wwe',
    handles: {
      spotify:   'lucha-jobbers',
      instagram: 'luchajobbers',
      twitter:   'LuchaJobbers',
    },
    mediatico_auto: 40, narrativa_auto: 65,
    // CMLL, AAA y NJPW como foco principal + WWE. Análisis en español.
    // El único podcast en español dentro de la red Voices of Wrestling (la más prestigiosa del wrestling anglosajón).
    // Puente entre el wrestling internacional y la audiencia hispanohablante. México/Internacional.
  },
  {
    id: 'desde-los-territorios',
    name: 'Desde los Territorios', sport: 'wwe', category: 'creadores_wwe',
    handles: {
      spotify:   'desde-los-territorios',
      instagram: 'desdelosTerritorios',
      twitter:   'desdelosTerritorios',
    },
    mediatico_auto: 32, narrativa_auto: 72,
    // Historia de los territorios de wrestling de los años 70-90.
    // WWF, NWA, territorios locales, WWC Puerto Rico. Episodio 82+ en 2024-2025.
    // 6.100+ seguidores Facebook. Puerto Rico. Luis Cuevas.
    // El único podcast en español dedicado íntegramente a la era dorada de los territorios.
    // Nicho absolutamente único para fans de wrestling histórico.
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

  console.log('\n  ⚽ Fútbol (nicho):')
  toInsert.filter(e => e.sport === 'futbol').forEach(e =>
    console.log(`    + ${e.name.padEnd(32)} [${e.category}]`))
  console.log('\n  🥊 UFC/MMA (nicho):')
  toInsert.filter(e => e.sport === 'ufc').forEach(e =>
    console.log(`    + ${e.name.padEnd(32)} [${e.category}]`))
  console.log('\n  🤼 WWE/Wrestling (nicho):')
  toInsert.filter(e => e.sport === 'wwe').forEach(e =>
    console.log(`    + ${e.name.padEnd(32)} [${e.category}]`))

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
  console.log('\nSiguiente: node scripts/expand-contenidos-v9.mjs --apply (si no se ha aplicado aún)')
}

main().catch(err => { console.error(err); process.exit(1) })
