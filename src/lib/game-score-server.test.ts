import { describe, it, expect } from 'vitest'
import { deriveGameScore } from './game-score-server'
import { composeDailyRound } from './crackquiz-day'
import { getDailyPuzzle, getValidAnswers } from './takagrid-puzzles'
import { getChallengeForWeek } from './mionce-challenges'
import { FORMATIONS } from './mionce-formations'
import { PLAYERS_DEDUP, playerClubs } from './players-catalog'
import { CRACKQUIZ, SCORE_CAP } from './game-scoring'

// Sin SUPABASE_SERVICE_ROLE_KEY en el entorno de test, adminSupabase() es null
// → no hay featured ni sopa featured: la ronda/puzzle resueltos son los
// deterministas, que es justo lo que queremos fijar aquí.

const DAY = '2026-08-12'
const WEEK = '2026-W33'

describe('deriveGameScore · crackquiz', () => {
  const round = composeDailyRound(DAY, null)

  it('recalcula la ronda desde las respuestas y no se fía del score enviado', async () => {
    const answers = round.questions.map(q => ({
      qId: q.id,
      selected: q.correctIndex,
      secondsLeft: CRACKQUIZ.QUESTION_TIME,
    }))
    const r = await deriveGameScore('crackquiz', DAY, { answers }, 1)
    expect(r.source).toBe('server')
    expect(r.score).toBe(185) // ronda perfecta instantánea
  })

  it('ignora un score inflado si las respuestas dicen otra cosa', async () => {
    const answers = round.questions.map(q => ({
      qId: q.id,
      selected: (q.correctIndex + 1) % 4, // todas mal
      secondsLeft: CRACKQUIZ.QUESTION_TIME,
    }))
    const r = await deriveGameScore('crackquiz', DAY, { answers }, 9999)
    expect(r.score).toBe(0)
  })

  it('descarta preguntas que no son del set del día (antiinyección)', async () => {
    const answers = [
      { qId: 'no-existe-1', selected: 0, secondsLeft: 20 },
      { qId: 'no-existe-2', selected: 0, secondsLeft: 20 },
      { qId: round.questions[0].id, selected: round.questions[0].correctIndex, secondsLeft: 0 },
    ]
    const r = await deriveGameScore('crackquiz', DAY, { answers }, 500)
    expect(r.score).toBe(CRACKQUIZ.BASE_PTS) // solo cuenta la legítima, sin bonus
  })

  it('parte sin reloj (bundle viejo): respeta su score acotado al máximo posible', async () => {
    // Respuestas correctas pero sin `secondsLeft` — así lo mandaba el cliente
    // anterior a esta fase. Su score honesto debe sobrevivir…
    const answers = round.questions.slice(0, 3).map(q => ({ qId: q.id, selected: q.correctIndex }))
    const honest = await deriveGameScore('crackquiz', DAY, { answers }, 34)
    expect(honest.source).toBe('aggregate')
    expect(honest.score).toBe(34)

    // …pero uno inflado se corta en el techo real de esas mismas respuestas
    // (3 aciertos instantáneos = 15 + 16 + 17 = 48).
    const inflated = await deriveGameScore('crackquiz', DAY, { answers }, 9999)
    expect(inflated.score).toBe(48)
  })

  it('cliente antiguo sin detalle por pregunta: puntos base por acierto', async () => {
    const r = await deriveGameScore('crackquiz', DAY, { correct: 7, total: 10 }, 7)
    expect(r.source).toBe('aggregate')
    expect(r.score).toBe(70)
  })

  it('payload vacío → cae al score del cliente acotado por el techo', async () => {
    const r = await deriveGameScore('crackquiz', DAY, {}, 99999)
    expect(r.source).toBe('client')
    expect(r.score).toBe(SCORE_CAP.crackquiz)
  })
})

describe('deriveGameScore · takagrid', () => {
  it('revalida cada elección contra el puzzle del día', async () => {
    const { puzzle } = getDailyPuzzle(new Date(`${DAY}T12:00:00Z`))
    const valid = getValidAnswers(puzzle)
    const used = new Set<string>()
    const picks: (string | null)[] = []
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const p = valid[r][c].find(x => !used.has(x.id))
        if (p) used.add(p.id)
        picks.push(p?.id ?? null)
      }
    }
    const solvable = picks.filter(Boolean).length

    const res = await deriveGameScore('takagrid', DAY, { picks, hardMode: false }, 0)
    expect(res.source).toBe('server')
    expect(res.score).toBe(solvable * 10)

    const hard = await deriveGameScore('takagrid', DAY, { picks, hardMode: true }, 0)
    expect(hard.score).toBe(solvable * 20)
  })

  it('un jugador inválido en la celda no puntúa aunque el cliente diga 9/9', async () => {
    const picks = Array.from({ length: 9 }, () => 'jugador-que-no-existe')
    const r = await deriveGameScore('takagrid', DAY, { picks, solved: 9 }, 180)
    expect(r.score).toBe(0)
  })

  it('cliente antiguo (solved numérico) sigue puntuando', async () => {
    const r = await deriveGameScore('takagrid', DAY, { solved: 6 }, 60)
    expect(r.source).toBe('aggregate')
    expect(r.score).toBe(60)
  })
})

describe('deriveGameScore · mionce', () => {
  it('revalida posición y club de cada hueco del tablero de la semana', async () => {
    const challenge = getChallengeForWeek(WEEK)!
    const defs = FORMATIONS[challenge.recommendedFormation]
    const used = new Set<string>()
    const slots: Record<string, string> = {}
    for (const def of defs) {
      const tag = challenge.slotTags![def.id]
      const p = PLAYERS_DEDUP.find(
        x => !used.has(x.id) && x.position === def.position && tag.match(x),
      )
      if (p) { used.add(p.id); slots[def.id] = p.id }
    }
    const filled = Object.keys(slots).length
    expect(filled).toBeGreaterThan(0)

    const r = await deriveGameScore('mionce', WEEK, { slots }, 0)
    expect(r.source).toBe('server')
    expect(r.score).toBe(filled * 10)
  })

  it('un jugador que no jugó en ese club no puntúa ese hueco', async () => {
    const challenge = getChallengeForWeek(WEEK)!
    const defs = FORMATIONS[challenge.recommendedFormation]
    const gk = defs[0]
    const club = challenge.slotTags![gk.id].label
    const impostor = PLAYERS_DEDUP.find(
      p => p.position === gk.position && !playerClubs(p).includes(club),
    )!
    const r = await deriveGameScore('mionce', WEEK, { slots: { [gk.id]: impostor.id } }, 110)
    expect(r.score).toBe(0)
  })
})

describe('deriveGameScore · sopacracks', () => {
  it('paga por palabra encontrada, acotada al tamaño real de la sopa', async () => {
    const r = await deriveGameScore('sopacracks', WEEK, { found: 5, total: 9 }, 90)
    expect(r.score).toBe(50)
  })

  it('un `found` imposible se acota al nº de palabras de la semana', async () => {
    const r = await deriveGameScore('sopacracks', WEEK, { found: 99 }, 150)
    expect(r.score).toBeLessThanOrEqual(SCORE_CAP.sopacracks)
    expect(r.score).toBeLessThanOrEqual(14 * 10)
  })
})

describe('deriveGameScore · juegos fuera del alcance', () => {
  it('quiniela conserva su propio scoring', async () => {
    const r = await deriveGameScore('quiniela', 'laliga-J12', { anything: true }, 340)
    expect(r).toEqual({ score: 340, source: 'client' })
  })
})
