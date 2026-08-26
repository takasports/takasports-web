'use client'

import React from 'react'
import { trackArticleShare } from '@/lib/analytics'

export type ShareStoryState =
  | 'idle'
  | 'busy'        // descargando la placa
  | 'ready'       // placa en memoria, esperando el toque que abrirá la hoja
  | 'shared'
  | 'downloaded'
  | 'failed'

/**
 * Comparte una noticia como placa vertical 1080×1920 para historias.
 *
 * Lo usan los cuatro puntos de entrada (flotante, bloque intercalado, bloque de
 * cierre y menú), de ahí el hook.
 *
 * ── Por qué está montado así ──────────────────────────────────────
 *
 * `navigator.share()` exige ACTIVACIÓN TRANSITORIA: si no la tiene, rechaza con
 * `NotAllowedError`. La ventana de Safari es corta y **un `await fetch` se la
 * come**. La primera versión hacía justo eso —clipboard, fetch de ~0,4-2 s y
 * después share— así que en iPhone el botón copiaba el enlace y no abría nada.
 * No saltó en las pruebas porque el Chromium headless no tiene `navigator.share`
 * y siempre caía por la rama de descarga.
 *
 * Ahora:
 *  1. La placa se PRECARGA (`prefetch`) cuando el lector ya está enganchado, así
 *     que al pulsar el fichero está en memoria y `share()` se llama sin ningún
 *     await por delante, dentro del gesto.
 *  2. Si aún no está lista, NO se intenta compartir a ciegas: se descarga y el
 *     botón pasa a «Listo — toca para compartir». El segundo toque es un gesto
 *     limpio. Mejor un toque de más que un fallo silencioso.
 *  3. `share()` va ANTES que el portapapeles y ninguno de los dos se espera: se
 *     lanzan en el mismo tick para que los dos caigan dentro de la activación.
 */
export function useShareStory({ slug, title }: { slug?: string; title: string }) {
  const [state, setState] = React.useState<ShareStoryState>('idle')
  const [linkCopied, setLinkCopied] = React.useState(false)
  const fileRef = React.useRef<File | null>(null)
  const inflight = React.useRef<Promise<File | null> | null>(null)
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  // Una noticia distinta invalida la placa cacheada.
  React.useEffect(() => {
    fileRef.current = null
    inflight.current = null
    setState('idle')
  }, [slug])

  const fetchFile = React.useCallback((): Promise<File | null> => {
    if (fileRef.current) return Promise.resolve(fileRef.current)
    if (inflight.current) return inflight.current
    if (!slug) return Promise.resolve(null)

    inflight.current = (async () => {
      try {
        const res = await fetch(`/api/og/story/${encodeURIComponent(slug)}`)
        if (!res.ok) throw new Error(String(res.status))
        const blob = await res.blob()
        // El endpoint sirve JPEG (pesa ~90% menos que el PNG de satori), pero
        // leemos el tipo real: si sharp fallara allí, vuelve un PNG.
        const type = blob.type || 'image/jpeg'
        const ext  = type === 'image/png' ? 'png' : 'jpg'
        const file = new File([blob], `takasports-${slug}.${ext}`, { type })
        fileRef.current = file
        return file
      } catch {
        return null
      } finally {
        inflight.current = null
      }
    })()
    return inflight.current
  }, [slug])

  /** Deja la placa lista en memoria. Silencioso: no toca el estado visible. */
  const prefetch = React.useCallback(() => {
    if (!slug || fileRef.current || inflight.current) return
    void fetchFile()
  }, [slug, fetchFile])

  const canShareFile = (file: File) =>
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })

  const resetLater = React.useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { setState('idle'); setLinkCopied(false) }, 3600)
  }, [])

  const download = React.useCallback((file: File) => {
    const objectUrl = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = file.name
    a.click()
    URL.revokeObjectURL(objectUrl)
  }, [])

  const share = React.useCallback(async () => {
    if (!slug || state === 'busy') return
    const cached = fileRef.current

    // ── Camino rápido: la placa ya está aquí, el gesto sigue vivo ──
    if (cached && canShareFile(cached)) {
      let sharePromise: Promise<void>
      try {
        // Sin await por delante y ANTES del portapapeles: es la llamada que
        // necesita la activación, así que va primero.
        sharePromise = navigator.share({ files: [cached], title })
      } catch {
        setState('failed'); resetLater(); return
      }
      // Mismo tick, sin esperar: el enlace para el sticker de Instagram.
      navigator.clipboard?.writeText(window.location.href)
        .then(() => setLinkCopied(true))
        .catch(() => {})
      try {
        await sharePromise
        trackArticleShare({ title, method: 'story' })
        setState('shared')
      } catch (err) {
        setState((err as { name?: string })?.name === 'AbortError' ? 'idle' : 'failed')
      }
      resetLater()
      return
    }

    // ── La placa no está lista ──
    setState('busy')
    const file = await fetchFile()
    if (!file) { setState('failed'); resetLater(); return }

    if (canShareFile(file)) {
      // El gesto se gastó en la descarga. NO abrimos la hoja aquí: en Safari
      // rechazaría con NotAllowedError. Pedimos un segundo toque.
      setState('ready')
      return
    }

    // Escritorio: no hay hoja del sistema, así que se descarga el fichero. Esto
    // no necesita activación, se puede hacer después del await sin problema.
    try {
      await navigator.clipboard.writeText(window.location.href)
      setLinkCopied(true)
    } catch { /* sin portapapeles */ }
    download(file)
    trackArticleShare({ title, method: 'story' })
    setState('downloaded')
    resetLater()
  }, [slug, title, state, fetchFile, resetLater, download])

  return { state, linkCopied, share, prefetch }
}
