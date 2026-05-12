'use client'

import { useCallback, useRef } from 'react'

interface UseScrollRevealOptions {
  threshold?: number
  rootMargin?: string
}

// Returns a callback ref so the observer is (re)set up every time
// the element mounts — fixes grid/list view toggling and category changes
// where the element is replaced but useEffect deps don't change.
export function useScrollReveal(options: UseScrollRevealOptions = {}) {
  const { threshold = 0.1, rootMargin = '0px 0px -50px 0px' } = options
  const observerRef = useRef<IntersectionObserver | null>(null)
  const mutationObserverRef = useRef<MutationObserver | null>(null)

  const setRef = useCallback(
    (element: HTMLDivElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }
      if (mutationObserverRef.current) {
        mutationObserverRef.current.disconnect()
        mutationObserverRef.current = null
      }

      if (!element) return

      const revealEl = (el: Element, delay = 0) => {
        if (el.classList.contains('revealed')) return
        if (delay > 0) setTimeout(() => el.classList.add('revealed'), delay)
        else el.classList.add('revealed')
      }

      const revealAllImmediate = () => {
        element.querySelectorAll('[data-reveal]').forEach(c => revealEl(c))
      }

      if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        revealAllImmediate()
      } else {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const children = entry.target.querySelectorAll('[data-reveal]:not(.revealed)')
              children.forEach((child, index) => revealEl(child, index * 60))
              observer.unobserve(entry.target)
            }
          })
        }, { threshold, rootMargin })

        observer.observe(element)
        observerRef.current = observer
      }

      // Reveal cualquier hijo nuevo que aparezca después (loadMore, etc.):
      // si ya están en viewport los pintamos al instante.
      const mo = new MutationObserver(() => {
        const rect = element.getBoundingClientRect()
        const inViewport = rect.top < window.innerHeight && rect.bottom > 0
        if (inViewport) {
          element.querySelectorAll('[data-reveal]:not(.revealed)').forEach((c, i) => revealEl(c, i * 30))
        } else {
          // Si aún no se ha visto el contenedor, marcamos los nuevos para revelar cuando entre en viewport
          // (el IntersectionObserver ya quedaría unobserved tras la primera intersección; los marcamos directos).
          element.querySelectorAll('[data-reveal]:not(.revealed)').forEach(c => revealEl(c))
        }
      })
      mo.observe(element, { childList: true, subtree: true })
      mutationObserverRef.current = mo
    },
    [threshold, rootMargin],
  )

  return setRef
}
