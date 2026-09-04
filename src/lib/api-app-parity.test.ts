// ─────────────────────────────────────────────────────────────────────────────
// La app no importa los tipos de la API: los REESCRIBE a mano en cada pantalla.
// Y al copiarlos ha ido perdiendo campos en silencio — el compilador no se queja,
// porque un tipo con menos campos sigue encajando; simplemente la app deja de
// saber que el dato existe y la función desaparece solo en el móvil.
//
// Ya pasó con los ids de jugador de la ficha de partido. Y volvió a pasar: al
// escribir esta prueba, `BasketballLeaderRow` no declaraba `playerId`, así que en
// la web podías tocar a Jokić y abrir su ficha, y en la app no.
//
// Esta prueba compara los dos lados y falla cuando la app pierde un campo. No
// arregla la duplicación —eso es mover los tipos a takasports-shared, que obliga
// a re-empaquetar el tarball— pero corta la sangría, que es lo que dolía.
//
// Se salta sola si no está la carpeta de la app (CI de la web, un worktree
// suelto): no debe tumbar el build de la web por algo del repo de al lado.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const RAIZ = resolve(__dirname, '../..')
const API_PARTIDO = resolve(RAIZ, 'src/app/api/match/[ref]/route.ts')
const APP_PARTIDO = resolve(RAIZ, '../takasports-app/app/partido/[id].tsx')

/**
 * Campos de PRIMER NIVEL de cada interface del fichero.
 *
 * Lo de «primer nivel» no es un detalle: los sub-objetos (`soccer: { ... }`) van
 * en una sola línea en la app y en varias en la web, así que contarlos sueltos
 * daba seis diferencias falsas. Se cuentan por profundidad de llaves.
 */
function camposPorInterface(codigo: string): Map<string, Set<string>> {
  const fuera = codigo.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
  const out = new Map<string, Set<string>>()
  const re = /interface\s+(\w+)\s*\{/g
  let m: RegExpExecArray | null

  while ((m = re.exec(fuera)) !== null) {
    const campos = new Set<string>()
    let i = m.index + m[0].length
    let prof = 1
    let inicioLinea = i

    while (i < fuera.length && prof > 0) {
      const c = fuera[i]
      if (c === '{') prof++
      else if (c === '}') prof--
      else if (c === '\n' || c === ';') {
        if (prof === 1) {
          const campo = /^\s*(\w+)\s*\??\s*:/.exec(fuera.slice(inicioLinea, i))
          if (campo) campos.add(campo[1])
        }
        inicioLinea = i + 1
      }
      i++
    }
    out.set(m[1], campos)
  }
  return out
}

/** Interfaces que la app renombró. Sin esta tabla la comparación no las ve. */
const RENOMBRADAS: Record<string, string> = {
  MatchDetail: 'MatchData',
  LineupPlayer: 'MatchPlayer',
  TeamLineup: 'MatchLineup',
  BasketballLeader: 'BasketballLeaderRow',
  TennisSet: 'TennisSets',
}

// ⚠️ `describe.skipIf` salta las PRUEBAS, pero el cuerpo del describe se ejecuta
// igual al recolectar. Leer ahí el fichero de la app reventaba el fichero entero
// donde esa carpeta no existe — es decir, en Vercel, que solo clona este repo.
// Por eso la lectura va detrás del `hayApp` y no dentro del describe.
const hayApp = existsSync(APP_PARTIDO)
const api = camposPorInterface(readFileSync(API_PARTIDO, 'utf8'))
const app = hayApp
  ? camposPorInterface(readFileSync(APP_PARTIDO, 'utf8'))
  : new Map<string, Set<string>>()

const pares = [...api.keys()]
  .map((nombre) => [nombre, RENOMBRADAS[nombre] ?? nombre] as const)
  .filter(([, enApp]) => app.has(enApp))

describe('paridad de tipos entre la API y la app', () => {
  // Esta prueba corre SIEMPRE, también sin la carpeta de la app. Además de
  // valer por sí misma, mantiene el fichero con al menos una prueba: un fichero
  // que se salta entero es un fichero que falla.
  it('el analizador entiende los tipos de la API de este repo', () => {
    expect(api.size).toBeGreaterThan(8)
    expect(api.get('BasketballLeader')?.has('playerId')).toBe(true)
  })

  describe.skipIf(!hayApp)('la ficha de partido de la app no pierde campos', () => {
    it('se están comparando interfaces de verdad', () => {
      // Si un cambio de formato rompiera el analizador, la comparación pasaría
      // vacía y todo esto quedaría de adorno. Esto lo impide.
      expect(app.size).toBeGreaterThan(8)
      expect(pares.length).toBeGreaterThanOrEqual(10)
    })

    it.each(pares)('%s → app.%s declara todos los campos', (enApi, enApp) => {
      const faltan = [...api.get(enApi)!].filter((c) => !app.get(enApp)!.has(c))
      expect(faltan, `la app no declara: ${faltan.join(', ')}`).toEqual([])
    })
  })
})
