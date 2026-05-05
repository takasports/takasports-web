import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'CrackQuiz — TakaSports',
  description: 'Trivia de fútbol y deporte general. Rondas diarias cronometradas, racha de aciertos y puntuación máxima.',
  alternates: { canonical: 'https://takasportsmedia.com/crackquiz' },
  openGraph: {
    title: 'CrackQuiz — TakaSports',
    description: '¿Cuánto sabes de fútbol? 10 preguntas, 30 segundos cada una. Reto diario de trivia deportiva.',
    url: 'https://takasportsmedia.com/crackquiz',
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
    images: [{ url: 'https://takasportsmedia.com/og-crackquiz.png', width: 1200, height: 630, alt: 'CrackQuiz' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CrackQuiz — TakaSports',
    description: '¿Cuánto sabes de fútbol? Trivia deportiva diaria.',
    site: '@takasports',
    images: ['https://takasportsmedia.com/og-crackquiz.png'],
  },
}

export default function CrackQuizLayout({ children }: { children: React.ReactNode }) {
  return children
}
