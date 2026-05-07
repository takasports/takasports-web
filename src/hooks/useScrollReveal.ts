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

  const setRef = useCallback(
    (element: HTMLDivElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }

      if (!element) return

      const revealAll = () => {
        element.querySelectorAll('[data-reveal]').forEach(c => c.classList.add('revealed'))
      }

      if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        revealAll()
        return
      }

      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const children = entry.target.querySelectorAll('[data-reveal]')
            children.forEach((child, index) => {
              setTimeout(() => child.classList.add('revealed'), index * 60)
            })
            observer.unobserve(entry.target)
          }
        })
      }, { threshold, rootMargin })

      observer.observe(element)
      observerRef.current = observer
    },
    [threshold, rootMargin],
  )

  return setRef
}
