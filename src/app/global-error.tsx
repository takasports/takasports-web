'use client'

// Red de seguridad de último recurso del App Router: se activa solo cuando el
// fallo ocurre en el propio layout/plantilla RAÍZ (que `error.tsx` no puede
// capturar). Por eso renderiza su PROPIO <html>/<body> y usa estilos en línea
// con colores literales: no puede depender de globals.css ni de los providers,
// que es justo lo que ha podido fallar.

import { useEffect } from 'react'
import { captureException } from '@/lib/monitoring'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    captureException(error, { digest: error.digest, boundary: 'global-error' })
  }, [error])

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          background: '#09090F',
          color: '#F0F0F5',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 420,
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M14 8v7M14 18v2" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
              <circle cx="14" cy="14" r="12" stroke="#ef4444" strokeWidth="1.5" opacity="0.5" />
            </svg>
          </div>

          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
            Algo salió mal
          </h1>
          <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.5, color: '#9090A4' }}>
            Ha ocurrido un error inesperado. Puede ser un problema temporal — vuelve a intentarlo.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={reset}
              style={{
                padding: '10px 20px',
                borderRadius: 12,
                border: 'none',
                cursor: 'pointer',
                fontWeight: 800,
                fontSize: '0.8rem',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: '#fff',
                background: 'linear-gradient(135deg,#7C3AED,#6025C0)',
                boxShadow: '0 4px 18px rgba(124,58,237,0.3)',
              }}
            >
              Reintentar
            </button>
            <a
              href="/"
              style={{
                padding: '10px 20px',
                borderRadius: 12,
                fontWeight: 800,
                fontSize: '0.8rem',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                textDecoration: 'none',
                color: '#9090A4',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              Ir al inicio
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
