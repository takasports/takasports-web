'use client'

// ─────────────────────────────────────────────────────────────────
// BadgeUnlockProvider — detecta badges nuevos desbloqueados y muestra
// BadgeUnlockModal celebratorio.
//
// Estrategia (sin tráfico extra):
//   1. Al montar y cuando la pestaña vuelve a visible (`visibilitychange`),
//      hace fetch a /api/quiniela/me. Si el user no está autenticado
//      (401), se queda en idle silencioso — no reintenta.
//   2. Compara los badge_ids desbloqueados contra el set en localStorage
//      (`taka_seen_badges`). Los IDs nuevos se encolan.
//   3. La primera vez que carga (no hay set previo en localStorage), NO
//      muestra modal — solo "siembra" el set. Esto evita que el primer
//      login dispare modales para badges históricos.
//   4. Muestra modales uno a uno; el user navega con "Siguiente".
//
// NO se ejecuta server-side. El componente se importa con `dynamic(...,
// { ssr: false })` en layout para garantizarlo y para no inflar el bundle
// inicial.
// ─────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback, useRef } from 'react'
import { BadgeUnlockModal, type UnlockedBadgeView } from './BadgeUnlockModal'

const SEEN_KEY = 'taka_seen_badges_v1'

interface MeBadge {
  id: string
  name: string
  emoji: string
  color: string
  bg: string
  rarity: string
  description: string
  unlockedAt: string | null
}

interface MeResponse {
  badges?: MeBadge[]
  error?: string
}

function readSeen(): Set<string> | null {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    if (!raw) return null
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return null
    return new Set(arr.filter((x): x is string => typeof x === 'string'))
  } catch { return null }
}

function writeSeen(set: Set<string>) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...set])) } catch { /* ignore */ }
}

export default function BadgeUnlockProvider() {
  const [queue, setQueue] = useState<UnlockedBadgeView[]>([])
  const lastCheckRef = useRef(0)
  // Si el endpoint nos dijo "no auth", desactivamos chequeos hasta el
  // próximo reload — el user no tiene sesión, no hay nada que detectar.
  const disabledRef  = useRef(false)

  const checkForUnlocks = useCallback(async () => {
    if (disabledRef.current) return
    // Throttling: máximo 1 check cada 8s para evitar storms al cambiar
    // de pestaña rápido.
    const now = Date.now()
    if (now - lastCheckRef.current < 8000) return
    lastCheckRef.current = now

    let resp: Response
    try {
      resp = await fetch('/api/quiniela/me', { cache: 'no-store' })
    } catch { return }
    if (resp.status === 401 || resp.status === 503) {
      disabledRef.current = true
      return
    }
    if (!resp.ok) return

    let data: MeResponse
    try { data = await resp.json() } catch { return }
    const all = (data.badges ?? []).filter(b => b.unlockedAt)

    const unlockedIds = new Set(all.map(b => b.id))
    const seen = readSeen()

    // Primera vez: solo siembra, no abre modal.
    if (seen == null) {
      writeSeen(unlockedIds)
      return
    }

    // Diff
    const fresh: UnlockedBadgeView[] = []
    for (const b of all) {
      if (!seen.has(b.id)) {
        fresh.push({
          id: b.id,
          name: b.name,
          emoji: b.emoji,
          color: b.color,
          bg: b.bg,
          rarity: b.rarity,
          description: b.description,
          // El endpoint /me no devuelve el title-unlock directamente, pero
          // podemos obtenerlo del catálogo en cliente — import dinámico
          // para no inflar el bundle si nunca hay desbloqueos.
          titleUnlock: null,
        })
      }
    }

    if (fresh.length === 0) {
      // Update the seen set anyway por si hay badges retirados.
      writeSeen(unlockedIds)
      return
    }

    // Resolver titleUnlock vía catálogo cliente.
    try {
      const { BADGES } = await import('@/lib/badges')
      for (const f of fresh) {
        const def = BADGES[f.id]
        if (def?.unlocks?.title) f.titleUnlock = def.unlocks.title
      }
    } catch { /* ignore — el modal funciona sin titleUnlock */ }

    // Ordenar por rareza descendente para que los épicos/legendarios sean
    // los primeros que vea el user.
    const order: Record<string, number> = { legendary: 0, epic: 1, rare: 2, common: 3 }
    fresh.sort((a, b) => (order[a.rarity] ?? 9) - (order[b.rarity] ?? 9))

    setQueue(prev => [...prev, ...fresh])
    writeSeen(unlockedIds)
  }, [])

  useEffect(() => {
    void checkForUnlocks()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void checkForUnlocks()
    }
    document.addEventListener('visibilitychange', onVisible)
    // Hook ligero: cuando alguien escribe en localStorage desde otra pestaña
    // o cuando termina un settle local (otros componentes pueden disparar
    // `window.dispatchEvent(new Event('taka:badge-check'))` para forzar).
    const onCustom = () => { void checkForUnlocks() }
    window.addEventListener('taka:badge-check', onCustom)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('taka:badge-check', onCustom)
    }
  }, [checkForUnlocks])

  if (queue.length === 0) return null

  const current = queue[0]
  const remaining = queue.length - 1

  return (
    <BadgeUnlockModal
      badge={current}
      queueRemaining={remaining}
      onNext={() => setQueue(q => q.slice(1))}
      onClose={() => setQueue([])}
    />
  )
}
