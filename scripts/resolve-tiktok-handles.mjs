#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// resolve-tiktok-handles.mjs
//
// Encuentra el perfil de TikTok de los creadores a los que les falta, y guarda
// sus seguidores REALES.
//
// ── POR QUÉ ──────────────────────────────────────────────────────
// 55 cifras del ranking de Contenido —22,8 millones de seguidores sumados— son
// estimaciones que alguien escribió a mano y que nadie ha vuelto a mirar. Ese
// es exactamente el tipo de dato que puso a Impacto MMA de número uno con
// 22.800.000 suscriptores de YouTube cuando tiene 252.000.
//
// De esas 55, la mitad son de TikTok, y TikTok sí se puede leer desde el
// servidor: su HTML trae `followerCount`, `uniqueId` y `nickname` en claro. No
// hace falta navegador ni cuota de API. Lo único que falta es el nombre de
// usuario.
//
// ── CÓMO SE ADIVINA SIN METER LA PATA ────────────────────────────
// Se prueban candidatos: el handle que ya usa en Instagram o en YouTube (mucha
// gente repite nombre de usuario) y variantes de su nombre. Y se acepta SOLO si
// el nombre visible del perfil de TikTok se parece al del creador.
//
// Esa comprobación es la que faltó la primera vez que verificamos perfiles: dar
// por bueno un handle porque «existe» es como acabamos anclados a @manololama,
// que tiene 1 seguidor y 0 publicaciones. Aquí, ante la duda, no se escribe: se
// informa y decide una persona.
//
// Uso:
//   node scripts/resolve-tiktok-handles.mjs           # solo informa
//   node scripts/resolve-tiktok-handles.mjs --apply   # guarda los confirmados
// ─────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { writeFileSync } from 'fs'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Faltan claves de Supabase'); process.exit(1) }

const APPLY = process.argv.includes('--apply')
const CATEGORIES = ['creadores', 'creadores_wwe', 'periodistas']
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const limpia = (h) => String(h ?? '').trim().replace(/^@/, '').replace(/^https?:\/\/[^/]+\//, '').replace(/\/$/, '').split(/[/?]/)[0]

// ¿El nombre visible del perfil es el de nuestro creador?
//
// La primera versión de esto era demasiado blanda y daba por buenos perfiles
// que no tenían nada que ver: aceptó @UFC —la cuenta oficial, 19,4 millones—
// para «UFC & Boxeo En Español», y @Paco y @Sofi para Paco González y Sofi
// Martínez. Bastaba con que el apodo del perfil contuviera UNA palabra del
// nombre, y «Paco» aparece en muchos sitios.
//
// Ahora se exige que los nombres completos se contengan el uno al otro, o que
// compartan DOS palabras distintivas. Resuelve menos casos, pero los que
// resuelve son suyos.
function esLaMismaPersona(nickTikTok, nombre) {
  const [p, c] = [norm(nickTikTok), norm(nombre)]
  if (!p || !c || p.length < 4) return false
  if (p.includes(c) || c.includes(p)) return true
  const palabras = nombre.split(/\s+/).map(norm).filter(w => w.length >= 5)
  return palabras.filter(w => p.includes(w)).length >= 2
}

// Un perfil diminuto no es el de alguien que está en un ranking: o es un
// homónimo o es una cuenta abandonada. Mismo criterio que en Instagram.
const MIN_SEGUIDORES = 1000

// Candidatos a nombre de usuario.
//
// SOLO nombres de usuario específicos: los que ya usa en otra red (mucha gente
// repite) y su nombre completo pegado. El primer nombre suelto se probó y fue
// un desastre — «paco», «sofi», «troy» y «uke» pertenecen a otros.
function candidatos(entry) {
  const out = []
  const push = (v, origen) => {
    const c = limpia(v)
    if (c && c.length >= 5 && !out.some(x => x.handle === c)) out.push({ handle: c, origen })
  }
  // `anclado` = el nombre de usuario ya está en su ficha, muchas veces
  // corroborado contra Wikidata. Si ese mismo usuario en TikTok tiene audiencia
  // real, es suyo: exigir ADEMÁS que el apodo coincida descartaba a gente que
  // simplemente firma distinto. El TikTok de Sebastián Vignolo se llama «Pollo
  // vignolo AURA❤️» y el de Mateo Páramo «Páramo Presenta».
  push(entry.handles?.instagram, 'anclado')
  const yt = entry.handles?.youtube
  if (yt && !/^UC[\w-]{20,}$/.test(String(yt))) push(yt, 'anclado')
  push(entry.handles?.twitter, 'anclado')
  // `adivinado` = deducido del nombre. Aquí sí hace falta que el apodo coincida:
  // nadie ha corroborado que ese usuario sea suyo.
  const completo = entry.name.replace(/\s+/g, '')   // «Sofi Martínez» → sofimartinez
  if (completo.length >= 8) push(completo, 'adivinado')
  return out
}

async function leePerfil(handle) {
  try {
    const r = await fetch(`https://www.tiktok.com/@${handle}`, { headers: { 'User-Agent': UA } })
    if (!r.ok) return null
    const html = await r.text()
    const seguidores = Number(html.match(/"followerCount":(\d+)/)?.[1] ?? 0)
    const nick = html.match(/"nickname":"([^"]{1,60})"/)?.[1] ?? null
    const unico = html.match(/"uniqueId":"([^"]{1,40})"/)?.[1] ?? null
    const videos = Number(html.match(/"videoCount":(\d+)/)?.[1] ?? 0)
    if (!seguidores && !nick) return null
    return { seguidores, nick, unico, videos }
  } catch {
    return null
  }
}

