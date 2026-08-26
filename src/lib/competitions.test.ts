import { describe, it, expect } from 'vitest'
import { getLiveLabel, getEventHighlightScore, highlightReason, getLeagueScore } from './competitions'
import { tennisRoundLabel } from './espn'

describe('getLiveLabel — estados terminales', () => {
  const TERMINALES = [
    'FT', 'FINAL', 'FINAL_PEN', 'FINAL_AET', 'POST_GAME', 'END_OF_REGULATION',
    'ABANDONED', 'WALKOVER', 'RETIRED', 'CANCELED', 'POSTPONED', 'SUSPENDED', 'FORFEIT',
  ]
  for (const s of TERMINALES) {
    it(`"${s}" → "Final" (nunca "EN VIVO")`, () => {
      expect(getLiveLabel(s, null)).toBe('Final')
      expect(getLiveLabel(s, 90)).toBe('Final')
    })
  }
})

describe('getLiveLabel — estados pre-partido', () => {
  for (const s of ['NS', 'STATUS_SCHEDULED', 'PRE_GAME', 'DELAYED']) {
    it(`"${s}" → "Próximo"`, () => {
      expect(getLiveLabel(s, null)).toBe('Próximo')
    })
  }
})

describe('getLiveLabel — estados en vivo (fútbol)', () => {
  it('HT → Descanso', () => {
    expect(getLiveLabel('HT', null)).toBe('Descanso')
  })
  it('1H con minuto → "23\'"', () => {
    expect(getLiveLabel('1H', 23)).toBe("23'")
  })
  it('1H sin minuto → "1T"', () => {
    expect(getLiveLabel('1H', null)).toBe('1T')
  })
  it('2H con minuto → "67\'"', () => {
    expect(getLiveLabel('2H', 67)).toBe("67'")
  })
  it('2H sin minuto → "2T"', () => {
    expect(getLiveLabel('2H', null)).toBe('2T')
  })
  it('OT con minuto → "Prórr. 95\'"', () => {
    expect(getLiveLabel('OT', 95)).toBe("Prórr. 95'")
  })
  it('OT sin minuto → "Prórroga"', () => {
    expect(getLiveLabel('OT', null)).toBe('Prórroga')
  })
})

describe('getLiveLabel — basket (Q-quarters)', () => {
  it('Q1 con elapsed → "Q1 · 8\'"', () => {
    expect(getLiveLabel('Q1', 8)).toBe("Q1 · 8'")
  })
  it('Q4 sin elapsed → "Q4"', () => {
    expect(getLiveLabel('Q4', null)).toBe('Q4')
  })
  it('INT → Intervalo', () => {
    expect(getLiveLabel('INT', null)).toBe('Intervalo')
  })
})

describe('getLiveLabel — tenis (sets ganados)', () => {
  it('LIVE 1-0 sets → "Set 2"', () => {
    expect(getLiveLabel('LIVE', null, { sport: 'tennis', homeScore: 1, awayScore: 0 })).toBe('Set 2')
  })
  it('LIVE 0-0 sets → "Set 1"', () => {
    expect(getLiveLabel('LIVE', null, { sport: 'tenis', homeScore: 0, awayScore: 0 })).toBe('Set 1')
  })
})

describe('getLiveLabel — fallback genérico', () => {
  it('LIVE con elapsed → "45\'"', () => {
    expect(getLiveLabel('LIVE', 45)).toBe("45'")
  })
  it('LIVE sin elapsed → "EN VIVO"', () => {
    // Este es el único caso donde el fallback "EN VIVO" es correcto —
    // status explícitamente LIVE sin tiempo y sin sport tenis.
    expect(getLiveLabel('LIVE', null)).toBe('EN VIVO')
  })
})


