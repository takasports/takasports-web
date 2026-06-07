import { describe, it, expect } from 'vitest'
import {
  QUESTIONS,
  getDailyQuestions,
  getPracticeQuestions,
  listCategories,
  type QuizCategory,
  type QuizSport,
  type QuizDifficulty,
} from './crackquiz-questions'

const CATEGORIES: QuizCategory[] = [
  'historia', 'records', 'mundiales', 'champions', 'jugadores', 'selecciones', 'clubes', 'reglas',
]
const SPORTS: QuizSport[] = [
  'football', 'basketball', 'tennis', 'motor', 'mma', 'golf', 'cycling', 'general',
]
const DIFFICULTIES: QuizDifficulty[] = [1, 2, 3]
const ROUND = 10 // QUESTIONS_PER_ROUND en crackquiz/page.tsx

describe('crackquiz · integridad estructural del banco', () => {
  it('cada pregunta tiene la forma correcta', () => {
    for (const q of QUESTIONS) {
      expect(typeof q.id, `id no es string`).toBe('string')
      expect(q.id.length, `${q.id}: id vacío`).toBeGreaterThan(0)
      expect(q.question.length, `${q.id}: pregunta demasiado corta`).toBeGreaterThan(5)
      expect(Array.isArray(q.options), `${q.id}: options no es array`).toBe(true)
      expect(q.options.length, `${q.id}: no tiene exactamente 4 opciones`).toBe(4)
      for (const o of q.options) {
        expect(typeof o, `${q.id}: opción no-string`).toBe('string')
        expect(o.trim().length, `${q.id}: opción vacía`).toBeGreaterThan(0)
      }
      expect(q.correctIndex, `${q.id}: correctIndex fuera de rango`).toBeGreaterThanOrEqual(0)
      expect(q.correctIndex, `${q.id}: correctIndex fuera de rango`).toBeLessThanOrEqual(3)
      expect(CATEGORIES, `${q.id}: categoría inválida (${q.category})`).toContain(q.category)
      expect(SPORTS, `${q.id}: deporte inválido (${q.sport})`).toContain(q.sport)
      expect(DIFFICULTIES, `${q.id}: dificultad inválida (${q.difficulty})`).toContain(q.difficulty)
    }
  })

  it('no hay opciones duplicadas dentro de una misma pregunta', () => {
    for (const q of QUESTIONS) {
      const uniq = new Set(q.options.map(o => o.trim().toLowerCase()))
      expect(uniq.size, `${q.id}: opciones repetidas → ${q.options.join(' | ')}`).toBe(4)
    }
  })

  it('los ids son únicos', () => {
    const seen = new Set<string>()
    for (const q of QUESTIONS) {
      expect(seen.has(q.id), `id duplicado: ${q.id}`).toBe(false)
      seen.add(q.id)
    }
  })

  it('no hay enunciados duplicados exactos', () => {
    const seen = new Map<string, string>()
    for (const q of QUESTIONS) {
      const key = q.question.trim().toLowerCase()
      const prev = seen.get(key)
      expect(prev, `enunciado duplicado: ${q.id} == ${prev}`).toBeUndefined()
      seen.set(key, q.id)
    }
  })
})

describe('crackquiz · tamaño y diversidad (objetivo 6A)', () => {
  it('el banco tiene al menos 300 preguntas', () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(300)
  })

  it('el fútbol ya no domina: < 60% del banco', () => {
    const football = QUESTIONS.filter(q => q.sport === 'football').length
    expect(football / QUESTIONS.length, `fútbol = ${football}/${QUESTIONS.length}`).toBeLessThan(0.6)
  })

  it('todos los deportes declarados están representados', () => {
    for (const s of SPORTS) {
      const n = QUESTIONS.filter(q => q.sport === s).length
      expect(n, `el deporte "${s}" no tiene preguntas`).toBeGreaterThan(0)
    }
  })

  it('hay suficientes preguntas de cada dificultad para componer la ronda diaria', () => {
    for (const d of DIFFICULTIES) {
      const n = QUESTIONS.filter(q => q.difficulty === d).length
      expect(n, `dificultad ${d} escasa (${n})`).toBeGreaterThanOrEqual(ROUND)
    }
  })

  it('listCategories devuelve solo categorías válidas y no vacías', () => {
    const cats = listCategories()
    expect(cats.length).toBeGreaterThan(0)
    for (const c of cats) expect(CATEGORIES).toContain(c)
  })
})

describe('crackquiz · selección diaria usa difficulty', () => {
  it('getDailyQuestions devuelve 10 preguntas únicas y deterministas', () => {
    const a = getDailyQuestions(ROUND)
    const b = getDailyQuestions(ROUND)
    expect(a.length).toBe(ROUND)
    expect(a.map(q => q.id)).toEqual(b.map(q => q.id)) // mismo día → misma ronda
    expect(new Set(a.map(q => q.id)).size).toBe(ROUND) // sin repetidos
  })

  it('la ronda diaria respeta la curva de dificultad ascendente', () => {
    const round = getDailyQuestions(ROUND)
    for (let i = 1; i < round.length; i++) {
      expect(
        round[i].difficulty >= round[i - 1].difficulty,
        `la dificultad baja en la posición ${i}`,
      ).toBe(true)
    }
  })

  it('la ronda diaria no es monotemática (fútbol acotado)', () => {
    const round = getDailyQuestions(ROUND)
    const football = round.filter(q => q.sport === 'football').length
    expect(football, `demasiado fútbol en la ronda (${football}/${ROUND})`).toBeLessThanOrEqual(6)
  })

  it('getPracticeQuestions filtra por categoría y ordena por dificultad', () => {
    const cat: QuizCategory = 'mundiales'
    const qs = getPracticeQuestions(ROUND, cat)
    expect(qs.length).toBeGreaterThan(0)
    for (const q of qs) expect(q.category).toBe(cat)
    for (let i = 1; i < qs.length; i++) {
      expect(qs[i].difficulty >= qs[i - 1].difficulty).toBe(true)
    }
  })
})

// Hechos puntuales: ancla el correctIndex al texto correcto. Cazan errores
// de "índice mal apuntado" (la clase de bug que tenía el banco: q011, q017,
// q024, q098…). Solo unos pocos centinelas de alto valor.
describe('crackquiz · centinelas de factualidad', () => {
  const EXPECTED: Record<string, string> = {
    q017: 'Messi',              // récord goles temporada LaLiga (50, 2011-12)
    q033: '16',                 // Copa América de Argentina
    q037: 'Taffarel',           // portero ante quien falló Baggio en 1994
    q098: '2009',               // primer Eurobasket de España
    q105: 'Novak Djokovic',     // 3 Slams en 2023
    fb016: 'Real Madrid',       // Champions 2024
    fb060: 'España',            // Eurocopa 2024
    fb084: 'Brasil',            // más Mundiales
    bk003: 'Boston Celtics',    // NBA 2024
    tn003: 'Novak Djokovic',    // récord masculino de Slams
    mt001: '7',                 // títulos F1 de Schumacher
  }
  for (const [id, answer] of Object.entries(EXPECTED)) {
    it(`${id} → "${answer}"`, () => {
      const q = QUESTIONS.find(x => x.id === id)
      expect(q, `falta la pregunta ${id}`).toBeTruthy()
      expect(q!.options[q!.correctIndex]).toBe(answer)
    })
  }
})
