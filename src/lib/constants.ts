export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.takasportsmedia.com'

export const SITE_NAME = 'TakaSports'
export const TWITTER_HANDLE = '@takasportsx'
export const LOGO_URL = `${SITE_URL}/taka-logo.png`
export const ICON_URL = `${SITE_URL}/icon.png`

// Perfiles sociales oficiales, URL canónica (sin parámetros de tracking). Fuente única
// para el `sameAs` de TODOS los nodos JSON-LD (organización, autor de artículo, redacción).
// Antes cada nodo llevaba su propia lista: el handle de Instagram divergía
// ("taka.sports" vs el erróneo "takasportsmedia") y Facebook faltaba — señales de entidad
// contradictorias que perjudican la consolidación en el Knowledge Graph.
export const SOCIAL_SAMEAS = [
  'https://www.instagram.com/taka.sports',
  'https://x.com/takasportsx',
  'https://www.facebook.com/share/17RW4CPeNy/',
  'https://www.tiktok.com/@taka.sports',
  'https://www.youtube.com/@takasports',
  'https://www.threads.net/@taka.sports',
]

// ── Reportajes en pausa ────────────────────────────────────────────────────
// El recinto de piezas de fondo no se enseña hasta que haya con qué llenarlo.
// En `false`: no sale el bloque de la home, /reportajes redirige al feed, los
// reportajes quedan fuera de listados, buscador, sitemaps, RSS y API, y su
// ficha responde 404. Poner a `true` lo devuelve todo tal cual estaba.
export const REPORTAJES_ENABLED = false

// Fragmento GROQ que quita los reportajes de cualquier listado mientras dure la
// pausa. Se pega detrás del filtro de publicados de cada query. Verificado
// contra el dataset: `type != "reportaje"` también deja pasar los que no tienen
// `type` (2.989 de 2.990 documentos), así que no hace falta coalesce.
export const REPORTAJE_GROQ_FILTER = REPORTAJES_ENABLED ? '' : ' && type != "reportaje"'
