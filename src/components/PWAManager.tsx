'use client'

// PWAManager — invita a llevarse TakaSports al móvil y avisa de versión nueva.
//
// 1) App CTA (SOLO móvil, según plataforma):
//    · iOS  → hay app nativa en el App Store ("Taka Sports"). Banner con enlace
//             directo a la ficha. No depende de ninguna API del navegador, así
//             que sale igual en Safari, Chrome iOS, etc.
//    · Android → aún no hay app nativa; se ofrece instalar la web como app (A2HS)
//             capturando `beforeinstallprompt` (Chromium). Si el navegador no lo
//             dispara, no se muestra nada (no forzamos instrucciones manuales).
//    En escritorio NO aparece nunca. Descartable: al cerrar se silencia 14 días.
//    No compite con el aviso de cookies (espera al consentimiento).
// 2) Actualizar: detecta un service worker en espera (nueva versión) y ofrece
//    aplicarla (postMessage SKIP_WAITING → recarga al cambiar de controlador).
// Sin librerías, 0 KB extra.

import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Ficha real del App Store (bundle com.takasportsmedia.app).
const APP_STORE_URL = 'https://apps.apple.com/es/app/taka-sports/id6787799706'
const SNOOZE_KEY = 'taka:app-cta-snooze' // guarda el ms del descarte
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000 // 14 días

type Platform = 'ios' | 'android'

function detectPlatform(): Platform | null {
  if (typeof navigator === 'undefined') return null
  const ua = navigator.userAgent || ''
  const isIOS =
    /iphone|ipad|ipod/i.test(ua) ||
    // iPadOS 13+ se hace pasar por Mac de escritorio: lo delata el táctil.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (isIOS) return 'ios'
  if (/android/i.test(ua)) return 'android'
  return null // escritorio u otro → sin banner
}

