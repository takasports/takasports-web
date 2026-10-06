// Versiones por idioma de los reportajes (prueba piloto, 06/10/2026).
//
// Cada versión es su propio documento de Sanity (campo `language`, enlace
// `translationOf` al original) con su propia URL: así Google puede indexarla y
// enlazarla con hreflang, y se puede editar a mano. Un reportaje solo existe en
// los idiomas que interesan («contenido dirigido»), no en todos.
//
// Este módulo es puro (sin DOM ni red) para poder probar la elección de idioma.

export type Idioma = 'es' | 'en'

export interface InfoIdioma {
  /** Etiqueta corta del selector. */
  etiqueta: string
  nombre: string
  /** Valor de hreflang / atributo lang. */
  html: string
  /** Valor de og:locale. */
  og: string
}

export const IDIOMAS: Record<Idioma, InfoIdioma> = {
  es: { etiqueta: 'ES', nombre: 'Español', html: 'es-ES', og: 'es_ES' },
  en: { etiqueta: 'EN', nombre: 'English', html: 'en', og: 'en_US' },
}

/** El original de todo reportaje; también el idioma de un documento sin `language`. */
export const IDIOMA_ORIGINAL: Idioma = 'es'

/** localStorage: elección HECHA por la persona con el selector (manda sobre todo). */
export const IDIOMA_CLAVE = 'taka_idioma'
/** sessionStorage: «te lo hemos cambiado nosotros» → muestra el aviso una vez. */
export const IDIOMA_AUTO_CLAVE = 'taka_idioma_auto'

export interface VersionIdioma {
  lang: string
  slug: string
}

export function esIdioma(x: unknown): x is Idioma {
  return x === 'es' || x === 'en'
}

// Países cuyo idioma mayoritario tenemos como versión posible. Lo que no está
// aquí no fuerza ningún idioma (se queda el de la página).
const PAISES_EN = new Set([
  'US', 'GB', 'CA', 'AU', 'NZ', 'IE', 'ZA', 'IN', 'SG', 'PH', 'NG', 'KE', 'GH', 'JM', 'MT',
])
const PAISES_ES = new Set([
  'ES', 'MX', 'AR', 'CO', 'CL', 'PE', 'VE', 'EC', 'UY', 'PY', 'BO', 'CR', 'PA', 'DO', 'GT',
  'HN', 'SV', 'NI', 'CU', 'PR', 'GQ',
])

export function idiomaDePais(pais?: string | null): Idioma | null {
  const cc = pais?.trim().toUpperCase()
  if (!cc) return null
  if (PAISES_ES.has(cc)) return 'es'
  if (PAISES_EN.has(cc)) return 'en'
  return null
}

/** «en-US» → «en». */
export function idiomaBase(tag: string): string {
  return tag.trim().toLowerCase().split(/[-_]/)[0]
}

export type MotivoIdioma = 'guardado' | 'navegador' | 'pais' | 'actual'

export interface EntradaElegirIdioma {
  /** Idioma de la página que se está viendo. */
  actual: string
  /** Idiomas en los que existe este reportaje (incluido `actual`). */
  disponibles: string[]
  /** Elección explícita guardada (localStorage). */
  guardado?: string | null
  /** navigator.languages, en orden de preferencia. */
  navegador?: readonly string[]
  /** País (ISO-2) detectado en el servidor. */
  pais?: string | null
}

/**
 * Orden: 1) lo que la persona eligió · 2) idioma del navegador · 3) idioma del
 * país · 4) el de la página. Siempre dentro de los idiomas que existen.
 */
export function elegirIdioma(e: EntradaElegirIdioma): { lang: string; motivo: MotivoIdioma } {
  const hay = (l?: string | null): l is string => !!l && e.disponibles.includes(l)

  if (hay(e.guardado)) return { lang: e.guardado, motivo: 'guardado' }

  for (const tag of e.navegador ?? []) {
    const base = idiomaBase(tag)
    if (hay(base)) return { lang: base, motivo: 'navegador' }
  }

  const dePais = idiomaDePais(e.pais)
  if (hay(dePais)) return { lang: dePais, motivo: 'pais' }

  return { lang: e.actual, motivo: 'actual' }
}

/** Rastreadores: nunca se les cambia de versión (Googlebot rastrea desde EE. UU.). */
export function esRastreador(userAgent?: string | null): boolean {
  if (!userAgent) return false
  return /bot|crawl|spider|slurp|mediapartners|facebookexternalhit|embedly|lighthouse|pagespeed|preview/i.test(userAgent)
}

/** Textos de la ficha de un artículo que dependen del idioma. */
export interface TextosFicha {
  minLectura: string
  minCorto: string
  por: string
  siguiente: string
  seguirLeyendo: string
  fuentes: string
  indice: string
  ahora: string
  ayer: string
  aviso: (idiomaMostrado: Idioma, motivo: MotivoIdioma) => { texto: string; volver: string }
}

export function textosFicha(lang?: string | null): TextosFicha {
  if (lang === 'en') {
    return {
      minLectura: 'min read',
      minCorto: 'min',
      por: 'By',
      siguiente: 'Next article',
      seguirLeyendo: 'Keep reading',
      fuentes: 'Sources',
      indice: 'In this article',
      ahora: 'Just now',
      ayer: 'Yesterday',
      aviso: (_i, motivo) => ({
        texto: motivo === 'pais'
          ? 'We’re showing the English edition based on your location.'
          : 'We’re showing the English edition based on your browser language.',
        volver: 'Read in Español',
      }),
    }
  }
  return {
    minLectura: 'min de lectura',
    minCorto: 'min',
    por: 'Por',
    siguiente: 'Siguiente artículo',
    seguirLeyendo: 'Sigue leyendo',
    fuentes: 'Fuentes',
    indice: 'En este artículo',
    ahora: 'Ahora mismo',
    ayer: 'Ayer',
    aviso: (_i, motivo) => ({
      texto: motivo === 'pais'
        ? 'Te mostramos la versión en español según tu ubicación.'
        : 'Te mostramos la versión en español según el idioma de tu navegador.',
      volver: 'Read in English',
    }),
  }
}

/** Mapa para hreflang: {es, en, x-default}. `versiones` son las OTRAS (sin la actual). */
export function mapaHreflang(
  siteUrl: string,
  actual: { lang: string; slug: string },
  versiones: readonly VersionIdioma[],
): Record<string, string> {
  const todas = [actual, ...versiones].filter(v => esIdioma(v.lang) && v.slug)
  const mapa: Record<string, string> = {}
  // La clave es el idioma a secas («es», «en»): «es-ES» solo apuntaría a España.
  for (const v of todas) mapa[v.lang] = `${siteUrl}/noticias/${v.slug}`
  const original = todas.find(v => v.lang === IDIOMA_ORIGINAL) ?? todas[0]
  if (original) mapa['x-default'] = `${siteUrl}/noticias/${original.slug}`
  return mapa
}
