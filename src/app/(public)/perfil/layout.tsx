import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/constants'

// ── RENDER DINÁMICO OBLIGATORIO — no quitar ────────────────────────────────
// `/perfil/:path*` está en el matcher de `src/middleware.ts`, que emite un CSP
// con un `nonce` NUEVO en cada request. Next solo puede escribir ese nonce en
// sus <script> inline cuando renderiza la página EN esa misma request.
//
// Las páginas de este segmento son cascarones `'use client'` sin lectura de
// sesión en servidor, así que Next las prerenderizaba y el CDN las servía
// cacheadas (`x-nextjs-prerender: 1`, `x-vercel-cache: HIT`): HTML sin ningún
// nonce + cabecera CSP con nonce = el navegador bloqueaba los 21 scripts
// inline, la página no hidrataba y el visitante SIN SESIÓN se quedaba para
// siempre en el esqueleto de `loading.tsx`. Medido en producción el 03/09/2026
// en escritorio, tablet y móvil; `/login` y `/auth` redirigen aquí, así que era
// la puerta de entrada rota.
//
// Las demás rutas del matcher (`/admin`, `/archivo`) no sufrían el fallo porque
// leen la sesión en servidor y eso ya las hacía dinámicas por sí solo.
//
// Alternativas descartadas: sacar `/perfil` del matcher (perdería el CSP con
// nonce en una página con datos personales) y renunciar al nonce (dejaría el
// `'unsafe-inline'` del CSP estático). El coste real de esto es el TTFB de una
// página noindex y personal, que además ya invocaba el middleware en cada
// request aunque el HTML viniera de caché.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Mi Perfil',
  description: 'Tu perfil en TakaSports: recordatorios, tus predicciones, actividad reciente y preferencias.',
  alternates: { canonical: `${SITE_URL}/perfil` },
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Mi Perfil | TakaSports',
    description: 'Tus predicciones, actividad reciente y preferencias en TakaSports.',
    url: `${SITE_URL}/perfil`,
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: { card: 'summary', title: 'Mi Perfil | TakaSports', site: '@takasportsx' },
}

export default function PerfilLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
