import type { MetadataRoute } from 'next'
import { SITE_URL, LOGO_URL, ICON_URL } from '@/lib/constants'

// Bots scrapers de SEO comercial (Ahrefs, Semrush, Moz, etc.). Crawlean
// agresivamente nuestro sitio pero NO aportan tráfico ni indexan en buscadores
// reales. Bloquearlos reduce Edge Requests sin coste para usuarios reales.
const SEO_SCRAPERS = [
  'AhrefsBot',
  'SemrushBot',
  'MJ12bot',
  'DotBot',
  'BLEXBot',
  'PetalBot',
  'YandexBot',
  'SeznamBot',
  'DataForSeoBot',
  'serpstatbot',
  'ZoominfoBot',
]

// Bots de IA de ENTRENAMIENTO puro: bloqueados (consumen el contenido sin
// devolver tráfico ni citar la fuente). NOTA: Google-Extended NO se bloquea
// a propósito, para seguir apareciendo en las AI Overviews de Google.
const AI_TRAINING_BOTS = [
  'GPTBot',        // OpenAI — entrenamiento
  'ClaudeBot',     // Anthropic — entrenamiento
  'anthropic-ai',
  'CCBot',         // Common Crawl
  'Bytespider',    // ByteDance
  'Amazonbot',
  'cohere-ai',
]

// Bots de IA de BÚSQUEDA con citación: PERMITIDOS explícitamente. Enlazan a la
// fuente, así que aparecer en ChatGPT Search / Perplexity es tráfico de
// descubrimiento gratis para un medio joven. (Fase 3 SEO — decisión del dueño,
// jun 2026). Se les da el mismo acceso que a un crawler normal (sin zonas
// privadas). PerplexityBot estaba bloqueado por error y aquí se reactiva.
const AI_SEARCH_BOTS = [
  'PerplexityBot',
  'Perplexity-User',
  'OAI-SearchBot',
  'ChatGPT-User',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Búsqueda + APIs + áreas privadas: nadie debe crawlearlas.
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/perfil/', '/admin/', '/buscar', '/buscar/'],
      },
      // Scrapers SEO: bloqueo total.
      ...SEO_SCRAPERS.map(userAgent => ({ userAgent, disallow: '/' })),
      // Bots de entrenamiento IA: bloqueo total.
      ...AI_TRAINING_BOTS.map(userAgent => ({ userAgent, disallow: '/' })),
      // Bots de búsqueda IA con citación: mismo acceso que un crawler normal.
      ...AI_SEARCH_BOTS.map(userAgent => ({
        userAgent,
        allow: '/',
        disallow: ['/api/', '/perfil/', '/admin/', '/buscar', '/buscar/'],
      })),
    ],
    sitemap: [
      `${SITE_URL}/sitemap.xml`,
      `${SITE_URL}/news-sitemap.xml`,
      `${SITE_URL}/image-sitemap.xml`,
      `${SITE_URL}/video-sitemap.xml`,
    ],
  }
}
