// ─────────────────────────────────────────────────────────────────
// Email helper — envía emails transaccionales via Resend REST API.
//
// No instala SDK; usa fetch nativo para evitar dependencias extra.
// Si RESEND_API_KEY no está configurada, devuelve { sent: false }
// sin lanzar error (graceful degradation en dev/staging).
//
// Actualmente se usa para:
//   · Notificación de badge epic/legendary desbloqueado.
//
// Variables de entorno necesarias:
//   RESEND_API_KEY=re_...
//   EMAIL_FROM="TakaSports <noreply@takasportsmedia.com>"  (opcional, tiene default)
// ─────────────────────────────────────────────────────────────────

import { adminSupabase } from './supabase-admin'

const RESEND_URL = 'https://api.resend.com/emails'
const DEFAULT_FROM = 'TakaSports <noreply@takasportsmedia.com>'

interface EmailPayload {
  to:      string
  subject: string
  html:    string
  text?:   string
  /** Tag para tracking en Resend dashboard. */
  tag?:    string
}

interface SendResult {
  sent:    boolean
  id?:     string
  error?:  string
  reason?: string
}

/** Envía un email via Resend. Fire-and-forget seguro — nunca lanza excepciones. */
export async function sendEmail(payload: EmailPayload): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY
  if (!key) return { sent: false, reason: 'no_resend_key' }

  try {
    const res = await fetch(RESEND_URL, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    process.env.EMAIL_FROM ?? DEFAULT_FROM,
        to:      [payload.to],
        subject: payload.subject,
        html:    payload.html,
        text:    payload.text,
        tags:    payload.tag ? [{ name: 'type', value: payload.tag }] : undefined,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('[email-helper] Resend error', res.status, body)
      return { sent: false, error: `resend_${res.status}` }
    }

    const data = await res.json() as { id?: string }
    return { sent: true, id: data.id }
  } catch (err) {
    console.error('[email-helper] fetch error', err)
    return { sent: false, error: 'network_error' }
  }
}

// ─────────────────────────────────────────────────────────────────
// Obtiene el email de auth.users para un user_id dado.
// Requiere adminSupabase (service role) para acceder a auth.users.
// ─────────────────────────────────────────────────────────────────
export async function getUserEmail(userId: string): Promise<string | null> {
  const admin = adminSupabase()
  if (!admin) return null
  try {
    const { data, error } = await admin.auth.admin.getUserById(userId)
    if (error || !data?.user?.email) return null
    return data.user.email
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────────
// Template: badge desbloqueado (epic / legendary)
// ─────────────────────────────────────────────────────────────────

interface BadgeEmailContext {
  userId:      string
  badgeEmoji:  string
  badgeName:   string
  badgeDesc:   string
  rarity:      'epic' | 'legendary'
}

/** Envía email de badge desbloqueado. Fire-and-forget. */
export async function sendBadgeEmail(ctx: BadgeEmailContext): Promise<void> {
  const email = await getUserEmail(ctx.userId)
  if (!email) return

  const rarityLabel  = ctx.rarity === 'legendary' ? '🌟 LEGENDARIO' : '⚡ ÉPICO'
  const rarityColor  = ctx.rarity === 'legendary' ? '#FBBF24' : '#A78BFA'
  const accentBg     = ctx.rarity === 'legendary' ? '#1C1200' : '#0E0A1F'

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Badge desbloqueado — TakaSports</title>
</head>
<body style="margin:0;padding:0;background:#09090F;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090F;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="padding:0 0 24px;text-align:center;">
              <span style="font-size:13px;font-weight:900;letter-spacing:0.15em;color:${rarityColor};">TAKASPORTS</span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:${accentBg};border:1px solid ${rarityColor}30;border-radius:20px;padding:40px 36px;text-align:center;">

              <!-- Emoji -->
              <p style="font-size:72px;line-height:1;margin:0 0 20px;">${ctx.badgeEmoji}</p>

              <!-- Rarity chip -->
              <p style="display:inline-block;margin:0 0 16px;padding:4px 14px;border-radius:999px;background:${rarityColor}20;border:1px solid ${rarityColor}40;font-size:11px;font-weight:900;letter-spacing:0.1em;color:${rarityColor};">
                ${rarityLabel}
              </p>

              <!-- Title -->
              <h1 style="margin:0 0 12px;font-size:28px;font-weight:900;color:#F0F0F8;letter-spacing:-0.02em;">
                ${ctx.badgeName}
              </h1>

              <!-- Description -->
              <p style="margin:0 0 28px;font-size:15px;color:rgba(255,255,255,0.5);line-height:1.6;max-width:380px;display:inline-block;">
                ${ctx.badgeDesc}
              </p>

              <!-- CTA -->
              <br>
              <a href="https://takasportsmedia.com/perfil"
                 style="display:inline-block;padding:14px 32px;border-radius:12px;background:${rarityColor};color:#000;font-size:13px;font-weight:900;text-decoration:none;letter-spacing:0.05em;">
                Ver mi perfil →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0 0;text-align:center;">
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);">
                TakaSports · <a href="https://takasportsmedia.com" style="color:rgba(255,255,255,0.3);text-decoration:none;">takasportsmedia.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = `${ctx.badgeEmoji} ${ctx.badgeName} — Badge ${ctx.rarity === 'legendary' ? 'legendario' : 'épico'} desbloqueado en TakaSports.\n\n${ctx.badgeDesc}\n\nVisita tu perfil: https://takasportsmedia.com/perfil`

  void sendEmail({
    to:      email,
    subject: `${ctx.badgeEmoji} Badge desbloqueado: ${ctx.badgeName}`,
    html,
    text,
    tag:     'badge_unlock',
  })
}
