'use client'

// Conmutador de pestañas Web / App en /admin/trafico. Ambos contenidos se
// renderizan en el server y se pasan como props; aquí solo se togglea cuál se ve.

import { useState, type ReactNode } from 'react'

export default function TrafficTabs({ web, app }: { web: ReactNode; app: ReactNode }) {
  const [tab, setTab] = useState<'web' | 'app'>('web')

  function Tab({ id, icon, children }: { id: 'web' | 'app'; icon: string; children: ReactNode }) {
    const active = tab === id
    return (
      <button
        onClick={() => setTab(id)}
        role="tab"
        aria-selected={active}
        className={active ? undefined : 'tk-glass'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 22px',
          borderRadius: 'var(--radius-full)',
          fontFamily: 'var(--font-sport)',
          fontSize: 14,
          fontWeight: 800,
          cursor: 'pointer',
          color: active ? '#0b0b12' : 'var(--text-secondary)',
          background: active ? 'linear-gradient(135deg,#A78BFA,#7C3AED)' : undefined,
          border: active ? 'none' : undefined,
        }}
      >
        {icon} {children}
      </button>
    )
  }

  return (
    <>
      <div className="flex gap-2 mb-6" role="tablist" aria-label="Plataforma">
        <Tab id="web" icon="🌐">Web</Tab>
        <Tab id="app" icon="📱">App</Tab>
      </div>
      <div style={{ display: tab === 'web' ? 'block' : 'none' }}>{web}</div>
      <div style={{ display: tab === 'app' ? 'block' : 'none' }}>{app}</div>
    </>
  )
}
