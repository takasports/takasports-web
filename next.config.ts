import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Canonical domain: non-www → www (permanent 301 for SEO link equity)
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'takasportsmedia.com' }],
        destination: 'https://www.takasportsmedia.com/:path*',
        permanent: true,
      },
      {
        source: '/article/:slug',
        destination: '/noticias/:slug',
        permanent: true,
      },
    ]
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.sanity.io" },
      { protocol: "https", hostname: "*.cdninstagram.com" },
      { protocol: "https", hostname: "*.fbcdn.net" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "a.espncdn.com" },
      { protocol: "https", hostname: "*.espncdn.com" },
      { protocol: "https", hostname: "media.api-sports.io" },
      { protocol: "https", hostname: "*.cloudfront.net" },
      { protocol: "https", hostname: "pbs.twimg.com" },
      { protocol: "https", hostname: "*.twimg.com" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "media.diariolasamericas.com" },
      { protocol: "https", hostname: "*.rtve.es" },
      { protocol: "https", hostname: "www.fichajes.net" },
    ],
  },
  async headers() {
    // `unsafe-eval` solo es necesario en desarrollo (HMR de Next, Fast Refresh).
    // En producción lo eliminamos para reducir la superficie de XSS — un atacante
    // que consiga inyectar un script via tags HTML ya no puede ejecutar `eval()`
    // ni `new Function()`. Mantenemos `'unsafe-inline'` porque Next 16 todavía
    // emite scripts inline para hydration; migrar a CSP basada en nonce queda
    // como deuda técnica (script-loader.tsx custom o `experimental.cspNonce`).
    const isDev = process.env.NODE_ENV !== 'production'
    const scriptSrc = isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.clarity.ms"
      : "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.clarity.ms"

    const csp = [
      "default-src 'self'",
      // Next.js inline scripts + (dev) HMR + GA + Clarity
      scriptSrc,
      // Tailwind/inline styles
      "style-src 'self' 'unsafe-inline'",
      // Imágenes: CDNs conocidos + data URIs (favicons, placeholders)
      "img-src 'self' data: blob: https:",
      // Fuentes locales
      "font-src 'self' data:",
      // API calls: Supabase, Sanity, ESPN, api-sports, Instagram, Odds
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.sanity.io https://cdn.sanity.io https://site.api.espn.com https://v3.football.api-sports.io https://v2.nba.api-sports.io https://v1.formula-1.api-sports.io https://v1.tennis.api-sports.io https://v1.mma.api-sports.io https://v1.rugby.api-sports.io https://api.the-odds-api.com https://graph.instagram.com https://api.instagram.com https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://*.clarity.ms",
      // Web Push service worker
      "worker-src 'self'",
      // Iframes: solo embed oficial de Instagram (reels)
      "frame-src https://www.instagram.com",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    // Cache-Control explícito en rutas de contenido.
    //
    // Contexto: el root layout hace `await headers()` para leer el nonce CSP,
    // lo que marca TODA la app como dinámica → Next devuelve por defecto
    // `cache-control: private, no-cache, no-store, max-age=0, must-revalidate`.
    // Eso es catastrófico para SEO: Googlebot lo interpreta como "no almacenar
    // ni mantener fresca esta URL en el índice" y deja de mantenerla indexada.
    //
    // Solución: sobrescribir el header en rutas que sí son cacheables (no hay
    // contenido personalizado por usuario en el SSR — la auth corre en cliente).
    // Vercel CDN respeta este header pese a que la ruta sea técnicamente dinámica.
    const contentCache = "public, s-maxage=600, stale-while-revalidate=86400"
    const articleCache = "public, s-maxage=600, stale-while-revalidate=86400"
    const fastCache    = "public, s-maxage=120, stale-while-revalidate=3600"   // datos live (partidos, calendario)
    const slowCache    = "public, s-maxage=3600, stale-while-revalidate=86400" // páginas evergreen

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
      // ── Noticias: artículos cacheables 10min, SWR 24h ──
      { source: "/noticias/:slug*",            headers: [{ key: "Cache-Control", value: articleCache }] },
      { source: "/tag/:tag*",                  headers: [{ key: "Cache-Control", value: contentCache }] },
      // ── Datos en vivo: 2min de cache, SWR 1h ──
      { source: "/partido/:ref*",              headers: [{ key: "Cache-Control", value: fastCache }] },
      { source: "/calendario/:path*",          headers: [{ key: "Cache-Control", value: fastCache }] },
      { source: "/estadisticas/:path*",        headers: [{ key: "Cache-Control", value: fastCache }] },
      { source: "/liga/:id*",                  headers: [{ key: "Cache-Control", value: fastCache }] },
      // ── Hubs de entidades: 10min ──
      { source: "/equipo/:slug*",              headers: [{ key: "Cache-Control", value: contentCache }] },
      { source: "/jugador/:slug*",             headers: [{ key: "Cache-Control", value: contentCache }] },
      { source: "/evento/:id*",                headers: [{ key: "Cache-Control", value: contentCache }] },
      { source: "/rankings/:path*",            headers: [{ key: "Cache-Control", value: contentCache }] },
      { source: "/reels",                      headers: [{ key: "Cache-Control", value: contentCache }] },
      // ── Hubs por deporte y home ──
      { source: "/",                           headers: [{ key: "Cache-Control", value: contentCache }] },
      { source: "/futbol",                     headers: [{ key: "Cache-Control", value: contentCache }] },
      { source: "/baloncesto",                 headers: [{ key: "Cache-Control", value: contentCache }] },
      { source: "/f1",                         headers: [{ key: "Cache-Control", value: contentCache }] },
      { source: "/motogp",                     headers: [{ key: "Cache-Control", value: contentCache }] },
      { source: "/tenis",                      headers: [{ key: "Cache-Control", value: contentCache }] },
      { source: "/ufc",                        headers: [{ key: "Cache-Control", value: contentCache }] },
      { source: "/mundial",                    headers: [{ key: "Cache-Control", value: contentCache }] },
      // ── Páginas evergreen: 1h ──
      { source: "/sobre",                      headers: [{ key: "Cache-Control", value: slowCache }] },
      { source: "/politica-editorial",         headers: [{ key: "Cache-Control", value: slowCache }] },
      { source: "/privacidad",                 headers: [{ key: "Cache-Control", value: slowCache }] },
      { source: "/terminos",                   headers: [{ key: "Cache-Control", value: slowCache }] },
      { source: "/glosario/:slug*",            headers: [{ key: "Cache-Control", value: slowCache }] },
      { source: "/autor/:path*",               headers: [{ key: "Cache-Control", value: slowCache }] },
    ];
  },
};

export default nextConfig;
