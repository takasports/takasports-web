'use client'

// La página de cada día se cachea con la hora de España: es la que ve Google. Al
// montar se cambia a la zona del lector, como ya hacen /calendario y la ficha, y si
// no se ha cambiado se dice de qué hora se trata. México recibía 01:30 sin ningún aviso.

import { useEffect, useState } from 'react'
import { formatInstantInZone, getStoredTZ, SOURCE_TZ, TZ_CHANGE_EVENT } from '@/lib/timezone'

function useZona(): string {
  const [zona, setZona] = useState(SOURCE_TZ)
  useEffect(() => {
    const leer = () => setZona(getStoredTZ())
    leer()
    window.addEventListener(TZ_CHANGE_EVENT, leer)
    return () => window.removeEventListener(TZ_CHANGE_EVENT, leer)
  }, [])
  return zona
}

export function HoraLocal({ iso, hora }: { iso?: string; hora: string }) {
  const zona = useZona()
  if (!iso || zona === SOURCE_TZ) return <>{hora}</>
  return <>{formatInstantInZone(iso, zona)?.time ?? hora}</>
}

export function ZonaDelDia() {
  const zona = useZona()
  return <>{zona === SOURCE_TZ ? 'Hora de España' : 'En tu hora'}</>
}
