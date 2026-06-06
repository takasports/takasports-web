// Vista completa de leaderboard para un juego. Top 100 + tu posición.
// Server component que pasa props al cliente; renderiza el chrome
// (header, footer, breadcrumb) en SSR para SEO.

import { notFound } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/Header'
import LiveStrip from '@/components/LiveStrip'
import Footer from '@/components/Footer'
import ScrollToTop from '@/components/ScrollToTop'
import LeaderboardFull from './LeaderboardFull'
import type { GameId } from '@/lib/games-store'
import { SITE_URL } from '@/lib/constants'

// Striker Rush queda fuera a propósito: aún no existe /strikerrush, así que su
// leaderboard debe devolver 404 (no un ranking fantasma con CTA a una página rota).
const META: Partial<Record<GameId, { label: string; accent: string; href: string }>> = {
  quiniela:    { label: 'Quiniela',       accent: '#A78BFA', href: '/quiniela' },
  crackquiz:   { label: 'CrackQuiz',      accent: '#FCD34D', href: '/crackquiz' },
  mionce:      { label: 'Mi Once',        accent: '#93C5FD', href: '/mionce' },
  sopacracks:  { label: 'Sopa de Cracks', accent: '#6EE7B7', href: '/sopa-cracks' },
  takagrid:    { label: 'TakaGrid',       accent: '#FDBA74', href: '/takagrid' },
}

interface PageProps {
  params: Promise<{ game: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { game } = await params
  const meta = META[game as GameId]
  if (!meta) {
    return {
      title: 'Ranking · TakaSports',
      robots: { index: false, follow: true },
      alternates: { canonical: `${SITE_URL}/juegos/leaderboard/${game}` },
    }
  }
  return {
    title: `Ranking ${meta.label} · TakaSports`,
    description: `Top 100 jugadores de ${meta.label} en TakaSports.`,
    // Self-canonical sobrescribe el de juegos/layout.tsx que apunta a /juegos
    alternates: { canonical: `${SITE_URL}/juegos/leaderboard/${game}` },
  }
}

export default async function LeaderboardPage({ params }: PageProps) {
  const { game } = await params
  const meta = META[game as GameId]
  if (!meta) notFound()

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <Header />
      <LiveStrip />

      <main className="max-w-[1100px] mx-auto px-4 sm:px-6 xl:px-10 pb-24">
        <nav className="pt-8 pb-3">
          <Link
            href="/juegos"
            className="text-[10px] font-black uppercase tracking-widest transition-opacity hover:opacity-70"
            style={{ color: '#5A5A7A', fontFamily: 'var(--font-sport)' }}
          >
            ← Volver a juegos
          </Link>
        </nav>

        <div className="pb-8">
          <div className="flex items-center gap-2.5 mb-2">
            <span className="section-accent" />
            <span className="section-label">Ranking</span>
          </div>
          <h1
            className="font-black leading-none mb-2"
            style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 4vw, 3rem)', color: '#F8F8FF', letterSpacing: '-0.02em' }}
          >
            {meta.label}
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)', maxWidth: 460 }}>
            Top 100 jugadores del periodo actual. Actualizado en directo.
          </p>
        </div>

        <LeaderboardFull gameId={game as GameId} accent={meta.accent} />

        <div className="mt-8 flex items-center justify-center">
          <Link
            href={meta.href}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm transition-transform hover:translate-y-[-1px]"
            style={{
              background:   `linear-gradient(135deg,${meta.accent},${meta.accent}C0)`,
              color:        '#0F0A20',
              fontFamily:   'var(--font-sport)',
              letterSpacing:'0.04em',
              boxShadow:    `0 4px 18px ${meta.accent}40`,
            }}
          >
            Jugar {meta.label}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7h8M7.5 3.5L11 7l-3.5 3.5" stroke="#0F0A20" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
        </div>
      </main>

      <Footer />
      <ScrollToTop />
    </div>
  )
}