// ── Tabla de referencia del ranking de Destacados ───────────────────────────
// Estos MISMOS números están pinchados en la app
// (takasports-app/src/utils/__tests__/highlightScore.test.ts) contra el paquete
// @takasports/shared, que es un espejo A MANO de este fichero. Si alguien toca
// una liga o un boost en un lado y no en el otro, uno de los dos suites cae.
// Fue justo lo que pasó: el shared se quedó sin clásicos y sin pairBoost y la
// app llevaba meses eligiendo mal sus destacados.
export const SCORE_FIXTURES: {
  name: string
  args: Parameters<typeof getEventHighlightScore>[0]
  score: number
  reason: string | null
}[] = [
  { name: 'Clásico de LaLiga', args: { comp: 'LaLiga', home: 'Real Madrid', away: 'Barcelona' }, score: 21, reason: 'Clásico' },
  { name: 'Derbi sevillano', args: { comp: 'LaLiga', home: 'Sevilla', away: 'Real Betis' }, score: 17, reason: 'Derbi' },
  { name: 'LaLiga de media tabla', args: { comp: 'LaLiga', home: 'Getafe', away: 'Alavés' }, score: 11, reason: null },
  { name: 'Cartelazo de Premier', args: { comp: 'Premier League', home: 'Manchester City', away: 'Arsenal' }, score: 15, reason: 'Cartelazo' },
  { name: 'Final de Champions', args: { comp: 'Champions', home: 'X', away: 'Y', stage: 'Final' }, score: 16, reason: 'Final' },
  { name: 'Europa League', args: { comp: 'Europa League', home: 'X', away: 'Y' }, score: 8, reason: null },
  { name: 'Supercopa de Europa', args: { comp: 'UEFA Super Cup', home: 'X', away: 'Y' }, score: 10, reason: null },
  { name: 'Conference League', args: { comp: 'Conference League', home: 'X', away: 'Y' }, score: 6, reason: null },
  { name: 'Carabao Cup', args: { comp: 'Carabao Cup', home: 'X', away: 'Y' }, score: 5, reason: null },
  { name: 'Amistoso de selecciones', args: { comp: 'Amistoso', home: 'España', away: 'Brasil' }, score: 9, reason: 'Selección' },
  { name: 'Previa de Grand Slam', args: { comp: 'US Open', home: 'Q1', away: 'Q2', stage: 'Previa' }, score: 7, reason: null },
  { name: 'Cuadro final de Grand Slam', args: { comp: 'US Open', home: 'Q1', away: 'Q2' }, score: 11, reason: null },
  { name: 'Cuartos de Grand Slam', args: { comp: 'US Open', home: 'Alcaraz', away: 'Q2', stage: 'Cuartos' }, score: 15, reason: 'Cartelazo' },
  { name: 'Segunda inglesa', args: { comp: 'Championship', home: 'Millwall', away: 'Norwich City' }, score: 5, reason: null },
]

describe('getEventHighlightScore — tabla compartida con la app', () => {
  for (const f of SCORE_FIXTURES) {
    it(`${f.name} → ${f.score}`, () => {
      expect(getEventHighlightScore(f.args)).toBe(f.score)
    })
  }
  it('un partidazo pesa más que "juega un grande"', () => {
    const partidazo = getEventHighlightScore({ comp: 'Premier League', home: 'Manchester City', away: 'Arsenal' })
    const grandeSolo = getEventHighlightScore({ comp: 'Premier League', home: 'Manchester City', away: 'Burnley' })
    expect(partidazo).toBeGreaterThan(grandeSolo)
  })
})

describe('highlightReason — tabla compartida con la app', () => {
  for (const f of SCORE_FIXTURES) {
    it(`${f.name} → ${f.reason ?? 'sin badge'}`, () => {
      expect(highlightReason(f.args)).toBe(f.reason)
    })
  }
})


// Colisiones de SUBCADENA en getLeagueScore. La tabla se recorre en orden y gana
// la primera clave contenida, así que una competición cuyo nombre CONTIENE el de
// otra hereda su nota si va después. Encontradas el 26/08/2026 midiendo el feed
// real: la Championship inglesa valía 12 (como la Champions), y LaLiga 2,
// la Premiership y el Premier Padel valían 11 (como LaLiga y la Premier).
describe('getLeagueScore — colisiones de subcadena', () => {
  const CASOS: [string, number][] = [
    ['Champions', 12],
    ['UEFA Champions League', 12],
    ['Championship', 5],
    ['Premier', 11],
    ['Premier League', 11],
    ['Premiership', 6],
    ['Premier Padel', 6],
    ['LaLiga', 11],
    ['LaLiga 2', 5],
  ]
  for (const [comp, score] of CASOS) {
    it(`"${comp}" → ${score}`, () => {
      expect(getLeagueScore(comp)).toBe(score)
    })
  }
})


describe('tennisRoundLabel — la ronda de ESPN, en español', () => {
  const CASOS: [string, string | undefined][] = [
    ['Qualifying 1st Round', 'Previa'],
    ['Qualifying Final Round', 'Previa'], // contiene "final": la previa manda
    ['1st Round', '1ª ronda'],
    ['3rd Round', '3ª ronda'],
    ['Round of 16', 'Octavos'],
    ['Quarterfinals', 'Cuartos'],
    ['Semifinals', 'Semifinal'],
    ['Final', 'Final'],
    ['', undefined],
  ]
  for (const [entrada, salida] of CASOS) {
    it(`"${entrada}" → ${salida ?? 'sin ronda'}`, () => {
      expect(tennisRoundLabel(entrada)).toBe(salida)
    })
  }
})
