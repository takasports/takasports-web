// Modelo del "cuadro de eliminatorias" del Mundial 2026 a partir de ranked_events.
//
// La fase final del formato de 48 equipos son 32 partidos de estructura FIJA:
// 16 dieciseisavos → 8 octavos → 4 cuartos → 2 semifinales → 1 tercer puesto →
// 1 final. ESPN (y por tanto ranked_events) entrega los cruces con las conexiones
// del árbol ya explícitas: el equipo real cuando se conoce ("Spain") y un
// marcador de hueco cuando aún no ("Round of 32 3 Winner", "Quarterfinal 1
// Winner", "Semifinal 1 Loser" = el del tercer puesto). Eso permite dibujar la
// llave real, con sus líneas, sin inventar nada.
//
// La fuente de verdad es ranked_events (sport='mundial'), la MISMA que alimenta
// /mundial/fixture y las predicciones — no el scoreboard de ESPN en vivo, que
// solo devuelve el partido del día.

import { toSpanishNation } from './nation-names'

export type BracketRoundId = 'r32' | 'r16' | 'qf' | 'sf' | 'third' | 'final'

export interface BracketSide {
  /** Nombre ES de la selección, o el texto del hueco ("Ganador 16avos 3"). */
  name: string
  /** Emoji bandera, o '🏳️' si es un hueco sin definir. */
  flag: string
  /** Goles si el partido está resuelto; si no, null. */
  score: number | null
  isWinner: boolean
  isPlaceholder: boolean
  /** Ronda que alimenta este hueco (para trazar las líneas de la llave). */
  sourceRound: BracketRoundId | null
  /** Nº de partido de esa ronda fuente. */
  sourceSlot: number | null
}

export interface BracketMatch {
  id: string
  round: BracketRoundId
  /** Posición 1..N dentro de la ronda (en orden cronológico). */
  slot: number
  dateISO: string
  status: 'open' | 'closed' | 'resolved'
  home: BracketSide
  away: BracketSide
}

export interface BracketRound {
  id: BracketRoundId
  label: string
  matches: BracketMatch[]
}

export interface Bracket {
  rounds: BracketRound[]
  resolvedCount: number
  totalCount: number
  /** ¿Hay al menos un cruce con un equipo real? (la fase de grupos ya cerró). */
  hasStarted: boolean
}

/** Fila mínima de ranked_events que consume buildBracket. */
export interface BracketSourceEvent {
  id: string
  event_date: string
  team_home: string | null
  team_away: string | null
  status: 'open' | 'closed' | 'resolved'
  result: { winner?: '1' | 'X' | '2'; home_score?: number; away_score?: number } | null
}

export const ROUND_LABEL: Record<BracketRoundId, string> = {
  r32:   'Dieciseisavos',
  r16:   'Octavos',
  qf:    'Cuartos',
  sf:    'Semifinales',
  third: 'Tercer puesto',
  final: 'Final',
}

// Tamaño (nº de partidos) de cada ronda, en orden cronológico. El orden por fecha
// coloca el tercer puesto (un día antes) justo delante de la final.
const ROUND_PLAN: { id: BracketRoundId; size: number }[] = [
  { id: 'r32',   size: 16 },
  { id: 'r16',   size: 8 },
  { id: 'qf',    size: 4 },
  { id: 'sf',    size: 2 },
  { id: 'third', size: 1 },
  { id: 'final', size: 1 },
]
const KO_TOTAL = 32 // 16 + 8 + 4 + 2 + 1 + 1

// ESPN nombra los huecos sin resolver: "Round of 32 3 Winner", "Quarterfinal 1
// Winner", "Semifinal 1 Loser" (este último alimenta el partido por el 3er puesto).
const PLACEHOLDER_RE = /^(Round of 32|Round of 16|Quarterfinal|Semifinal|Final)\s+(\d+)\s+(Winner|Loser)$/i
const SRC_ROUND: Record<string, BracketRoundId> = {
  'round of 32':  'r32',
  'round of 16':  'r16',
  'quarterfinal': 'qf',
  'semifinal':    'sf',
  'final':        'final',
}
const SRC_SHORT: Record<BracketRoundId, string> = {
  r32: '16avos', r16: '8vos', qf: 'cuartos', sf: 'semis', third: '3er puesto', final: 'final',
}

