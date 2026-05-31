// Helpers para el sistema de "Reto 1v1" — un user invita a un amigo a
// competir en la jornada activa. Bajo el capó es un join a la liga
// privada que el user ya tiene (auto-creada en el primer stake), pero
// con framing distinto:
//   · Invitar amigos → CTA permanente, copy genérico "únete a mi liga".
//   · Retar → CTA puntual, copy directo "¿le ganas?".
//
// El token codifica leagueId + handle del retador, separados por "_".
// El handle es cosmético (se muestra en el banner del receptor) y se
// sanitiza al construir/decodificar.

const HANDLE_MAX = 20

function sanitizeHandle(handle: string): string {
  return handle
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, HANDLE_MAX)
}

export function buildChallengeToken(leagueId: string, handle: string): string {
  const safeLeague = leagueId.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 12)
  const safeHandle = sanitizeHandle(handle)
  return safeHandle ? `${safeLeague}_${safeHandle}` : safeLeague
}

export interface ParsedChallenge {
  leagueId: string
  handle: string | null
}

export function parseChallengeToken(token: string | null | undefined): ParsedChallenge | null {
  if (!token || typeof token !== 'string') return null
  const cleaned = token.trim().slice(0, 40)
  if (!cleaned) return null
  const [leagueRaw, handleRaw = ''] = cleaned.split('_')
  const leagueId = leagueRaw.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 12)
  if (!leagueId) return null
  const handle = sanitizeHandle(handleRaw) || null
  return { leagueId, handle }
}

/** URL completa lista para compartir. Usa `origin` cuando exista. */
export function buildChallengeUrl(token: string, origin?: string): string {
  const base = origin
    ?? (typeof window !== 'undefined' ? window.location.origin : 'https://takasportsmedia.com')
  return `${base}/predicciones?reto=${encodeURIComponent(token)}`
}

/** Copy genérico para WhatsApp/share-sheet. */
export function buildChallengeText(handle: string | null, jornada: string | null): string {
  const who = handle ? handle : 'Te'
  const j = jornada ? ` en la ${jornada}` : ''
  return `${who} te reto${j} en La Porra de TakaSports. ¿Le ganas?`
}
