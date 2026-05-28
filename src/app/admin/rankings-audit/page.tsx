import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { adminSupabase } from '@/lib/supabase-admin'
import { requireAdmin } from '@/lib/admin-auth'

export const metadata: Metadata = {
  title: 'Audit · Rankings — TakaSports',
  description: 'Histórico transparente de ediciones editoriales sobre el Índice Taka.',
  robots: { index: false, follow: false },
}

// Página dinámica: requireAdmin lee la cookie de sesión, no puede ser
// estática/cacheada. (Antes era `revalidate = 60`; dropped a favor de auth.)
export const dynamic = 'force-dynamic'

type Edit = {
  id: number
  entry_id: string
  category: string
  field: string
  old_value: unknown
  new_value: unknown
  reason: string | null
  edited_by: string | null
  edited_at: string
}

async function loadEdits(): Promise<{ edits: Edit[]; warning?: string }> {
  const sb = adminSupabase()
  if (!sb) return { edits: [], warning: 'supabase not configured' }
  const { data, error } = await sb
    .from('ranking_edits')
    .select('id, entry_id, category, field, old_value, new_value, reason, edited_by, edited_at')
    .order('edited_at', { ascending: false })
    .limit(200)
  if (error) return { edits: [], warning: error.message }
  return { edits: (data ?? []) as Edit[] }
}

const FIELD_LABEL: Record<string, string> = {
  rank_manual:           'Rank',
  score_manual:          'Score',
  insight_manual:        'Insight',
  trend_reason_manual:   'Trend reason',
  rendimiento_manual:    'Rendimiento',
  contexto_manual:       'Contexto',
  mediatico_manual:      'Mediático',
  narrativa_manual:      'Narrativa',
  badge_manual:          'Badge',
  trend_manual:          'Trend',
  editorial_boost:       'Ajuste editorial',
  editorial_note:        'Nota editorial',
  editorial_locked:      'Locked',
}
const SUBJECTIVE = new Set(['narrativa_manual', 'editorial_boost', 'score_manual', 'rank_manual'])

function fmtValue(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}
function fmtDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

