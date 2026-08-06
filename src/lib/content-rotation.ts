// ─────────────────────────────────────────────────────────────────
// ROTACIÓN DE CONTENIDO — baraja, no dado.
//
// Los cuatro minijuegos elegían el contenido del día/semana con
// `Math.floor(rand(semilla_de_fecha) * N)`: una tirada de dado INDEPENDIENTE
// por fecha, es decir, con reposición. Con eso:
//
//   · TakaGrid (50 puzzles): en 90 días solo salían 42 distintos, uno salía 5
//     veces y había DÍAS CONSECUTIVOS con el mismo grid (22 y 23 de agosto de
//     2026, y otra vez el 10 y 11 de octubre).
//   · Mi Once (48 tableros): en un año natural solo se usaban 27 de los 48.
//   · Sopa (13 puzzles): `semana % 13` → el mismo puzzle en la misma semana
//     cada año, siempre en el mismo orden.
//
// Aquí se sustituye por una BOLSA: una permutación determinista del catálogo
// que se recorre entera antes de repetir nada, y que se rebaraja en cada ciclo
// (así el orden no es el mismo año tras año). Además se evita que el último
// elemento de un ciclo sea el primero del siguiente, que es el único punto
// donde una bolsa podría repetir en días seguidos.
//
// Todo determinista: la misma fecha da el mismo contenido en web, en app y en
// el servidor, sin estado compartido.
// ─────────────────────────────────────────────────────────────────

// ── PRNG ─────────────────────────────────────────────────────────

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6D2B79F5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Permutación de [0..size-1] barajada (Fisher-Yates) con semilla propia. */
function rawPermutation(size: number, seed: number): number[] {
  const a = Array.from({ length: size }, (_, i) => i)
  const rand = mulberry32(seed)
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Permutación del ciclo `cycle`, reparada en la COSTURA con el ciclo anterior.
 *
 * Sin reparar, la bolsa solo garantiza "no repetir dentro de un ciclo": un
 * elemento al final del ciclo k podía volver a salir nada más empezar el k+1 —
 * justo el defecto que veníamos a arreglar. La reparación expulsa de la primera
 * mitad del ciclo nuevo todo lo que salió en la última mitad del anterior, así
 * que **nada se repite dentro de una ventana de `size/2` fechas**.
 *
 * OJO: la comparación tiene que ser contra la permutación REPARADA del ciclo
 * anterior, no contra su versión cruda (la reparación cambia precisamente qué
 * hay en esa última mitad). Por eso la cadena se calcula desde el ciclo 0 y se
 * memoiza: los ciclos son pocos (un juego diario de 50 puzzles gasta ~7 al año)
 * y cada uno es O(size).
 */
const permCache = new Map<string, number[][]>()

function permutationFor(size: number, cycle: number, salt: number): number[] {
  if (cycle < 0) return rawPermutation(size, hash(cycle, salt))

  const key = `${size}:${salt}`
  let chain = permCache.get(key)
  if (!chain) { chain = []; permCache.set(key, chain) }

  for (let k = chain.length; k <= cycle; k++) {
    const perm = rawPermutation(size, hash(k, salt))
    if (size <= 2 || k === 0) { chain.push(perm); continue }

    const half = Math.floor(size / 2)
    const prev = chain[k - 1]
    const recent = new Set(prev.slice(size - half))   // lo visto hace poco

    // La primera mitad se llena con elementos NO recientes (siempre hay de
    // sobra: los no recientes son size - half ≥ half). El resto conserva el
    // orden barajado, así que no se introduce ningún sesgo fijo.
    const head = perm.filter(x => !recent.has(x)).slice(0, half)
    const headSet = new Set(head)
    chain.push([...head, ...perm.filter(x => !headSet.has(x))])
  }

  return chain[cycle]
}

function hash(cycle: number, salt: number): number {
  // Mezcla barata pero suficiente para que ciclos contiguos no correlacionen.
  return Math.imul(cycle + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca6b)
}

// ── API ──────────────────────────────────────────────────────────

/**
 * Saca `count` elementos DISTINTOS de una bolsa de `size`, para la posición
 * `ordinal` de la serie (día o semana absolutos). Recorre toda la bolsa antes
 * de repetir; el orden se rebaraja en cada vuelta.
 *
 * @param salt  Diferencia bolsas independientes (p. ej. una por dificultad).
 */
export function bagDraw(ordinal: number, count: number, size: number, salt = 0): number[] {
  if (size <= 0 || count <= 0) return []
  if (count >= size) return Array.from({ length: size }, (_, i) => i)

  const out: number[] = []
  const seen = new Set<number>()
  let global = ordinal * count
  // El corte de ciclo puede caer dentro de una misma tirada: dos permutaciones
  // distintas podrían dar el mismo índice. Se avanza hasta completar sin
  // repetidos (tope defensivo para no iterar sin fin).
  for (let guard = 0; out.length < count && guard < size * 2; guard++, global++) {
    const cycle = Math.floor(global / size)
    const pos = ((global % size) + size) % size
    const idx = permutationFor(size, cycle, salt)[pos]
    if (seen.has(idx)) continue
    seen.add(idx)
    out.push(idx)
  }
  return out
}

/** Un solo elemento de la bolsa (juegos de un puzzle por fecha). */
export function bagPick(ordinal: number, size: number, salt = 0): number {
  return bagDraw(ordinal, 1, size, salt)[0] ?? 0
}

// ── Ordinales de fecha ───────────────────────────────────────────

/** Días absolutos desde 1970-01-01 a partir de "YYYY-MM-DD". */
export function dayOrdinal(dayISO: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayISO)
  if (!m) return 0
  return Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86400000)
}

