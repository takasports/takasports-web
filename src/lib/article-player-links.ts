// Enlaza los nombres de jugadores del cuerpo de un artículo a su ficha.
//
// Por qué existe: medido en Search Console (28 días, 31/08/2026), el sitio
// posiciona sobre todo NOMBRES DE PERSONA — "arnau martínez" sale primero con
// 1.141 impresiones— y el lector aterriza en una noticia que no enlaza a ningún
// sitio sobre esa persona. La página de Arnau Martínez tenía 84 enlaces internos
// y NI UNO a la ficha de Arnau Martínez ni a la de su equipo. Un callejón sin
// salida: el visitante lee y se va.
//
// Además la noticia caduca y la búsqueda del nombre no: "rafael jódar" convierte
// al 19,4% porque es noticia de hoy, y "arnau martínez" al 2,3% con la misma
// posición porque su artículo es una negociación de hace semanas. La ficha SÍ es
// perenne, así que enlazarla sirve al lector y le dice a Google que existe.
//
// Cómo: se extraen del texto los candidatos a nombre propio (dos o tres palabras
// capitalizadas) y se preguntan a `sport_entities` EN BLOQUE. No se cargan los
// 27.000 jugadores en memoria: se pregunta solo por los que el artículo nombra.

import { canonicalPlayerSlug } from '@/lib/entity-slug'

/** Un fragmento de texto de PortableText. */
export interface PtSpan {
  _type?: string
  _key?: string
  text?: string
  marks?: string[]
}

/** Un bloque de PortableText. Se deja abierto: solo tocamos lo que entendemos.
 *  `_type` es obligatorio porque el `TypedObject` que espera <PortableText> lo
 *  exige; todo lo que sale de Sanity lo trae. */
export interface PtBlock {
  _type: string
  _key?: string
  style?: string
  children?: PtSpan[]
  markDefs?: Array<Record<string, unknown>>
  [k: string]: unknown
}

/** Tipo de la marca que añadimos. La pinta el componente del artículo. */
export const MARCA_JUGADOR = 'jugadorLink'

/** Cuántos enlaces como mucho por artículo. Más satura y huele a granja de enlaces. */
const MAX_ENLACES = 6

// Partículas que van EN MEDIO de un nombre sin ir capitalizadas: "Vinícius de
// Oliveira", "Marc van Bommel", "Luca di Maggio".
const PARTICULAS = 'de|del|la|las|los|da|das|do|dos|van|von|di|dello|della'

/**
 * Secuencias de 2-3 palabras capitalizadas, con partículas en medio. Captura
 * "Arnau Martínez", "Kylian Mbappé", "Vinícius de Oliveira". Unicode para que
 * las tildes y la Ñ cuenten como letra.
 */
const RE_NOMBRE = new RegExp(
  `\\p{Lu}[\\p{L}'’\\-]+(?:\\s+(?:${PARTICULAS})\\s+|\\s+)\\p{Lu}[\\p{L}'’\\-]+(?:\\s+\\p{Lu}[\\p{L}'’\\-]+)?`,
  'gu',
)

/** Texto plano de los bloques, para buscar candidatos. */
export function textoDeBloques(blocks: readonly PtBlock[]): string {
  return blocks
    .filter(b => b._type === 'block')
    .map(b => (b.children ?? []).map(c => c.text ?? '').join(''))
    .join('\n')
}

/**
 * Candidatos a nombre propio del texto. Devuelve el texto TAL CUAL aparece, sin
 * normalizar: es lo que se comparará contra `sport_entities`, que guarda los
 * nombres como los publica ESPN.
 */
export function extraerNombresCandidatos(texto: string, max = 40): string[] {
  const vistos = new Set<string>()
  const salida: string[] = []
  for (const m of texto.matchAll(RE_NOMBRE)) {
    const n = m[0].replace(/\s+/g, ' ').trim()
    if (n.length < 6 || vistos.has(n)) continue
    vistos.add(n)
    salida.push(n)
    if (salida.length >= max) break
  }
  return salida
}

