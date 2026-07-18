'use client'
import { useState } from 'react'
import PlayerAvatar from '@/components/PlayerAvatar'

/**
 * Avatar circular del perfil: foto resuelta (cascada del cron) con anillo del color del
 * deporte, cayendo a headshot ESPN → escudo → inicial vía PlayerAvatar.
 *
 * El botón ⓘ es el crédito LEGALMENTE obligatorio de las fotos CC (Wikimedia): discreto
 * pero accesible al toque, sin dar publicidad a plataformas en la propia página. Solo se
 * pinta cuando la foto mostrada exige atribución — con fotos de otras fuentes no aparece.
 */
export default function PlayerPhoto({
  photo,
  attribution,
  headshot,
  teamLogo,
  teamName,
  name,
  accent,
  size = 88,
}: {
  photo?: string
  attribution?: string
  headshot?: string
  teamLogo?: string
  teamName?: string
  name: string
  accent: string
  size?: number
}) {
  const [showCredit, setShowCredit] = useState(false)

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <div
        className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
        style={{ background: 'rgba(255,255,255,0.05)', border: `2.5px solid ${accent}` }}
      >
        <PlayerAvatar
          headshot={photo ?? headshot}
          teamLogo={teamLogo}
          teamName={teamName}
          name={name}
          accent={accent}
          headshotSize={size}
          logoSize={Math.round(size * 0.55)}
        />
      </div>
      {photo && attribution && (
        <>
          <button
            aria-label="Crédito de la foto"
            aria-expanded={showCredit}
            onClick={() => setShowCredit(v => !v)}
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
              className="absolute left-0 top-full mt-2 z-20 w-56 rounded-lg px-2.5 py-1.5 text-[10px] leading-snug"
              style={{
                background: 'rgba(10,10,17,0.95)',
                border: '0.5px solid rgba(255,255,255,0.15)',
                color: '#B8B8C6',
              }}
            >
              Foto: {attribution}
            </div>
          )}
        </>
      )}
    </div>
  )
}
