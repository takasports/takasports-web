// Shell compartido para páginas de juego: Header sticky, LiveStrip opcional,
// main con padding seguro (BottomNav + safe-area iOS heredados de globals.css)
// y Footer + ScrollToTop.
//
// Deliberadamente NO impone timer/progress/share: cada juego mantiene esos
// elementos con su estilo propio. GameLayout es solo el chasis y expone el
// accent como CSS var (--game-accent, --game-accent-dim) para que los hijos
// la lean sin prop-drilling.
//
// Server component compatible. Si un juego necesita lógica cliente
// (e.g. ArchivePuzzleClient en TakaGrid), va como children.

import type { ReactNode } from 'react'
import Header from '@/components/Header'
import LiveStrip from '@/components/LiveStrip'
import Footer from '@/components/Footer'
import ScrollToTop from '@/components/ScrollToTop'
import NewsletterSection from '@/components/NewsletterSection'

interface GameLayoutProps {
  accent: string
  accentDim?: string
  liveStrip?: boolean
  /** Estilo adicional para el <main>. Útil para paddingTop específico
   *  de un juego sin tener que extraer al children. */
  mainStyle?: React.CSSProperties
  children: ReactNode
}

export default function GameLayout({
  accent,
  accentDim,
  liveStrip = true,
  mainStyle,
  children,
}: GameLayoutProps) {
  // CSS custom properties no son strict en React style typing; usamos cast.
  const cssVars = {
    '--game-accent': accent,
    '--game-accent-dim': accentDim ?? accent,
  } as React.CSSProperties

  return (
    <div
      style={{
        background: 'var(--bg-base)',
        minHeight: '100vh',
        ...cssVars,
      }}
    >
      <Header />
      {liveStrip && <LiveStrip />}
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 pb-24" style={mainStyle}>
        {children}
      </main>
      <NewsletterSection source="juegos" />
      <Footer />
      <ScrollToTop />
    </div>
  )
}
