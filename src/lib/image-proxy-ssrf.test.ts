import { describe, it, expect } from 'vitest'
import { isPrivateIp, isSafeUrl, resolvePublicAddress, type LookupFn } from './image-proxy-ssrf'

// ─────────────────────────────────────────────────────────────────────────────
// Blindaje SSRF del proxy de imágenes: clasificación de IPs, URL segura y
// resolución que exige IPs públicas (anti DNS-rebinding).
// ─────────────────────────────────────────────────────────────────────────────

describe('isPrivateIp', () => {
  it('bloquea IPv4 privadas / reservadas / metadatos', () => {
    for (const ip of [
      '10.0.0.5', '127.0.0.1', '169.254.169.254', '172.16.0.1', '172.31.255.255',
      '192.168.1.1', '100.64.0.1', '0.0.0.0', '224.0.0.1', '240.0.0.1', '198.18.0.1',
    ]) {
      expect(isPrivateIp(ip), ip).toBe(true)
    }
  })
  it('permite IPv4 públicas', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '140.82.121.3', '100.63.255.255', '13.107.42.14']) {
      expect(isPrivateIp(ip), ip).toBe(false)
    }
  })
  it('bloquea IPv6 loopback / link-local / ULA / multicast / IPv4-mapped privada', () => {
    for (const ip of ['::1', '::', 'fe80::1', 'fc00::1', 'fd12::34', 'ff02::1', '::ffff:127.0.0.1', '64:ff9b::7f00:1']) {
      expect(isPrivateIp(ip), ip).toBe(true)
    }
  })
  it('permite IPv6 pública', () => {
    expect(isPrivateIp('2606:4700:4700::1111')).toBe(false)
  })
  it('trata lo que no es IP como inseguro (fail-closed)', () => {
    expect(isPrivateIp('no-una-ip')).toBe(true)
    expect(isPrivateIp('')).toBe(true)
  })
})

describe('isSafeUrl', () => {
  it('acepta http/https con dominio público', () => {
    expect(isSafeUrl('https://a.espncdn.com/i/x.png')).toBe(true)
    expect(isSafeUrl('http://media.com/foto.jpg')).toBe(true)
    expect(isSafeUrl('https://8.8.8.8/x.png')).toBe(true) // IP pública literal
  })
  it('rechaza protocolos que no son http/https', () => {
    for (const u of ['ftp://x.com/a', 'file:///etc/passwd', 'data:image/png;base64,AAAA', 'gopher://x']) {
      expect(isSafeUrl(u), u).toBe(false)
    }
  })
  it('rechaza nombres internos y IPs privadas literales', () => {
    for (const u of [
      'http://localhost/x', 'http://foo.local/x', 'http://svc.internal/x', 'http://router/x',
      'http://127.0.0.1/x', 'http://169.254.169.254/latest/meta-data/', 'http://[::1]/x', 'http://192.168.0.1/x',
    ]) {
      expect(isSafeUrl(u), u).toBe(false)
    }
  })
  it('rechaza basura', () => {
    expect(isSafeUrl('not a url')).toBe(false)
    expect(isSafeUrl('')).toBe(false)
  })
})

describe('resolvePublicAddress — exige IPs públicas', () => {
  const fake = (addrs: Array<{ address: string; family: number }>): LookupFn => async () => addrs

  it('IP literal pública: devuelve sin resolver', async () => {
    await expect(resolvePublicAddress('8.8.8.8')).resolves.toEqual({ address: '8.8.8.8', family: 4 })
  })
  it('IP literal privada: bloquea', async () => {
    await expect(resolvePublicAddress('169.254.169.254')).rejects.toThrow('blocked_private_ip')
    await expect(resolvePublicAddress('[::1]')).rejects.toThrow('blocked_private_ip')
  })
  it('nombre que resuelve a pública: la devuelve', async () => {
    await expect(
      resolvePublicAddress('cdn.com', fake([{ address: '93.184.216.34', family: 4 }])),
    ).resolves.toEqual({ address: '93.184.216.34', family: 4 })
  })
  it('nombre que resuelve a privada (rebinding): bloquea', async () => {
    await expect(
      resolvePublicAddress('evil.com', fake([{ address: '10.0.0.5', family: 4 }])),
    ).rejects.toThrow('blocked_private_ip')
  })
  it('si CUALQUIER IP resuelta es privada, bloquea (aunque haya una pública)', async () => {
    await expect(
      resolvePublicAddress('evil.com', fake([
        { address: '8.8.8.8', family: 4 },
        { address: '169.254.169.254', family: 4 },
      ])),
    ).rejects.toThrow('blocked_private_ip')
  })
  it('prefiere IPv4 cuando hay ambas', async () => {
    await expect(
      resolvePublicAddress('cdn.com', fake([
        { address: '2606:4700::1111', family: 6 },
        { address: '104.16.0.1', family: 4 },
      ])),
    ).resolves.toEqual({ address: '104.16.0.1', family: 4 })
  })
  it('sin resultados: error', async () => {
    await expect(resolvePublicAddress('cdn.com', fake([]))).rejects.toThrow('dns_no_result')
  })
})
