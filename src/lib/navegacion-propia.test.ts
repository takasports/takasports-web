import { describe, expect, it } from 'vitest'
import { esNavegacionPropia } from './navegacion-propia'

const h = (o: Record<string, string>) => new Headers(o)

describe('esNavegacionPropia', () => {
  it('acepta un clic dentro de la web', () => {
    expect(esNavegacionPropia(h({ 'sec-fetch-site': 'same-origin' }))).toBe(true)
  })
  it('acepta un referer propio aunque falte Sec-Fetch-Site', () => {
    expect(esNavegacionPropia(h({ referer: 'https://www.takasportsmedia.com/jugador/x-1' }))).toBe(true)
    expect(esNavegacionPropia(h({ referer: 'https://takasportsmedia.com/' }))).toBe(true)
    expect(esNavegacionPropia(h({ referer: 'http://localhost:3000/comparar' }))).toBe(true)
  })
  it('rechaza la entrada directa o desde fuera', () => {
    expect(esNavegacionPropia(h({}))).toBe(false)
    expect(esNavegacionPropia(h({ 'sec-fetch-site': 'none' }))).toBe(false)
    expect(esNavegacionPropia(h({ 'sec-fetch-site': 'cross-site', referer: 'https://google.com/' }))).toBe(false)
  })
  it('no se deja engañar por dominios que solo contienen el nombre', () => {
    expect(esNavegacionPropia(h({ referer: 'https://takasportsmedia.com.evil.net/' }))).toBe(false)
    expect(esNavegacionPropia(h({ referer: 'https://nottakasportsmedia.com/' }))).toBe(false)
    expect(esNavegacionPropia(h({ referer: 'no es una url' }))).toBe(false)
  })
})
