// ── Resumen de H2H en UNA línea (Fase 2 del rediseño del calendario) ────────
//
// Convierte el H2HResult de past-events (últimos enfrentamientos entre dos
// equipos) en una frase corta para la fila del calendario. La frase se elige
// por lo que DICE el dato, no por plantilla fija:
//   · racha viva  → "3 victorias seguidas del Atlético"  (lo más informativo)
//   · dominio     → "Atlético domina el H2H: 4-1-0"
//   · igualdad    → "Últimos 5: 2-1-2"
//
// Nunca inventa: un "1-0-0" sobre un único partido no dice nada, así que con un
// solo enfrentamiento se enuncia como lo que es ("Último: Chicago 3-2") en vez
// de disfrazarlo de historial. Sin ninguno, devuelve null.
//
// Nota de cobertura: `past_events` solo archiva lo que ha visto el cron
// sync-past-results (1.612 filas el 21/08/2026), así que muchas parejas todavía
// no tienen historial y la frase no aparece. Es esperado, no un fallo.

export interface H2HLike {
  matches: Array<{ home: string; away: string; homeScore: number | null; awayScore: number | null }>
  wins: number
  draws: number
  losses: number
}

// Primeras palabras que NO identifican a un club por sí solas: hay decenas de
// "Real", y "Inter" a secas se lee como el de Milán aunque el partido sea del
// Inter Miami. En esos casos la frase usa dos palabras.
const AMBIGUOUS_FIRST = new Set([
  'real', 'inter', 'atletico', 'club', 'deportivo', 'racing', 'sporting',
  'union', 'olympique', 'borussia', 'dinamo', 'dynamo', 'estudiantes',
  'independiente', 'nacional', 'america', 'san', 'santa', 'new', 'red',
])

/** Conectores que no cuentan como palabra ("Atlético de Madrid" → Atlético Madrid). */
const CONNECTORS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y'])

const deaccent = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Nombre corto para la frase: "Atlético de Madrid" → "Atlético Madrid",
 *  "Sevilla FC" → "Sevilla", "Inter Miami CF" → "Inter Miami". */
export function shortTeamName(name: string): string {
  const clean = name.replace(/\b(FC|CF|SL|SAD|SC|AFC|FK|AC|AS|SS|RC|RCD|UD|SD|CD)\b/gi, '').trim()
  const words = clean.split(/\s+/).filter(w => w && !CONNECTORS.has(deaccent(w).toLowerCase()))
  if (words.length === 0) return clean
  const first = words[0]
  if (words.length > 1 && AMBIGUOUS_FIRST.has(deaccent(first).toLowerCase())) {
    return `${first} ${words[1]}`
  }
  return first.length >= 3 ? first : words.slice(0, 2).join(' ')
}

/**
 * Frase de una línea sobre el historial. `teamA` es el equipo desde cuya
 * perspectiva vienen contados wins/draws/losses (el `home` del partido actual).
 */
export function h2hSummary(h2h: H2HLike | null | undefined, teamA: string, teamB: string): string | null {
  if (!h2h) return null
  const played = h2h.wins + h2h.draws + h2h.losses
  if (played === 0) return null

  // Un único precedente: se cuenta como tal, sin fingir un historial.
  if (played === 1) {
    const m = h2h.matches.find(x => x.homeScore != null && x.awayScore != null)
    if (!m || m.homeScore == null || m.awayScore == null) return null
    if (m.homeScore === m.awayScore) return `Último: empate ${m.homeScore}-${m.awayScore}`
    const winner = m.homeScore > m.awayScore ? m.home : m.away
    const hi = Math.max(m.homeScore, m.awayScore)
    const lo = Math.min(m.homeScore, m.awayScore)
    return `Último: ${shortTeamName(winner)} ${hi}-${lo}`
  }

  // Racha viva: cuántos de los ÚLTIMOS enfrentamientos seguidos ganó el mismo
  // equipo. matches viene ordenado de más reciente a más antiguo.
  let streakTeam: string | null = null
  let streak = 0
  for (const m of h2h.matches) {
    if (m.homeScore == null || m.awayScore == null) continue
    if (m.homeScore === m.awayScore) break
    const winner = m.homeScore > m.awayScore ? m.home : m.away
    if (streakTeam === null) {
      streakTeam = winner
      streak = 1
    } else if (winner === streakTeam) {
      streak++
    } else break
  }

  if (streakTeam && streak >= 2) {
    return `${streak} victorias seguidas de ${shortTeamName(streakTeam)}`
  }

  // Dominio claro en la muestra (más de la mitad ganados y sin empate en el
  // recuento de victorias).
  if (h2h.wins > h2h.losses && h2h.wins > played / 2) {
    return `${shortTeamName(teamA)} domina el H2H: ${h2h.wins}-${h2h.draws}-${h2h.losses}`
  }
  if (h2h.losses > h2h.wins && h2h.losses > played / 2) {
    return `${shortTeamName(teamB)} domina el H2H: ${h2h.losses}-${h2h.draws}-${h2h.wins}`
  }

  // Igualado: el recuento crudo desde teamA.
  return `Últimos ${played}: ${h2h.wins}-${h2h.draws}-${h2h.losses}`
}
