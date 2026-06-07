// Formaciones de Mi Once — FUENTE ÚNICA del layout de huecos (slot id + posición
// gruesa + etiqueta fina + coordenadas). Importado por la página (render), por el
// generador de tableros (scripts/gen-mionce-boards.ts) y por el test de solvencia,
// para que todos coincidan en qué posición exige cada hueco (antes el test
// duplicaba este mapa y podía divergir de la página).

import type { PlayerPosition } from './players-catalog'
import type { FormationId } from './mionce-challenges'

export interface SlotDef {
  id: string                 // gk, lb, cb1, cb2, rb, cm1, cm2, st1...
  position: PlayerPosition   // GK | DEF | MID | FWD
  label: string              // "PT", "LI", "DC", "MC", "DC", etc. (etiqueta fina)
  x: number                  // 0-100 (% horizontal)
  y: number                  // 0-100 (% vertical, 100=arriba=ataque)
}

// Posiciones en %. y=8 (cerca de GK) hasta y=84 (delanteros).
// El campo se renderiza con GK abajo y portería rival arriba.
export const FORMATIONS: Record<FormationId, SlotDef[]> = {
  '4-3-3': [
    { id: 'gk',  position: 'GK',  label: 'PT', x: 50, y: 8 },
    { id: 'lb',  position: 'DEF', label: 'LI', x: 14, y: 26 },
    { id: 'cb1', position: 'DEF', label: 'DC', x: 36, y: 24 },
    { id: 'cb2', position: 'DEF', label: 'DC', x: 64, y: 24 },
    { id: 'rb',  position: 'DEF', label: 'LD', x: 86, y: 26 },
    { id: 'cm1', position: 'MID', label: 'MC', x: 28, y: 50 },
    { id: 'cm2', position: 'MID', label: 'MC', x: 50, y: 46 },
    { id: 'cm3', position: 'MID', label: 'MC', x: 72, y: 50 },
    { id: 'lw',  position: 'FWD', label: 'EI', x: 18, y: 76 },
    { id: 'st',  position: 'FWD', label: 'DC', x: 50, y: 82 },
    { id: 'rw',  position: 'FWD', label: 'ED', x: 82, y: 76 },
  ],
  '4-4-2': [
    { id: 'gk',  position: 'GK',  label: 'PT', x: 50, y: 8 },
    { id: 'lb',  position: 'DEF', label: 'LI', x: 14, y: 26 },
    { id: 'cb1', position: 'DEF', label: 'DC', x: 36, y: 24 },
    { id: 'cb2', position: 'DEF', label: 'DC', x: 64, y: 24 },
    { id: 'rb',  position: 'DEF', label: 'LD', x: 86, y: 26 },
    { id: 'lm',  position: 'MID', label: 'MI', x: 14, y: 52 },
    { id: 'cm1', position: 'MID', label: 'MC', x: 36, y: 50 },
    { id: 'cm2', position: 'MID', label: 'MC', x: 64, y: 50 },
    { id: 'rm',  position: 'MID', label: 'MD', x: 86, y: 52 },
    { id: 'st1', position: 'FWD', label: 'DC', x: 36, y: 80 },
    { id: 'st2', position: 'FWD', label: 'DC', x: 64, y: 80 },
  ],
  '3-5-2': [
    { id: 'gk',  position: 'GK',  label: 'PT', x: 50, y: 8 },
    { id: 'cb1', position: 'DEF', label: 'DC', x: 24, y: 24 },
    { id: 'cb2', position: 'DEF', label: 'DC', x: 50, y: 22 },
    { id: 'cb3', position: 'DEF', label: 'DC', x: 76, y: 24 },
    { id: 'lwb', position: 'MID', label: 'CI', x: 10, y: 48 },
    { id: 'cm1', position: 'MID', label: 'MC', x: 32, y: 50 },
    { id: 'cm2', position: 'MID', label: 'MCO', x: 50, y: 56 },
    { id: 'cm3', position: 'MID', label: 'MC', x: 68, y: 50 },
    { id: 'rwb', position: 'MID', label: 'CD', x: 90, y: 48 },
    { id: 'st1', position: 'FWD', label: 'DC', x: 36, y: 82 },
    { id: 'st2', position: 'FWD', label: 'DC', x: 64, y: 82 },
  ],
  '4-2-3-1': [
    { id: 'gk',  position: 'GK',  label: 'PT', x: 50, y: 8 },
    { id: 'lb',  position: 'DEF', label: 'LI', x: 14, y: 26 },
    { id: 'cb1', position: 'DEF', label: 'DC', x: 36, y: 24 },
    { id: 'cb2', position: 'DEF', label: 'DC', x: 64, y: 24 },
    { id: 'rb',  position: 'DEF', label: 'LD', x: 86, y: 26 },
    { id: 'dm1', position: 'MID', label: 'MCD', x: 36, y: 44 },
    { id: 'dm2', position: 'MID', label: 'MCD', x: 64, y: 44 },
    { id: 'lam', position: 'MID', label: 'EI', x: 16, y: 66 },
    { id: 'cam', position: 'MID', label: 'MCO', x: 50, y: 64 },
    { id: 'ram', position: 'MID', label: 'ED', x: 84, y: 66 },
    { id: 'st',  position: 'FWD', label: 'DC', x: 50, y: 84 },
  ],
}

export const FORMATION_LIST: FormationId[] = ['4-3-3', '4-4-2', '3-5-2', '4-2-3-1']
