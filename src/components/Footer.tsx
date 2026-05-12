'use client'

import { LogoFull } from './Logo'

const SPORTS_LINKS = [
  { label: 'Fútbol',     href: '/futbol' },
  { label: 'Baloncesto', href: '/baloncesto' },
  { label: 'F1',         href: '/formula1' },
  { label: 'UFC',        href: '/ufc' },
  { label: 'Tenis',      href: '/tenis' },
  { label: 'WWE',        href: '/wwe' },
  { label: 'Rugby',      href: '/rugby' },
]
const PLATFORM_LINKS = [
  { label: 'Inicio',       href: '/' },
  { label: 'Noticias',     href: '/noticias' },
  { label: 'Archivo de noticias', href: '/archivo' },
  { label: 'Estadísticas', href: '/estadisticas' },
  { label: 'Rankings',     href: '/rankings' },
  { label: 'Calendario',   href: '/calendario' },
  { label: 'Juegos',       href: '/juegos' },
  { label: 'Sobre TakaSports', href: '/sobre' },
]
const LEGAL_LINKS = [
  { label: 'Privacidad', href: '#' },
  { label: 'Términos',   href: '#' },
  { label: 'Cookies',    href: '#' },
]

const SOCIAL = [
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/taka.sports?igsh=cWczZzVvd3FmbGlj&utm_source=qr',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="2" width="20" height="20" rx="5.5" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/share/17RW4CPeNy/?mibextid=wwXIfr',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
        <path d="M18 2H15C13.6739 2 12.4021 2.52678 11.4645 3.46447C10.5268 4.40215 10 5.67392 10 7V10H7V14H10V22H14V14H17L18 10H14V7C14 6.73478 14.1054 6.48043 14.2929 6.29289C14.4804 6.10536 14.7348 6 15 6H18V2Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    label: 'X / Twitter',
    href: 'https://x.com/takasportsx?s=21',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
        <path d="M4 20L20 4M4 4l16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'Threads',
    href: 'https://www.threads.com/@taka.sports?igshid=NTc4MTIwNjQ2YQ==',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
        <path d="M12 3C7.5 3 4 6.5 4 11c0 2.5 1.1 4.7 2.8 6.2M12 3c2.5 0 4.7 1 6.2 2.7M12 3v18M8 8c1 0 2.5.5 3.5 1.5S13 12 13 13c0 2.2-1.8 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M16 10.5c.5 1 .8 2.2.5 3.5-.5 2.5-2.5 4-5 3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'TikTok',
    href: 'https://www.tiktok.com/@taka.sports?_r=1&_t=ZS-95fYOHISZID',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
        <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: 'YouTube',
    href: 'https://youtube.com/@takasports?si=8bGCCTFJqg-sSxV1',
    icon: (
      <svg width="15" height="11" viewBox="0 0 24 17" fill="none">
        <rect x="1" y="1" width="22" height="15" rx="4" stroke="currentColor" strokeWidth="1.8" />
        <path d="M9.5 5.5l6 3-6 3V5.5Z" fill="currentColor" />
      </svg>
    ),
  },
]

function FooterColHeader({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="section-label mb-4">{children}</h4>
  )
}

export default function Footer() {
  return (
    <footer style={{ borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 'clamp(3rem, 8vw, 6rem)' }}>

      {/* Strip superior sutil con glow morado */}
      <div
        className="w-full"
        style={{ height: 1, background: 'linear-gradient(to right, transparent, rgba(124,58,237,0.35) 30%, rgba(124,58,237,0.35) 70%, transparent)' }}
      />

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 pt-14 pb-10">

        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 sm:gap-x-8 gap-y-10 mb-12">

          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="mb-4">
              <LogoFull size={28} />
            </div>
            <p className="text-xs leading-relaxed mb-5" style={{ color: 'var(--text-muted)', maxWidth: 200, lineHeight: '1.7' }}>
              El deporte en tiempo real.<br />Noticias, análisis y quinielas.
            </p>
            {/* Redes sociales */}
            <div className="flex gap-2 flex-wrap">
              {SOCIAL.map(({ label, href, icon }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  title={label}
                  target={href !== '#' ? '_blank' : undefined}
                  rel={href !== '#' ? 'noopener noreferrer' : undefined}
                  onClick={href === '#' ? (e) => e.preventDefault() : undefined}
                  className="social-icon w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    color: '#5A5A6E',
                    border: '1px solid rgba(255,255,255,0.07)',
                    cursor: 'pointer',
                    transition: 'all 180ms cubic-bezier(0.34,1.2,0.64,1)',
                    textDecoration: 'none',
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget
                    el.style.background = 'rgba(124,58,237,0.15)'
                    el.style.color = '#C4B5FD'
                    el.style.border = '1px solid rgba(124,58,237,0.3)'
                    el.style.transform = 'scale(1.12) translateY(-1px)'
                    el.style.boxShadow = '0 6px 18px rgba(124,58,237,0.2)'
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget
                    el.style.background = 'rgba(255,255,255,0.05)'
                    el.style.color = '#5A5A6E'
                    el.style.border = '1px solid rgba(255,255,255,0.07)'
                    el.style.transform = 'scale(1) translateY(0)'
                    el.style.boxShadow = 'none'
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = 'scale(0.95) translateY(0)'
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'scale(1.12) translateY(-1px)'
                  }}
                >
                  {icon}
                </a>
              ))}
            </div>
          </div>

          {/* Deportes */}
          <div>
            <FooterColHeader>Deportes</FooterColHeader>
            <ul className="flex flex-col gap-2.5">
              {SPORTS_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <a href={href} className="text-xs transition-colors hover:text-white" style={{ color: 'var(--text-muted)' }}>
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Plataforma */}
          <div>
            <FooterColHeader>Plataforma</FooterColHeader>
            <ul className="flex flex-col gap-2.5">
              {PLATFORM_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <a href={href} className="text-xs transition-colors hover:text-white" style={{ color: 'var(--text-muted)' }}>
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <FooterColHeader>Legal</FooterColHeader>
            <ul className="flex flex-col gap-2.5">
              {LEGAL_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <a href={href} className="text-xs transition-colors hover:text-white" style={{ color: 'var(--text-muted)' }}>
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

        </div>

        {/* Bottom bar */}
        <div
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-6"
          style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
        >
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            © {new Date().getFullYear()} TakaSports Media. Todos los derechos reservados.
          </p>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)', letterSpacing: '0.04em' }}>
            Hecho para el deporte.
          </p>
        </div>

      </div>
    </footer>
  )
}
