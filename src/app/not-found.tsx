import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { LogoMark } from '@/components/Logo'

export default function NotFound() {
  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 flex-1">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-6">

          {/* Number */}
          <div className="relative">
            <span
              className="font-black select-none"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(8rem, 20vw, 14rem)',
                color: 'rgba(124,58,237,0.08)',
                lineHeight: 1,
                letterSpacing: '-0.04em',
              }}
            >
              404
            </span>
            <div className="absolute inset-0 flex items-center justify-center">
              <LogoMark size={56} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h1
              className="font-black"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(1.4rem, 3vw, 2rem)',
                color: '#F0F0F5',
                letterSpacing: '-0.01em',
              }}
            >
              Página no encontrada
            </h1>
            <p className="text-sm max-w-sm" style={{ color: 'var(--text-muted)' }}>
              El contenido que buscás no existe o fue movido.
              Volvé al inicio o buscá otra noticia.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-center">
            <Link
              href="/"
              className="px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest transition-opacity hover:opacity-80"
              style={{
                background: 'linear-gradient(135deg,#7C3AED,#6025C0)',
                color: '#fff',
                fontFamily: 'var(--font-sport)',
                letterSpacing: '0.06em',
                boxShadow: '0 4px 18px rgba(124,58,237,0.3)',
                textDecoration: 'none',
              }}
            >
              Ir al inicio
            </Link>
            <Link
              href="/noticias"
              className="px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest transition-opacity hover:opacity-80"
              style={{
                background: 'rgba(255,255,255,0.05)',
                color: 'var(--text-muted)',
                border: '1px solid rgba(255,255,255,0.08)',
                fontFamily: 'var(--font-sport)',
                letterSpacing: '0.06em',
                textDecoration: 'none',
              }}
            >
              Ver noticias
            </Link>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  )
}
