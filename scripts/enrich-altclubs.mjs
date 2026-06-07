// Enriquecedor de altClubs del catálogo de jugadores (Mi Once — modelo posición×club).
//
// El modelo "nombra un jugador que jugó esa posición en ese club" valida por
// club incluyendo multiclub (playerClubs = [club, ...altClubs]). Con el catálogo
// casi sin altClubs (7%), rechazaba respuestas correctas de "también jugó ahí".
// Este script fusiona un mapa curado de clubes históricos NOTABLES por jugador,
// usando SOLO nombres canónicos del catálogo (los que usan los slots/retos).
//
// Clave = id del catálogo (algunos ids están reciclados → el comentario lleva el
// NOMBRE real). Solo se añaden clubes de los que el jugador jugó de verdad; ante
// la duda, se omite. El script no toca entradas que ya tengan altClubs, no
// duplica el club principal y deduplica.
//
// Uso:  node scripts/enrich-altclubs.mjs          (aplica)
//       node scripts/enrich-altclubs.mjs --dry    (solo informe)

import { readFileSync, writeFileSync } from 'node:fs'

const FILE = new URL('../src/lib/players-catalog.ts', import.meta.url)
const DRY = process.argv.includes('--dry')

// id -> [clubes adicionales notables]. Nombre real entre paréntesis cuando el id
// está reciclado. Solo clubes con spell real y reconocible.
const ALT = {
  // ── Porteros ──
  buffon: ['Paris Saint-Germain'],
  reina: ['Napoli', 'Villarreal', 'Bayern Múnich'],          // Pepe Reina
  courtois: ['Chelsea', 'Atlético de Madrid'],
  lloris: ['Niza'],
  'navas-k': ['Paris Saint-Germain'],                          // Keylor Navas
  szczesny: ['Arsenal', 'Roma', 'FC Barcelona'],
  onana: ['Internazionale'],
  sommer: ['Bayern Múnich'],
  ederson: ['Benfica'],
  alisson: ['Roma'],
  kepa: ['Real Madrid', 'Athletic Club'],
  vansar: ['Juventus', 'Fulham'],                             // Edwin van der Sar
  cech: ['Arsenal'],
  'schmeichel-p': ['Manchester City', 'Aston Villa'],         // Peter Schmeichel

  // ── Defensas ──
  cannavaro: ['Napoli', 'Internazionale', 'Juventus'],
  thuram: ['Mónaco', 'FC Barcelona'],                         // Lilian Thuram
  desailly: ['Milan', 'Marsella'],
  blanc: ['Napoli', 'FC Barcelona', 'Marsella', 'Internazionale'],   // Laurent Blanc
  'sergio-ramos': ['Paris Saint-Germain'],
  pique: ['Manchester United'],
  cafu: ['Milan'],
  lucio: ['Bayern Múnich', 'Juventus'],
  samuel: ['Roma'],                                           // Walter Samuel
  heinze: ['Real Madrid', 'Paris Saint-Germain', 'Marsella'],
  koeman: ['Feyenoord'],                                      // Ronald Koeman
  stam: ['Lazio', 'Milan'],
  matthaus: ['Internazionale'],
  kohler: ['Juventus', 'Bayern Múnich'],
  sammer: ['Stuttgart', 'Internazionale'],
  ferdinand: ['West Ham', 'Newcastle'],
  campbell: ['Tottenham', 'Newcastle', 'Everton'],           // Sol Campbell
  'cole-a': ['Arsenal', 'Roma', 'LA Galaxy'],                 // Ashley Cole
  terry: ['Aston Villa'],
  vidic: ['Internazionale'],
  stankovic: ['Lazio'],
  zambrotta: ['FC Barcelona', 'Milan'],
  maicon: ['Roma', 'Manchester City', 'Juventus'],
  'dani-alves': ['Juventus', 'Paris Saint-Germain'],
  'carvalho-r': ['Real Madrid', 'Mónaco'],                    // Ricardo Carvalho
  'van-dijk': ['Celtic'],
  rudiger: ['Chelsea', 'Roma'],
  alaba: ['Bayern Múnich'],
  walker: ['Tottenham'],
  akanji: ['Borussia Dortmund'],
  gvardiol: ['RB Leipzig'],
  stones: ['Everton'],
  konate: ['RB Leipzig'],
  zinchenko: ['Manchester City'],
  pavard: ['Bayern Múnich', 'Stuttgart'],
  kim: ['Napoli'],                                            // Kim Min-jae
  hakimi: ['Real Madrid', 'Borussia Dortmund', 'Internazionale'],
  theo: ['Real Madrid', 'Atlético de Madrid'],               // Theo Hernández
  tomori: ['Chelsea'],
  dalot: ['Milan'],
  grimaldo: ['Benfica'],
  frimpong: ['Celtic'],
  laporte: ['Manchester City', 'Athletic Club'],
  inigo: ['Athletic Club', 'Real Sociedad'],                 // Iñigo Martínez
  'nuno-mendes': ['Sporting CP'],

  // ── Centrocampistas ──
  zidane: ['Juventus'],
  maradona: ['FC Barcelona'],
  'di-stefano': ['River Plate'],
  rivaldo: ['Milan'],
  beckham: ['Real Madrid', 'LA Galaxy', 'Milan', 'Paris Saint-Germain'],
  gerrard: ['LA Galaxy'],
  keane: ['Celtic'],                                          // Roy Keane
  'henry-thierry': ['Marsella', 'Villarreal'],               // Robert Pirès
  deschamps: ['Marsella', 'Chelsea', 'Valencia'],
  petit: ['FC Barcelona', 'Chelsea', 'Mónaco'],              // Emmanuel Petit
  zambrano: ['FC Barcelona', 'Mónaco'],                      // Yaya Touré
  essien: ['Real Madrid', 'Milan'],
  baggio: ['Milan', 'Internazionale', 'Fiorentina'],         // Roberto Baggio
  'mancini-r': ['Lazio'],                                     // Roberto Mancini
  fabregas: ['FC Barcelona', 'Chelsea', 'Mónaco'],
  'silva-d': ['Valencia', 'Real Sociedad'],                  // David Silva
  guardiola: ['Roma'],                                       // Pep
  redondo: ['Milan'],
  verón: ['Manchester United', 'Chelsea', 'Internazionale', 'Sampdoria'],
  'rui-costa': ['Fiorentina', 'Benfica'],
  deco: ['Chelsea'],
  ballack: ['Chelsea', 'Bayer Leverkusen'],
  effenberg: ['Fiorentina'],
  kroos: ['Bayern Múnich', 'Bayer Leverkusen'],
  davids: ['Milan', 'Internazionale', 'Tottenham'],          // Edgar Davids
  'van-bommel': ['FC Barcelona', 'Milan'],
  modric: ['Tottenham'],
  ilkay: ['Manchester City', 'Borussia Dortmund'],           // Gündoğan
  kovacic: ['Chelsea', 'Real Madrid', 'Internazionale'],
  havertz: ['Chelsea', 'Bayer Leverkusen'],
  partey: ['Atlético de Madrid'],
  casemiro: ['Real Madrid'],
  eriksen: ['Tottenham', 'Internazionale'],
  mkhitaryan: ['Manchester United', 'Arsenal', 'Roma', 'Borussia Dortmund'],
  calhanoglu: ['Milan', 'Bayer Leverkusen'],
  pulisic: ['Chelsea', 'Borussia Dortmund'],
  'loftus-cheek': ['Chelsea'],
  sane: ['Manchester City'],
  xhaka: ['Arsenal'],
  rabiot: ['Juventus', 'Paris Saint-Germain'],
  fabian: ['Napoli', 'Real Betis'],                          // Fabián Ruiz
  ugarte: ['Paris Saint-Germain', 'Sporting CP'],
  merino: ['Arsenal'],                                        // Mikel Merino
  olmo: ['RB Leipzig'],                                       // Dani Olmo
  isco: ['Real Madrid'],
  'james-r2': ['Mónaco', 'Bayern Múnich', 'Everton'],        // James Rodríguez
  ceballos: ['Real Betis', 'Arsenal'],                       // Dani Ceballos
  matuidi: ['Juventus'],

  // ── Delanteros ──
  romario: ['Flamengo', 'Valencia'],
  'van-nistelrooy': ['Real Madrid'],
  kluivert: ['Milan', 'Newcastle', 'Valencia'],              // Patrick Kluivert
  'van-persie': ['Manchester United', 'Feyenoord'],
  overmars: ['FC Barcelona'],                                // Marc Overmars
  morientes: ['Liverpool', 'Valencia', 'Mónaco'],
  villa: ['FC Barcelona', 'Atlético de Madrid'],             // David Villa
  torres: ['Chelsea', 'Atlético de Madrid', 'Milan'],        // Fernando Torres
  'baggio-d': ['Juventus', 'Milan', 'Lazio', 'Atlético de Madrid', 'Fiorentina', 'Mónaco'], // Christian Vieri
  'inzaghi-f': ['Juventus', 'Atalanta'],                     // Filippo Inzaghi
  weah: ['Paris Saint-Germain', 'Chelsea', 'Manchester City', 'Mónaco'],  // George Weah
  batistuta: ['Roma', 'Internazionale'],
  aguero: ['Atlético de Madrid', 'FC Barcelona'],
  klose: ['Bayern Múnich'],
  klinsmann: ['Internazionale', 'Bayern Múnich', 'Mónaco', 'Sampdoria'],
  podolski: ['Bayern Múnich', 'Internazionale', 'Galatasaray'],
  forlan: ['Manchester United', 'Villarreal', 'Internazionale'],  // Diego Forlán
  drogba: ['Marsella', 'Galatasaray'],
  kanu: ['Internazionale'],                                  // Nwankwo Kanu
  'falcao-r': ['Manchester United', 'Chelsea', 'Mónaco'],    // Radamel Falcao
  hagi: ['Real Madrid', 'FC Barcelona'],
  'davor-suker': ['Arsenal', 'West Ham'],
  mertens: ['Galatasaray'],                                  // Dries Mertens
  cavani: ['Napoli', 'Manchester United', 'Valencia'],
  'ronaldinho-2': ['Manchester City', 'Milan', 'Santos'],    // Robinho
  haaland: ['Borussia Dortmund'],
  mbappe: ['Paris Saint-Germain', 'Mónaco'],
  lewandowski: ['Bayern Múnich', 'Borussia Dortmund'],
  felix: ['Chelsea', 'FC Barcelona', 'Benfica'],             // João Félix
  depay: ['Manchester United', 'FC Barcelona'],              // Memphis Depay
  mane: ['Bayern Múnich'],                                   // Sadio Mané
  firmino: ['Al-Ahli'],                                      // Roberto Firmino
  kane: ['Tottenham'],
  son: ['Bayer Leverkusen'],
  sterling: ['Manchester City', 'Liverpool', 'Arsenal'],
  rashford: ['Aston Villa', 'FC Barcelona'],
  'haaland-ruben': ['Manchester City', 'River Plate'],       // Julián Álvarez
  grealish: ['Aston Villa', 'Everton'],
  leao: ['Sporting CP'],                                     // Rafael Leão
  giroud: ['Arsenal', 'Chelsea', 'Milan'],
  chiesa: ['Juventus', 'Fiorentina'],
  icardi: ['Internazionale', 'Paris Saint-Germain', 'Sampdoria'],
  aubameyang: ['Arsenal', 'FC Barcelona', 'Chelsea', 'Borussia Dortmund'],
  reus: ['Borussia Dortmund'],                               // Marco Reus
  sancho: ['Manchester United', 'Chelsea'],
  benzema: ['Real Madrid'],
  jovic: ['Real Madrid', 'Eintracht Frankfurt', 'Benfica'],  // Luka Jović
  kean: ['Juventus', 'Paris Saint-Germain', 'Everton'],      // Moise Kean
  'havertz-2': ['Chelsea', 'Tottenham'],                     // Timo Werner
  larsson: ['FC Barcelona', 'Manchester United'],            // Henrik Larsson
  'gomez-m': ['Fiorentina', 'Stuttgart'],                    // Mario Gómez
  thauvin: ['Marsella'],                                     // Florian Thauvin
}

