'use client'

import { useEffect, useRef, type RefObject } from 'react'

/** Llama a `alVer` una sola vez, cuando al menos la mitad del elemento entra en pantalla. */
export function useVistoUnaVez(ref: RefObject<Element | null>, alVer: () => void) {
  const avisado = useRef(false)
  const callback = useRef(alVer)
  callback.current = alVer

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const obs = new IntersectionObserver((entradas) => {
      if (avisado.current || !entradas.some(e => e.isIntersecting)) return
      avisado.current = true
      obs.disconnect()
      callback.current()
    }, { threshold: 0.5 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [ref])
}
