'use client'

import Image from 'next/image'
import { useState } from 'react'

/**
 * Avatar de jugador con fallback en cascada por error de carga:
 *   headshot (ESPN) → escudo del club → inicial del nombre.
 *
 * El motivo de existir: ESPN devuelve para muchos futbolistas un `headshot.href`
 * que da 404, así que comprobar solo `headshot ? …` deja un cuadro vacío con la
 * imagen rota. Con `onError` detectamos el fallo de carga real y caemos al
 * siguiente recurso. Es un client component porque `onError` necesita estado.
 */
export default function PlayerAvatar({
  headshot,
  teamLogo,
  teamName,
  name,
  accent,
}: {
  headshot?: string
  teamLogo?: string
  teamName?: string
  name: string
  accent: string
}) {
  const [headFailed, setHeadFailed] = useState(false)
  const [logoFailed, setLogoFailed] = useState(false)

  if (headshot && !headFailed) {
    return (
      <Image
        src={headshot}
        alt={name}
        width={80}
        height={80}
        unoptimized
        onError={() => setHeadFailed(true)}
        style={{ objectFit: 'cover', width: 80, height: 80 }}
      />
    )
  }
  if (teamLogo && !logoFailed) {
    return (
      <Image
        src={teamLogo}
        alt={teamName ?? name}
        width={56}
        height={56}
        unoptimized
        onError={() => setLogoFailed(true)}
        style={{ objectFit: 'contain' }}
      />
    )
  }
  return (
    <span className="font-black text-3xl" style={{ color: accent, fontFamily: 'var(--font-display)' }}>
      {name.charAt(0)}
    </span>
  )
}
