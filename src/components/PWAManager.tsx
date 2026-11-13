'use client'

// PWAManager — invita a llevarse TakaSports al móvil y avisa de versión nueva.
//
// 1) App CTA (SOLO Android): en iOS ya hay app nativa y la invitación la da el
//    Smart App Banner NATIVO de Apple (meta `itunes` en layout.tsx → barra fina
//    con "OBTENER"/"ABRIR"), así que aquí NO se pinta nada en iOS para no duplicar.
//    En Android la app está en prueba cerrada en Google Play (desde el 12/11/2026)
//    y hacen falta testers: el aviso lleva a /android (ver `@/lib/android-beta`).
//    Hasta entonces ofrecía instalar la web como app (A2HS); ese aviso se quitó,
//    pero se sigue capturando `beforeinstallprompt` para que Chrome no pinte su
//    propia barra de «Instalar» encima del nuestro. Al cerrarlo o tocarlo vuelve
//    a los 15 minutos; deja de salir cuando el visitante toca «Instalar» en el
//    paso 3 de /android. En escritorio NO aparece nunca. No compite con el aviso
//    de cookies (espera al consentimiento).
// 2) Actualizar: detecta un service worker en espera (nueva versión) y ofrece
//    aplicarla (postMessage SKIP_WAITING → recarga al cambiar de controlador).
// Sin librerías, 0 KB extra.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { JOINED_KEY, SNOOZE_KEY, SNOOZE_MS } from '@/lib/android-beta'
import { trackAndroidBeta } from '@/lib/analytics'

// ¿Es Android? Solo ahí sale el aviso de la app de Android. iOS lo cubre el
// Smart App Banner nativo; escritorio queda excluido.
function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false
  return /android/i.test(navigator.userAgent || '')
}

export default function PWAManager() {
  const pathname = usePathname()
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

  // ── 1) Aviso de la app de Android (SOLO Android) ───────────────────────
  useEffect(() => {
    if (!isAndroid()) return // iOS → Smart App Banner nativo · escritorio → nada

    // Sin esto Chrome pinta su barra de «Instalar app» (la web como PWA), que
    // competiría con la app de verdad.
    const onPrompt = (e: Event) => e.preventDefault()
    window.addEventListener('beforeinstallprompt', onPrompt)

    // ¿Ya se apuntó, o lo cerró hace menos de 15 minutos? Se mira al entrar en
    // la web y cada vez que cambia de página.
    let hide = false
    try {
      const raw = localStorage.getItem(SNOOZE_KEY)
      hide = !!localStorage.getItem(JOINED_KEY) || (!!raw && Date.now() - Number(raw) < SNOOZE_MS)
    } catch {}
    const show = !hide && pathname !== '/android'
    setShowInstall(show)
    if (show) trackAndroidBeta('banner_shown')

    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [pathname])

  // ── 2) Aviso de versión nueva ─────────────────────────────────────────────
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    let reloaded = false
    // Solo hay "versión nueva" si la página YA estaba controlada por un SW. En
    // la primera visita no hay ninguno: el SW se instala, hace clients.claim()
    // y también dispara controllerchange. Sin esta guarda, a TODO visitante
    // nuevo se le recargaba la página a los 1-3 s de entrar (13/06 → 02/10/2026):
    // perdía lo que estuviera leyendo y se le cortaba la intro de la portada.
    const hadController = !!navigator.serviceWorker.controller

    const onControllerChange = () => {
      if (!hadController || reloaded) return
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

  const snoozeInstall = () => {
    setShowInstall(false)
    try { localStorage.setItem(SNOOZE_KEY, String(Date.now())) } catch {}
  }
  const doInstall = () => { trackAndroidBeta('banner_click'); snoozeInstall() }
  const dismissInstall = () => { trackAndroidBeta('banner_dismiss'); snoozeInstall() }

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
            maxWidth: 420, width: '100%', padding: '10px 10px 10px 12px',
            borderRadius: 14, background: 'rgba(20,18,30,0.97)',
            border: '1px solid rgba(255,77,46,0.45)',
            boxShadow: '0 8px 28px rgba(0,0,0,0.55)',
          }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- icono local de 36 px */}
          <img src="/icon-192.png" alt="" width={36} height={36}
            style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 9 }} />
          <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#ECECF6', lineHeight: 1.3 }}>
            Taka llega a Android
            <span style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#A0A0B4' }}>
              Únete a los primeros testers · gratis
            </span>
          </span>
          <Link href="/android" onClick={doInstall} aria-label="Probar la app de Taka para Android"
            style={{
              flexShrink: 0, padding: '8px 14px', borderRadius: 10,
              background: '#FF4D2E', color: '#fff', fontSize: 12, fontWeight: 900,
              textTransform: 'uppercase', letterSpacing: '0.04em', textDecoration: 'none',
            }}>
            Probar
          </Link>
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
