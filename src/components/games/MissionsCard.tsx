'use client'

// Tarjeta con las misiones activas (diarias + semanal). Se autorefresca al
// completarse cualquier misión vía el evento ts:missions-changed.

import { useEffect, useState } from 'react'
import { getActiveMissions, onMissionsChange, type MissionInstance, type MissionTemplate } from '@/lib/missions'

interface Item { mission: MissionInstance; template: MissionTemplate }

export default function MissionsCard() {
  const [items, setItems] = useState<Item[] | null>(null)

  useEffect(() => {
    setItems(getActiveMissions())
    return onMissionsChange(() => setItems(getActiveMissions()))
  }, [])

  if (!items) {
    return (
      <div className="rounded-2xl h-[180px]" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }} aria-hidden />
    )
  }

  const daily  = items.filter(x => x.template.period === 'daily')
  const weekly = items.filter(x => x.template.period === 'weekly')
  const doneCount = items.filter(x => x.mission.done).length

  return (
    <div
      className="rounded-2xl p-4 sm:p-5"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="flex items-center gap-2">
          <span className="section-accent" />
          <h3 className="section-label">Misiones de hoy</h3>
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
          {doneCount}/{items.length} completadas
        </span>
      </div>

      <div className="flex flex-col gap-1">
        {daily.map(it => <MissionRow key={it.mission.templateId} item={it} />)}
      </div>

      {weekly.length > 0 && (
        <>
          <div className="my-3 flex items-center gap-2">
            <span className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
            <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
              Semanal
            </span>
            <span className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
          </div>
          <div className="flex flex-col gap-1">
            {weekly.map(it => <MissionRow key={it.mission.templateId} item={it} />)}
          </div>
        </>
      )}
    </div>
  )
}

function MissionRow({ item }: { item: Item }) {
  const { mission, template } = item
  const pct = Math.min(100, Math.round((mission.progress / mission.target) * 100))
  const progressLabel = mission.target === 1
    ? (mission.done ? 'Hecho' : 'Pendiente')
    : `${mission.progress}/${mission.target}`
  const barColor = mission.done ? '#4ade80' : '#93C5FD'

  return (
    <div className="flex items-start gap-3 py-2">
      <span className="text-xl leading-none flex-shrink-0 select-none" aria-hidden style={{ filter: mission.done ? 'none' : 'grayscale(0.2)' }}>
        {template.emoji}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-black truncate inline-flex items-center gap-1.5" style={{ color: mission.done ? '#86EFAC' : '#F0F0F5', fontFamily: 'var(--font-display)' }}>
            <span className="truncate">{template.title}</span>
            {mission.done && <span aria-hidden className="text-[10px]">✓</span>}
          </p>
          <span className="text-[10px] tabular-nums font-black flex-shrink-0" style={{ color: mission.done ? '#86EFAC' : 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
            {progressLabel}
          </span>
        </div>
        <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{template.description}</p>
        <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, background: barColor }} />
        </div>
      </div>
      <span
        className="text-[10px] font-black whitespace-nowrap flex-shrink-0 px-1.5 py-0.5 rounded"
        style={{
          background: mission.done ? 'rgba(74,222,128,0.12)' : 'rgba(252,211,77,0.10)',
          color: mission.done ? '#86EFAC' : '#FCD34D',
          border: `1px solid ${mission.done ? 'rgba(74,222,128,0.25)' : 'rgba(252,211,77,0.25)'}`,
          fontFamily: 'var(--font-sport)',
        }}
      >
        +{template.rewardXp} XP
      </span>
    </div>
  )
}
