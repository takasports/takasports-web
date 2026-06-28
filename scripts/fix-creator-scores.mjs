#!/usr/bin/env node
// fix-creator-scores.mjs
//
// Tres correcciones en la categoría "creadores":
//
//  1. DESACTIVA deportistas que estaban en category=creadores con scores
//     de atleta (rend=100 porque son campeones, no porque creen contenido).
//
//  2. ACTUALIZA los factores de los creadores activos con valores correctos:
//     - mediatico_auto  → alcance real (followers / subs × plataforma)
//     - rendimiento_auto → calidad y frecuencia del contenido
//     - narrativa_auto  → momento editorial (crecimiento / trending)
//     - contexto_auto   → profundidad temática del deporte
//
//  3. RECALCULA score_auto con la nueva fórmula para creadores:
//     mediático×0.50 + rendimiento×0.30 + narrativa×0.15 + contexto×0.05
//
// Uso:
//   node scripts/fix-creator-scores.mjs          # DRY RUN
//   node scripts/fix-creator-scores.mjs --apply

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

// ── 1. Deportistas a desactivar de category=creadores ──────────────────────
// Son atletas que el sistema metió como "creadores" usando sus scores deportivos.
// Ya existen en jugadores/tenis/formula1/etc con sus scores correctos.
const ATHLETES_IN_CREADORES = new Set([
  // Atletismo
  'yulimar-rojas', 'asier-martinez', 'david-gomez-atletismo',
  // Baloncesto — jugadores activos/retirados
  'manu-ginobili', 'marc-gasol-content', 'pau-gasol-content',
  'lebron-james', 'santi-aldama', 'ricky-rubio', 'wembanyama-content',
  'giannis-antetokounmpo', 'stephcurry-content', 'luka-doncic', 'nikola-jokic',
  // Béisbol — medios institucionales sin valor editorial real
  'beisbolplay', 'diamante23', 'mlb-en-espanol',
  // Boxeo — atletas (canelo como boxeador, no como creador)
  'canelo-alvarez', 'jake-paul-box', 'saul-ramos-box', 'spartan-boxing',
  'gervonta-davis', 'ryan-garcia', 'david-benavidez', 'canelo-team',
  // Ciclismo — corredores
  'primoz-roglic', 'nairo-quintana', 'alejandro-valverde', 'remco-evenepoel',
  'jonas-vingegaard', 'marta-cavalli', 'pogacar-content',
  // Fórmula 1 — pilotos
  'fernando-alonso-content', 'lando-norris-f1', 'carlos-sainz-f1',
  'oscar-piastri-f1', 'george-russell-f1', 'max-verstappen', 'charles-leclerc',
  // Fútbol americano — medios institucionales sin calidad editorial
  'nfl-rush-esp', 'zona-roja-nfl',
  // Golf — golfistas
  'jon-rahm', 'carlota-ciganda', 'sergio-garcia',
  // MotoGP — pilotos
  'marc-marquez-moto', 'alex-marquez-moto', 'jorge-martin-moto',
  'fabio-quartararo', 'aleix-espargaro', 'pecco-bagnaia',
  'valentino-rossi-content', 'maverick-vinales', 'pedro-acosta-moto',
  'jorgelorenzo-moto',
  // Pádel — jugadores
  'sanyo-gutierrez', 'juan-lebron', 'mapi-alayeto', 'arturo-coello',
  'majo-alayeto', 'coki-nieto', 'agustin-tapia-padel', 'martin-di-nenno',
  'paquitonavarro', 'alegalan',
  // Tenis — tenistas
  'rafa-nadal-content', 'paula-badosa', 'carlos-alcaraz-content',
  'alejandro-davidovich', 'aryna-sabalenka', 'novak-djokovic',
  'roberto-bautista', 'jannik-sinner', 'garbine-muguruza',
])

// ── 2. Scores editoriales por creador ─────────────────────────────────────
// Formato: { med, rend, narr, ctx }
//   med  = mediático   → alcance/followers (dominante para creadores, peso 0.50)
//   rend = rendimiento → calidad/frecuencia de contenido (peso 0.30)
//   narr = narrativa   → momento editorial / trending (peso 0.15)
//   ctx  = contexto    → profundidad temática (peso 0.05)
//
// Escala de referencia para mediático (followers totales cross-platform):
//   >5M  → 90+   |  2-5M → 82-88  |  1-2M → 76-82  |  500K-1M → 68-76
//   200-500K → 60-68  |  100-200K → 52-60  |  <100K → 40-52

