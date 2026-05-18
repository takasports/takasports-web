#!/usr/bin/env node
// Propaga un INSTAGRAM_ACCESS_TOKEN nuevo a todos los sitios que lo
// necesitan, en un solo paso. Pensado para ejecutarse justo después
// de re-autenticar en /api/instagram/auth.
//
// Uso:
//   node scripts/apply-ig-token.mjs IGQ...elTokenNuevo...
//
// Hace, en orden:
//   1. Reescribe INSTAGRAM_ACCESS_TOKEN en .env.local
//   2. Lo sube a Vercel (Production) — reemplazando el anterior si existe
//   3. Ejecuta sync-reels-storage.mjs → refresca reels.json en Supabase
//   4. Verifica el endpoint de producción
//
// Requiere: vercel CLI logueado, y las demás env de .env.local.

import { readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const ENV  = join(ROOT, '.env.local')

const token = process.argv[2]
if (!token || token.length < 20) {
  console.error('❌ Uso: node scripts/apply-ig-token.mjs <TOKEN>')
  process.exit(1)
}

function step(n, msg) { console.log(`\n[${n}] ${msg}`) }

// 1. .env.local
step(1, 'Actualizando .env.local')
let env = readFileSync(ENV, 'utf8')
env = /^INSTAGRAM_ACCESS_TOKEN=.*$/m.test(env)
  ? env.replace(/^INSTAGRAM_ACCESS_TOKEN=.*$/m, `INSTAGRAM_ACCESS_TOKEN=${token}`)
  : env.trimEnd() + `\nINSTAGRAM_ACCESS_TOKEN=${token}\n`
writeFileSync(ENV, env)
console.log('   ✓ .env.local')

// 2. Vercel Production (rm si existe, luego add por stdin)
step(2, 'Subiendo a Vercel (Production)')
try {
  execSync('vercel env rm INSTAGRAM_ACCESS_TOKEN production --yes', {
    cwd: ROOT, stdio: 'ignore',
  })
} catch { /* no existía: ok */ }
execSync('vercel env add INSTAGRAM_ACCESS_TOKEN production', {
  cwd: ROOT, input: token, stdio: ['pipe', 'inherit', 'inherit'],
})
console.log('   ✓ Vercel Production')

// 3. Refrescar Storage ya mismo (no esperar 6h al WF-10)
step(3, 'Refrescando reels.json en Supabase Storage')
execSync(`node ${join(__dirname, 'sync-reels-storage.mjs')}`, {
  cwd: ROOT, stdio: 'inherit',
  env: { ...process.env, INSTAGRAM_ACCESS_TOKEN: token },
})

// 4. Verificar producción (el route lee Storage + Graph; puede tardar
//    hasta el próximo redeploy en tomar el token nuevo de Vercel)
step(4, 'Verificando endpoint de producción')
try {
  const res = await fetch('https://www.takasportsmedia.com/api/instagram/reels')
  const data = await res.json()
  const newest = data
    .map(r => new Date(Number(r.timestamp) > 0 ? Number(r.timestamp) * 1000 : r.timestamp).getTime())
    .sort((a, b) => b - a)[0]
  console.log(`   ✓ ${data.length} reels — más reciente ${new Date(newest).toISOString()}`)
} catch (e) {
  console.log('   (no se pudo verificar:', e.message + ')')
}

console.log(`
✅ Token propagado.

Pendiente manual (1 vez):
  • Vercel: si quieres que el route use el token nuevo YA, haz un redeploy
    (Deployments → … → Redeploy) o espera al próximo push.
  • n8n WF-10: añade INSTAGRAM_ACCESS_TOKEN a las env de n8n y cambia el
    nodo de fetch anónimo por:  node scripts/sync-reels-storage.mjs
`)
