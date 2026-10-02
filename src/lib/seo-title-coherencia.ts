// ¿El `seoTitle` dice lo mismo que el titular? Comprobación BARATA, sin IA.
//
// El `<title>` que ve Google lo escribe un script aparte (scripts/auto-seo-title.mjs)
// reformulando o comprimiendo el titular con IA. A veces se inventa o mezcla:
// caso real, titular «Donovan Mitchell renueva con Adidas y firma extensión
// multimillonaria con los Cavs» → seoTitle «Donovan Mitchell renueva con los Cavs
// por 273 millones». Otras lo recorta a medias y deja una comilla abierta.
//
// Reglas, calibradas contra los 187 seoTitles de sep-2026 (marcan 2, ambos
// errores reales; la regla de "números que no están en el titular" se descartó
// porque saltaba con cada año y cada «ATP 250»):
//   · sin-palabras-comunes: no comparte NINGUNA palabra significativa (≥5 letras
//     o nombre propio) con el titular → habla de otra cosa.
//   · cifra-ajena: trae una cantidad (millones, euros, %) que el titular no da →
//     cifra posiblemente inventada.
//   · comillas-sin-cerrar / truncado: recorte mal hecho.

export type MotivoSeoTitle = 'sin-palabras-comunes' | 'cifra-ajena' | 'comillas-sin-cerrar' | 'truncado'

const STOPWORDS = new Set([
  'sobre', 'entre', 'contra', 'desde', 'hasta', 'durante', 'porque', 'cuando', 'donde',
  'quien', 'quienes', 'cuales', 'estos', 'estas', 'aquel', 'tiene', 'tienen', 'puede',
  'pueden', 'hacia', 'segun', 'antes', 'despues', 'ahora', 'todos', 'todas', 'otros',
  'otras', 'mismo', 'misma', 'nuevo', 'nueva', 'nuevos', 'nuevas', 'grande', 'grandes',
  'mejor', 'mejores', 'horario', 'partido', 'partidos', 'ultima', 'ultimo', 'ultimas',
  'ultimos', 'tras',
])

// Palabras con las que no acaba un título completo (señal de recorte).
const COLA_TRUNCADA = new Set([
  'y', 'e', 'o', 'u', 'de', 'del', 'la', 'el', 'los', 'las', 'en', 'con', 'por', 'para',
  'a', 'al', 'un', 'una', 'que', 'su', 'sus', 'sin', 'sobre', 'tras', 'ante', 'entre',
])

function normalizar(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function palabras(s: string): string[] {
  return s.match(/[\p{L}\p{N}']+/gu) ?? []
}

/**
 * Raíces (5 primeras letras) de las palabras significativas: ≥5 letras, nombres
 * propios de ≥3 (Cavs, City, Rossi) o números de 2+ cifras. La raíz tolera
 * «regresa/regresó» o «renueva/renovación» sin un lematizador.
 */
export function raicesSignificativas(s: string): Set<string> {
  const out = new Set<string>()
  for (const w of palabras(s)) {
    const n = normalizar(w).replace(/^'+|'+$/g, '')
    if (!n || STOPWORDS.has(n)) continue
    const propio = /^\p{Lu}/u.test(w) && n.length >= 3
    if (n.length >= 5 || propio || /^\d{2,}/.test(n)) out.add(n.slice(0, 5))
  }
  return out
}

// Cantidades de dinero o porcentajes: «273 millones», «50 M€», «12,5 %».
const CIFRA = /(\d+(?:[.,]\d+)*)\s*(millones|millón|mil millones|mil|m€|m\b|€|euros|dólares|dolares|\$|%|por ciento)/giu

function cifras(s: string): string[] {
  return [...s.matchAll(CIFRA)].map(m => m[1].replace(/[.,]/g, ''))
}

function comillasSinCerrar(s: string): boolean {
  const dobles = (s.match(/"/g) ?? []).length
  if (dobles % 2 === 1) return true
  if ((s.match(/«/g) ?? []).length !== (s.match(/»/g) ?? []).length) return true
  if ((s.match(/“/g) ?? []).length !== (s.match(/”/g) ?? []).length) return true
  // Simples: solo cuentan las que NO son apóstrofo (O'Reilly, Nico's).
  const simples = (s.replace(/(\p{L})'(\p{L})/gu, '$1$2').match(/'/g) ?? []).length
  return simples % 2 === 1
}

function truncado(s: string): boolean {
  const t = s.trim()
  if (/(\.\.\.|…|[,:;\-–—])$/.test(t)) return true
  const ps = palabras(t)
  const ultima = ps.length ? normalizar(ps[ps.length - 1]) : ''
  return COLA_TRUNCADA.has(ultima)
}

/** Motivos por los que el seoTitle no casa con el titular (vacío = bien). */
export function revisarSeoTitle(seoTitle: string, headline: string): MotivoSeoTitle[] {
  const motivos: MotivoSeoTitle[] = []
  const st = seoTitle.trim()
  const h = headline.trim()
  if (!st || !h) return motivos

  const comunes = [...raicesSignificativas(st)].filter(r => raicesSignificativas(h).has(r))
  if (comunes.length === 0) motivos.push('sin-palabras-comunes')

  const enTitular = new Set(cifras(h))
  if (cifras(st).some(c => !enTitular.has(c))) motivos.push('cifra-ajena')

  if (comillasSinCerrar(st)) motivos.push('comillas-sin-cerrar')
  if (truncado(st)) motivos.push('truncado')
  return motivos
}

export const ETIQUETA_MOTIVO: Record<MotivoSeoTitle, string> = {
  'sin-palabras-comunes': 'no comparte nada con el titular',
  'cifra-ajena': 'trae una cifra que el titular no da',
  'comillas-sin-cerrar': 'comillas sin cerrar',
  truncado: 'parece cortado',
}
