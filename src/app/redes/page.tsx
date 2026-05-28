import type { Metadata } from 'next'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { SITE_URL } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Síguenos en redes sociales | TakaSports',
  description: 'Sigue a TakaSports en Instagram, TikTok, YouTube, X, Facebook y Threads. Noticias deportivas, reels y contenido exclusivo en todas las plataformas.',
  alternates: { canonical: `${SITE_URL}/redes` },
  openGraph: {
    title: 'Síguenos en redes sociales | TakaSports',
    description: 'Noticias deportivas, reels y contenido exclusivo en todas las plataformas.',
    url: `${SITE_URL}/redes`,
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
  },
}

const NETWORKS = [
  {
    id: 'instagram',
    label: 'Instagram',
    handle: '@taka.sports',
    description: 'Reels, stories y momentos deportivos en tiempo real.',
    href: 'https://www.instagram.com/taka.sports?igsh=cWczZzVvd3FmbGlj&utm_source=qr',
    color: '#E1306C',
    gradient: 'linear-gradient(135deg, #405DE6, #5851DB, #833AB4, #C13584, #E1306C, #FD1D1D)',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="2" width="20" height="20" rx="5.5" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    handle: '@taka.sports',
    description: 'Clips cortos, highlights y análisis en formato vídeo.',
    href: 'https://www.tiktok.com/@taka.sports?_r=1&_t=ZS-95fYOHISZID',
    color: '#69C9D0',
    gradient: 'linear-gradient(135deg, #010101, #69C9D0 50%, #EE1D52)',
    icon: (
      <svg width="28" height="32" viewBox="0 0 24 28" fill="none">
        <path d="M10 14a5 5 0 1 0 5 5V4a6 6 0 0 0 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'youtube',
    label: 'YouTube',
    handle: '@takasports',
    description: 'Vídeos largos, debates y análisis tácticos en profundidad.',
    href: 'https://youtube.com/@takasports?si=8bGCCTFJqg-sSxV1',
    color: '#FF0000',
    gradient: 'linear-gradient(135deg, #282828, #FF0000)',
    icon: (
      <svg width="36" height="26" viewBox="0 0 36 26" fill="none">
        <rect x="1" y="1" width="34" height="24" rx="6" stroke="currentColor" strokeWidth="1.8" />
        <path d="M14 8l11 5.5-11 5.5V8Z" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: 'x',
    label: 'X / Twitter',
    handle: '@takasportsx',
    description: 'Opinión, resultados al instante y debate con la comunidad.',
    href: 'https://x.com/takasportsx?s=21',
    color: '#FFFFFF',
    gradient: 'linear-gradient(135deg, #1a1a1a, #333)',
    icon: (
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
        <path d="M4 20L20 4M4 4l16 16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'threads',
    label: 'Threads',
    handle: '@taka.sports',
    description: 'Conversaciones y actualizaciones del mundo del deporte.',
    href: 'https://www.threads.com/@taka.sports?igshid=NTc4MTIwNjQ2YQ==',
    color: '#FFFFFF',
    gradient: 'linear-gradient(135deg, #101010, #444)',
    icon: (
      <svg width="28" height="32" viewBox="0 0 24 28" fill="none">
        <path d="M12 3C7.5 3 4 6.5 4 11c0 2.5 1.1 4.7 2.8 6.2M12 3c2.5 0 4.7 1 6.2 2.7M12 3v18M8 8c1 0 2.5.5 3.5 1.5S13 12 13 13c0 2.2-1.8 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M16 10.5c.5 1 .8 2.2.5 3.5-.5 2.5-2.5 4-5 3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'facebook',
    label: 'Facebook',
    handle: 'TakaSports',
    description: 'Noticias, grupos de aficionados y transmisiones en directo.',
    href: 'https://www.facebook.com/share/17RW4CPeNy/?mibextid=wwXIfr',
    color: '#1877F2',
    gradient: 'linear-gradient(135deg, #0a3880, #1877F2)',
    icon: (
      <svg width="28" height="32" viewBox="0 0 24 28" fill="none">
        <path d="M18 2H15C13.674 2 12.402 2.527 11.464 3.464C10.527 4.402 10 5.674 10 7V10H7V14H10V22H14V14H17L18 10H14V7C14 6.735 14.105 6.48 14.293 6.293C14.48 6.105 14.735 6 15 6H18V2Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
]

export default function RedesPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <Header />

      <main className="max-w-[900px] mx-auto px-4 sm:px-6 py-16 sm:py-24">

        {/* Hero */}
        <div className="text-center mb-16">
          <p className="section-label mb-4">Comunidad TakaSports</p>
          <h1
            className="font-black mb-4"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2rem, 6vw, 3.5rem)',
              letterSpacing: '-0.03em',
              background: 'linear-gradient(135deg, #F0F0F8 30%, #A78BFA)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Síguenos en redes
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', maxWidth: 480, margin: '0 auto' }}>
            Noticias deportivas, reels y debate en tiempo real. Elige tu plataforma.
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {NETWORKS.map((net) => (
            <a
              key={net.id}
              href={net.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative flex items-center gap-5 rounded-2xl p-6 transition-all duration-200"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget
                el.style.background = 'rgba(255,255,255,0.06)'
                el.style.border = '1px solid rgba(255,255,255,0.13)'
                el.style.transform = 'translateY(-2px)'
                el.style.boxShadow = '0 12px 32px rgba(0,0,0,0.3)'
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget
                el.style.background = 'rgba(255,255,255,0.03)'
                el.style.border = '1px solid rgba(255,255,255,0.07)'
                el.style.transform = 'translateY(0)'
                el.style.boxShadow = 'none'
              }}
            >
              {/* Icon bubble */}
              <div
                className="shrink-0 w-16 h-16 rounded-xl flex items-center justify-center"
                style={{
                  background: net.gradient,
                  color: '#fff',
                  boxShadow: `0 4px 20px ${net.color}33`,
                }}
              >
                {net.icon}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className="font-bold"
                    style={{ color: '#F0F0F8', fontSize: '1rem', fontFamily: 'var(--font-display)' }}
                  >
                    {net.label}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.07)', color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}
                  >
                    {net.handle}
                  </span>
                </div>
                <p className="text-sm leading-snug" style={{ color: 'var(--text-muted)' }}>
                  {net.description}
                </p>
              </div>

              {/* Arrow */}
              <svg
                width="18" height="18" viewBox="0 0 24 24" fill="none"
                className="shrink-0 transition-transform duration-200 group-hover:translate-x-1"
                style={{ color: 'rgba(255,255,255,0.2)' }}
              >
                <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          ))}
        </div>

        {/* RSS CTA */}
        <div
          className="mt-10 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4"
          style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}
        >
          <div className="flex-1">
            <p className="font-semibold mb-1" style={{ color: '#C4B5FD', fontSize: '0.95rem' }}>
              También disponible en RSS
            </p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Suscríbete al feed para recibir todas las noticias en tu lector favorito o automatizar publicaciones con Zapier / Buffer.
            </p>
          </div>
          <a
            href="/rss.xml"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: 'rgba(124,58,237,0.2)',
              border: '1px solid rgba(124,58,237,0.35)',
              color: '#C4B5FD',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            Ver feed RSS →
          </a>
        </div>

      </main>

      <Footer />
    </div>
  )
}
