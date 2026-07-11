import type { Metadata } from 'next'
import BreadcrumbJsonLd from '@/components/BreadcrumbJsonLd'
import LigaTakaBoard from '@/components/ranked/LigaTakaBoard'
import { SITE_URL } from '@/lib/constants'

export const metadata: Metadata = {
  title: { absolute: 'Liga Taka — El ranking general de TakaSports' },
  description:
    'La Liga Taka: el ranking general de TakaSports. Todos tus puntos —juegos, predicciones, misiones, racha e insignias— en una sola clasificación. Sube de nivel y compite con la comunidad.',
  alternates: { canonical: `${SITE_URL}/liga-taka` },
  openGraph: {
    title: 'Liga Taka — El ranking general de TakaSports',
    description:
      'Todos tus puntos en una sola clasificación: juegos, predicciones, misiones, racha e insignias. Sube de nivel y compite.',
    url: `${SITE_URL}/liga-taka`,
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Liga Taka — El ranking general de TakaSports',
    description: 'Todos tus puntos en una sola clasificación. Sube de nivel y compite con la comunidad.',
  },
}

export default function LigaTakaPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: 'TakaSports', path: '' },
          { name: 'Liga Taka', path: '/liga-taka' },
        ]}
      />
      {/* H1 accesible para SEO: el tablero es cliente y no emite H1 en el HTML. */}
      <h1 className="sr-only">Liga Taka — ranking general de usuarios de TakaSports</h1>
      <LigaTakaBoard />
    </>
  )
}
