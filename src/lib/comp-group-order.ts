// ── En qué orden se apilan las LIGAS dentro de un día ───────────────────────
//
// Hasta ahora el orden de los grupos era el de PRIMERA APARICIÓN y, como los
// partidos del día llegan por hora, eso equivalía a "quien madruga, manda".
// Medido el 21/08/2026 en la app: la Liga Argentina, que se juega de
// madrugada en horario de Madrid y a las 09:00 ya está toda en FINAL,
// encabezaba el día por delante de Premier y LaLiga. El usuario que entra por
// la mañana veía primero cinco resultados cerrados de una liga que no sigue y
// tenía que bajar para encontrar lo que iba a pasar esa tarde.
//
// La regla nueva es una sola y vale para cualquier día:
//   1. las ligas FIJADAS por el usuario, siempre arriba;
//   2. luego, por ESTADO: lo que se juega ahora → lo que está por jugarse →
//      lo ya terminado;
//   3. dentro de cada estado, por IMPORTANCIA (la misma tabla que ordena la
//      hoja de ligas y Destacados);
//   4. y a igualdad, la que empieza antes.
//
// En un día pasado todo está terminado y en uno futuro nada lo está, así que
// allí la regla degenera limpiamente en "por importancia". El orden por hora
// se mantiene DENTRO de cada liga (groupDayByCompetition), que es donde de
// verdad se lee como una parrilla.

export interface GroupOrderEvent {
  isoDate?: string
  /** ¿Se juega AHORA? Lo sabe quien llama (liveScores en la web, status en la app). */
  live?: boolean
  /** ¿Ya terminó? */
  over?: boolean
}

export interface CompGroupInput {
  comp: string
  events: readonly GroupOrderEvent[]
  /** Liga fijada por el usuario: va arriba pase lo que pase. */
  pinned?: boolean
}

/** 0 = alguno en vivo · 1 = queda algo por jugarse · 2 = todo terminado. */
export function groupTier(events: readonly GroupOrderEvent[]): 0 | 1 | 2 {
  if (events.some(e => e.live)) return 0
  if (events.some(e => !e.over)) return 1
  return 2
}

/** Instante del primer partido del grupo; sin fecha, al final. */
function earliest(events: readonly GroupOrderEvent[]): string {
  let min = '￿'
  for (const e of events) {
    const iso = e.isoDate ?? ''
    if (iso && iso < min) min = iso
  }
  return min
}

/** Devuelve los nombres de competición ya ordenados. No muta la entrada. */
export function orderCompGroups(
  groups: readonly CompGroupInput[],
  score: (comp: string) => number,
): string[] {
  return [...groups]
    .sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1
      const ta = groupTier(a.events)
      const tb = groupTier(b.events)
      if (ta !== tb) return ta - tb
      const sa = score(a.comp)
      const sb = score(b.comp)
      if (sa !== sb) return sb - sa
      const ea = earliest(a.events)
      const eb = earliest(b.events)
      if (ea !== eb) return ea < eb ? -1 : 1
      return a.comp.localeCompare(b.comp)   // desempate estable
    })
    .map(g => g.comp)
}
