import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Oculta la cabecera `X-Powered-By: Next.js` en todas las respuestas: no
  // revelar el framework reduce la superficie de fingerprinting/ataques dirigidos.
  poweredByHeader: false,
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
      // Alias naturales de hubs de deporte → slug canónico (antes daban 404)
      { source: '/f1', destination: '/formula1', permanent: true },
      { source: '/mma', destination: '/ufc', permanent: true },
      { source: '/lucha-libre', destination: '/wwe', permanent: true },
      // Estadísticas: las landings pasaron de ?sport=X (no cacheable) a rutas de
      // path /estadisticas/X (cacheables). Reenviamos 308 las direcciones viejas
      // (sitemap + enlaces + lo ya indexado en Google) para conservar el SEO.
      { source: '/estadisticas', has: [{ type: 'query', key: 'sport', value: 'futbol' }], destination: '/estadisticas/futbol', permanent: true },
      { source: '/estadisticas', has: [{ type: 'query', key: 'sport', value: 'football' }], destination: '/estadisticas/futbol', permanent: true },
      { source: '/estadisticas', has: [{ type: 'query', key: 'sport', value: 'selecciones' }], destination: '/estadisticas/futbol', permanent: true },
      { source: '/estadisticas', has: [{ type: 'query', key: 'sport', value: 'femenino' }], destination: '/estadisticas/futbol', permanent: true },
      { source: '/estadisticas', has: [{ type: 'query', key: 'sport', value: 'baloncesto' }], destination: '/estadisticas/baloncesto', permanent: true },
      { source: '/estadisticas', has: [{ type: 'query', key: 'sport', value: 'nba' }], destination: '/estadisticas/baloncesto', permanent: true },
      { source: '/estadisticas', has: [{ type: 'query', key: 'sport', value: 'f1' }], destination: '/estadisticas/f1', permanent: true },
      { source: '/estadisticas', has: [{ type: 'query', key: 'sport', value: 'tenis' }], destination: '/estadisticas/tenis', permanent: true },
      { source: '/estadisticas', has: [{ type: 'query', key: 'sport', value: 'tennis' }], destination: '/estadisticas/tenis', permanent: true },
      { source: '/estadisticas', has: [{ type: 'query', key: 'sport', value: 'motogp' }], destination: '/estadisticas/motogp', permanent: true },
      { source: '/estadisticas', has: [{ type: 'query', key: 'sport', value: 'ufc' }], destination: '/estadisticas/ufc', permanent: true },
      { source: '/estadisticas', has: [{ type: 'query', key: 'sport', value: 'mundial' }], destination: '/estadisticas/mundial', permanent: true },
      // Rutas de auth: ninguna es una página real — el login/registro se gestiona
      // desde el AuthModal en /perfil. Varios CTAs (hero del Mundial, ligas, juegos)
      // y los 401 de la web apuntan a estas rutas; sin estos redirects, /auth y
      // /auth/register daban 404. Enviamos todas a /perfil con ?login para que el
      // modal se auto-abra (perfil lee ?login), en el modo adecuado. La query extra
      // (?next=, ?from=) se preserva y se mergea automáticamente por Next.
      { source: '/login',         destination: '/perfil?login=1',        permanent: false },
      { source: '/auth',          destination: '/perfil?login=1',        permanent: false },
      { source: '/auth/login',    destination: '/perfil?login=1',        permanent: false },
      { source: '/auth/register', destination: '/perfil?login=register', permanent: false },
    ]
  },
  images: {
    // AVIF antes que WebP: ~20-30% menos bytes en heros/imágenes sin tocar un
    // solo asset. Next sirve AVIF a navegadores que lo soporten y cae a WebP.
    formats: ["image/avif", "image/webp"],
    // Caché de la imagen YA optimizada: 31 días. Sin esto Next usa el default de
    // 60s → Vercel RE-OPTIMIZA (= re-cobra transformación) la misma imagen pasado
    // 1 min. Con 31d, cada (imagen, tamaño, formato) se transforma una sola vez al
    // mes. Las imágenes son estáticas (fotos de jugadores/equipos/artículos); si
    // una cambia, su URL de origen cambia → nueva clave de caché. Ahorro directo
    // en la métrica con tope (transformaciones), 0 impacto visual.
    minimumCacheTTL: 2678400,
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
      // Avatares de creadores/jugadores (rankings, buscador) vía unavatar.io
      { protocol: "https", hostname: "unavatar.io" },
      // Supabase Storage — habilitado en F3.2 (jun 2026) para optimizar
      // imágenes de artículos via Next/Image (WebP + responsive sizing).
      // Ahorro medido en PSI: ~516 KiB por imagen hero. Tráfico actual
      // 150 clicks/mes → ~3k transformaciones únicas, dentro del free tier
      // de Vercel Image Optimization (5k/mes).
      { protocol: "https", hostname: "*.supabase.co" },
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

    // NOTA: el Cache-Control se setea desde middleware.ts (Vercel sobrescribe
    // los headers de next.config.ts con el `no-store` que Next emite a runtime
    // para rutas dinámicas; middleware sí puede modificar la respuesta).

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
      {
        // Universal Links (iOS): el fichero `apple-app-site-association` no tiene
        // extensión → sin este header Vercel lo serviría como octet-stream y, con
        // el `nosniff` global, Apple podría rechazarlo. Se sirve en www (dominio
        // canónico), por lo que no hay redirección de por medio.
        source: "/.well-known/apple-app-site-association",
        headers: [{ key: "Content-Type", value: "application/json" }],
      },
    ];
  },
};

export default nextConfig;
