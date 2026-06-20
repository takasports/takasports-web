/**
 * Monitoring/error-reporting abstraction.
 *
 * To wire up Sentry:
 *   1. npm install @sentry/nextjs
 *   2. Add NEXT_PUBLIC_SENTRY_DSN to .env.local
 *   3. Uncomment the Sentry block below and remove the console fallback.
 *   4. Create sentry.client.config.ts, sentry.server.config.ts per Sentry docs.
 */

// import * as Sentry from '@sentry/nextjs'

type Extras = Record<string, unknown>

export function captureException(error: unknown, extras?: Extras): void {
  // Sentry.captureException(error, { extra: extras })  // cuando se cablee Sentry
  //
  // Hasta entonces registramos en consola SIEMPRE (dev y PROD). En producción
  // esto aparece en los Logs de Vercel — un destino real y consultable (vía el
  // MCP de Vercel / dashboard) — en vez del antiguo `return` que dejaba la app
  // CIEGA ante cualquier fallo en producción.
  // eslint-disable-next-line no-console
  console.error('[TakaSports]', error, extras ?? '')
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  // Sentry.captureMessage(message, level)  // cuando se cablee Sentry
  const fn = level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'log'
  // eslint-disable-next-line no-console
  console[fn]('[TakaSports]', message)
}
