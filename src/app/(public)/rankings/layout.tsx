import type { Metadata } from 'next'
import { SITE_URL, LOGO_URL, ICON_URL } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Ranking Taka — Rankings deportivos',
  description: 'Los mejores jugadores, equipos y deportistas del mundo según el Ranking Taka. Fútbol, NBA, F1, Tenis, UFC y más. Actualizado semanalmente.',
  alternates: { canonical: `${SITE_URL}/rankings` },
  openGraph: {
    title: 'Ranking Taka — Rankings deportivos | TakaSports',
    description: 'Los mejores jugadores y equipos del mundo según el Ranking Taka.',
    url: `${SITE_URL}/rankings`,
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: 'Rankings deportivos — TakaSports', site: '@takasportsx' },
}

export default function RankingsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