export default async function RankingsAuditPage() {
  await requireAdmin('/admin/rankings-audit')
  const { edits, warning } = await loadEdits()

  const stats = {
    total: edits.length,
    subjective: edits.filter(e => SUBJECTIVE.has(e.field)).length,
    withReason: edits.filter(e => e.reason && e.reason.trim()).length,
    lastWeek: edits.filter(e => {
      const t = new Date(e.edited_at).getTime()
      return Date.now() - t < 7 * 86400000
    }).length,
  }

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <Header />

      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-2 mb-4 text-[11px]"
          style={{ color: '#5A5A72', fontFamily: 'var(--font-sport)' }}>
          <Link href="/rankings" className="hover:brightness-150 transition-all" style={{ color: '#7C3AED' }}>
            ← Rankings
          </Link>
          <span style={{ color: '#3A3A52' }}>/</span>
          <span>Audit editorial</span>
        </div>

        <h1 className="font-black mb-2"
          style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: '#F8F8FF', letterSpacing: '-0.02em' }}>
          Audit · Índice <span style={{ color: '#9B7CF6' }}>Taka</span>
        </h1>
        <p className="text-sm max-w-2xl mb-6"
          style={{ color: '#7A7A92', fontFamily: 'var(--font-sport)' }}>
          Cada ajuste editorial sobre un ranking queda registrado aquí con su valor anterior, valor nuevo y motivo.
          Los campos subjetivos (narrativa, ajuste editorial, score y rank manuales) exigen motivo obligatorio.
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
          {([
            { label: 'Total ediciones', value: stats.total, color: '#9B7CF6' },
            { label: 'Cambios subjetivos', value: stats.subjective, color: '#c084fc' },
            { label: 'Con motivo escrito', value: stats.withReason, color: '#22c55e' },
            { label: 'Últimos 7 días', value: stats.lastWeek, color: '#f59e0b' },
          ]).map(s => (
            <div key={s.label} className="rounded-xl px-3 py-3"
              style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${s.color}22` }}>
              <p className="text-[9px] font-black uppercase tracking-widest mb-1"
                style={{ color: s.color, fontFamily: 'var(--font-sport)' }}>
                {s.label}
              </p>
              <p className="text-2xl font-black tabular-nums"
                style={{ color: '#F0F0F8', fontFamily: 'var(--font-display)' }}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {warning && (
          <div className="rounded-xl px-4 py-3 mb-4"
            style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.18)' }}>
            <p className="text-[11px]" style={{ color: '#fbbf24', fontFamily: 'var(--font-sport)' }}>
              ⚠️ {warning}. Si el mensaje es <code>relation &quot;ranking_edits&quot; does not exist</code> aplica la migración{' '}
              <code>017_ranking_edits.sql</code> en Supabase.
            </p>
          </div>
        )}

        {edits.length === 0 && !warning && (
          <div className="rounded-2xl py-16 text-center"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <p className="text-sm" style={{ color: '#5A5A72', fontFamily: 'var(--font-sport)' }}>
              Aún no hay ediciones registradas. Cualquier override hecho vía API quedará listado aquí.
            </p>
          </div>
        )}

        {/* Listado */}
        {edits.length > 0 && (
          <div className="flex flex-col gap-2">
            {edits.map(e => {
              const isSubjective = SUBJECTIVE.has(e.field)
              const missingReason = isSubjective && (!e.reason || !e.reason.trim())
              const pillColor = isSubjective ? '#c084fc' : '#7A7A92'
              return (
                <div key={e.id} className="rounded-xl px-4 py-3 transition-all hover:brightness-110"
                  style={{
                    background: 'var(--bg-card)',
                    border: `1px solid ${missingReason ? 'rgba(248,113,113,0.25)' : 'var(--border)'}`,
                    borderLeft: `3px solid ${missingReason ? '#f87171' : pillColor}`,
                  }}>
                  <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/rankings/${e.entry_id}`}
                        className="text-sm font-bold hover:brightness-150 transition-all"
                        style={{ color: '#D0D0E0', fontFamily: 'var(--font-sport)' }}>
                        {e.entry_id}
                      </Link>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                        style={{ background: 'rgba(255,255,255,0.05)', color: '#7A7A92', fontFamily: 'var(--font-sport)' }}>
                        {e.category}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                        style={{ background: `${pillColor}18`, color: pillColor, border: `1px solid ${pillColor}33`, fontFamily: 'var(--font-sport)' }}>
                        {FIELD_LABEL[e.field] ?? e.field}
                      </span>
                      {missingReason && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                          style={{ background: 'rgba(248,113,113,0.14)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)', fontFamily: 'var(--font-sport)' }}>
                          ⚠ sin motivo
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] tabular-nums"
                      style={{ color: '#5A5A72', fontFamily: 'var(--font-display)' }}>
                      {fmtDate(e.edited_at)}{e.edited_by ? ` · ${e.edited_by}` : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] flex-wrap"
                    style={{ color: '#9090AA', fontFamily: 'var(--font-display)' }}>
                    <span className="tabular-nums px-2 py-0.5 rounded"
                      style={{ background: 'rgba(255,255,255,0.03)' }}>
                      {fmtValue(e.old_value)}
                    </span>
                    <span style={{ color: '#5A5A72' }}>→</span>
                    <span className="tabular-nums px-2 py-0.5 rounded font-bold"
                      style={{ background: `${pillColor}14`, color: pillColor }}>
                      {fmtValue(e.new_value)}
                    </span>
                  </div>
                  {e.reason && (
                    <p className="text-[11px] italic mt-2 leading-relaxed"
                      style={{ color: '#7A7A92', fontFamily: 'var(--font-sport)' }}>
                      &ldquo;{e.reason}&rdquo;
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
