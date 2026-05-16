#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// expand-creators-periodistas-v3.mjs
//
// Tercera ronda: creadores TikTok nativos + periodistas y
// comentaristas deportivos de España, México, Argentina y Colombia.
//
// Fuentes: TikTok Awards España 2025, TikTok×FIFA Mundial 2026,
// Brandwatch, Favikon, Poli Grancolombiano, medios propios.
//
// Uso:
//   node scripts/expand-creators-periodistas-v3.mjs           # DRY RUN
//   node scripts/expand-creators-periodistas-v3.mjs --apply
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
  // CREADORES TIKTOK — España (nuevos)
  // ══════════════════════════════════════════════════════════════

  {
    id: 'dani-castilla', name: 'Dani Castilla', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Premio TikTok Sports Creator 2025 España. 2M TikTok. Atleta y creator viral.',
    handles: { tiktok: '@danicastilla.tf', instagram: 'danicastilla.tf', twitter: 'DaniCastillaES' },
  },
  {
    id: 'anto-zambrana', name: 'Anto Zambrana', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Nominado TikTok Awards España 2025. Contenido viral de fútbol en TikTok.',
    handles: { tiktok: '@anto.zambrana', instagram: 'anto.zambrana', twitter: 'antozambrana' },
  },
  {
    id: 'marcatoons', name: 'Marcatoons', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: '324K TikTok. Parodias animadas de fútbol. Humor con caricaturas de jugadores.',
    handles: { tiktok: '@.mtoons', instagram: 'marcatoons', youtube: '@marcatoons', twitter: 'marcatoons' },
  },
  {
    id: 'iker-ruizdb', name: 'Iker Ruiz (personal)', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Creador de @elefutbol. Cuenta personal con historias y narrativa futbolística.',
    handles: { tiktok: '@iker_ruizdb', instagram: 'iker_ruizdb', youtube: '@iker_ruizdb', twitter: 'iker_ruizdb' },
  },
  {
    id: 'vero-boquete', name: 'Verónica Boquete', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Exfutbolista internacional. Creadora de contenido sobre fútbol femenino e igualdad.',
    handles: { instagram: 'veroboquete', youtube: '@VayaVaina', twitter: 'VeroBoquete' },
  },

  // ── CREADORES TIKTOK — México (nuevos) ───────────────────────

  {
    id: 'figuron-tv', name: 'Figurón TV', country: 'MX', emoji: '🇲🇽',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Corresponsal TikTok×FIFA Mundial 2026. Humor y análisis del fútbol mexicano.',
    handles: { tiktok: '@figurontv', instagram: 'figurontv', youtube: '@figurontv', twitter: 'figurontv' },
  },
  {
    id: 'sebas-fernandez-co', name: 'Sebas Fernández', country: 'CO', emoji: '🇨🇴',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Corresponsal TikTok×FIFA 2026. Entrevistas virales con jugadores profesionales.',
    handles: { tiktok: '@sebasfernandez', instagram: 'sebasfernandez', twitter: 'sebasfernandez' },
  },
  {
    id: 'valentina-genty', name: 'Valentina Genty', country: 'AR', emoji: '🇦🇷',
    sport: 'futbol', category: 'periodistas',
    subtitle: 'Periodista argentina de fútbol. Mezcla datos reales con humor en TikTok.',
    handles: { tiktok: '@valentinagenty', instagram: 'valentinagenty', twitter: 'valentinagenty' },
  },

  // ══════════════════════════════════════════════════════════════
  // PERIODISTAS — España
  // ══════════════════════════════════════════════════════════════

  {
    id: 'jota-jordi', name: 'Jota Jordi', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'periodistas',
    subtitle: '846K Twitter / 506K IG. Colaborador de El Chiringuito. Canal "Solo para culés".',
    handles: { tiktok: '@jotajordi', instagram: 'jotajordi', youtube: '@JotaJordi', twitter: 'jotajordi13' },
  },
  {
    id: 'cristobal-soria', name: 'Cristóbal Soria', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'periodistas',
    subtitle: 'El Sevillista de El Chiringuito. Polémica y pasión. Millones de interacciones.',
    handles: { instagram: 'cristobalsoria', youtube: '@CristobalSoria', twitter: 'cristobalsoria' },
  },
  {
    id: 'iturralde-gonzalez', name: 'Iturralde González', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'periodistas',
    subtitle: 'Ex árbitro de Primera División. Analista arbitral y táctico en El Chiringuito y ESPN.',
    handles: { instagram: 'iturraldegonzal', youtube: '@IturraldeyGonzalez', twitter: 'iturraldegonzal' },
  },
  {
    id: 'manu-carreno', name: 'Manu Carreño', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'periodistas',
    subtitle: 'Director de El Larguero (Cadena SER). El nocturno deportivo más escuchado de España.',
    handles: { instagram: 'manucarreno', youtube: '@ElLarguero', twitter: 'manucarreno' },
  },
  {
    id: 'juanma-castano', name: 'Juanma Castaño', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'periodistas',
    subtitle: 'Director de El Partidazo (COPE). Renovado hasta 2030. Referente del periodismo nocturno.',
    handles: { instagram: 'juanmacastano', youtube: '@ElPartidazo', twitter: 'juanmacastano' },
  },
  {
    id: 'paco-gonzalez', name: 'Paco González', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'periodistas',
    subtitle: 'Director de Tiempo de Juego (COPE). La voz más reconocida del fútbol en radio.',
    handles: { instagram: 'pacogonzalezoficial', youtube: '@TiempodeJuego', twitter: 'pacogonzalezof' },
  },
  {
    id: 'manolo-lama', name: 'Manolo Lama', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'periodistas',
    subtitle: 'Jefe de deportes de COPE. Narrador histórico de la Champions League.',
    handles: { instagram: 'manololama', youtube: '@COPE', twitter: 'manololama' },
  },
  {
    id: 'carlos-martinez-tv', name: 'Carlos Martínez', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'periodistas',
    subtitle: 'La voz de la Champions League en Movistar+. Presentador de Vamos.',
    handles: { instagram: 'carlosmartineztv', youtube: '@Vamos', twitter: 'carlosmartineztv' },
  },
  {
    id: 'jordi-marti', name: 'Jordi Martí', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'periodistas',
    subtitle: '300K Twitter. Periodista del Barça. Columnista en Sport y tertuliano.',
    handles: { instagram: 'jordimarti10', twitter: 'jordimarti10' },
  },

  // ══════════════════════════════════════════════════════════════
  // PERIODISTAS — México
  // ══════════════════════════════════════════════════════════════

  {
    id: 'martinoli-garcia', name: 'Farsantes con Gloria', country: 'MX', emoji: '🇲🇽',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Martinoli + Luis García. 1M suscriptores YouTube. Récord de audiencia en Copa Oro 2025.',
    handles: { youtube: '@FarsantesConGloria', instagram: 'farsantescongloria', twitter: 'FarsantesGloria' },
  },
  {
    id: 'christian-martinoli', name: 'Christian Martinoli', country: 'MX', emoji: '🇲🇽',
    sport: 'futbol', category: 'periodistas',
    subtitle: 'El narrador más irreverente y querido de México. TV Azteca. Farsantes con Gloria.',
    handles: { instagram: 'martinolisports', youtube: '@christianmartinoli', twitter: 'martinolisports' },
  },
  {
    id: 'luis-garcia-dr', name: 'Luis García "El Doctor"', country: 'MX', emoji: '🇲🇽',
    sport: 'futbol', category: 'periodistas',
    subtitle: 'Exfutbolista y analista. Co-creador de Farsantes con Gloria. Ícono de TV Azteca.',
    handles: { instagram: 'luisgarcia4', youtube: '@luisgarcia4', twitter: 'luisgarcia4' },
  },
  {
    id: 'joserra-espn', name: 'José Ramón Fernández', country: 'MX', emoji: '🇲🇽',
    sport: 'futbol', category: 'periodistas',
    subtitle: 'El decano del periodismo deportivo mexicano. Décadas en ESPN México.',
    handles: { instagram: 'joseramonfernandez', twitter: 'joserra_espn' },
  },
  {
    id: 'jorge-pietrasanta', name: 'Jorge Pietrasanta', country: 'MX', emoji: '🇲🇽',
    sport: 'futbol', category: 'periodistas',
    subtitle: 'Narrador de ESPN México. Una de las voces más reconocidas del fútbol en México.',
    handles: { instagram: 'jorgepietrasanta_', twitter: 'jorgepietrasanta' },
  },
  {
    id: 'quique-garay', name: 'Enrique Garay', country: 'MX', emoji: '🇲🇽',
    sport: 'futbol', category: 'periodistas',
    subtitle: 'Periodista deportivo de televisión. Cubre fútbol, NFL y NBA en México.',
    handles: { instagram: 'quiquegaray_', twitter: 'EnriqueGaray' },
  },
  {
    id: 'tudn-oficial', name: 'TUDN', country: 'MX', emoji: '🇲🇽',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Televisa Univisión Deportes. El mayor canal de deportes en español de EEUU y México.',
    handles: { youtube: '@TUDN', instagram: 'tudn_usa', tiktok: '@tudn', twitter: 'TUDN_USA' },
  },

  // ══════════════════════════════════════════════════════════════
  // PERIODISTAS — Argentina
  // ══════════════════════════════════════════════════════════════

  {
    id: 'horacio-pagani', name: 'Horacio Pagani', country: 'AR', emoji: '🇦🇷',
    sport: 'futbol', category: 'periodistas',
    subtitle: '1.2M Twitter. Periodista histórico argentino. Programa Bendita en El Nueve.',
    handles: { instagram: 'horaciopagani', twitter: 'HoracioPagani' },
  },
  {
    id: 'walter-queijeiro', name: 'Walter Queijeiro', country: 'AR', emoji: '🇦🇷',
    sport: 'futbol', category: 'periodistas',
    subtitle: '1.2M Twitter. Periodista deportivo argentino. Análisis de fútbol y selección.',
    handles: { instagram: 'walterqueijeiro', twitter: 'WalterQueijeiro' },
  },
  {
    id: 'antonio-casale', name: 'Antonio Casale', country: 'AR', emoji: '🇦🇷',
    sport: 'futbol', category: 'periodistas',
    subtitle: '1.1M Twitter. Comunicador deportivo argentino. Fútbol, tenis y deporte general.',
    handles: { instagram: 'antoniocasale', twitter: 'antoniocasale' },
  },
  {
    id: 'sebastian-vignolo', name: 'Sebastián Vignolo', country: 'AR', emoji: '🇦🇷',
    sport: 'futbol', category: 'periodistas',
    subtitle: '"El Pollo". Presentador estelar de ESPN Argentina. 600K Twitter. Ídolo de la tertulia.',
    handles: { instagram: 'sebavignolo', twitter: 'SEBAVignolo' },
  },
  {
    id: 'gaston-edul', name: 'Gastón Edul', country: 'AR', emoji: '🇦🇷',
    sport: 'futbol', category: 'periodistas',
    subtitle: '400K Twitter. TyC Sports. Enviado especial a Mundiales. Fuente de la selección argentina.',
    handles: { instagram: 'gastonedul', twitter: 'gastonedul' },
  },
  {
    id: 'mariano-closs', name: 'Mariano Closs', country: 'AR', emoji: '🇦🇷',
    sport: 'futbol', category: 'periodistas',
    subtitle: 'Narrador icónico de ESPN Argentina. Su voz aparece en videojuegos (eFootball).',
    handles: { instagram: 'marianocloss', twitter: 'MarianoCloss' },
  },
  {
    id: 'alina-moine', name: 'Alina Moine', country: 'AR', emoji: '🇦🇷',
    sport: 'futbol', category: 'periodistas',
    subtitle: 'Periodista deportiva argentina. Referente del periodismo femenino en deportes.',
    handles: { instagram: 'alinamoine', twitter: 'alinamoine' },
  },
  {
    id: 'angela-lerena', name: 'Ángela Lerena', country: 'AR', emoji: '🇦🇷',
    sport: 'futbol', category: 'periodistas',
    subtitle: 'Primera mujer en narrar un partido de Primera División en Argentina. Histórica.',
    handles: { instagram: 'angelalerena', twitter: 'angelalerena' },
  },

  // ══════════════════════════════════════════════════════════════
  // PERIODISTAS — Colombia
  // ══════════════════════════════════════════════════════════════

  {
    id: 'carlos-velez', name: 'Carlos Antonio Vélez', country: 'CO', emoji: '🇨🇴',
    sport: 'futbol', category: 'periodistas',
    subtitle: '51 años en el periodismo. Director de Planeta Fútbol (Win Sports). El decano de Colombia.',
    handles: { instagram: 'velezfutbol', twitter: 'velezfutbol' },
  },
  {
    id: 'ivan-mejia', name: 'Iván Mejía Álvarez', country: 'CO', emoji: '🇨🇴',
    sport: 'futbol', category: 'periodistas',
    subtitle: 'Más de 50 años en medios colombianos. Muy activo en Twitter. Voz del periodismo deportivo.',
    handles: { twitter: 'IvanMejiaAlvarez' },
  },
  {
    id: 'nestor-morales', name: 'Néstor Morales', country: 'CO', emoji: '🇨🇴',
    sport: 'futbol', category: 'periodistas',
    subtitle: 'Voz de Gol Caracol. Narrador histórico del fútbol colombiano e internacional.',
    handles: { instagram: 'nestormorales', twitter: 'nestor_morales' },
  },
  {
    id: 'win-sports', name: 'Win Sports', country: 'CO', emoji: '🇨🇴',
    sport: 'futbol', category: 'creadores',
    subtitle: 'El canal de fútbol colombiano. Liga Betplay y fútbol latinoamericano.',
    handles: { youtube: '@winsports', instagram: 'winsports', tiktok: '@winsports', twitter: 'WinSportsTV' },
  },

  // ══════════════════════════════════════════════════════════════
  // MEDIOS DIGITALES — adicionales
  // ══════════════════════════════════════════════════════════════

  {
    id: 'gol-caracol', name: 'Gol Caracol', country: 'CO', emoji: '🇨🇴',
    sport: 'futbol', category: 'creadores',
    subtitle: 'El canal deportivo de Caracol Televisión. Liga colombiana y Selección Colombia.',
    handles: { youtube: '@GolCaracol', instagram: 'golcaracol', tiktok: '@golcaracol', twitter: 'GolCaracol' },
  },
  {
    id: 'futbol-picante', name: 'Fútbol Picante', country: 'US', emoji: '🌎',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Programa de ESPN Deportes. El debate de fútbol más visto en español en EEUU.',
    handles: { youtube: '@FutbolPicante', instagram: 'futbolpicante', tiktok: '@futbolpicante', twitter: 'FutbolPicante' },
  },
  {
    id: 'la-media-vuelta', name: 'La Media Vuelta', country: 'MX', emoji: '🇲🇽',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Podcast y canal digital de fútbol latinoamericano. Gran comunidad en TikTok.',
    handles: { youtube: '@LaMediaVuelta', instagram: 'lamediavuelta', tiktok: '@lamediavuelta', twitter: 'LaMediaVuelta' },
  },
  {
    id: 'futbol-con-nacho', name: 'Fútbol con Nacho', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Canal de análisis táctico y periodismo de fútbol en YouTube y TikTok.',
    handles: { youtube: '@FutbolConNacho', tiktok: '@futbolconnacho', instagram: 'futbolconnacho', twitter: 'futbolconnacho' },
  },
  {
    id: 'estadio-deportivo', name: 'Estadio Deportivo', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'periodistas',
    subtitle: 'Medio sevillano especializado en Sevilla FC y Betis. Referente del fútbol andaluz.',
    handles: { youtube: '@EstadioDeportivo', instagram: 'estadiodeportivo', tiktok: '@estadiodeportivo', twitter: 'estadiodeportivo' },
  },
  {
    id: 'mundo-deportivo', name: 'Mundo Deportivo', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'periodistas',
    subtitle: 'El diario barcelonista de referencia. Especializado en FC Barcelona.',
    handles: { youtube: '@mundodeportivo', instagram: 'mundodeportivo', tiktok: '@mundodeportivo', twitter: 'mundodeportivo' },
  },
  {
    id: 'diario-sport', name: 'Fichajes.net', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'periodistas',
    subtitle: 'El portal de rumores de fichajes más seguido en español. TikTok muy activo.',
    handles: { youtube: '@fichajesnet', instagram: 'fichajesnet', tiktok: '@fichajesnet', twitter: 'fichajes' },
  },
  {
    id: 'sportyou', name: 'SportYou', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Medio digital deportivo español nativo en TikTok e Instagram. Multi-deporte.',
    handles: { tiktok: '@sportyou', instagram: 'sportyou', youtube: '@sportyou', twitter: 'sportyou_es' },
  },

  // ══════════════════════════════════════════════════════════════
  // FÚTBOL — Jugadores argentinos con gran presencia digital
  // ══════════════════════════════════════════════════════════════

  {
    id: 'angel-di-maria', name: 'Ángel Di María', country: 'AR', emoji: '🇦🇷',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Fideo. Leyenda de Argentina y Campeón del Mundo 2022. Gran presencia en Instagram.',
    handles: { instagram: 'angeldimaria', tiktok: '@angeldimaria', twitter: 'angeldimaria' },
  },
  {
    id: 'lautaro-martinez', name: 'Lautaro Martínez', country: 'AR', emoji: '🇦🇷',
    sport: 'futbol', category: 'creadores',
    subtitle: 'El Toro. Pichichi de Serie A. Delantero del Inter de Milán y Argentina.',
    handles: { instagram: 'lautaromartinez', tiktok: '@lautaromartinez', twitter: 'lautaromartinez' },
  },
  {
    id: 'julian-alvarez', name: 'Julián Álvarez', country: 'AR', emoji: '🇦🇷',
    sport: 'futbol', category: 'creadores',
    subtitle: 'La Araña. Campeón del Mundo 2022. Atlético de Madrid. El futuro de Argentina.',
    handles: { instagram: 'julian_alvarez', tiktok: '@julian_alvarez', twitter: 'julialvarez9' },
  },
  {
    id: 'antoine-griezmann', name: 'Antoine Griezmann', country: 'FR', emoji: '🇫🇷',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Grizou. Atlético de Madrid. Gran presencia en redes, especialmente en español.',
    handles: { instagram: 'antogriezmann', tiktok: '@antogriezmann', twitter: 'antogriezmann' },
  },
  {
    id: 'koke-resurrecci', name: 'Koke', country: 'ES', emoji: '🇪🇸',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Capitán histórico del Atlético de Madrid y la selección española.',
    handles: { instagram: 'kokeresurrección', tiktok: '@koke6', twitter: 'Koke6' },
  },
  {
    id: 'marc-ter-stegen', name: 'Marc ter Stegen', country: 'DE', emoji: '🇩🇪',
    sport: 'futbol', category: 'creadores',
    subtitle: 'Portero del FC Barcelona. El más querido por la afición culé. Activo en redes.',
    handles: { instagram: 'mterstegen1', tiktok: '@mterstegen1', twitter: 'mterstegen1' },
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
