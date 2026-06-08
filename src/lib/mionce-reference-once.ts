// Once de referencia (algorítmico) para Mi Once.
//
// Una solución posible al tablero posición×club de una semana: un jugador por
// hueco que cumple la posición de la formación y el club del slot, sin repetir.
// Se usa como FALLBACK del once "editorial" cuando la redacción no ha publicado
// uno manual, para que el panel de comparación nunca quede vacío. 100%
// determinista (mismo tablero → mismo once); $0 (se computa en el servidor, sin
// cron ni IA). El once humano (mionce_editorial) siempre tiene prioridad.

import { PLAYERS_DEDUP, type Player } from './players-catalog'
import { FORMATIONS } from './mionce-formations'
import { getChallengeForWeek, type Challenge } from './mionce-challenges'

export interface ReferenceOnce {
  title: string
  formation: string
  slots: Record<string, string>   // slotId -> playerId
  note: string
}

// "Notoriedad" aproximada sin score real: leyendas multiclub primero, luego
// vigentes; desempate estable por id. Clave de orden 100% determinista.
function rankKey(p: Player): string {
  const tier = p.altClubs && p.altClubs.length > 0 ? '0' : '1'
  const era = p.era === 'current' ? '0' : '1'
  return `${tier}${era}${p.id}`
}

/** Construye el once de referencia de un Challenge posición×club (greedy:
 *  por hueco elige el jugador válido más reconocible aún sin usar). */
export function computeReferenceForChallenge(challenge: Challenge): ReferenceOnce | null {
  if (!challenge.slotTags) return null
  const formation = challenge.recommendedFormation
  const slotDefs = FORMATIONS[formation]
  const used = new Set<string>()
  const slots: Record<string, string> = {}

  for (const slot of slotDefs) {
    const tag = challenge.slotTags[slot.id]
    if (!tag) continue
    const eligible = PLAYERS_DEDUP.filter(p => p.position === slot.position && tag.match(p))
    const fresh = eligible.filter(p => !used.has(p.id))
    // Preferimos no repetir; si el hueco se quedó sin frescos, permitimos repetir.
    const pool = (fresh.length > 0 ? fresh : eligible).slice().sort((a, b) => (rankKey(a) < rankKey(b) ? -1 : 1))
    const pick = pool[0]
    if (!pick) continue
    slots[slot.id] = pick.id
    used.add(pick.id)
  }

  return {
    title: 'Once de referencia',
    formation,
    slots,
    note: 'Una de las muchas alineaciones válidas del reto de esta semana.',
  }
}

/** Once de referencia para una clave de semana ISO ("YYYY-Www"). */
export function computeReferenceOnce(weekKey: string): ReferenceOnce | null {
  const challenge = getChallengeForWeek(weekKey)
  return challenge ? computeReferenceForChallenge(challenge) : null
}
