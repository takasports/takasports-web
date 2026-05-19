#!/usr/bin/env node
// set-editorial-rankings.mjs
//
// Aplica el orden editorial definitivo para:
//   · Creadores Fútbol (17 entradas)
//   · Creadores UFC  (boosts imperator, geniomma, greenvids, guante-a-guante)
//   · Creadores WWE  (13 entradas — confirma y blinda el orden)
//
// Establece score_manual (sobreescribe score_auto en ranking_view) y
// editorial_locked=true para que el cron no lo resetee.
//
// Uso:
//   node scripts/set-editorial-rankings.mjs          # DRY RUN
//   node scripts/set-editorial-rankings.mjs --apply

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

// ── Fútbol ─────────────────────────────────────────────────────────
// Posición 1 = score_manual más alto (90). Cada puesto = -1 punto.
const FUTBOL = [
  { id: 'iker-ruiz-futbol',    score_manual: 90 },  // 1
  { id: 'lacobra-futbol',      score_manual: 89 },  // 2
  { id: 'pedro-el-ingeniero',  score_manual: 88 },  // 3  (hype)
  { id: 'alexperezpoza',       score_manual: 87 },  // 4
  { id: 'rafaelescrig',        score_manual: 86, sport: 'futbol' },  // 5 — sport tenis→futbol
  { id: 'lamediainglesa',      score_manual: 85 },  // 6
  { id: 'rodrigofaez',         score_manual: 84, category: 'creadores', sport: 'futbol' },  // 7 — periodistas→creadores
  { id: 'retrocalcioshirts',   score_manual: 83 },  // 8
  { id: 'paulferrerz',         score_manual: 82 },  // 9
  { id: 'markitonavaja',       score_manual: 81 },  // 10
  { id: 'david-suarez-creator',score_manual: 80 },  // 11
  { id: 'futbolcontemo',       score_manual: 79 },  // 12
  { id: 'lorena-escoz',        score_manual: 78 },  // 13  (hype)
  { id: 'javibridge',          score_manual: 77 },  // 14
  { id: 'losdisplicentes',     score_manual: 76 },  // 15
  { id: 'nachohernaez',        score_manual: 75 },  // 16
  { id: 'toto-bordieri',       score_manual: 74 },  // 17
]

// ── UFC — ranking editorial completo (31 entradas) ────────────────
// Posición 1 = score_manual 90. Los 4 creadores indicados encabezan.
// El resto ordenado por calidad objetiva / relevancia para el público hispanohablante.
const UFC = [
  { id: 'geniomma',             score_manual: 90 },  //  1 — top creador MMA español
  { id: 'imperator-mma',        score_manual: 89 },  //  2
  { id: 'greenvids-mma',        score_manual: 88 },  //  3
  { id: 'guante-a-guante',      score_manual: 87 },  //  4
  { id: 'ilia-topuria',         score_manual: 86 },  //  5 — campeón UFC peso pluma, referente en España
  { id: 'alex-pereira-content', score_manual: 85 },  //  6 — campeón UFC actual
  { id: 'israel-adesanya',      score_manual: 84 },  //  7 — ex campeón, muy popular
  { id: 'conor-mcgregor',       score_manual: 83 },  //  8 — más conocido globalmente
  { id: 'brandon-moreno-podcast',score_manual: 82 }, //  9 — ex campeón mexicano
  { id: 'hablemosmmachannel',   score_manual: 81 },  // 10
  { id: 'islam-makhachev',      score_manual: 80 },  // 11 — campeón peso ligero
  { id: 'ufc-espanol-tiktok',   score_manual: 79 },  // 12 — cuenta oficial UFC en español
  { id: 'jaula-magazine',       score_manual: 78 },  // 13
  { id: 'mmarc-creator',        score_manual: 77 },  // 14
  { id: 'area-de-combate-espn', score_manual: 76 },  // 15
  { id: 'box-azteca',           score_manual: 75 },  // 16
  { id: 'generacionmma',        score_manual: 74 },  // 17
  { id: 'combate-global-mx',    score_manual: 73 },  // 18
  { id: 'impacto-mma',          score_manual: 72 },  // 19
  { id: 'mmadictos',            score_manual: 71 },  // 20
  { id: 'enrique-gimeno-mma',   score_manual: 70 },  // 21
  { id: 'la-zona-de-combate',   score_manual: 69 },  // 22
  { id: 'jiujitsu-en-espanol',  score_manual: 68 },  // 23
  { id: 'fabricio-werdum-content',score_manual: 67 },// 24
  { id: 'zonammaespanol',       score_manual: 66 },  // 25
  { id: 'ufc-entre-asaltos',    score_manual: 65 },  // 26
  { id: 'doberdan-mma',         score_manual: 64 },  // 27
  { id: 'mma-mexico-oficial',   score_manual: 63 },  // 28
  { id: 'fullblood-mma',        score_manual: 62 },  // 29
  { id: 'chito-vera-content',   score_manual: 61 },  // 30
  { id: 'zona-combate-es',      score_manual: 60 },  // 31
]

