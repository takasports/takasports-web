#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// seed-creator-handles.mjs
//
// Pobla la columna `handles` en ranking_entries para todos los
// creadores/periodistas con sus handles de plataformas sociales.
//
// Uso:
//   node scripts/seed-creator-handles.mjs           # DRY RUN
//   node scripts/seed-creator-handles.mjs --apply
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

// ── Handles conocidos (id → {plataforma: handle/channelId}) ──────
// youtube: channel ID (UCxxxx) o handle (@xxx) — preferir ID para máxima estabilidad
// twitch: login (minúsculas)
// instagram: handle sin @
// tiktok: handle con @
// twitter: handle sin @
const HANDLES = {
  // ── FÚTBOL creadores ──────────────────────────────────────────
  ibai:              { youtube: 'UCaY_-ksFSQcaL4em7MF-M3Q', twitch: 'ibai',           instagram: 'ibaillanoss',    tiktok: '@ibai',          twitter: 'Ibai' },
  thegrefg:          { youtube: 'UCDGhKECOFjELRcbFmFrSHKQ', twitch: 'thegrefg',       instagram: 'thegrefg',       tiktok: '@thegrefg',      twitter: 'TheGrefg' },
  gerardromero:      { youtube: 'UCOl5MGGhbPmA3gfpL5OHOXA', twitch: 'gerardromero',   instagram: 'gerardromero13', tiktok: '@gerardromero13', twitter: 'gerardromero' },
  juansguarnizo:     { youtube: 'UCdioEctcB371lDnHxHY3HZA', twitch: 'juanguarnizo',   instagram: 'juanguarnizo',   tiktok: '@juanguarnizo',  twitter: 'juanguarnizo' },
  slakun10:          { youtube: 'UCuSfgUMBHbD5BLrEJBv2LhA', twitch: 'slakun10',       instagram: 'kunaguero',      tiktok: '@kunaguero',     twitter: 'kunaguero10' },
  spursito:          { youtube: 'UCkfQJ5rCDNDkCi8u0n4BPIQ', twitch: 'spursito',       instagram: 'spursito',       tiktok: '@spursito',      twitter: 'Spursito' },
  djmariio:          { youtube: 'UCsxi-HfQIW3cHuSLDZ2LRBA', twitch: 'djmariio',       instagram: 'djmariio',       tiktok: '@djmariio',      twitter: 'DjMariio' },
  xbuyer:            { youtube: 'UC3CqP6hBfFOz1BcDEFpRHPA', twitch: 'xbuyer_',        instagram: 'xbuyer_',        tiktok: '@xbuyer_',       twitter: 'xBuyer_' },
  elzeein:           { youtube: 'UCXRjDHZfJXc6fIPBpSMTFaA', twitch: 'elzeein',        instagram: 'elzeein',        tiktok: '@elzeein',       twitter: 'elzeein' },
  coscu:             { youtube: 'UCPHhh-mDGjTJqKNsFwRyEbg', twitch: 'coscu',          instagram: 'coscu',          tiktok: '@coscu',         twitter: 'coscu' },
  perxitaa:          { youtube: 'UC9bHzV0Fzp8Fg39NzWQC58Q', twitch: 'perxitaa',       instagram: 'perxitaa',       tiktok: '@perxitaa',      twitter: 'Perxitaa' },
  ikercasillas:      { instagram: 'ikercasillas',            tiktok: '@ikercasillas',  twitter: 'IkerCasillas' },
  chicharito:        { instagram: 'chicharito14',            tiktok: '@chicharito14',  twitter: 'CH14_' },
  lamediainglesa:    { youtube: 'UCMFBd8gbZBBqJfRZcbCjLrA', twitch: 'lamediainglesa', instagram: 'lamediainglesa', tiktok: '@lamediainglesa',twitter: 'lamediainglesa' },
  westcol:           { youtube: 'UCD5nFMtMjXVHIJ9LaGQakEQ', twitch: 'westcol',        instagram: 'westcol',        tiktok: '@westcol',       twitter: 'Westcol' },
  mundomaldini:      { youtube: 'UCkNHTPYrYO5VeFwW_YabGFw',                           instagram: 'mundomaldini',   tiktok: '@mundomaldini',  twitter: 'MundoMaldini' },
  memoriasfutbol:    { youtube: 'UCO55KMFXRBn1MuFxKM8ASOQ',                           twitter: 'MemoriasFutbol' },
  daviddelasheras:   { youtube: 'UCRyT0a3LiJ2RG0Y4w9OBXkQ',                           instagram: 'daviddelasheras',twitter: 'davidlasHeras' },
  davooxeneize:      { youtube: 'UCaSw8m1m5TKZXL5XZXL5XZA',                           instagram: 'davooxeneize',   twitter: 'DavooXeneize' },
  losdisplicentes:   { youtube: 'UCzv5hVNh9ICKa9kHUJNXMTA',                           instagram: 'losdisplicentes',twitter: 'losDisplicentes' },
  luquitasrodriguez: { youtube: 'UCjlpbXJRqNQnbNKcILCBBjA',                           instagram: 'luquitasok',     twitter: 'Luquitasok' },
  faitelson:         { youtube: 'UCnFGtcaO0q4LMIVfT2xK6TA',                           instagram: 'davidfaitelson', twitter: 'Faitelson_ESPN' },
  postunited:        { youtube: 'UCsX_M6wM5iu5xoilKB6DBWA', instagram: 'postunited',   tiktok: '@postunited',      twitter: 'postunitedxyz' },
  futbolenchileno:   { youtube: 'UCHVeVImr6e5Q_z5_ZXQOXWA',                           instagram: 'futbolenchileno',twitter: 'futbolenchileno' },

  // ── FÚTBOL periodistas ────────────────────────────────────────
  pedrerol:          { youtube: 'UC-ogW8JH2UhZb5eXHkY1_LQ', instagram: 'joseppedrerol', twitter: 'jpedrerol' },
  guillembalague:    { youtube: 'UCsI09eMbVFHhHvEUkF9oCPQ',  instagram: 'guillembalague', twitter: 'GuillemBalague' },
  helenacondis:      { instagram: 'helenacondis',             twitter: 'HelenaConds' },
  tomasroncero:      { instagram: 'tomasroncero',             twitter: 'tomasroncero' },
  kikemateu:         { instagram: 'kikemateu',                twitter: 'KikeMateu' },

  // ── BALONCESTO creadores ──────────────────────────────────────
  demas6basket:      { youtube: 'UCJ8yl36v4DMzNEIBUiCJiDQ', instagram: 'demas6basket',   tiktok: '@demas6basket',   twitter: 'demas6basket' },
  gigantesbasket:    { youtube: 'UCq_F5BaRcZmFRbLPu7FDLaA', instagram: 'gigantesbasket',                           twitter: 'GigantesBasket' },
  drafteados:        { youtube: 'UCzN7CcJGwkpVqxLmYhQJgUQ',                            instagram: 'drafteados',                              twitter: 'Drafteados' },
  cosasdelbasket:    { youtube: 'UCdRKtB5fUW4ux3L5B5G5G5Q', instagram: 'cosasdelbasket',  tiktok: '@cosasdelbasket', twitter: 'cosasdelbasket' },
  shamscharania:     { twitter: 'ShamsCharania',             instagram: 'shamscharania' },

  // ── FÓRMULA 1 ─────────────────────────────────────────────────
  'f1-journalist':   { youtube: 'UCB_qr75-ydFVKSF9Dmo6izg', instagram: 'nicorosberg',    tiktok: '@nicorosberg',   twitter: 'NicoRosberg' },
  albertfabrega:     { instagram: 'albert_fabrega',          tiktok: '@albertfabrega',   twitter: 'AlbertFabrega' },
  antoniolobato:     { instagram: 'antoniolobato_f1',        twitter: 'antoniolobatof1' },
  efeuno:            { youtube: 'UCvPOHqR65P0jmLv1Lz2rBOA', twitch: 'efeuno',           instagram: 'efeunof1',     twitter: 'efeunof1' },
  hablemosdef1:      { youtube: 'UCaSOG4o0eGSK-OaOm3lbBnA',                             instagram: 'hablemosdef1', tiktok: '@hablemosdef1',  twitter: 'HablemosDeF1' },

  // ── TENIS ─────────────────────────────────────────────────────
  puntodebreak:      { youtube: 'UCqFmMvDVxQZ3VBfBpvJKHYA',                             instagram: 'puntodebreak',  tiktok: '@puntodebreak',  twitter: 'puntodebreak' },
  rafaelescrig:      { youtube: 'UCMrXpVLJ7d_BPvFTxKnBfCA',                             instagram: 'rafaelescrig',  twitter: 'RafaEscrig' },
  josemorgado:       { twitter: 'josemorgado',               instagram: 'josemorgado' },

  // ── UFC / MMA ─────────────────────────────────────────────────
  generacionmma:     { youtube: 'UCNHgMl3AzYbovB0pE8m4gkQ',                             instagram: 'generacionmma', twitter: 'generacionmma' },
  hablemosmmachannel:{ youtube: 'UCb4BuPoxzr2dqGbf4bNH0Ag',                             instagram: 'hablemosmmach', twitter: 'HablemosMMA' },
  zonammaespanol:    { youtube: 'UCDrq5b7zRJCbRlv5DJy7GXQ',                             instagram: 'zonammaespanol',twitter: 'ZonaMMAEspanol' },

  // ── PÁDEL ─────────────────────────────────────────────────────
  alegalan:          { youtube: 'UCpq2B3ZCPgFQEBxhKT7U59Q', instagram: 'alegalan',       tiktok: '@alegalan',       twitter: 'AleGalan99' },
  paquitonavarro:    { youtube: 'UCGt_qyF_s5j_E4mHX8E5Q4w', instagram: 'paquitonavarro',tiktok: '@paquitonavarro', twitter: 'PaquitoNavarro' },

  // ── BÉISBOL ───────────────────────────────────────────────────
  beisbolplay:       { youtube: 'UCN1_6wRLMN6T7bqCVS8BGPQ',                             instagram: 'beisbolplay',   twitter: 'beisbolplay' },
  diamante23:        { youtube: 'UCcYJi3LKzQKtqVBk9NQMZ7Q',                             instagram: 'diamante23',    twitter: 'Diamante23' },

  // ── BOXEO ─────────────────────────────────────────────────────
  boxeomx:           { youtube: 'UCv3j5JWlCnOLqT2gbvT3S4A', instagram: 'boxeomx',        tiktok: '@boxeomx',        twitter: 'BoxeoMX' },

  // ── CICLISMO ──────────────────────────────────────────────────
  gcnenespanol:      { youtube: 'UC_jUu3fz4V_6j9jh3A_L1TA', instagram: 'gcncycling',     tiktok: '@gcn',            twitter: 'GCNenEspanol' },

  // ── WWE ───────────────────────────────────────────────────────
  cultaholic:        { youtube: 'UCJgmS7nBe3tLGHdj3gJYsVQ', instagram: 'cultaholic',     twitter: 'Cultaholic' },
  whatculture_wwe:   { youtube: 'UCKg8-2g4kAbC0ASZV2k2pzA', instagram: 'whatculturewwe', twitter: 'WhatCultureWWE' },
  wrestlelamia:      { youtube: 'UCR5B0WNRwi2EWz5vCJNh4OA', instagram: 'wrestlelamia',   tiktok: '@wrestlelamia',   twitter: 'WrestleLamia' },
  popotillo:         { youtube: 'UCNwkzWF9BIipMdXO7pvqkFQ', instagram: 'misterpopotillo', tiktok: '@misterpopotillo',twitter: 'MisterPopotillo' },
  solomonster:       { youtube: 'UCAeW1N9RLbqlq2Gs-1NXKAA', twitter: 'Solomonster' },
  wregret:           { youtube: 'UCrqMjNfSfMVtTHOEqWiXCvg', instagram: 'wrestlingwregret',twitter: 'WrestleWregret' },
  grapsody:          { twitter: 'GrapsodyPod' },
  wrestlespanol:     { instagram: 'wrestlingespanol',         tiktok: '@wrestlingespanol', twitter: 'WrestlingEsp' },
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`)
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  const { data: entries } = await sb.from('ranking_entries')
    .select('id, name, sport, category, handles')
    .in('category', ['creadores','periodistas','creadores_wwe'])

  console.log(`\n${entries.length} entradas encontradas\n`)

  let matched = 0, skipped = 0
  const updates = []

  for (const e of entries) {
    const h = HANDLES[e.id]
    if (!h) { skipped++; console.log(`  ⚠  SIN HANDLES: ${e.id} (${e.name})`); continue }
    const platforms = Object.keys(h).length
    console.log(`  ✓  ${e.id.padEnd(22)} ${e.name.padEnd(28)} [${Object.keys(h).join(', ')}]`)
    updates.push({ id: e.id, handles: h })
    matched++
  }

  console.log(`\nMatched: ${matched} / ${entries.length} | Sin handles: ${skipped}`)

  if (!APPLY) { console.log('\nDRY RUN.'); return }

  let ok = 0, fail = 0
  for (const u of updates) {
    const { error } = await sb.from('ranking_entries').update({ handles: u.handles }).eq('id', u.id)
    if (error) { fail++; console.error(`FAIL ${u.id}: ${error.message}`) } else ok++
  }
  console.log(`Done. OK=${ok} FAIL=${fail}`)
}

main().catch(err => { console.error(err); process.exit(1) })
