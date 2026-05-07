import { buildGameOgImage, OG_SIZE } from '@/lib/og-game-image'

export const runtime = 'edge'
export const alt = 'Quiniela LaLiga — TakaSports'
export const size = OG_SIZE
export const contentType = 'image/png'

export default function Image() {
  return buildGameOgImage({
    emoji: '🎯',
    title: 'Quiniela',
    description: 'Predice los resultados de LaLiga y sube en el ranking semanal.',
    accentColor: '#22c55e',
  })
}
