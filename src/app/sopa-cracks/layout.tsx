import type { Metadata } from 'next'
import { SITE_URL, LOGO_URL, ICON_URL } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Sopa de Cracks — TakaSports',
  description: 'Encuentra a las leyendas del fútbol escondidas en la sopa de letras. Nuevo puzzle cada semana.',
  alternates: { canonical: `${SITE_URL}/sopa-cracks` },
  openGraph: {
    title: 'Sopa de Cracks — TakaSports',
    description: 'Sopa de letras con las leyendas del fútbol. Nuevo puzzle temático cada semana.',
    url: `${SITE_URL}/sopa-cracks`,
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sopa de Cracks — TakaSports',
    description: 'Sopa de letras futbolera semanal.',
    site: '@takasports',
  },
}

export default function SopaCracksLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
