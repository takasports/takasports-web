import dynamic from 'next/dynamic'
import type { Metadata } from 'next'
import { getStandingsData } from '@/app/api/stats/standings/route'
import { SITE_URL } from '@/lib/constants'
import EstadisticasLoading from './loading'

const EstadisticasClient = dynamic(() => import('./EstadisticasClient'), {
  loading: () => <EstadisticasLoading />,
})

// Para que cada ?sport= tenga su propia metadata + OG image, declaramos
// la página como dinámica respecto a searchParams. Sin esto Next.js
// cachearía un único snapshot y todos los deportes compartirían OG.
export const dynamicParams = true

interface SportMeta { label: string; description: string }
const SPORT_META: Record<string, SportMeta> = {
  futbol:     { label: 'Fútbol',      description: 'LaLiga, Premier, Bundesliga, Serie A, Ligue 1 y UEFA en vivo.' },
  baloncesto: { label: 'NBA',         description: 'Conferencias, anotadores, MVP/DPOY/ROY race y playoffs en vivo.' },
  f1:         { label: 'Fórmula 1',   description: 'Pilotos, constructores, sprints, poles y calendario 2026 en vivo.' },
  tenis:      { label: 'Tenis',       description: 'Rankings ATP/WTA y calendario Grand Slams 2026.' },
  motogp:     { label: 'MotoGP',      description: 'Mundial de pilotos y constructores temporada 2026.' },
  ufc:        { label: 'UFC',         description: 'Pound for Pound y campeones por división actualizados.' },
  mundial:    { label: 'Mundial 2026',description: 'Grupos, clasificados, anfitriones y goleadores del Mundial.' },
}

export async function generateMetadata({
  searchParams,
}: { searchParams: Promise<{ sport?: string }> }): Promise<Metadata> {
  const sp = await searchParams
  const sport = (sp?.sport ?? '').toLowerCase()
  const meta = SPORT_META[sport]

  const title = meta
    ? `Estadísticas ${meta.label} en vivo`
    : 'Estadísticas deportivas en vivo'
  const description = meta
    ? `${meta.description} Datos actualizados al minuto.`
    : 'Goleadores, asistencias, clasificaciones de LaLiga, Premier League, NBA, F1 y más ligas actualizadas en tiempo real.'
  const ogImage = sport && meta
    ? `${SITE_URL}/api/og/estadisticas?sport=${sport}`
    : `${SITE_URL}/estadisticas/opengraph-image`
  const canonical = sport && meta
    ? `${SITE_URL}/estadisticas?sport=${sport}`
    : `${SITE_URL}/estadisticas`

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${title} | TakaSports`,
      description,
      url: canonical,
      siteName: 'TakaSports',
      locale: 'es_ES',
      type: 'website',
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} — TakaSports`,
      description,
      site: '@takasportsx',
      images: [ogImage],
    },
  }
}

export default async function EstadisticasPage() {
  let initialData = null
  try {
    initialData = await getStandingsData()
  } catch (err) {
    console.error('[estadisticas] SSR data fetch failed:', err)
  }
  return <EstadisticasClient initialData={initialData} />
}
