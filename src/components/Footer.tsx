const SPORTS_LINKS = [
  { label: 'Fútbol',  href: '/?sport=futbol' },
  { label: 'UFC',     href: '/?sport=ufc' },
  { label: 'NBA',     href: '/?sport=nba' },
  { label: 'F1',      href: '/?sport=f1' },
  { label: 'Tenis',   href: '/?sport=tenis' },
  { label: 'Rugby',   href: '/?sport=rugby' },
]
const PLATFORM_LINKS = [
  { label: 'Inicio',     href: '/' },
  { label: 'Noticias',   href: '/noticias' },
  { label: 'Calendario', href: '/calendario' },
  { label: 'Quiniela',   href: '/quiniela' },
  { label: 'Juegos',     href: '/juegos' },
]
const LEGAL_LINKS = [
  { label: 'Privacidad', href: '#' },
  { label: 'Términos',   href: '#' },
  { label: 'Cookies',    href: '#' },
]

function IGIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="5.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
    </svg>
  )
}
function XIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M4 20L20 4M4 4l16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
function TikTokIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function FooterColHeader({ children }: { children: React.ReactNode }) {
  return (
    <h4
      className="section-label mb-4"
    >
      {children}
    </h4>
  )
}

export default function Footer() {
  return (
    <footer style={{ borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '6rem' }}>

      {/* Strip superior sutil */}
      <div
        className="w-full"
        style={{ height: 1, background: 'linear-gradient(to right, transparent, rgba(124,58,237,0.3) 30%, rgba(124,58,237,0.3) 70%, transparent)' }}
      />

      <div className="max-w-[1440px] mx-auto px-6 xl:px-10 pt-14 pb-10">

        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-10 mb-12">

          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <a href="/" className="flex items-center gap-2.5 mb-4 w-fit">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,#7C3AED,#4F46E5)' }}
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 1.5L10 6L2.5 10.5V1.5Z" fill="white" />
                </svg>
              </div>
              <span
                className="text-[18px] font-black"
                style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}
              >
                Taka<span style={{ color: '#8B5CF6' }}>Sports</span>
              </span>
            </a>
            <p className="text-xs leading-relaxed mb-5" style={{ color: 'var(--text-muted)', maxWidth: 200, lineHeight: '1.7' }}>
              El deporte en tiempo real.<br />Noticias, análisis y quinielas.
            </p>
            <div className="flex gap-2">
              {[IGIcon, XIcon, TikTokIcon].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:opacity-70"
                  style={{ background: 'rgba(255,255,255,0.05)', color: '#6B6B7B', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <Icon />
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
                  <a
                    href={href}
                    className="text-xs transition-colors hover:text-white"
                    style={{ color: 'var(--text-muted)' }}
                  >
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
                  <a
                    href={href}
                    className="text-xs transition-colors hover:text-white"
                    style={{ color: 'var(--text-muted)' }}
                  >
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
                  <a
                    href={href}
                    className="text-xs transition-colors hover:text-white"
                    style={{ color: 'var(--text-muted)' }}
                  >
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
          <p
            className="text-[11px]"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)', letterSpacing: '0.04em' }}
          >
            Hecho para el deporte.
          </p>
        </div>

      </div>
    </footer>
  )
}
