import { buildGameOgImage, OG_SIZE } from '@/lib/og-game-image'

export const runtime = 'edge'
export const alt = 'Mi Once — TakaSports'
export const size = OG_SIZE
export const contentType = 'image/png'

export default function Image() {
  return buildGameOgImage({
    emoji: '⚽',
    title: 'Mi Once',
    description: 'Monta tu equipo ideal y compite en el reto semanal.',
    accentColor: '#93C5FD',
  })
}
