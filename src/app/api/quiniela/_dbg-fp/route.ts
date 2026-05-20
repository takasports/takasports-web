// ⚠️ TEMPORAL — diagnóstico de mismatch CRON_SECRET entre prod y local.
// Devuelve SOLO huella (length + 4 primeros + 4 últimos chars). No el
// secret completo. Será borrado en el siguiente commit.

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const s = process.env.CRON_SECRET ?? ''
  return NextResponse.json({
    length: s.length,
    start4: s.slice(0, 4),
    end4: s.slice(-4),
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV ?? null,
  })
}
