import type { Metadata } from 'next'
import { sanityClient, articlesQuery, articlesBySlugsQuery, reelsQuery, eventsQuery } from '@/lib/sanity'
import { HOME_SPORT_CATEGORIES, MORE_SPORT_CATEGORIES, CATEGORY_TO_SLUG } from '@/lib/sports'
import { normalizeEvent } from '@/lib/events'
import { fetchEspnEvents } from '@/lib/espn'
import { fetchPublicReels } from '@/lib/instagram-public'
import { getRanking } from '@/lib/rankings-data'
import { SEED_REELS } from '@/lib/seed-reels'
import Header from '@/components/Header'
import BreakingNewsBar from '@/components/BreakingNewsBar'
import LiveStrip from '@/components/LiveStrip'
import HomeContent from '@/components/HomeContent'
import SignalIntro from '@/components/SignalIntro'
import WelcomeOnboarding from '@/components/WelcomeOnboarding'
import Footer from '@/components/Footer'
import NewsletterSection from '@/components/NewsletterSection'
import ScrollToTop from '@/components/ScrollToTop'
import { urlFor } from '@/lib/sanity'
import { SITE_URL } from '@/lib/constants'

export const revalidate = 300

export const metadata: Metadata = {
  title: { absolute: 'TakaSports — Noticias deportivas en tiempo real' },
  description: 'Noticias deportivas de actualidad: fútbol, NBA, F1, UFC y tenis. Resultados en vivo, calendario, rankings y juegos. Actualizado cada hora.',
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: 'TakaSports — Noticias deportivas en tiempo real',
    description: 'Noticias deportivas de actualidad: fútbol, NBA, F1, UFC y tenis. Resultados en vivo, calendario, rankings y juegos.',
    url: SITE_URL,
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TakaSports — Noticias deportivas en tiempo real',
    description: 'Noticias deportivas de actualidad: fútbol, NBA, F1, UFC y tenis. Resultados en vivo, calendario y juegos.',
    site: '@takasportsx',
    creator: '@takasportsx',
  },
}

interface HomeArticle {
  _id: string
  slug?: string
  title: string
  short_summary?: string
  publishedAt?: string
  category?: string
  sport?: string
  priority?: string
  image?: { asset: { _ref: string } } | null
  imageUrl?: string | null
  isTaka?: boolean
}

// Hero del día: artículos con priority alta publicados en las últimas 24h suben al top
const PRIORITY_BOOST: Record<string, number> = { hero: 3, destacado: 2, normal: 1, secundario: 0 }
const DAY_MS = 24 * 60 * 60 * 1000

function sortForHome(articles: HomeArticle[]): HomeArticle[] {
  const now = Date.now()
  return [...articles].sort((a, b) => {
    const ageA = now - new Date(a.publishedAt ?? 0).getTime()
    const ageB = now - new Date(b.publishedAt ?? 0).getTime()
    const boostA = ageA < DAY_MS ? (PRIORITY_BOOST[a.priority ?? 'normal'] ?? 1) : 0
    const boostB = ageB < DAY_MS ? (PRIORITY_BOOST[b.priority ?? 'normal'] ?? 1) : 0
    if (boostA !== boostB) return boostB - boostA
    return ageA - ageB
  })
}

