#!/usr/bin/env node
// set-ranking-final.mjs
//
// Establece el ranking editorial definitivo de la sección Contenidos.
//
// Acciones:
//   1. Fija score_auto + editorial_locked para los ranked en el orden del listado
//   2. Pone badge_manual = 'Hype' donde corresponde
//   3. Baja score de entradas no listadas que quedarían por encima del umbral
//   4. Desactiva duplicados (la-gambeta, los-displicentes, ufc-espanol)
//
// ─── FÚTBOL (17 posiciones, scores 90→74) ──────────────────────────
//  1. Iker Ruiz del Barco       90
//  2. La Cobra                  89
//  3. Pedro El Ingeniero 🔥     88  [Hype]
//  4. Alex Pérez Poza           87
//  5. Rafa Escrig               86
//  6. La Media Inglesa          85
//  7. Rodrigo Fáez              84
//  8. RetrocalcioShirts         83
//  9. Paul Ferrer Z             82
// 10. MarkitoNavaja             81
// 11. David Suárez              80
// 12. Fútbol con Temo           79
// 13. Lorena Escoz 🔥           78  [Hype]
// 14. Javi Bridge               77
// 15. Los Displicentes          76
// 16. NachoHernaez              75
// 17. Toto Bordieri             74
//
// ─── UFC (16 posiciones, scores 90→75) — selección objetiva ────────
//  1. UFC Español (TikTok 5M)   90
//  2. ESPN Knockout             89
//  3. Box Azteca                88
//  4. Fabricio Werdum           87
//  5. Christian Tetzpa          86
//  6. MMARC                     85
//  7. Combate Global            84
//  8. Generación MMA            83
//  9. Área de Combate ESPN      82
// 10. Impacto MMA               81
// 11. Víctor Dávila             80
// 12. MMAdictos                 79
// 13. GenioMMA                  78
// 14. Enrique Gimeno MMA        77
// 15. La Zona de Combate        76
// 16. Jiu-Jitsu en Español      75
//
// ─── WWE (13 posiciones, scores 90→78) ─────────────────────────────
//  1. Eduardo Bates             90
//  2. NoahClub                  89
//  3. Falbak                    88
//  4. Diego Aranís              87
//  5. DanidelasLuchas           86
//  6. WWECucu                   85
//  7. Uke Wrestling             84
//  8. TioAllende                83
//  9. Rolso Games               82
// 10. LuigiWrestling            81
// 11. Soyalekay                 80
// 12. Fronzak WWE               79
// 13. SrAlexGomez               78
//
// Uso:
//   node scripts/set-ranking-final.mjs           # DRY RUN
//   node scripts/set-ranking-final.mjs --apply

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

// ── Ranked entries por sporte ──────────────────────────────────────
const FUTBOL_RANKED = [
  { id: 'iker-ruiz-futbol',    score: 90 },
  { id: 'lacobra-futbol',      score: 89 },
  { id: 'pedro-el-ingeniero',  score: 88, badge: 'Hype' },
  { id: 'alexperezpoza',       score: 87 },
  { id: 'rafaescrig-futbol',   score: 86 },
  { id: 'lamediainglesa',      score: 85 },
  { id: 'rodrigofaez',         score: 84 },
  { id: 'retrocalcioshirts',   score: 83 },
  { id: 'paulferrerz',         score: 82 },
  { id: 'markitonavaja',       score: 81 },
  { id: 'david-suarez-creator',score: 80 },
  { id: 'futbolcontemo',       score: 79 },
  { id: 'lorena-escoz',        score: 78, badge: 'Hype' },
  { id: 'javibridge',          score: 77 },
  { id: 'losdisplicentes',     score: 76 },
  { id: 'nachohernaez',        score: 75 },
  { id: 'toto-bordieri',       score: 74 },
]

const UFC_RANKED = [
  { id: 'ufc-espanol-tiktok',         score: 90 },
  { id: 'espn-knockout-digital',      score: 89 },
  { id: 'box-azteca',                 score: 88 },
  { id: 'fabricio-werdum-content',    score: 87 },
  { id: 'christian-tetzpa',          score: 86 },
  { id: 'mmarc-creator',             score: 85 },
  { id: 'combate-global-mx',         score: 84 },
  { id: 'generacionmma',             score: 83 },
  { id: 'area-de-combate-espn',      score: 82 },
  { id: 'impacto-mma',               score: 81 },
  { id: 'victor-davila-ufc',         score: 80 },
  { id: 'mmadictos',                 score: 79 },
  { id: 'geniomma',                  score: 78 },
  { id: 'enrique-gimeno-mma',        score: 77 },
  { id: 'la-zona-de-combate',        score: 76 },
  { id: 'jiujitsu-en-espanol',       score: 75 },
]

