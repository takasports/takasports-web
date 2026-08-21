import { describe, it, expect } from 'vitest'
import { groupChannel, rowChannel } from './comp-group-channel'

const ev = (broadcast?: string) => ({ broadcast })

describe('groupChannel', () => {
  it('toda la liga en el mismo canal → sube a la cabecera', () => {
    expect(groupChannel([ev('DAZN'), ev('DAZN'), ev('DAZN')])).toBe('DAZN')
  })

  it('liga repartida entre canales → cada fila conserva el suyo', () => {
    expect(groupChannel([ev('DAZN'), ev('Movistar+')])).toBeNull()
  })

  it('un grupo de UNO no cuenta: subirlo no ahorra y deja la fila desnuda', () => {
    expect(groupChannel([ev('DAZN')])).toBeNull()
  })

  it('sin canal no hay nada que subir', () => {
    expect(groupChannel([ev(undefined), ev(undefined)])).toBeNull()
    expect(groupChannel([])).toBeNull()
  })

  it('si a UNO le falta el canal, no se generaliza al grupo', () => {
    // Anunciar "DAZN" arriba dejaría al que no lo tiene diciendo algo falso.
    expect(groupChannel([ev('DAZN'), ev(undefined), ev('DAZN')])).toBeNull()
  })
})

describe('rowChannel', () => {
  it('no repite el canal que ya anuncia su liga', () => {
    expect(rowChannel('DAZN', 'DAZN')).toBeUndefined()
  })
  it('sí lo pinta cuando difiere del de la liga', () => {
    expect(rowChannel('Movistar+', 'DAZN')).toBe('Movistar+')
  })
  it('sin canal de grupo, la fila lo pinta como siempre', () => {
    expect(rowChannel('DAZN', null)).toBe('DAZN')
  })
  it('sin canal propio no inventa ninguno', () => {
    expect(rowChannel(undefined, 'DAZN')).toBeUndefined()
  })
})
