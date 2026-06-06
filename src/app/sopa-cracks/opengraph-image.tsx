import { buildGameOgImage, OG_SIZE } from '@/lib/og-game-image'

export const runtime = 'edge'
export const alt = 'Sopa de Cracks — TakaSports'
export const size = OG_SIZE
export const contentType = 'image/png'

export default function Image() {
  return buildGameOgImage({
    emoji: '🔤',
    title: 'Sopa de Cracks',
    description: 'Encuentra a las leyendas del fútbol. Puzzle semanal.',
    accentColor: '#6EE7B7',
  })
}
