'use client'

import { useEffect, useState } from 'react'

/**
 * `false` en el servidor y en el PRIMER render del cliente; `true` a partir de
 * ahí. Es el guard para todo lo que se decide con el reloj DEL NAVEGADOR.
 *
 * Por qué hace falta: la portada y /noticias se sirven con `revalidate = 300`,
 * así que el HTML que llega al navegador puede haberse renderizado hasta cinco
 * minutos antes. Cualquier cosa que el render calcule con `Date.now()` —el
 * badge "Nuevo" de las noticias de menos de 2 h, por ejemplo— puede salir de
 * una manera en ese HTML y de otra al hidratar. React lo considera un fallo de
 * hidratación (error #418), tira TODO el árbol y lo vuelve a pintar en cliente.
 *
 * Con este flag el primer render del cliente es idéntico al del servidor, y el
 * valor real aparece en el render siguiente, ya sin hidratación de por medio.
 *
 * Para TEXTO que solo cambia de forma (ej. `timeAgo()`) basta con
 * `suppressHydrationWarning` en el elemento que lo contiene. Este hook es para
 * lo que aparece y desaparece, que es estructural y no se puede suprimir.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  return mounted
}
