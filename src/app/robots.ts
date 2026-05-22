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

// Bots de IA/LLM training: opcional bloquearlos (no traen tráfico).
const AI_TRAINING_BOTS = [
  'GPTBot',
  'ClaudeBot',
  'anthropic-ai',
  'CCBot',
  'PerplexityBot',
  'Bytespider',
  'Amazonbot',
  'cohere-ai',
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
    ],
    sitemap: [
      `${SITE_URL}/sitemap.xml`,
      `${SITE_URL}/news-sitemap.xml`,
      `${SITE_URL}/image-sitemap.xml`,
      `${SITE_URL}/video-sitemap.xml`,
    ],
  }
}
