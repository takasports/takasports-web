'use client'

import { useState } from 'react'

interface Props {
  title: string
  isoDate: string                // start, ISO-8601 UTC
  durationMinutes?: number       // default 120
  location?: string
  description?: string
  uid?: string                   // ej. ref del partido
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

// "2026-05-14T20:00:00.000Z" → "20260514T200000Z"
function toIcsDate(iso: string): string | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

// Escape per RFC5545: backslash, semicolon, comma, newline
function icsEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

export function AddToCalendarButton({
  title, isoDate, durationMinutes = 120, location, description, uid,
}: Props) {
  const [done, setDone] = useState(false)

  function handleClick() {
    const start = toIcsDate(isoDate)
    if (!start) return
    const endDate = new Date(new Date(isoDate).getTime() + durationMinutes * 60_000)
    const end = toIcsDate(endDate.toISOString())
    if (!end) return

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//TakaSports//ES',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid ?? `${Date.now()}@takasportsmedia.com`}`,
      `DTSTAMP:${toIcsDate(new Date().toISOString())}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${icsEscape(title)}`,
      location ? `LOCATION:${icsEscape(location)}` : null,
      description ? `DESCRIPTION:${icsEscape(description)}` : null,
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean).join('\r\n')

    const blob = new Blob([lines], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.replace(/[^\w\d\-_]+/g, '_').slice(0, 60)}.ics`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    setDone(true)
    setTimeout(() => setDone(false), 2000)
  }

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wide transition-all hover:opacity-80 active:scale-95"
      style={{
        background: 'rgba(255,255,255,0.06)',
        color: done ? '#4ade80' : '#5A5A6A',
        border: '1px solid rgba(255,255,255,0.08)',
        fontFamily: 'var(--font-sport)',
      }}
      title="Descargar evento como .ics"
    >
      {done ? (
        <>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Añadido
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="1.5" y="2.5" width="9" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" />
            <path d="M1.5 5h9" stroke="currentColor" strokeWidth="1.2" />
            <path d="M4 1.5v2M8 1.5v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M6 6.5v3M4.5 8h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          Calendario
        </>
      )}
    </button>
  )
}
