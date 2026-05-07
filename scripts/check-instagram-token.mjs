// check-instagram-token.mjs — Valida el token y lista reels disponibles
// Uso: node scripts/check-instagram-token.mjs

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Leer .env.local
const envPath = join(__dirname, '..', '.env.local')
try {
  const lines = readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const [key, ...rest] = line.split('=')
    if (key?.trim() && rest.length) {
      process.env[key.trim()] = rest.join('=').trim()
    }
  }
} catch {
  console.error('No se pudo leer .env.local')
  process.exit(1)
}

const TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN
if (!TOKEN) {
  console.error('\n❌  INSTAGRAM_ACCESS_TOKEN no está definido en .env.local')
  process.exit(1)
}

const SPORT_KEYWORDS = [
  ['futbol',     ['futbol', 'football', 'laliga', 'champions', 'liga ', 'gol', 'madrid', 'barca', 'barcelona', 'athletic', 'atletico', 'copa', 'eurocopa', 'yamal', 'vinicius', 'mbapp']],
  ['baloncesto', ['nba', 'baloncesto', 'basketball', 'basket', 'euroleague', 'acb']],
  ['formula1',   ['formula 1', 'formula1', 'f1 ', ' f1', '#f1', 'verstappen', 'hamilton', 'ferrari', 'grand prix', 'grandprix']],
  ['tenis',      ['tenis', 'tennis', 'atp', 'wta', 'roland garros', 'wimbledon', 'alcaraz', 'djokovic', 'sinner']],
  ['ufc',        ['ufc', 'mma', 'boxing', 'boxeo', 'pelea', 'fight', 'octagon']],
  ['rugby',      ['rugby', 'six nations', 'all blacks']],
]

function detectSport(caption = '') {
  const text = caption.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  for (const [sport, kws] of SPORT_KEYWORDS) {
    if (kws.some(kw => text.includes(kw))) return sport
  }
  return '(sin categoría)'
}

async function main() {
  console.log('\n🔍  Comprobando token de Instagram...\n')

  // 1. Verificar token
  const meRes = await fetch(`https://graph.instagram.com/me?fields=id,username&access_token=${TOKEN}`)
  const me = await meRes.json()

  if (me.error) {
    console.error('❌  Token inválido:', me.error.message)
    process.exit(1)
  }
  console.log(`✅  Cuenta: @${me.username} (ID: ${me.id})`)

  // 2. Listar media
  const mediaRes = await fetch(
    `https://graph.instagram.com/me/media?fields=id,media_type,thumbnail_url,timestamp,caption,permalink&access_token=${TOKEN}&limit=50`
  )
  const media = await mediaRes.json()

  if (media.error) {
    console.error('❌  Error al obtener media:', media.error.message)
    process.exit(1)
  }

  const all = media.data ?? []
  const reels = all.filter(m => m.media_type === 'REEL' || m.media_type === 'VIDEO')

  console.log(`\n📊  Media total: ${all.length}  |  REELs: ${reels.length}\n`)

  if (reels.length === 0) {
    console.log('⚠️   No se encontraron REELs en la cuenta.')
    process.exit(0)
  }

  // 3. Mostrar reels con sport detectado
  console.log('🎬  Reels encontrados:\n')
  for (const r of reels) {
    const sport = detectSport(r.caption)
    const title = (r.caption ?? '').split('\n')[0].slice(0, 55) || '(sin caption)'
    const thumb = r.thumbnail_url ? '🖼' : '  '
    console.log(`  ${thumb}  [${sport.padEnd(12)}]  ${title}`)
  }

  // 4. Comprobar expiración aproximada (token decode)
  console.log(`\n⏳  El token expira en ~60 días si es long-lived.`)
  console.log(`   Para refrescar: GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=<token>\n`)
}

main().catch(err => {
  console.error('Error inesperado:', err)
  process.exit(1)
})
