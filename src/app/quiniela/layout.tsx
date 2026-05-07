import type { Metadata } from 'next'
import { SITE_URL, LOGO_URL, ICON_URL } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Quiniela — predice la jornada y compite',
  description: 'Predice los resultados de la jornada de LaLiga, compite en el ranking semanal y demuestra que sabes de fútbol.',
  alternates: { canonical: `${SITE_URL}/quiniela` },
  openGraph: {
    title: 'Quiniela — predice la jornada y compite | TakaSports',
    description: 'Predice los resultados de la jornada y sube en el ranking semanal.',
    url: `${SITE_URL}/quiniela`,
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: 'Quiniela — predice la jornada y compite | TakaSports', site: '@takasports' },
}

export default function QuinielaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
