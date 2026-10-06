#!/usr/bin/env node
// Carga inicial de broadcast_rights — el bloque "Dónde verlo" de las noticias.
//
// La primera carga (31/08/2026) era una PROPUESTA sin verificar y no se mostraba.
// El 06/10/2026 se verificó fila a fila con fuentes (ver `fuente`): 17 de 45 estaban
// bien. Ahora cada fila dice si está confirmada (`ok`) y hasta cuándo vale (`hasta`).
// Los derechos cambian cada temporada y no hay fuente automática fiable: revisar
// antes de cada temporada. Un canal equivocado es peor que no poner canal.
//
//   node scripts/seed-broadcast-rights.mjs              # imprime la tabla
//   node scripts/seed-broadcast-rights.mjs --apply      # carga/actualiza (las `ok` se muestran)
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

// ── Datos verificados (06/10/2026, temporada 2026-27) ───────────────────────
// Cada fila lleva `ok`: true = confirmada con fuente primaria o prensa seria de
// 2025-2026 y se publica con verified=true; false = dudosa y NO se muestra. La
// fuente va en `fuente` para que la próxima revisión no empiece de cero. `hasta`
// es el fin del contrato (valid_to): al caducar la fila deja de mostrarse sola, que
// es lo que queremos — un canal caducado es un canal equivocado.
//
// En Latinoamérica los derechos suelen ser REGIONALES, no nacionales (ESPN/Disney+
// cubre buena parte de Sudamérica), así que muchas filas se repiten a propósito.
const SUDAMERICA = ['AR', 'CL', 'CO', 'PE', 'VE', 'EC']
const fanOut = (codes, channels, extra = {}) =>
  codes.map((c) => ({ country_code: c, channels, ...extra }))

