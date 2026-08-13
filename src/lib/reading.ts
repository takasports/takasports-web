// Minutos de lectura estimados a partir del número de caracteres del cuerpo.
// Se calcula sobre `readChars` (que las queries de Sanity devuelven con
// length(pt::text(body))) para no arrastrar el body entero hasta un listado.
//
// 5,3 caracteres por palabra es la media del español escrito contando el
// espacio; 200 ppm es el ritmo de lectura habitual en pantalla para prosa
// larga. Redondeamos hacia arriba y nunca bajamos de 1 min.
const CHARS_PER_WORD = 5.3
const WORDS_PER_MINUTE = 200

export function readingMinutes(chars?: number | null): number | null {
  if (!chars || chars <= 0) return null
  return Math.max(1, Math.round(chars / CHARS_PER_WORD / WORDS_PER_MINUTE))
}

export function readingLabel(chars?: number | null): string | null {
  const min = readingMinutes(chars)
  return min ? `${min} min de lectura` : null
}
