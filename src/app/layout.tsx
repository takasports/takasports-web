import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { Barlow_Condensed, Barlow_Semi_Condensed } from 'next/font/google'
import './globals.css'

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const barlowCondensed = Barlow_Condensed({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['700', '800', '900'],
  style: ['normal', 'italic'],
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
  openGraph: {
    title: 'TakaSports — Noticias deportivas',
    description: 'Las últimas noticias del deporte en un solo lugar.',
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
    url: 'https://takasportsmedia.com',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TakaSports — Noticias deportivas',
    description: 'Las últimas noticias del deporte en un solo lugar.',
    site: '@takasports',
  },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${geist.variable} ${barlowCondensed.variable} ${barlowSemiCondensed.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
