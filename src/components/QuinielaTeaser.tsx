'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { QuinielaMatch } from '@/components/QuinielaModule'
import { toSpanishNation } from '@/lib/nation-names'

function TeamLogo({ name, logo }: { name: string; logo?: string }) {
  const [err, setErr] = useState(false)
  if (logo && !err) {
    return (
      <img
        src={logo}
        alt={name}
        width={16}
        height={16}
        onError={() => setErr(true)}
        style={{ objectFit: 'contain', flexShrink: 0 }}
      />
    )
  }
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <span
      style={{
        width: 16, height: 16, borderRadius: 3,
        background: 'rgba(124,58,237,0.15)',
        border: '1px solid rgba(124,58,237,0.22)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 6.5, fontWeight: 900, color: '#A78BFA', flexShrink: 0,
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
  const [jornada, setJornada] = useState('Jornada activa')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/quiniela')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        setLoaded(true)
        if (data?.matches?.length) {
          setMatches(data.matches.slice(0, 3))
          setTotal(data.matches.length)
          if (data.jornada) setJornada(data.jornada)
        }
      })
      .catch(() => setLoaded(true))
  }, [])

  if (loaded && matches.length === 0) return null

  return (
    <Link
      href="/quiniela"
      className="group block rounded-2xl overflow-hidden transition-all hover:-translate-y-0.5"
      style={{
        background: 'rgba(124,58,237,0.04)',
        border: '1px solid rgba(124,58,237,0.14)',
        textDecoration: 'none',
      }}
    >
      <div className="px-4 pt-3 pb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="text-[9px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-1"
            style={{
              background: 'rgba(124,58,237,0.12)',
              color: '#A78BFA',
              border: '1px solid rgba(124,58,237,0.22)',
              fontFamily: 'var(--font-sport)',
            }}
          >
            <span className="w-1 h-1 rounded-full" style={{ background: '#A78BFA' }} />
            QUINIELA
          </span>
          <span className="text-[11px]" style={{ color: '#7a7a92' }}>{jornada}</span>
        </div>
        <span
          className="text-[10px] font-bold transition-transform group-hover:translate-x-0.5"
          style={{ color: '#A78BFA', fontFamily: 'var(--font-sport)' }}
        >
          {total > 3 ? `Ver los ${total} →` : 'Jugar →'}
        </span>
      </div>

      <div className="px-3 pb-3 flex flex-col gap-1.5">
        {matches.map((m, i) => (
          <div
            key={i}
            className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg"
            style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.04)' }}
          >
            <div className="flex-1 flex items-center justify-end gap-1.5 min-w-0">
              <span
                className="text-[10.5px] font-black truncate"
                style={{ color: '#C0C0D8', fontFamily: 'var(--font-display)' }}
              >
                {toSpanishNation(m.homeShort ?? m.home)}
              </span>
              <TeamLogo name={m.home} logo={m.homeLogo} />
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {(['1', 'X', '2'] as const).map(opt => (
                <span
                  key={opt}
                  className="w-5 h-5 flex items-center justify-center rounded text-[9px] font-black"
                  style={{
                    background: 'rgba(124,58,237,0.08)',
                    color: '#6F5C9E',
                    border: '1px solid rgba(124,58,237,0.14)',
                    fontFamily: 'var(--font-sport)',
                  }}
                >
                  {opt}
                </span>
              ))}
            </div>
            <div className="flex-1 flex items-center gap-1.5 min-w-0">
              <TeamLogo name={m.away} logo={m.awayLogo} />
              <span
                className="text-[10.5px] font-black truncate"
                style={{ color: '#C0C0D8', fontFamily: 'var(--font-display)' }}
              >
                {toSpanishNation(m.awayShort ?? m.away)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Link>
  )
}
