import { describe, it, expect } from 'vitest'
import {
  splitEspnType, normalizeScoringType, commentaryLabelFor, SOCCER_STAT_ORDER, SOCCER_LABELS,
} from './espn-soccer'

// Cadenas REALES observadas en el summary de ESPN (verificadas sobre 28 partidos):
// goal, goal---header, goal---volley, goal---free-kick, own-goal, penalty---scored,
// penalty---saved, yellow-card, red-card, var---referee-decision-cancelled, etc.

describe('splitEspnType', () => {
  it('separa base y matiz por "---"', () => {
    expect(splitEspnType('goal---header')).toEqual({ base: 'goal', qualifier: 'header' })
    expect(splitEspnType('penalty---scored')).toEqual({ base: 'penalty', qualifier: 'scored' })
    expect(splitEspnType('var---referee-decision-cancelled')).toEqual({ base: 'var', qualifier: 'referee-decision-cancelled' })
  })
  it('sin sufijo deja qualifier indefinido', () => {
    expect(splitEspnType('goal')).toEqual({ base: 'goal' })
    expect(splitEspnType('yellow-card')).toEqual({ base: 'yellow-card' })
  })
  it('tolera vacío/nulo', () => {
    expect(splitEspnType('')).toEqual({ base: '' })
    expect(splitEspnType(undefined)).toEqual({ base: '' })
    expect(splitEspnType(null)).toEqual({ base: '' })
  })
})

describe('normalizeScoringType — EL BUG: goles de cabeza/volea/penalti ya NO se pierden', () => {
  it('gol normal', () => {
    expect(normalizeScoringType('goal')).toEqual({ type: 'goal', detail: undefined })
  })
  it('gol de cabeza (antes se descartaba)', () => {
    expect(normalizeScoringType('goal---header')).toEqual({ type: 'goal', detail: 'De cabeza' })
  })
  it('gol de volea y de falta', () => {
    expect(normalizeScoringType('goal---volley')).toEqual({ type: 'goal', detail: 'De volea' })
    expect(normalizeScoringType('goal---free-kick')).toEqual({ type: 'goal', detail: 'De falta' })
  })
  it('gol con matiz desconocido sigue contando como gol', () => {
    expect(normalizeScoringType('goal---left-footed')).toEqual({ type: 'goal', detail: undefined })
  })
  it('penalti MARCADO = gol de penalti', () => {
    expect(normalizeScoringType('penalty---scored')).toEqual({ type: 'penalty' })
    expect(normalizeScoringType('penalty-goal')).toEqual({ type: 'penalty' })
  })
  it('penalti PARADO/FALLADO NO es gol (no debe colar como verde)', () => {
    expect(normalizeScoringType('penalty---saved')).toEqual({ type: 'penalty-missed', detail: 'Parado' })
    expect(normalizeScoringType('penalty---missed')).toEqual({ type: 'penalty-missed', detail: 'Fallado' })
  })
  it('gol en propia (con y sin guion)', () => {
    expect(normalizeScoringType('own-goal')).toEqual({ type: 'own-goal' })
    expect(normalizeScoringType('owngoal')).toEqual({ type: 'own-goal' })
  })
  it('tarjetas', () => {
    expect(normalizeScoringType('yellow-card')).toEqual({ type: 'yellow' })
    expect(normalizeScoringType('red-card')).toEqual({ type: 'red' })
    expect(normalizeScoringType('yellow-red-card')).toEqual({ type: 'red' })
  })
  it('ruido (saques, inicios, faltas) NO entra al resumen', () => {
    for (const t of ['kickoff', 'halftime', 'start-2nd-half', 'foul', 'corner-awarded', 'substitution', 'end-regular-time', '']) {
      expect(normalizeScoringType(t)).toBeNull()
    }
  })
})

describe('commentaryLabelFor — minuto a minuto en español, con matiz', () => {
  it('goles con matiz', () => {
    expect(commentaryLabelFor('goal')).toEqual({ label: 'Gol', type: 'goal', key: true })
    expect(commentaryLabelFor('goal---header')).toEqual({ label: 'Gol de cabeza', type: 'goal', key: true })
    expect(commentaryLabelFor('goal---volley')).toEqual({ label: 'Gol de volea', type: 'goal', key: true })
  })
  it('penaltis', () => {
    expect(commentaryLabelFor('penalty---scored')).toEqual({ label: 'Gol de penalti', type: 'penalty-goal', key: true })
    expect(commentaryLabelFor('penalty---saved')).toEqual({ label: 'Penalti parado', type: 'penalty-missed', key: true })
    expect(commentaryLabelFor('penalty---missed')).toEqual({ label: 'Penalti fallado', type: 'penalty-missed', key: true })
  })
  it('VAR (cualquier var---xxx)', () => {
    expect(commentaryLabelFor('var---referee-decision-cancelled')).toEqual({ label: 'Revisión VAR', type: 'var', key: true })
  })
  it('own-goal normaliza el tipo a own-goal', () => {
    expect(commentaryLabelFor('owngoal')).toEqual({ label: 'Gol en propia', type: 'own-goal', key: true })
  })
  it('eventos no-clave (falta, córner, tiro) se muestran sin resaltar', () => {
    expect(commentaryLabelFor('foul')).toEqual({ label: 'Falta', type: 'foul', key: false })
    expect(commentaryLabelFor('shot-on-target')).toEqual({ label: 'Tiro a puerta', type: 'shot-on-target', key: false })
    expect(commentaryLabelFor('corner-awarded')).toEqual({ label: 'Córner', type: 'corner-awarded', key: false })
  })
  it('marcas del partido', () => {
    expect(commentaryLabelFor('halftime')?.label).toBe('Descanso')
    expect(commentaryLabelFor('substitution')).toEqual({ label: 'Cambio', type: 'substitution', key: true })
  })
  it('ruido/desconocido se descarta (null)', () => {
    expect(commentaryLabelFor('noplay')).toBeNull()
    expect(commentaryLabelFor('throw-in')).toBeNull()
    expect(commentaryLabelFor('')).toBeNull()
  })
})

describe('config de estadísticas', () => {
  it('usa nombres REALES de ESPN (no los inexistentes fouls/corners)', () => {
    expect(SOCCER_STAT_ORDER).toContain('foulsCommitted')
    expect(SOCCER_STAT_ORDER).toContain('wonCorners')
    expect(SOCCER_STAT_ORDER).not.toContain('fouls')
    expect(SOCCER_STAT_ORDER).not.toContain('corners')
  })
  it('incluye las nuevas curadas (pase, entradas, intercepciones, despejes, centros)', () => {
    for (const k of ['passPct', 'totalTackles', 'interceptions', 'totalClearance', 'totalCrosses']) {
      expect(SOCCER_STAT_ORDER).toContain(k)
      expect(SOCCER_LABELS[k]).toBeTruthy()
    }
  })
  it('toda clave del orden tiene etiqueta en español', () => {
    for (const k of SOCCER_STAT_ORDER) expect(SOCCER_LABELS[k]).toBeTruthy()
  })
})