const CREATOR_FACTORS = {
  // ── Fútbol 17 ──────────────────────────────────────────────────────────
  // med: followers cross-platform | rend: calidad contenido | narr: momentum | ctx: profundidad
  'iker-ruiz-futbol':     { med: 88, rend: 82, narr: 78, ctx: 68 }, // ~2.5M TikTok+IG+YT
  'lacobra-futbol':       { med: 82, rend: 78, narr: 74, ctx: 62 }, // ~1.5M
  'pedro-el-ingeniero':   { med: 64, rend: 70, narr: 88, ctx: 58 }, // ~500K pero crecimiento viral
  'alexperezpoza':        { med: 76, rend: 72, narr: 70, ctx: 72 }, // ~1M
  'rafaelescrig':         { med: 62, rend: 68, narr: 72, ctx: 84 }, // ~400K, ATP Creator Network
  'lamediainglesa':       { med: 70, rend: 72, narr: 66, ctx: 90 }, // ~700K, análisis táctico
  'rodrigofaez':          { med: 76, rend: 74, narr: 70, ctx: 74 }, // ~1M, periodista+creador
  'retrocalcioshirts':    { med: 62, rend: 62, narr: 66, ctx: 80 }, // ~400K, nicho vintage
  'paulferrerz':          { med: 82, rend: 78, narr: 72, ctx: 60 }, // ~1.5M TikTok
  'markitonavaja':        { med: 80, rend: 76, narr: 70, ctx: 62 }, // ~1.2M
  'david-suarez-creator': { med: 74, rend: 72, narr: 68, ctx: 72 }, // ~900K
  'futbolcontemo':        { med: 78, rend: 74, narr: 68, ctx: 65 }, // ~1M
  'lorena-escoz':         { med: 58, rend: 58, narr: 86, ctx: 60 }, // ~300K pero hype ascendente
  'javibridge':           { med: 80, rend: 76, narr: 70, ctx: 65 }, // ~1.2M
  'losdisplicentes':      { med: 65, rend: 70, narr: 65, ctx: 86 }, // ~500K, análisis profundo
  'nachohernaez':         { med: 60, rend: 62, narr: 62, ctx: 75 }, // ~350K
  'toto-bordieri':        { med: 54, rend: 60, narr: 58, ctx: 68 }, // ~250K

  // ── UFC 4 ─────────────────────────────────────────────────────────────
  'geniomma':             { med: 70, rend: 68, narr: 72, ctx: 78 }, // ~600K, referente MMA español
  'imperator-mma':        { med: 62, rend: 64, narr: 68, ctx: 75 }, // ~350K
  'greenvids-mma':        { med: 60, rend: 62, narr: 65, ctx: 72 }, // ~300K
  'guante-a-guante':      { med: 55, rend: 60, narr: 63, ctx: 70 }, // ~250K

  // ── WWE 13 ────────────────────────────────────────────────────────────
  'eduardo-bates-wwe':    { med: 74, rend: 72, narr: 72, ctx: 84 }, // ~800K
  'noahclub-wwe':         { med: 65, rend: 68, narr: 70, ctx: 82 }, // ~500K
  'falbak-wwe':           { med: 62, rend: 65, narr: 68, ctx: 80 }, // ~400K
  'diego-aranis-wwe':     { med: 62, rend: 64, narr: 68, ctx: 82 }, // ~400K
  'danidelasluchas':      { med: 58, rend: 62, narr: 65, ctx: 82 }, // ~300K
  'wwecucu':              { med: 54, rend: 60, narr: 62, ctx: 78 }, // ~250K
  'uke-wrestling':        { med: 50, rend: 58, narr: 60, ctx: 78 }, // ~200K
  'tioallende-wwe':       { med: 48, rend: 55, narr: 58, ctx: 76 }, // ~180K
  'rolsogames-wwe':       { med: 46, rend: 55, narr: 58, ctx: 74 }, // ~150K
  'luigi-wrestling':      { med: 46, rend: 52, narr: 56, ctx: 72 }, // ~150K
  'soyalekay':            { med: 45, rend: 50, narr: 56, ctx: 72 }, // ~150K
  'fronzak-wwe':          { med: 42, rend: 48, narr: 54, ctx: 70 }, // ~100K
  'sralexgomez-wwe':      { med: 40, rend: 46, narr: 52, ctx: 70 }, // ~100K

  // ── Creadores otros deportes (sin score_manual) ───────────────────────
  // Baloncesto
  'demas6basket':         { med: 76, rend: 80, narr: 72, ctx: 82 }, // ~250K YT, referente NBA español
  'house-of-highlights-es':{ med:65, rend: 60, narr: 58, ctx: 52 }, // agregador clips
  'aircriss-basket':      { med: 62, rend: 66, narr: 63, ctx: 74 }, // creador baloncesto
  'drafteados':           { med: 58, rend: 66, narr: 60, ctx: 86 }, // podcast NBA análisis
  'baloncesto-espana':    { med: 58, rend: 55, narr: 58, ctx: 78 }, // cuenta oficial FEB
  'gigantesbasket':       { med: 56, rend: 60, narr: 55, ctx: 86 }, // revista histórica
  'juan-hernangomez':     { med: 60, rend: 58, narr: 65, ctx: 70 }, // jugador+creador
  'fuentexnba':           { med: 52, rend: 58, narr: 58, ctx: 78 }, // análisis NBA
  'la-cueva-del-basket':  { med: 50, rend: 55, narr: 55, ctx: 77 },
  'basket-emotion':       { med: 50, rend: 52, narr: 52, ctx: 74 },
  'arigeli':              { med: 48, rend: 50, narr: 52, ctx: 70 },
  'jordi-galvez':         { med: 46, rend: 50, narr: 50, ctx: 68 },
  'la-cueva-del-basket':  { med: 50, rend: 55, narr: 55, ctx: 77 },
  'nba-memes-es':         { med: 44, rend: 46, narr: 48, ctx: 52 },
  'nba-en-espanol':       { med: 40, rend: 42, narr: 42, ctx: 64 },
  // Boxeo — medios reales
  'world-boxing-esp':     { med: 60, rend: 62, narr: 58, ctx: 80 },
  'jose-sulaiman-box':    { med: 55, rend: 58, narr: 55, ctx: 80 },
  'boxeomx':              { med: 52, rend: 55, narr: 52, ctx: 74 },
  // Ciclismo
  'gcnenespanol':         { med: 68, rend: 70, narr: 62, ctx: 86 }, // GCN oficial español
  'cicli-espana':         { med: 46, rend: 52, narr: 50, ctx: 76 },
  'cycling-espanol':      { med: 50, rend: 52, narr: 50, ctx: 72 },
  // F1
  'albertfabrega':        { med: 62, rend: 68, narr: 65, ctx: 92 }, // analista técnico F1
  'hablemosdef1':         { med: 52, rend: 58, narr: 55, ctx: 84 },
  'efeuno':               { med: 50, rend: 66, narr: 66, ctx: 90 }, // calidad > cantidad
  'f1-oficial':           { med: 45, rend: 48, narr: 48, ctx: 76 },
  // Fútbol americano
  'nfl-en-espanol':       { med: 68, rend: 62, narr: 58, ctx: 72 }, // cuenta NFL oficial
  // Golf
  'good-good-golf':       { med: 72, rend: 75, narr: 68, ctx: 84 }, // canal golf viral
  'golf-espanol':         { med: 38, rend: 42, narr: 40, ctx: 74 },
  // MotoGP — medios reales
  'motogp-oficial':       { med: 76, rend: 70, narr: 68, ctx: 86 }, // cuenta oficial
  'crash-net-es':         { med: 48, rend: 55, narr: 50, ctx: 84 },
  'rush-moto':            { med: 45, rend: 52, narr: 52, ctx: 74 },
  'motofull-moto':        { med: 40, rend: 45, narr: 45, ctx: 70 },
  // Pádel — medios reales
  'world-padel-tour':     { med: 70, rend: 65, narr: 65, ctx: 88 },
  'premier-padel-oficial':{ med: 55, rend: 52, narr: 55, ctx: 86 },
  'setpoint-padel':       { med: 38, rend: 45, narr: 42, ctx: 80 },
  // Tenis — creadores reales
  'puntodebreak':         { med: 62, rend: 68, narr: 62, ctx: 90 }, // referente tenis digital ES
}

