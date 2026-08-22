// ─────────────────────────────────────────────────────────────────────────────
// Auditor de la selección de Jornadas (Ranked Fútbol).
//
//   npx tsx scripts/auditar-jornadas.ts [días]
//
// Baja el fixture REAL de ESPN y enseña qué Jornada publicaría el motor cada
// semana, con la puntuación de cada partido, cuál sería el Partidazo y los
// mejores que se quedan fuera. No toca la base de datos ni publica nada.
//
// Existe porque la selección es la decisión de producto más visible de la
// sección —es literalmente lo que el usuario ve— y hasta ahora solo se podía
// juzgar a posteriori, mirando lo que el cron ya había congelado.
// ─────────────────────────────────────────────────────────────────────────────

import {
  RANKED_FOOTBALL_SOURCES,
  scoreFixtures, selectForWeek, weekEndKey,
  type FootballFixture,
} from '../src/lib/football-ranked'
import { toSpanishNation } from '../src/lib/nation-names'

const DAYS = Number(process.argv[2] ?? 24)

const yyyymmdd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '')
const range = `${yyyymmdd(new Date())}-${yyyymmdd(new Date(Date.now() + DAYS * 86_400_000))}`

interface EspnEvent {
  id: string; date: string
  competitions?: {
    competitors?: { homeAway: string; team?: { displayName?: string } }[]
    notes?: { headline?: string }[]
  }[]
}

async function main() {
const fixtures: FootballFixture[] = []
const seen = new Set<string>()

for (const src of RANKED_FOOTBALL_SOURCES) {
  try {
    const r = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${src.slug}/scoreboard?dates=${range}&limit=${src.fetchLimit ?? 100}`,
    )
    if (!r.ok) continue
    const j = await r.json() as { events?: EspnEvent[] }
    for (const ev of j.events ?? []) {
      if (seen.has(ev.id)) continue
      const c = ev.competitions?.[0]
      const h = c?.competitors?.find(x => x.homeAway === 'home')
      const a = c?.competitors?.find(x => x.homeAway === 'away')
      if (!h?.team?.displayName || !a?.team?.displayName || !ev.date) continue
      seen.add(ev.id)
      fixtures.push({
        espnId: ev.id, isoDate: ev.date, comp: src.comp, leagueSlug: src.slug,
        home: toSpanishNation(h.team.displayName), away: toSpanishNation(a.team.displayName),
        stage: c?.notes?.[0]?.headline,
      })
    }
  } catch { /* liga sin fixture en esta ventana */ }
}

const scored = scoreFixtures(fixtures)
const byWeek = new Map<string, typeof scored>()
for (const f of scored) {
  const b = byWeek.get(f.weekKey)
  if (b) b.push(f); else byWeek.set(f.weekKey, [f])
}

console.log(`Fixture: ${fixtures.length} partidos · ${RANKED_FOOTBALL_SOURCES.length} competiciones · ${DAYS} días\n`)

for (const [wk, list] of [...byWeek.entries()].sort()) {
  const week = selectForWeek(list)
  console.log(`━━ Jornada ${wk} → ${weekEndKey(wk)}  (${list.length} candidatos)`)
  if (!week) { console.log('   sin Jornada: nada supera el listón\n'); continue }
  for (const m of [...week.matches].sort((x, y) => y.score - x.score)) {
    const flag = m.espnId === week.featuredEspnId ? '⭐' : '  '
    console.log(`   ${flag} ${String(m.score).padStart(5)}  ${m.dateKey}  ${m.comp.padEnd(12)} ${m.home} - ${m.away}`)
  }
  const dentro = new Set(week.matches.map(m => m.espnId))
  const fuera = list.filter(m => !dentro.has(m.espnId)).sort((a, b) => b.score - a.score).slice(0, 4)
  if (fuera.length) console.log(`      fuera: ${fuera.map(m => `${m.home}-${m.away} (${m.score})`).join(' · ')}`)
  console.log()
}
}

main()
