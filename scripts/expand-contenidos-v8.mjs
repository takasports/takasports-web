#!/usr/bin/env node
// expand-contenidos-v8.mjs
// Creadores y periodistas PUROS (no deportistas) hispanohablantes.
//
// FÚTBOL (5): NachoHernaez, La Media Inglesa, RetrocalcioShirts,
//             Lorena Escoz, David Suárez
// WWE (4):    WWECucu, Uke Wrestling, XeniaDid That, Twisted Banks
//
// Uso:
//   node scripts/expand-contenidos-v8.mjs
//   node scripts/expand-contenidos-v8.mjs --apply

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

const NEW_ENTRIES = [

  // ══════════════════════════════════════════════════════════════════
  // FÚTBOL — CREADORES/PERIODISTAS DIGITALES
  // ══════════════════════════════════════════════════════════════════

  {
    id: 'nachohernaez',
    name: 'NachoHernaez', sport: 'futbol', category: 'creadores',
    handles: {
      tiktok:    '@nachohernaez',
      youtube:   '@nachohernaez',
      instagram: 'nachohernaez',   // 20K
      twitter:   'NachoHernaez',
    },
    mediatico_auto: 60, narrativa_auto: 65,
    // "CEO de la nostalgia en el fútbol". Fútbol retro: historias, anécdotas, curiosidades.
    // Creador DAZN. Empezó en TikTok en la pandemia. ~6-7 vídeos/día en TikTok.
    // Referente del fútbol histórico en español para audiencia joven.
  },
  {
    id: 'lamediainglesa',
    name: 'La Media Inglesa', sport: 'futbol', category: 'creadores',
    handles: {
      youtube:   '@LaMediaInglesa',  // 453K — análisis táctico Premier
      twitter:   'LaMediaInglesa',
      instagram: 'lamediainglesa',
    },
    mediatico_auto: 75, narrativa_auto: 72,
    // El medio de referencia en español para la Premier League.
    // 453K suscriptores YouTube. Fundado por Ilie Oleart.
    // Análisis táctico en profundidad + podcasts semanales pre/post jornada.
    // En 2026 Nacho González y Pablo Espinosa dejaron el proyecto.
  },
  {
    id: 'retrocalcioshirts',
    name: 'RetrocalcioShirts', sport: 'futbol', category: 'creadores',
    handles: {
      tiktok:    '@retrocalcioshirts', // 132K
      instagram: 'retrocalcioshirts',  // 82K
      youtube:   '@retrocalcioshirts',
      twitter:   'RetroCalcioS',
    },
    mediatico_auto: 62, narrativa_auto: 60,
    // Coleccionismo y divulgación sobre camisetas de fútbol retro/vintage.
    // 132K TikTok, 82K IG. Ayuda a diferenciar auténticas de réplicas.
    // Colabora con COPA Football. "NO FAKES ALLOWED". Shirt hunts y vlogs de estadio.
  },
  {
    id: 'lorena-escoz',
    name: 'Lorena Escoz', sport: 'futbol', category: 'creadores',
    handles: {
      instagram: 'loescoz',   // 156K
      tiktok:    '@loescoz',
      youtube:   '@loescoz',
    },
    mediatico_auto: 65, narrativa_auto: 58,
    // Creadora de contenido de fútbol + lifestyle. "Andaluza enamorá del furbo."
    // 156K Instagram. Colaboraciones con LaLiga. Combina fútbol, directo y lifestyle.
    // Representa el perfil femenino hispanohablante en el contenido deportivo digital.
  },
  {
    id: 'david-suarez-creator',
    name: 'David Suárez', sport: 'futbol', category: 'creadores',
    handles: {
      youtube:   '@DavidSuarezOficial', // 1.4M
      instagram: 'davisuuarez',          // 825K
      tiktok:    '@davidsuareztiktok',   // 248K + otra cuenta 5M en humor fútbol
      twitter:   'DavidSuarez_V',
    },
    mediatico_auto: 88, narrativa_auto: 70,
    // Monologuista y creador español. 1.4M YouTube, 825K IG.
    // Participa activamente en el ecosistema de streamers (DWT de Jordi Wild, Ibai)
    // donde se mezcla cultura MMA/fútbol. El humor deportivo más viral de España.
  },

  // ══════════════════════════════════════════════════════════════════
  // WWE — CREADORES PUROS
  // ══════════════════════════════════════════════════════════════════

  {
    id: 'wwecucu',
    name: 'WWECucu', sport: 'wwe', category: 'creadores_wwe',
    handles: {
      tiktok:    '@wwe_cucu',
      youtube:   '@wwecucu',
      instagram: 'wwecucu',
    },
    mediatico_auto: 52, narrativa_auto: 55,
    // Creador puro de WWE. Fan desde los 9 años. Twitch y YouTube con reacciones
    // en vivo a RAW, SmackDown y PPVs. Tier lists, memes y momentos random WWE.
    // Streamer de Twitch (twitch.tv/wwecucu) del ecosistema wrestling español.
  },
  {
    id: 'uke-wrestling',
    name: 'Uke Wrestling', sport: 'wwe', category: 'creadores_wwe',
    handles: {
      tiktok:    '@ukewrestlingoficial',  // 409K — el mayor TikTok wrestling ES
      instagram: 'uke.wrestling',         // 70K
      youtube:   '@UKEWRESTLING97',
      twitter:   'UkeWrestling',
    },
    mediatico_auto: 72, narrativa_auto: 65,
    // El mayor creador de wrestling en español en TikTok (409K, 27.5M likes).
    // Streamer principal en Kick (kick.com/uke-wrestling). Cubre WWE + AEW + AAA.
    // Reacciones en directo a todos los eventos. Representa el wrestling en Kick/streaming.
  },
  {
    id: 'xeniadidthat-wwe',
    name: 'XeniaDidThat', sport: 'wwe', category: 'creadores_wwe',
    handles: {
      youtube:   '@XeniaDidThat',
      tiktok:    '@xeniadidthat',
      instagram: 'xeniadidthat',
      twitter:   'XeniaDidThat',
    },
    mediatico_auto: 48, narrativa_auto: 52,
    // Creadora española de contenido WWE. Top 3 en YouTube wrestling España (SPEAKRJ 2024).
    // Perfil femenino destacado en el ecosistema wrestling en español.
    // Reviews, análisis y cobertura de WWE para audiencia hispanohablante.
  },
  {
    id: 'twisted-banks-wwe',
    name: 'Twisted Banks', sport: 'wwe', category: 'creadores_wwe',
    handles: {
      youtube:   '@TwistedBanks',
      tiktok:    '@twistedbanks_wwe',
      instagram: 'twistedbanks_wwe',
      twitter:   'TwistedBanks',
    },
    mediatico_auto: 45, narrativa_auto: 50,
    // Creador español de contenido WWE. Top 4 en YouTube wrestling España (SPEAKRJ 2024).
    // Canal de análisis y debate del producto WWE en español para audiencia hispana.
  },
  {
    id: 'danidelasluchas',
    name: 'DanidelasLuchas', sport: 'wwe', category: 'creadores_wwe',
    handles: {
      tiktok:    '@danidelasLuchas',
      youtube:   '@danidelasLuchas',
      instagram: 'danidelasLuchas',
    },
    mediatico_auto: 48, narrativa_auto: 52,
    // Creador de contenido de lucha libre y wrestling en español.
    // Cubre WWE, AAA y lucha libre mexicana. Referente del wrestling hispano en redes.
  },
]

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}\n`)

  const { data: existing } = await sb
    .from('ranking_entries')
    .select('id, name')
    .in('id', NEW_ENTRIES.map(e => e.id))

  const existingIds = new Set((existing || []).map(e => e.id))
  const toInsert = NEW_ENTRIES.filter(e => !existingIds.has(e.id))
  const skipped  = NEW_ENTRIES.filter(e =>  existingIds.has(e.id))

  console.log(`Nuevas: ${toInsert.length} | Ya existen: ${skipped.length}`)
  if (skipped.length) console.log('  Skip:', skipped.map(e => e.name).join(', '))
  if (toInsert.length === 0) { console.log('\nNada que insertar.'); return }

  console.log('\n  ⚽ Fútbol creadores:')
  toInsert.filter(e => e.sport === 'futbol').forEach(e => console.log(`    + ${e.name.padEnd(28)} [${e.category}]`))
  console.log('\n  🤼 WWE creadores:')
  toInsert.filter(e => e.sport === 'wwe').forEach(e => console.log(`    + ${e.name.padEnd(28)} [${e.category}]`))

  if (!APPLY) { console.log('\nDRY RUN — pasa --apply para escribir.'); return }

  const rows = toInsert.map(e => ({
    id: e.id, name: e.name, sport: e.sport, category: e.category,
    handles: e.handles ?? null,
    rendimiento_auto: null,
    mediatico_auto: e.mediatico_auto,
    narrativa_auto: e.narrativa_auto,
    contexto_auto: null,
    active: true,
  }))

  const { error } = await sb.from('ranking_entries').insert(rows)
  if (error) { console.error('INSERT FAIL:', error.message); process.exit(1) }
  console.log(`\nInsertadas ${rows.length} entradas.`)
}

main().catch(err => { console.error(err); process.exit(1) })