// Bandera emoji por nombre de país EN (como llega de ESPN/ranked_events). Réplica
// del mapa de /mundial/fixture/page.tsx + las variantes vistas en datos reales.
const FLAG: Record<string, string> = {
  'mexico': '🇲🇽', 'canada': '🇨🇦', 'united states': '🇺🇸', 'usa': '🇺🇸',
  'argentina': '🇦🇷', 'brazil': '🇧🇷', 'uruguay': '🇺🇾', 'colombia': '🇨🇴',
  'ecuador': '🇪🇨', 'paraguay': '🇵🇾', 'peru': '🇵🇪', 'chile': '🇨🇱', 'venezuela': '🇻🇪',
  'spain': '🇪🇸', 'france': '🇫🇷', 'england': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'germany': '🇩🇪', 'portugal': '🇵🇹',
  'italy': '🇮🇹', 'netherlands': '🇳🇱', 'belgium': '🇧🇪', 'croatia': '🇭🇷', 'switzerland': '🇨🇭',
  'denmark': '🇩🇰', 'poland': '🇵🇱', 'austria': '🇦🇹', 'serbia': '🇷🇸', 'turkey': '🇹🇷',
  'ukraine': '🇺🇦', 'scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿', 'norway': '🇳🇴', 'sweden': '🇸🇪',
  'morocco': '🇲🇦', 'senegal': '🇸🇳', 'tunisia': '🇹🇳', 'egypt': '🇪🇬', 'algeria': '🇩🇿',
  'ghana': '🇬🇭', 'nigeria': '🇳🇬', 'cameroon': '🇨🇲', 'ivory coast': '🇨🇮', 'south africa': '🇿🇦',
  'japan': '🇯🇵', 'south korea': '🇰🇷', 'iran': '🇮🇷', 'saudi arabia': '🇸🇦', 'qatar': '🇶🇦',
  'australia': '🇦🇺', 'new zealand': '🇳🇿', 'jamaica': '🇯🇲', 'costa rica': '🇨🇷', 'panama': '🇵🇦',
  'honduras': '🇭🇳', 'uzbekistan': '🇺🇿', 'jordan': '🇯🇴', 'cape verde': '🇨🇻', 'curacao': '🇨🇼',
  'czechia': '🇨🇿', 'czech republic': '🇨🇿', 'bosnia-herzegovina': '🇧🇦', 'bosnia and herzegovina': '🇧🇦',
  'greece': '🇬🇷', 'romania': '🇷🇴', 'hungary': '🇭🇺', 'slovakia': '🇸🇰', 'slovenia': '🇸🇮',
  'republic of ireland': '🇮🇪', 'ireland': '🇮🇪', 'north macedonia': '🇲🇰', 'albania': '🇦🇱',
  'dr congo': '🇨🇩', 'congo dr': '🇨🇩', 'mali': '🇲🇱', 'finland': '🇫🇮', 'kosovo': '🇽🇰', 'iceland': '🇮🇸',
  // Grafías acentuadas tal cual las manda ESPN (no casaban en minúsculas simples).
  "cote d'ivoire": '🇨🇮', 'turkiye': '🇹🇷',
}

// Normaliza acentos/diacríticos: ESPN manda "Curaçao", "Côte d'Ivoire", "Türkiye"
// y la búsqueda simple en minúsculas fallaba → bandera blanca para clasificados reales.
const stripDiacritics = (s: string) =>
  s.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '')

function flagFor(team: string | null): string {
  if (!team) return '🏳️'
  return FLAG[team.toLowerCase().trim()] ?? FLAG[stripDiacritics(team)] ?? '🏳️'
}

