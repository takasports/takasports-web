'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import MundialBracket from '@/components/mundial/MundialBracket'

// El predictor (con su scoring/estado propio) se carga solo cuando el usuario
// abre la pestaña "Predicciones" — montaje perezoso, sin tocar su lógica.
const MundialClient = dynamic(() => import('./MundialClient'), { ssr: false })

const GOLD = '#f59e0b'
const TABS = [
  { id: 'cuadro', label: '🗺️ Cuadro' },
  { id: 'predicciones', label: '🎯 Predicciones' },
] as const
type TabId = (typeof TABS)[number]['id']

export default function MundialWrapper() {
  // "Cuadro" es la vista de entrada de /mundial (decisión de producto, jun 2026).
  const [tab, setTab] = useState<TabId>('cuadro')

  return (
    <div>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '12px 16px 0' }}>
        <div
          role="tablist"
          aria-label="Vistas del Mundial 2026"
          style={{
            display: 'flex',
            gap: 6,
            padding: 4,
            borderRadius: 12,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border)',
          }}
        >
          {TABS.map(t => {
            const on = tab === t.id
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={on}
                onClick={() => setTab(t.id)}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: 9,
                  border: 'none',
                  cursor: 'pointer',
                  background: on ? `${GOLD}1e` : 'transparent',
                  color: on ? GOLD : 'var(--text-muted)',
                  fontFamily: 'var(--font-sport)',
                  fontWeight: 800,
                  fontSize: 12,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {tab === 'cuadro' ? (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: 16 }}>
          <MundialBracket />
        </div>
      ) : (
        <MundialClient />
      )}
    </div>
  )
}