const WWE_RANKED = [
  { id: 'eduardo-bates-wwe',  score: 90 },
  { id: 'noahclub-wwe',       score: 89 },
  { id: 'falbak-wwe',         score: 88 },
  { id: 'diego-aranis-wwe',   score: 87 },
  { id: 'danidelasluchas',    score: 86 },
  { id: 'wwecucu',            score: 85 },
  { id: 'uke-wrestling',      score: 84 },
  { id: 'tioallende-wwe',     score: 83 },
  { id: 'rolsogames-wwe',     score: 82 },
  { id: 'luigi-wrestling',    score: 81 },
  { id: 'soyalekay',          score: 80 },
  { id: 'fronzak-wwe',        score: 79 },
  { id: 'sralexgomez-wwe',    score: 78 },
]

// Umbral: cualquier entrada activa con score_auto > THRESHOLD_* que NO esté
// en la lista ranked se baja a ~65 para no interferir con el orden editorial.
const FUTBOL_THRESHOLD = 73
const UFC_THRESHOLD    = 74
const WWE_THRESHOLD    = 77

// Duplicados a desactivar
const DEACTIVATE = [
  'los-displicentes',   // usar losdisplicentes
  'la-gambeta',         // usar la-gambeta-sports (si se vuelve a usar)
  'ufc-espanol',        // usar ufc-espanol-tiktok
]

async function applyRanked(ranked, label) {
  let ok = 0, fail = 0, skip = 0
  for (const { id, score, badge } of ranked) {
    const update = { score_auto: score, editorial_locked: true }
    if (badge) update.badge_manual = badge

    if (!APPLY) {
      const pos = ranked.indexOf(ranked.find(r => r.id === id)) + 1
      console.log(`  [${String(pos).padStart(2)}] ${id.padEnd(36)} score:${score}${badge ? ' badge:'+badge : ''}`)
      continue
    }
    const { error } = await sb.from('ranking_entries').update(update).eq('id', id)
    if (error) { console.error(`  FAIL ${id}: ${error.message}`); fail++ }
    else ok++
  }
  if (APPLY) console.log(`  ${label}: OK:${ok} FAIL:${fail}`)
}

async function lowerNonRanked(sport, categories, rankedIds, threshold, newScore = 65) {
  const { data, error } = await sb
    .from('ranking_entries')
    .select('id, name, score_auto')
    .in('category', categories)
    .eq('sport', sport)
    .eq('active', true)
    .gt('score_auto', threshold)

  if (error) { console.error('Query error:', error.message); return }

  const toLower = data.filter(e => !rankedIds.has(e.id))
  if (!toLower.length) { console.log(`  No entries above threshold (${threshold}) to lower.`); return }

  console.log(`  Lowering ${toLower.length} non-ranked entries above ${threshold}:`)
  for (const e of toLower) {
    console.log(`    ${e.name.padEnd(36)} ${e.score_auto} → ${newScore}`)
    if (APPLY) {
      await sb.from('ranking_entries').update({ score_auto: newScore }).eq('id', e.id)
    }
  }
}

async function deactivateDuplicates() {
  for (const id of DEACTIVATE) {
    console.log(`  Deactivate: ${id}`)
    if (APPLY) {
      const { error } = await sb.from('ranking_entries').update({ active: false }).eq('id', id)
      if (error) console.error(`  FAIL deactivate ${id}: ${error.message}`)
    }
  }
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}\n`)

  // ── 1. Ranked entries ──────────────────────────────────────────
  console.log('⚽ FÚTBOL ranked:')
  await applyRanked(FUTBOL_RANKED, 'fútbol')
  console.log('\n🥊 UFC ranked:')
  await applyRanked(UFC_RANKED, 'ufc')
  console.log('\n🤼 WWE ranked:')
  await applyRanked(WWE_RANKED, 'wwe')

  // ── 2. Lower non-ranked high-score entries ─────────────────────
  const futbolRankedIds = new Set(FUTBOL_RANKED.map(r => r.id))
  const ufcRankedIds    = new Set(UFC_RANKED.map(r => r.id))
  const wweRankedIds    = new Set(WWE_RANKED.map(r => r.id))

  console.log('\n⬇️  Lowering non-ranked entries above threshold:')
  console.log('\n  ⚽ Fútbol (threshold >' + FUTBOL_THRESHOLD + '):')
  await lowerNonRanked('futbol', ['creadores','periodistas'], futbolRankedIds, FUTBOL_THRESHOLD)
  console.log('\n  🥊 UFC (threshold >' + UFC_THRESHOLD + '):')
  await lowerNonRanked('ufc', ['creadores','periodistas'], ufcRankedIds, UFC_THRESHOLD)
  console.log('\n  🤼 WWE (threshold >' + WWE_THRESHOLD + '):')
  await lowerNonRanked('wwe', ['creadores_wwe','periodistas'], wweRankedIds, WWE_THRESHOLD)

  // ── 3. Deactivate duplicates ───────────────────────────────────
  console.log('\n🗑️  Deactivating duplicates:')
  await deactivateDuplicates()

  console.log('\n✅ Done.')
}

main().catch(err => { console.error(err); process.exit(1) })
