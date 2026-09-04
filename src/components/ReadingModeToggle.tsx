'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Modo lectura claro — SOLO el cuerpo del artículo.
//
// El sitio es oscuro por identidad y así se queda: la cabecera, el pie, las
// píldoras y todo lo demás no cambian. Lo que cambia es la hoja donde se lee,
// que es donde alguien pasa cinco minutos seguidos.
//
// La preferencia se guarda en el navegador y la aplica un script diminuto en el
// <head> del artículo ANTES de pintar, para que no haya un fogonazo oscuro. Este
// componente solo mueve el mismo atributo y refleja el estado.
//
// Se pinta después de montar (`useMounted`): el HTML del artículo es ISR y
// cacheado, así que el servidor no puede saber la preferencia de nadie. Si se
// renderizara en el servidor, el botón saldría siempre en «oscuro» y al hidratar
// cambiaría → fallo de hidratación (el mismo #418 de la portada).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'
import { useMounted } from '@/hooks/useMounted'

export const CLAVE_LECTURA = 'ts_lectura'

export default function ReadingModeToggle() {
  const montado = useMounted()
  const [claro, setClaro] = useState(false)

  useEffect(() => {
    setClaro(document.documentElement.dataset.lectura === 'claro')
  }, [])

  const alternar = useCallback(() => {
    const siguiente = !claro
    setClaro(siguiente)
    const raiz = document.documentElement
    if (siguiente) raiz.dataset.lectura = 'claro'
    else delete raiz.dataset.lectura
    try { localStorage.setItem(CLAVE_LECTURA, siguiente ? 'claro' : 'oscuro') } catch { /* modo privado */ }
  }, [claro])

  if (!montado) return null

  return (
    <button
      type="button"
      onClick={alternar}
      aria-pressed={claro}
      title={claro ? 'Volver al fondo oscuro' : 'Leer sobre fondo claro'}
      aria-label={claro ? 'Volver al fondo oscuro' : 'Leer sobre fondo claro'}
      className="flex items-center justify-center rounded-full flex-shrink-0 transition-all hover:brightness-125"
      style={{
        width: 34, height: 34,
        background: claro ? 'rgba(251,250,247,0.92)' : 'rgba(255,255,255,0.05)',
        border: claro ? '1px solid rgba(251,250,247,0.5)' : '1px solid rgba(255,255,255,0.09)',
        cursor: 'pointer',
      }}
    >
      {claro ? (
        // Luna: el siguiente estado es volver al oscuro.
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z" stroke="#14141c" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
      ) : (
        // Sol: el siguiente estado es el claro.
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" stroke="#C4B5FD" strokeWidth="1.7" />
          <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6" stroke="#C4B5FD" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      )}
    </button>
  )
}
