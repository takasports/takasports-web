// Enlaza los términos del glosario que aparecen en el cuerpo de un artículo.
//
// Por qué existe: el glosario es el segundo activo del sitio en impresiones
// —202 páginas generan 244.362 en 90 días, más de la mitad de lo que hacen las
// 2.939 noticias— y convierte al 0,19%. Ninguna entrada llega al top 3: todas
// viven entre la posición 4 y la 10.
//
// Buscando por qué, salió esto: **NADA del sitio enlazaba al glosario**. Ni un
// artículo, ni una ficha. Doscientas páginas con cientos de miles de
// impresiones y cero enlaces internos. Eso es lo que las tiene ancladas.
//
// Medido sobre 500 artículos reales (31/08/2026): con las reglas de abajo, el
// 47% recibe al menos un enlace y salen 372 enlaces. Extrapolado al archivo
// entero son ~2.200 enlaces hacia 200 páginas que hoy no reciben ninguno.
//
// Las reglas son conservadoras a propósito, porque la primera medición sin
// ellas enlazaba "Juego" en 376 artículos —hacia una definición de TENIS en
// crónicas de fútbol—. Eso no es enlazado interno, es spam.

import { GLOSARIO_TERMS, type GlosarioTerm } from '@/lib/glosario-terms'

/**
 * Términos que además son palabras corrientes. Enlazarlos es ruido: el lector
 * no busca una definición de "juego" al leer "el juego del Madrid".
 */
const DEMASIADO_COMUNES = new Set([
  'juego', 'ventaja', 'perdida', 'pérdida', 'extremo', 'lateral', 'asistencia',
  'clasico', 'clásico', 'posesion', 'posesión', 'transicion', 'transición',
  'punto', 'set', 'falta', 'saque', 'pared', 'corte', 'bloqueo', 'marca',
  'centro', 'defensa', 'ataque', 'pase', 'tiro', 'base', 'alero', 'pivot',
  'doble', 'break', 'game', 'libero', 'líbero', 'interior', 'barrera',
])

/** Cuántos términos se enlazan como mucho por artículo. */
const MAX_GLOSARIO = 3

/** La etiqueta con la que el término aparece en prosa: sin el paréntesis. */
export function etiquetaDe(term: string): string {
  return term.replace(/\s*\([^)]*\)/g, '').trim()
}

/**
 * ¿Merece enlazarse este término? Multi-palabra siempre; una sola palabra solo
 * si es jerga larga y no está en la lista de corrientes.
 */
export function esEnlazable(etiqueta: string): boolean {
  const e = etiqueta.trim()
  if (!e || DEMASIADO_COMUNES.has(e.toLowerCase())) return false
  if (e.split(/\s+/).length >= 2) return true
  return e.length >= 6
}

/**
 * Términos del glosario mencionados en el texto, con su enlace.
 *
 * `deporte` es el `sport` del artículo y es lo que evita el desastre de enlazar
 * jerga de tenis en una crónica de fútbol: un término solo entra si es de ese
 * deporte o es general. Sin base de datos: el glosario es estático.
 */
export function enlacesDeGlosario(
  texto: string,
  deporte: string | null | undefined,
  max = MAX_GLOSARIO,
): Map<string, string> {
  const salida = new Map<string, string>()
  if (!texto) return salida
  const dep = (deporte ?? '').trim().toLowerCase()

  // Los más largos primero: si un artículo dice "tanda de penaltis", se enlaza
  // eso y no el "penalti" suelto que va dentro.
  const candidatos = (GLOSARIO_TERMS as readonly GlosarioTerm[])
    .filter(t => t.sport === 'general' || t.sport === dep)
    .map(t => ({ etiqueta: etiquetaDe(t.term), slug: t.slug }))
    .filter(t => esEnlazable(t.etiqueta))
    .sort((a, b) => b.etiqueta.length - a.etiqueta.length)

  for (const { etiqueta, slug } of candidatos) {
    if (salida.size >= max) break
    // Ya cubierto por un término más largo que contiene a este.
    if ([...salida.keys()].some(y => y.toLowerCase().includes(etiqueta.toLowerCase()))) continue
    const re = new RegExp(`(?<![\\p{L}])${etiqueta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'iu')
    if (re.test(texto)) salida.set(etiqueta, `/glosario/${slug}`)
  }
  return salida
}
