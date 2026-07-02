// Descarga SEGURA contra SSRF para el proxy de imágenes.
//
// El proxy descarga URLs de terceros en el servidor. Sin protección, un atacante
// puede pedirle una dirección INTERNA (red privada, loopback, o el servicio de
// metadatos de la nube 169.254.169.254 — donde a veces hay credenciales). La
// variante fina es el DNS-REBINDING: validar el nombre no basta porque el DNS
// puede resolver a una IP interna en el momento de conectar (o cambiar entre la
// validación y la descarga).
//
// Blindaje:
//   1. isSafeUrl        — estructura: solo http/https, sin nombres internos.
//   2. resolvePublicAddress — resuelve el nombre por DNS, exige que TODAS las
//      IPs sean públicas, y devuelve la IP a la que conectar.
//   3. safeImageFetch   — conecta CONTRA ESA IP FIJADA (`host: ip`), con SNI del
//      nombre (`servername`) para que el certificado HTTPS siga validando; así no
//      hay una segunda resolución DNS que pueda apuntar a una interna (anti-TOCTOU).
//      Cada redirección se re-valida y se vuelve a fijar la IP.

import { lookup } from 'node:dns/promises'
import net from 'node:net'
import http, { type IncomingMessage } from 'node:http'
import https from 'node:https'

// ── Clasificación de IPs (privadas / reservadas / no enrutables) ──────────────

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let n = 0
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null
    const o = Number(p)
    if (o > 255) return null
    n = (n << 8) | o
  }
  return n >>> 0
}

function inV4Range(n: number, base: string, bits: number): boolean {
  const b = ipv4ToInt(base)
  if (b === null) return false
  const mask = bits === 0 ? 0 : (~((1 << (32 - bits)) - 1)) >>> 0
  return (n & mask) === (b & mask)
}

function isPrivateIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip)
  if (n === null) return true // no parseable → inseguro
  return (
    inV4Range(n, '0.0.0.0', 8) ||        // "this host"
    inV4Range(n, '10.0.0.0', 8) ||       // RFC1918
    inV4Range(n, '100.64.0.0', 10) ||    // CGNAT
    inV4Range(n, '127.0.0.0', 8) ||      // loopback
    inV4Range(n, '169.254.0.0', 16) ||   // link-local / metadata cloud
    inV4Range(n, '172.16.0.0', 12) ||    // RFC1918
    inV4Range(n, '192.0.0.0', 24) ||     // IETF protocol assignments
    inV4Range(n, '192.0.2.0', 24) ||     // TEST-NET-1 (doc)
    inV4Range(n, '192.88.99.0', 24) ||   // 6to4 relay anycast
    inV4Range(n, '192.168.0.0', 16) ||   // RFC1918
    inV4Range(n, '198.18.0.0', 15) ||    // benchmarking
    inV4Range(n, '198.51.100.0', 24) ||  // TEST-NET-2 (doc)
    inV4Range(n, '203.0.113.0', 24) ||   // TEST-NET-3 (doc)
    inV4Range(n, '224.0.0.0', 4) ||      // multicast
    inV4Range(n, '240.0.0.0', 4)         // reservado / broadcast
  )
}

function isPrivateIpv6(ip: string): boolean {
  const addr = ip.toLowerCase().split('%')[0] // sin zone-id
  const mapped = addr.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
  if (mapped) return isPrivateIpv4(mapped[1]) // IPv4-mapped
  if (addr === '::1' || addr === '::') return true // loopback / unspecified
  if (/^fe[89ab]/.test(addr)) return true // fe80::/10 link-local
  if (/^f[cd]/.test(addr)) return true    // fc00::/7 unique-local
  if (/^ff/.test(addr)) return true       // ff00::/8 multicast
  if (addr.startsWith('64:ff9b:')) return true // NAT64 (embebe IPv4)
  return false
}

/** true si la IP (v4/v6) NO debe ser accesible desde el proxy. Un valor no-IP se
 *  trata como inseguro (fail-closed). */
export function isPrivateIp(ip: string): boolean {
  const fam = net.isIP(ip)
  if (fam === 4) return isPrivateIpv4(ip)
  if (fam === 6) return isPrivateIpv6(ip)
  return true
}

// ── Validación estructural de la URL ─────────────────────────────────────────

/** Estructura segura: solo http/https y sin nombres internos evidentes. Si el
 *  host es una IP literal, se valida aquí mismo. Los nombres se resuelven luego
 *  en resolvePublicAddress. */
