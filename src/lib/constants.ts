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

// ── Reportajes ─────────────────────────────────────────────────────────────
// Interruptor de toda la sección. En `false`: no sale el bloque de la home,
// /reportajes redirige al feed, los reportajes quedan fuera de listados,
// buscador, sitemaps, RSS y API, y su ficha responde 404.
//
// Encendido desde el 05/10/2026 para la nota de Rafa Ferreira. Mientras tanto
// el del Cerezo Osaka sigue sin enseñarse: está publicado en Sanity pero espera
// la autorización del club y el PDF corregido, así que se oculta por su id.
// Cuando llegue ese visto bueno, basta con quitarlo de esta lista.
export const REPORTAJES_ENABLED = true

// Reportajes publicados en Sanity que NO se enseñan todavía (ids de documento).
export const REPORTAJES_OCULTOS: string[] = ['reportaje-cerezo-osaka-espanol']

// Fragmento GROQ que excluye esos ids. Va solo en las consultas que ya filtran
// por `type == "reportaje"` (bloque de la home, índice, API de la app) y en la
// ficha, que no pasan por REPORTAJE_GROQ_FILTER.
export const REPORTAJES_OCULTOS_GROQ = REPORTAJES_OCULTOS.length
  ? ` && !(_id in ${JSON.stringify(REPORTAJES_OCULTOS)})`
  : ''

// Fragmento GROQ para cualquier listado general. Se pega detrás del filtro de
// publicados de cada query. Con la sección apagada quita TODOS los reportajes
// (verificado contra el dataset: `type != "reportaje"` también deja pasar los
// que no tienen `type`, así que no hace falta coalesce); encendida, solo quita
// los ocultos.
export const REPORTAJE_GROQ_FILTER = REPORTAJES_ENABLED ? REPORTAJES_OCULTOS_GROQ : ' && type != "reportaje"'
