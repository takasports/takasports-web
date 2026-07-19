'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { RosterPlayer } from '@/app/api/team/[slug]/route'

/**
 * Tarjeta "Figura del equipo", sobre las pestañas. Cara: foto de la caché propia
 * (cascada Wikimedia) antes que el headshot de ESPN, que fuera del top-5 europeo
 * casi nunca existe — mismo tratamiento que RosterTab.
 *
 * El botón ⓘ replica el patrón de PlayerPhoto: crédito LEGALMENTE obligatorio de las
 * fotos CC (Wikimedia). Aquí no basta el RosterCredits porque vive dentro de la pestaña
 * Plantilla y esta tarjeta se ve sin abrirla. Solo se pinta si la foto exige atribución.
 * La tarjeta entera puede ser un <Link> al perfil: el toggle corta el click para no navegar.
 */
export function FeaturedPlayerCard({ player, teamColor, leagueSlug }: { player: RosterPlayer; teamColor?: string; leagueSlug: string }) {
  const [showCredit, setShowCredit] = useState(false)
  const accent = teamColor ? `#${teamColor}` : '#7C3AED'
  const href = player.id ? `/jugador/${leagueSlug.replaceAll('/', '_')}_${player.id}` : undefined
  const face = player.photo ?? player.headshot
  const card = (
    <div
      className={`rounded-2xl p-5 mb-6 flex gap-4 items-center${href ? ' transition-all hover:bg-white/[0.06]' : ''}`}
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Foto o placeholder + crédito CC */}
      <div className="relative flex-shrink-0" style={{ width: 72, height: 72 }}>
        <div
          className="w-full h-full rounded-xl overflow-hidden flex items-center justify-center"
          style={{ background: `${accent}22` }}
        >
          {face ? (
            <Image src={face} alt={player.name} width={72} height={72} unoptimized
              style={{ objectFit: 'cover', width: 72, height: 72, borderRadius: 'var(--radius-card)' }} />
          ) : (
            <span className="font-black text-2xl" style={{ color: accent, fontFamily: 'var(--font-display)' }}>
              {player.jersey ? `#${player.jersey}` : player.name.charAt(0)}
            </span>
          )}
        </div>
        {player.photo && player.photoAttribution && (
          <>
            <button
              aria-label="Crédito de la foto"
              aria-expanded={showCredit}
              onClick={e => { e.preventDefault(); e.stopPropagation(); setShowCredit(v => !v) }}
              className="absolute bottom-0 right-0 w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] leading-none cursor-pointer"
              style={{
                background: 'rgba(10,10,17,0.85)',
                border: '0.5px solid rgba(255,255,255,0.25)',
                color: '#B8B8C6',
              }}
            >
              i
            </button>
            {showCredit && (
              <div
                role="note"
                onClick={e => { e.preventDefault(); e.stopPropagation() }}
                className="absolute left-0 top-full mt-2 z-20 w-56 rounded-lg px-2.5 py-1.5 text-[10px] leading-snug"
                style={{
                  background: 'rgba(10,10,17,0.95)',
                  border: '0.5px solid rgba(255,255,255,0.15)',
                  color: '#B8B8C6',
                }}
              >
                Foto: {player.photoAttribution}
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
            style={{ background: `${accent}33`, color: accent, fontFamily: 'var(--font-sport)' }}
          >
            Figura del equipo
          </span>
        </div>
        <div className="font-black text-lg text-white truncate" style={{ fontFamily: 'var(--font-display)' }}>
          {player.name}
        </div>
        <div className="text-[12px] text-[var(--text-muted)] uppercase tracking-wide mt-0.5">
          {player.posAbbr} {player.jersey ? `· #${player.jersey}` : ''}
          {player.nationality ? ` · ${player.nationality}` : ''}
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 flex-shrink-0">
        {[
          { label: 'Goles', value: player.goals },
          { label: 'Asist.', value: player.assists },
          { label: 'PJ', value: player.gamesPlayed },
        ].map(s => (
          <div key={s.label} className="text-center">
            <div className="text-xl font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>
              {s.value}
            </div>
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
  return href ? <Link href={href} prefetch={false}>{card}</Link> : card
}