function buildSide(rawName: string | null, score: number | null, isWinner: boolean): BracketSide {
  const raw = (rawName ?? '').trim()
  const m = raw.match(PLACEHOLDER_RE)
  if (m) {
    const srcRound = SRC_ROUND[m[1].toLowerCase()] ?? null
    const slot = Number.parseInt(m[2], 10)
    const isLoser = m[3].toLowerCase() === 'loser'
    const short = srcRound ? SRC_SHORT[srcRound] : ''
    return {
      name: `${isLoser ? 'Perdedor' : 'Ganador'} ${short} ${slot}`.trim(),
      flag: '🏳️',
      score,
      isWinner: false,
      isPlaceholder: true,
      sourceRound: srcRound,
      sourceSlot: slot,
    }
  }
  const es = toSpanishNation(raw)
  return {
    name: es || raw || 'Por definir',
    flag: flagFor(raw),
    score,
    isWinner,
    isPlaceholder: false,
    sourceRound: null,
    sourceSlot: null,
  }
}

/**
 * Construye el cuadro de eliminatorias a partir de los partidos del Mundial.
 * Toma los ÚLTIMOS 32 por fecha (72 de grupos + 32 de eliminatoria) y los reparte
 * por ronda con los tamaños fijos del formato. No depende del estado de resolución,
 * así que sigue siendo correcto a medida que avanza el torneo.
 */
export function buildBracket(events: BracketSourceEvent[]): Bracket {
  const sorted = [...events].sort(
    (a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime(),
  )
  const ko = sorted.slice(-KO_TOTAL)

  const rounds: BracketRound[] = ROUND_PLAN.map(r => ({ id: r.id, label: ROUND_LABEL[r.id], matches: [] }))
  const roundById = new Map(rounds.map(r => [r.id, r]))

  let idx = 0
  for (const plan of ROUND_PLAN) {
    const round = roundById.get(plan.id)!
    for (let s = 0; s < plan.size; s++) {
      const ev = ko[idx]
      idx++
      if (!ev) continue
      const resolved = ev.status === 'resolved' && ev.result != null
      const hs = ev.result?.home_score ?? null
      const as = ev.result?.away_score ?? null
      const homeWins = resolved && (ev.result?.winner === '1' || (hs != null && as != null && hs > as))
      const awayWins = resolved && (ev.result?.winner === '2' || (hs != null && as != null && as > hs))
      round.matches.push({
        id: ev.id,
        round: plan.id,
        slot: s + 1,
        dateISO: ev.event_date,
        status: ev.status,
        home: buildSide(ev.team_home, resolved ? hs : null, homeWins),
        away: buildSide(ev.team_away, resolved ? as : null, awayWins),
      })
    }
  }

  const totalCount = ko.length
  const resolvedCount = ko.filter(e => e.status === 'resolved').length
  const hasStarted = rounds.some(r => r.matches.some(m => !m.home.isPlaceholder || !m.away.isPlaceholder))

  return { rounds, resolvedCount, totalCount, hasStarted }
}

// Plantilla FIJA del cuadro del Mundial 2026 (formato 48 equipos): el orden de
// ÁRBOL de cada ronda, expresado con los slots CRONOLÓGICOS (1-indexados) que
// asigna buildBracket. Es estructural — sigue siendo correcto AUNQUE todos los
// ganadores ya se hayan propagado y los huecos ("Ganador 16avos 3") hayan
// desaparecido. Derivado de los cruces que publica ESPN para este torneo.
const WC2026_TREE_ORDER: Partial<Record<BracketRoundId, number[]>> = {
  r32:   [1, 3, 2, 5, 11, 12, 9, 10, 4, 6, 7, 8, 14, 16, 13, 15],
  r16:   [1, 2, 5, 6, 3, 4, 7, 8],
  qf:    [1, 2, 3, 4],
  sf:    [1, 2],
  final: [1],
}

// Reordena cada ronda según la plantilla fija (por slot). null si no encaja
// (nº de partidos distinto o algún slot ausente) → no es el cuadro esperado.
function orderByTemplate(main: BracketRound[]): BracketRound[] | null {
  const out: BracketRound[] = []
  for (const r of main) {
    const tmpl = WC2026_TREE_ORDER[r.id]
    if (!tmpl || tmpl.length !== r.matches.length) return null
    const bySlot = new Map(r.matches.map(m => [m.slot, m]))
    const ordered: BracketMatch[] = []
    for (const slot of tmpl) {
      const m = bySlot.get(slot)
      if (!m) return null
      ordered.push(m)
    }
    out.push({ ...r, matches: ordered })
  }
  return out
}

// ¿La plantilla concuerda con los huecos que SIGUEN vivos? Cada partido de la
// ronda j debe alimentarse de las posiciones 2j y 2j+1 de la ronda anterior.
// Detecta una eventual reprogramación de ESPN que alterase los slots cronológicos.
function isConsistentWithLiveSlots(ordered: BracketRound[]): boolean {
  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1]
    const cur = ordered[i]
    const posBySlot = new Map(prev.matches.map((m, idx) => [m.slot, idx] as const))
    for (let j = 0; j < cur.matches.length; j++) {
      for (const side of [cur.matches[j].home, cur.matches[j].away]) {
        if (side.sourceRound === prev.id && side.sourceSlot != null) {
          const pos = posBySlot.get(side.sourceSlot)
          if (pos !== 2 * j && pos !== 2 * j + 1) return false
        }
      }
    }
  }
  return true
}

