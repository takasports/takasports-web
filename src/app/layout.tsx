import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { Barlow_Condensed, Bebas_Neue, Barlow_Semi_Condensed } from 'next/font/google'
import Script from 'next/script'
import './globals.css'

const GA_ID = process.env.NEXT_PUBLIC_GA_ID

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
  title: 'TakaSports — Noticias deportivas',
  description: 'Las últimas noticias del deporte en un solo lugar. Fútbol, NBA, UFC, F1, Tenis y más.',
  verification: { google: 'LkOObyh0JeHucGf6NTELFcAQxFSMJrd2-9QoWVMM1g4' },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'TakaSports',
  },
  openGraph: {
    title: 'TakaSports — Noticias deportivas',
    description: 'Las últimas noticias del deporte en un solo lugar.',
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
    url: 'https://takasportsmedia.com',
    images: [{ url: 'https://takasportsmedia.com/taka-logo.png', width: 512, height: 512, alt: 'TakaSports' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TakaSports — Noticias deportivas',
    description: 'Las últimas noticias del deporte en un solo lugar.',
    site: '@takasports',
    images: ['https://takasportsmedia.com/taka-logo.png'],
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
  return (
    <html
      lang="es"
      className={`${geist.variable} ${barlowCondensed.variable} ${bebasNeue.variable} ${barlowSemiCondensed.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}) }) }`,
          }}
        />
        {GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}',{page_path:window.location.pathname});`}
            </Script>
          </>
        )}
      </body>
    </html>
  )
}