export default async function Home() {
  // F3.5 (jun 2026): el home ya NO lee searchParams en server. Antes hacía
  // `await searchParams` para preseleccionar el filtro `?sport=X` → marcaba
  // toda la home como dinámica → Vercel emitía Cache-Control: no-store →
  // catastrófico para SEO + CWV (LCP 7.7s en mobile medido en PSI). Ahora
  // el preseleccionado se lee client-side en HomeContent via useSearchParams.

  // Slugs canónicos de las categorías visibles en el home (incluye el "Más").
  // Para cada uno, también enviamos los aliases que pueden aparecer en Sanity
  // (en `sport`, `category` o `competition`) para no perder artículos.
  const HOME_SLUG_ALIASES: Record<string, string[]> = {
    baloncesto: ['nba', 'euroliga', 'bcl', 'acb'],
    wwe: ['wrestling'],
    formula1: ['f1'],
  }
  const HOME_SPORT_SLUGS = Array.from(
    new Set(
      [...HOME_SPORT_CATEGORIES, ...MORE_SPORT_CATEGORIES]
        .map(c => CATEGORY_TO_SLUG[c])
        .filter((s): s is string => Boolean(s))
    )
  )

  const [rawArticles, sanityReels, rawEvents, espnEvents, igReels, topPlayers, perSportRaw] = await Promise.all([
    sanityClient.fetch<HomeArticle[]>(articlesQuery).catch(() => []),
    sanityClient.fetch(reelsQuery).catch(() => []),
    sanityClient.fetch(eventsQuery).catch(() => []),
    fetchEspnEvents().catch(() => []),
    fetchPublicReels().catch(() => []),
    // El Sidebar del home solo pinta TOP 5 jugadores. Mandar los 200 de
    // getRanking(...) inflaba el RSC payload de la home en ~500 KB sin uso.
    getRanking('jugadores').then(r => r.slice(0, 5)).catch(() => []),
    Promise.all(
      HOME_SPORT_SLUGS.map(slug => {
        const slugs = Array.from(new Set([slug, ...(HOME_SLUG_ALIASES[slug] ?? [])]))
        return sanityClient
          .fetch<HomeArticle[]>(articlesBySlugsQuery, { slugs })
          .catch(() => [] as HomeArticle[])
      })
    ),
  ])

  const articles = sortForHome(rawArticles)

  // Fallback de destacadas por deporte: si el filtro del home no encuentra
  // nada entre las 40 más recientes, mostramos las top-N de ese deporte.
  const featuredBySport: Record<string, HomeArticle[]> = {}
  HOME_SPORT_SLUGS.forEach((slug, i) => {
    featuredBySport[slug] = sortForHome(perSportRaw[i] ?? []).slice(0, 8)
  })

  // SSR: Sanity reels → live Instagram API → seed placeholders
  const reels = (sanityReels as unknown[]).length > 0
    ? sanityReels
    : igReels.length > 0
      ? igReels
      : SEED_REELS

  const sanityEvents = Array.isArray(rawEvents) && rawEvents.length > 0
    ? rawEvents.map(normalizeEvent)
    : []
  const sanityIds = new Set(sanityEvents.map((e: { home: string; away: string | null }) => `${e.home}|${e.away}`))
  const events = [...sanityEvents, ...espnEvents.filter(e => !sanityIds.has(`${e.home}|${e.away}`))]

  // F3.5: el initialSport ahora se calcula en HomeContent (client) leyendo `?sport=X`.

  // VideoObject JSON-LD: solo cuando tenemos reels reales de Sanity con datos suficientes
  interface SanityReel {
    _id: string
    title?: string | null
    instagram_url?: string | null
    thumbnail?: { asset: { _ref: string } } | null
    publishedAt?: string | null
  }
  const sanityReelsTyped = sanityReels as SanityReel[]
  const videoReels = sanityReelsTyped.filter(
    r => r.title && r.instagram_url && r.thumbnail?.asset,
  )
  const videoListJsonLd =
    videoReels.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: 'Últimos reels — TakaSports',
          itemListOrder: 'https://schema.org/ItemListOrderDescending',
          numberOfItems: videoReels.length,
          itemListElement: videoReels.map((r, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            item: {
              '@type': 'VideoObject',
              name: r.title,
              contentUrl: r.instagram_url,
              thumbnailUrl: urlFor(r.thumbnail!).width(640).height(640).url(),
              ...(r.publishedAt ? { uploadDate: new Date(r.publishedAt).toISOString() } : {}),
            },
          })),
        }
      : null

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Últimas noticias — TakaSports',
    itemListOrder: 'https://schema.org/ItemListOrderDescending',
    numberOfItems: Math.min(articles.length, 20),
    isPartOf: { '@id': `${SITE_URL}/#website` },
    itemListElement: articles.slice(0, 20).map((a, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: a.slug ? `${SITE_URL}/noticias/${a.slug}` : undefined,
      name: a.title,
      description: a.short_summary,
      image: a.imageUrl ?? (a.image?.asset ? urlFor(a.image).width(1200).height(630).url() : undefined),
    })),
  }

  // LCP del hero: NO emitimos un <link rel="preload"> manual.
  //
  // F3.8 (jun 2026): el preload manual apuntaba a la URL ORIGINAL del artículo
  // (Supabase/Sanity son hosts "optimizados", así que resolveImageUrl devolvía
  // la cruda). Pero el <img> real del hero es next/image, que descarga
  // `/_next/image?...` (AVIF/WebP redimensionado) y YA emite su propio
  // <link rel="preload" imageSrcSet=...> con la variante correcta. Resultado:
  // el preload manual descargaba en alta prioridad el JPEG ORIGINAL de ~402 KB
  // que nunca se muestra, robando ancho de banda al AVIF bueno justo durante el
  // LCP en móvil. Eliminado: dejamos que el `priority` de next/image (BigCard)
  // haga el preload, que apunta a la imagen optimizada de verdad.

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <a href="#main" className="skip-link">Saltar al contenido</a>
      <SignalIntro />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      {videoListJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(videoListJsonLd) }} />
      )}
      <Header />
      <h1 className="sr-only">TakaSports — Noticias deportivas en tiempo real</h1>
      <BreakingNewsBar items={articles.slice(0, 8).map((a: { title: string; slug?: string; sport?: string; category?: string }) => ({ title: a.title, slug: a.slug, sport: a.sport || a.category }))} />
      <LiveStrip />
      <HomeContent articles={articles} reels={reels} events={events} topPlayers={topPlayers} featuredBySport={featuredBySport} />
      <NewsletterSection source="home" />
      <Footer />
      <WelcomeOnboarding />
      <ScrollToTop />
    </div>
  )
}
