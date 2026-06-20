import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SITE_URL } from '@/lib/constants'
import { EstadisticasView, SPORT_META } from '../StatsView'

// Landings de estadísticas por deporte como RUTA DE PATH (params SÍ se cachean, a
// diferencia de ?sport=). `dynamicParams = false` → cualquier slug fuera de la
// lista da 404 REAL (Next 16 no propaga el 404 desde notFound() en ISR, así que
// esto es lo que evita el soft-404). `revalidate = 300` regenera los datos en
// segundo plano cada 5 min; hereda FAST_CACHE del middleware.
export const revalidate = 300
export const dynamicParams = false

export function generateStaticParams() {
  return Object.keys(SPORT_META).map((sport) => ({ sport }))
}

export async function generateMetadata({
  params,
}: { params: Promise<{ sport: string }> }): Promise<Metadata> {
  const { sport } = await params
  const meta = SPORT_META[sport]
  // Slug inválido: metadata vacía (hereda el layout). La página devolverá 404.
  if (!meta) return {}

  const title = `Estadísticas ${meta.label} en vivo`
  const description = `${meta.description} Datos actualizados al minuto.`
  const ogImage = `${SITE_URL}/api/og/estadisticas?sport=${sport}`
  const canonical = `${SITE_URL}/estadisticas/${sport}`

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

export default async function EstadisticasSportPage({
  params,
}: { params: Promise<{ sport: string }> }) {
  const { sport } = await params
  if (!SPORT_META[sport]) notFound()
  return (
    <>
      {/* H1 server-rendered con el deporte: la vista es cliente y no emitía H1. (Fix M1 SEO) */}
      <h1 className="sr-only">Estadísticas de {SPORT_META[sport].label} en vivo</h1>
      <EstadisticasView sport={sport} />
    </>
  )
}
