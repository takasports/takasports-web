import { describe, it, expect, beforeEach } from 'vitest'
import {
  readGuestPicks, saveGuestPick, clearGuestPicks, pruneGuestPicks, toPredMap,
} from './guest-picks'

const KEY = 'taka:guestPicks:v1'

// La suite corre en `node` (sin jsdom instalado), así que se monta el mínimo
// que el módulo mira: `window` para sus guardas de SSR y un localStorage en
// memoria. Se prefiere esto a meter jsdom solo por un fichero — cambiaría el
// entorno de los otros 900 tests.
const mem = new Map<string, string>()
const storage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => { mem.set(k, String(v)) },
  removeItem: (k: string) => { mem.delete(k) },
  clear: () => { mem.clear() },
}
Object.assign(globalThis, { window: globalThis, localStorage: storage })

beforeEach(() => { mem.clear() })

describe('picks de invitado', () => {
  it('guarda y devuelve un pick', () => {
    saveGuestPick('ev1', '1', null)
    expect(readGuestPicks()).toEqual({ ev1: { pick: '1' } })
  })

  it('el segundo pick sobre el mismo partido reemplaza al primero', () => {
    // Cambiar de opinión es lo normal mientras se rellena la Jornada.
    saveGuestPick('ev1', '1', null)
    saveGuestPick('ev1', '2', null)
    expect(readGuestPicks().ev1.pick).toBe('2')
  })

  it('guarda también la apuesta al marcador', () => {
    saveGuestPick('ev1', '1', { home: 2, away: 1 })
    expect(readGuestPicks().ev1).toEqual({ pick: '1', exactScore: { home: 2, away: 1 } })
  })

  it('quitar la apuesta al marcador no arrastra el marcador viejo', () => {
    saveGuestPick('ev1', '1', { home: 2, away: 1 })
    saveGuestPick('ev1', '1', null)
    expect(readGuestPicks().ev1).toEqual({ pick: '1' })
  })

  it('sobrevive a un almacén corrupto en vez de tumbar la pantalla', () => {
    // Safari en privado y las cuotas llenas producen cosas así.
    localStorage.setItem(KEY, '{esto no es json')
    expect(readGuestPicks()).toEqual({})
    saveGuestPick('ev1', 'X', null)
    expect(readGuestPicks().ev1.pick).toBe('X')
  })

  it('ignora un almacén con forma inesperada', () => {
    localStorage.setItem(KEY, '["array", "no", "objeto"]')
    expect(readGuestPicks()).toEqual({})
  })

  it('clear lo deja vacío', () => {
    saveGuestPick('ev1', '1', null)
    clearGuestPicks()
    expect(readGuestPicks()).toEqual({})
  })
})

describe('poda contra la Jornada visible', () => {
  it('tira los partidos que ya no están', () => {
    // Sin esto el almacén crece temporada tras temporada y la barra de
    // invitado cuenta picks de partidos que ya no existen.
    saveGuestPick('viejo', '1', null)
    saveGuestPick('actual', '2', null)
    const quedan = pruneGuestPicks(new Set(['actual']))
    expect(Object.keys(quedan)).toEqual(['actual'])
    expect(Object.keys(readGuestPicks())).toEqual(['actual'])
  })

  it('no toca nada cuando todo sigue vigente', () => {
    saveGuestPick('a', '1', null)
    saveGuestPick('b', 'X', null)
    expect(Object.keys(pruneGuestPicks(new Set(['a', 'b']))).sort()).toEqual(['a', 'b'])
  })
})

describe('toPredMap', () => {
  it('da a los picks locales la MISMA forma que los del servidor', () => {
    // Es lo que permite que las tarjetas, el contador de la Jornada y el
    // bloque de marcador exacto no tengan que saber si hay sesión.
    saveGuestPick('ev1', '1', { home: 3, away: 0 })
    expect(toPredMap(readGuestPicks())).toEqual({
      ev1: {
        event_id: 'ev1',
        prediction: { pick: '1', exactScore: { home: 3, away: 0 } },
        points_awarded: null,
        is_correct: null,
      },
    })
  })

  it('un invitado no tiene puntos ni aciertos', () => {
    saveGuestPick('ev1', '2', null)
    const row = toPredMap(readGuestPicks()).ev1
    expect(row.points_awarded).toBeNull()
    expect(row.is_correct).toBeNull()
  })
})

describe('capitán de invitado', () => {
  it('solo hay uno: marcarlo se lo quita al anterior', () => {
    saveGuestPick('a', '1', null, true)
    saveGuestPick('b', '2', null, true)
    const store = readGuestPicks()
    expect(store.a.captain).toBeUndefined()
    expect(store.b.captain).toBe(true)
  })

  it('cambiar de opinión en el pick NO borra el ×2', () => {
    // El cliente reenvía la predicción entera al cambiar de pick; sin conservar
    // el capitán, un simple cambio de opinión te lo quitaba sin avisar.
    saveGuestPick('a', '1', null, true)
    saveGuestPick('a', 'X', null)
    expect(readGuestPicks().a).toEqual({ pick: 'X', captain: true })
  })

  it('se puede retirar explícitamente', () => {
    saveGuestPick('a', '1', null, true)
    saveGuestPick('a', '1', null, false)
    expect(readGuestPicks().a.captain).toBeUndefined()
  })

  it('viaja a PredMap con la forma del servidor', () => {
    saveGuestPick('a', '1', { home: 2, away: 0 }, true)
    expect(toPredMap(readGuestPicks()).a.prediction).toEqual({
      pick: '1', exactScore: { home: 2, away: 0 }, captain: true,
    })
  })
})
