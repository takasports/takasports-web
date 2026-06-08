'use client'

import { useState, useEffect } from 'react'

// ─────────────────────────────────────────────────────────────────
// Hook: push notification subscription
// ─────────────────────────────────────────────────────────────────
export function usePushSubscription() {
  const [status, setStatus] = useState<'idle' | 'subscribed' | 'denied' | 'unsupported'>('idle')

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported'); return
    }
    if (Notification.permission === 'denied') { setStatus('denied'); return }
    navigator.serviceWorker.getRegistration('/sw.js').then(reg => {
      if (!reg) return
      reg.pushManager.getSubscription().then(sub => {
        if (sub) setStatus('subscribed')
      })
    })
  }, [])

  const subscribe = async () => {
    if (!('serviceWorker' in navigator)) return
    try {
      let reg = await navigator.serviceWorker.getRegistration('/sw.js')
      if (!reg) reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setStatus('denied'); return }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      })
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })
      setStatus('subscribed')
    } catch { setStatus('denied') }
  }

  const unsubscribe = async () => {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
    if (!reg) return
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      })
      await sub.unsubscribe()
    }
    setStatus('idle')
  }

  return { status, subscribe, unsubscribe }
}

// ─────────────────────────────────────────────────────────────────
// Hook: countdown + estado por partido
// ─────────────────────────────────────────────────────────────────
export function useMatchCountdown(isoDate?: string) {
  const [diff, setDiff] = useState(() =>
    isoDate ? new Date(isoDate).getTime() - Date.now() : Infinity
  )
  useEffect(() => {
    if (!isoDate) return
    const update = () => setDiff(new Date(isoDate).getTime() - Date.now())
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [isoDate])

  if (diff <= 0) return { started: true, soon: false, label: null }
  if (diff < 3_600_000) {
    const m = Math.floor(diff / 60_000)
    const s = Math.floor((diff % 60_000) / 1000)
    return { started: false, soon: true, label: `${m}:${String(s).padStart(2, '0')}` }
  }
  if (diff < 6 * 3_600_000) {
    const h = Math.floor(diff / 3_600_000)
    const m = Math.floor((diff % 3_600_000) / 60_000)
    return { started: false, soon: true, label: `${h}h ${m}m` }
  }
  return { started: false, soon: false, label: null }
}
