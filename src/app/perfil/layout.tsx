import type { Metadata } from 'next'
import { SITE_URL, LOGO_URL, ICON_URL } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Mi Perfil — TakaSports',
  description: 'Tu perfil en TakaSports: recordatorios, picks de quiniela, actividad reciente y preferencias.',
  alternates: { canonical: `${SITE_URL}/perfil` },
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Mi Perfil — TakaSports',
    description: 'Tus picks de quiniela, actividad reciente y preferencias en TakaSports.',
    url: `${SITE_URL}/perfil`,
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: { card: 'summary', title: 'Mi Perfil — TakaSports', site: '@takasports' },
}

export default function PerfilLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
