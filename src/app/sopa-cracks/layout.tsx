import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sopa de Cracks — TakaSports',
  description: 'Encuentra a las leyendas del fútbol escondidas en la sopa de letras. Nuevo puzzle cada semana.',
  alternates: { canonical: 'https://takasportsmedia.com/sopa-cracks' },
  openGraph: {
    title: 'Sopa de Cracks — TakaSports',
    description: 'Sopa de letras con las leyendas del fútbol. Nuevo puzzle temático cada semana.',
    url: 'https://takasportsmedia.com/sopa-cracks',
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
    images: [{ url: 'https://takasportsmedia.com/og-sopacracks.png', width: 1200, height: 630, alt: 'Sopa de Cracks' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sopa de Cracks — TakaSports',
    description: 'Sopa de letras futbolera semanal.',
    site: '@takasports',
    images: ['https://takasportsmedia.com/og-sopacracks.png'],
  },
}

export default function SopaCracksLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
