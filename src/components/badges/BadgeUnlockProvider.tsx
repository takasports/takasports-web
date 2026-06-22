'use client'

// ─────────────────────────────────────────────────────────────────
// BadgeUnlockProvider — detecta badges nuevos desbloqueados y muestra
// BadgeUnlockModal celebratorio.
//
// Estrategia (sin tráfico extra):
//   1. Lee los datos de /api/quiniela/me del STORE COMPARTIDO
//      (`useQuinielaMe`) — un solo fetch global, compartido con el chip de
//      nivel del Header. El store ya cablea los disparadores (mount,
//      visibilitychange, evento 'taka:badge-check' tras settle) y la
//      desactivación silenciosa en 401. Aquí solo reaccionamos al dato.
//   2. Compara los badge_ids desbloqueados contra el set en localStorage
//      (`taka_seen_badges_v1`). Los IDs nuevos se encolan.
//   3. La primera vez que carga (no hay set previo en localStorage), NO
//      muestra modal — solo "siembra" el set. Esto evita que el primer
//      login dispare modales para badges históricos.
//   4. Muestra modales uno a uno; el user navega con "Siguiente".
//
// NO se ejecuta server-side. El componente se importa con `dynamic(...,
// { ssr: false })` en layout para garantizarlo y para no inflar el bundle
// inicial.
// ─────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { useQuinielaMe } from '@/lib/quiniela-me-store'
import { BadgeUnlockModal, type UnlockedBadgeView } from './BadgeUnlockModal'

const SEEN_KEY = 'taka_seen_badges_v1'

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
  // Dato del store compartido (1 solo fetch global). `version` sube en cada
  // respuesta fresca → corremos el diff una vez por respuesta.
  const { data, version } = useQuinielaMe()

  useEffect(() => {
    if (!data) return // sin sesión / aún sin respuesta — nada que detectar
    let cancelled = false

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

    // Resolver titleUnlock vía catálogo cliente + encolar (async).
    void (async () => {
      try {
        const { BADGES } = await import('@/lib/badges')
        for (const f of fresh) {
          const def = BADGES[f.id]
          if (def?.unlocks?.title) f.titleUnlock = def.unlocks.title
        }
      } catch { /* ignore — el modal funciona sin titleUnlock */ }

      if (cancelled) return

      // Ordenar por rareza descendente para que los épicos/legendarios sean
      // los primeros que vea el user.
      const order: Record<string, number> = { legendary: 0, epic: 1, rare: 2, common: 3 }
      fresh.sort((a, b) => (order[a.rarity] ?? 9) - (order[b.rarity] ?? 9))

      setQueue(prev => [...prev, ...fresh])
      writeSeen(unlockedIds)
    })()

    return () => { cancelled = true }
    // version en deps: corre el diff una vez por respuesta fresca del store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

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