/** Escapa un literal para meterlo en una expresión regular. */
function escapar(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Mete los enlaces en los bloques. Función PURA: recibe el mapa nombre→href ya
 * resuelto, así se puede probar sin base de datos.
 *
 * Reglas, todas por prudencia:
 *   · Solo párrafos normales — nada de titulares ni citas.
 *   · Un enlace por jugador y artículo, el primero que aparezca.
 *   · Nunca dentro de un fragmento que YA tiene una marca (negrita, cursiva,
 *     otro enlace): reescribirlo se comería el formato del editor.
 *   · Tope de MAX_ENLACES.
 */
export function enlazarJugadores(
  blocks: readonly PtBlock[],
  enlaces: ReadonlyMap<string, string>,
  max = MAX_ENLACES,
): PtBlock[] {
  if (enlaces.size === 0) return blocks as PtBlock[]

  const pendientes = new Map(enlaces)
  let puestos = 0
  let contador = 0

  return blocks.map(bloque => {
    if (puestos >= max) return bloque
    if (bloque._type !== 'block' || (bloque.style && bloque.style !== 'normal')) return bloque
    if (!bloque.children?.length) return bloque

    const nuevosHijos: PtSpan[] = []
    const nuevasDefs: Array<Record<string, unknown>> = []
    let tocado = false

    for (const hijo of bloque.children) {
      const texto = hijo.text ?? ''
      // Con marcas previas no se toca: partir el fragmento perdería el formato.
      if (!texto || (hijo.marks?.length ?? 0) > 0 || puestos >= max) {
        nuevosHijos.push(hijo)
        continue
      }

      let resto = texto
      let hizoAlgo = false

      // Se busca nombre a nombre, siempre sobre lo que queda del fragmento.
      while (puestos < max) {
        let mejor: { nombre: string; href: string; i: number } | null = null
        for (const [nombre, href] of pendientes) {
          const re = new RegExp(`(?<![\\p{L}])${escapar(nombre)}(?![\\p{L}])`, 'u')
          const m = re.exec(resto)
          if (m && (mejor === null || m.index < mejor.i)) mejor = { nombre, href, i: m.index }
        }
        if (!mejor) break

        const clave = `jl-${bloque._key ?? 'b'}-${contador++}`
        if (mejor.i > 0) nuevosHijos.push({ _type: 'span', _key: `${clave}-a`, text: resto.slice(0, mejor.i), marks: [] })
        nuevosHijos.push({ _type: 'span', _key: `${clave}-t`, text: mejor.nombre, marks: [clave] })
        nuevasDefs.push({ _key: clave, _type: MARCA_JUGADOR, href: mejor.href })
        resto = resto.slice(mejor.i + mejor.nombre.length)
        pendientes.delete(mejor.nombre)
        puestos++
        hizoAlgo = true
        tocado = true
      }

      if (hizoAlgo) {
        if (resto) nuevosHijos.push({ _type: 'span', _key: `jl-resto-${contador++}`, text: resto, marks: [] })
      } else {
        nuevosHijos.push(hijo)
      }
    }

    if (!tocado) return bloque
    return { ...bloque, children: nuevosHijos, markDefs: [...(bloque.markDefs ?? []), ...nuevasDefs] }
  })
}

interface FilaJugador { name: string; espn_id: string | null }

/**
 * Resuelve qué candidatos son jugadores nuestros. Una consulta por artículo.
 *
 * Un nombre que devuelve MÁS DE UNA fila se descarta: son homónimos y no hay
 * forma de saber cuál es. Enlazar al que no es sería peor que no enlazar — el
 * mismo motivo por el que la caché de fotos corrobora identidad.
 */
export async function resolverFichas(
  candidatos: readonly string[],
  db: {
    from: (t: string) => {
      select: (c: string) => {
        eq: (c: string, v: string) => { in: (c: string, v: readonly string[]) => PromiseLike<{ data: FilaJugador[] | null; error: unknown }> }
      }
    }
  } | null,
): Promise<Map<string, string>> {
  const salida = new Map<string, string>()
  if (!db || candidatos.length === 0) return salida

  const { data, error } = await db
    .from('sport_entities')
    .select('name, espn_id')
    .eq('type', 'player')
    .in('name', candidatos as string[])
  if (error || !data) return salida

  const porNombre = new Map<string, FilaJugador[]>()
  for (const f of data) {
    if (!f.espn_id) continue
    const arr = porNombre.get(f.name) ?? []
    arr.push(f)
    porNombre.set(f.name, arr)
  }

  for (const [nombre, filas] of porNombre) {
    const ids = new Set(filas.map(f => f.espn_id))
    if (ids.size !== 1) continue                       // homónimos → fuera
    salida.set(nombre, `/jugador/${canonicalPlayerSlug(nombre, filas[0].espn_id!)}`)
  }
  return salida
}
