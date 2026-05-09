'use client'

import type { RankingEntry } from '@/lib/rankings'
import { trendIcon } from '@/lib/rankings-ui'
import { getSportStyle } from '@/lib/sports'
import BadgePill from './BadgePill'
import PlayerAvatar from './PlayerAvatar'

export default function FeaturedCard({ entry }: { entry: RankingEntry }) {
  const trend = trendIcon(entry.trend)
  const sportAccent = entry.sport ? getSportStyle(entry.sport).accent : '#7C3AED'
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:brightness-105"
      style={{
        background: `linear-gradient(to right, ${sportAccent}06, var(--bg-card))`,
        border: `1px solid ${sportAccent}20`,
        borderLeft: `2px solid ${sportAccent}60`,
      }}>
      <div className="flex-shrink-0 flex items-center justify-center rounded-xl text-base overflow-hidden"
        style={{ width: 34, height: 34, background: `${sportAccent}10`, border: `1px solid ${sportAccent}20` }}>
        <PlayerAvatar src={entry.image} alt={entry.name} fallback={entry.emoji ?? '⭐'} size={34} rounded="xl" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-[13px] font-bold truncate" style={{ color: '#C0C0D0', fontFamily: 'var(--font-sport)' }}>
            {entry.name}
          </span>
          {entry.badge && <BadgePill text={entry.badge} />}
        </div>
        <p className="text-[10px] truncate" style={{ color: '#4A4A5E', fontFamily: 'var(--font-sport)' }}>{entry.subtitle}</p>
      </div>
      <p className="hidden lg:block text-[11px] flex-shrink-0 max-w-[220px] line-clamp-1"
        style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>
        {entry.insight}
      </p>
      <span className="text-xs font-black flex-shrink-0" style={{ color: trend.color }}>{trend.icon}</span>
    </div>
  )
}
