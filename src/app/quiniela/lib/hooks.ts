'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import { COINS_KEY, COINS_TXN_KEY, COINS_INITIAL } from './constants'
import type { CoinTxn } from './types'

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

// ─────────────────────────────────────────────────────────────────
// Hook: monedas — fuente única (BD si auth, localStorage si invitado)
//
// Server side es la fuente de verdad cuando hay sesión: el balance se
// lee de la vista `quiniela_coin_balance` y las transacciones se
// graban vía RPC `add_coins` (cap server + audit). Sin sesión se
// mantiene el comportamiento legacy con localStorage para no romper
// el modo invitado.
// ─────────────────────────────────────────────────────────────────
export interface UseCoinsApi {
  balance: number
  txns: CoinTxn[]
  ready: boolean
  source: 'db' | 'local'
  /** Suma (o resta) monedas. En modo BD, llama al RPC y refresca. */
  add: (amount: number, reason: string, context?: Record<string, unknown>) => Promise<number>
  refresh: () => Promise<void>
}

function readLocalBalance(): number {
  try {
    const v = localStorage.getItem(COINS_KEY)
    if (v !== null) return parseInt(v, 10)
    localStorage.setItem(COINS_KEY, String(COINS_INITIAL))
    return COINS_INITIAL
  } catch { return 0 }
}
function readLocalTxns(): CoinTxn[] {
  try { return JSON.parse(localStorage.getItem(COINS_TXN_KEY) ?? '[]') } catch { return [] }
}
function writeLocal(balance: number, txn: CoinTxn) {
  try {
    localStorage.setItem(COINS_KEY, String(Math.max(0, balance)))
    const txns = readLocalTxns()
    txns.unshift(txn)
    localStorage.setItem(COINS_TXN_KEY, JSON.stringify(txns.slice(0, 20)))
  } catch { /* ignore */ }
}

export function useCoins(user: User | null): UseCoinsApi {
  const [balance, setBalance] = useState<number>(COINS_INITIAL)
  const [txns, setTxns] = useState<CoinTxn[]>([])
  const [ready, setReady] = useState(false)
  const source: 'db' | 'local' = user ? 'db' : 'local'
  const fetching = useRef(false)

  const refresh = useCallback(async () => {
    if (!user) {
      setBalance(readLocalBalance())
      setTxns(readLocalTxns())
      setReady(true)
      return
    }
    if (fetching.current) return
    fetching.current = true
    try {
      const res = await fetch('/api/quiniela/coins', { cache: 'no-store' })
      if (res.ok) {
        const json = await res.json() as { balance: number | null; txns: Array<{ amount: number; reason: string; context?: Record<string, unknown>; created_at: string }> }
        setBalance(json.balance ?? 0)
        setTxns((json.txns ?? []).map(t => ({ amount: t.amount, reason: t.reason, ts: new Date(t.created_at).getTime() })))
      }
    } catch { /* keep current */ }
    finally {
      fetching.current = false
      setReady(true)
    }
  }, [user])

  useEffect(() => { void refresh() }, [refresh])

  const add = useCallback(async (amount: number, reason: string, context?: Record<string, unknown>): Promise<number> => {
    if (amount === 0) return balance
    // Modo invitado: localStorage como antes (sin BD)
    if (!user) {
      const next = Math.max(0, readLocalBalance() + amount)
      writeLocal(next, { amount, reason, ts: Date.now() })
      setBalance(next)
      setTxns(readLocalTxns())
      return next
    }
    // Modo auth: RPC server (audit + cap). Reflejamos optimistamente.
    const sb = createClient()
    if (!sb) return balance
    const optimistic = Math.max(0, balance + amount)
    setBalance(optimistic)
    setTxns(prev => [{ amount, reason, ts: Date.now() }, ...prev].slice(0, 50))
    try {
      const { error } = await sb.rpc('add_coins', {
        p_amount: amount,
        p_reason: reason,
        p_context: context ?? {},
      })
      if (error) {
        // Rollback optimistic update y refresca
        await refresh()
        return balance
      }
    } catch {
      await refresh()
      return balance
    }
    return optimistic
  }, [user, balance, refresh])

  return { balance, txns, ready, source, add, refresh }
}
