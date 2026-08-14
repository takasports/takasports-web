#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// ingest-wwe-championships.mjs — CONTEXTO de los luchadores de WWE
//
// La lucha libre es GUIONIZADA: no hay un rendimiento objetivo que
// medir, porque los resultados se deciden en un despacho. Cualquier
// número que saliera de "quién gana más combates" mediría la trama,
// no al atleta, y encima fingiendo que es un dato deportivo.
//
// Lo que sí es objetivo, público y verificable es **quién lleva un
// título y desde cuándo**. Eso no dice quién es mejor: dice por quién
// apuesta la empresa, que es exactamente lo que el factor CONTEXTO
// mide en el resto de deportes (la posición del equipo en su liga
// tampoco habla del jugador, habla de dónde está).
//
// Por eso este script escribe SOLO `contexto_auto`. El rendimiento se
// deja como está: prefiero un factor sin fuente y a la vista que un
// número inventado con pinta de dato.
//
// ── FUENTE ───────────────────────────────────────────────────────
// «List of current champions in WWE» de Wikipedia, vía la REST API
// oficial. Gratis, permitida y mantenida al día por su comunidad
// (última edición vista: 05/08/2026). Coste €0, como el resto del
// pipeline. Se manda User-Agent identificándonos, que es lo que pide
// la política de la API.
//
// ── CÓMO SE TRADUCE A CONTEXTO ───────────────────────────────────
// Un cinturón mundial no vale lo mismo que uno de la marca de
// desarrollo, y un reinado de cinco meses dice más que uno de una
// semana. Los títulos femeninos puntúan IGUAL que sus equivalentes
// masculinos: el Women's World Championship es el cinturón mundial de
// su división, no un secundario.
//
// Uso:
//   node scripts/ingest-wwe-championships.mjs            # DRY RUN
//   node scripts/ingest-wwe-championships.mjs --apply
// ─────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const APPLY = process.argv.includes('--apply')

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE keys'); process.exit(1) }

const WIKI = 'https://en.wikipedia.org/api/rest_v1/page/html/List_of_current_champions_in_WWE'
const UA = 'TakaSports/1.0 (https://www.takasportsmedia.com; contactotakasports@gmail.com)'

// Sin título NO se pone un valor plano. La primera versión lo hacía —62 para
// todos— y en seco se vio el destrozo: los nueve sin cinturón quedaban
// idénticos y Cody Rhodes caía de 84 a 62, tirando a la basura el criterio
// editorial con el que se sembraron. Este script sabe quién lleva un título;
// no sabe ordenar a los que no lo llevan, y fingir que sí es peor que callar.
//
// Así que a los sin título solo se les quita el PLUS de campeón: se les baja
// al techo de no-campeón si están por encima, y si ya están por debajo no se
// les toca. Con eso un excampeón baja de 96 a 88 al perder el cinturón, y
// nadie más se mueve.
const TECHO_SIN_TITULO = 88
const NIVELES = [
  { base: 92, re: /undisputed wwe championship|world heavyweight championship|women's world championship|wwe women's championship/i },
  { base: 78, re: /intercontinental|united states/i },
  { base: 72, re: /tag team/i },
  { base: 66, re: /nxt|evolve|speed/i },
]

// Un reinado largo es una apuesta sostenida; uno de días, un experimento.
// Tope de +8 para que el nivel del cinturón siga mandando.
function bonusReinado(dias) {
  if (!dias) return 0
  if (dias >= 365) return 8
  if (dias >= 180) return 6
  if (dias >= 90)  return 4
  if (dias >= 30)  return 2
  return 0
}

const limpio = (s) => s
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#x27;|&apos;/g, "'").replace(/&quot;/g, '"')
  .replace(/\s+/g, ' ').trim()

// Wikipedia desambigua con paréntesis —«Zaria (wrestler)», «Raquel Rodriguez
// (wrestler)»— y eso no aparece en nuestros nombres.
const normaliza = (s) => s
  .replace(/\s*\([^)]*\)\s*/g, ' ')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]/g, '')

