'use client'

// Invitación de fin de partida para INVITADOS.
//
// El 91% de las partidas de minijuegos en la web son anónimas: la gente entra,
// juega, termina… y no se le ofrece nada. La app sí tenía este aviso en su
// pantalla de resultados; la web no tenía ninguno.
//
// La promesa es LITERAL, no marketing: `recordPlay` guarda la partida en el
// dispositivo y, si no hay sesión, la deja en una cola (`ts_games:queue`); el
// Header la sube en cuanto se detecta SIGNED_IN. Así que la partida que se
// acaba de jugar SÍ acaba en la cuenta, con su periodo original, y entra en el
// ranking de ese día. Si algún día se retira esa cola, hay que cambiar este
// texto — decirle a alguien que guardas algo y no hacerlo es peor que no
// ofrecerlo.
//
// Con sesión no renderiza nada.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { TrophyIcon } from '@/components/icons/GameIcons'

interface Props {
  /** Acento del juego, para que la tarjeta no desentone con su pantalla. */
  accent?: string
}

export default function GuestSaveCta({ accent = '#A78BFA' }: Props) {
  // null = aún no sabemos (no pintamos nada para no dar un salto de layout)
  const [isGuest, setIsGuest] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    if (!supabase) { setIsGuest(false); return }
    // Lectura local de la sesión: no hay petición de red.
    supabase.auth.getSession()
      .then(({ data }) => { if (!cancelled) setIsGuest(!data.session) })
      .catch(() => { if (!cancelled) setIsGuest(false) })
    return () => { cancelled = true }
  }, [])

  if (isGuest !== true) return null

  return (
    <div
      className="rounded-2xl p-4 flex items-center gap-3.5"
      style={{
        background: `linear-gradient(135deg, ${accent}14, rgba(255,255,255,0.02))`,
        border: `1px solid ${accent}38`,
      }}
    >
      <span
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${accent}20`, color: accent, border: `1px solid ${accent}40` }}
        aria-hidden
      >
        <TrophyIcon size={20} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black leading-tight" style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)' }}>
          Esta partida se guardará en tu cuenta
        </p>
        <p className="text-[11.5px] leading-snug mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          La tienes guardada en este dispositivo. Entra y se sube sola: cuenta para el ranking del día
          y suma a tu Liga Taka.
        </p>
      </div>
      <Link
        href="/auth"
        className="text-[10px] font-black uppercase tracking-widest px-3.5 py-2 rounded-xl flex-shrink-0 transition-opacity hover:opacity-90"
        style={{ background: accent, color: '#09090F', fontFamily: 'var(--font-sport)' }}
      >
        Entrar
      </Link>
    </div>
  )
}
