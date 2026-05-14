'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { QuinielaMatch } from '@/components/QuinielaModule'

function TeamLogo({ name, logo, size = 14 }: { name: string; logo?: string; size?: number }) {
  const [err, setErr] = useState(false)
  if (logo && !err) {
    return (
      <img
        src={logo}
        alt={name}
        width={size}
        height={size}
        onError={() => setErr(true)}
        style={{ objectFit: 'contain', flexShrink: 0 }}
      />
    )
  }
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <span
      style={{
        width: size, height: size, borderRadius: 3,
        background: 'rgba(124,58,237,0.15)',
        border: '1px solid rgba(124,58,237,0.22)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 6, fontWeight: 900, color: '#A78BFA', flexShrink: 0,
        letterSpacing: '-0.02em',
      }}
    >
      {initials}
    </span>
  )
}

export default function QuinielaTeaser() {
  const [matches, setMatches] = useState<QuinielaMatch[]>([])
  const [total, setTotal] = useState(0)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/quiniela')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        setLoaded(true)
        if (data?.matches?.length) {
          setMatches(data.matches.slice(0, 3))
          setTotal(data.matches.length)
        }
      })
      .catch(() => setLoaded(true))
  }, [])

  if (loaded && matches.length === 0) return null

  return (
    <Link
      href="/quiniela"
      className="group flex items-center gap-2 px-3 py-2 rounded-xl transition-all hover:-translate-y-0.5"
      style={{
        background: 'rgba(124,58,237,0.05)',
        border: '1px solid rgba(124,58,237,0.16)',
        textDecoration: 'none',
      }}
    >
      {/* Label */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span
          className="text-[9px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-1"
          style={{
            background: 'rgba(124,58,237,0.14)',
            color: '#A78BFA',
            border: '1px solid rgba(124,58,237,0.25)',
            fontFamily: 'var(--font-sport)',
          }}
        >
          <span className="w-1 h-1 rounded-full" style={{ background: '#A78BFA' }} />
          QUINIELA
        </span>
      </div>

      {/* Matches inline */}
      <div className="flex-1 min-w-0 flex items-center gap-2.5 overflow-hidden">
        {matches.map((m, i) => (
          <div key={i} className="flex items-center gap-1 min-w-0">
            <TeamLogo name={m.home} logo={m.homeLogo} />
            <span
              className="text-[10.5px] font-black truncate"
              style={{ color: '#C0C0D8', fontFamily: 'var(--font-display)' }}
            >
              {m.homeShort ?? m.homeAbbr ?? m.home.slice(0, 3).toUpperCase()}
            </span>
            <span className="text-[8px]" style={{ color: '#4A4A6A' }}>vs</span>
            <span
              className="text-[10.5px] font-black truncate"
              style={{ color: '#C0C0D8', fontFamily: 'var(--font-display)' }}
            >
              {m.awayShort ?? m.awayAbbr ?? m.away.slice(0, 3).toUpperCase()}
            </span>
            <TeamLogo name={m.away} logo={m.awayLogo} />
            {i < matches.length - 1 && (
              <span className="ml-1.5 w-px h-3" style={{ background: 'rgba(255,255,255,0.08)' }} />
            )}
          </div>
        ))}
      </div>

      {/* CTA */}
      <span
        className="flex-shrink-0 text-[10px] font-black transition-transform group-hover:translate-x-0.5"
        style={{ color: '#A78BFA', fontFamily: 'var(--font-sport)' }}
      >
        {total > 3 ? `+${total - 3} · Jugar →` : 'Jugar →'}
      </span>
    </Link>
  )
}
