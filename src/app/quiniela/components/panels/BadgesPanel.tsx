'use client'

import type { BadgeId } from '../../lib/types'
import { BADGE_DEFS } from '../../lib/types'
import { BadgeIcon, hasBadgeIcon } from '@/components/icons/badges/BadgeIcon'

// ─────────────────────────────────────────────────────────────────
// Panel de logros (badges)
// ─────────────────────────────────────────────────────────────────
export function BadgesPanel({ earned }: { earned: BadgeId[] }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="section-accent" />
        <h2 className="section-label">Logros</h2>
        <span className="ml-auto text-[10px] font-black tabular-nums" style={{ color: '#4A4A6A', fontFamily: 'var(--font-sport)' }}>
          {earned.length}/{BADGE_DEFS.length}
        </span>
      </div>
      <div className="px-4 py-4 grid grid-cols-3 gap-2.5">
        {BADGE_DEFS.map(b => {
          const unlocked = earned.includes(b.id)
          return (
            <div
              key={b.id}
              title={b.desc}
              className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl"
              style={{
                background: unlocked ? 'rgba(124,58,237,0.1)' : 'rgba(255,255,255,0.02)',
                border: unlocked ? '1px solid rgba(124,58,237,0.3)' : '1px solid rgba(255,255,255,0.05)',
                transition: 'all 0.2s ease',
                opacity: unlocked ? 1 : 0.38,
                filter: unlocked ? 'none' : 'grayscale(1)',
              }}
            >
              <span
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 26, height: 26, lineHeight: 1,
                  filter: unlocked ? 'none' : 'grayscale(1)',
                  color: unlocked ? '#C4B5FD' : '#3A3A52',
                }}
              >
                {hasBadgeIcon(b.id)
                  ? <BadgeIcon id={b.id} size={22} strokeWidth={1.7} />
                  : <span style={{ fontSize: 22 }}>{b.emoji}</span>}
              </span>
              <span style={{ fontSize: 7.5, fontWeight: 900, fontFamily: 'var(--font-sport)', color: unlocked ? '#C4B5FD' : '#3A3A52', textAlign: 'center', lineHeight: 1.2 }}>
                {b.name}
              </span>
            </div>
          )
        })}
      </div>
      {earned.length === 0 && (
        <p className="text-[10px] text-center pb-4 -mt-1" style={{ color: '#2E2E48', fontFamily: 'var(--font-sport)' }}>
          Completa jornadas para desbloquear logros
        </p>
      )}
    </div>
  )
}