async function main() {
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  const { data: ents, error } = await sb
    .from('ranking_entries')
    .select('id, name, category, handles')
    .eq('active', true)
    .in('category', CATEGORIES)
    .order('name')
  if (error) throw error

  const { data: met } = await sb.from('creator_raw_metrics').select('creator_id, tiktok_known')
  const sembrado = new Map((met ?? []).map(m => [m.creator_id, m.tiktok_known ?? 0]))

  // A quién le falta el handle de TikTok. Se buscan TODOS los que no lo tienen,
  // no solo los que ya traen una cifra sembrada: si encontramos el perfil de
  // alguien que figuraba con cero, mejor para él y para el ranking.
  const objetivo = ents.filter(e => !limpia(e.handles?.tiktok))
  console.log(`${ents.length} perfiles de contenido · ${objetivo.length} sin TikTok anclado\n`)

  const informe = []
  let confirmados = 0, probables = 0, dudosos = 0, sinSuerte = 0

  for (const [i, e] of objetivo.entries()) {
    const previo = sembrado.get(e.id) ?? 0
    let hallazgo = null
    const probados = []

    for (const { handle: cand, origen } of candidatos(e)) {
      const perfil = await leePerfil(cand)
      probados.push(cand)
      await new Promise(r => setTimeout(r, 700))
      if (!perfil) continue
      const coincide = esLaMismaPersona(perfil.nick, e.name)
      const vivo = perfil.seguidores >= MIN_SEGUIDORES
      if (coincide && vivo) { hallazgo = { ...perfil, handle: cand, origen, nivel: 'seguro' }; break }
      // Handle ya corroborado en otra red + audiencia real: casi seguro suyo,
      // pero el nombre no lo confirma, así que se marca para revisar a ojo.
      if (origen === 'anclado' && vivo) { hallazgo = { ...perfil, handle: cand, origen, nivel: 'probable' }; break }
      if (!hallazgo) {
        hallazgo = {
          ...perfil, handle: cand, origen, dudoso: true,
          razon: coincide ? `solo ${perfil.seguidores} seguidores` : `se llama «${perfil.nick}»`,
        }
      }
    }

    const linea = `${String(i + 1).padStart(3)}/${objetivo.length}`
    if (hallazgo && !hallazgo.dudoso) {
      if (hallazgo.nivel === 'probable') probables++; else confirmados++
      const cambio = previo && previo !== hallazgo.seguidores
        ? `  (sembrado decía ${previo.toLocaleString('es-ES')})` : ''
      const marca = hallazgo.nivel === 'probable' ? '~' : '✓'
      const nota = hallazgo.nivel === 'probable' ? `  (se llama «${hallazgo.nick}» — revisar)` : ''
      console.log(`${linea} ${marca} ${e.name.padEnd(26).slice(0, 26)} @${hallazgo.handle.padEnd(22).slice(0, 22)} ${String(hallazgo.seguidores).padStart(9)} seguidores${cambio}${nota}`)
      informe.push({ ...e, estado: hallazgo.nivel === 'probable' ? 'PROBABLE' : 'OK', ...hallazgo, previo })
    } else if (hallazgo?.dudoso) {
      dudosos++
      console.log(`${linea} ? ${e.name.padEnd(26).slice(0, 26)} @${hallazgo.handle.padEnd(22).slice(0, 22)} ${hallazgo.razon} — no se toca`)
      informe.push({ ...e, estado: 'DUDOSO', ...hallazgo, previo })
    } else {
      sinSuerte++
      informe.push({ id: e.id, name: e.name, estado: 'NO_ENCONTRADO', probados, previo })
    }
  }

  console.log(`\n─── Resumen ───`)
  console.log(`  ✓ perfil confirmado   ${confirmados}`)
  console.log(`  ~ probable (revisar)  ${probables}`)
  console.log(`  ? existe pero es otro ${dudosos}`)
  console.log(`  · sin encontrar       ${sinSuerte}`)

  // Cuánto cambia el ranking respecto a lo que había sembrado.
  const conPrevio = informe.filter(r => r.estado === 'OK' && r.previo > 0)
  if (conPrevio.length) {
    console.log(`\n  De los confirmados, ${conPrevio.length} tenían cifra sembrada:`)
    for (const r of conPrevio.sort((a, b) => Math.abs(b.previo - b.seguidores) - Math.abs(a.previo - a.seguidores)).slice(0, 12)) {
      const factor = r.previo > r.seguidores ? `÷${(r.previo / r.seguidores).toFixed(1)}` : `×${(r.seguidores / r.previo).toFixed(1)}`
      console.log(`     ${r.name.padEnd(26).slice(0, 26)} ${String(r.previo).padStart(9)} → ${String(r.seguidores).padStart(9)}  ${factor}`)
    }
  }

  if (APPLY) {
    let ok = 0
    // Solo los seguros. Los «probables» se listan para que los mire una persona.
    for (const r of informe.filter(x => x.estado === 'OK')) {
      // PK compuesta (id, category): filtrar por las dos o se pisa a otra persona.
      const { data: fila } = await sb.from('ranking_entries')
        .select('handles').eq('id', r.id).eq('category', r.category).maybeSingle()
      await sb.from('ranking_entries')
        .update({ handles: { ...(fila?.handles ?? {}), tiktok: r.handle } })
        .eq('id', r.id).eq('category', r.category)

      const { data: existe } = await sb.from('creator_raw_metrics').select('creator_id').eq('creator_id', r.id).maybeSingle()
      const payload = existe
        ? { creator_id: r.id, tiktok_known: r.seguidores, fetched_at: new Date().toISOString() }
        : { creator_id: r.id, yt_subscribers: 0, twitch_known: 0, twitter_known: 0, instagram_known: 0, tiktok_known: r.seguidores, fetched_at: new Date().toISOString() }
      const { error: err } = await sb.from('creator_raw_metrics').upsert(payload, { onConflict: 'creator_id' })
      if (!err) ok++
    }
    console.log(`\n  Guardados: ${ok}`)
    await sb.rpc('f_sync_creator_scores')
    await sb.rpc('refresh_ranking_view')
    console.log('  ✓ notas recalculadas')
  } else {
    console.log('\n  (simulación — usa --apply para guardar)')
  }

  const out = path.join(__dirname, 'data', 'tiktok-handle-report.json')
  writeFileSync(out, JSON.stringify(informe, null, 2))
  console.log(`\nInforme en ${out}`)
}

main().catch(e => { console.error(e); process.exit(1) })
