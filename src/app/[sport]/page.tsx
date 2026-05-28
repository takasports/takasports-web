import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { sanityClient, articlesBySportQuery, reelsQuery, eventsBySportQuery } from '@/lib/sanity'
import { SLUG_TO_LABEL, getSportEmoji } from '@/lib/sports'
import { getRanking } from '@/lib/rankings-data'
import reelsData from '@/lib/reels-data.json'
import Header from '@/components/Header'
import BreakingNewsBar from '@/components/BreakingNewsBar'
import LiveStrip from '@/components/LiveStrip'
import NoticiasContent from '@/components/NoticiasContent'
import SportHubHeader from '@/components/SportHubHeader'
import Footer from '@/components/Footer'
import ScrollToTop from '@/components/ScrollToTop'
import { urlFor } from '@/lib/sanity'
import { SITE_URL, LOGO_URL } from '@/lib/constants'

export const revalidate = 300

export function generateStaticParams() {
  return Object.keys(SLUG_TO_LABEL).map(sport => ({ sport }))
}

// Metadata dinámica por deporte
export async function generateMetadata({
  params,
}: {
  params: Promise<{ sport: string }>
}): Promise<Metadata> {
  const { sport } = await params
  const label = SLUG_TO_LABEL[sport.toLowerCase()]
  if (!label) return {}

  const emoji = getSportEmoji(label)
  const title = `${label}: noticias, resultados y análisis`
  const description = `Últimas noticias de ${label}: resultados, fichajes, partidos en vivo y análisis en profundidad. Actualizado al minuto.`

  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}/${sport}`,
    },
    openGraph: {
      title: `${emoji} ${title} | TakaSports`,
      description,
      siteName: 'TakaSports',
      locale: 'es_ES',
      type: 'website',
      url: `${SITE_URL}/${sport}`,
      images: [{ url: LOGO_URL, width: 800, height: 800, alt: `${label} — TakaSports` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${emoji} ${title} | TakaSports`,
      description,
      site: '@takasportsx',
    },
  }
}

