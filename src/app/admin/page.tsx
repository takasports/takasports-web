// Puerta de entrada a /admin — el «panel de paneles».
//
// ── POR QUÉ EXISTE ───────────────────────────────────────────────
// Había cinco paneles y ninguna página en /admin: escribir la ruta a pelo daba
// 404, y para saltar de rankings a tráfico había que conocer la URL de memoria.
//
// Pero no es solo un menú. La razón de fondo la dio el pipeline: el paso que
// calcula el factor mediático llevaba DOS pasadas seguidas fallando, y su
// propio registro lo decía —status "error"— desde el 2 de agosto. Nadie lo
// miraba porque no había ningún sitio donde mirarlo. Consecuencia: 158 de 214
// clubes con el factor en el suelo durante semanas.
//
// Por eso lo primero que se ve aquí es la salud del pipeline y la cola de
// encargos pendientes. Un hub que solo enlaza no habría evitado nada.

import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/admin-auth'
import { adminSupabase } from '@/lib/supabase-admin'

export const metadata: Metadata = {
  title: 'Panel de administración — TakaSports',
  robots: { index: false, follow: false },
}

const PANELES = [
  {
    href: '/admin/rankings',
    titulo: 'Rankings',
    desc: 'Editar fichas del Índice Taka, retirar a alguien y dar de alta creadores por investigación automática.',
    emoji: '🏆',
    color: '#7C3AED',
  },
  {
    href: '/admin/rankings-audit',
    titulo: 'Auditoría de rankings',
    desc: 'Qué cambió y por qué: overrides editoriales y trazas de cada recálculo.',
    emoji: '🔍',
    color: '#8B5CF6',
  },
  {
    href: '/admin/trafico',
    titulo: 'Tráfico',
    desc: 'Visitas web y de la app, Google Search Console y salud del sitio. En vivo.',
    emoji: '📈',
    color: '#22c55e',
  },
  {
    href: '/admin/dashboard',
    titulo: 'Dashboard editorial',
    desc: 'Artículos publicados, reels indexados, suscriptores de push y newsletter, partidas por juego.',
    emoji: '📰',
    color: '#F472B6',
  },
  {
    href: '/admin/games',
    titulo: 'Juegos',
    desc: 'Publicar el contenido de cada mini-juego por periodo.',
    emoji: '🎮',
    color: '#FCD34D',
  },
]

interface Salud {
  ultimaPasada: { finished_at: string | null; status: string | null; errors: string[] | null; notes: string | null } | null
  encargosPendientes: number
}

async function cargarSalud(): Promise<Salud> {
  const sb = adminSupabase()
  if (!sb) return { ultimaPasada: null, encargosPendientes: 0 }
  const [{ data: run }, { count }] = await Promise.all([
    sb.from('ranking_ingest_runs')
      .select('finished_at, status, errors, notes')
      .order('started_at', { ascending: false })
      .limit(1).maybeSingle(),
    sb.from('ranking_research_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'pendiente'),
  ])
  return { ultimaPasada: run ?? null, encargosPendientes: count ?? 0 }
}

function cuandoFue(iso: string | null): string {
  if (!iso) return 'sin registro'
  const d = new Date(iso)
  const soloFecha = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const dias = Math.round((soloFecha(new Date()) - soloFecha(d)) / 86400000)
  const hora = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  if (dias <= 0) return `hoy a las ${hora}`
  if (dias === 1) return `ayer a las ${hora}`
  return `hace ${dias} días`
}

export default async function AdminHubPage() {
  await requireAdmin('/admin')
  const { ultimaPasada, encargosPendientes } = await cargarSalud()

  const fallo = ultimaPasada?.status === 'error'
  const errores = ultimaPasada?.errors ?? []

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <main className="max-w-[1100px] mx-auto px-4 sm:px-6 pt-10 pb-24">
        <p className="text-[9px] font-black uppercase tracking-[0.2em] mb-1"
          style={{ color: '#7C3AED', fontFamily: 'var(--font-sport)' }}>
          TakaSports
        </p>
        <h1 className="text-3xl font-black mb-2"
          style={{ color: '#F8F8FF', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
          Panel de administración
        </h1>
        <p className="text-sm mb-8" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
          Todo lo que se puede tocar desde dentro, en un sitio.
        </p>

        {/* ── Salud del pipeline ──────────────────────────────────
            Va ARRIBA del todo a propósito: un paso del recálculo semanal estuvo
            fallando dos pasadas seguidas y su propio registro lo decía, pero no
            había ninguna pantalla donde se viera. */}
        <div className="rounded-2xl p-5 mb-6"
          style={{
            background: fallo ? 'rgba(239,68,68,0.07)' : 'rgba(34,197,94,0.06)',
            border: `1px solid ${fallo ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.25)'}`,
          }}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.18em] mb-1.5"
                style={{ color: fallo ? '#f87171' : '#22c55e', fontFamily: 'var(--font-sport)' }}>
                {fallo ? '⚠ Última pasada del ranking con incidencias' : '✓ Última pasada del ranking'}
              </p>
              <p className="text-sm font-bold" style={{ color: '#E8E8F0', fontFamily: 'var(--font-sport)' }}>
                {cuandoFue(ultimaPasada?.finished_at ?? null)}
                {ultimaPasada?.notes ? <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · {ultimaPasada.notes}</span> : null}
              </p>
              {errores.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1">
                  {errores.map((e, i) => (
                    <li key={i} className="text-xs" style={{ color: '#fca5a5', fontFamily: 'var(--font-sport)' }}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
            {encargosPendientes > 0 && (
              <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <p className="text-[9px] font-black uppercase tracking-[0.18em] mb-1"
                  style={{ color: '#8A8AA0', fontFamily: 'var(--font-sport)' }}>
                  Encargos sin resolver
                </p>
                <p className="text-2xl font-black tabular-nums" style={{ color: '#FCD34D', fontFamily: 'var(--font-display)' }}>
                  {encargosPendientes}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: '#6A6A82', fontFamily: 'var(--font-sport)' }}>
                  esperando al worker del Mac
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PANELES.map(p => (
            <Link key={p.href} href={p.href}
              className="rounded-2xl p-5 transition-all hover:brightness-125"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', textDecoration: 'none', display: 'block' }}>
              <div className="flex items-center gap-2.5 mb-2">
                <span style={{ fontSize: 20 }}>{p.emoji}</span>
                <span className="text-base font-black" style={{ color: p.color, fontFamily: 'var(--font-display)' }}>
                  {p.titulo}
                </span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
                {p.desc}
              </p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
