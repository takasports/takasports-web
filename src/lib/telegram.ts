// Envío de alertas a Telegram (bot del proyecto). Módulo ligero compartido por
// crons y auditorías — sin dependencias pesadas para no inflar bundles de cron.
// Requiere TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID en el entorno; si faltan, no
// envía y devuelve { sent: false } (nunca lanza).

const TIMEOUT_MS = 8000

export async function sendTelegram(text: string): Promise<{ sent: boolean; note?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return { sent: false, note: 'TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID no configurados' }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) return { sent: false, note: `Telegram ${res.status}: ${(await res.text()).slice(0, 150)}` }
    return { sent: true }
  } catch (e) {
    return { sent: false, note: e instanceof Error ? e.message : String(e) }
  }
}
