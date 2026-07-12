// Auth de Google compartida (Search Console + GA4), sin dependencias externas.
//
// Dos vías, componibles por el que llama según qué API y en qué orden prefiera:
//   • getOauthAccessToken()        — refresh token de cuenta de usuario (GOOGLE_OAUTH_*)
//   • getServiceAccountToken(scopes) — JWT RS256 de una service account
//
// La MISMA service account (la de taka-system, `taka-report@…`) tiene acceso a
// GA4 y a Search Console, así que basta una credencial para ambas. Se lee de
// GOOGLE_SA_CLIENT_EMAIL / GOOGLE_SA_PRIVATE_KEY (con alias legacy GSC_CLIENT_EMAIL
// / GSC_PRIVATE_KEY, que ya existían para el fallback de GSC).
//
// Antes esto vivía privado dentro de seo-audit.ts; se extrajo para que traffic.ts
// (GA4) lo reuse sin duplicar el firmado del JWT.

import { createSign } from 'crypto'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const FETCH_TIMEOUT_MS = 10_000

async function timedFetch(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * OAuth 2.0: intercambia el refresh token del usuario por un access token.
 * El scope del token lo fija el refresh token al crearse (si no incluye
 * analytics.readonly, GA4 dará 403 y el caller debe caer a la service account).
 */
export async function getOauthAccessToken(): Promise<string | null> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN
  if (!clientId || !clientSecret || !refreshToken) return null

  const res = await timedFetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`oauth refresh ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = (await res.json()) as { access_token?: string }
  return data.access_token ?? null
}

function serviceAccountCreds(): { clientEmail: string; privateKey: string } | null {
  const clientEmail = process.env.GOOGLE_SA_CLIENT_EMAIL || process.env.GSC_CLIENT_EMAIL
  let privateKey = process.env.GOOGLE_SA_PRIVATE_KEY || process.env.GSC_PRIVATE_KEY
  if (!clientEmail || !privateKey) return null
  // En Vercel la private key se guarda con "\n" literales — hay que restaurarlos.
  privateKey = privateKey.replace(/\\n/g, '\n')
  return { clientEmail, privateKey }
}

/** ¿Hay una service account configurada? (para pintar avisos accionables). */
export function hasServiceAccount(): boolean {
  return serviceAccountCreds() !== null
}

/**
 * Access token de service account (RS256, sin googleapis) para los `scopes`
 * pedidos. Devuelve null si no hay credencial configurada.
 */
export async function getServiceAccountToken(scopes: string[]): Promise<string | null> {
  const creds = serviceAccountCreds()
  if (!creds) return null

  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = base64url(
    JSON.stringify({
      iss: creds.clientEmail,
      scope: scopes.join(' '),
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  )
  const signingInput = `${header}.${claim}`
  const signature = base64url(createSign('RSA-SHA256').update(signingInput).sign(creds.privateKey))
  const assertion = `${signingInput}.${signature}`

  const res = await timedFetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  if (!res.ok) throw new Error(`token exchange ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = (await res.json()) as { access_token?: string }
  return data.access_token ?? null
}