let src = readFileSync(FILE, 'utf8')
const canonical = new Set([...src.matchAll(/club:\s*'([^']+)'/g)].map(m => m[1]))

let added = 0, skipped = 0, notFound = 0, badClub = 0
const report = []

for (const [id, clubsRaw] of Object.entries(ALT)) {
  // localizar la entrada del jugador (literal de una línea)
  const re = new RegExp(`(\\{\\s*id:\\s*'${id.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}',[^}]*?club:\\s*'([^']+)')([^}]*?\\})`)
  const m = src.match(re)
  if (!m) { notFound++; report.push(`  ✗ NO ENCONTRADO: ${id}`); continue }
  const entry = m[0]
  if (/altClubs:/.test(entry)) { skipped++; report.push(`  · ya tiene altClubs: ${id}`); continue }
  const primary = m[2]
  // validar que los clubes sean canónicos y no el principal; dedupe
  const clubs = [...new Set(clubsRaw)].filter(c => c !== primary)
  const invalid = clubs.filter(c => !canonical.has(c))
  if (invalid.length) { badClub++; report.push(`  ⚠ club no canónico en ${id}: ${invalid.join(', ')}`) }
  const valid = clubs.filter(c => canonical.has(c))
  if (!valid.length) { skipped++; continue }
  const altStr = `, altClubs: [${valid.map(c => `'${c}'`).join(', ')}]`
  const replaced = m[1] + altStr + m[3]
  src = src.replace(entry, replaced)
  added++
}

console.log(report.join('\n'))
console.log(`\nResumen: +${added} enriquecidos · ${skipped} saltados · ${notFound} no encontrados · ${badClub} con club no canónico`)
if (!DRY) { writeFileSync(FILE, src); console.log('Escrito players-catalog.ts') }
else console.log('(--dry: no se escribió nada)')
