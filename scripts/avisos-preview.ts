// ─────────────────────────────────────────────────────────────────────────────
// Vista previa de los avisos push con datos reales de hoy.
//
//   npx tsx scripts/avisos-preview.ts > textos.md
//
// Lee ESPN, Sanity (CDN) y Supabase (solo SELECT). No envía nada ni escribe en
// la base de datos. Lo mismo que GET /api/admin/avisos-preview?formato=md.
// ─────────────────────────────────────────────────────────────────────────────

import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

async function main() {
  // Import dinámico: sanity.ts y supabase-admin leen las variables al cargarse.
  const { construirVistaPrevia, vistaPreviaMarkdown } = await import('../src/lib/avisos-preview')
  const vista = await construirVistaPrevia()
  process.stdout.write(vistaPreviaMarkdown(vista) + '\n')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
