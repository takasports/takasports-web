'use client'

import { useState } from 'react'
import type { RosterPlayer } from '@/app/api/team/[slug]/route'

/**
 * Crédito LEGALMENTE obligatorio de las fotos CC (Wikimedia) de la plantilla.
 * Vive como ÚLTIMA línea de la página (debajo de noticias relacionadas), colapsado
 * en una sola línea discreta, para no ensuciar el espacio de información: CC exige
 * atribución "razonable según el medio", y el pie de la misma página cumple (es el
 * patrón de la propia Wikipedia). Agrupa por autor+licencia — varios jugadores
 * comparten fotógrafo y no repetimos línea por cara. Solo se pinta si alguna foto
 * lo exige.
 */
export function RosterCredits({ roster }: { roster: RosterPlayer[] }) {
  const [open, setOpen] = useState(false)

  const byAttribution = new Map<string, string[]>()
  for (const p of roster) {
    if (!p.photo || !p.photoAttribution) continue
    const names = byAttribution.get(p.photoAttribution) ?? []
    names.push(p.name)
    byAttribution.set(p.photoAttribution, names)
  }
  if (byAttribution.size === 0) return null

  return (
    <div>
      <div className="flex justify-center">
        <button
          aria-expanded={open}
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-1.5 text-[11px] cursor-pointer select-none transition-colors"
          style={{ color: 'var(--text-muted)', background: 'none', border: 'none', padding: '4px 6px' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8h.01M11 12h1v4h1" strokeLinecap="round" />
          </svg>
          Créditos de fotos
        </button>
      </div>
      {open && (
        <div
          role="note"
          className="mt-1 rounded-lg px-3 py-2.5"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          {[...byAttribution.entries()].map(([attribution, names]) => (
            <div key={attribution} className="text-[11px] leading-relaxed" style={{ color: '#7C7C8C' }}>
              {attribution} · {names.join(', ')}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
