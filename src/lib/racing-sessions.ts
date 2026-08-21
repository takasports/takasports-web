// ── Qué sesión de un fin de semana de motor enseña el calendario ────────────
//
// ESPN modela un Gran Premio como UN evento con VARIAS `competitions`, una por
// sesión. El Dutch GP de 2026, leído el 21/08:
//
//   FP1   vie 10:30Z   STATUS_FINAL
//   SS    vie 14:30Z   STATUS_IN_PROGRESS   (clasificación del sprint)
//   SR    sáb 10:00Z   STATUS_SCHEDULED     (carrera al sprint)
//   Qual  sáb 14:00Z   STATUS_SCHEDULED
//   Race  dom 13:00Z   STATUS_SCHEDULED
//
// El calendario cogía `competitions[0]` — los LIBRES DEL VIERNES — y publicaba
// esa hora bajo el nombre del Gran Premio. Quien pusiera un recordatorio recibía
// el aviso el viernes por la mañana, no para la carrera del domingo. Y el estado
// que se leía era el de los libres, así que un GP podía darse por terminado el
// viernes, con "ganador" incluido, dos días antes de correrse.
//
// La sesión que representa al Gran Premio es la CARRERA. El resto del fin de
// semana no desaparece del producto: sigue estando en la ficha del evento.

/** Etiqueta en español de cada sesión, para la línea de contexto de la fila. */
const SESSION_ES: Record<string, string> = {
  Race: 'Carrera',
  Qual: 'Clasificación',
  SR: 'Sprint',
  SS: 'Clasificación del sprint',
  FP1: 'Libres 1',
  FP2: 'Libres 2',
  FP3: 'Libres 3',
}

export interface RacingSession {
  /** La `competition` elegida, tal cual viene de ESPN. */
  comp: Record<string, unknown>
  /** Etiqueta en español ("Carrera"), o undefined si la sesión no se reconoce. */
  label?: string
}

function sessionCode(comp: Record<string, unknown> | undefined): string | undefined {
  const type = comp?.type as Record<string, unknown> | undefined
  const abbr = type?.abbreviation
  if (typeof abbr === 'string' && abbr) return abbr
  const text = type?.text
  return typeof text === 'string' && text ? text : undefined
}

/**
 * Elige la sesión que representa al evento en el calendario: la CARRERA.
 *
 * Si ESPN no la trae (algún fin de semana con datos incompletos), se usa la
 * ÚLTIMA sesión publicada: siempre está más cerca del acto principal que los
 * primeros libres, que es lo que se cogía antes.
 */
export function pickRacingSession(competitions: unknown): RacingSession | null {
  if (!Array.isArray(competitions) || competitions.length === 0) return null
  const comps = competitions as Record<string, unknown>[]

  const race = comps.find(c => sessionCode(c) === 'Race')
  const chosen = race ?? comps[comps.length - 1]
  if (!chosen) return null

  const code = sessionCode(chosen)
  return { comp: chosen, label: code ? SESSION_ES[code] : undefined }
}