const SEED = {
  laliga: [
    { country_code: 'ES', channels: ['Movistar Plus+', 'DAZN'], ok: true, hasta: '2027-06-30', fuente: 'ocu.org/tecnologia/internet-telefonia/noticias/donde-ver-futbol (10-08-2026)' },
    // Canal 5 da un partido por jornada en abierto; Sky, el resto (y hasta 2031-32).
    { country_code: 'MX', channels: ['Sky Sports', 'Canal 5'], ok: true, hasta: '2027-06-30', fuente: 'livesoccertv.com (México); televisa.com/canal5' },
    // Renovado en agosto de 2026: ESPN ~190 partidos por temporada, DSports el resto.
    ...fanOut(['AR', 'CL', 'CO', 'PE', 'EC'], ['DSports', 'DGO', 'ESPN', 'Disney+'], { ok: true, hasta: '2032-06-30', fuente: 'laliga.com — renovación ESPN y DSports hasta 2031-32 (ago-2026)' }),
    // DirecTV ya no opera en Venezuela (ahora es SimpleTV): sin confirmar DGO allí.
    { country_code: 'VE', channels: ['ESPN', 'Disney+', 'DSports'], ok: false, hasta: '2032-06-30', fuente: 'laliga.com (ago-2026); DGO en Venezuela sin confirmar' },
    { country_code: 'US', channels: ['ESPN+', 'ESPN Deportes', 'ESPN'], ok: true, hasta: '2029-06-30', fuente: 'espnpressroom.com — acuerdo ESPN-LaLiga hasta 2028-29' },
  ],
  premier: [
    { country_code: 'ES', channels: ['DAZN', 'Movistar Plus+'], note: 'Movistar Plus+ emite un partido por jornada', ok: true, hasta: '2028-06-30', fuente: 'dazngroup.com — renovación hasta 2028' },
    { country_code: 'MX', channels: ['HBO Max', 'TNT Sports', 'FOX'], ok: true, hasta: '2028-06-30', fuente: 'premierleague.com/en/media/broadcasters' },
    ...fanOut(SUDAMERICA, ['ESPN', 'Disney+'], { ok: true, hasta: '2028-06-30', fuente: 'latinamerica.espnpressroom.com (feb-2025), hasta 2028' }),
    { country_code: 'US', channels: ['NBC', 'Peacock', 'USA Network', 'Telemundo', 'Universo'], ok: true, hasta: '2028-06-30', fuente: 'corporate.comcast.com — NBCUniversal hasta 2027-28' },
  ],
  champions: [
    // Amazon NO tiene la Champions en España: Telefónica compró los 189 partidos 2024-27.
    { country_code: 'ES', channels: ['Movistar Plus+'], ok: true, hasta: '2027-06-30', fuente: 'mundoplus.tv; ocu.org (10-08-2026)' },
    // FOX compró Caliente TV (jun-2025): los miércoles van por FOX / Fox One.
    { country_code: 'MX', channels: ['HBO Max', 'TNT Sports', 'FOX'], ok: true, hasta: '2027-06-30', fuente: 'excelsior.com.mx (07-09-2026)' },
    ...fanOut(SUDAMERICA, ['ESPN', 'Disney+'], { ok: true, hasta: '2027-06-30', fuente: 'ESPN/Disney+ hasta 2026-27; desde 2027-28 se reparte con Paramount+' }),
    { country_code: 'US', channels: ['Paramount+', 'CBS', 'TUDN', 'ViX'], ok: true, hasta: '2027-06-30', fuente: 'cbssports.com; TUDN/ViX hasta 2026-27' },
  ],
  // Nueva (06/10/2026). La vende la UEFA en bloque y la emite otro operador que los
  // partidos de la selección local. Lista oficial: uefa.com, «where to watch the
  // Nations League» (06-10-2026).
  nations_league: [
    { country_code: 'ES', channels: ['La 1 (RTVE)', 'DAZN'], ok: true, hasta: '2027-06-30', fuente: 'uefa.com (06-10-2026); iusport — RTVE Nations League' },
    { country_code: 'MX', channels: ['Sky Sports'], ok: true, hasta: '2027-06-30', fuente: 'uefa.com (06-10-2026); record.com.mx Francia–Italia' },
    ...fanOut(SUDAMERICA, ['ESPN', 'Disney+'], { ok: true, hasta: '2027-06-30', fuente: 'latinamerica.espnpressroom.com (sep-2026), exclusiva' }),
    { country_code: 'US', channels: ['FOX Sports', 'ViX'], ok: true, hasta: '2027-06-30', fuente: 'foxsports.com/presspass — Nations League 2026-27' },
  ],
  ufc: [
    // Paramount+ en exclusiva para Latinoamérica desde 2026 (7 años). UFC Fight Pass
    // fuera: los eventos en directo son exclusivos de Paramount+.
    ...fanOut(['AR', 'CL', 'CO', 'PE', 'EC', 'MX'], ['Paramount+'], { ok: true, fuente: 'ufcespanol.com (28-10-2025); clarosports.com (2026)' }),
    { country_code: 'VE', channels: ['Paramount+'], ok: false, fuente: 'contrato latinoamericano; ninguna fuente nombra a Venezuela' },
    { country_code: 'ES', channels: ['HBO Max', 'Eurosport'], note: 'Eurosport emite hasta 14 veladas al año', ok: true, fuente: 'eurosport.es (04-10-2026)' },
    { country_code: 'US', channels: ['Paramount+', 'CBS'], ok: true, fuente: 'ufc.com — acuerdo Paramount/TKO desde 2026' },
  ],
  // ⚠️ SIN PUBLICAR. Estos son los canales de los partidos de la SELECCIÓN LOCAL
  // (amistosos, eliminatorias), que cada federación vende por su cuenta y a veces
  // partido a partido. Solo valen cuando juega la selección de ese país, y la web
  // aún no sabe distinguirlo: con esta clave, un Brasil–Uruguay saldría con TyC
  // Sports en Argentina. Hasta modelarlo (`seleccion_local`), verified=false.
  selecciones: [
    { country_code: 'ES', channels: ['La 1 (RTVE)'], ok: false, fuente: '2playbook.com — RTVE, todos los partidos de España 2026-28' },
    { country_code: 'MX', channels: ['TUDN', 'ViX', 'Canal 5', 'Azteca 7'], ok: false, fuente: 'infobae.com/mexico (05-10-2026)' },
    { country_code: 'AR', channels: ['TyC Sports', 'TV Pública'], ok: false, fuente: 'tribunadeportiva.com.ar (sep-2026)' },
    { country_code: 'CL', channels: ['Mega'], ok: false, fuente: 'biobiochile.cl (05-10-2026)' },
    { country_code: 'CO', channels: ['Caracol TV', 'RCN'], ok: false, fuente: 'noticiascaracol.com' },
    { country_code: 'PE', channels: ['América TV'], ok: false, fuente: 'infobae.com/peru (03-10-2026)' },
    { country_code: 'VE', channels: ['Televen'], ok: false, fuente: 'rpp.pe; infobae (02-10-2026)' },
    { country_code: 'EC', channels: ['Teleamazonas', 'TC'], ok: false, fuente: 'primicias.ec' },
    { country_code: 'US', channels: ['Telemundo', 'Universo'], ok: false, fuente: 'ussoccer.com (may-2026), hasta 2030' },
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
      verified: Boolean(r.ok),
      valid_to: r.hasta ?? null,
    })
  }
}

const nOk = filas.filter((f) => f.verified).length
console.log(`\n${filas.length} filas · ${Object.keys(SEED).length} competiciones × 9 países · ${nOk} verificadas, ${filas.length - nOk} sin publicar\n`)
for (const [comp, list] of Object.entries(SEED)) {
  console.log(`── ${comp}`)
  for (const r of list) {
    const marca = r.ok ? '' : ' ⚠️  sin publicar'
    console.log(`   ${(NOMBRES[r.country_code] || r.country_code).padEnd(10)} ${r.channels.join(' / ')}${marca}`)
    if (r.note) console.log(`   ${''.padEnd(10)} └ ${r.note}`)
  }
  console.log('')
}

if (args.includes('--json')) {
  // Para la maqueta local (CASILLAS_MAQUETA_TV): las filas tal como quedarían.
  fs.writeFileSync('.casillas/tv-propuesta.json', JSON.stringify(filas, null, 2))
  console.log('Escrito .casillas/tv-propuesta.json')
  process.exit(0)
}

if (!APPLY) {
  console.log('Nada escrito. Repite con --apply para cargarlas (las verificadas se muestran al momento).')
  process.exit(0)
}

const { error } = await sb
  .from('broadcast_rights')
  .upsert(filas, { onConflict: 'competition_key,country_code' })
if (error) { console.error('Error:', error.message); process.exit(1) }

console.log(`✅ ${filas.length} filas cargadas: ${nOk} verificadas (se muestran), ${filas.length - nOk} sin publicar.`)
