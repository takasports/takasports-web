'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'

const CONSENT_KEY = 'taka-consent-v1'
const TTL_DAYS = 180

type Decision = 'accepted' | 'rejected'

interface StoredConsent {
  decision: Decision
  at: string
  version: 1
}

function readConsent(): StoredConsent | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredConsent
    if (parsed?.version !== 1 || !parsed.at || !parsed.decision) return null
    const ageMs = Date.now() - new Date(parsed.at).getTime()
    if (ageMs > TTL_DAYS * 24 * 60 * 60 * 1000) return null
    return parsed
  } catch {
    return null
  }
}

interface Props {
  gaId?: string
  clarityId?: string
  nonce?: string
}

export default function ConsentBanner({ gaId, clarityId, nonce }: Props) {
  // 'pending' = aún no leímos localStorage (SSR/primer paint). No renderizamos.
  const [decision, setDecision] = useState<Decision | null | 'pending'>('pending')

  useEffect(() => {
    setDecision(readConsent()?.decision ?? null)
  }, [])

  const decide = (d: Decision) => {
    setDecision(d)
    const key = CONSENT_KEY
    const value = JSON.stringify({ decision: d, at: new Date().toISOString(), version: 1 } satisfies StoredConsent)
    const persist = () => { try { localStorage.setItem(key, value) } catch {} }
    if ('requestIdleCallback' in window) { requestIdleCallback(persist) } else { setTimeout(persist, 0) }
  }

  const showBanner = decision === null
  // Decisión del dueño (2026-06-14): la analítica (GA4 + Microsoft Clarity) SOLO
  // se carga tras un "Aceptar" explícito. NO se ejecuta gtag antes del
  // consentimiento: el EDPB (Directrices 2/2023) considera que incluso el "ping"
  // cookieless es "acceso al equipo terminal" y requiere consentimiento (art. 22.2
  // LSSI / art. 5.3 ePrivacy). Si el user rechaza o no decide, no se carga nada.
  const loadAnalytics = decision === 'accepted'

  return (
    <>
      {showBanner && (
        <div
          role="dialog"
          aria-labelledby="ts-consent-title"
          aria-describedby="ts-consent-desc"
          aria-modal="false"
          className="ts-consent-wrapper fixed inset-x-0 z-[60] px-4 lg:px-6"
        >
          <div
            className="ts-consent-card mx-auto max-w-[760px] flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 lg:gap-5"
          >
            <div className="flex-1 min-w-0">
              <p
                id="ts-consent-title"
                className="section-label"
                style={{ color: 'var(--text-secondary)', marginBottom: 4 }}
              >
                Privacidad
              </p>
              <p
                id="ts-consent-desc"
                style={{
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  lineHeight: 1.45,
                }}
              >
                Usamos Google Analytics y Microsoft Clarity para medir cómo se usa TakaSports
                y mejorarlo. Solo se activan si pulsas «Aceptar»; puedes rechazar y seguir
                usando la web con normalidad.{' '}
                <a
                  href="/cookies"
                  style={{ color: 'var(--purple-light)', textDecoration: 'underline', textUnderlineOffset: 3 }}
                >
                  Más información
                </a>
                .
              </p>
            </div>

            <div className="flex gap-2 sm:gap-3 shrink-0">
              <button
                type="button"
                onClick={() => decide('rejected')}
                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--purple)]"
                style={{
                  flex: '1 1 0',
                  minWidth: 110,
                  padding: '10px 16px',
                  background: 'rgba(255,255,255,0.08)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'var(--font-sport)',
                  fontWeight: 700,
                  fontSize: 13,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'background var(--duration-fast) var(--ease-standard)',
                }}
              >
                Rechazar
              </button>
              <button
                type="button"
                onClick={() => decide('accepted')}
                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--purple)]"
                style={{
                  flex: '1 1 0',
                  minWidth: 110,
                  padding: '10px 16px',
                  background: 'var(--purple)',
                  color: '#fff',
                  border: '1px solid var(--purple)',
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'var(--font-sport)',
                  fontWeight: 700,
                  fontSize: 13,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'background var(--duration-fast) var(--ease-standard)',
                }}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Analítica — SOLO tras aceptar (ver nota arriba). GA4 con Consent Mode:
          analytics_storage 'granted' (el user aceptó); señales de publicidad
          (ad_*) SIEMPRE denied — TakaSports no hace publicidad personalizada. */}
      {loadAnalytics && gaId && (
        <>
          {/* 1. Define gtag + consent ANTES de cargar gtag.js */}
          <Script id="ga-consent-default" strategy="afterInteractive" nonce={nonce}>
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'granted'});
gtag('set','ads_data_redaction',true);`}
          </Script>
          {/* 2. Carga la librería gtag */}
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
            nonce={nonce}
          />
          {/* 3. Inicializa la config */}
          <Script id="ga4-init" strategy="afterInteractive" nonce={nonce}>
            {`gtag('js',new Date());gtag('config','${gaId}',{page_path:window.location.pathname});`}
          </Script>
        </>
      )}

      {/* Clarity (mapas de calor) — solo tras aceptar; usa cookies sin modo cookieless. */}
      {loadAnalytics && clarityId && (
        <Script id="clarity-init" strategy="afterInteractive" nonce={nonce}>
          {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${clarityId}");`}
        </Script>
      )}
    </>
  )
}