export default function PWAManager() {
  const [platform, setPlatform] = useState<Platform | null>(null)
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstall, setShowInstall] = useState(false)
  const [updateReady, setUpdateReady] = useState(false)
  // No competir con el aviso de cookies: nada se muestra hasta que el
  // consentimiento esté resuelto (prioridad legal). Misma clave que ConsentBanner.
  const [consentOk, setConsentOk] = useState(false)

  // ── 0) Registro del service worker ────────────────────────────────────────
  // Antes vivía en un <script> inline en layout.tsx, pero la CSP nonce-only de
  // las rutas dinámicas (/perfil, /quiniela, /archivo, /admin) lo bloqueaba y el
  // SW no se registraba en ellas. Desde un componente cliente el registro va en
  // un chunk servido desde 'self', que la CSP permite sin nonce. Se difiere a
  // load + idle para no competir con el LCP.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const register = () => { navigator.serviceWorker.register('/sw.js').catch(() => {}) }
    const onLoad = () => {
      if ('requestIdleCallback' in window) requestIdleCallback(register)
      else setTimeout(register, 2000)
    }
    // Si el componente hidrata después del load (habitual), el evento ya pasó.
    if (document.readyState === 'complete') onLoad()
    else window.addEventListener('load', onLoad, { once: true })
    return () => window.removeEventListener('load', onLoad)
  }, [])

  // ── 1) Invitación a llevarse la app ───────────────────────────────────────
  useEffect(() => {
    const plat = detectPlatform()
    if (!plat) return // escritorio → nunca

    setPlatform(plat)

    // ¿Silenciada hace poco?
    let snoozed = false
    try {
      const raw = localStorage.getItem(SNOOZE_KEY)
      if (raw) snoozed = Date.now() - Number(raw) < SNOOZE_MS
    } catch {}
    // ¿Ya corre como app instalada (PWA en pantalla de inicio)?
    const standalone =
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    if (snoozed || standalone) return

    if (plat === 'ios') {
      // iOS: la ficha del App Store es un simple enlace, no hace falta ningún
      // evento. Aparece con un leve retardo para no saltar sobre el contenido.
      const t = setTimeout(() => setShowInstall(true), 1600)
      return () => clearTimeout(t)
    }

    // Android: esperamos a que Chromium ofrezca instalar la PWA.
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setShowInstall(true)
    }
    const onInstalled = () => { setShowInstall(false); setDeferred(null) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  // ── 2) Aviso de versión nueva ─────────────────────────────────────────────
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    let reloaded = false

    const onControllerChange = () => {
      if (reloaded) return
      reloaded = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return
      // Ya había una versión esperando al cargar.
      if (reg.waiting && navigator.serviceWorker.controller) setUpdateReady(true)
      // Una versión nueva entra mientras la pestaña está abierta.
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing
        if (!nw) return
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) setUpdateReady(true)
        })
      })
    }).catch(() => {})

    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
  }, [])

  // ── Esperar a que el aviso de cookies esté decidido ───────────────────────
  useEffect(() => {
    const check = () => {
      try { return localStorage.getItem('taka-consent-v1') != null } catch { return true }
    }
    if (check()) { setConsentOk(true); return }
    const id = window.setInterval(() => {
      if (check()) { setConsentOk(true); window.clearInterval(id) }
    }, 1500)
    return () => window.clearInterval(id)
  }, [])

  const doInstall = async () => {
    if (!deferred) return
    try {
      await deferred.prompt()
      await deferred.userChoice
    } finally {
      setShowInstall(false)
      setDeferred(null)
    }
  }

  const dismissInstall = () => {
    setShowInstall(false)
    try { localStorage.setItem(SNOOZE_KEY, String(Date.now())) } catch {}
  }

  const applyUpdate = async () => {
    const reg = await navigator.serviceWorker.getRegistration().catch(() => null)
    if (reg?.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' })
    setUpdateReady(false)
  }

  if (!consentOk || (!showInstall && !updateReady)) return null

  return (
    <div
      style={{
        position: 'fixed', left: 0, right: 0,
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)',
        zIndex: 55, display: 'flex', justifyContent: 'center',
        padding: '0 12px', pointerEvents: 'none',
      }}
    >
      {updateReady ? (
        <div role="status"
          style={{
            pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 12,
            maxWidth: 420, width: '100%', padding: '10px 12px 10px 14px',
            borderRadius: 14, background: 'rgba(20,18,30,0.96)',
            border: '1px solid rgba(255,77,46,0.35)',
            boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
          }}>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#ECECF6' }}>
            Hay una versión nueva de TakaSports
          </span>
          <button onClick={applyUpdate} aria-label="Actualizar a la versión nueva"
            style={{
              flexShrink: 0, padding: '7px 14px', borderRadius: 10, border: 'none',
              background: '#FF4D2E', color: '#fff', fontSize: 12, fontWeight: 900,
              textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'pointer',
            }}>
            Actualizar
          </button>
        </div>
      ) : platform === 'ios' ? (
        <div
          style={{
            pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 10,
            maxWidth: 420, width: '100%', padding: '10px 10px 10px 14px',
            borderRadius: 14, background: 'rgba(20,18,30,0.96)',
            border: '1px solid rgba(124,58,237,0.4)',
            boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
          }}>
          <span aria-hidden style={{
            flexShrink: 0, width: 34, height: 34, borderRadius: 9,
            background: 'rgba(124,58,237,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {/* Manzana Apple */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#A78BFA" aria-hidden>
              <path d="M16.36 12.9c.02 2.42 2.12 3.22 2.14 3.23-.02.06-.34 1.16-1.12 2.3-.67.98-1.37 1.95-2.47 1.97-1.08.02-1.43-.64-2.66-.64-1.24 0-1.62.62-2.64.66-1.06.04-1.87-1.06-2.55-2.03-1.38-2-2.44-5.65-1.02-8.12.7-1.22 1.96-2 3.33-2.02 1.04-.02 2.02.7 2.66.7.63 0 1.83-.87 3.08-.74.53.02 2 .21 2.95 1.62-.08.05-1.76 1.03-1.74 3.07zM14.4 5.6c.56-.68.94-1.63.84-2.58-.81.03-1.79.54-2.37 1.22-.52.6-.98 1.56-.86 2.48.9.07 1.83-.46 2.39-1.13z"/>
            </svg>
          </span>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#ECECF6', lineHeight: 1.3 }}>
            Descarga Taka Sports
            <span style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#A0A0B4' }}>
              La app para iPhone — gratis en el App Store
            </span>
          </span>
          <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer"
            aria-label="Descargar Taka Sports en el App Store"
            onClick={() => { try { localStorage.setItem(SNOOZE_KEY, String(Date.now())) } catch {} }}
            style={{
              flexShrink: 0, padding: '7px 14px', borderRadius: 10,
              background: '#7C3AED', color: '#fff', fontSize: 12, fontWeight: 900,
              textTransform: 'uppercase', letterSpacing: '0.04em', textDecoration: 'none',
            }}>
            Descargar
          </a>
          <button onClick={dismissInstall} aria-label="Ahora no, ocultar"
            style={{
              flexShrink: 0, width: 30, height: 30, borderRadius: 8, border: 'none',
              background: 'transparent', color: '#8A8A9E', fontSize: 18, lineHeight: 1, cursor: 'pointer',
            }}>
            ×
          </button>
        </div>
      ) : (
        <div
          style={{
            pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 10,
            maxWidth: 420, width: '100%', padding: '10px 10px 10px 14px',
            borderRadius: 14, background: 'rgba(20,18,30,0.96)',
            border: '1px solid rgba(124,58,237,0.4)',
            boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
          }}>
          <span aria-hidden style={{
            flexShrink: 0, width: 34, height: 34, borderRadius: 9,
            background: 'rgba(124,58,237,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="7" y="2" width="10" height="20" rx="2" />
              <path d="M11 18h2" />
            </svg>
          </span>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#ECECF6', lineHeight: 1.3 }}>
            Instala TakaSports
            <span style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#A0A0B4' }}>
              Acceso directo desde tu pantalla de inicio
            </span>
          </span>
          <button onClick={doInstall} aria-label="Instalar TakaSports como aplicación"
            style={{
              flexShrink: 0, padding: '7px 14px', borderRadius: 10, border: 'none',
              background: '#7C3AED', color: '#fff', fontSize: 12, fontWeight: 900,
              textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'pointer',
            }}>
            Instalar
          </button>
          <button onClick={dismissInstall} aria-label="Ahora no, ocultar"
            style={{
              flexShrink: 0, width: 30, height: 30, borderRadius: 8, border: 'none',
              background: 'transparent', color: '#8A8A9E', fontSize: 18, lineHeight: 1, cursor: 'pointer',
            }}>
            ×
          </button>
        </div>
      )}
    </div>
  )
}
