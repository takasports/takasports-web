import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env.local') })

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// Try to get view definition via pg_views system table (accessible via PostgREST)
const { data, error } = await sb
  .from('pg_views')  
  .select('viewname,definition')
  .eq('schemaname', 'public')
  .eq('viewname', 'ranking_view')

if (error) {
  console.log('pg_views error:', error.message)
} else {
  console.log('View definition:')
  console.log(data?.[0]?.definition ?? 'not found')
}

// Also check how many active=true jugadoras there are
const { count: jugActiveCount } = await sb.from('ranking_entries').select('*', { count: 'exact', head: true }).eq('category', 'jugadoras').eq('active', true)
const { count: subActiveCount } = await sb.from('ranking_entries').select('*', { count: 'exact', head: true }).eq('category', 'sub21').eq('active', true)
const { count: latamActiveCount } = await sb.from('ranking_entries').select('*', { count: 'exact', head: true }).eq('category', 'latam').eq('active', true)

console.log(`\nActive counts: jugadoras=${jugActiveCount}, sub21=${subActiveCount}, latam=${latamActiveCount}`)