export default async function SportPage({
  params,
}: {
  params: Promise<{ sport: string }>
}) {
  const { sport } = await params
  const label = SLUG_TO_LABEL[sport.toLowerCase()]

  // Si el slug no es un deporte válido → 404
  if (!label) notFound()

  const sportSlug = sport.toLowerCase()
  const rankCategory = sportSlug === 'wwe' ? 'creadores_wwe' : 'jugadores'

  const [articles, reels, allRankings, upcomingEvents] = await Promise.all([
    sanityClient.fetch(articlesBySportQuery, { sport: sportSlug }),
    sanityClient.fetch(reelsQuery),
    getRanking(rankCategory),
    sanityClient.fetch(eventsBySportQuery, { sport: sportSlug }),
  ])

  const topRankings = rankCategory === 'jugadores'
    ? allRankings.filter((e: { sport?: string }) => e.sport === sportSlug).slice(0, 5)
    : allRankings.slice(0, 5)

  // Filter out any null/undefined entries (Sanity can return nulls for broken references)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const safeArticles = (articles as any[]).filter(Boolean)
  const igReels = (reels as unknown[]).length > 0 ? reels : reelsData
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sportEvents = ((upcomingEvents as any[]) ?? []).filter(Boolean)

  const sportUrl = `${SITE_URL}/${sport}`

  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${label} — TakaSports`,
    description: `Últimas noticias de ${label}: resultados, fichajes, partidos en vivo y análisis en profundidad.`,
    url: sportUrl,
    inLanguage: 'es-ES',
    isPartOf: { '@id': `${SITE_URL}/#website` },
    publisher: { '@id': `${SITE_URL}/#organization` },
  }

  const SPORT_FAQS: Record<string, Array<{ q: string; a: string }>> = {
    futbol: [
      { q: '¿Cuántos equipos hay en LaLiga?', a: 'LaLiga EA Sports está formada por 20 equipos que compiten en un sistema de liga a doble vuelta (38 jornadas). Al final de la temporada, los 3 últimos clasificados descienden a la Liga Hypermotion.' },
      { q: '¿Qué es el VAR en el fútbol?', a: 'El VAR (Video Assistant Referee) es el sistema de videoarbitraje que asiste al árbitro principal en cuatro situaciones: goles, penaltis, tarjetas rojas directas e identidad equivocada. Se opera desde una sala externa con acceso a todas las cámaras.' },
      { q: '¿Cuándo empieza la temporada de LaLiga?', a: 'La temporada de LaLiga comienza a mediados de agosto y termina en mayo del año siguiente, con 38 jornadas de competición para cada equipo.' },
    ],
    baloncesto: [
      { q: '¿Cuántos equipos juegan los playoffs de la NBA?', a: 'Los playoffs de la NBA enfrentan a los 16 mejores equipos de la temporada regular: los 8 primeros de la Conferencia Este y los 8 primeros del Oeste. Desde 2020, existe el play-in tournament para los equipos del 7.º al 10.º puesto.' },
      { q: '¿Cuántos cuartos tiene un partido de NBA?', a: 'Un partido de NBA se divide en 4 cuartos de 12 minutos cada uno, con 15 minutos de descanso en el intermedio. En caso de empate, se juegan prórrogas de 5 minutos hasta que haya un ganador.' },
      { q: '¿Qué es el triple-doble en baloncesto?', a: 'Un triple-doble ocurre cuando un jugador alcanza dos dígitos en tres categorías estadísticas distintas en el mismo partido. Las más habituales son puntos, rebotes y asistencias.' },
    ],
    formula1: [
      { q: '¿Cómo se puntúa en la Fórmula 1?', a: 'En la F1, se otorgan puntos a los 10 primeros de cada Gran Premio: 25, 18, 15, 12, 10, 8, 6, 4, 2 y 1. Hay un punto adicional para el piloto que marque la vuelta rápida (si termina entre los 10 primeros).' },
      { q: '¿Cuántas carreras tiene la temporada de F1?', a: 'La temporada 2026 de Fórmula 1 incluye 24 Grandes Premios, desde Australia en marzo hasta Abu Dabi en diciembre.' },
      { q: '¿Qué es la pole position en F1?', a: 'La pole position es la primera posición de salida en la parrilla de una carrera de F1, obtenida por el piloto más rápido en la sesión de clasificación (qualifying). Salir desde la pole ofrece ventaja porque se arranca en la parte limpia de la pista.' },
    ],
    ufc: [
      { q: '¿Cuántos rounds tiene un combate de UFC?', a: 'Los combates no estelares de la UFC se disputan a 3 rounds de 5 minutos. Los combates estelares y todos los combates por el título van a 5 rounds de 5 minutos.' },
      { q: '¿Cómo se gana un combate en la UFC?', a: 'En la UFC se puede ganar por KO (el rival queda inconsciente), TKO (el árbitro para el combate por daño), sumisión (el rival da tap), decisión de los jueces al llegar al límite de rounds, o descalificación.' },
      { q: '¿Cuántas categorías de peso hay en la UFC?', a: 'La UFC tiene 8 categorías masculinas (de Mosca a Pesado) y 4 femeninas (Átomo, Paja, Mosca y Gallo). Cada categoría tiene su propio campeón y cinturón.' },
    ],
    tenis: [
      { q: '¿Cuántos Grand Slams hay en el tenis?', a: 'Hay cuatro Grand Slams: Open de Australia (enero, pista dura), Roland Garros (mayo-junio, tierra batida), Wimbledon (junio-julio, hierba) y US Open (agosto-septiembre, pista dura). Son los torneos más importantes del circuito.' },
      { q: '¿Cómo funciona el ranking ATP/WTA?', a: 'El ranking ATP y WTA se calcula sumando los puntos obtenidos en los torneos de los últimos 52 semanas. Un Grand Slam otorga hasta 2.000 puntos al campeón. Los puntos se defienden: si el año anterior ganaste un torneo y este año pierdes antes, bajas en el ranking.' },
      { q: '¿Qué es un tie-break en tenis?', a: 'El tie-break es el desempate que se juega cuando un set llega a 6-6 en juegos. Lo gana el primer jugador que alcanza 7 puntos con al menos 2 de diferencia. Desde 2022 en el último set de los Grand Slams se usa un tie-break a 10 puntos.' },
    ],
    wwe: [
      { q: '¿Qué es la WWE?', a: 'La WWE (World Wrestling Entertainment) es la mayor organización de lucha libre profesional del mundo. Combina deporte y entretenimiento en shows semanales como RAW y SmackDown, y pay-per-views como WrestleMania, SummerSlam y Royal Rumble.' },
      { q: '¿Cuándo es WrestleMania?', a: 'WrestleMania, el evento más importante de la WWE, se celebra habitualmente en abril, con 2 noches consecutivas. Es el equivalente al "Super Bowl" de la lucha libre profesional.' },
    ],
    rugby: [
      { q: '¿Cuántos jugadores tiene un equipo de rugby?', a: 'En rugby union (el formato más extendido), cada equipo tiene 15 jugadores en el campo. En rugby league son 13. Los encuentros duran 80 minutos divididos en dos partes de 40.' },
      { q: '¿Qué es un try en rugby?', a: 'Un try es la anotación más valiosa del rugby: se consigue cuando un jugador cruza la línea de marca rival y apoya el balón en el suelo dentro del in-goal. Vale 5 puntos y otorga el derecho a una conversión (2 puntos adicionales).' },
    ],
  }
  const sportFaqs = SPORT_FAQS[sportSlug] ?? []
  const faqJsonLd = sportFaqs.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: sportFaqs.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  } : null

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'TakaSports', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Noticias', item: `${SITE_URL}/noticias` },
      { '@type': 'ListItem', position: 3, name: label, item: sportUrl },
    ],
  }

  type SportArticle = { _id: string; slug?: string; title: string; imageUrl?: string | null; image?: { asset: { _ref: string } } | null }
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Últimas noticias de ${label}`,
    itemListOrder: 'https://schema.org/ItemListOrderDescending',
    numberOfItems: Math.min(safeArticles.length, 20),
    itemListElement: (safeArticles as SportArticle[]).slice(0, 20).map((a, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: a.slug ? `${SITE_URL}/noticias/${a.slug}` : undefined,
      name: a.title,
      image: a.imageUrl ?? (a.image?.asset ? urlFor(a.image).width(1200).height(630).url() : undefined),
    })),
  }

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      {faqJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      )}
      <Header />
      <BreakingNewsBar
        items={safeArticles.slice(0, 8).map(
          (a: { title: string; sport?: string; category?: string }) => ({
            title: a.title,
            sport: a.sport || a.category,
          })
        )}
      />
      <LiveStrip />
      <SportHubHeader
        sport={sportSlug}
        label={label}
        topRankings={topRankings}
        upcomingEvents={sportEvents}
      />

      <main className="max-w-[1440px] mx-auto pb-24">
        <NoticiasContent
          articles={safeArticles}
          reels={igReels as typeof reels}
          initialCategory={label}
        />
      </main>

      <Footer />
      <ScrollToTop />
    </div>
  )
}
