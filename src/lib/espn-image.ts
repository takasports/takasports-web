// ESPN sirve TODOS sus escudos a 500 px y sus caras a tamaño "full", pesen lo
// que pesen (un escudo de LaLiga son ~237 KB de PNG). En la web se pintan a
// 14-72 px, así que se descargaba entre 20 y 100 veces más de lo necesario:
// medido el 03/09/2026, la portada en un móvil se traía 6,4 MB en 108 imágenes
// de a.espncdn.com, y el selector de equipos favoritos él solo pinta ~100
// escudos.
//
// ESPN tiene un redimensionador público y gratuito, el "combiner", que ya se
// usaba en la ficha de UFC:
//   https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/357.png&w=40
// Medido: 237.616 → 3.884 bytes a 40 px. Es mejor que pasarlo por nuestro proxy
// porque no gasta ni CPU ni invocaciones nuestras.

const ESPN_HOST = 'a.espncdn.com'

/**
 * Reescribe una URL de imagen de ESPN para que la sirvan al ancho pedido.
 *
 * Devuelve la URL original si no es de ESPN, si ya pasa por el combiner o si no
 * se puede interpretar: nunca debe romper una imagen que hoy se ve.
 */
export function espnAt(url: string | null | undefined, width: number): string | undefined {
  if (!url) return undefined
  if (!url.includes(ESPN_HOST)) return url
  if (url.includes('/combiner/')) return url

  let u: URL
  try { u = new URL(url) } catch { return url }
  if (!u.pathname.startsWith('/i/')) return url

  // El combiner clampa por su cuenta, pero pedir algo absurdo no tiene sentido.
  const w = Math.max(16, Math.min(1000, Math.round(width)))
  return `https://${ESPN_HOST}/combiner/i?img=${u.pathname}&w=${w}`
}

/**
 * Anchos que Wikimedia sirve como miniatura. Desde 2025 solo genera tamaños
 * estándar: pedir `44px-` da 400, `60px-` funciona. Comprobado el 26/09/2026.
 */
const WIKIMEDIA_ANCHOS = [60, 120, 250, 330, 500, 960, 1280] as const

/**
 * La misma imagen, al tamaño en que se pinta, pero SOLO por la vía gratuita de
 * quien la sirve. Nunca pasa por nuestro proxy.
 *
 * Existe porque `smallImage()` manda todo lo que no es ESPN a
 * `/api/image-proxy`, que redimensiona con sharp en NUESTRAS funciones. Para un
 * avatar de 22 px eso es gastar dinero para ahorrar bytes. Aquí:
 *
 *   · ESPN      → su `combiner`, que redimensiona en su CDN.
 *   · Wikimedia → su miniatura estándar más pequeña que no se quede corta.
 *   · el resto  → la URL original, sin tocar.
 *
 * El caso que lo motivó: /comparar pintaba las caras de la NBA a tamaño completo
 * (unos 300 KB cada PNG) en círculos de 22 px: 8,3 MB por visita. /liga pedía la
 * foto de Wikimedia a 500 px (395 KB) para lo mismo.
 */
export function imagenPequenaGratis(src: string | null | undefined, anchoPintado: number): string | undefined {
  if (!src) return undefined
  if (src.includes(ESPN_HOST)) return espnAt(src, anchoPintado * 2)

  const m = src.match(/^(https:\/\/upload\.wikimedia\.org\/.+\/thumb\/.+\/)(\d+)px-([^/]+)$/)
  if (m) {
    const objetivo = anchoPintado * 2
    const ancho = WIKIMEDIA_ANCHOS.find((w) => w >= objetivo) ?? WIKIMEDIA_ANCHOS[WIKIMEDIA_ANCHOS.length - 1]
    if (ancho < Number(m[2])) return `${m[1]}${ancho}px-${m[3]}`
  }
  return src
}
