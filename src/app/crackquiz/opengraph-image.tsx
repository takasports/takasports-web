import { buildGameOgImage, OG_SIZE } from '@/lib/og-game-image'

export const runtime = 'edge'
export const alt = 'CrackQuiz — TakaSports'
export const size = OG_SIZE
export const contentType = 'image/png'

export default function Image() {
  return buildGameOgImage({
    emoji: '🧠',
    title: 'CrackQuiz',
    description: '¿Cuánto sabes de fútbol? Trivia deportiva diaria.',
    accentColor: '#f59e0b',
  })
}
