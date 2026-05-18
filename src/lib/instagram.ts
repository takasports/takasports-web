// instagram.ts — Fetch reels de @taka.sports via Instagram Graph API
// Token: INSTAGRAM_ACCESS_TOKEN en .env.local (expira cada 60 días, requiere refresh)
// Referencia: https://developers.facebook.com/docs/instagram-api/reference/ig-media

export interface TakaReel {
  id: string
  instagram_url: string
  thumbnail_url: string | null
  timestamp: string  // ISO 8601
  caption: string
  sport: string      // slug canónico: 'futbol'|'baloncesto'|'formula1'|'tenis'|'ufc'|'rugby'|''
  title: string      // primera línea del caption, limpia de hashtags
}

// ── Detección de deporte por palabras clave en caption ─────────
const SPORT_KEYWORDS: Array<[string, string[]]> = [
  ['futbol', [
    'futbol', 'football', 'laliga', 'champions', 'premier', 'bundesliga', 'seriea',
    'liga ', ' liga', 'gol', 'messi', 'ronaldo', 'madrid', 'barca', 'barcelona',
    'athletic', 'atletico', 'sevilla', 'villarreal', 'betis', 'copa', 'eurocopa',
    'yamal', 'vinicius', 'bellingham', 'pedri', 'lewandowski', 'modric', 'haaland',
    'mbapp', 'salah', 'ancelotti', 'mourinho', 'guardiola', 'portero', 'delantero',
  ]],
  ['baloncesto', [
    'nba', 'baloncesto', 'basketball', 'basket', 'lakers', 'celtics', 'bulls',
    'warriors', 'knicks', 'nuggets', 'euroleague', 'acb', 'eurobasket', 'tatum',
    'curry', 'lebron', 'jokic', 'antetokounmpo', 'doncic', 'gobert',
  ]],
  ['formula1', [
    'formula 1', 'formula1', 'formula one', 'f1 ', ' f1', '#f1', 'verstappen',
    'hamilton', 'ferrari', 'redbull', 'red bull', 'mclaren', 'mercedes', 'aston martin',
    'grandprix', 'grand prix', 'monza', 'monaco', 'suzuka', 'silverstone', 'pit stop',
    'pole', 'leclerc', 'norris', 'sainz', 'alonso', 'perez', 'circuito',
  ]],
  ['tenis', [
    'tenis', 'tennis', 'atp', 'wta', 'roland garros', 'rolandgarros', 'wimbledon',
    'us open', 'australia open', 'open australia', 'alcaraz', 'djokovic', 'nadal',
    'sinner', 'swiatek', 'rafa', 'carlos alcaraz', 'tiebreak', 'deuce', 'ace',
  ]],
  ['ufc', [
    'ufc', 'mma', 'boxing', 'boxeo', 'pelea', 'fight', 'octagon', 'knockout', 'ko',
    'jones', 'makhachev', 'poirier', 'adesanya', 'mcgregor', 'ngannou', 'strickland',
    'combate', 'cinturon', 'cinturón', 'campeon', 'campeón',
  ]],
  ['rugby', [
    'rugby', 'rugbi', 'six nations', 'sixnations', 'world cup rugby',
    'all blacks', 'premiership rugby', 'top 14', 'try', 'scrum',
  ]],
]

function detectSport(caption: string): string {
  if (!caption) return ''
  const text = caption
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics for matching
  for (const [sport, keywords] of SPORT_KEYWORDS) {
    if (keywords.some(kw => text.includes(kw))) return sport
  }
  return ''
}

function extractTitle(caption: string): string {
  if (!caption) return 'Reel'
  // Primera línea, sin hashtags ni menciones
  const first = caption
    .split('\n')[0]
    .replace(/#\S+/g, '')
    .replace(/@\S+/g, '')
    .trim()
  if (!first) return 'Reel'
  return first.length > 65 ? first.slice(0, 62) + '…' : first
}

// ── Fetch principal ────────────────────────────────────────────
export async function fetchInstagramReels(tokenOverride?: string | null): Promise<TakaReel[]> {
  const token = tokenOverride ?? process.env.INSTAGRAM_ACCESS_TOKEN
  if (!token) return []

  try {
    const url = new URL('https://graph.instagram.com/me/media')
    url.searchParams.set('fields', 'id,media_type,thumbnail_url,timestamp,caption,permalink')
    url.searchParams.set('access_token', token)
    url.searchParams.set('limit', '50')

    const res = await fetch(url.toString(), { next: { revalidate: 300 } })

    if (!res.ok) {
      console.error('[Instagram] fetch error:', res.status)
      return []
    }

    const data: {
      data?: Array<{
        id: string
        media_type: string
        thumbnail_url?: string
        timestamp: string
        caption?: string
        permalink: string
      }>
      error?: { message: string }
    } = await res.json()

    if (data.error) {
      console.error('[Instagram] API error:', data.error.message)
      return []
    }

    return (data.data ?? [])
      .filter(m => m.media_type === 'REEL' || m.media_type === 'VIDEO')
      .map(m => ({
        id: m.id,
        instagram_url: m.permalink,
        thumbnail_url: m.thumbnail_url ?? null,
        timestamp: m.timestamp,
        caption: m.caption ?? '',
        sport: detectSport(m.caption ?? ''),
        title: extractTitle(m.caption ?? ''),
      }))
  } catch (err) {
    console.error('[Instagram] unexpected error:', err)
    return []
  }
}
