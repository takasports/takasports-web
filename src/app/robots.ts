import type { MetadataRoute } from 'next'
import { SITE_URL, LOGO_URL, ICON_URL } from '@/lib/constants'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/perfil/', '/admin/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
