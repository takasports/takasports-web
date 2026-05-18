#!/usr/bin/env node
// fix-youtube-handles-v2.mjs
// Segunda ronda de correcciones de handles YouTube detectadas con el ingest.
//
// Uso:
//   node scripts/fix-youtube-handles-v2.mjs           # DRY RUN
//   node scripts/fix-youtube-handles-v2.mjs --apply

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

// Formato: { id, key, old, fix }
// fix = null → elimina la clave (canal no encontrado/incorrecto)
const FIXES = [
  // Confirmados con YouTube Data API v3:
  { id: 'cristiano-ronaldo',  key: 'youtube', old: '@CR7',                  fix: '@cristiano'      }, // 78.8M
  { id: 'el-chiringuito',     key: 'youtube', old: '@ElChiringuitoOficial', fix: '@elchiringuitoTV'}, // 2.14M
  { id: 'vinicius-jr',        key: 'youtube', old: '@ViniciusJr',           fix: '@vinijr'         }, // 2.42M
  { id: 'adri-contreras',     key: 'youtube', old: '@adricontreras4',       fix: '@adricontreras'  }, // 910K
  { id: 'dazn-espana',        key: 'youtube', old: '@DAZNEspana',           fix: '@DAZNes'         }, // 1.41M
  { id: 'good-good-golf',     key: 'youtube', old: '@GoodGoodGolf',         fix: '@GoodGood'       }, // 2.09M

  // No encontrados — YouTube no es su plataforma principal.
  // Se elimina el handle para que no interfiera; su alcance vendrá de Instagram/TikTok.
  { id: 'gento',              key: 'youtube', old: '@GentoyFutbol',         fix: null },
  { id: 'javi-ruiz',          key: 'youtube', old: '@JaviRuizFutbol',       fix: null },
  { id: 'la-tribu-de-fremen', key: 'youtube', old: '@LaTribuDeFremen',      fix: null },
  { id: 'nfl-espanol',        key: 'youtube', old: '@NFLenEspanol',         fix: null },
  { id: 'zona-roja-nfl',      key: 'youtube', old: '@ZonaRojaNFL',          fix: null },
  { id: 'la-nfl-de-lili',     key: 'youtube', old: '@LaNFLdeLili',          fix: null },
  { id: 'cycling-weekly-es',  key: 'youtube', old: '@CyclingEspanol',       fix: null },
  { id: 'mma-fighting-es',    key: 'youtube', old: '@MMAFightingES',        fix: null },
  { id: 'futbol-femenino-tv', key: 'youtube', old: '@FutbolFemeninoTV',     fix: null },
  { id: 'burrito-martinez',   key: 'youtube', old: '@BurritoMartinez',      fix: null },
  { id: 'la-pizarra-juanma',  key: 'youtube', old: '@LaPizarradeJuanma',   fix: null },
  { id: 'fernando-alonso',    key: 'youtube', old: '@FernandoAlonso',       fix: null },
  { id: 'israel-adesanya',    key: 'youtube', old: '@IzzyAdesanya',         fix: null },
  { id: 'world-padel-tour',   key: 'youtube', old: '@WorldPadelTour',       fix: null },
  { id: 'mlb-espanol',        key: 'youtube', old: '@MLBenEspanol',         fix: null },
  { id: 'nfl-rush-espana',    key: 'youtube', old: '@NFLRushEspana',        fix: null },
  { id: 'ampeter',            key: 'youtube', old: '@Ampeter',              fix: null },
  { id: 'dani-de-la-torre',   key: 'youtube', old: '@DanidelaTorreNFL',     fix: null },
  { id: 'uefa-espanol',       key: 'youtube', old: '@UEFAenespanol',        fix: null },
  { id: 'telemundo-deportes', key: 'youtube', old: '@TelemundoDeportes',    fix: null },
  { id: 'univision-deportes', key: 'youtube', old: '@UnivisionDeportes',    fix: null },
  { id: 'misterv',            key: 'youtube', old: '@MisterVFutbol',        fix: null },
  { id: 'as-diario',          key: 'youtube', old: '@AS_Diario',            fix: null },
  { id: 'sport-diario',       key: 'youtube', old: '@sport_es',             fix: null },
  { id: 'canales-de-juego',   key: 'youtube', old: '@CanalesdeJuego',       fix: null },
  { id: 'imagen-del-futbol',  key: 'youtube', old: '@ImagendelFutbol',      fix: null },
  { id: 'tennis-world-es',    key: 'youtube', old: '@TennisWorldES',        fix: null },
  { id: 'futbolsites',        key: 'youtube', old: '@FutbolSites',          fix: null },
  { id: 'seleccion-mexico',   key: 'youtube', old: '@FMFporlamundo',        fix: null },
  { id: 'cronuts',            key: 'youtube', old: '@CronutsDeLaInformacion', fix: null },
  { id: 'ciclismo-total',     key: 'youtube', old: '@CiclismoTotal',        fix: null },
  { id: 'record-mx',          key: 'youtube', old: '@diariorecord',         fix: null },
  { id: 'cadiz-cf',           key: 'youtube', old: '@CadizcfOfficial',      fix: null },
  { id: 'baloncesto-espana',  key: 'youtube', old: '@BaloncestoEspana',     fix: null },
  { id: 'spartan-boxing',     key: 'youtube', old: '@SpartanBoxingTV',      fix: null },
  { id: 'iturralde-gonzalez', key: 'youtube', old: '@IturraldeyGonzalez',   fix: null },
  { id: 'luis-garcia-doctor', key: 'youtube', old: '@luisgarcia4',          fix: null },
  { id: 'win-sports',         key: 'youtube', old: '@winsports',            fix: null },
  { id: 'futbol-picante',     key: 'youtube', old: '@FutbolPicante',        fix: null },
  { id: 'fichajes-net',       key: 'youtube', old: '@fichajesnet',          fix: null },
  { id: 'sportyou',           key: 'youtube', old: '@sportyou',             fix: null },
  { id: 'estadio-deportivo',  key: 'youtube', old: '@EstadioDeportivo',     fix: null },
  { id: 'carlos-martinez-vamos', key: 'youtube', old: '@Vamos',             fix: null },
  { id: 'christian-martinoli', key: 'youtube', old: '@christianmartinoli', fix: null },
  { id: 'cristobal-soria',    key: 'youtube', old: '@CristobalSoria',       fix: null },
  { id: 'futbol-con-nacho',   key: 'youtube', old: '@FutbolConNacho',       fix: null },
  { id: 'juanma-castano',     key: 'youtube', old: '@ElPartidazo',          fix: null },
  { id: 'farsantes-con-gloria', key: 'youtube', old: '@FarsantesConGloria', fix: null },
  { id: 'jota-jordi',         key: 'youtube', old: '@JotaJordi',            fix: null },
  { id: 'la-media-vuelta',    key: 'youtube', old: '@LaMediaVuelta',        fix: null },
  { id: 'relevo',             key: 'youtube', old: '@Relevo',               fix: null },
]

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}\n`)

  // Fetch all entries by name to get their real IDs (since some IDs may differ)
  const allIds = FIXES.map(f => f.id)

  // Also do a lookup by youtube handle to find entries regardless of id
  const { data: entries, error } = await sb
    .from('ranking_entries')
    .select('id, name, handles')
    .in('category', ['creadores', 'periodistas', 'creadores_wwe'])
    .not('handles', 'is', null)
  if (error) throw error

  // Build a map: youtube_handle → entry
  const byYT = {}
  for (const e of entries) {
    if (e.handles?.youtube) byYT[e.handles.youtube] = e
  }

  let fixed = 0, skipped = 0
  for (const fix of FIXES) {
    // Find entry by old youtube handle (more reliable than id since ids may differ)
    const entry = byYT[fix.old]
    if (!entry) {
      console.log(`  SKIP  (not found by youtube="${fix.old}")`)
      skipped++
      continue
    }

    const newHandles = { ...entry.handles }
    if (fix.fix === null) {
      delete newHandles[fix.key]
    } else {
      newHandles[fix.key] = fix.fix
    }

    const arrow = fix.fix === null ? '→ (removed)' : `→ ${fix.fix}`
    console.log(`  ${entry.name.padEnd(28)} ${fix.key}: "${fix.old}" ${arrow}`)

    if (APPLY) {
      const { error: err } = await sb
        .from('ranking_entries')
        .update({ handles: newHandles })
        .eq('id', entry.id)
      if (err) { console.error(`    FAIL: ${err.message}`); continue }
    }
    fixed++
  }

  console.log(`\n${fixed} entries ${APPLY ? 'patched' : 'would be patched'}, ${skipped} skipped`)
  if (!APPLY) console.log('DRY RUN — pasa --apply para escribir.')
}

main().catch(err => { console.error(err); process.exit(1) })
