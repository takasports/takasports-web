import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { Barlow_Condensed, Bebas_Neue, Barlow_Semi_Condensed } from 'next/font/google'
import { headers } from 'next/headers'
import './globals.css'
import BottomNav from '@/components/BottomNav'
import ConsentBanner from '@/components/ConsentBanner'
import AutoTZInit from '@/components/AutoTZInit'
import { SITE_URL, SITE_NAME, TWITTER_HANDLE, LOGO_URL, ICON_URL } from '@/lib/constants'

const GA_ID = process.env.NEXT_PUBLIC_GA_ID
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

// Barlow Condensed 900 — para títulos editoriales largos (hero, artículos, secciones)
// Condensed pero legible en mixed-case, peso fuerte sin ser tabloid
const barlowCondensed = Barlow_Condensed({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['700', '800', '900'],
  style: ['normal'],
  display: 'swap',
})

// Bebas Neue — solo para labels cortos de sección ("REELS", "CALENDARIO", etc.)
// All-caps agresivo, perfecto en contextos breves de impacto
const bebasNeue = Bebas_Neue({
  variable: '--font-headline',
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
})

const barlowSemiCondensed = Barlow_Semi_Condensed({
  variable: '--font-sport',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'TakaSports — Noticias deportivas',
    template: '%s | TakaSports',
  },
  description: 'Noticias deportivas de actualidad: fútbol, NBA, F1, UFC y tenis. Resultados en vivo, calendario, rankings y juegos. Actualizado cada hora.',
  authors: [{ name: 'TakaSports', url: SITE_URL }],
  creator: 'TakaSports',
  publisher: 'TakaSports',
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  alternates: {
    canonical: SITE_URL,
    // Hreflang: el mismo contenido sirve a toda la comunidad hispanohablante
    // (España + Latinoamérica). No hay variantes regionales de URL.
    languages: {
      'x-default': SITE_URL,
      'es':        SITE_URL,
      'es-ES':     SITE_URL,
      'es-419':    SITE_URL,  // Español Latinoamérica (Buenos Aires ya aparece en analytics)
    },
  },
  verification: { google: ['LkOObyh0JeHucGf6NTELFcAQxFSMJrd2-9QoWVMM1g4', 'uciwyOWZbwp-GK4G0jKLxu6_FMuP5ZeptYObbCQxbJM'] },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'TakaSports',
  },
  openGraph: {
    title: 'TakaSports — Noticias deportivas en tiempo real',
    description: 'Noticias deportivas de actualidad: fútbol, NBA, F1, UFC y tenis. Resultados en vivo, calendario, rankings y juegos.',
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
    url: SITE_URL,
    images: [{ url: LOGO_URL, width: 1200, height: 630, alt: 'TakaSports — Noticias deportivas', type: 'image/png' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TakaSports — Noticias deportivas en tiempo real',
    description: 'Noticias deportivas de actualidad: fútbol, NBA, F1, UFC y tenis. Resultados en vivo, calendario y juegos.',
    site: '@takasportsx',
    creator: '@takasportsx',
    images: [LOGO_URL],
  },
}

export const viewport = {
  themeColor: '#7C3AED',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const headersList = await headers()
  const nonce = headersList.get('x-nonce') ?? ''

  return (
    <html
      lang="es"
      className={`${geist.variable} ${barlowCondensed.variable} ${bebasNeue.variable} ${barlowSemiCondensed.variable} h-full`}
    >
      <head>
        <link rel="preconnect" href="https://cdn.sanity.io" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://site.api.espn.com" />
        <link rel="dns-prefetch" href="https://v3.football.api-sports.io" />
        <link rel="alternate" type="application/rss+xml" title="TakaSports — Noticias deportivas" href="/rss.xml" />
      </head>
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'Organization',
                '@id': `${SITE_URL}/#organization`,
                name: 'TakaSports',
                alternateName: 'TakaSports Media',
                url: SITE_URL,
                foundingDate: '2024',
                logo: { '@type': 'ImageObject', url: LOGO_URL, width: 512, height: 512 },
                sameAs: ['https://www.instagram.com/takasportsmedia', 'https://x.com/takasportsx'],
                areaServed: { '@type': 'Country', name: 'España' },
                knowsAbout: ['Fútbol', 'Baloncesto', 'Fórmula 1', 'UFC', 'Tenis', 'Lucha libre', 'Rugby'],
              },
              {
                '@type': 'WebSite',
                '@id': `${SITE_URL}/#website`,
                url: SITE_URL,
                name: 'TakaSports',
                description: 'Noticias deportivas de actualidad: fútbol, NBA, F1, UFC y tenis. Resultados en vivo, calendario, rankings y juegos.',
                publisher: { '@id': `${SITE_URL}/#organization` },
                inLanguage: 'es-ES',
                potentialAction: {
                  '@type': 'SearchAction',
                  target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/noticias?q={search_term_string}` },
                  'query-input': 'required name=search_term_string',
                },
              },
            ],
          }) }}
        />
        <AutoTZInit />
        {children}
        <BottomNav />
        <ConsentBanner gaId={GA_ID} clarityId={CLARITY_ID} nonce={nonce} />
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator) { window.addEventListener('load', () => { const reg = () => navigator.serviceWorker.register('/sw.js').catch(() => {}); 'requestIdleCallback' in window ? requestIdleCallback(reg) : setTimeout(reg, 2000) }) }`,
          }}
        />
      </body>
    </html>
  )
}
