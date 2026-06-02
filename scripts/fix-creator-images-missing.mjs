#!/usr/bin/env node
// fix-creator-images-missing.mjs
// Busca y aplica imágenes para TODOS los creadores sin image_url
// (incluyendo active=false que el script principal ignora)
//
// Fuentes por prioridad:
//   1. WIKIPEDIA_MAP — URLs de Wikipedia hardcodeadas para personas conocidas
//   2. YouTube Data API — para los que tienen handles.youtube
//   3. unavatar.io — fallback con Instagram/Twitter handle

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env.local') })

const APPLY = process.argv.includes('--apply')
const YT_KEY = process.env.YOUTUBE_API_KEY
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ─── 1. URLs mapeadas manualmente (Wikipedia + YouTube + Spotify verificadas) ─
const WIKIPEDIA_MAP = {
  // Personas — Wikipedia
  'marc-f1':             'https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Marc_Gene_2007_Montjuic.jpg/330px-Marc_Gene_2007_Montjuic.jpg',
  'alexa-grasso-content':'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Alexa_Grasso_2020_01.png/330px-Alexa_Grasso_2020_01.png',
  'yair-rodriguez-content':'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Carrera_con_Yair_%22Pantera%22_Rodr%C3%ADguez_-i---i-_%2830657689682%29_cropped.jpg/330px-Carrera_con_Yair_%22Pantera%22_Rodr%C3%ADguez_-i---i-_%2830657689682%29_cropped.jpg',
  'koke-resurrecci':     'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Koke_2019.jpg/330px-Koke_2019.jpg',
  'sandra-panos':        'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Sandra_Panos_amb_la_marca_Catalunya_%28cropped%29.jpg/330px-Sandra_Panos_amb_la_marca_Catalunya_%28cropped%29.jpg',
  'roberto-bautista':    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Bautista_Agut_MCM23_%2814%29_%2852883313449%29.jpg/330px-Bautista_Agut_MCM23_%2814%29_%2852883313449%29.jpg',
  'carlota-ciganda':     'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/2009_Women%27s_British_Open_-_Carlota_Ciganda_%282%29.jpg/330px-2009_Women%27s_British_Open_-_Carlota_Ciganda_%282%29.jpg',
  'garbine-muguruza':    'https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/25th_Laureus_World_Sports_Awards_-_Red_Carpet_-_Garbi%C3%B1e_Muguruza_-_240422_182821-2_%28cropped%29.jpg/330px-25th_Laureus_World_Sports_Awards_-_Red_Carpet_-_Garbi%C3%B1e_Muguruza_-_240422_182821-2_%28cropped%29.jpg',
  'ryan-garcia':         'https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/RYAN_GARCIA.jpg/330px-RYAN_GARCIA.jpg',
  'stephanie-vaquer-wwe':'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/Stephanie_Vaquer%2C_April_2024_2.jpg/330px-Stephanie_Vaquer%2C_April_2024_2.jpg',
  'juan-lebron':         'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Juan_Lebron.jpg/330px-Juan_Lebron.jpg',
  'majo-alayeto':        'https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Majo_Alayeto_2019.jpg/330px-Majo_Alayeto_2019.jpg',
  'gabri-veiga':         'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Gabri_Veiga_2024_%28cropped%29.jpg/330px-Gabri_Veiga_2024_%28cropped%29.jpg',
  'sanyo-gutierrez':     'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/Santo_Guti%C3%A9rrez_and_Pato_Paradiso%2C_World_Padel_Championship_Dubai_2022.jpg/330px-Santo_Guti%C3%A9rrez_and_Pato_Paradiso%2C_World_Padel_Championship_Dubai_2022.jpg',
  'rodri-content':       'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/RODRI_-_SWE_vs_ESP_-_UEFA_EURO_2020_QUALIFIERS_-_2019.10.15_%28cropped%29.jpg/330px-RODRI_-_SWE_vs_ESP_-_UEFA_EURO_2020_QUALIFIERS_-_2019.10.15_%28cropped%29.jpg',
  // Logos Wikipedia
  'saul-ramos-box':      'https://upload.wikimedia.org/wikipedia/en/thumb/9/92/Matchroom_logo.jpeg/330px-Matchroom_logo.jpeg',
  // YouTube avatars verificados
  'iker-ruiz-futbol':    'https://yt3.ggpht.com/z89B_IXLx98X_ZWV2ofycVPg7CkNYzBrQ21ZoafI_Vlwm0A3Ls6R_G1v3NV7NLIh2naQLe0HMw=s400-c-k-c0x00ffffff-no-rj',
  'danchez-nba':         'https://yt3.ggpht.com/lHcrz1IMcXpjTCm1wrmo6dvCPsDIvq8UFoX8V2N1m62O94Zn9ZCm-EBbXlSWdJZhd0vnu-NWwA=s400-c-k-c0x00ffffff-no-rj',
  'resumen-canal':       'https://yt3.ggpht.com/ytc/AIdro_mTYoqy-gVj0QXrqNyGEWkiKbKvm-qjRVA9lPoHA5zEy0k=s400-c-k-c0x00ffffff-no-rj',
  'nexxuzHD':            'https://yt3.ggpht.com/ytc/AIdro_nHGvYr6J2lNnM9Hu8o2TSUnSf1HTR3yviaR7E0h9lmhR0=s400-c-k-c0x00ffffff-no-rj',
  'gento-futbol':        'https://yt3.ggpht.com/X0CNFVmcVk7hWJ-TAg3aNMXy8sy6V1GFGGJ1BNdi9aiK0T2J9Om6ygu3NIjmpHKuOuTilyiR=s400-c-k-c0x00ffffff-no-rj',
  'ufc-entre-asaltos':   'https://yt3.ggpht.com/qxsTGNMcFPwqYRykApeJyLbdQCBZRPr_gCXuxwDbYuYZah5ZYmKs4bq0rtkCLLC011A0MgsGs10=s400-c-k-c0x00ffffff-no-rj',
  'futvox-chile':        'https://yt3.ggpht.com/Mr2rV78cG9o9uJGVOWHY3SO_Eqn5-n47U1ygOdwqr4kXBedtD5QOZRRoyZficN8uJuMWY4UYFA=s400-c-k-c0x00ffffff-no-rj',
  'grapsody':            'https://yt3.ggpht.com/Fo3Ujs3bjx4lbdHCHcDnj2NF7q9XQNYdYRQc0PewGHWhCMwqtAuW3JawdPPZYCPczDy3Mf-FUQ=s400-c-k-c0x00ffffff-no-rj',
  'solomonster':         'https://yt3.ggpht.com/zY3-soIrMl-DaYyN07ELtfCR4HO01tIYDT1d306CMnl5Mr3bzkUzGApNjWBBp0NC3lbhzEFESkw=s400-c-k-c0x00ffffff-no-rj',
  'popotillo':           'https://yt3.ggpht.com/ytc/AIdro_nozqy4OCJU140sAsPlSJqxZuc1HEEAqlhBbhB5=s400-c-k-c0x00ffffff-no-rj',
  'doberdan-mma':        'https://yt3.ggpht.com/mvXVp0hHcIEeO9xOPvPyDMKP80whSELiPslvMEhEINEv8jbBCh4X-2Gq1TdSmxrDlbqPq1oS_aQ=s400-c-k-c0x00ffffff-no-rj',
  'gerynna-sotelo':      'https://yt3.ggpht.com/UjJ_-YUJB9BmMAf0krkBttUIqoRaHDkKyswhv1JMcCKoJOXpHHrCNY0W5h8r0s0IYbWYLqKH=s400-c-k-c0x00ffffff-no-rj',
  'ttn-deportivo':       'https://yt3.ggpht.com/692mZG4Ct6TXo9mj4aSZqZxkd6gDOoNiFgpYZTmEnrZjnNAb5p7l3C4RSnhfJIBiJnBQMTVj=s400-c-k-c0x00ffffff-no-rj',
  'twisted-banks-wwe':   'https://yt3.ggpht.com/hqbq8DUdIFNeFTtpUf7YBtl6oAz5UB9N5Ef9-X9D9yqBp0E9Vm7GKNPnBqNlNfxbCULAkui=s400-c-k-c0x00ffffff-no-rj',
  'futsal-espana':       'https://yt3.ggpht.com/iQCyjLnoL7WOf6IoZ2-FLSlgZ2LhdRxWUP8Jc2HGQ_mHaF7LpH13uCWJIlUH7LkxT0W6rVLF=s400-c-k-c0x00ffffff-no-rj',
  // Más YouTube avatars
  'whatculture-wwe':     'https://yt3.ggpht.com/ymdlVt4ErcJpkQplIDve8bgiwfYOaIlyTr1IjU97FXZvRSeceR7L_q9U9jG7zNidT-2L-V6a=s400-c-k-c0x00ffffff-no-rj',
  'wregret':             'https://yt3.ggpht.com/ytc/AIdro_nV4KK0WQtaFcHF9oMuCGfRAm_ZmLya7fUq9FeUVmgpFFA=s400-c-k-c0x00ffffff-no-rj',
  'joma':                'https://yt3.ggpht.com/IYWyaqwPu4bqhVol3yPvAmqaXZjVEdcdlh1CvdvCyqxD1WR0b_n3VoaGl1o4r3yVuvj_gnb0=s400-c-k-c0x00ffffff-no-rj',
  'coki-nieto':          'https://yt3.ggpht.com/ytc/AIdro_lwCQ0_Nu8TiRYF7vW_vx66fpBe-J8yBMAp0RnL=s400-c-k-c0x00ffffff-no-rj',
  'futbolsites':         'https://yt3.ggpht.com/aH3DOhuTq0ok78dF6szjDv54_DlPinfVqVfv_daEjDoYtvPoQC0bGvgNJLl-5WoGfbVkFwbmFQ=s400-c-k-c0x00ffffff-no-rj',
  'sebas-fernandez-co':  'https://yt3.ggpht.com/SxKPyze1rcpHXUFgQm4FlWO_Vg8pOqkNwt30ytlTvbvuTjjcOiPuRej_6nP3InqQKxJQV7Z8=s400-c-k-c0x00ffffff-no-rj',
  // Spotify artwork (stable CDN)
  'pasion-mx-futbol':    'https://i.scdn.co/image/ab67656300005f1fd6fd9f890a67651d14d54108',
  'zona-roja-nfl':       'https://i.scdn.co/image/ab67656300005f1fd2c33872a5336f963822a8dd',
  'desde-los-territorios':'https://i.scdn.co/image/ab67656300005f1f20e777af71f285ff63dd2b20',
  'lucha-jobbers':       'https://i.scdn.co/image/ab67656300005f1f738a414c1bca2cc373f9d4af',
  'area-de-combate-espn':'https://i.scdn.co/image/ab67656300005f1fb627b27d19e53b405a49d590',
  'la-zona-de-combate':  'https://i.scdn.co/image/ab67656300005f1ff7fce0a4152e7f4a9c310b54',
}

