export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code  = searchParams.get('code')
  const error = searchParams.get('error_description')

  if (error || !code) {
    return html(`<h2 style="color:#ef4444">❌ Error</h2><p>${error ?? 'No se recibió código'}</p>`)
  }

  // 1. Canjear código por token de corta duración
  const shortRes = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id:     process.env.INSTAGRAM_APP_ID!,
      client_secret: process.env.INSTAGRAM_APP_SECRET!,
      grant_type:    'authorization_code',
      redirect_uri:  process.env.INSTAGRAM_REDIRECT_URI!,
      code,
    }),
  })
  const shortData = await shortRes.json()
  if (shortData.error_type) {
    return html(`<h2 style="color:#ef4444">❌ Error al canjear código</h2><pre>${JSON.stringify(shortData, null, 2)}</pre>`)
  }

  // 2. Canjear por token de larga duración (60 días)
  // El secret va en el body, no en la URL, para evitar que quede en logs de Meta
  const longRes = await fetch('https://graph.instagram.com/access_token', {
    method: 'POST',
    body: new URLSearchParams({
      grant_type:   'ig_exchange_token',
      client_secret: process.env.INSTAGRAM_APP_SECRET!,
      access_token:  shortData.access_token,
    }),
  })
  const longData = await longRes.json()
  if (longData.error) {
    return html(`<h2 style="color:#ef4444">❌ Error al extender token</h2><pre>${JSON.stringify(longData, null, 2)}</pre>`)
  }

  const days = Math.floor((longData.expires_in ?? 5183944) / 86400)

  return html(`
    <h2 style="color:#22c55e">✅ Token obtenido</h2>
    <p>Copia esta línea en <code style="background:#1e1b4b;padding:2px 6px;border-radius:4px">.env.local</code>:</p>
    <pre style="background:#0d0d18;border:1px solid #2a2a4a;padding:16px;border-radius:8px;word-break:break-all;font-size:13px">INSTAGRAM_ACCESS_TOKEN=${longData.access_token}</pre>
    <p style="color:#52527A;font-size:13px">Expira en ~${days} días. Para renovar: <code>GET /api/instagram/refresh</code></p>
  `)
}

function html(body: string) {
  return new Response(
    `<!DOCTYPE html><html><body style="font-family:system-ui,monospace;padding:32px;background:#09090F;color:#F8F8FF;max-width:720px;margin:auto">${body}</body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  )
}