export function isSafeUrl(raw: string): boolean {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return false
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
  const host = u.hostname
  if (!host) return false
  const literal = host.replace(/^\[|\]$/g, '') // IPv6 entre corchetes
  if (net.isIP(literal)) return !isPrivateIp(literal)
  const h = host.toLowerCase()
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return false
  if (!h.includes('.')) return false // nombre de una sola etiqueta = interno
  return true
}

// ── Resolución + validación + fijación de IP ─────────────────────────────────

export interface ResolvedTarget {
  address: string
  family: 4 | 6
}

export type LookupFn = (hostname: string) => Promise<Array<{ address: string; family: number }>>
const defaultLookup: LookupFn = (h) => lookup(h, { all: true })

/** Resuelve el nombre y exige que TODAS las IPs sean públicas (si cualquiera es
 *  privada → rebinding/misconfig → bloquea). Devuelve la IP a la que conectar. */
export async function resolvePublicAddress(
  hostname: string,
  doLookup: LookupFn = defaultLookup,
): Promise<ResolvedTarget> {
  const literal = hostname.replace(/^\[|\]$/g, '')
  const litFam = net.isIP(literal)
  if (litFam) {
    if (isPrivateIp(literal)) throw new Error('blocked_private_ip')
    return { address: literal, family: litFam as 4 | 6 }
  }
  const results = await doLookup(hostname)
  if (!results.length) throw new Error('dns_no_result')
  for (const r of results) {
    if (isPrivateIp(r.address)) throw new Error('blocked_private_ip')
  }
  const chosen = results.find((r) => r.family === 4) ?? results[0]
  return { address: chosen.address, family: (chosen.family === 6 ? 6 : 4) }
}

// ── Descarga con IP fijada + redirecciones re-validadas ──────────────────────

export interface ProxyResponse {
  status: number
  headers: Record<string, string | undefined>
  body: Buffer
}

function flattenHeaders(h: http.IncomingHttpHeaders): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(h)) out[k] = Array.isArray(v) ? v.join(', ') : v
  return out
}

function requestOnce(
  u: URL,
  target: ResolvedTarget,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<{ status: number; headers: http.IncomingHttpHeaders; stream: IncomingMessage }> {
  const isHttps = u.protocol === 'https:'
  const mod = isHttps ? https : http
  const port = u.port ? Number(u.port) : isHttps ? 443 : 80
  return new Promise((resolve, reject) => {
    const req = mod.request(
      {
        host: target.address, // ← FIJA la IP validada (sin re-resolver DNS)
        port,
        family: target.family,
        path: (u.pathname || '/') + u.search,
        method: 'GET',
        headers: { ...headers, Host: u.host }, // Host con el nombre para vhosts
        servername: isHttps ? u.hostname : undefined, // SNI + cert validado contra el nombre
        timeout: timeoutMs,
      },
      (res) => resolve({ status: res.statusCode ?? 0, headers: res.headers, stream: res }),
    )
    req.on('timeout', () => req.destroy(new Error('timeout')))
    req.on('error', reject)
    req.end()
  })
}

function readCapped(stream: IncomingMessage, maxSize: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let total = 0
    stream.on('data', (c: Buffer) => {
      total += c.length
      if (total > maxSize) {
        stream.destroy()
        reject(new Error('too_large'))
        return
      }
      chunks.push(c)
    })
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
}

export interface SafeFetchOptions {
  maxHops: number
  maxSize: number
  timeoutMs: number
}

/** Descarga `startUrl` de forma segura: valida + fija IP en CADA salto (inicial y
 *  redirecciones), conecta contra la IP validada y limita tamaño/tiempo. */
export async function safeImageFetch(
  startUrl: string,
  headersFor: (url: string) => Record<string, string>,
  opts: SafeFetchOptions,
): Promise<ProxyResponse> {
  let url = startUrl
  for (let hop = 0; hop <= opts.maxHops; hop++) {
    if (!isSafeUrl(url)) throw new Error('unsafe_url')
    const u = new URL(url)
    const target = await resolvePublicAddress(u.hostname)
    const { status, headers, stream } = await requestOnce(u, target, headersFor(url), opts.timeoutMs)

    if (status >= 300 && status < 400) {
      const loc = headers.location
      stream.destroy() // no leemos el cuerpo de una redirección
      if (!loc) return { status, headers: flattenHeaders(headers), body: Buffer.alloc(0) }
      url = new URL(Array.isArray(loc) ? loc[0] : loc, url).toString()
      continue
    }

    const body = await readCapped(stream, opts.maxSize)
    return { status, headers: flattenHeaders(headers), body }
  }
  throw new Error('too_many_redirects')
}
