import { buildGameOgImage, OG_SIZE } from '@/lib/og-game-image'

export const runtime = 'edge'
export const alt = 'TakaGrid — TakaSports'
export const size = OG_SIZE
export const contentType = 'image/png'

export default function Image() {
  return buildGameOgImage({
    emoji: '🔲',
    title: 'TakaGrid',
    description: 'Cruza club y categoría: encuentra al jugador que encaja. Reto diario.',
    accentColor: '#FDBA74',
  })
}
