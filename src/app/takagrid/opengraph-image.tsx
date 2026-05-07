import { buildGameOgImage, OG_SIZE } from '@/lib/og-game-image'

export const runtime = 'edge'
export const alt = 'TakaGrid — TakaSports'
export const size = OG_SIZE
export const contentType = 'image/png'

export default function Image() {
  return buildGameOgImage({
    emoji: '🔲',
    title: 'TakaGrid',
    description: 'El Wordle del fútbol. Adivina el jugador cada día.',
    accentColor: '#a78bfa',
  })
}
