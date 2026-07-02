import { describe, it, expect } from 'vitest'
import { getClientIp } from './rate-limit'

// ─────────────────────────────────────────────────────────────────────────────
// getClientIp NO debe fiarse del primer valor de x-forwarded-for (manipulable):
// un atacante que rote una IP falsa a la izquierda evadiría el rate-limit por IP.
// Fuente de confianza en Vercel: x-real-ip, o el ÚLTIMO valor de x-forwarded-for.
// ─────────────────────────────────────────────────────────────────────────────

const reqWith = (headers: Record<string, string>) =>
  new Request('https://takasportsmedia.com/api/x', { headers })

describe('getClientIp — resistencia a spoofing', () => {
  it('prefiere x-real-ip (fijado por Vercel) aunque el XFF venga falseado', () => {
    const req = reqWith({
      'x-forwarded-for': '1.2.3.4, 66.66.66.66', // 1.2.3.4 = spoof del cliente
      'x-real-ip': '203.0.113.7',                // IP real de Vercel
    })
    expect(getClientIp(req)).toBe('203.0.113.7')
  })

  it('sin x-real-ip usa el ÚLTIMO valor del XFF (el que añade Vercel), no el primero', () => {
    const req = reqWith({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8, 203.0.113.7' })
    expect(getClientIp(req)).toBe('203.0.113.7')
  })

  it('el atacante NO puede cambiar la clave rotando el primer valor del XFF', () => {
    // Misma IP real (última) + primer valor rotado en cada intento → misma key.
    const a = getClientIp(reqWith({ 'x-forwarded-for': 'aaa.aaa.aaa.aaa, 203.0.113.7' }))
    const b = getClientIp(reqWith({ 'x-forwarded-for': 'bbb.bbb.bbb.bbb, 203.0.113.7' }))
    const c = getClientIp(reqWith({ 'x-forwarded-for': '9.9.9.9, 8.8.8.8, 203.0.113.7' }))
    expect(a).toBe('203.0.113.7')
    expect(b).toBe('203.0.113.7')
    expect(c).toBe('203.0.113.7')
  })

  it('tráfico honesto (un solo valor) no cambia de comportamiento', () => {
    expect(getClientIp(reqWith({ 'x-forwarded-for': '203.0.113.7' }))).toBe('203.0.113.7')
    expect(getClientIp(reqWith({ 'x-real-ip': '203.0.113.7' }))).toBe('203.0.113.7')
  })

  it('recorta espacios y descarta entradas vacías', () => {
    expect(getClientIp(reqWith({ 'x-real-ip': '  203.0.113.7  ' }))).toBe('203.0.113.7')
    expect(getClientIp(reqWith({ 'x-forwarded-for': '1.2.3.4, , 203.0.113.7 ,' }))).toBe('203.0.113.7')
  })

  it('sin cabeceras fiables devuelve "unknown" (cubo compartido, conservador)', () => {
    expect(getClientIp(reqWith({}))).toBe('unknown')
    expect(getClientIp(reqWith({ 'x-forwarded-for': '   ' }))).toBe('unknown')
  })
})
