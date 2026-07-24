import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/constants'

// page.tsx es 'use client' (filtros + estado), así que no puede exportar metadata.
// Sin este layout la página heredaba el title y la description del root → duplicaba
// exactamente los de la home en el SERP.
export const metadata: Metadata = {
  title: 'Insignias — todas las que puedes desbloquear',
  description:
    'Catálogo completo de insignias de TakaSports: hitos, jornada, temporada, Mundial y especiales. Descubre cómo se desbloquea cada una y sigue tu progreso.',
  alternates: { canonical: `${SITE_URL}/badges` },
  openGraph: {
    title: 'Insignias de TakaSports',
    description:
      'Todas las insignias que puedes desbloquear jugando: hitos, jornada, temporada, Mundial y especiales.',
    url: `${SITE_URL}/badges`,
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Insignias de TakaSports',
    description: 'Todas las insignias que puedes desbloquear jugando en TakaSports.',
    site: '@takasportsx',
  },
}

export default function BadgesLayout({ children }: { children: React.ReactNode }) {
  return children
}
