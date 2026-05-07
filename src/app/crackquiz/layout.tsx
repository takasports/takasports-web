import type { Metadata } from 'next'
import { SITE_URL, LOGO_URL, ICON_URL } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'CrackQuiz — trivia deportiva diaria',
  description: 'Trivia de fútbol y deporte general. Rondas diarias cronometradas, racha de aciertos y puntuación máxima.',
  alternates: { canonical: `${SITE_URL}/crackquiz` },
  openGraph: {
    title: 'CrackQuiz — trivia deportiva diaria',
    description: '¿Cuánto sabes de fútbol? 10 preguntas, 30 segundos cada una. Reto diario de trivia deportiva.',
    url: `${SITE_URL}/crackquiz`,
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CrackQuiz — trivia deportiva diaria',
    description: '¿Cuánto sabes de fútbol? Trivia deportiva diaria.',
    site: '@takasports',
  },
}

export default function CrackQuizLayout({ children }: { children: React.ReactNode }) {
  return children
}