// ── WWE — confirma y blinda el orden editorial ─────────────────────
const WWE = [
  { id: 'eduardo-bates-wwe', score_manual: 90 },  // 1
  { id: 'noahclub-wwe',      score_manual: 89 },  // 2
  { id: 'falbak-wwe',        score_manual: 88 },  // 3
  { id: 'diego-aranis-wwe',  score_manual: 87 },  // 4
  { id: 'danidelasluchas',   score_manual: 86 },  // 5
  { id: 'wwecucu',           score_manual: 85 },  // 6
  { id: 'uke-wrestling',     score_manual: 84 },  // 7
  { id: 'tioallende-wwe',    score_manual: 83 },  // 8
  { id: 'rolsogames-wwe',    score_manual: 82 },  // 9
  { id: 'luigi-wrestling',   score_manual: 81 },  // 10
  { id: 'soyalekay',         score_manual: 80 },  // 11
  { id: 'fronzak-wwe',       score_manual: 79 },  // 12
  { id: 'sralexgomez-wwe',   score_manual: 78 },  // 13
]

async function applyUpdates(label, updates) {
  console.log(`\n── ${label} (${updates.length} entradas) ──`)
  let ok = 0, err = 0

  for (const entry of updates) {
    const { id, score_manual, sport, category } = entry
    const payload = { score_manual, editorial_locked: true }
    if (sport)    payload.sport    = sport
    if (category) payload.category = category

    const label2 = `${String(score_manual).padStart(3)}  ${id}`

    if (!APPLY) {
      const extras = [sport && `sport→${sport}`, category && `cat→${category}`].filter(Boolean)
      console.log(`  [DRY] ${label2}${extras.length ? '  (' + extras.join(', ') + ')' : ''}`)
      ok++
      continue
    }

    const { error } = await sb.from('ranking_entries').update(payload).eq('id', id)
    if (error) {
      console.error(`  ❌ ${label2}  — ${error.message}`)
      err++
    } else {
      const extras = [sport && `sport→${sport}`, category && `cat→${category}`].filter(Boolean)
      console.log(`  ✅ ${label2}${extras.length ? '  (' + extras.join(', ') + ')' : ''}`)
      ok++
    }
  }

  console.log(`  → ${ok} OK, ${err} errores`)
}

async function main() {
  console.log(`Modo: ${APPLY ? 'APPLY' : 'DRY RUN'}\n`)

  await applyUpdates('Fútbol Creadores', FUTBOL)
  await applyUpdates('UFC Boosts', UFC)
  await applyUpdates('WWE Creadores', WWE)

  console.log('\n✅ Hecho.')
  if (!APPLY) console.log('Pasa --apply para aplicar los cambios.')
}

main().catch(err => { console.error(err); process.exit(1) })
