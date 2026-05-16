#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// expand-tiktok-instagram-v2.mjs
//
// Segunda pasada de creadores TikTok/Instagram — basada en
// investigación exhaustiva de mayo 2026 (Favikon, Modash,
// TikTok Newsroom, Heepsy, PadelAddict).
//
// Uso:
//   node scripts/expand-tiktok-instagram-v2.mjs           # DRY RUN
//   node scripts/expand-tiktok-instagram-v2.mjs --apply
// ─────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const APPLY = process.argv.includes('--apply')
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE keys'); process.exit(1) }

const NEW_CREATORS = [

  // ══════════════════════════════════════════════════════════════
  // UFC / MMA
  // ══════════════════════════════════════════════════════════════

  {
    id: 'ilia-topuria', name: 'Ilia Topuria', country: 'ES', emoji: '🇪🇸',
    sport: 'ufc', category: 'creadores',
    subtitle: 'Campeón UFC Peso Pluma. 14M Instagram, 10M TikTok. El deportista español más seguido.',
    handles: { instagram: 'iliatopuria', tiktok: '@iliatopuria', twitter: 'iliatopuria' },
  },

  // ══════════════════════════════════════════════════════════════
  // FÚTBOL — Creadores TikTok nativos con millones de seguidores
  // ══════════════════════════════════════════════════════════════

  {
    id: 'rivaldios', name: 'Rivaldios', country: 'MX', emoji: '🇲🇽',
    sport: 'futbol', category: 'creadores',
    subtitle: '5M+ TikTok. El creador de fútbol más viral de México.',
    handles: { tiktok: '@rivaldios10', instagram: 'rivaldios10', twitter: 'rivaldios10' },
  },
  {
    id: 'javi-freestyle', name: 'Javi Freestyle', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: '2.7M TikTok / 570K IG. Freestyler de fútbol. Uno de los mejores del mundo.',
    handles: { tiktok: '@javifreestyle', instagram: 'javifreestyler', youtube: '@javifreestyle', twitter: 'JaviFreestylr' },
  },
  {
    id: 'cata-vega', name: 'Cata Vega', country: 'MX', emoji: '🇲🇽',
    sport: 'futbol', category: 'creadores',
    subtitle: '1.9M TikTok. Freestyler mexicana. Referente del fútbol femenino freestyle.',
    handles: { tiktok: '@catavegaoficial', instagram: 'catavegaoficial', twitter: 'catavegaoficial' },
  },
  {
    id: 'axel-footy', name: 'Axel Footy', country: 'US', emoji: '🌎',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Creador de fútbol para la comunidad latinoamericana en EEUU. TikTok e IG.',
    handles: { tiktok: '@axel.footy', instagram: 'axel.footy', twitter: 'axelfooty' },
  },
  {
    id: 'futbol-al-chile', name: 'Fútbol al Chile', country: 'MX', emoji: '🇲🇽',
    sport: 'futbol', category: 'creadores',
    subtitle: '635K TikTok. Canal de análisis y humor del fútbol mexicano y latinoamericano.',
    handles: { tiktok: '@futbolalchile', instagram: 'futbolalchile', youtube: '@futbolalchile', twitter: 'futbolalchile' },
  },
  {
    id: 'tripa-futbol', name: 'Eduardo Tripa Chávez', country: 'MX', emoji: '🇲🇽',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Periodista y creator. Corresponsal oficial TikTok × FIFA para el Mundial 2026.',
    handles: { tiktok: '@tripaenfutbol', instagram: 'tripaenfutbol', twitter: 'tripaenfutbol' },
  },

  // ── FÚTBOL — Clubes con mayor presencia en TikTok ─────────────

  {
    id: 'cadiz-cf', name: 'Cádiz CF', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: '9.6M TikTok. El club de fútbol más viral del mundo en TikTok. Humor y creatividad.',
    handles: { tiktok: '@cadizcf', instagram: 'cadizcf', youtube: '@CadizcfOfficial', twitter: 'Cadiz_CF' },
  },
  {
    id: 'real-sociedad-tiktok', name: 'Real Sociedad', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Club de LaLiga con gran presencia digital. Referente vasco del fútbol español.',
    handles: { tiktok: '@realsociedad', instagram: 'realsociedad', youtube: '@RealSociedad', twitter: 'RealSociedad' },
  },
  {
    id: 'getafe-cf', name: 'Getafe CF', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Club madrileño conocido por su contenido original y divertido en redes sociales.',
    handles: { tiktok: '@getafecf', instagram: 'getafecf', twitter: 'GetafeCF' },
  },
  {
    id: 'osasuna-tiktok', name: 'CA Osasuna', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Club navarro con uno de los social media más creativos de LaLiga.',
    handles: { tiktok: '@caosasuna', instagram: 'caosasuna', twitter: 'CAOsasuna' },
  },
  {
    id: 'laliga-fantasy', name: 'LaLiga Fantasy', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: '2.7M TikTok. El fantasy oficial de LaLiga. Comunidad masiva de managers.',
    handles: { tiktok: '@laligafantasy', instagram: 'laligafantasy', twitter: 'LaLigaFantasy' },
  },
  {
    id: 'movistarplus-deportes', name: 'Movistar Plus+ Deportes', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: '2M TikTok. La plataforma de contenido deportivo premium de España.',
    handles: { tiktok: '@movistarplusdeportes', instagram: 'movistarplusdeportes', twitter: 'MovistarDeporte' },
  },

  // ── FÚTBOL — Jugadoras con mayor presencia digital ────────────

  {
    id: 'ana-markovic', name: 'Ana María Markovic', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: '2M+ Instagram. Llamada "la futbolista más bella del mundo". FC Barcelona femenino.',
    handles: { instagram: 'anamariamarkovic', tiktok: '@anamariamarkovic', twitter: 'anamarkovic11' },
  },
  {
    id: 'aray-fer', name: 'Aray & Fer', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: '1M+ seguidores. Pareja de futbolistas y creadores de contenido femenino.',
    handles: { tiktok: '@arayfer', instagram: 'arayfer', twitter: 'arayfer' },
  },
  {
    id: 'lia-lewis-freestyle', name: 'Lia Lewis', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Freestyler femenina de fútbol. Referente del freestyle femenino en España.',
    handles: { tiktok: '@lialewisfreestyle', instagram: 'lialewisfreestyle', twitter: 'lialewisFS' },
  },

  // ── FÚTBOL — Más periodismo y análisis digital ────────────────

  {
    id: 'josepdt11', name: 'Josep de Tena', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'periodistas',
    subtitle: 'Periodista de fútbol TikTok-native. Análisis y noticias virales.',
    handles: { tiktok: '@josepdt11', instagram: 'josepdt11', twitter: 'josepdt11' },
  },

  // ══════════════════════════════════════════════════════════════
  // BALONCESTO
  // ══════════════════════════════════════════════════════════════

  {
    id: 'arigeli', name: 'Arigeli', country: 'ES', emoji: '🇪🇸',
    sport: 'baloncesto', category: 'creadores',
    subtitle: '3.7M TikTok. La mayor creadora de baloncesto de España. Basket 3x3.',
    handles: { tiktok: '@arigeli', instagram: 'arigelicf', twitter: 'arigeli' },
  },
  {
    id: 'santi-aldama', name: 'Santi Aldama', country: 'ES', emoji: '🇪🇸',
    sport: 'baloncesto', category: 'creadores',
    subtitle: 'Jugador español en la NBA (Memphis Grizzlies). Activo creador de contenido.',
    handles: { tiktok: '@santialdama', instagram: 'santialdama', twitter: 'SantiAldama' },
  },
  {
    id: 'fuentexnba', name: 'FuentexNBA', country: 'ES', emoji: '🇪🇸',
    sport: 'baloncesto', category: 'creadores',
    subtitle: 'Análisis y noticias de la NBA en español. Referente de la comunidad basket.',
    handles: { tiktok: '@fuentexnba', instagram: 'fuentexnba', youtube: '@fuentexnba', twitter: 'FuentexNBA' },
  },
  {
    id: 'aircriss-basket', name: 'Aircriss', country: 'ES', emoji: '🇪🇸',
    sport: 'baloncesto', category: 'creadores',
    subtitle: 'Creador de contenido de baloncesto y NBA 2K. Grandes seguidores en España.',
    handles: { tiktok: '@aircriss', instagram: 'aircriss', youtube: '@AIRCRISS', twitter: 'AirCriss' },
  },
  {
    id: 'jordi-galvez', name: 'JustBasket', country: 'ES', emoji: '🇪🇸',
    sport: 'baloncesto', category: 'creadores',
    subtitle: '450K TikTok. Canal de análisis NBA en español. Uno de los más seguidos del basket.',
    handles: { tiktok: '@jordi.galvez4', instagram: 'justbasket7', twitter: 'JordGalvez' },
  },
  {
    id: 'baloncesto-espana', name: 'Baloncesto España', country: 'ES', emoji: '🇪🇸',
    sport: 'baloncesto', category: 'creadores',
    subtitle: 'Federación Española de Baloncesto. Canal oficial de la selección española.',
    handles: { tiktok: '@baloncestoespoficial', instagram: 'baloncestoespoficial', youtube: '@BaloncestoEspana', twitter: 'BaloncestoESP' },
  },

  // ══════════════════════════════════════════════════════════════
  // PÁDEL
  // ══════════════════════════════════════════════════════════════

  {
    id: 'arturo-coello', name: 'Arturo Coello', country: 'ES', emoji: '🇪🇸',
    sport: 'padel', category: 'creadores',
    subtitle: 'Top 5 mundial de pádel. 666K Instagram. La nueva estrella del deporte.',
    handles: { instagram: 'arturocoello', tiktok: '@arturocoello', twitter: 'arturocoello0' },
  },
  {
    id: 'mapi-alayeto', name: 'Mapi Sánchez Alayeto', country: 'ES', emoji: '🇪🇸',
    sport: 'padel', category: 'creadores',
    subtitle: 'Ex nº1 del mundo en pádel femenino. Referente y creadora de contenido.',
    handles: { instagram: 'mapisalayeto', tiktok: '@mapisalayeto', twitter: 'mapisalayeto' },
  },
  {
    id: 'majo-alayeto', name: 'Majo Sánchez Alayeto', country: 'ES', emoji: '🇪🇸',
    sport: 'padel', category: 'creadores',
    subtitle: 'Jugadora profesional. Gemela de Mapi. Referente del pádel femenino.',
    handles: { instagram: 'majosalayeto', tiktok: '@majosalayeto', twitter: 'majosalayeto' },
  },

  // ══════════════════════════════════════════════════════════════
  // MOTOGP / MOTOR
  // ══════════════════════════════════════════════════════════════

  {
    id: 'motogp-oficial', name: 'MotoGP Oficial', country: 'INT', emoji: '🌍',
    sport: 'motogp', category: 'creadores',
    subtitle: '4.6M TikTok. Canal oficial del Campeonato del Mundo de MotoGP.',
    handles: { tiktok: '@motogp', instagram: 'motogp', youtube: '@MotoGP', twitter: 'MotoGP' },
  },
  {
    id: 'pecco-bagnaia', name: 'Francesco Bagnaia', country: 'IT', emoji: '🇮🇹',
    sport: 'motogp', category: 'creadores',
    subtitle: 'Doble campeón del mundo de MotoGP. La estrella italiana del paddock.',
    handles: { instagram: 'francescobagnaia', tiktok: '@francescobagnaia', twitter: 'PeccoBagnaia' },
  },
  {
    id: 'fabio-quartararo', name: 'Fabio Quartararo', country: 'FR', emoji: '🇫🇷',
    sport: 'motogp', category: 'creadores',
    subtitle: 'Campeón del mundo 2021 de MotoGP. "El Diablo". Gran presencia digital.',
    handles: { instagram: 'fabioquartararo20', tiktok: '@fabioquartararo20', twitter: 'FabioQ20' },
  },

  // ══════════════════════════════════════════════════════════════
  // FÓRMULA 1 (adicionales)
  // ══════════════════════════════════════════════════════════════

  {
    id: 'f1-oficial', name: 'Fórmula 1 Oficial', country: 'INT', emoji: '🌍',
    sport: 'formula1', category: 'creadores',
    subtitle: 'Canal oficial de la F1. El deporte de motor que más ha crecido en redes sociales.',
    handles: { tiktok: '@f1', instagram: 'f1', youtube: '@F1', twitter: 'F1' },
  },
  {
    id: 'george-russell-f1', name: 'George Russell', country: 'GB', emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    sport: 'formula1', category: 'creadores',
    subtitle: 'Piloto Mercedes F1. Gran presencia en TikTok y uno de los más seguidos en F1.',
    handles: { tiktok: '@georgerussell63', instagram: 'georgerussell63', twitter: 'GeorgeRussell63' },
  },
  {
    id: 'oscar-piastri-f1', name: 'Oscar Piastri', country: 'AU', emoji: '🇦🇺',
    sport: 'formula1', category: 'creadores',
    subtitle: 'Piloto McLaren F1. El joven campeón del mundo 2024 con gran presencia digital.',
    handles: { instagram: 'oscarpiastri', tiktok: '@oscarpiastri', twitter: 'OscarPiastri' },
  },

  // ══════════════════════════════════════════════════════════════
  // ATLETISMO / OTROS DEPORTES OLÍMPICOS
  // ══════════════════════════════════════════════════════════════

  {
    id: 'ana-peleteiro', name: 'Ana Peleteiro', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: '410K TikTok / 535K IG. Atleta olímpica española. Una de las deportistas más virales.',
    handles: { tiktok: '@apeleteirob', instagram: 'apeleteirob', twitter: 'AnaPeleteiro' },
  },
  {
    id: 'carolina-marin', name: 'Carolina Marín', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Campeona olímpica de bádminton. La deportista española más laureada del siglo.',
    handles: { instagram: 'carolinamarin', tiktok: '@carolinamarin', twitter: 'CarolinaMarin' },
  },

  // ══════════════════════════════════════════════════════════════
  // BOXEO (adicionales)
  // ══════════════════════════════════════════════════════════════

  {
    id: 'spartan-boxing', name: 'Spartan Boxing TV', country: 'MX', emoji: '🌎',
    sport: 'boxeo', category: 'creadores',
    subtitle: 'Canal de boxeo en español con clips y análisis de las grandes peleas.',
    handles: { tiktok: '@spartansboxingtv', instagram: 'spartansboxingtv', youtube: '@SpartanBoxingTV', twitter: 'SpartanBoxingTV' },
  },
  {
    id: 'david-benavidez', name: 'David Benavídez', country: 'US', emoji: '🇺🇸',
    sport: 'boxeo', category: 'creadores',
    subtitle: 'El Monstruo Mexicano. Campeón supermedio WBC. Gran presencia en redes.',
    handles: { instagram: 'benavidez300', tiktok: '@davidbenavidez_', twitter: 'Benavidez300' },
  },
  {
    id: 'gervonta-davis', name: 'Gervonta Davis', country: 'US', emoji: '🇺🇸',
    sport: 'boxeo', category: 'creadores',
    subtitle: 'Tank Davis. Campeón múltiple del mundo. Enormes seguidores en Instagram.',
    handles: { instagram: 'gervontaa', tiktok: '@gervontaa', twitter: 'Gervontaa' },
  },
  {
    id: 'saul-ramos-box', name: 'Matchroom Boxing ES', country: 'ES', emoji: '🇪🇸',
    sport: 'boxeo', category: 'creadores',
    subtitle: 'La promotora de boxeo con más peleas de élite en España y América Latina.',
    handles: { instagram: 'matchroomboxing_es', tiktok: '@matchroomboxinges', twitter: 'MatchroomES' },
  },

  // ══════════════════════════════════════════════════════════════
  // TENIS (adicionales)
  // ══════════════════════════════════════════════════════════════

  {
    id: 'jannik-sinner', name: 'Jannik Sinner', country: 'IT', emoji: '🇮🇹',
    sport: 'tenis', category: 'creadores',
    subtitle: 'Nº1 del mundo ATP. El tenista más dominante de la era post-Djokovic.',
    handles: { instagram: 'janniksin', tiktok: '@janniksinner', twitter: 'janniksin' },
  },
  {
    id: 'novak-djokovic', name: 'Novak Djokovic', country: 'RS', emoji: '🇷🇸',
    sport: 'tenis', category: 'creadores',
    subtitle: 'El mayor ganador de Grand Slams de la historia. Leyenda del tenis.',
    handles: { instagram: 'djokernole', tiktok: '@djokernole', twitter: 'DjokerNole' },
  },
  {
    id: 'aryna-sabalenka', name: 'Aryna Sabalenka', country: 'BY', emoji: '🇧🇾',
    sport: 'tenis', category: 'creadores',
    subtitle: 'Nº1 WTA. La jugadora más dominante del circuito femenino. Gran presencia en redes.',
    handles: { instagram: 'arynasabalenka', tiktok: '@arynasabalenka', twitter: 'SabalenkaA' },
  },

  // ══════════════════════════════════════════════════════════════
  // CICLISMO (adicionales)
  // ══════════════════════════════════════════════════════════════

  {
    id: 'remco-evenepoel', name: 'Remco Evenepoel', country: 'BE', emoji: '🇧🇪',
    sport: 'ciclismo', category: 'creadores',
    subtitle: 'Campeón olímpico de ciclismo. La nueva estrella mundial del deporte.',
    handles: { instagram: 'remco.ev', tiktok: '@remcoevenepoel', twitter: 'EvenepoelRemco' },
  },
  {
    id: 'jonas-vingegaard', name: 'Jonas Vingegaard', country: 'DK', emoji: '🇩🇰',
    sport: 'ciclismo', category: 'creadores',
    subtitle: 'Doble ganador del Tour de Francia. El gran rival de Pogačar.',
    handles: { instagram: 'jonasvingegaard', tiktok: '@jonasvingegaard', twitter: 'JVingegaard' },
  },
  {
    id: 'marta-cavalli', name: 'Marta Cavalli', country: 'IT', emoji: '🇮🇹',
    sport: 'ciclismo', category: 'creadores',
    subtitle: 'Top ciclista femenina. Referente del ciclismo internacional.',
    handles: { instagram: 'martacavalli97', tiktok: '@martacavalli', twitter: 'MartaCavalli97' },
  },

  // ══════════════════════════════════════════════════════════════
  // BALONCESTO NBA — figuras globales que faltaban
  // ══════════════════════════════════════════════════════════════

  {
    id: 'giannis-antetokounmpo', name: 'Giannis Antetokounmpo', country: 'GR', emoji: '🇬🇷',
    sport: 'baloncesto', category: 'creadores',
    subtitle: 'El Freak. Doble MVP NBA y campeón con Milwaukee Bucks. Icono mundial.',
    handles: { instagram: 'giannis_an34', tiktok: '@giannisantetokounmpo34', twitter: 'Giannis_An34' },
  },
  {
    id: 'nikola-jokic', name: 'Nikola Jokić', country: 'RS', emoji: '🇷🇸',
    sport: 'baloncesto', category: 'creadores',
    subtitle: 'El Joker. Triple MVP NBA. El mejor jugador de la liga según muchos analistas.',
    handles: { instagram: 'nikolajokicofficial', twitter: 'jokicnikola' },
  },
  {
    id: 'luka-doncic', name: 'Luka Dončić', country: 'SI', emoji: '🇸🇮',
    sport: 'baloncesto', category: 'creadores',
    subtitle: 'Luka Magic. Dallas Mavericks. El europeo más dominante en la historia de la NBA.',
    handles: { instagram: 'luka7doncic', tiktok: '@lukadoncic', twitter: 'luka7doncic' },
  },
]

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}\n`)
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  const { data: existing } = await sb.from('ranking_entries')
    .select('id')
    .in('category', ['creadores', 'periodistas', 'creadores_wwe'])
  const existingIds = new Set((existing ?? []).map(e => e.id))

  const toInsert = [], toUpdate = []
  for (const c of NEW_CREATORS) {
    if (existingIds.has(c.id)) {
      toUpdate.push({ id: c.id, handles: c.handles })
      console.log(`  ~ UPD  [${c.sport.padEnd(18)}] ${c.name}`)
    } else {
      const { handles, ...entry } = c
      toInsert.push({ ...entry, handles, active: true, mediatico_auto: 50, narrativa_auto: 50 })
      console.log(`  + NEW  [${c.sport.padEnd(18)}] ${c.name}`)
    }
  }

  console.log(`\nNuevos: ${toInsert.length} | Actualizaciones: ${toUpdate.length}`)
  if (!APPLY) { console.log('\nDRY RUN.'); return }

  if (toInsert.length > 0) {
    const { error } = await sb.from('ranking_entries').insert(toInsert)
    if (error) { console.error('INSERT error:', error.message); return }
    console.log(`\nInsertados: ${toInsert.length} OK`)
  }
  for (const u of toUpdate) {
    const { error } = await sb.from('ranking_entries').update({ handles: u.handles }).eq('id', u.id)
    if (error) console.error(`UPD ${u.id}: ${error.message}`)
  }
  console.log('\nListo. Ejecuta: node scripts/ingest-creator-social.mjs --apply')
}

main().catch(err => { console.error(err); process.exit(1) })
