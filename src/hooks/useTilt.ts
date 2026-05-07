import { useRef, useEffect } from 'react'

interface TiltOptions {
  max?: number
  scale?: number
  speed?: number
  glare?: boolean
}

export function useTilt({ max = 7, scale = 1.02, speed = 0.12, glare = false }: TiltOptions = {}) {
  const elRef = useRef<HTMLDivElement>(null)
  const glareRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!window.matchMedia('(pointer: fine)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const el = elRef.current
    if (!el) return

    const s = { tx: 0, ty: 0, cx: 0, cy: 0, gx: 50, gy: 50, on: false, raf: 0 }

    function tick() {
      s.cx += (s.tx - s.cx) * speed
      s.cy += (s.ty - s.cy) * speed
      const scl = s.on ? scale : 1
      el!.style.transform = `perspective(900px) rotateX(${s.cy.toFixed(3)}deg) rotateY(${s.cx.toFixed(3)}deg) scale(${scl})`
      if (glare && glareRef.current) {
        glareRef.current.style.background = `radial-gradient(circle at ${s.gx.toFixed(1)}% ${s.gy.toFixed(1)}%, rgba(255,255,255,0.11) 0%, transparent 58%)`
      }
      const settled = !s.on && Math.abs(s.tx - s.cx) < 0.01 && Math.abs(s.ty - s.cy) < 0.01
      if (settled) {
        el!.style.transform = ''
        el!.style.willChange = ''
        if (glare && glareRef.current) glareRef.current.style.background = ''
        return
      }
      s.raf = requestAnimationFrame(tick)
    }

    function onMove(e: MouseEvent) {
      const r = el!.getBoundingClientRect()
      const nx = (e.clientX - r.left) / r.width - 0.5
      const ny = (e.clientY - r.top) / r.height - 0.5
      s.tx = nx * max * 2
      s.ty = -ny * max * 2
      s.gx = (nx + 0.5) * 100
      s.gy = (ny + 0.5) * 100
    }

    function onEnter() {
      s.on = true
      el!.style.willChange = 'transform'
      cancelAnimationFrame(s.raf)
      s.raf = requestAnimationFrame(tick)
    }

    function onLeave() {
      s.on = false
      s.tx = 0
      s.ty = 0
      cancelAnimationFrame(s.raf)
      s.raf = requestAnimationFrame(tick)
    }

    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseenter', onEnter)
    el.addEventListener('mouseleave', onLeave)

    return () => {
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('mouseenter', onEnter)
      el.removeEventListener('mouseleave', onLeave)
      cancelAnimationFrame(s.raf)
      el.style.transform = ''
      el.style.willChange = ''
    }
  }, [max, scale, speed, glare])

  return { elRef, glareRef }
}
