'use client'

// Navegación por fecha del calendario: dropdown de calendario y tira de días.
// Extraído del monolito CalendarioContent.

import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { isoToLocalDate } from '@/lib/calendar'
import { CalendarIcon } from '@/components/icons/GameIcons'

// Custom calendar dropdown
export function CalendarDropdown({ value, eventDays, onChange, onClose, anchorRect, tz }: {
  value: string | null
  eventDays: Set<string>
  onChange: (k: string) => void
  onClose: () => void
  anchorRect: DOMRect | null
  tz?: string
}) {
  const today = isoToLocalDate(new Date().toISOString(), tz)
  const initMonth = value ?? today

  const [month, setMonth] = useState(() => initMonth.slice(0, 7)) // 'YYYY-MM'

  const DAYS_ES  = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']
  const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

  const [y, m] = month.split('-').map(Number)

  const firstDay = new Date(Date.UTC(y, m - 1, 1))
  // Monday-first: getUTCDay() → 0=Sun,1=Mon…; convert to Mon-first
  const startOffset = (firstDay.getUTCDay() + 6) % 7
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()

  const prevMonth = () => {
    const d = new Date(Date.UTC(y, m - 2, 1))
    setMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  const nextMonth = () => {
    const d = new Date(Date.UTC(y, m, 1))
    setMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null)

  if (typeof window === 'undefined') return null

  const PANEL_W = 252
  const margin = 8
  const top = anchorRect ? anchorRect.bottom + 6 : 80
  let left = anchorRect ? anchorRect.left : margin
  if (left + PANEL_W + margin > window.innerWidth) {
    left = Math.max(margin, window.innerWidth - PANEL_W - margin)
  }

  return createPortal(
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[9998]" onClick={onClose} />

      {/* Panel */}
      <div
        className="fixed z-[9999] rounded-xl p-3"
        style={{
          top,
          left,
          width: PANEL_W,
          background: 'linear-gradient(135deg, rgba(18,18,28,0.98) 0%, rgba(12,12,20,0.99) 100%)',
          border: '1px solid rgba(124,58,237,0.25)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)',
          backdropFilter: 'blur(12px)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Month nav */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={prevMonth}
            aria-label="Mes anterior"
            className="flex items-center justify-center w-6 h-6 rounded-md transition-all hover:brightness-125"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#9090A8' }}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M7.5 2L4 6l3.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <span
            className="text-[11px] font-black uppercase tracking-widest"
            style={{ color: '#C4B5FD', fontFamily: 'var(--font-sport)' }}
          >
            {MONTHS_ES[m - 1]} {y}
          </span>
          <button
            onClick={nextMonth}
            aria-label="Mes siguiente"
            className="flex items-center justify-center w-6 h-6 rounded-md transition-all hover:brightness-125"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#9090A8' }}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M4.5 2L8 6l-3.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS_ES.map(d => (
            <div
              key={d}
              className="text-center text-[8px] font-black uppercase tracking-widest py-0.5"
              style={{ color: '#7C7C8C', fontFamily: 'var(--font-sport)' }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {cells.map((day, i) => {
            if (!day) return <div key={`e-${i}`} />
            const iso = `${month}-${String(day).padStart(2, '0')}`
            const isToday    = iso === today
            const isSelected = iso === value
            const hasEvents  = eventDays.has(iso)
            const isPast     = iso < today

            return (
              <button
                key={iso}
                onClick={isPast ? undefined : () => { onChange(iso); onClose() }}
                disabled={isPast}
                title={isPast ? 'Para ver días ya jugados, pulsa «Ver resultados anteriores» en el calendario' : undefined}
                className="relative flex flex-col items-center justify-center rounded-lg transition-all"
                style={{
                  height: 30,
                  background: isSelected
                    ? 'rgba(124,58,237,0.35)'
                    : isToday
                      ? 'rgba(124,58,237,0.12)'
                      : 'transparent',
                  border: isSelected
                    ? '1px solid rgba(124,58,237,0.7)'
                    : isToday
                      ? '1px solid rgba(124,58,237,0.3)'
                      : '1px solid transparent',
                  color: isSelected
                    ? '#E0D0FF'
                    : isPast
                      ? '#3A3A4E'
                      : hasEvents
                        ? '#D0D0F0'
                        : '#7C7C8C',
                  cursor: isPast ? 'not-allowed' : 'pointer',
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-sport)', lineHeight: 1 }}>
                  {day}
                </span>
                {hasEvents && !isSelected && (
                  <div
                    className="absolute"
                    style={{
                      bottom: 4,
                      width: 3,
                      height: 3,
                      borderRadius: '50%',
                      background: isToday ? '#C4B5FD' : '#7C3AED',
                    }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </>,
    document.body
  )
}

// Navegación por días del calendario: un único botón de fecha (móvil y
// escritorio POR IGUAL) que despliega el calendario mensual (CalendarDropdown).
// Por defecto "Todos los días"; al elegir un día muestra el día + ✕ para volver.
// (Decisión del dueño: misma pieza en todas las pantallas, fuera la tira de días.)
export function DayChips({ days, value, onChange, tz }: {
  days: { key: string }[]
  value: string | null
  onChange: (k: string | null) => void
  tz?: string
}) {
  const [showCalendar, setShowCalendar] = useState(false)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const calBtnRef = useRef<HTMLButtonElement | null>(null)

  const today = isoToLocalDate(new Date().toISOString(), tz)
  const tomorrow = (() => {
    const d = new Date(today + 'T12:00:00Z')
    d.setUTCDate(d.getUTCDate() + 1)
    return d.toISOString().split('T')[0]
  })()

  const eventDays = useMemo(() => new Set(days.map(d => d.key)), [days])
  const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const MON = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const dayLabel = (key: string) => {
    const dt = new Date(key + 'T12:00:00Z')
    const d = dt.getUTCDate()
    const mon = MON[dt.getUTCMonth()]
    if (key === today) return `Hoy · ${d} ${mon}`
    if (key === tomorrow) return `Mañana · ${d} ${mon}`
    return `${DOW[dt.getUTCDay()]} ${d} ${mon}`
  }
  const hasDay = value !== null
  const active = showCalendar || hasDay

  const openCalendar = () => {
    if (calBtnRef.current) setAnchorRect(calBtnRef.current.getBoundingClientRect())
    setShowCalendar(v => !v)
  }

  return (
    <div className="cal-rail flex items-center gap-1.5 pb-1" style={{ position: 'relative' }}>
      {/* Botón de fecha: abre el calendario mensual (CalendarDropdown). */}
      <button
        ref={calBtnRef}
        onClick={openCalendar}
        aria-haspopup="dialog"
        aria-expanded={showCalendar}
        aria-label="Elegir día"
        className="cal-press flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all flex-shrink-0"
        style={{
          background: active ? 'rgba(124,58,237,0.22)' : 'rgba(124,58,237,0.12)',
          color: active ? '#D8CCFF' : '#C4B5FD',
          border: active ? '1px solid rgba(124,58,237,0.6)' : '1px solid rgba(124,58,237,0.3)',
          fontFamily: 'var(--font-sport)',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        <CalendarIcon size={12} />
        {hasDay ? dayLabel(value) : 'Todos los días'}
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.7 }}>
          <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* ✕ — solo cuando hay un día elegido: vuelve a "Todos los días". */}
      {hasDay && (
        <button
          onClick={() => { onChange(null); setShowCalendar(false) }}
          aria-label="Ver todos los días"
          className="cal-press flex items-center justify-center rounded-full flex-shrink-0 transition-all"
          style={{
            width: 26,
            height: 26,
            background: 'rgba(255,255,255,0.05)',
            color: '#9090A8',
            border: '1px solid rgba(255,255,255,0.08)',
            cursor: 'pointer',
          }}
        >
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}

      {showCalendar && (
        <CalendarDropdown
          value={value}
          eventDays={eventDays}
          onChange={v => { onChange(v); setShowCalendar(false) }}
          onClose={() => setShowCalendar(false)}
          anchorRect={anchorRect}
          tz={tz}
        />
      )}
    </div>
  )
}
