// Helper compartido para pingear IndexNow (Bing/Yandex).
// Lo usan tanto el endpoint público /api/indexnow (manual desde n8n o
// gestores) como el webhook /api/sanity-webhook (automático al publicar).

import { SITE_URL } from './constants'

const INDEXNOW_KEY = '61076e72cd4e4151830368503d68e4ad'
const INDEXNOW_ENDPOINT = 'https://www.bing.com/indexnow'

export interface IndexNowResult {
  submitted: number
  status: number
  ok: boolean
}

/**
 * Notifica a IndexNow (Bing/Yandex) de las URLs proporcionadas.
 * Acepta hasta 10.000 URLs por llamada. Si recibe más, las recorta.
 * No lanza si Bing devuelve error — devuelve el status para que el
 * caller decida cómo actuar.
 */
export async function pingIndexNow(urls: string[]): Promise<IndexNowResult> {
  const list = (Array.isArray(urls) ? urls : []).slice(0, 10000)
  if (list.length === 0) return { submitted: 0, status: 0, ok: false }

  const payload = {
    host: new URL(SITE_URL).hostname,
    key: INDEXNOW_KEY,
    keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
    urlList: list,
  }

  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    })
    return { submitted: list.length, status: res.status, ok: res.status === 200 || res.status === 202 }
  } catch {
    // Fallo de red al hablar con Bing: no propagamos para no romper el webhook.
    return { submitted: list.length, status: 0, ok: false }
  }
}

/** Convierte una lista de paths internos en URLs absolutas para IndexNow. */
export function pathsToUrls(paths: string[]): string[] {
  const base = SITE_URL.replace(/\/$/, '')
  return paths.map(p => `${base}${p.startsWith('/') ? p : '/' + p}`)
}