// ─── 2. Obtener imagen de YouTube ─────────────────────────────────────────────
async function ytThumb(handle) {
  const base = 'https://www.googleapis.com/youtube/v3'
  const upgrade = url => url?.replace(/=s\d+/, '=s400') ?? null

  if (handle.match(/^UC[A-Za-z0-9_-]{20,}$/)) {
    const r = await fetch(`${base}/channels?part=snippet&id=${handle}&key=${YT_KEY}`)
    const d = await r.json()
    return upgrade(d?.items?.[0]?.snippet?.thumbnails?.high?.url
                ?? d?.items?.[0]?.snippet?.thumbnails?.default?.url)
  }
  if (handle.startsWith('@')) {
    const h = handle.replace('@','')
    const r = await fetch(`${base}/channels?part=snippet&forHandle=${encodeURIComponent(h)}&key=${YT_KEY}`)
    const d = await r.json()
    return upgrade(d?.items?.[0]?.snippet?.thumbnails?.high?.url
                ?? d?.items?.[0]?.snippet?.thumbnails?.default?.url)
  }
  return null
}

// ─── 3. unavatar.io (Instagram / Twitter fallback) ───────────────────────────
async function unavatar(handle, service = 'instagram') {
  const url = `https://unavatar.io/${service}/${handle}?fallback=false`
  try {
    const r = await fetch(url, { headers:{ 'User-Agent':'TakaSports/1.0' }, redirect:'follow' })
    if (!r.ok || r.url.includes('fallback')) return null
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length < 5000) return null
    return r.url  // URL final tras redirect (puede ser yt3.ggpht.com etc)
  } catch { return null }
}

