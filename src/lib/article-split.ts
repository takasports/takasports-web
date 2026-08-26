// Dónde partir el cuerpo de un artículo para colar la llamada a compartir.
//
// El bloque del final solo lo ve quien termina de leer, que es poca gente. Este
// otro aparece a mitad de lectura. Pero no vale meterlo en cualquier hueco:
//   · En una nota corta caería casi pegado al del final → cargante. Mínimo 10
//     bloques (los long-form del pipeline traen entre 14 y 43).
//   · Tiene que ir ANTES de un párrafo normal: partir dentro de una lista, justo
//     encima de una imagen o de un widget deja el corte a la vista.
//   · Y no justo después de un titular, que dejaría el epígrafe huérfano
//     separado de su primer párrafo.

interface Block { _type?: string; style?: string; listItem?: string }

const MIN_BLOCKS = 10
const TARGET = 0.45          // proporción del cuerpo donde se busca el hueco
const TAIL_GUARD = 3         // nunca en los últimos bloques

function isPlainParagraph(b: Block | undefined): boolean {
  return !!b && b._type === 'block' && !b.listItem && (b.style === 'normal' || b.style === undefined)
}

function isHeading(b: Block | undefined): boolean {
  return !!b && b._type === 'block' && typeof b.style === 'string' && /^h[1-6]$/.test(b.style)
}

/**
 * Índice del bloque ANTE el que insertar la llamada, o `null` si el artículo no
 * da para ello.
 */
export function storySplitIndex(blocks: Block[] | null | undefined): number | null {
  if (!blocks || blocks.length < MIN_BLOCKS) return null
  const limit = blocks.length - TAIL_GUARD
  const start = Math.round(blocks.length * TARGET)

  for (let i = start; i < limit; i++) {
    if (isPlainParagraph(blocks[i]) && !isHeading(blocks[i - 1])) return i
  }
  // Hacia atrás si la segunda mitad era toda listas/imágenes.
  for (let i = start - 1; i > 2; i--) {
    if (isPlainParagraph(blocks[i]) && !isHeading(blocks[i - 1])) return i
  }
  return null
}
