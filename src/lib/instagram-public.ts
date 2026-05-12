// instagram-public.ts — Fetch reels de @taka.sports sin OAuth
// Usa la API web interna de Instagram (pública, sin auth)
// Los thumbnails se sirven a través del proxy /api/instagram/thumbnail

const SPORT_KEYWORDS: Array<[string, string[]]> = [
  ['futbol', [
    'futbol', 'football', 'laliga', 'champions', 'premier', 'bundesliga', 'seriea',
    'liga ', ' liga', 'gol', 'messi', 'ronaldo', 'madrid', 'barca', 'barcelona',
    'athletic', 'atletico', 'sevilla', 'villarreal', 'betis', 'copa', 'eurocopa',
    'yamal', 'vinicius', 'bellingham', 'pedri', 'lewandowski', 'modric', 'haaland',
    'mbapp', 'salah', 'ancelotti', 'mourinho', 'guardiola', 'portero', 'delantero',
    'neymar', 'florentino', 'derbi', 'derby', 'praga', 'rashford', 'ascenso', 'serie a',
    'mendy', 'carrera de', 'vestuario', 'fichaje', 'portería', 'delantero', 'atacante',
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
  ['wwe', [
    'wwe', 'wrestling', 'lucha libre', 'aew', 'raw', 'smackdown', 'wrestlemania',
    'royal rumble', 'summerslam', 'survivor series', 'samoano', 'samoanos',
    'roman reigns', 'cody rhodes', 'cm punk', 'seth rollins', 'undertaker',
    'backlash', 'judgment day', 'liv morgan', 'iyo sky', 'jacob fatu', 'becky lynch',
    'danhausen', 'tiffany stratton', 'giulia', 'sami zayn', 'trick williams',
  ]],
  ['rugby', [
    'rugby', 'rugbi', 'six nations', 'sixnations', 'world cup rugby',
    'all blacks', 'premiership rugby', 'top 14', 'try', 'scrum',
  ]],
]

export function detectSportPublic(caption: string): string {
  return detectSport(caption)
}

export function extractTitlePublic(caption: string): string {
  return extractTitle(caption)
}

function detectSport(caption: string): string {
  if (!caption) return ''
  const text = caption.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  for (const [sport, keywords] of SPORT_KEYWORDS) {
    if (keywords.some(kw =>
      kw.length <= 4
        ? new RegExp(`\\b${kw}\\b`).test(text)
        : text.includes(kw)
    )) return sport
  }
  return ''
}

function extractTitle(caption: string): string {
  if (!caption) return 'Reel'
  const first = caption.split('\n')[0].replace(/#\S+/g, '').replace(/@\S+/g, '').trim()
  if (!first) return 'Reel'
  return first.length > 65 ? first.slice(0, 62) + '…' : first
}

export interface PublicReel {
  id: string
  instagram_url: string
  thumbnail_url: string | null
  video_url: string | null
  timestamp: string
  caption: string
  sport: string
  title: string
}

interface FeedItem {
  id: string
  pk: string | number
  code: string
  media_type: number // 1=image, 2=video, 8=carousel
  taken_at: number
  caption?: { text?: string } | null
  image_versions2?: { candidates?: Array<{ url: string; width: number }> }
  video_versions?: Array<{ url: string; width: number; height: number; type: number }>
}

interface FeedResponse {
  items?: FeedItem[]
  more_available?: boolean
  next_max_id?: string
}

function igHeaders(username: string) {
  return {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'X-IG-App-ID': '936619743392459',
    'Accept': 'application/json',
    'Accept-Language': 'es-ES,es;q=0.9',
    // El feed paginado (api/v1/feed/user/{id}/) devuelve 401 si el Referer
    // no apunta al perfil; con la URL del perfil pasamos el anti-abuse.
    'Referer': `https://www.instagram.com/${username}/`,
  } as const
}

async function resolveUserId(username: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`,
      { headers: igHeaders(username), signal: AbortSignal.timeout(6000), cache: 'no-store' },
    )
    if (!res.ok) return null
    const data = await res.json()
    return data?.data?.user?.id ?? null
  } catch {
    return null
  }
}

function mapItem(item: FeedItem): PublicReel | null {
  if (item.media_type !== 2) return null
  const caption = item.caption?.text ?? ''
  const thumb = item.image_versions2?.candidates?.[0]?.url ?? null
  const video = item.video_versions?.[0]?.url ?? null
  return {
    id:            String(item.pk ?? item.id),
    instagram_url: `https://www.instagram.com/reel/${item.code}/`,
    thumbnail_url: thumb ? `/api/instagram/thumbnail?url=${encodeURIComponent(thumb)}` : null,
    video_url:     video ? `/api/instagram/video?url=${encodeURIComponent(video)}`  : null,
    timestamp:     new Date(item.taken_at * 1000).toISOString(),
    caption,
    sport:         detectSport(caption),
    title:         extractTitle(caption),
  }
}

// Pagina el feed de IG hasta MAX_PAGES o hasta agotar contenido.
// IG limita cada página a 12 items independientemente del count solicitado.
const MAX_PAGES = 6 // hasta ~72 items, suficiente para muchos videos recientes

export async function fetchPublicReels(username = 'taka.sports'): Promise<PublicReel[]> {
  const userId = await resolveUserId(username)
  if (!userId) return []

  const reels: PublicReel[] = []
  let maxId: string | undefined

  for (let page = 0; page < MAX_PAGES; page++) {
    if (page > 0) {
      // Delay para evitar rate-limit/anti-abuse de IG (devuelve 401 si se piden
      // varias páginas anónimas sin pausa).
      await new Promise(r => setTimeout(r, 350 + Math.random() * 250))
    }
    const url = new URL(`https://www.instagram.com/api/v1/feed/user/${userId}/`)
    url.searchParams.set('count', '12')
    if (maxId) url.searchParams.set('max_id', maxId)

    try {
      const res = await fetch(url.toString(), {
        headers: igHeaders(username),
        signal: AbortSignal.timeout(7000),
        cache: 'no-store',
      })
      if (!res.ok) {
        console.error('[Instagram public] HTTP', res.status, 'page', page)
        break
      }
      const data: FeedResponse = await res.json()
      const items = data.items ?? []
      for (const it of items) {
        const r = mapItem(it)
        if (r) reels.push(r)
      }
      if (!data.more_available || !data.next_max_id) break
      maxId = data.next_max_id
    } catch (err) {
      console.error('[Instagram public] page', page, 'error:', err)
      break
    }
  }

  return reels
}
