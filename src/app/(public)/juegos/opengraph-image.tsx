import { buildGameOgImage, OG_SIZE } from '@/lib/og-game-image'

export const runtime = 'edge'
export const alt = 'Juegos deportivos — TakaSports'
export const size = OG_SIZE
export const contentType = 'image/png'

export default function Image() {
  return buildGameOgImage({
    emoji: '🎮',
    title: 'Juegos',
    description: 'Predicciones, CrackQuiz, Mi Once, Sopa de Cracks y TakaGrid.',
    accentColor: '#7C3AED',
  })
}