// ─── main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Mode: ${APPLY ? '✅ APPLY' : '🔍 DRY RUN'}\n`)

  const { data: entries, error } = await sb
    .from('ranking_entries')
    .select('id, name, handles, image_url')
    .in('category', ['creadores', 'creadores_wwe'])
    .is('image_url', null)
    .order('name')
  if (error) { console.error(error.message); process.exit(1) }

  console.log(`Creadores sin imagen: ${entries.length}\n`)

  let ok = 0, fail = 0
  for (const e of entries) {
    let url = null
    let source = ''

    // 1. Wikipedia
    if (WIKIPEDIA_MAP[e.id]) {
      url = WIKIPEDIA_MAP[e.id]
      source = 'wikipedia'
    }

    // 2. YouTube
    if (!url && e.handles?.youtube) {
      url = await ytThumb(e.handles.youtube)
      source = 'youtube'
      await sleep(150)
    }

    // 3. Instagram via unavatar
    if (!url && e.handles?.instagram) {
      url = await unavatar(e.handles.instagram, 'instagram')
      source = 'instagram'
      await sleep(300)
    }

    // 4. Twitter via unavatar
    if (!url && e.handles?.twitter) {
      url = await unavatar(e.handles.twitter, 'twitter')
      source = 'twitter'
      await sleep(300)
    }

    if (url) {
      console.log(`  ✅ [${source.padEnd(10)}] ${e.name.padEnd(36)} → ${url.substring(0,70)}`)
      if (APPLY) {
        const { error: err } = await sb.from('ranking_entries').update({ image_url: url }).eq('id', e.id)
        if (err) { console.error(`    ❌ SAVE FAIL: ${err.message}`); fail++; continue }
      }
      ok++
    } else {
      console.log(`  ❌ [sin fuente  ] ${e.name}`)
      fail++
    }
  }

  console.log(`\nEncontradas: ${ok} | Sin resultado: ${fail}`)
  if (!APPLY) console.log('\nDRY RUN — pasa --apply para guardar en DB.')
}

main().catch(err => { console.error(err); process.exit(1) })
