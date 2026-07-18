// Emparejamiento de favoritos (❤) del calendario. Extraído del monolito CalendarioContent.

import type { SportEvent } from '@/lib/types'
import { nameMatch } from '@/lib/quiniela'
import { WOMENS_COMPS } from '@/lib/football-leagues'


// ── Favorites helpers ──────────────────────────────────────────
// Empareja el favorito guardado (nombre libre: del onboarding o del ❤ que guarda
// el nombre crudo del feed) contra el nombre del equipo del evento con el MISMO
// emparejador que la quiniela: por PALABRA COMPLETA + alias + sin acentos. Evita
// los falsos positivos del "contiene texto" ('Inter'⊄'Inter Miami', 'Milan'⊄'Inter
// Milan', 'Roma'⊄'Romania') sin perder los apodos ('Gladbach'→'Borussia
// Mönchengladbach', 'PSG'→'Paris Saint-Germain') ni las tildes ('Alavés'='Alaves').
export function isFavorite(favorites: Set<string>, name: string | null | undefined): boolean {
  if (!name || favorites.size === 0) return false
  for (const fav of favorites) {
    if (nameMatch(name, fav)) return true
  }
  return false
}

export function eventHasFavorite(favorites: Set<string>, ev: SportEvent): boolean {
  return isFavorite(favorites, ev.home) || isFavorite(favorites, ev.away)
}

// Clave de forma reciente con prefijo de género. El calendario recibe la forma
// indexada `w:`/`m:` + nombre (ver calendario/page.tsx) para no cruzar el club
// masculino con su homónimo femenino — comparten nombre, distinto equipo.
export function formKey(ev: SportEvent, name: string): string {
  return `${WOMENS_COMPS.has(ev.comp ?? '') ? 'w' : 'm'}:${name}`
}

