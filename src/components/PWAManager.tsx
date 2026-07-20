'use client'

// PWAManager — invita a llevarse TakaSports al móvil y avisa de versión nueva.
//
// 1) App CTA (SOLO Android): en iOS ya hay app nativa y la invitación la da el
//    Smart App Banner NATIVO de Apple (meta `itunes` en layout.tsx → barra fina
//    con "OBTENER"/"ABRIR"), así que aquí NO se pinta nada en iOS para no duplicar.
//    En Android aún no hay app nativa: se ofrece instalar la web como app (A2HS)
//    capturando `beforeinstallprompt` (Chromium). Si el navegador no lo dispara,
//    no se muestra nada. En escritorio NO aparece nunca (Chrome desktop también
//    dispara el evento). Descartable: al cerrar se silencia 14 días. No compite
//    con el aviso de cookies (espera al consentimiento).
// 2) Actualizar: detecta un service worker en espera (nueva versión) y ofrece
//    aplicarla (postMessage SKIP_WAITING → recarga al cambiar de controlador).
// Sin librerías, 0 KB extra.

import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const SNOOZE_KEY = 'taka:app-cta-snooze' // guarda el ms del descarte
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000 // 14 días

// ¿Es Android? Solo ahí ofrecemos el instalar-PWA propio. iOS lo cubre el Smart
// App Banner nativo; escritorio queda excluido (aunque dispare beforeinstallprompt).
function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false
  return /android/i.test(navigator.userAgent || '')
}

export default function PWAManager() {
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

  // ── 1) Invitación a instalar (SOLO Android) ───────────────────────────────
  useEffect(() => {
    if (!isAndroid()) return // iOS → Smart App Banner nativo · escritorio → nada

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

    // Esperamos a que Chromium ofrezca instalar la PWA.
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
