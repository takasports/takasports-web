export function GET() {
  const params = new URLSearchParams({
    client_id:     process.env.INSTAGRAM_APP_ID!,
    redirect_uri:  process.env.INSTAGRAM_REDIRECT_URI!,
    scope:         'instagram_business_basic',
    response_type: 'code',
  })
  return Response.redirect(`https://www.instagram.com/oauth/authorize?${params}`)
}
