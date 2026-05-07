'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function LiveRefresh({ isLive }: { isLive: boolean }) {
  const router = useRouter()
  useEffect(() => {
    if (!isLive) return
    const id = setInterval(() => router.refresh(), 30_000)
    return () => clearInterval(id)
  }, [isLive, router])
  return null
}
