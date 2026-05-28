// Admin minimalista para publicar contenido por juego × periodo.
// Auth via header x-admin-token contra GAMES_ADMIN_TOKEN.
//
// UI: token persistido en localStorage, formulario JSON crudo (suficiente
// para el primer cliente; en fases siguientes se especializa por juego).

import type { Metadata } from 'next'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import GamesAdminClient from './GamesAdminClient'
import { requireAdmin } from '@/lib/admin-auth'

export const metadata: Metadata = {
  title: 'Admin · Contenido de juegos — TakaSports',
  description: 'Publica contenido editorial por juego y periodo.',
  robots: { index: false, follow: false },
}

export default async function GamesAdminPage() {
  await requireAdmin('/admin/games')
  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <Header />
      <main className="max-w-[1100px] mx-auto px-4 sm:px-6 xl:px-10 pb-24 pt-8">
        <div className="mb-6">
          <div className="flex items-center gap-2.5 mb-2">
            <span className="section-accent" />
            <span className="section-label">Admin</span>
          </div>
          <h1
            className="font-black leading-none"
            style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', color: '#F8F8FF', letterSpacing: '-0.02em' }}
          >
            Contenido de juegos
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)', maxWidth: 560 }}>
            Publica el contenido (preguntas, palabras, grids, retos) de cada juego para un periodo concreto.
            El cron de n8n también escribe aquí.
          </p>
        </div>
        <GamesAdminClient />
      </main>
      <Footer />
    </div>
  )
}
