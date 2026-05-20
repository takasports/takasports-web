// Helpers de cliente para Web Push: detección de soporte, suscripción y
// baja contra /api/push/subscribe. El endpoint y las claves VAPID ya están
// en backend; aquí solo nos preocupamos del lado del navegador.

'use client'

export interface PushStatus {
  supported: boolean
  configured: boolean
  permission: NotificationPermission | 'unsupported'
  subscribed: boolean
}

export function isPushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
}

export function getPublicKey(): string | null {
  const k = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  return k && k.length > 10 ? k : null
}

function urlB64ToUint8(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export async function getPushStatus(): Promise<PushStatus> {
  const supported = isPushSupported()
  const configured = !!getPublicKey()
  if (!supported) return { supported, configured, permission: 'unsupported', subscribed: false }
  const permission = Notification.permission
  if (permission !== 'granted') return { supported, configured, permission, subscribed: false }
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    return { supported, configured, permission, subscribed: !!sub }
  } catch {
    return { supported, configured, permission, subscribed: false }
  }
}

export interface SubscribeResult { ok: boolean; error?: string }

export async function subscribeToPush(topics: string[] = ['games']): Promise<SubscribeResult> {
  if (!isPushSupported()) return { ok: false, error: 'unsupported' }
  const key = getPublicKey()
  if (!key) return { ok: false, error: 'not-configured' }
  try {
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return { ok: false, error: 'denied' }
    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8(key).buffer as ArrayBuffer,
      })
    }
    const json = sub.toJSON()
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { ok: false, error: 'invalid-subscription' }
    }
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        topics,
      }),
    })
    if (!res.ok) return { ok: false, error: `server ${res.status}` }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function unsubscribeFromPush(): Promise<{ ok: boolean }> {
  if (!isPushSupported()) return { ok: false }
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => {})
      await sub.unsubscribe().catch(() => {})
    }
    return { ok: true }
  } catch {
    return { ok: false }
  }
}
