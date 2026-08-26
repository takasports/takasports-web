'use client'

import React from 'react'
import { trackArticleShare } from '@/lib/analytics'

export type ShareStoryState = 'idle' | 'busy' | 'shared' | 'downloaded' | 'failed'

/**
 * Comparte una noticia como placa vertical 1080×1920 para historias.
 *
 * Lo usan DOS sitios (el menú de compartir y el botón destacado del final del
 * artículo), de ahí el hook: la secuencia tiene demasiadas sutilezas como para
 * mantenerla por duplicado.
 *
 * El orden importa:
 *  1. Copiar el enlace ANTES de nada. Safari solo deja escribir en el
 *     portapapeles mientras dura la activación del usuario, y el `fetch` de la
 *     imagen se la come. Hace falta porque Instagram no acepta enlaces
 *     inyectados desde fuera (Meta retiró `contentURL` de su API): quien
 *     comparte pega la URL en el sticker de enlace.
 *  2. Descargar la placa.
 *  3. Hoja del sistema si la hay (móvil); si no, descarga del fichero (escritorio).
 */
export function useShareStory({ slug, title }: { slug?: string; title: string }) {
  const [state, setState] = React.useState<ShareStoryState>('idle')
  const [linkCopied, setLinkCopied] = React.useState(false)
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const share = React.useCallback(async () => {
    if (!slug || state === 'busy') return
    setState('busy')

    let copied = false
    try {
      await navigator.clipboard.writeText(window.location.href)
      copied = true
    } catch { /* sin portapapeles: el usuario copiará a mano */ }

    try {
      const res = await fetch(`/api/og/story/${encodeURIComponent(slug)}`)
      if (!res.ok) throw new Error(String(res.status))
      const blob = await res.blob()
      // El endpoint sirve JPEG (pesa ~80% menos que el PNG que saca satori),
      // pero leemos el tipo real: si sharp falló allí, vuelve un PNG.
      const type = blob.type || 'image/jpeg'
      const ext  = type === 'image/png' ? 'png' : 'jpg'
      const file = new File([blob], `takasports-${slug}.${ext}`, { type })

      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title })
        trackArticleShare({ title, method: 'story' })
        setState('shared')
      } else {
        const objectUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = objectUrl
        a.download = file.name
        a.click()
        URL.revokeObjectURL(objectUrl)
        trackArticleShare({ title, method: 'story' })
        setState('downloaded')
      }
    } catch (err) {
      // AbortError = el usuario canceló la hoja de compartir, no es un fallo.
      setState((err as { name?: string })?.name === 'AbortError' ? 'idle' : 'failed')
    }

    setLinkCopied(copied)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { setState('idle'); setLinkCopied(false) }, 3600)
  }, [slug, title, state])

  return { state, linkCopied, share }
}
