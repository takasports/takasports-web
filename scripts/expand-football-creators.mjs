#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// expand-football-creators.mjs
//
// Segunda ronda de expansión — fútbol específicamente.
// Añade estrellas actuales, leyendas, canales oficiales y media.
//
// Uso:
//   node scripts/expand-football-creators.mjs           # DRY RUN
//   node scripts/expand-football-creators.mjs --apply
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

  // ── ESTRELLAS ACTUALES — presencia masiva en redes ────────────

  {
    id: 'vinicius-jr', name: 'Vinicius Jr.', country: 'BR', emoji: '🇧🇷',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Estrella del Real Madrid. Uno de los futbolistas más seguidos del mundo.',
    handles: { youtube: '@ViniciusJr', instagram: 'vinijr', tiktok: '@viniiciusjr', twitter: 'ViniJr' },
  },
  {
    id: 'mbappe-content', name: 'Kylian Mbappé', country: 'FR', emoji: '🇫🇷',
    sport: 'futbol', category: 'creadores',
    subtitle: 'El jugador más rápido del mundo. Estrella del Real Madrid y Francia.',
    handles: { youtube: '@KMbappe', instagram: 'k.mbappe', tiktok: '@k.mbappe', twitter: 'KMbappe' },
  },
  {
    id: 'pedri-content', name: 'Pedri', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'El centrocampista más prometedor de su generación. FC Barcelona.',
    handles: { instagram: 'pedri', tiktok: '@pedri', twitter: 'Pedri' },
  },
  {
    id: 'lamine-yamal', name: 'Lamine Yamal', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'El jugador más joven en ganar la Eurocopa. Fenómeno del FC Barcelona.',
    handles: { instagram: 'lamineyamal09', tiktok: '@lamineyamal', twitter: 'LamineYamal' },
  },
  {
    id: 'neymar-content', name: 'Neymar Jr.', country: 'BR', emoji: '🇧🇷',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Uno de los futbolistas con más seguidores del planeta. Icono cultural.',
    handles: { youtube: '@neymarjr', instagram: 'neymarjr', tiktok: '@neymarjr', twitter: 'neymarjr' },
  },
  {
    id: 'benzema-content', name: 'Karim Benzema', country: 'FR', emoji: '🇫🇷',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Balón de Oro 2022. Leyenda del Real Madrid. Activo en redes.',
    handles: { instagram: 'karimbenzema', tiktok: '@benzema', twitter: 'Benzema' },
  },
  {
    id: 'haaland-content', name: 'Erling Haaland', country: 'NO', emoji: '🇳🇴',
    sport: 'futbol', category: 'creadores',
    subtitle: 'La máquina de hacer goles del Manchester City. Estrella global.',
    handles: { instagram: 'erling.haaland', tiktok: '@erling.haaland', twitter: 'ErlingHaaland' },
  },
  {
    id: 'aitana-creator', name: 'Aitana Bonmatí', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Dos veces Balón de Oro. La mejor jugadora del mundo. FC Barcelona.',
    handles: { instagram: 'aitanabonmati', tiktok: '@aitanabonmati', twitter: 'AitanaBonmati' },
  },
  {
    id: 'bellingham-content', name: 'Jude Bellingham', country: 'GB', emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    sport: 'futbol', category: 'creadores',
    subtitle: 'El centrocampista inglés del Real Madrid. Uno de los mejores del mundo.',
    handles: { instagram: 'judebellingham', tiktok: '@judebellingham', twitter: 'BellinghamJude' },
  },
  {
    id: 'rodri-content', name: 'Rodri', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Balón de Oro 2024. El mejor centrocampista del mundo. Manchester City.',
    handles: { instagram: 'rodrigo.h19', tiktok: '@rodri.hernandez', twitter: 'RodriHernandez' },
  },

  // ── LEYENDAS — activas en redes sociales ─────────────────────

  {
    id: 'ronaldinho-content', name: 'Ronaldinho', country: 'BR', emoji: '🇧🇷',
    sport: 'futbol', category: 'creadores',
    subtitle: 'El mago del fútbol. Uno de los legados más queridos del deporte.',
    handles: { instagram: 'ronaldinho', tiktok: '@ronaldinho10', twitter: 'Ronaldinho' },
  },
  {
    id: 'raul-content', name: 'Raúl González', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'La leyenda del Real Madrid. Referente del fútbol español.',
    handles: { instagram: 'raulgonzalez', twitter: 'RaulGonzalez' },
  },
  {
    id: 'iniesta-content', name: 'Andrés Iniesta', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'El autor del gol del Mundial 2010. Leyenda del Barça y España.',
    handles: { instagram: 'andresiniesta8', tiktok: '@andresiniesta', twitter: 'andresiniesta8' },
  },
  {
    id: 'roberto-carlos-content', name: 'Roberto Carlos', country: 'BR', emoji: '🇧🇷',
    sport: 'futbol', category: 'creadores',
    subtitle: 'El lateral izquierdo más legendario de la historia. Real Madrid.',
    handles: { instagram: 'roberto_carlos', tiktok: '@roberto_carlos', twitter: 'RobertoCarlos' },
  },
  {
    id: 'zidane-content', name: 'Zinedine Zidane', country: 'FR', emoji: '🇫🇷',
    sport: 'futbol', category: 'creadores',
    subtitle: 'El mejor jugador del mundo en su época. Campeón del mundo con Francia.',
    handles: { instagram: 'zidane', twitter: 'zidane' },
  },
  {
    id: 'xavi-content', name: 'Xavi Hernández', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Leyenda del FC Barcelona. Exentrenador azulgrana.',
    handles: { instagram: 'xavihernandez', tiktok: '@xavihernandez', twitter: 'Xavi' },
  },
  {
    id: 'ronaldo-r9', name: 'Ronaldo Nazário', country: 'BR', emoji: '🇧🇷',
    sport: 'futbol', category: 'creadores',
    subtitle: 'El Fenómeno. El mejor delantero de la historia según muchos. Ahora inversor.',
    handles: { instagram: 'ronaldo', tiktok: '@ronaldo', twitter: 'Ronaldo' },
  },
  {
    id: 'deco-content', name: 'Deco', country: 'PT', emoji: '🇵🇹',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Exjugador del Barça y director deportivo azulgrana. Referente luso.',
    handles: { instagram: 'deco_official', twitter: 'Deco_Official' },
  },

  // ── CANALES OFICIALES ─────────────────────────────────────────

  {
    id: 'laliga-oficial', name: 'LaLiga', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'La liga de fútbol más seguida en español en el mundo.',
    handles: { youtube: '@LaLiga', instagram: 'laliga', tiktok: '@laliga', twitter: 'LaLiga' },
  },
  {
    id: 'real-madrid-canal', name: 'Real Madrid CF', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'El club con más Copas de Europa. El mayor canal oficial de fútbol en español.',
    handles: { youtube: '@realmadrid', instagram: 'realmadrid', tiktok: '@realmadrid', twitter: 'realmadrid' },
  },
  {
    id: 'fc-barcelona-canal', name: 'FC Barcelona', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'El club más seguido en redes sociales de España. Mes que un club.',
    handles: { youtube: '@FCBarcelona_es', instagram: 'fcbarcelona', tiktok: '@fcbarcelona', twitter: 'FCBarcelona_es' },
  },
  {
    id: 'atletico-canal', name: 'Atlético de Madrid', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'El tercer grande de España. Campeones de LaLiga y finalistas de Champions.',
    handles: { youtube: '@atleticodemadrid', instagram: 'atleticodemadrid', tiktok: '@atleticodemadrid', twitter: 'Atleti' },
  },
  {
    id: 'uefa-espanol', name: 'UEFA en Español', country: 'CH', emoji: '🌍',
    sport: 'futbol', category: 'creadores',
    subtitle: 'El organismo rector del fútbol europeo. Champions League y más.',
    handles: { youtube: '@UEFAenespanol', instagram: 'uefa', tiktok: '@uefa', twitter: 'UEFA' },
  },
  {
    id: '433-espanol', name: '433 en Español', country: 'NL', emoji: '🌍',
    sport: 'futbol', category: 'creadores',
    subtitle: 'El canal de fútbol viral más grande del mundo en español.',
    handles: { youtube: '@433', instagram: '433', tiktok: '@433', twitter: '433' },
  },

  // ── MEDIOS Y PERIODISTAS QUE FALTABAN ────────────────────────

  {
    id: 'edu-aguirre', name: 'Edu Aguirre', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'periodistas',
    subtitle: 'Periodista íntimo de Cristiano Ronaldo. El Chiringuito y redes.',
    handles: { instagram: 'eduaguirre7', twitter: 'EduAguirre7' },
  },
  {
    id: 'alfredo-martinez', name: 'Alfredo Martínez', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'periodistas',
    subtitle: 'Periodista de Antena 3 y onda cero. Especialista en Real Madrid.',
    handles: { instagram: 'alfredo_martinez_t', twitter: 'AlfredoMartinz' },
  },
  {
    id: 'siro-lopez', name: 'Siro López', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'periodistas',
    subtitle: 'Periodista deportivo. Colaborador de El Chiringuito y redes sociales.',
    handles: { instagram: 'sirolopez', twitter: 'sirolopez' },
  },
  {
    id: 'marc-bartra-periodista', name: 'Jorge Valdano', country: 'AR', emoji: '🇦🇷',
    sport: 'futbol', category: 'periodistas',
    subtitle: 'Exjugador y exdirector deportivo del Real Madrid. Analista de referencia.',
    handles: { instagram: 'jorgevaldano', twitter: 'JorgeValdano' },
  },
  {
    id: 'telemundo-deportes', name: 'Telemundo Deportes', country: 'US', emoji: '🌎',
    sport: 'futbol', category: 'creadores',
    subtitle: 'La mayor cadena de deportes en español de Estados Unidos.',
    handles: { youtube: '@TelemundoDeportes', instagram: 'telemundodeportes', tiktok: '@telemundodeportes', twitter: 'TelemundoSports' },
  },
  {
    id: 'espn-deportes', name: 'ESPN Deportes', country: 'US', emoji: '🌎',
    sport: 'futbol', category: 'creadores',
    subtitle: 'ESPN en español. Fútbol, NBA, NFL y todo el deporte de habla hispana.',
    handles: { youtube: '@ESPNDeportes', instagram: 'espndeportes', tiktok: '@espndeportes', twitter: 'ESPNDeportes' },
  },
  {
    id: 'univision-deportes', name: 'Univision Deportes', country: 'US', emoji: '🌎',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Deportes en español para la audiencia hispanohablante en EEUU.',
    handles: { youtube: '@UnivisionDeportes', instagram: 'univisiondeportes', tiktok: '@univisiondeportes', twitter: 'UnivisionSports' },
  },
  {
    id: 'cronuts-info', name: 'Cronuts de la Información', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Noticias de fútbol en formato ultra-viral. Uno de los canales que más crece.',
    handles: { youtube: '@CronutsDeLaInformacion', instagram: 'cronutsdelainformacion', tiktok: '@cronutsdelainformacion', twitter: 'CronutsInfo' },
  },
  {
    id: 'mister-v', name: 'MisterV', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'El canal de análisis táctico y periodístico del fútbol español más riguroso.',
    handles: { youtube: '@MisterVFutbol', instagram: 'mistervfutbol', tiktok: '@mistervfutbol', twitter: 'MisterVFutbol' },
  },
  {
    id: 'tyc-sports', name: 'TyC Sports', country: 'AR', emoji: '🇦🇷',
    sport: 'futbol', category: 'creadores',
    subtitle: 'El canal de deportes más importante de Argentina. Referente de habla hispana.',
    handles: { youtube: '@tycsports', instagram: 'tycsports', tiktok: '@tycsports', twitter: 'TyCSports' },
  },
  {
    id: 'ole-digital', name: 'Olé Digital', country: 'AR', emoji: '🇦🇷',
    sport: 'futbol', category: 'creadores',
    subtitle: 'El diario deportivo más icónico de Argentina. Referente del fútbol latinoamericano.',
    handles: { youtube: '@Ole', instagram: 'ole_argentina', tiktok: '@ole_argentina', twitter: 'ColeccionableOle' },
  },
  {
    id: 'infobae-deportes', name: 'Infobae Deportes', country: 'AR', emoji: '🌎',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Sección deportiva del mayor medio digital en español de Latinoamérica.',
    handles: { youtube: '@infobae', instagram: 'infobae', tiktok: '@infobae', twitter: 'infobae' },
  },

  // ── CREADORES DIGITALES QUE FALTABAN ─────────────────────────

  {
    id: 'ochoa-portero', name: 'Guillermo Ochoa', country: 'MX', emoji: '🇲🇽',
    sport: 'futbol', category: 'creadores',
    subtitle: 'El portero mexicano más icónico. Activo creador de contenido.',
    handles: { instagram: 'yosoy8a', tiktok: '@yosoy8a', twitter: 'yosoy8a' },
  },
  {
    id: 'hirving-lozano', name: 'Hirving Lozano', country: 'MX', emoji: '🇲🇽',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Chucky Lozano. El jugador mexicano más mediático de su generación.',
    handles: { instagram: 'chicharito14', tiktok: '@chucky_lozano', twitter: 'hirvinglozano' },
  },
  {
    id: 'canales-juego', name: 'Canales de Juego', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Análisis y tácticas del fútbol español en formato accesible.',
    handles: { youtube: '@CanalesdeJuego', instagram: 'canales_de_juego', twitter: 'CanalesdeJuego' },
  },
  {
    id: 'futbol-total', name: 'Fútbol Total', country: 'MX', emoji: '🇲🇽',
    sport: 'futbol', category: 'creadores',
    subtitle: 'El canal de fútbol más visto de México. Cobertura Liga MX y selección.',
    handles: { youtube: '@FutbolTotal', instagram: 'futboltotal', tiktok: '@futboltotal', twitter: 'FutbolTotal' },
  },
  {
    id: 'marca-deporte', name: 'Marca', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'periodistas',
    subtitle: 'El diario deportivo más leído de España. El mayor referente del fútbol español.',
    handles: { youtube: '@marca', instagram: 'marcacom', tiktok: '@marcacom', twitter: 'marca' },
  },
  {
    id: 'as-deporte', name: 'AS Diario', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'periodistas',
    subtitle: 'Uno de los diarios deportivos de referencia en España y América Latina.',
    handles: { youtube: '@AS_Diario', instagram: 'asdiario', tiktok: '@asdiario', twitter: 'diarioas' },
  },
  {
    id: 'sport-diario', name: 'SPORT', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'periodistas',
    subtitle: 'Diario deportivo catalán. Especializado en FC Barcelona.',
    handles: { youtube: '@sport_es', instagram: 'sportcat', tiktok: '@sport_cat', twitter: 'sport' },
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
