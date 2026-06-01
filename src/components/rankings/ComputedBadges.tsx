'use client'

import { useEffect, useState } from 'react'

interface Badge { code: string; data: Record<string, unknown>; awarded_at: string }

const BADGE_DEF: Record<string, { icon: string; label: (d: Record<string, unknown>) => string; color: string }> = {
  streak_top10: {
    icon: '🔥',
    label: (d) => `${d.weeks} semanas seguidas en top 10`,
    color: '#f59e0b',
  },
  mover_month: {
    icon: '📈',
    label: (d) => `+${d.delta} en 4 semanas${d.rank && Number(d.rank) === 1 ? ' · #1 del mes' : ''}`,
    color: '#22c55e',
  },
  debut_top50: {
    icon: '🎯',
    label: () => 'Debut en top 50',
    color: '#A78BFA',
  },
}

interface Achievement { achievement_code: string; period: string; category: string; data: Record<string, unknown> }

const ACH_DEF: Record<string, { icon: string; label: (a: Achievement) => string; color: string }> = {
  mvp_month: {
    icon: '🏆',
    label: (a) => `MVP de ${a.period}`,
    color: '#fbbf24',
  },
  biggest_climber_month: {
    icon: '🚀',
    label: (a) => `Mayor escalador ${a.period} (+${(a.data as { delta?: number }).delta})`,
    color: '#22c55e',
  },
}

export default function ComputedBadges({ entryId }: { entryId: string }) {
  const [badges, setBadges] = useState<Badge[] | null>(null)
  const [achievements, setAchievements] = useState<Achievement[] | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([
      fetch(`/api/rankings/${encodeURIComponent(entryId)}/badges`, { cache: 'force-cache' }).then(r => r.json()).catch(() => ({ badges: [] })),
      fetch(`/api/rankings/${encodeURIComponent(entryId)}/achievements`, { cache: 'force-cache' }).then(r => r.json()).catch(() => ({ achievements: [] })),
    ]).then(([b, a]: [{ badges: Badge[] }, { achievements: Achievement[] }]) => {
      if (!alive) return
      setBadges(b.badges ?? [])
      setAchievements(a.achievements ?? [])
    })
    return () => { alive = false }
  }, [entryId])

  if (!badges || !achievements || (badges.length === 0 && achievements.length === 0)) return null

  return (
    <div className="flex flex-wrap gap-1.5">
      {achievements.map((a) => {
        const def = ACH_DEF[a.achievement_code]
        if (!def) return null
        return (
          <span key={`${a.achievement_code}-${a.period}-${a.category}`}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold"
            style={{
              background: `${def.color}18`,
              color: def.color,
              border: `1px solid ${def.color}40`,
              fontFamily: 'var(--font-sport)',
            }}
            title={def.label(a)}
          >
            <span>{def.icon}</span>
            <span>{def.label(a)}</span>
          </span>
        )
      })}
      {badges.map((b) => {
        const def = BADGE_DEF[b.code]
        if (!def) return null
        return (
          <span key={b.code}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold"
            style={{
              background: `${def.color}15`,
              color: def.color,
              border: `1px solid ${def.color}30`,
              fontFamily: 'var(--font-sport)',
            }}
            title={def.label(b.data)}
          >
            <span>{def.icon}</span>
            <span>{def.label(b.data)}</span>
          </span>
        )
      })}
    </div>
  )
}
