// Helpers para el sistema de "Reto 1v1" — un user invita a un amigo a
// competir en la jornada activa. Bajo el capó es un join a la liga
// privada que el user ya tiene (auto-creada en el primer stake), pero
// con framing distinto:
//   · Invitar amigos → CTA permanente, copy genérico "únete a mi liga".
//   · Retar → CTA puntual, copy directo "¿le ganas?".
//
// El token codifica leagueId + handle del retador, separados por "-".
// OJO: el separador NO puede ser "_" porque los league ids reales son
// 'rl_<hex>' (llevan '_'); usar '_' partía el id y lo corrompía → el reto no
// unía a nadie. El handle es cosmético (se muestra en el banner del receptor)
// y se sanitiza al construir/decodificar.

const HANDLE_MAX = 20
const SEP = '-' // no aparece ni en los ids (rl_<hex>) ni en los handles ([a-z0-9])

function sanitizeHandle(handle: string): string {
  return handle
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, HANDLE_MAX)
}

// Conserva el league id REAL ('rl_<10hex>', charset [a-z0-9_]) TAL CUAL: solo
// acota charset y longitud, sin destruir el '_' ni pasar a mayúsculas. Antes se
// hacía upper + quitar '_' → 'RL1A2B...' que NUNCA casaba con el id de la BD.
function sanitizeLeagueId(raw: string): string {
  return (raw ?? '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20)
}

export function buildChallengeToken(leagueId: string, handle: string): string {
  const safeLeague = sanitizeLeagueId(leagueId)
  const safeHandle = sanitizeHandle(handle)
  return safeHandle ? `${safeLeague}${SEP}${safeHandle}` : safeLeague
}

export interface ParsedChallenge {
  leagueId: string
  handle: string | null
}

export function parseChallengeToken(token: string | null | undefined): ParsedChallenge | null {
  if (!token || typeof token !== 'string') return null
  const cleaned = token.trim().slice(0, 40)
  if (!cleaned) return null
  const [leagueRaw, handleRaw = ''] = cleaned.split(SEP)
  const leagueId = sanitizeLeagueId(leagueRaw)
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
