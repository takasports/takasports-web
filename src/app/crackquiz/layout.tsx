import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'CrackQuiz — trivia deportiva diaria',
  description: 'Trivia de fútbol, baloncesto, tenis, motor, UFC y más. Rondas diarias cronometradas, racha de aciertos y puntuación máxima.',
  alternates: { canonical: `${SITE_URL}/crackquiz` },
  openGraph: {
    title: 'CrackQuiz — trivia deportiva diaria',
    description: '¿Cuánto sabes de deporte? 10 preguntas, 20 segundos cada una. Fútbol, baloncesto, tenis, motor, UFC y más.',
    url: `${SITE_URL}/crackquiz`,
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CrackQuiz — trivia deportiva diaria',
    description: '¿Cuánto sabes de deporte? Trivia diaria: fútbol, baloncesto, tenis, motor, UFC y más.',
    site: '@takasportsx',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'CrackQuiz',
  description: 'Trivia deportiva diaria. 10 preguntas, 20 segundos cada una. Fútbol, baloncesto, tenis, motor, UFC y más.',
  url: `${SITE_URL}/crackquiz`,
  applicationCategory: 'GameApplication',
  genre: 'Sports',
  inLanguage: 'es-ES',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
  operatingSystem: 'All',
}

export default function CrackQuizLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {children}
    </>
  )
}
