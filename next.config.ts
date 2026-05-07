import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.sanity.io" },
      { protocol: "https", hostname: "*.cdninstagram.com" },
      { protocol: "https", hostname: "*.fbcdn.net" },
      { protocol: "https", hostname: "a.espncdn.com" },
      { protocol: "https", hostname: "*.espncdn.com" },
      { protocol: "https", hostname: "media.api-sports.io" },
      { protocol: "https", hostname: "*.cloudfront.net" },
      { protocol: "https", hostname: "pbs.twimg.com" },
      { protocol: "https", hostname: "*.twimg.com" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
    ],
  },
  async headers() {
    const csp = [
      "default-src 'self'",
      // Next.js inline scripts + HMR en dev
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Tailwind/inline styles
      "style-src 'self' 'unsafe-inline'",
      // Imágenes: CDNs conocidos + data URIs (favicons, placeholders)
      "img-src 'self' data: blob: https://cdn.sanity.io https://*.cdninstagram.com https://*.fbcdn.net https://*.espncdn.com https://media.api-sports.io https://*.cloudfront.net https://*.twimg.com https://upload.wikimedia.org",
      // Fuentes locales
      "font-src 'self' data:",
      // API calls: Supabase, Sanity, ESPN, api-sports, Instagram, Odds
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.sanity.io https://cdn.sanity.io https://site.api.espn.com https://v3.football.api-sports.io https://v2.nba.api-sports.io https://v1.formula-1.api-sports.io https://v1.tennis.api-sports.io https://v1.mma.api-sports.io https://v1.rugby.api-sports.io https://api.the-odds-api.com https://graph.instagram.com https://api.instagram.com",
      // Web Push service worker
      "worker-src 'self'",
      // No iframes de terceros
      "frame-src 'none'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
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
    ];
  },
};

export default nextConfig;
