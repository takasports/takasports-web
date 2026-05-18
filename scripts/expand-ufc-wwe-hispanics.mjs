#!/usr/bin/env node
// expand-ufc-wwe-hispanics.mjs
// Top 10 + 3 hype de creadores y periodistas HISPANOHABLANTES de UFC y WWE.
//
// UFC Hispanic (13):
//   Comentaristas oficiales: Víctor Dávila, Gastón "Tonga" Reyno, Andrés Bermúdez, Troy Santiago
//   Periodismo: Ivette Hernández, Danny Segura
//   Creadores: MMAdictos, Impacto MMA, Brandon Moreno (podcast), UFC Entre Asaltos
//   Hype: Full Blood MMA, Noticias de MMA, Zona Combate
//
// WWE Hispanic (13):
//   Leyendas/narración: Carlos Cabrera, Hugo Savinovich, Marcelo Rodríguez, Jerry Soto
//   Netflix/nuevos narradores: Miguel Pérez, Álvaro Carrera
//   Medios digitales: Superluchas, Planeta Wrestling
//   YouTubers: Falbak, Mr. Lucha
//   Hype: SrAlexGomez, Lucha & Wrestling MX, Fernando Costilla
//
// Uso:
//   node scripts/expand-ufc-wwe-hispanics.mjs
//   node scripts/expand-ufc-wwe-hispanics.mjs --apply

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
  // ══════════════════════════════════════════════════════════════
  // UFC — HISPANOHABLANTES
  // ══════════════════════════════════════════════════════════════

  // ── Narradores/comentaristas oficiales ───────────────────────
  {
    id: 'victor-davila-ufc',
    name: 'Víctor Dávila', sport: 'ufc', category: 'periodistas',
    handles: {
      twitter: 'mastervic10',
      instagram: 'victordavilaufc',
    },
    mediatico_auto: 60, narrativa_auto: 70,
    // Narrador oficial de UFC en español desde 2007 (17+ años). CEO de MMAMexicoMX.
    // Encabeza el equipo oficial de Paramount+ en español.
  },
  {
    id: 'gaston-tonga-reyno',
    name: 'Gastón Reyno', sport: 'ufc', category: 'periodistas',
    handles: {
      twitter: 'gastonreyno',
      instagram: 'gastonreyno',    // 330K
      tiktok: '@gastonreyno',      // 174K
    },
    mediatico_auto: 72, narrativa_auto: 68,
    // "El Tonga" — cara visible de UFC LATAM en ESPN Knockout durante una década.
    // 330K IG, 174K TikTok. El periodista de MMA más conocido en LATAM.
  },
  {
    id: 'andres-bermudez-ufc',
    name: 'Andrés Bermúdez', sport: 'ufc', category: 'periodistas',
    handles: {
      twitter: 'andres_bermudez',
      instagram: 'berma80',        // 48K
    },
    mediatico_auto: 55, narrativa_auto: 60,
    // Narrador venezolano de UFC y boxeo en ESPN Knockout LATAM.
    // Junto a su hermano Renato formó el dúo más escuchado de la era ESPN.
  },
  {
    id: 'troy-santiago-ufc',
    name: 'Troy Santiago', sport: 'ufc', category: 'periodistas',
    handles: {
      twitter: 'troysantiago',
    },
    mediatico_auto: 50, narrativa_auto: 62,
    // Analista/color de UFC en español desde 2007. Tándem oficial con Víctor Dávila.
    // Continúa en Paramount+ como parte del equipo oficial hispanohablante.
  },

  // ── Periodistas / Hosts ────────────────────────────────────────
  {
    id: 'ivette-hernandez-ufc',
    name: 'Ivette Hernández', sport: 'ufc', category: 'periodistas',
    handles: {
      twitter: 'ivette_hdez',
      instagram: 'ivette_hdez',    // 226K — la más seguida de MMA hispano
    },
    mediatico_auto: 70, narrativa_auto: 60,
    // Periodista y conductora de ringside de ESPN Knockout.
    // 226K IG — la periodista de MMA hispanohablante con mayor audiencia social.
  },
  {
    id: 'danny-segura-mma',
    name: 'Danny Segura', sport: 'ufc', category: 'periodistas',
    handles: {
      twitter: 'dannyseguratv',
      instagram: 'dannyseguratv',  // 7K
      youtube: '@HablemosMMA',
    },
    mediatico_auto: 48, narrativa_auto: 55,
    // Periodista colombiano en MMA Junkie / USA Today Sports.
    // Único hispano con posición estable en medio anglosajón de referencia de MMA.
    // Host de "Hablemos MMA" en español.
  },

  // ── Creadores / Canales ───────────────────────────────────────
  {
    id: 'mmadictos',
    name: 'MMAdictos', sport: 'ufc', category: 'creadores',
    handles: {
      twitter: 'MMAdictos',
      instagram: 'mmadictos',
      youtube: '@MMAdictos',
    },
    mediatico_auto: 55, narrativa_auto: 65,
    // "El programa de MMA en español más longevo del mundo" (España).
    // Más de una década en activo. Referencia de la comunidad hispana de MMA en Europa.
  },
  {
    id: 'impacto-mma',
    name: 'Impacto MMA', sport: 'ufc', category: 'creadores',
    handles: {
      youtube: '@ImpactoMMA',
      instagram: 'impactomma',
      twitter: 'ImpactoMMA',
      tiktok: '@impactomma',
    },
    mediatico_auto: 55, narrativa_auto: 50,
    // Canal YouTube de referencia de MMA en español. Noticias, análisis y curiosidades UFC.
    // Uno de los canales más veteranos del género en castellano.
  },
  {
    id: 'brandon-moreno-podcast',
    name: 'Brandon Moreno', sport: 'ufc', category: 'creadores',
    handles: {
      instagram: 'theassassinbaby', // ~600K
      twitter: 'theassassinbaby',
      tiktok: '@theassassinbaby',
    },
    mediatico_auto: 80, narrativa_auto: 78,
    // Campeón ex-mosca de UFC y cara del MMA mexicano.
    // Host del podcast oficial "UFC Entre Asaltos" — el único podcast oficial de UFC en español.
    // Figura más influyente del MMA hispano a nivel global.
  },
  {
    id: 'ufc-entre-asaltos',
    name: 'UFC Entre Asaltos', sport: 'ufc', category: 'creadores',
    handles: {
      instagram: 'ufcentreasaltos',
      twitter: 'UFCEntreasaltos',
      youtube: '@UFCEntreAsaltos',
    },
    mediatico_auto: 60, narrativa_auto: 58,
    // El único podcast oficial de UFC en español. Protagonizado por Brandon Moreno.
    // Producción de UFC; cobertura semanal de noticias, análisis y entrevistas.
  },

  // ── Hype — emergentes con momentum ───────────────────────────
  {
    id: 'fullblood-mma',
    name: 'Full Blood MMA', sport: 'ufc', category: 'creadores',
    handles: {
      youtube: '@FullBloodMMA',
      instagram: 'fullbloodmma',
      twitter: 'FullBloodMMA',
    },
    mediatico_auto: 42, narrativa_auto: 50,
    // Canal de predicciones y análisis estadístico MMA en español.
    // 64% de precisión predictiva en 2025. Nueva ola de contenido analítico serio.
  },
  {
    id: 'zona-combate-es',
    name: 'Zona Combate', sport: 'ufc', category: 'creadores',
    handles: {
      youtube: '@ZonaCombate',
      instagram: 'zonacombate',
      twitter: 'ZonaCombate',
      tiktok: '@zonacombate',
    },
    mediatico_auto: 45, narrativa_auto: 48,
    // Portal digital español especializado en MMA, boxeo y deportes de combate.
    // Crecimiento digital sostenido. Referencia de las artes marciales en España.
  },
  {
    id: 'mma-mexico-oficial',
    name: 'MMA México', sport: 'ufc', category: 'creadores',
    handles: {
      instagram: 'mmamexicomx',
      twitter: 'mmamexicomx',
      tiktok: '@mmamexicomx',
      youtube: '@MMAMexicoTV',
    },
    mediatico_auto: 48, narrativa_auto: 50,
    // El medio digital mexicano de referencia para MMA y UFC.
    // Canal de Víctor Dávila. Foco en peleadores mexicanos y LATAM.
    // Hype máximo con la consolidación del mercado MX como #1 fuera de EE.UU.
  },

  // ══════════════════════════════════════════════════════════════
  // WWE — HISPANOHABLANTES
  // ══════════════════════════════════════════════════════════════

  // ── Leyendas históricas ───────────────────────────────────────
  {
    id: 'carlos-cabrera-wwe',
    name: 'Carlos Cabrera', sport: 'wwe', category: 'periodistas',
    handles: {
      twitter: 'lavozcabrera',
      instagram: 'la_voz_cabrera',   // 15K
    },
    mediatico_auto: 72, narrativa_auto: 92,
    // "La Voz" — 29 años (1989-2022) como narrador oficial de WWE en LATAM.
    // Creador de frases históricas junto a Savinovich. En 2024 firmó con AEW.
    // El comentarista de wrestling en español más querido de la historia.
  },
  {
    id: 'hugo-savinovich',
    name: 'Hugo Savinovich', sport: 'wwe', category: 'periodistas',
    handles: {
      twitter: 'hugosavinovich',
      instagram: 'hugosavinovich',   // 27K
    },
    mediatico_auto: 65, narrativa_auto: 88,
    // La otra mitad del dúo legendario de WWE. Finales de los 90 hasta 2011.
    // Emblema del wrestling hispano. "¡Atángana!" — la frase más icónica del género.
  },

  // ── Narradores oficiales actuales ─────────────────────────────
  {
    id: 'marcelo-rodriguez-wwe',
    name: 'Marcelo Rodríguez', sport: 'wwe', category: 'periodistas',
    handles: {
      twitter: 'MarceloAtWWE',
      instagram: 'marceloatwwe',     // 111K — más seguido de los narradores WWE actuales
    },
    mediatico_auto: 72, narrativa_auto: 70,
    // Narrador principal de WWE en español desde 1999 (RAW, SmackDown, NXT, todos los PLEs).
    // Actor y músico. Voz oficial en 20+ países hispanohablantes semanalmente.
  },
  {
    id: 'jerry-soto-wwe',
    name: 'Jerry Soto', sport: 'wwe', category: 'periodistas',
    handles: {
      twitter: 'JerrySotoWWE',
      instagram: 'jerrysotonarra',   // 13K
    },
    mediatico_auto: 50, narrativa_auto: 60,
    // Analista/color oficial de WWE en español. Tándem con Marcelo Rodríguez desde 2011.
    // Puertorriqueño. Actor y músico. Regresó tras el COVID en 2022.
  },

  // ── Narradores Netflix (nueva era) ────────────────────────────
  {
    id: 'miguel-perez-wwe',
    name: 'Miguel Pérez', sport: 'wwe', category: 'periodistas',
    handles: {
      twitter: 'King_Migui',
      instagram: 'miguelperezwwe',
    },
    mediatico_auto: 62, narrativa_auto: 68,
    // Co-fundador de Planeta Wrestling. Elegido narrador oficial de WWE en Netflix para España.
    // Debuta en Crown Jewel 2024, luego RAW en Netflix (ene 2025). Figura en ascenso.
  },
  {
    id: 'alvaro-carrera-wwe',
    name: 'Álvaro Carrera', sport: 'wwe', category: 'periodistas',
    handles: {
      twitter: 'alvarocarrera_',
      instagram: 'alvarocarrera_',
    },
    mediatico_auto: 58, narrativa_auto: 65,
    // Periodista de Relevo y narrador de boxeo en DAZN. Elegido narrador de WWE en Netflix.
    // Tándem con Miguel Pérez desde Crown Jewel 2024 y RAW Netflix enero 2025.
  },

  // ── Medios digitales ──────────────────────────────────────────
  {
    id: 'superluchas-wwe',
    name: 'Superluchas', sport: 'wwe', category: 'creadores_wwe',
    handles: {
      youtube: '@superluchas',
      instagram: 'superluchas',
      twitter: 'superluchas',
      tiktok: '@superluchas',
    },
    mediatico_auto: 68, narrativa_auto: 75,
    // La publicación de wrestling en español más veterana del mundo (desde 1991, México).
    // Ernesto Ocampo como director editorial. 7M+ páginas vistas/mes. 12 países.
    // Cubre WWE, AEW, CMLL, AAA y artes marciales.
  },
  {
    id: 'planeta-wrestling-es',
    name: 'Planeta Wrestling', sport: 'wwe', category: 'creadores_wwe',
    handles: {
      youtube: '@PlanetaWrestling',
      instagram: 'planetawrestling',
      twitter: 'planetawrestling',
    },
    mediatico_auto: 62, narrativa_auto: 68,
    // El mayor medio digital de wrestling en español de Europa. Fundado 2013, boom 2017.
    // Podcast entre los más escuchados del género en castellano.
    // Co-fundadores: Miguel Pérez (ahora en Netflix) y Carlos Gascó.
  },

  // ── Creadores / YouTubers ─────────────────────────────────────
  {
    id: 'falbak-wwe',
    name: 'Falbak', sport: 'wwe', category: 'creadores_wwe',
    handles: {
      youtube: '@Falbak',            // 638K subs, 295M visualizaciones
      twitter: 'Falbak_',
      instagram: 'falbak_',
    },
    mediatico_auto: 75, narrativa_auto: 72,
    // El youtuber de wrestling en español más grande (638K subs, 295M views).
    // Canal activo desde 2016. Análisis, retro reviews y Behind the Kayfabe.
    // Referencia absoluta del wrestling hispano en YouTube. #FreeFalbak movimiento.
  },

  // ── Hype — emergentes ─────────────────────────────────────────
  {
    id: 'sralexgomez-wwe',
    name: 'SrAlexGomez', sport: 'wwe', category: 'creadores_wwe',
    handles: {
      tiktok: '@sralexgomez',
      instagram: 'sralexgomez',
    },
    mediatico_auto: 40, narrativa_auto: 45,
    // Creador emergente español de wrestling en TikTok. Nueva ola post-Netflix.
    // Contenido de debate y análisis sobre WWE en formato corto. Audiencia joven.
  },
  {
    id: 'lucha-libre-mx-wwe',
    name: 'Lucha Libre México', sport: 'wwe', category: 'creadores_wwe',
    handles: {
      youtube: '@LuchaLibreMexico',
      instagram: 'luchalibre_mx',
      twitter: 'luchalibre_mx',
      tiktok: '@luchalibremx',
    },
    mediatico_auto: 52, narrativa_auto: 55,
    // Canal de referencia sobre la convergencia WWE-AAA post-adquisición (2025).
    // El hype de la adquisición de AAA por WWE dispara el interés del mercado mexicano.
  },
  {
    id: 'fernando-costilla-wwe',
    name: 'Fernando Costilla', sport: 'wwe', category: 'periodistas',
    handles: {
      twitter: 'fernandocostilla',
      instagram: 'fernandocostilla',
      youtube: '@FernandoCostilla',
    },
    mediatico_auto: 58, narrativa_auto: 65,
    // Narrador histórico de WWE en español para España (muchos años). Quedó fuera del proceso
    // de selección de Netflix pero sigue siendo referencia del wrestling hispano europeo.
    // Hype: reacción de su comunidad tras no ser elegido para Netflix generó mucha visibilidad.
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

  // Mostrar por deporte
  const ufcNew  = toInsert.filter(e => e.sport === 'ufc')
  const wweNew  = toInsert.filter(e => e.sport === 'wwe')
  console.log(`\n  UFC (${ufcNew.length}):`)
  ufcNew.forEach(e => console.log(`    + ${e.name.padEnd(28)} [${e.category}]`))
  console.log(`\n  WWE (${wweNew.length}):`)
  wweNew.forEach(e => console.log(`    + ${e.name.padEnd(28)} [${e.category}]`))

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
  console.log('\nSiguiente paso: node scripts/ingest-creator-social.mjs --apply')
}

main().catch(err => { console.error(err); process.exit(1) })
