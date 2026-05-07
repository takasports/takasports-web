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
  if (process.env.NODE_ENV === 'production') {
    // Sentry.captureException(error, { extra: extras })
    // Until Sentry is wired up, send to /api/log-error if desired,
    // or simply suppress. Errors are still surfaced in Vercel logs.
    return
  }
  // eslint-disable-next-line no-console
  console.error('[TakaSports]', error, extras)
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console[level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'log']('[TakaSports]', message)
  }
  // Sentry.captureMessage(message, level)
}
