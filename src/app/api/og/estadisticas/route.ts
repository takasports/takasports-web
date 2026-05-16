// Edge route handler que sirve la OG image dinámica.
// El JSX vive en og-image.tsx (route.ts no admite JSX nativo).
import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { createElement } from 'react'
import { OgEstadisticas, presetFor } from './og-image'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const sport = (req.nextUrl.searchParams.get('sport') ?? '').toLowerCase()
  const preset = presetFor(sport)
  return new ImageResponse(
    createElement(OgEstadisticas, { preset }),
    { width: 1200, height: 630 },
  )
}
