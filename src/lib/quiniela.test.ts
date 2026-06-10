import { describe, it, expect } from 'vitest'
import { nameMatch, scorePicks, type SavedPick, type MatchResult } from './quiniela'

// ─────────────────────────────────────────────────────────────────────────────
// nameMatch — empareja resultado↔pick por nombre de equipo. Es scoring crítico:
// un falso positivo casa el resultado equivocado (puntúa mal); un falso negativo
// deja un pick legítimo sin puntuar. El emparejado es por PALABRA COMPLETA tras
// resolver alias + normalizar (acentos/puntuación/sufijos).
// ─────────────────────────────────────────────────────────────────────────────

describe('nameMatch — variantes legítimas SÍ casan', () => {
  it('igualdad exacta', () => {
    expect(nameMatch('Real Madrid', 'Real Madrid')).toBe(true)
  })
  it('mayúsculas y acentos son indiferentes', () => {
    expect(nameMatch('atlético madrid', 'Atletico Madrid')).toBe(true)
  })
  it('alias de club (PSG ↔ Paris Saint-Germain) — antes fallaba por el guion', () => {
    expect(nameMatch('PSG', 'Paris Saint-Germain')).toBe(true)
  })
  it('alias con guion en ambos lados', () => {
    expect(nameMatch('Paris', 'Paris Saint-Germain')).toBe(true)
  })
  it('alias "Atlético de Madrid" ↔ "Atletico Madrid"', () => {
    expect(nameMatch('Atlético de Madrid', 'Atletico Madrid')).toBe(true)
  })
  it('sufijo FC/CF/United/AFC (palabra completa añadida)', () => {
    expect(nameMatch('Leeds', 'Leeds United')).toBe(true)
    expect(nameMatch('Bournemouth', 'AFC Bournemouth')).toBe(true)
    expect(nameMatch('Real Madrid CF', 'Real Madrid')).toBe(true)
  })
  it('"Real Betis" ↔ "Real Betis Balompié"', () => {
    expect(nameMatch('Real Betis', 'Real Betis Balompié')).toBe(true)
  })
  it('"Brighton" ↔ "Brighton & Hove Albion" (el & se cae al normalizar)', () => {
    expect(nameMatch('Brighton', 'Brighton & Hove Albion')).toBe(true)
  })
  it('nombre corto popular ↔ canónico ("Madrid" ↔ "Real Madrid")', () => {
    expect(nameMatch('Madrid', 'Real Madrid')).toBe(true)
  })
})

describe('nameMatch — falsos positivos de subcadena ELIMINADOS', () => {
  it('"US"/"USA" NO casa con "Australia"', () => {
    expect(nameMatch('US', 'Australia')).toBe(false)
    expect(nameMatch('USA', 'Australia')).toBe(false)
  })
  it('"Mali" NO casa con "Somalia"', () => {
    expect(nameMatch('Mali', 'Somalia')).toBe(false)
  })
  it('"Iran" NO casa con "Ireland" por compartir letras', () => {
    expect(nameMatch('Iran', 'Ireland')).toBe(false)
  })
})

describe('nameMatch — equipos distintos que comparten una palabra NO casan', () => {
  it('"Real Madrid" ≠ "Real Sociedad"', () => {
    expect(nameMatch('Real Madrid', 'Real Sociedad')).toBe(false)
  })
  it('"Manchester City" ≠ "Manchester United"', () => {
    expect(nameMatch('Manchester City', 'Manchester United')).toBe(false)
  })
  it('"Inter Milan" ≠ "Inter Miami"', () => {
    expect(nameMatch('Inter Milan', 'Inter Miami')).toBe(false)
  })
  it('"Sporting Braga" ≠ "Sporting CP"', () => {
    expect(nameMatch('Sporting Braga', 'Sporting CP')).toBe(false)
  })
})

describe('nameMatch — degenerados', () => {
  it('cadena vacía nunca casa', () => {
    expect(nameMatch('', 'Real Madrid')).toBe(false)
    expect(nameMatch('Real Madrid', '')).toBe(false)
  })
  it('solo puntuación normaliza a vacío → no casa', () => {
    expect(nameMatch('--', 'Real Madrid')).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Integración: scorePicks empareja el resultado correcto y NO un señuelo.
// Garantiza que el endurecimiento de nameMatch no rompe el scoring real.
// ─────────────────────────────────────────────────────────────────────────────

const pick = (home: string, away: string, p: SavedPick['pick']): SavedPick => ({ home, away, pick: p })
const res = (home: string, away: string, hg: number, ag: number): MatchResult => ({
  home, away, homeGoals: hg, awayGoals: ag, outcome: hg > ag ? '1' : hg < ag ? '2' : 'X',
})

describe('scorePicks — empareja el resultado correcto', () => {
  it('casa pese a sufijo "FC" en el resultado y puntúa el acierto', () => {
    const bd = scorePicks(
      [pick('Real Madrid', 'Barcelona', '1')],
      [res('Real Madrid', 'FC Barcelona', 2, 1)],
    )
    expect(bd.hits).toBe(1)
    expect(bd.perPick[0].hit).toBe(true)
  })

  it('NO casa un señuelo de subcadena (Mali vs Somalia) → pick sin resultado, 0 aciertos', () => {
    const bd = scorePicks(
      [pick('Mali', 'Spain', '1')],
      [res('Somalia', 'Spain', 1, 0)],
    )
    expect(bd.hits).toBe(0)
    expect(bd.perPick[0].hit).toBe(false)
    expect(bd.perPick[0].points).toBe(0)
  })

  it('elige el partido correcto cuando hay varios resultados', () => {
    const bd = scorePicks(
      [pick('Atlético de Madrid', 'Sevilla', '2')],
      [
        res('Real Madrid', 'Getafe', 3, 0),
        res('Atletico Madrid', 'Sevilla FC', 0, 1), // outcome '2' → acierto
      ],
    )
    expect(bd.perPick[0].hit).toBe(true)
    expect(bd.hits).toBe(1)
  })
})
