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
  ['wrestling', [
    'wwe', 'wrestling', 'lucha libre', 'aew', 'raw', 'smackdown', 'wrestlemania',
    'royal rumble', 'summerslam', 'survivor series', 'samoano', 'samoanos',
    'roman reigns', 'cody rhodes', 'cm punk', 'seth rollins', 'undertaker',
  ]],
  ['rugby', [
    'rugby', 'rugbi', 'six nations', 'sixnations', 'world cup rugby',
    'all blacks', 'premiership rugby', 'top 14', 'try', 'scrum',
  ]],
]

function detectSport(caption: string): string {
  if (!caption) return ''
  const text = caption.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  for (const [sport, keywords] of SPORT_KEYWORDS) {
    if (keywords.some(kw => text.includes(kw))) return sport
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

interface MediaNode {
  id: string
  shortcode: string
  __typename: string
  is_video: boolean
  product_type?: string
  thumbnail_src: string
  video_url?: string
  taken_at_timestamp: number
  edge_media_to_caption: { edges: Array<{ node: { text: string } }> }
}

export async function fetchPublicReels(username = 'taka.sports'): Promise<PublicReel[]> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const res = await fetch(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'X-IG-App-ID': '936619743392459',
          'Accept': 'application/json',
          'Accept-Language': 'es-ES,es;q=0.9',
          'Referer': 'https://www.instagram.com/',
        },
        signal: controller.signal,
        cache: 'no-store',
      }
    ).finally(() => clearTimeout(timeout))

    if (!res.ok) {
      console.error('[Instagram public] HTTP', res.status)
      return []
    }

    const data = await res.json()
    const edges: Array<{ node: MediaNode }> =
      data?.data?.user?.edge_owner_to_timeline_media?.edges ?? []

    return edges
      .filter(e => e.node.is_video)
      .map(e => {
        const node = e.node
        const caption = node.edge_media_to_caption?.edges?.[0]?.node?.text ?? ''
        const rawThumb = node.thumbnail_src ?? null
        const rawVideo = node.video_url ?? null
        return {
          id:            node.id,
          instagram_url: `https://www.instagram.com/reel/${node.shortcode}/`,
          thumbnail_url: rawThumb
            ? `/api/instagram/thumbnail?url=${encodeURIComponent(rawThumb)}`
            : null,
          video_url:     rawVideo
            ? `/api/instagram/video?url=${encodeURIComponent(rawVideo)}`
            : null,
          timestamp:     new Date(node.taken_at_timestamp * 1000).toISOString(),
          caption,
          sport:         detectSport(caption),
          title:         extractTitle(caption),
        }
      })
  } catch (err) {
    console.error('[Instagram public] error:', err)
    return []
  }
}