/**
 * Semanas absolutas a partir de "YYYY-Www" (año ISO + semana ISO). Se resuelve
 * al lunes de esa semana y se cuenta en semanas desde la época — así el paso de
 * año (52 vs 53 semanas) no rompe la serie.
 */
export function weekOrdinal(weekISO: string): number {
  const m = /^(\d{4})-W(\d{2})$/.exec(weekISO)
  if (!m) return 0
  const year = Number(m[1])
  const week = Number(m[2])
  // Jueves de la semana 1 ISO = el que cae en la misma semana que el 4 de enero.
  const jan4 = Date.UTC(year, 0, 4)
  const jan4Dow = new Date(jan4).getUTCDay() || 7          // Lun=1 … Dom=7
  const week1Monday = jan4 - (jan4Dow - 1) * 86400000
  const monday = week1Monday + (week - 1) * 7 * 86400000
  return Math.floor(monday / 86400000 / 7)
}

// ── Corte de migración ───────────────────────────────────────────
//
// La rotación nueva cambia QUÉ contenido toca cada fecha. Aplicarla hacia atrás
// tendría dos efectos feos: a quien esté a media partida le cambiaría el puzzle
// bajo los pies, y el archivo de TakaGrid (`/takagrid/[fecha]`) mostraría un
// grid distinto del que se jugó ese día. Por eso las fechas anteriores al corte
// conservan la fórmula vieja.

/** Primer día con rotación de bolsa (hora Taka). Mañana respecto al despliegue:
 *  quien tenga hoy una rejilla a medias la termina con el puzzle que empezó. */
export const ROTATION_FROM_DAY = '2026-08-08'
/** Primera semana ISO con rotación de bolsa. La semana en curso (W32) se
 *  respeta entera por lo mismo: hay sopas y onces a medias. */
export const ROTATION_FROM_WEEK = '2026-W33'

export function useBagForDay(dayISO: string): boolean {
  return dayOrdinal(dayISO) >= dayOrdinal(ROTATION_FROM_DAY)
}

export function useBagForWeek(weekISO: string): boolean {
  return weekOrdinal(weekISO) >= weekOrdinal(ROTATION_FROM_WEEK)
}
