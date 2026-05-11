#!/usr/bin/env node
// Actualiza src/lib/reels-data.json con los reels más recientes de @taka.sports
//
// Uso:
//   node scripts/update-reels.js

import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '../src/lib/reels-data.json')

const SPORT_KEYWORDS = {
  futbol:     ['futbol','football','laliga','champions','premier','gol','messi','ronaldo','madrid','barca','copa','neymar','mourinho','florentino','mbapp','bellingham','vinicius','rochdale','portero','delantero','derbi','derby','praga','rashford','ascenso','serie a'],
  wwe:        ['wwe','wrestling','lucha','aew','raw','smackdown','wrestlemania','samoano','judgment day','liv morgan','iyo sky','jacob fatu','roman reigns','becky','stephanie vaquer','undertaker','cody','seth rollins','backlash','danhausen','tiffany stratton','giulia','sami zayn','trick williams'],
  baloncesto: ['nba','baloncesto','basketball','basket','lakers','celtics','curry','lebron','doncic','jokic','euroleague','acb'],
  formula1:   ['formula 1','formula1','f1','verstappen','hamilton','ferrari','mclaren','monaco','grand prix','alonso','norris','leclerc','sainz'],
  tenis:      ['tenis','tennis','atp','wta','alcaraz','djokovic','nadal','wimbledon','roland garros','sinner'],
  ufc:        ['ufc','mma','boxing','boxeo','pelea','fight','octagon','knockout','ko','combate','cinturon'],
}

function detectSport(caption) {
  const text = caption.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  for (const [sport, kws] of Object.entries(SPORT_KEYWORDS)) {
    if (kws.some(k => k.length <= 4 ? new RegExp(`\\b${k}\\b`).test(text) : text.includes(k))) return sport
  }
  return ''
}

function extractTitle(caption) {
  const first = caption.split('\n')[0]
    .replace(/#\S+/g, '')
    .replace(/@\S+/g, '')
    .trim()
  return first ? first.slice(0, 65) : 'Reel'
}

function parseReels(data) {
  const edges = data?.data?.user?.edge_owner_to_timeline_media?.edges ?? []
  return edges
    .filter(e => e.node.is_video)
    .map(e => {
      const n = e.node
      const caption = n.edge_media_to_caption?.edges?.[0]?.node?.text ?? ''
      const rawThumb = n.thumbnail_src ?? ''
      const rawVideo = n.video_url ?? ''
      return {
        id:            n.id,
        instagram_url: `https://www.instagram.com/reel/${n.shortcode}/`,
        thumbnail_url: rawThumb
          ? `/api/instagram/thumbnail?url=${encodeURIComponent(rawThumb)}`
          : null,
        video_url:     rawVideo
          ? `/api/instagram/video?url=${encodeURIComponent(rawVideo)}`
          : null,
        timestamp:     String(n.taken_at_timestamp),
        caption,
        sport:         detectSport(caption),
        title:         extractTitle(caption),
      }
    })
}

async function main() {
  process.stdout.write('Fetching @taka.sports... ')

  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), 10_000)

  let data
  try {
    const res = await fetch(
      'https://www.instagram.com/api/v1/users/web_profile_info/?username=taka.sports',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'X-IG-App-ID': '936619743392459',
          'Accept': 'application/json',
          'Referer': 'https://www.instagram.com/',
        },
        signal: controller.signal,
      }
    )
    clearTimeout(t)
    if (!res.ok) throw new Error(`HTTP ${res.status} — Instagram bloqueó la petición. Inténtalo en unos minutos.`)
    data = await res.json()
  } catch (err) {
    clearTimeout(t)
    throw err
  }

  console.log('OK')

  const reels = parseReels(data)
  if (reels.length === 0) {
    throw new Error('No se encontraron reels en la respuesta.')
  }

  writeFileSync(OUT, JSON.stringify(reels, null, 2), 'utf8')

  console.log(`\n✅ ${reels.length} reels guardados en src/lib/reels-data.json\n`)
  for (const r of reels) {
    console.log(`  [${(r.sport || '?').padEnd(10)}] ${r.title}`)
  }

  // Estimar cuándo expiran los thumbnails (parámetro oe= en la URL CDN)
  const firstThumb = reels.find(r => r.thumbnail_url)?.thumbnail_url ?? ''
  const match = decodeURIComponent(firstThumb).match(/oe=([0-9A-Fa-f]+)/)
  if (match) {
    const expiry = parseInt(match[1], 16)
    const daysLeft = Math.round((expiry * 1000 - Date.now()) / 86_400_000)
    const expiryDate = new Date(expiry * 1000).toLocaleDateString('es-ES')
    console.log(`\n⏱  Thumbnails válidos hasta: ${expiryDate} (~${daysLeft} días)`)
    console.log('   Vuelve a ejecutar este script antes de esa fecha.')
  }
}

main().catch(err => {
  console.error('\n❌', err.message)
  process.exit(1)
})
