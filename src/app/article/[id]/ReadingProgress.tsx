'use client'

import { useEffect, useState } from 'react'

export default function ReadingProgress({ accent }: { accent: string }) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    function onScroll() {
      const el = document.documentElement
      const scrollTop = el.scrollTop || document.body.scrollTop
      const scrollHeight = el.scrollHeight - el.clientHeight
      setProgress(scrollHeight > 0 ? Math.min(100, (scrollTop / scrollHeight) * 100) : 0)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 h-[2px] pointer-events-none"
      style={{ background: 'transparent' }}
    >
      <div
        style={{
          height: '100%',
          width: `${progress}%`,
          background: `linear-gradient(to right, ${accent}, ${accent}99)`,
          transition: 'width 80ms linear',
          boxShadow: `0 0 8px ${accent}80`,
        }}
      />
    </div>
  )
}
