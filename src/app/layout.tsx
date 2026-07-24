import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { Barlow_Condensed, Bebas_Neue, Barlow_Semi_Condensed } from 'next/font/google'
import './globals.css'
import BottomNav from '@/components/BottomNav'
import ConsentBanner from '@/components/ConsentBanner'
import AutoTZInit from '@/components/AutoTZInit'
import DeviceCapInit from '@/components/DeviceCapInit'
// Wrapper client que dynamic-importa PorraSettlementToast + BadgeUnlockProvider
// (ambos client-only, no afectan al HTML inicial). Libera ~15 KiB del bundle
// inicial. Ver F3.3 (jun 2026).
import ClientOnlyLayoutScripts from '@/components/ClientOnlyLayoutScripts'
import PWAManager from '@/components/PWAManager'
import { SITE_URL, SITE_NAME, TWITTER_HANDLE, LOGO_URL, ICON_URL } from '@/lib/constants'

const GA_ID = process.env.NEXT_PUBLIC_GA_ID
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
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
// All-caps agresivo, perfecto en contextos breves de impacto.
// preload:false — no pinta nunca el elemento LCP (solo labels). Con preload activo
// Next emitía un <link rel="preload"> que competía por ancho de banda con la imagen
// del hero justo durante el LCP en móvil. Carga igual, solo que sin prioridad.
const bebasNeue = Bebas_Neue({
  variable: '--font-headline',
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
  preload: false,
})

// preload:false — 3 pesos = 3 archivos precargados solo para badges/chips de deporte.
// Misma razón que Bebas Neue: liberar la ruta crítica del LCP.
const barlowSemiCondensed = Barlow_Semi_Condensed({
  variable: '--font-sport',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  display: 'swap',
  preload: false,
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
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 },
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
  // Smart App Banner NATIVO de Apple (solo iOS/Safari móvil): una barra fina que
  // muestra "OBTENER" a quien no tiene la app y "ABRIR" a quien ya la tiene. Es la
  // ÚNICA invitación a la app en iOS — el banner propio (PWAManager) queda solo
  // para Android, donde no hay app nativa. app-id de la ficha "Taka Sports".
  itunes: { appId: '6787799706' },
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // F3.1 (jun 2026): root layout ya NO llama await headers() para leer el
  // nonce CSP. Esa llamada marcaba TODA la app como dinámica → Next emitía
  // `cache-control: no-store` por defecto, bloqueando cache CDN y degradando
  // CWV. Trade-off consciente: los scripts inline del root (JSON-LD, SW
  // register, GA via ConsentBanner) ya no llevan nonce. En rutas públicas
  // funcionan porque next.config.ts global CSP incluye 'unsafe-inline'. En
  // las 4 rutas auth (perfil/admin/quiniela/archivo) la CSP strict del
  // middleware bloqueará GA/Clarity en navegación entrante directa — esas
  // rutas son noindex y de uso interno, impacto SEO nulo. Si la analítica
  // en esas rutas se vuelve crítica, se puede injectar nonce localmente vía
  // (auth)/layout.tsx en route group separado más adelante.
  return (
    <html
      lang="es"
      className={`${geist.variable} ${barlowCondensed.variable} ${bebasNeue.variable} ${barlowSemiCondensed.variable} h-full`}
    >
      <head>
        <link rel="preconnect" href="https://cdn.sanity.io" />
        {/* Sin preconnect a fonts.googleapis.com / fonts.gstatic.com: next/font
            descarga las fuentes en build y las sirve desde nuestro propio origen
            (/_next/static/media). En runtime NUNCA se conecta a Google, así que
            esos dos preconnect solo ocupaban cupo de conexiones tempranas. */}
        <link rel="dns-prefetch" href="https://site.api.espn.com" />
        <link rel="dns-prefetch" href="https://v3.football.api-sports.io" />
        <link rel="alternate" type="application/rss+xml" title="TakaSports — Noticias deportivas" href="/rss.xml" />
        {/* Red de seguridad CSS incrustada: si la hoja de estilos externa no llega
            (p. ej. HTML cacheado tras un deploy → CSS con hash viejo da 404), las
            imágenes NO deben salir a tamaño natural tapando el texto. Va inline en
            el <head> para que esté SIEMPRE, incluso sin el CSS de la app. */}
        <style
          dangerouslySetInnerHTML={{
            __html: 'img,video{max-width:100%;height:auto}',
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              {
                // NewsMediaOrganization es el subtipo específico que Google News
                // valora para EEAT: permite declarar policies verificables que
                // los Search Quality Raters comprueban manualmente.
                '@type': 'NewsMediaOrganization',
                '@id': `${SITE_URL}/#organization`,
                name: 'TakaSports',
                alternateName: 'TakaSports Media',
                url: SITE_URL,
                foundingDate: '2024',
                logo: { '@type': 'ImageObject', url: LOGO_URL, width: 512, height: 512 },
                image: { '@type': 'ImageObject', url: LOGO_URL, width: 512, height: 512 },
                description: 'Plataforma de noticias y análisis deportivos en español. Fútbol, NBA, F1, UFC, tenis y más. Resultados en vivo, rankings editoriales y juegos interactivos.',
                // Perfiles reales (fuente: barra social del footer). Consolida la
                // entidad de marca en el Knowledge Graph y la desambigua de homónimos.
                sameAs: [
                  'https://www.instagram.com/taka.sports',
                  'https://x.com/takasportsx',
                  'https://www.tiktok.com/@taka.sports',
                  'https://www.youtube.com/@takasports',
                  'https://www.threads.net/@taka.sports',
                ],
                areaServed: { '@type': 'Country', name: 'España' },
                knowsAbout: ['Fútbol', 'Baloncesto', 'Fórmula 1', 'UFC', 'Tenis', 'Lucha libre', 'Rugby', 'MotoGP'],
                contactPoint: {
                  '@type': 'ContactPoint',
                  email: 'contacto@takasportsmedia.com',
                  contactType: 'editorial',
                  availableLanguage: ['Spanish', 'es'],
                },
                // Policies que Google News exige documentadas y enlazadas para EEAT
                publishingPrinciples: `${SITE_URL}/politica-editorial`,
                actionableFeedbackPolicy: `${SITE_URL}/politica-editorial#seccion-5`,
                correctionsPolicy: `${SITE_URL}/politica-editorial#seccion-5`,
                verificationFactCheckingPolicy: `${SITE_URL}/politica-editorial#seccion-3`,
                ethicsPolicy: `${SITE_URL}/politica-editorial#seccion-6`,
                missionCoveragePrioritiesPolicy: `${SITE_URL}/politica-editorial#seccion-2`,
                unnamedSourcesPolicy: `${SITE_URL}/politica-editorial#seccion-7`,
                ownershipFundingInfo: `${SITE_URL}/politica-editorial#seccion-8`,
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
        <DeviceCapInit />
        {children}
        <BottomNav />
        <ConsentBanner gaId={GA_ID} clarityId={CLARITY_ID} />
        <PWAManager />
        <ClientOnlyLayoutScripts />
      </body>
    </html>
  )
}
