// ─────────────────────────────────────────────────────────────────
// Emisor de push para la APP (Expo Push API).
//
// Por qué existe: la app guardaba su token en `push_tokens` desde hace meses y
// NO había nada que lo leyera — ni un solo emisor en los dos repos. O sea que
// activar las notificaciones en Ajustes no servía de nada. Esto cierra ese
// hueco; lo usa `sendPushToUser` (lib/push-helper), así que todo el que ya
// mandaba push al navegador pasa a alcanzar también al móvil, sin tocarse.
//
// La API de Expo es HTTP simple y gratuita: POST con un array de mensajes.
// No hace falta credencial salvo que el proyecto exija "enhanced security"
// (entonces, EXPO_ACCESS_TOKEN).
//   https://docs.expo.dev/push-notifications/sending-notifications/
// ─────────────────────────────────────────────────────────────────

const EXPO_ENDPOINT = 'https://exp.host/--/api/v2/push/send'

/** Expo acepta como mucho 100 mensajes por petición. */
const CHUNK = 100

export interface ExpoMessage {
  title: string
  body: string
  /** Viaja al `data` de la notificación; la app enruta con `url` (PushSetup). */
  data?: Record<string, unknown>
  /** Agrupa/reemplaza notificaciones en el dispositivo. */
  tag?: string
}

export interface ExpoResult {
  sent: number
  /** Tokens que Expo declara muertos (DeviceNotRegistered) — hay que borrarlos. */
  dead: string[]
  failed: number
  reason?: string
}

/** ¿Tiene pinta de token de Expo? Evita mandar basura a la API. */
export function isExpoToken(t: string | null | undefined): boolean {
  return !!t && /^Expo(nent)?PushToken\[[^\]]+\]$/.test(t.trim())
}

interface ExpoTicket {
  status?: string
  message?: string
  details?: { error?: string }
}

/**
 * Manda un mismo mensaje a varios tokens. No lanza: los fallos se devuelven
 * contados, y los tokens muertos en `dead` para que el llamador los purgue.
 */
export async function sendExpoPush(
  tokens: readonly string[],
  msg: ExpoMessage,
  fetchImpl: typeof fetch = fetch,
): Promise<ExpoResult> {
  const validos = Array.from(new Set(tokens.filter(isExpoToken)))
  if (validos.length === 0) return { sent: 0, dead: [], failed: 0, reason: 'no_tokens' }
  if (!msg?.title || !msg?.body) return { sent: 0, dead: [], failed: 0, reason: 'no_payload' }

  const cabeceras: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  const accessToken = process.env.EXPO_ACCESS_TOKEN
  if (accessToken) cabeceras.Authorization = `Bearer ${accessToken}`

  let sent = 0
  let failed = 0
  const dead: string[] = []

  for (let i = 0; i < validos.length; i += CHUNK) {
    const lote = validos.slice(i, i + CHUNK)
    const cuerpo = lote.map((to) => ({
      to,
      title: msg.title,
      body: msg.body,
      sound: 'default',
      ...(msg.data ? { data: msg.data } : {}),
      // `channelId` es de Android; el canal 'default' lo crea PushSetup.
      channelId: 'default',
      ...(msg.tag ? { categoryId: msg.tag } : {}),
    }))

    try {
      const res = await fetchImpl(EXPO_ENDPOINT, {
        method: 'POST',
        headers: cabeceras,
        body: JSON.stringify(cuerpo),
      })
      if (!res.ok) {
        // Un 4xx/5xx de Expo tumba el lote entero, no un token concreto.
        failed += lote.length
        continue
      }
      const json = (await res.json()) as { data?: ExpoTicket[] }
      const tickets = json?.data ?? []
      lote.forEach((token, j) => {
        const t = tickets[j]
        if (t?.status === 'ok') {
          sent += 1
        } else if (t?.details?.error === 'DeviceNotRegistered') {
          // El usuario desinstaló o revocó el permiso: el token ya no vale.
          dead.push(token)
        } else {
          failed += 1
        }
      })
    } catch {
      failed += lote.length
    }
  }

  return { sent, dead, failed }
}
