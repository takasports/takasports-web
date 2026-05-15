#!/usr/bin/env node
// Llama public.f_capture_score_history() y reporta el número de filas
// guardadas. Usado como último paso del cron semanal.
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env.local') })

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)
const { data, error } = await sb.rpc('f_capture_score_history')
if (error) { console.error('snapshot error:', error.message); process.exit(1) }
console.log(`snapshot ok · ${data} filas`)
