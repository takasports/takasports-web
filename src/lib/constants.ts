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
