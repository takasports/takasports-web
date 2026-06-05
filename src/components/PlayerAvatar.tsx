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
  headshotSize = 80,
  logoSize = 56,
  textClass = 'text-3xl',
}: {
  headshot?: string
  teamLogo?: string
  teamName?: string
  name: string
  accent: string
  /** px del headshot (cuadrado). */
  headshotSize?: number
  /** px del escudo del club (cuadrado). */
  logoSize?: number
  /** clase de tamaño para la inicial de fallback. */
  textClass?: string
}) {
  const [headFailed, setHeadFailed] = useState(false)
  const [logoFailed, setLogoFailed] = useState(false)

  if (headshot && !headFailed) {
    return (
      <Image
        src={headshot}
        alt={name}
        width={headshotSize}
        height={headshotSize}
        unoptimized
        onError={() => setHeadFailed(true)}
        style={{ objectFit: 'cover', width: headshotSize, height: headshotSize }}
      />
    )
  }
  if (teamLogo && !logoFailed) {
    return (
      <Image
        src={teamLogo}
        alt={teamName ?? name}
        width={logoSize}
        height={logoSize}
        unoptimized
        onError={() => setLogoFailed(true)}
        style={{ objectFit: 'contain' }}
      />
    )
  }
  return (
    <span className={`font-black ${textClass}`} style={{ color: accent, fontFamily: 'var(--font-display)' }}>
      {name.charAt(0)}
    </span>
  )
}
