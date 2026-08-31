#!/usr/bin/env node
// Carga inicial de broadcast_rights — el bloque "Dónde verlo" de las noticias.
//
// IMPORTANTE: esto es una PROPUESTA, no un dato confirmado. Todas las filas entran
// con verified=false y la web no pinta NADA que no esté verificado. Los derechos de
// emisión cambian cada temporada y no hay fuente automática fiable: alguien tiene
// que mirarlos uno por uno antes de publicarlos. Un canal equivocado es peor que no
// poner canal.
//
//   node scripts/seed-broadcast-rights.mjs              # imprime la tabla a revisar
//   node scripts/seed-broadcast-rights.mjs --apply      # inserta/actualiza (verified=false)
//   node scripts/seed-broadcast-rights.mjs --verify=laliga,premier   # marca verificadas
//
// Competiciones y países elegidos con Search Console (90 días). Los nueve países son
// el 81 % de las impresiones; LaLiga es la primera en todos ellos y la Premier es
// más grande en Latam que en España.

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

for (const f of ['.env.local', '.env']) {
  const p = path.resolve(process.cwd(), f)
  if (!fs.existsSync(p)) continue
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(2)
}

// ── Propuesta ────────────────────────────────────────────────────────────────
// `dudoso: true` marca las filas donde tengo menos confianza y que hay que mirar
// primero. En Latinoamérica los derechos suelen ser REGIONALES, no nacionales
// (ESPN/Disney+ cubre buena parte de Sudamérica), así que muchas filas se repiten
// a propósito: no es un copiar y pegar descuidado, es cómo funciona el mercado.
const SUDAMERICA = ['AR', 'CL', 'CO', 'PE', 'VE', 'EC']
const fanOut = (codes, channels, extra = {}) =>
  codes.map((c) => ({ country_code: c, channels, ...extra }))

const SEED = {
  laliga: [
    { country_code: 'ES', channels: ['Movistar Plus+', 'DAZN LaLiga'] },
    { country_code: 'MX', channels: ['Sky Sports', 'ViX'] },
    ...fanOut(SUDAMERICA, ['DirecTV Sports', 'DGO']),
    { country_code: 'US', channels: ['ESPN Deportes', 'ESPN+'] },
  ],
  premier: [
    { country_code: 'ES', channels: ['DAZN', 'Movistar Plus+'] },
    { country_code: 'MX', channels: ['Sky Sports', 'Paramount+'], dudoso: true },
    ...fanOut(SUDAMERICA, ['ESPN', 'Disney+']),
    { country_code: 'US', channels: ['NBC Sports', 'Peacock', 'Telemundo'] },
  ],
  champions: [
    { country_code: 'ES', channels: ['Movistar Plus+', 'Amazon Prime Video'], note: 'Prime emite un partido por jornada' },
    { country_code: 'MX', channels: ['HBO Max', 'TNT Sports', 'Caliente TV'], dudoso: true },
    ...fanOut(SUDAMERICA, ['ESPN', 'Disney+']),
    { country_code: 'US', channels: ['Paramount+', 'CBS', 'TUDN'] },
  ],
  ufc: [
    { country_code: 'ES', channels: ['UFC Fight Pass', 'Eurosport'], dudoso: true },
    { country_code: 'MX', channels: ['Fox Sports', 'UFC Fight Pass'], dudoso: true },
    ...fanOut(SUDAMERICA, ['ESPN', 'Disney+', 'UFC Fight Pass']),
    { country_code: 'US', channels: ['Paramount+'], dudoso: true, note: 'El contrato pasó de ESPN a Paramount en 2026 — confirmar vigencia' },
  ],
  // La más frágil de las cinco: cada federación vende por su cuenta y cambia por
  // ciclo clasificatorio. Revisar entera antes de verificar.
  selecciones: [
    { country_code: 'ES', channels: ['La 1 (RTVE)'] },
    { country_code: 'MX', channels: ['TUDN', 'ViX', 'Azteca Deportes'] },
    { country_code: 'AR', channels: ['TyC Sports', 'TV Pública'] },
    { country_code: 'CL', channels: ['Chilevisión', 'TNT Sports'], dudoso: true },
    { country_code: 'CO', channels: ['Caracol TV', 'RCN'] },
    { country_code: 'PE', channels: ['América TV', 'Movistar Deportes'] },
    { country_code: 'VE', channels: ['Venevisión'], dudoso: true },
    { country_code: 'EC', channels: ['Teleamazonas', 'El Canal del Fútbol'], dudoso: true },
    { country_code: 'US', channels: ['Telemundo', 'Universo'], dudoso: true },
  ],
}

const NOMBRES = { ES: 'España', MX: 'México', AR: 'Argentina', PE: 'Perú', US: 'EE.UU.', CO: 'Colombia', CL: 'Chile', VE: 'Venezuela', EC: 'Ecuador' }

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const VERIFY = (args.find((a) => a.startsWith('--verify=')) || '').split('=')[1]
const sb = createClient(URL, KEY, { auth: { persistSession: false } })

if (VERIFY) {
  const keys = VERIFY.split(',').map((s) => s.trim()).filter(Boolean)
  const { error, count } = await sb
    .from('broadcast_rights')
    .update({ verified: true, updated_at: new Date().toISOString() }, { count: 'exact' })
    .in('competition_key', keys)
    .select('id', { count: 'exact', head: true })
  if (error) { console.error('Error:', error.message); process.exit(1) }
  console.log(`✅ ${count ?? '?'} filas verificadas para: ${keys.join(', ')}`)
  console.log('   Ya se muestran en la web.')
  process.exit(0)
}

const filas = []
for (const [competition_key, list] of Object.entries(SEED)) {
  for (const r of list) {
    filas.push({
      competition_key,
      country_code: r.country_code,
      channels: r.channels,
      url: r.url ?? null,
      note: r.note ?? null,
      verified: false,
    })
  }
}

console.log(`\nPropuesta: ${filas.length} filas · ${Object.keys(SEED).length} competiciones × 9 países`)
console.log('Todas entran con verified=false. La web no muestra nada hasta verificarlas.\n')
for (const [comp, list] of Object.entries(SEED)) {
  console.log(`── ${comp}`)
  for (const r of list) {
    const marca = r.dudoso ? ' ⚠️  revisar' : ''
    console.log(`   ${(NOMBRES[r.country_code] || r.country_code).padEnd(10)} ${r.channels.join(' / ')}${marca}`)
    if (r.note) console.log(`   ${''.padEnd(10)} └ ${r.note}`)
  }
  console.log('')
}

if (!APPLY) {
  console.log('Nada escrito. Repite con --apply para insertarlas (siguen sin mostrarse).')
  process.exit(0)
}

const { error } = await sb
  .from('broadcast_rights')
  .upsert(filas, { onConflict: 'competition_key,country_code' })
if (error) { console.error('Error:', error.message); process.exit(1) }

console.log(`✅ ${filas.length} filas insertadas con verified=false.`)
console.log('   Revísalas y márcalas con: node scripts/seed-broadcast-rights.mjs --verify=laliga')