async function campeonesDeWikipedia() {
  const res = await fetch(WIKI, { headers: { 'User-Agent': UA, Accept: 'text/html' } })
  if (!res.ok) throw new Error(`Wikipedia devolvió ${res.status}`)
  const html = await res.text()

  const out = []
  for (const tabla of html.match(/<table[\s\S]*?<\/table>/g) ?? []) {
    for (const fila of tabla.match(/<tr[\s\S]*?<\/tr>/g) ?? []) {
      const tds = fila.match(/<td[\s\S]*?<\/td>/g) ?? []
      if (tds.length < 4) continue
      const titulo = limpio(tds[0])
      if (!titulo || titulo.length < 4) continue

      // El campeón va en una celda posterior a la de la foto, así que se
      // busca el primer wikilink que no sea un archivo.
      let campeones = []
      for (const td of tds.slice(1, 4)) {
        const links = [...td.matchAll(/rel="mw:WikiLink" href="\.\/([^"]+)"/g)]
          .map(m => decodeURIComponent(m[1]).replace(/_/g, ' '))
          .filter(n => !n.startsWith('File:'))
        if (links.length) { campeones = links; break }
      }
      if (!campeones.length) continue

      // «Días held» es el número grande de la fila; el de reinado (1, 2, 3…)
      // es de una cifra, así que se exige un mínimo de dos dígitos.
      const nums = tds.map(limpio).filter(t => /^\d{2,4}\+?$/.test(t))
      const dias = nums.length ? parseInt(nums[nums.length - 1], 10) : null

      for (const c of campeones) out.push({ titulo, campeon: c, dias })
    }
  }
  return out
}

function contextoDe(titulo, dias) {
  const nivel = NIVELES.find(n => n.re.test(titulo))
  if (!nivel) return null
  return Math.min(99, nivel.base + bonusReinado(dias))
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`)
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  const campeones = await campeonesDeWikipedia()
  console.log(`Wikipedia: ${campeones.length} cinturones con campeón`)

  const porNombre = new Map()
  for (const c of campeones) {
    const ctx = contextoDe(c.titulo, c.dias)
    if (ctx == null) continue
    const k = normaliza(c.campeon)
    // Con dos cinturones manda el mejor.
    if (!porNombre.has(k) || porNombre.get(k).ctx < ctx) {
      porNombre.set(k, { ctx, titulo: c.titulo, dias: c.dias })
    }
  }

  const { data: filas, error } = await sb.from('ranking_entries')
    .select('id, category, name, contexto_auto')
    .eq('sport', 'wwe').eq('category', 'jugadores').eq('active', true)
  if (error) throw error

  const updates = []
  for (const f of filas) {
    const hit = porNombre.get(normaliza(f.name))
    const actual = f.contexto_auto == null ? null : Number(f.contexto_auto)
    // Campeón → el valor del cinturón. Sin título → solo se recorta el plus
    // de campeón, nunca se aplana (ver TECHO_SIN_TITULO).
    const ctx = hit ? hit.ctx : Math.min(actual ?? TECHO_SIN_TITULO, TECHO_SIN_TITULO)
    updates.push({ ...f, ctx, titulo: hit?.titulo ?? '—', dias: hit?.dias ?? null,
                   cambia: actual == null || Math.abs(actual - ctx) > 0.01 })
  }
  updates.sort((a, b) => b.ctx - a.ctx)

  console.log(`\n--- ${updates.length} luchadores ---`)
  for (const u of updates) {
    const antes = u.contexto_auto == null ? '–' : Number(u.contexto_auto).toFixed(0)
    console.log(
      `  ${u.name.padEnd(16).slice(0, 16)} ctx ${String(antes).padStart(3)} → ${String(u.ctx).padStart(3)}` +
      `${u.cambia ? ' ' : ' ='}  ${u.titulo.slice(0, 38)}${u.dias ? ` (${u.dias}d)` : ''}`
    )
  }

  if (!APPLY) { console.log('\nDRY RUN.'); return }

  const aEscribir = updates.filter(u => u.cambia)
  if (!aEscribir.length) { console.log('\nNada que cambiar.'); return }

  let ok = 0, fail = 0
  for (const u of aEscribir) {
    const { error: err } = await sb.from('ranking_entries')
      .update({ contexto_auto: u.ctx })
      .eq('id', u.id).eq('category', u.category)   // la PK es (id, category)
    if (err) { fail++; console.error(`FAIL ${u.id}: ${err.message}`) } else ok++
  }
  console.log(`\nDone. OK=${ok} FAIL=${fail} (sin cambio: ${updates.length - aEscribir.length})`)
  console.log('Recuerda: SELECT refresh_ranking_view() para que llegue a la web.')
}

main().catch(err => { console.error(err); process.exit(1) })
