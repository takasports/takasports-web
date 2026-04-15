'use client'

import { useState } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { ALL_EVENTS } from '@/lib/events'
import { SportEvent } from '@/lib/types'
import { SPORT_CATEGORIES } from '@/lib/sports'
import ScrollToTop from '@/components/ScrollToTop'

// Filtros disponibles — derivados de sports.ts, sin duplicar
const FILTERS = ['Todo', ...SPORT_CATEGORIES.filter((s) => s !== 'Todo' && ALL_EVENTS.some((e) => e.sport === s))]

const DATE_ORDER = ['Hoy', 'Mañana', 'Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Próx']

function groupByDate(events: SportEvent[]): Record<string, SportEvent[]> {
  return events.reduce<Record<string, SportEvent[]>>((acc, ev) => {
    if (!acc[ev.date]) acc[ev.date] = []
    acc[ev.date].push(ev)
    return acc
  }, {})
}

function EventCard({ event }: { event: SportEvent }) {
  return (
    <div
      className="rounded-2xl overflow-hidden transition-all hover:scale-[1.005]"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderLeft: `4px solid ${event.accent}`,
      }}
    >
      <div className="px-5 py-4 flex items-center gap-4">

        {/* Sport badge */}
        <div
          className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${event.accent}18`, border: `1px solid ${event.accent}30` }}
        >
          <span
            className="text-[9px] font-black uppercase text-center leading-none"
            style={{ color: event.accent, fontFamily: 'var(--font-sport)' }}
          >
            {event.sport.slice(0, 3)}
          </span>
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className="text-[10px] font-black uppercase tracking-widest"
              style={{ color: event.accent, fontFamily: 'var(--font-sport)' }}
            >
              {event.sport}
            </span>
            <span className="text-[9px]" style={{ color: '#3A3A4A' }}>·</span>
            <span
              className="text-[9px] px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(255,255,255,0.04)', color: '#5A5A6A', fontFamily: 'var(--font-sport)' }}
            >
              {event.comp}
            </span>
          </div>
          <p
            className="font-black leading-tight"
            style={{ color: '#F0F0F5', fontFamily: 'var(--font-sport)', fontSize: 15 }}
          >
            {event.home}
            {event.away && (
              <span style={{ color: '#7A7A8E' }}> vs {event.away}</span>
            )}
          </p>
        </div>

        {/* Time */}
        <div className="flex-shrink-0 text-right">
          <p
            className="font-black"
            style={{ color: '#D8D8EC', fontFamily: 'var(--font-display)', fontSize: 20, letterSpacing: '0.02em' }}
          >
            {event.time}
          </p>
          <p className="text-[10px]" style={{ color: '#4A4A5A' }}>
            {event.date}
          </p>
        </div>

      </div>
    </div>
  )
}

export default function CalendarioPage() {
  const [active, setActive] = useState('Todo')

  const filtered = active === 'Todo'
    ? ALL_EVENTS
    : ALL_EVENTS.filter((e) => e.sport === active)

  const grouped = groupByDate(filtered)
  const orderedDates = DATE_ORDER.filter((d) => grouped[d])

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <Header />

      <main className="max-w-[1440px] mx-auto px-6 xl:px-10 pb-20">

        {/* Page header */}
        <div className="pt-8 pb-6">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="section-accent" />
            <h1
              className="font-black"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(1.6rem, 3vw, 2.4rem)',
                color: '#F8F8FF',
                letterSpacing: '-0.01em',
              }}
            >
              Calendario
            </h1>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-muted)', marginLeft: 20 }}>
            Próximos eventos y partidos de todas las competiciones.
          </p>
        </div>

        {/* Filtros — ahora funcionales */}
        <div className="flex items-center gap-2 flex-wrap mb-8">
          {FILTERS.map((f) => {
            const isActive = f === active
            return (
              <button
                key={f}
                onClick={() => setActive(f)}
                className="text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-all hover:opacity-90"
                style={{
                  background: isActive ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.05)',
                  color: isActive ? '#C4B5FD' : '#5A5A6A',
                  border: isActive ? '1px solid rgba(124,58,237,0.28)' : '1px solid rgba(255,255,255,0.07)',
                  fontFamily: 'var(--font-sport)',
                  cursor: 'pointer',
                  boxShadow: isActive ? '0 0 12px rgba(124,58,237,0.15)' : 'none',
                  transform: isActive ? 'scale(1.02)' : 'scale(1)',
                }}
              >
                {f}
              </button>
            )
          })}
        </div>

        {/* Resultado del filtro */}
        {filtered.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No hay eventos programados para <span style={{ color: '#C4B5FD' }}>{active}</span> en este momento.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-10">
            {orderedDates.map((date) => (
              <div key={date}>
                {/* Date header */}
                <div className="flex items-center gap-3 mb-4">
                  <span
                    className="text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full"
                    style={{
                      background: date === 'Hoy' ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.05)',
                      color: date === 'Hoy' ? '#C4B5FD' : '#9090A4',
                      border: date === 'Hoy' ? '1px solid rgba(124,58,237,0.28)' : '1px solid rgba(255,255,255,0.07)',
                      fontFamily: 'var(--font-sport)',
                    }}
                  >
                    {date}
                  </span>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
                  <span className="text-[10px]" style={{ color: '#3A3A4A', fontFamily: 'var(--font-sport)' }}>
                    {grouped[date].length} evento{grouped[date].length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="flex flex-col gap-2.5">
                  {grouped[date].map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Próximamente */}
        <div
          className="mt-12 rounded-2xl flex flex-col items-center justify-center py-10 gap-3"
          style={{
            background: 'rgba(124,58,237,0.04)',
            border: '1px dashed rgba(124,58,237,0.15)',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#7C3AED" strokeWidth="1.5" opacity="0.4" />
            <path d="M12 7v5.5l3 3" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
          </svg>
          <p className="text-sm font-semibold" style={{ color: '#5A5A6A', fontFamily: 'var(--font-sport)' }}>
            Integración con datos en tiempo real — próximamente
          </p>
          <p className="text-xs text-center" style={{ color: '#3A3A4A', maxWidth: 340 }}>
            Estamos conectando calendarios oficiales de LaLiga, NBA, F1, ATP y UFC.
            Los eventos se actualizarán automáticamente.
          </p>
          <Link
            href="/"
            className="mt-1 text-xs font-semibold transition-opacity hover:opacity-70"
            style={{ color: '#7C3AED', fontFamily: 'var(--font-sport)' }}
          >
            ← Volver al inicio
          </Link>
        </div>

      </main>

      <Footer />
      <ScrollToTop />
    </div>
  )
}