// Deriva el orden de árbol leyendo los sourceSlot vivos (de la final hacia
// 16avos). null si la propagación impide reconstruir alguna ronda al completo.
function orderByLiveSlots(main: BracketRound[]): BracketRound[] | null {
  const slotIndex = new Map<BracketRoundId, Map<number, BracketMatch>>(
    main.map(r => [r.id, new Map(r.matches.map(m => [m.slot, m]))]),
  )
  const resultByRound = new Map<BracketRoundId, BracketMatch[]>()
  let order = main[main.length - 1].matches.slice()
  resultByRound.set(main[main.length - 1].id, order)

  for (let i = main.length - 2; i >= 0; i--) {
    const prev = main[i]
    const slotMap = slotIndex.get(prev.id)!
    const used = new Set<number>()
    let determined = 0
    const slotted: (BracketMatch | null)[] = []
    for (const m of order) {
      for (const side of [m.home, m.away]) {
        const s = side.sourceRound === prev.id ? side.sourceSlot : null
        if (s != null && slotMap.has(s) && !used.has(s)) {
          used.add(s)
          determined++
          slotted.push(slotMap.get(s)!)
        } else {
          slotted.push(null)
        }
      }
    }
    if (determined === 0) return null // nada determinable por los huecos
    const leftover = prev.matches.filter(m => !used.has(m.slot))
    let li = 0
    const filled = slotted
      .map(x => x ?? leftover[li++] ?? null)
      .filter((x): x is BracketMatch => x != null)
    if (filled.length !== prev.matches.length) return null
    resultByRound.set(prev.id, filled)
    order = filled
  }
  return main.map(r => ({ ...r, matches: resultByRound.get(r.id) ?? r.matches }))
}

/**
 * Reordena las rondas (sin el 3er puesto) en orden de ÁRBOL: deja cada ronda
 * dispuesta de modo que los dos cruces que alimentan un mismo partido de la
 * ronda siguiente queden ADYACENTES — lo que permite dibujar la llave con líneas
 * conectoras coherentes. Estrategia en 3 niveles, de más a menos robusta:
 *   1. Plantilla fija del Mundial 2026 — CORRECTA aunque todos los ganadores ya
 *      se hayan propagado (no depende de los huecos), validada contra los huecos
 *      que aún siguen vivos.
 *   2. Derivación dinámica de los sourceSlot — cubre una eventual reprogramación
 *      del calendario que cambiara los slots cronológicos.
 *   3. Respaldo: el orden cronológico tal cual.
 */
export function treeOrderedRounds(rounds: BracketRound[]): BracketRound[] {
  const main = rounds.filter(r => r.id !== 'third' && r.matches.length > 0)
  if (main.length < 2) return main

  const byTemplate = orderByTemplate(main)
  if (byTemplate && isConsistentWithLiveSlots(byTemplate)) return byTemplate

  const byDynamic = orderByLiveSlots(main)
  if (byDynamic) return byDynamic

  return main
}
