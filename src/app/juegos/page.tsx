import type { Metadata } from 'next'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Juegos — TakaSports',
  description: 'Juegos deportivos interactivos en TakaSports. Próximamente.',
}

const COMING_SOON_GAMES = [
  {
    id: 'trivia',
    title: 'Trivia Deportiva',
    description: 'Pon a prueba tu conocimiento deportivo con preguntas de fútbol, NBA, F1 y más.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <circle cx="14" cy="14" r="12" stroke="#A78BFA" strokeWidth="1.5" opacity="0.6" />
        <path d="M10.5 11c0-1.93 1.57-3.5 3.5-3.5s3.5 1.57 3.5 3.5c0 1.5-.9 2.8-2.2 3.35-.55.23-.8.65-.8 1.15v1" stroke="#A78BFA" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="14" cy="20" r="1" fill="#A78BFA" />
      </svg>
    ),
    badge: 'Próximamente',
    accent: '#7C3AED',
  },
  {
    id: 'predictor',
    title: 'Predictor de Partidos',
    description: 'Predice el marcador exacto de los partidos antes de que empiecen. Gana puntos.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <rect x="4" y="6" width="20" height="16" rx="3" stroke="#34d399" strokeWidth="1.5" opacity="0.6" />
        <path d="M10 14l3 3 5-5" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    badge: 'En desarrollo',
    accent: '#22c55e',
  },
  {
    id: 'draft',
    title: 'Fantasy Draft',
    description: 'Arma tu equipo ideal con jugadores reales y compite contra otros usuarios.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <circle cx="10" cy="10" r="4" stroke="#f59e0b" strokeWidth="1.5" opacity="0.6" />
        <circle cx="18" cy="10" r="4" stroke="#f59e0b" strokeWidth="1.5" opacity="0.6" />
        <path d="M5 22c0-3.3 2.24-6 5-6h8c2.76 0 5 2.7 5 6" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      </svg>
    ),
    badge: 'Q3 2025',
    accent: '#f59e0b',
  },
  {
    id: 'bracket',
    title: 'Bracket Challenge',
    description: 'Rellena tu bracket para los playoffs y torneos. Compite por el top del ranking.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <path d="M6 6h4v4H6zM18 6h4v4h-4zM6 18h4v4H6zM18 18h4v4h-4z" stroke="#ef4444" strokeWidth="1.3" opacity="0.6" />
        <path d="M10 8h4M14 8v12M10 20h4M18 8h-4M18 20h-4" stroke="#ef4444" strokeWidth="1.3" strokeLinecap="round" opacity="0.6" />
      </svg>
    ),
    badge: 'Próximamente',
    accent: '#ef4444',
  },
]

export default function JuegosPage() {
  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <Header />

      <main className="max-w-[1440px] mx-auto px-6 xl:px-10 pb-20">

        {/* Page header */}
        <div className="pt-8 pb-4">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="section-accent" />
            <h1
              className="font-black"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(1.6rem, 3vw, 2.4rem)',
                color: '#F8F8FF',
                letterSpacing: '-0.01em',
              }}
            >
              Juegos
            </h1>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-muted)', marginLeft: 20 }}>
            Competiciones interactivas para los fanáticos del deporte.
          </p>
        </div>

        {/* Hero banner */}
        <div
          className="relative rounded-2xl overflow-hidden mb-10 mt-4"
          style={{
            background: 'linear-gradient(135deg,#1E1040 0%,#0F0825 50%,#09090F 100%)',
            border: '1px solid rgba(124,58,237,0.2)',
            minHeight: 200,
          }}
        >
          {/* Glow */}
          <div
            className="absolute top-0 left-0 w-80 h-80 blur-3xl opacity-15 pointer-events-none"
            style={{ background: 'radial-gradient(circle,#7C3AED,transparent 70%)' }}
          />
          <div className="relative z-10 px-8 py-10 flex flex-col items-start gap-4">
            <span
              className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full"
              style={{
                background: 'rgba(124,58,237,0.18)',
                color: '#C4B5FD',
                border: '1px solid rgba(124,58,237,0.28)',
                fontFamily: 'var(--font-sport)',
              }}
            >
              Plataforma de juegos
            </span>
            <h2
              className="font-black leading-tight max-w-lg"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(1.5rem, 3vw, 2.2rem)',
                color: '#F8F8FF',
                letterSpacing: '-0.01em',
              }}
            >
              El deporte es más divertido<br />cuando compites.
            </h2>
            <p className="text-sm max-w-md" style={{ color: '#7070A0' }}>
              Trivia, predicciones, fantasy y brackets. Estamos construyendo la plataforma de juegos
              deportivos más completa en español.
            </p>
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold"
              style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}
            >
              <span style={{ width: 6, height: 6, background: '#4ade80', borderRadius: '50%', display: 'inline-block' }} />
              En desarrollo activo
            </div>
          </div>
        </div>

        {/* Games grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {COMING_SOON_GAMES.map((game) => (
            <div
              key={game.id}
              className="rounded-2xl p-5 flex flex-col gap-4 relative overflow-hidden"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
              }}
            >
              {/* Top glow */}
              <div
                className="absolute top-0 right-0 w-32 h-32 blur-3xl opacity-10 pointer-events-none"
                style={{ background: game.accent }}
              />

              {/* Icon */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center relative z-10"
                style={{ background: `${game.accent}12`, border: `1px solid ${game.accent}25` }}
              >
                {game.icon}
              </div>

              {/* Badge */}
              <span
                className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full w-fit"
                style={{
                  background: `${game.accent}12`,
                  color: game.accent,
                  border: `1px solid ${game.accent}25`,
                  fontFamily: 'var(--font-sport)',
                }}
              >
                {game.badge}
              </span>

              {/* Info */}
              <div className="flex flex-col gap-1.5 relative z-10 flex-1">
                <h3
                  className="font-black leading-snug"
                  style={{ fontFamily: 'var(--font-display)', color: '#F0F0F5', fontSize: 16, letterSpacing: '-0.01em' }}
                >
                  {game.title}
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {game.description}
                </p>
              </div>

              {/* Notify CTA */}
              <button
                className="w-full py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-opacity hover:opacity-80 mt-auto"
                style={{
                  background: `${game.accent}12`,
                  color: game.accent,
                  border: `1px solid ${game.accent}20`,
                  fontFamily: 'var(--font-sport)',
                  letterSpacing: '0.06em',
                }}
              >
                Avisarme →
              </button>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div
          className="mt-12 rounded-2xl py-10 px-8 flex flex-col items-center gap-4 text-center"
          style={{ background: 'rgba(124,58,237,0.05)', border: '1px dashed rgba(124,58,237,0.15)' }}
        >
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="14" stroke="#7C3AED" strokeWidth="1.5" opacity="0.3" />
            <path d="M16 9v7.5l4.5 4.5" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
          </svg>
          <h3
            className="font-black"
            style={{ fontFamily: 'var(--font-display)', color: '#F0F0F5', fontSize: 18, letterSpacing: '-0.01em' }}
          >
            Lanzamiento próximamente
          </h3>
          <p className="text-sm max-w-sm" style={{ color: 'var(--text-muted)' }}>
            La plataforma de juegos estará disponible en los próximos meses.
            Activa las notificaciones para ser el primero en jugar.
          </p>
        </div>

      </main>

      <Footer />
    </div>
  )
}
