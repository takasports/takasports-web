import { urlFor } from '@/lib/sanity'

interface Reel {
  _id: string
  instagram_url?: string
  thumbnail?: { asset: { _ref: string } }
  category?: string
  title?: string
  publishedAt?: string
}

function IGIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="5.5" stroke="white" strokeWidth="1.8" opacity="0.8" />
      <circle cx="12" cy="12" r="4.5" stroke="white" strokeWidth="1.8" opacity="0.8" />
      <circle cx="17.5" cy="6.5" r="1" fill="white" opacity="0.8" />
    </svg>
  )
}

function PlayBtn() {
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-105"
      style={{
        background: 'rgba(255,255,255,0.22)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.3)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      }}
    >
      <svg width="10" height="12" viewBox="0 0 10 12" fill="none">
        <path d="M1.5 1.5L8.5 6L1.5 10.5V1.5Z" fill="white" />
      </svg>
    </div>
  )
}

const EMPTY_SLOTS = [
  { label: 'Fútbol',  bg: 'linear-gradient(160deg,#1e1b4b 0%,#09090F 100%)', accent: '#22c55e' },
  { label: 'UFC',     bg: 'linear-gradient(160deg,#2d1515 0%,#09090F 100%)', accent: '#ef4444' },
  { label: 'NBA',     bg: 'linear-gradient(160deg,#172554 0%,#09090F 100%)', accent: '#f59e0b' },
  { label: 'F1',      bg: 'linear-gradient(160deg,#2d1000 0%,#09090F 100%)', accent: '#ef4444' },
  { label: 'Tenis',   bg: 'linear-gradient(160deg,#0c2a18 0%,#09090F 100%)', accent: '#84cc16' },
  { label: 'Rugby',   bg: 'linear-gradient(160deg,#1f1040 0%,#09090F 100%)', accent: '#a78bfa' },
]

function ReelCard({
  href,
  bg,
  category,
  label,
  accent,
  isPlaceholder,
}: {
  href: string
  bg: string
  category?: string
  label: string
  accent?: string
  isPlaceholder?: boolean
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="relative flex-shrink-0 overflow-hidden block group"
      style={{
        width: 158,
        height: 268,
        borderRadius: 16,
        background: bg,
        boxShadow: '0 12px 36px rgba(0,0,0,0.55)',
        textDecoration: 'none',
      }}
    >
      {/* Bottom gradient — más pronunciado */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to top,rgba(0,0,0,0.92) 0%,rgba(0,0,0,0.2) 45%,transparent 70%)' }}
      />
      {/* Top vignette */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to bottom,rgba(0,0,0,0.35) 0%,transparent 35%)' }}
      />

      {/* Hover overlay */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{ background: 'rgba(124,58,237,0.1)' }}
      />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-between p-3.5">
        {/* Top row */}
        <div className="flex items-start justify-between">
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-full"
            style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)' }}
          >
            <IGIcon size={11} />
            <span className="text-[9px] font-black uppercase tracking-widest text-white opacity-80">Reels</span>
          </div>
          <PlayBtn />
        </div>

        {/* Bottom */}
        <div>
          {(category || isPlaceholder) && (
            <span
              className="inline-block text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mb-2"
              style={{
                background: isPlaceholder ? 'rgba(124,58,237,0.25)' : `${accent ?? '#7C3AED'}28`,
                color: isPlaceholder ? '#A78BFA' : (accent ?? '#A78BFA'),
                border: `1px solid ${isPlaceholder ? 'rgba(124,58,237,0.3)' : `${accent ?? '#7C3AED'}45`}`,
              }}
            >
              {isPlaceholder ? 'Pronto' : category}
            </span>
          )}
          <p
            className="text-[14px] font-black leading-tight"
            style={{
              fontFamily: 'var(--font-display)',
              color: '#F8F8FF',
              letterSpacing: '0.01em',
              textShadow: '0 1px 8px rgba(0,0,0,0.6)',
            }}
          >
            {label}
          </p>
        </div>
      </div>
    </a>
  )
}

export default function ReelsSection({ reels }: { reels: Reel[] }) {
  return (
    <section className="pt-5 pb-0" id="reels">

      {/* Header — alineado con el grid */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* Accent con IG gradient */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{
              background: 'linear-gradient(135deg,rgba(131,58,180,0.2),rgba(193,53,132,0.15),rgba(253,29,29,0.1))',
              border: '1px solid rgba(193,53,132,0.25)',
            }}
          >
            <IGIcon size={11} />
            <h2
              className="text-[11px] font-black uppercase tracking-widest"
              style={{ color: '#D4A0C8', fontFamily: 'var(--font-sport)' }}
            >
              Reels
            </h2>
          </div>
          <span className="text-[10px]" style={{ color: '#3A3A4A' }}>·</span>
          <span className="text-[11px]" style={{ color: '#4A4A5A', fontFamily: 'var(--font-sport)' }}>
            Últimos en redes
          </span>
        </div>
        <a
          href="https://www.instagram.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] font-semibold transition-opacity hover:opacity-70"
          style={{ color: '#9B6DB5', fontFamily: 'var(--font-sport)' }}
        >
          Ver en Instagram →
        </a>
      </div>

      {/* Carril — sangra hasta el borde del viewport */}
      <div className="relative -mx-6 xl:-mx-10">
        <div
          className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 pt-1"
          style={{ paddingLeft: 'max(24px, calc((100vw - 1440px) / 2 + 40px))' }}
        >
          {reels.length > 0
            ? reels.map((reel) => {
                const imgUrl = reel.thumbnail?.asset
                  ? urlFor(reel.thumbnail).width(320).height(540).url()
                  : null
                return (
                  <ReelCard
                    key={reel._id}
                    href={reel.instagram_url ?? 'https://www.instagram.com'}
                    bg={imgUrl ? `url(${imgUrl}) center/cover` : 'linear-gradient(160deg,#1e1b4b,#09090F)'}
                    category={reel.category}
                    label={reel.title ?? 'Reel'}
                  />
                )
              })
            : EMPTY_SLOTS.map(({ label, bg, accent }, i) => (
                <ReelCard
                  key={i}
                  href="https://www.instagram.com"
                  bg={bg}
                  label={label}
                  accent={accent}
                  isPlaceholder
                />
              ))
          }
          {/* Padding final para que el último card no quede pegado al edge */}
          <div className="flex-shrink-0 w-6 xl:w-10" />
        </div>

        {/* Fade izquierda */}
        <div
          className="absolute left-0 top-0 bottom-2 w-6 xl:w-10 pointer-events-none z-10"
          style={{ background: 'linear-gradient(to right,var(--bg-base),transparent)' }}
        />
        {/* Fade derecha */}
        <div
          className="absolute right-0 top-0 bottom-2 w-24 pointer-events-none z-10"
          style={{ background: 'linear-gradient(to right,transparent,var(--bg-base))' }}
        />
      </div>
    </section>
  )
}
