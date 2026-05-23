// Tokens firmados para la baja del newsletter.
// Formato: base64url(email).base64url(HMAC-SHA256(email, secret))
// Sin estado en DB — el token es autosuficiente y revocable solo por
// rotar NEWSLETTER_UNSUB_SECRET (lo cual invalida TODOS los pendientes).
//
// El envío real de newsletters (futuro proveedor o script n8n) debe
// generar la URL con: signUnsubscribeToken(email) y meterla en cada email.

import { createHmac, timingSafeEqual } from 'crypto'

const SECRET = process.env.NEWSLETTER_UNSUB_SECRET

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s, 'base64url')
}

/**
 * Firma un email con HMAC. Devuelve null si NEWSLETTER_UNSUB_SECRET no
 * está configurado (no levantamos para que el resto del sistema no se
 * caiga; el caller decide cómo manejar).
 */
export function signUnsubscribeToken(email: string): string | null {
  if (!SECRET) return null
  const normalized = email.trim().toLowerCase()
  if (!normalized) return null
  const hmac = createHmac('sha256', SECRET)
  hmac.update(normalized)
  const sig = hmac.digest()
  return `${b64url(normalized)}.${b64url(sig)}`
}

/** Verifica un token y devuelve el email si es válido, null si no. */
export function verifyUnsubscribeToken(token: string | null | undefined): string | null {
  if (!SECRET || !token) return null
  const [emailPart, sigPart] = token.split('.', 2)
  if (!emailPart || !sigPart) return null
  let email: string
  let provided: Buffer
  try {
    email = fromB64url(emailPart).toString('utf8')
    provided = fromB64url(sigPart)
  } catch {
    return null
  }
  if (!email || provided.length === 0) return null

  const hmac = createHmac('sha256', SECRET)
  hmac.update(email)
  const expected = hmac.digest()
  if (expected.length !== provided.length) return null
  try {
    if (!timingSafeEqual(expected, provided)) return null
  } catch {
    return null
  }
  return email
}
