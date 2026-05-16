#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// expand-tiktok-instagram-creators.mjs
//
// Añade creadores nativos de TikTok e Instagram — personas que
// construyeron su audiencia en plataformas de contenido corto,
// no en YouTube/Twitch.
//
// Fuentes: TikTok Newsroom, Modash, Favikon, Heepsy (mayo 2026)
//
// Uso:
//   node scripts/expand-tiktok-instagram-creators.mjs           # DRY RUN
//   node scripts/expand-tiktok-instagram-creators.mjs --apply
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

  // ── FÚTBOL — creadores nativos TikTok España ──────────────────

  {
    id: 'elefutbol', name: 'elefutbol', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: '10M seguidores en TikTok. El narrador de fútbol más viral de España.',
    handles: { tiktok: '@elefutbol', instagram: 'elefutbol', youtube: '@elefutbol', twitter: 'elefutbol' },
  },
  {
    id: 'adri-contreras', name: 'Adri Contreras', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Premio TikTok Best Sports Creator 2025. Presidente de escudería Kings League.',
    handles: { tiktok: '@adricontreras4', instagram: 'adricontreras4', youtube: '@adricontreras4', twitter: 'AdrianContreras' },
  },

  // ── FÚTBOL — creadores nativos TikTok Latinoamérica ───────────

  {
    id: 'la-gambeta', name: 'La Gambeta', country: 'CO', emoji: '🌎',
    sport: 'futbol', category: 'creadores',
    subtitle: '6.5M en TikTok. Canal de fútbol latinoamericano con podcast y escuela libre.',
    handles: { tiktok: '@lagambetasports', instagram: 'lagambetasports', youtube: '@lagambetasports', twitter: 'LagambetaSports' },
  },
  {
    id: 'jero-freixas', name: 'Jero Freixas', country: 'AR', emoji: '🇦🇷',
    sport: 'futbol', category: 'creadores',
    subtitle: '3.6M TikTok / 3M Instagram. Humor y opinión futbolística argentina.',
    handles: { tiktok: '@jerofreixas', instagram: 'jerofreixas', twitter: 'JeroFreixas' },
  },
  {
    id: 'conrado-villagra', name: 'Conrado Villagra', country: 'AR', emoji: '🇦🇷',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Cerca de 10M en TikTok. Uno de los mayores creadores de fútbol de Argentina.',
    handles: { tiktok: '@conradovillagra', instagram: 'conradovillagra', twitter: 'ConradoVillagra' },
  },
  {
    id: 'javetas-arco', name: 'Javetas en el Arco', country: 'MX', emoji: '🇲🇽',
    sport: 'futbol', category: 'creadores',
    subtitle: '5M+ TikTok. Portero y creador. Ganó TikTok Awards "Crack de Cracks" 2024.',
    handles: { tiktok: '@javetasenelarco', instagram: 'javetasenelarco', twitter: 'javetasenelarco' },
  },
  {
    id: 'mich-oficial', name: 'Mich Oficial', country: 'MX', emoji: '🇲🇽',
    sport: 'futbol', category: 'creadores',
    subtitle: '4M TikTok. Corresponsal oficial TikTok × FIFA para el Mundial 2026.',
    handles: { tiktok: '@michoficial', instagram: 'michoficial', twitter: 'michoficial' },
  },
  {
    id: 'gerynna-sotelo', name: 'Gerynna Sotelo', country: 'MX', emoji: '🇲🇽',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Creadora femenina de fútbol. Corresponsal TikTok × FIFA para el Mundial 2026.',
    handles: { tiktok: '@gerynnasotelo', instagram: 'gerynnasotelo', twitter: 'GerynnaSotelo' },
  },
  {
    id: 'decabecita-mx', name: 'De Cabecita MX', country: 'MX', emoji: '🇲🇽',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Análisis y highlights de fútbol mexicano. Corresponsal TikTok × FIFA 2026.',
    handles: { tiktok: '@decabecita_mx', instagram: 'decabecita_mx', twitter: 'decabecita_mx' },
  },

  // ── FÚTBOL — canales oficiales que faltaban ───────────────────

  {
    id: 'sefutbol', name: 'Selección Española', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'La Roja. Campeones del Mundo 2010. Campeones de Europa 2024.',
    handles: { youtube: '@SeFutbol', instagram: 'sefutbol', tiktok: '@sefutbol', twitter: 'SeFutbol' },
  },
  {
    id: 'liga-mx', name: 'Liga MX', country: 'MX', emoji: '🇲🇽',
    sport: 'futbol', category: 'creadores',
    subtitle: 'La liga de fútbol más vista en televisión en EEUU. El fútbol de México.',
    handles: { youtube: '@LigaMXoficial', instagram: 'ligamxoficial', tiktok: '@ligamxoficial', twitter: 'LigaBBVAMX' },
  },
  {
    id: 'real-betis', name: 'Real Betis', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'El equipo con el social media más creativo y viral de LaLiga.',
    handles: { youtube: '@realbetisbalompie', instagram: 'realbetisbalompie', tiktok: '@realbetis', twitter: 'RealBetis' },
  },
  {
    id: 'sevilla-fc', name: 'Sevilla FC', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'El rey de la Europa League. Club histórico con millones de seguidores.',
    handles: { youtube: '@SevillaFC', instagram: 'sevillafc', tiktok: '@sevillafc', twitter: 'SevillaFC' },
  },
  {
    id: 'athletic-club', name: 'Athletic Club', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'El único grande de España que nunca ha descendido. Identidad única.',
    handles: { youtube: '@AthleticClub', instagram: 'athleticclub', tiktok: '@athleticclub', twitter: 'AthleticClub' },
  },
  {
    id: 'alaves-tiktok', name: 'Deportivo Alavés', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Club de LaLiga conocido por sus virales en TikTok.',
    handles: { tiktok: '@deportivoalaves', instagram: 'deportivoalaves', twitter: 'Alaves' },
  },
  {
    id: 'argentina-seleccion', name: 'Selección Argentina', country: 'AR', emoji: '🇦🇷',
    sport: 'futbol', category: 'creadores',
    subtitle: 'La Albiceleste. Campeones del Mundo 2022 en Qatar.',
    handles: { youtube: '@AFASeleccionArgentina', instagram: 'afaseleccionarg', tiktok: '@afaseleccionarg', twitter: 'Argentina' },
  },
  {
    id: 'mexico-seleccion', name: 'Selección México', country: 'MX', emoji: '🇲🇽',
    sport: 'futbol', category: 'creadores',
    subtitle: 'El Tri. La selección de fútbol con más aficionados en América del Norte.',
    handles: { youtube: '@FMFporlamundo', instagram: 'miseleccionmx', tiktok: '@miseleccionmx', twitter: 'miseleccion_mx' },
  },

  // ── FÚTBOL — Instagram-first, jugadores con gran presencia ────

  {
    id: 'dybala-content', name: 'Paulo Dybala', country: 'AR', emoji: '🇦🇷',
    sport: 'futbol', category: 'creadores',
    subtitle: 'La Joya. Jugador de AS Roma con una de las mejores marcas personales del fútbol.',
    handles: { instagram: 'paulodybala', tiktok: '@paulodybala', twitter: 'PauDybala' },
  },
  {
    id: 'modric-content', name: 'Luka Modrić', country: 'HR', emoji: '🇭🇷',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Balón de Oro 2018. Leyenda del Real Madrid. Ícono absoluto del fútbol.',
    handles: { instagram: 'lukamodric10', tiktok: '@lukamodric10', twitter: 'lukamodric10' },
  },
  {
    id: 'kroos-content', name: 'Toni Kroos', country: 'DE', emoji: '🇩🇪',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Leyenda del Real Madrid. Campeonísimo. Activo en redes desde su retirada.',
    handles: { instagram: 'toni.kr8s', tiktok: '@tonikroos', twitter: 'ToniKroos' },
  },

  // ── FÚTBOL — América latina, periodismo digital ───────────────

  {
    id: 'nacional-mx', name: 'Récord MX', country: 'MX', emoji: '🇲🇽',
    sport: 'futbol', category: 'periodistas',
    subtitle: 'Diario deportivo digital líder en México. Referente de la Liga MX.',
    handles: { youtube: '@diariorecord', instagram: 'record_mexico', tiktok: '@record_mx', twitter: 'record_mexico' },
  },
  {
    id: 'minutomundial', name: 'Minuto Mundial', country: 'MX', emoji: '🇲🇽',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Canal viral de resúmenes y clips de fútbol. Millones de seguidores en IG y TikTok.',
    handles: { youtube: '@MinutoMundial', instagram: 'minutomundial', tiktok: '@minutomundial', twitter: 'MinutoMundial' },
  },
  {
    id: 'futbolsites', name: 'FutbolSites', country: 'US', emoji: '🌎',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Red de medios de fútbol para hispanohablantes en EEUU y Latinoamérica.',
    handles: { youtube: '@FutbolSites', instagram: 'futbolsites', tiktok: '@futbolsites', twitter: 'FutbolSites' },
  },

  // ── PÁDEL — Instagram-first ───────────────────────────────────

  {
    id: 'agustin-tapia-padel', name: 'Agustín Tapia', country: 'AR', emoji: '🇦🇷',
    sport: 'padel', category: 'creadores',
    subtitle: 'Número 1 del mundo en pádel. El primero en superar 1M de seguidores en Instagram.',
    handles: { instagram: 'agustintapia_', tiktok: '@agustintapia', twitter: 'AgustinTapia_' },
  },
  {
    id: 'martin-di-nenno', name: 'Martín Di Nenno', country: 'AR', emoji: '🇦🇷',
    sport: 'padel', category: 'creadores',
    subtitle: 'Top 5 mundial de pádel. Gran presencia digital y embajador del deporte.',
    handles: { instagram: 'martindinenno', tiktok: '@martindinenno', twitter: 'martindinenno' },
  },

  // ── BALONCESTO — TikTok/Instagram ────────────────────────────

  {
    id: 'wembanyama-content', name: 'Victor Wembanyama', country: 'FR', emoji: '🇫🇷',
    sport: 'baloncesto', category: 'creadores',
    subtitle: 'El alienígena. La mayor promesa de la NBA. Enorme presencia en redes.',
    handles: { instagram: 'wemby', tiktok: '@wemby', twitter: 'wemby' },
  },
  {
    id: 'lebron-james', name: 'LeBron James', country: 'US', emoji: '🇺🇸',
    sport: 'baloncesto', category: 'creadores',
    subtitle: 'El mayor jugador de la historia de la NBA. Icono global con 160M+ en IG.',
    handles: { instagram: 'kingjames', tiktok: '@kingjames', twitter: 'KingJames' },
  },
  {
    id: 'stephcurry-content', name: 'Stephen Curry', country: 'US', emoji: '🇺🇸',
    sport: 'baloncesto', category: 'creadores',
    subtitle: 'El mejor tirador de 3 de la historia. Golden State Warriors.',
    handles: { instagram: 'stephencurry30', tiktok: '@stephencurry30', twitter: 'StephenCurry30' },
  },

  // ── FÓRMULA 1 — Instagram-first ──────────────────────────────

  {
    id: 'max-verstappen', name: 'Max Verstappen', country: 'NL', emoji: '🇳🇱',
    sport: 'formula1', category: 'creadores',
    subtitle: 'Tricampeón del mundo de F1 con Red Bull. La estrella más grande del deporte motor.',
    handles: { instagram: 'maxverstappen1', tiktok: '@maxverstappen1', twitter: 'Max33Verstappen' },
  },
  {
    id: 'charles-leclerc', name: 'Charles Leclerc', country: 'MC', emoji: '🇲🇨',
    sport: 'formula1', category: 'creadores',
    subtitle: 'Piloto de Ferrari. Uno de los más activos en redes dentro de la F1.',
    handles: { instagram: 'charles_leclerc', tiktok: '@charles_leclerc', twitter: 'Charles_Leclerc' },
  },

  // ── BOXEO — Instagram-first ───────────────────────────────────

  {
    id: 'ryan-garcia', name: 'Ryan García', country: 'US', emoji: '🇺🇸',
    sport: 'boxeo', category: 'creadores',
    subtitle: 'Boxeador con 10M+ en Instagram. El más viral del boxeo actual en redes.',
    handles: { instagram: 'kingrygarciaboxing', tiktok: '@ryangarcia', twitter: 'RyanGarcia' },
  },

  // ── MMA/UFC — Instagram-first ─────────────────────────────────

  {
    id: 'conor-mcgregor', name: 'Conor McGregor', country: 'IE', emoji: '🇮🇪',
    sport: 'ufc', category: 'creadores',
    subtitle: 'El luchador más famoso de la historia de la UFC. Icono absoluto de las MMA.',
    handles: { instagram: 'thenotoriousmma', tiktok: '@thenotoriousmma', twitter: 'TheNotoriousMMA' },
  },
  {
    id: 'islam-makhachev', name: 'Islam Makhachev', country: 'RU', emoji: '🇷🇺',
    sport: 'ufc', category: 'creadores',
    subtitle: 'Campeón del mundo peso ligero de la UFC. El dominador actual de las MMA.',
    handles: { instagram: 'islam_makhachev', tiktok: '@islammakhachev', twitter: 'MAKHACHEVMMA' },
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

  console.log('\nListo. Ejecuta:')
  console.log('  node scripts/ingest-creator-social.mjs --apply')
}

main().catch(err => { console.error(err); process.exit(1) })
