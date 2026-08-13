// Minutos de lectura estimados. Se calcula sobre el número de PALABRAS, que las
// queries piden con length(string::split(pt::text(body), " ")) para no arrastrar
// el cuerpo entero hasta un listado.
//
// 200 ppm es el ritmo habitual de lectura en pantalla para prosa larga, y es el
// mismo divisor que usa la cabecera de la ficha de artículo: así el bloque de la
// home y el artículo nunca se contradicen (contar caracteres y dividir por una
// media de letras por palabra daba 7 min donde la ficha decía 6).
const WORDS_PER_MINUTE = 200

export function readingMinutes(words?: number | null): number | null {
  if (!words || words <= 0) return null
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE))
}

export function readingLabel(words?: number | null): string | null {
  const min = readingMinutes(words)
  return min ? `${min} min de lectura` : null
}