// Pesos de creadores duplicados a mano: este script .mjs suelto no puede
// importar el TS. Fuente única = CREATOR_WEIGHTS en src/lib/rankings.ts (espejo
// del trigger de la migr. 028). Si cambian allí, actualiza estos números.
function calcScore({ med, rend, narr, ctx }) {
  return Math.round((med * 0.50 + rend * 0.30 + narr * 0.15 + ctx * 0.05) * 10) / 10
}

async function main() {
  console.log(`Modo: ${APPLY ? 'APPLY' : 'DRY RUN'}\n`)

  // ── Paso 1: Desactivar deportistas en creadores ───────────────────────
  console.log('── PASO 1: Desactivar deportistas en category=creadores ──')
  const { data: athletes } = await sb.from('ranking_entries')
    .select('id, name, sport')
    .eq('active', true)
    .eq('category', 'creadores')
    .in('id', [...ATHLETES_IN_CREADORES])

  console.log(`  Encontrados: ${athletes?.length ?? 0} atletas a desactivar`)
  athletes?.forEach(e => console.log(`  - ${e.sport?.padEnd(16)} ${e.id}`))

  if (APPLY && athletes?.length) {
    const ids = athletes.map(e => e.id)
    const { error } = await sb.from('ranking_entries').update({ active: false }).in('id', ids)
    if (error) console.error('  ❌ Error:', error.message)
    else console.log(`  ✅ ${ids.length} desactivados`)
  }

  // ── Paso 2 + 3: Actualizar factores y recalcular score_auto ──────────
  console.log('\n── PASO 2+3: Actualizar factores y score_auto ──')
  let ok = 0, missing = 0

  for (const [id, f] of Object.entries(CREATOR_FACTORS)) {
    const score = calcScore(f)
    const label = `  ${id.padEnd(34)} med=${f.med} rend=${f.rend} narr=${f.narr} ctx=${f.ctx} → score=${score}`

    if (!APPLY) {
      console.log(`  [DRY] ${label}`)
      ok++
      continue
    }

    const { error } = await sb.from('ranking_entries').update({
      mediatico_auto:   f.med,
      rendimiento_auto: f.rend,
      narrativa_auto:   f.narr,
      contexto_auto:    f.ctx,
      score_auto:       score,
    }).eq('id', id)

    if (error) {
      console.error(`  ❌ ${id}: ${error.message}`)
      missing++
    } else {
      console.log(`  ✅ ${label}`)
      ok++
    }
  }

  // Recalcular el resto de creadores activos que no están en el map
  if (APPLY) {
    console.log('\n── Recalculando score_auto para creadores no mapeados ──')
    const { data: rest, error: e2 } = await sb.from('ranking_entries')
      .select('id, mediatico_auto, rendimiento_auto, narrativa_auto, contexto_auto')
      .eq('active', true)
      .in('category', ['creadores', 'periodistas', 'creadores_wwe'])
      .not('id', 'in', `(${Object.keys(CREATOR_FACTORS).map(id => `"${id}"`).join(',')})`)

    if (rest?.length) {
      let recalc = 0
      for (const e of rest) {
        const s = Math.round((
          (e.mediatico_auto ?? 50) * 0.50 +
          (e.rendimiento_auto ?? 50) * 0.30 +
          (e.narrativa_auto ?? 50) * 0.15 +
          (e.contexto_auto ?? 50) * 0.05
        ) * 10) / 10
        await sb.from('ranking_entries').update({ score_auto: s }).eq('id', e.id)
        recalc++
      }
      console.log(`  ✅ ${recalc} entradas adicionales recalculadas`)
    }
  }

  console.log(`\n✅ OK: ${ok} | Sin datos: ${missing}`)
  if (!APPLY) console.log('Pasa --apply para aplicar los cambios.')
}

main().catch(err => { console.error(err); process.exit(1) })
