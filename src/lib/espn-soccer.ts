// Normalización de los tipos de evento de ESPN para fútbol.
//
// ESPN cualifica muchos tipos con un sufijo "---xxx": el gol de cabeza llega como
// `goal---header`, el de volea `goal---volley`, el de falta `goal---free-kick`,
// el penalti marcado `penalty---scored`, el penalti parado `penalty---saved`, y
// las decisiones de VAR `var---referee-decision-cancelled`. El código antiguo
// comparaba el tipo EXACTO contra un set fijo, así que TODOS esos matices se
// descartaban → los goles de cabeza/volea/falta/penalti DESAPARECÍAN del
// "Resumen" y del "minuto a minuto". Aquí separamos base y matiz, y mapeamos
// preservando el matiz (clave para NO convertir un penalti PARADO en un gol).

export interface EspnType {
  base: string
  qualifier?: string
}

/** Separa "goal---header" → { base: 'goal', qualifier: 'header' }. Sin sufijo, qualifier = undefined. */
export function splitEspnType(raw: string | undefined | null): EspnType {
  const s = (raw ?? '').trim()
  const idx = s.indexOf('---')
  if (idx === -1) return { base: s }
  return { base: s.slice(0, idx), qualifier: s.slice(idx + 3) }
}

// Cómo se marcó un gol (matiz del sufijo ESPN) → etiqueta corta en español.
const GOAL_DETAIL: Record<string, string> = {
  header: 'De cabeza',
  volley: 'De volea',
  'free-kick': 'De falta',
  'bicycle-kick': 'De chilena',
  'scissors-kick': 'De tijera',
  'overhead-kick': 'De chilena',
}

// Tipo VISUAL que consumen los renders (app + web) para color/icono/etiqueta.
export type ScoringType = 'goal' | 'penalty' | 'penalty-missed' | 'own-goal' | 'yellow' | 'red' | 'sub'

/**
 * keyEvents de ESPN → evento del "Resumen" (goles, penaltis, tarjetas).
 * Devuelve null si el tipo NO es un hito de marcador/tarjeta (saques, inicios…).
 * `detail` es un matiz opcional en español ("De cabeza", "Parado"…).
 */
export function normalizeScoringType(raw: string): { type: ScoringType; detail?: string } | null {
  const { base, qualifier } = splitEspnType(raw)
  switch (base) {
    case 'goal':
      return { type: 'goal', detail: qualifier ? GOAL_DETAIL[qualifier] : undefined }
    case 'own-goal':
    case 'owngoal':
      return { type: 'own-goal' }
    case 'penalty':
      // penalty---scored = gol de penalti; penalty---saved / penalty---missed = penalti errado.
      if (qualifier === 'saved') return { type: 'penalty-missed', detail: 'Parado' }
      if (qualifier === 'missed') return { type: 'penalty-missed', detail: 'Fallado' }
      return { type: 'penalty' } // scored o matiz desconocido → gol de penalti
    case 'penalty-goal': // vocabulario alternativo por si ESPN cambia
      return { type: 'penalty' }
    case 'yellow-card':
      return { type: 'yellow' }
    case 'red-card':
    case 'yellow-red-card':
      return { type: 'red' }
    default:
      return null
  }
}

// Etiquetas base del minuto a minuto (tipos SIN matiz, o cuyo matiz no cambia el texto).
const COMMENTARY_BASE: Record<string, string> = {
  goal: 'Gol',
  'own-goal': 'Gol en propia',
  owngoal: 'Gol en propia',
  'yellow-card': 'Tarjeta amarilla',
  'red-card': 'Tarjeta roja',
  'yellow-red-card': 'Doble amarilla',
  substitution: 'Cambio',
  penalty: 'Penalti',
  'penalty-won': 'Penalti cometido',
  'shot-on-target': 'Tiro a puerta',
  'shot-off-target': 'Tiro desviado',
  'shot-blocked': 'Tiro bloqueado',
  'shot-hit-woodwork': 'Al palo',
  'corner-awarded': 'Córner',
  offside: 'Fuera de juego',
  foul: 'Falta',
  handball: 'Mano',
  kickoff: 'Comienza el partido',
  halftime: 'Descanso',
  'start-2nd-half': 'Comienza la 2ª parte',
  'end-regular-time': 'Final',
  fulltime: 'Final del partido',
}

// Eventos "clave" del minuto a minuto (se resaltan): goles, tarjetas, penaltis, cambios, VAR.
const COMMENTARY_KEY_BASE = new Set([
  'goal', 'own-goal', 'owngoal', 'yellow-card', 'red-card', 'yellow-red-card',
  'substitution', 'penalty', 'penalty-won', 'var',
])

/**
 * Tipo ESPN (con matiz) → entrada del minuto a minuto: etiqueta en español, tipo
 * normalizado para el render (color/icono) y si es un evento "clave". Devuelve
 * null si el tipo es ruido (saque de banda, «noplay», tipos desconocidos) para
 * no colar texto en inglés.
 */
export function commentaryLabelFor(raw: string): { label: string; type: string; key: boolean } | null {
  const { base, qualifier } = splitEspnType(raw)
  if (base === 'var') return { label: 'Revisión VAR', type: 'var', key: true }
  if (base === 'goal') {
    const d = qualifier ? GOAL_DETAIL[qualifier] : undefined
    return { label: d ? `Gol ${d.toLowerCase()}` : 'Gol', type: 'goal', key: true }
  }
  if (base === 'penalty') {
    if (qualifier === 'scored') return { label: 'Gol de penalti', type: 'penalty-goal', key: true }
    if (qualifier === 'saved') return { label: 'Penalti parado', type: 'penalty-missed', key: true }
    if (qualifier === 'missed') return { label: 'Penalti fallado', type: 'penalty-missed', key: true }
    return { label: 'Penalti', type: 'penalty', key: true }
  }
  const label = COMMENTARY_BASE[base]
  if (!label) return null
  return { label, type: base === 'owngoal' ? 'own-goal' : base, key: COMMENTARY_KEY_BASE.has(base) }
}

// ── Estadísticas de fútbol ──────────────────────────────────────────
// Orden narrativo curado. Antes solo se pintaban ~10 y dos nombres NO existían en
// el feed de ESPN (`fouls`→es `foulsCommitted`, `corners`→es `wonCorners`), así
// que las faltas nunca aparecían. Ahora se usan los nombres REALES del boxscore
// (verificados contra la API) y se añaden pase/entradas/intercepciones/despejes/
// centros (todos gratis, ya venían en el payload).
export const SOCCER_STAT_ORDER = [
  'possessionPct', 'totalShots', 'shotsOnTarget', 'passPct', 'totalTackles',
  'interceptions', 'totalClearance', 'totalCrosses', 'wonCorners', 'saves',
  'foulsCommitted', 'offsides', 'yellowCards', 'redCards',
]

export const SOCCER_LABELS: Record<string, string> = {
  possessionPct: 'Posesión %',
  totalShots: 'Tiros',
  shotsOnTarget: 'Tiros a puerta',
  passPct: 'Precisión de pase %',
  totalTackles: 'Entradas',
  interceptions: 'Intercepciones',
  totalClearance: 'Despejes',
  totalCrosses: 'Centros',
  wonCorners: 'Córners',
  saves: 'Paradas',
  foulsCommitted: 'Faltas',
  offsides: 'Fuera de juego',
  yellowCards: 'Tarjetas amarillas',
  redCards: 'Tarjetas rojas',
}
