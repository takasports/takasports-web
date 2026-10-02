// GET/POST /api/cron/settle-quiniela — RETIRADO (oct-2026).
//
// Liquidaba las quinielas selladas leyendo resultados de ESPN cuatro veces al
// día. La quiniela está retirada (/quiniela hace 301 a /predicciones) y
// `quiniela_picks` tiene 0 filas: el cron pedía 9 marcadores a ESPN y recorría
// una tabla vacía para nada. Las predicciones de ahora se liquidan en
// /api/cron/sync-football.
//
// Responde 200 sin hacer nada para que la entrada de vercel.json, mientras
// exista, no cuente como fallo. Las tablas quiniela_* no se tocan. El código
// anterior está en el historial de git (última versión con él: de1baf2e).

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function retirado() {
  return NextResponse.json({ ok: true, retired: true, note: 'quiniela retirada: este cron ya no hace nada' })
}

export async function GET() {
  return retirado()
}
export async function POST() {
  return retirado()
}
