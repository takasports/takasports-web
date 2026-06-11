'use client'

import { LogoFull } from './Logo'
import { TrophyIcon } from './icons/GameIcons'

// SEO: usamos siempre el slug canónico (el que [sport]/page.tsx declara como
// alternates.canonical) para evitar generar señales mixtas. Verificado en prod
// el 31/5/2026: /formula1 y /wwe son canónicos; /f1 y /lucha-libre devuelven
// canonical hacia home (bug pendiente fix en [sport]/page.tsx).
const SPORTS_LINKS = [
  { label: 'Fútbol',     href: '/futbol' },
  { label: 'Baloncesto', href: '/baloncesto' },
  { label: 'F1',         href: '/formula1' },
  { label: 'UFC',        href: '/ufc' },
  { label: 'Tenis',      href: '/tenis' },
  { label: 'Lucha libre', href: '/wwe' },
  { label: 'Rugby',      href: '/rugby' },
]
// Apuntan al calendario por competición (con backdrop + clasificación), la
// navegación que el cliente usa de verdad — en vez de a los hubs /liga/*.
const LEAGUE_LINKS: { label: string; href: string; trophy?: boolean }[] = [
  { label: 'LaLiga',          href: '/calendario/laliga' },
  { label: 'Premier League',  href: '/calendario/premier-league' },
  { label: 'Serie A',         href: '/calendario/serie-a' },
  { label: 'Bundesliga',      href: '/calendario/bundesliga' },
  { label: 'Ligue 1',         href: '/calendario/ligue-1' },
  { label: 'Mundial 2026',    href: '/mundial/fixture', trophy: true },
]
const PLATFORM_LINKS = [
  { label: 'Inicio',       href: '/' },
  { label: 'Noticias',     href: '/noticias' },
  { label: 'Estadísticas', href: '/estadisticas' },
  { label: 'Rankings',     href: '/rankings' },
  { label: 'Calendario',   href: '/calendario' },
  { label: 'Glosario',     href: '/glosario' },
  { label: 'Reels',        href: '/reels' },
  { label: 'Juegos',       href: '/juegos' },
  { label: 'Predicciones', href: '/predicciones' },
  { label: 'Archivo',      href: '/archivo' },
]
const LEGAL_LINKS = [
  { label: 'Sobre TakaSports',  href: '/sobre' },
  { label: 'Equipo editorial',  href: '/autor/redaccion' },
  { label: 'Política editorial', href: '/politica-editorial' },
  { label: 'Privacidad',        href: '/privacidad' },
  { label: 'Términos',          href: '/terminos' },
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

        <div className="grid grid-cols-2 md:grid-cols-5 gap-x-4 sm:gap-x-8 gap-y-10 mb-12">

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

          {/* Ligas — distribuye autoridad a hubs de competición */}
          <div>
            <FooterColHeader>Ligas</FooterColHeader>
            <ul className="flex flex-col gap-2.5">
              {LEAGUE_LINKS.map(({ label, href, trophy }) => (
                <li key={label}>
                  <a href={href} className="text-xs transition-colors hover:text-white inline-flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                    {trophy && <TrophyIcon size={14} className="shrink-0" />}
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

      {/* Wordmark de cierre a tamaño cartel — firma de marca "La Señal" (Barlow
          Condensed 900 con degradado morado que se funde al fondo). Decorativo
          (aria-hidden): el nombre ya está en el logo de arriba y el copyright. */}
      <div aria-hidden className="overflow-hidden" style={{ lineHeight: 0, userSelect: 'none' }}>
        <div
          className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10"
          style={{
            fontFamily: 'var(--font-display), sans-serif',
            fontWeight: 900,
            fontSize: 'clamp(3.5rem, 16vw, 13rem)',
            lineHeight: 0.8,
            letterSpacing: '-0.03em',
            whiteSpace: 'nowrap',
            backgroundImage:
              'linear-gradient(180deg, rgba(196,181,253,0.17) 0%, rgba(124,58,237,0.12) 52%, transparent 95%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            paddingBottom: 'clamp(0.5rem, 2.5vw, 2rem)',
          }}
        >
          Taka Sports
        </div>
      </div>
    </footer>
  )
}
