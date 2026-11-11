// Política de contraseñas de Supabase Auth (proyecto de producción) y mensajes
// claros para cuando la rechaza.
//
// Por qué existe: el 11/11/2026 el enlace de «¿Olvidaste tu contraseña?»
// funcionaba (verify 200, sesión creada), pero Supabase devolvía 422
// `weak_password` al guardar la nueva contraseña —le falta mayúscula/número o
// aparece en filtraciones (HIBP)— y la página lo traducía como «el enlace puede
// haber caducado». Tres intentos, tres veces el mensaje equivocado.
//
// La regla de servidor (Dashboard → Auth → Providers → Email → Password
// requirements) exige minúsculas, mayúsculas y dígitos. Aquí la repetimos para
// avisar ANTES de llamar a la API; la comprobación de contraseñas filtradas
// («pwned») solo la puede hacer el servidor.

export const PASSWORD_MIN_LENGTH = 8

export const PASSWORD_HINT = `Mín. ${PASSWORD_MIN_LENGTH} caracteres, con mayúscula, minúscula y número`

const MSG_LENGTH     = `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`
const MSG_CHARACTERS = 'La contraseña necesita al menos una minúscula, una mayúscula y un número.'
const MSG_PWNED      = 'Esa contraseña es demasiado común o ha salido en filtraciones de otras webs. Elige otra distinta.'
const MSG_SAME       = 'La nueva contraseña tiene que ser distinta de la anterior.'
const MSG_EXPIRED    = 'El enlace ha caducado o ya se usó. Pide uno nuevo desde «¿Olvidaste tu contraseña?».'

/** Devuelve el mensaje del primer requisito que no cumple, o null si vale. */
export function checkPasswordPolicy(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return MSG_LENGTH
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) return MSG_CHARACTERS
  return null
}

type AuthLikeError = {
  message?: string
  code?: string
  name?: string
  status?: number
  reasons?: string[]
}

/**
 * Traduce el error de supabase.auth.updateUser / signUp al motivo REAL.
 * Solo dice «caducado» cuando de verdad falta la sesión; si no reconoce el
 * error, da un mensaje genérico que no culpa al enlace.
 */
export function passwordErrorMessage(error: AuthLikeError, fallback: string): string {
  const msg  = (error.message ?? '').toLowerCase()
  const code = error.code ?? ''

  if (code === 'weak_password' || error.name === 'AuthWeakPasswordError' || msg.includes('known to be weak') || msg.includes('should contain') || msg.includes('should be at least')) {
    const reasons = error.reasons ?? []
    // Orden: lo que el usuario puede arreglar a la vista va primero.
    if (reasons.includes('length') || msg.includes('should be at least')) return MSG_LENGTH
    if (reasons.includes('characters') || msg.includes('should contain')) return MSG_CHARACTERS
    if (reasons.includes('pwned') || msg.includes('known to be weak')) return MSG_PWNED
    return MSG_CHARACTERS
  }
  if (code === 'same_password' || msg.includes('different from the old')) return MSG_SAME
  if (
    code === 'session_not_found' || code === 'session_expired' ||
    error.name === 'AuthSessionMissingError' || msg.includes('session missing') ||
    error.status === 401 || error.status === 403
  ) return MSG_EXPIRED
  return fallback
}
