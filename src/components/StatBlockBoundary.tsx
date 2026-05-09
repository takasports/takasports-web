'use client'

import React from 'react'

interface Props {
  children: React.ReactNode
  /** Block id used in the fallback message so we can identify which block failed. */
  blockId: string
}

interface State {
  err: Error | null
}

// Class boundary that isolates a single stat block's render error so a bad
// upstream payload (ESPN schema change, NaN rank, etc.) doesn't blank the page.
export class StatBlockBoundary extends React.Component<Props, State> {
  state: State = { err: null }

  static getDerivedStateFromError(err: Error): State {
    return { err }
  }

  componentDidCatch(err: Error) {
    if (typeof window !== 'undefined') {
      console.error(`[stats:${this.props.blockId}]`, err)
    }
  }

  render() {
    if (this.state.err) {
      return (
        <section
          className="rounded-2xl px-5 py-6"
          style={{ background: 'var(--bg-card)', border: '1px solid rgba(248,113,113,0.2)' }}
        >
          <p className="text-[11px] font-black uppercase tracking-widest mb-1" style={{ color: '#f87171', fontFamily: 'var(--font-sport)' }}>
            Bloque temporalmente no disponible
          </p>
          <p className="text-[10px]" style={{ color: '#5A5A72', fontFamily: 'var(--font-sport)' }}>
            Refresca en unos minutos. ID: <span className="tabular-nums">{this.props.blockId}</span>
          </p>
        </section>
      )
    }
    return this.props.children
  }
}
