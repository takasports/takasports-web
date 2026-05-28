'use client'

// Comentarios en artículos — MVP seguro por defecto.
// - Solo logueados pueden comentar (banner CTA si no).
// - Texto plano renderizado con linkifyText (sin innerHTML).
// - Rate-limit servidor: 5 comentarios/hora por user.
// - Botón reportar — con unique constraint a nivel DB (un user, un report).
// - Auto-shadow de comentarios con flagged_count >= 5 (filtrado en GET).

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { timeAgo } from '@/lib/timeAgo'
import { linkifyText } from '@/lib/linkify'
import type { User } from '@supabase/supabase-js'

interface Comment {
  id: string
  user_name: string
  user_avatar: string | null
  body: string
  created_at: string
  flagged_count: number
}

const MAX_LEN = 1000

export default function ArticleComments({ slug }: { slug: string }) {
  const [user, setUser] = useState<User | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set())

  // Sesión + suscripción a cambios
  useEffect(() => {
    const sb = createClient()
    if (!sb) return
    sb.auth.getUser().then(({ data }) => setUser(data.user ?? null))
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Carga inicial
  useEffect(() => {
    let cancel = false
    setLoading(true)
    fetch(`/api/comments?slug=${encodeURIComponent(slug)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancel) return
        if (data?.ok) setComments(data.comments ?? [])
      })
      .catch(() => { /* ignore */ })
      .finally(() => { if (!cancel) setLoading(false) })
    return () => { cancel = true }
  }, [slug])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (sending) return
    const text = body.trim()
    if (text.length === 0 || text.length > MAX_LEN) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, body: text }),
      })
      const data = await res.json().catch(() => null)
      if (res.status === 429) {
        setError('Has comentado mucho en la última hora. Vuelve en un rato.')
      } else if (res.status === 401) {
        setError('Tienes que iniciar sesión para comentar.')
      } else if (!res.ok || !data?.ok) {
        setError('No se pudo publicar el comentario.')
      } else if (data.comment) {
        setComments(prev => [data.comment as Comment, ...prev])
        setBody('')
      }
    } catch {
      setError('Error de red. Inténtalo de nuevo.')
    } finally {
      setSending(false)
    }
  }

  const report = async (id: string) => {
    if (reportedIds.has(id)) return
    setReportedIds(prev => new Set(prev).add(id))
    try {
      await fetch(`/api/comments/${encodeURIComponent(id)}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
    } catch { /* silencioso, ya marcamos en UI */ }
  }

  const charsLeft = MAX_LEN - body.length

  return (
    <section
      aria-label="Comentarios"
      className="mt-12"
      style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-xl)' }}
    >
      <div className="flex items-center gap-2.5 mb-5">
        <span className="section-accent" />
        <h2 className="section-label">
          Comentarios {comments.length > 0 && <span style={{ color: 'var(--text-muted)' }}>· {comments.length}</span>}
        </h2>
      </div>

      {/* Form o banner CTA */}
      {user ? (
        <form
          onSubmit={submit}
          className="mb-6"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-md)' }}
        >
          <label htmlFor="ts-comment-body" className="sr-only">Tu comentario</label>
          <textarea
            id="ts-comment-body"
            value={body}
            onChange={e => setBody(e.target.value.slice(0, MAX_LEN))}
            placeholder="Comenta este artículo… (sin enlaces de spam, sin insultos)"
            rows={3}
            disabled={sending}
            className="w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--purple)]"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              color: 'var(--text-primary)',
              fontSize: 14,
              fontFamily: 'inherit',
              resize: 'vertical',
              minHeight: 70,
            }}
          />
          <div className="flex items-center justify-between mt-3 gap-3">
            <span
              style={{
                color: charsLeft < 80 ? '#FCA5A5' : 'var(--text-muted)',
                fontFamily: 'var(--font-sport)',
                fontSize: 11,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {charsLeft} caracteres
            </span>
            <button
              type="submit"
              disabled={sending || body.trim().length === 0}
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--purple)]"
              style={{
                padding: '8px 16px',
                background: sending || !body.trim() ? 'rgba(124,58,237,0.4)' : 'var(--purple)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-sport)',
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                cursor: sending || !body.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {sending ? 'Publicando…' : 'Publicar'}
            </button>
          </div>
          {error && (
            <p role="status" aria-live="polite" style={{ color: '#FCA5A5', fontSize: 13, marginTop: 8 }}>
              {error}
            </p>
          )}
        </form>
      ) : (
        <div
          className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-md) var(--space-lg)' }}
        >
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            <strong style={{ color: 'var(--text-primary)' }}>Inicia sesión</strong> y deja tu opinión.
          </p>
          <a
            href="/perfil"
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--purple)]"
            style={{
              padding: '8px 16px',
              background: 'var(--purple)',
              color: '#fff',
              borderRadius: 'var(--radius-md)',
              fontFamily: 'var(--font-sport)',
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            Iniciar sesión
          </a>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Cargando comentarios…</p>
      ) : comments.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          Sé el primero en comentar.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comments.map(c => {
            const reported = reportedIds.has(c.id)
            return (
              <li
                key={c.id}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--space-md)',
                }}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div
                    aria-hidden="true"
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 'var(--radius-full)',
                      background: 'rgba(124,58,237,0.18)',
                      color: 'var(--purple-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'var(--font-display)',
                      fontWeight: 900,
                      fontSize: 14,
                      flexShrink: 0,
                      overflow: 'hidden',
                    }}
                  >
                    {c.user_avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.user_avatar} alt="" width={36} height={36} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      c.user_name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-sport)', fontWeight: 700, fontSize: 13 }}>
                        {c.user_name}
                      </span>
                      <time
                        dateTime={c.created_at}
                        style={{ color: 'var(--text-faint)', fontSize: 11, fontFamily: 'var(--font-sport)' }}
                      >
                        {timeAgo(c.created_at)}
                      </time>
                    </div>
                    <p
                      style={{
                        color: 'var(--text-secondary)',
                        fontSize: 14,
                        lineHeight: 1.55,
                        marginTop: 6,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {linkifyText(c.body)}
                    </p>
                    {/* Botón reportar (solo logueados) */}
                    {user && (
                      <button
                        type="button"
                        onClick={() => report(c.id)}
                        disabled={reported}
                        className="mt-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--purple)]"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: reported ? 'var(--text-faint)' : 'var(--text-muted)',
                          fontFamily: 'var(--font-sport)',
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          cursor: reported ? 'default' : 'pointer',
                          padding: '4px 0',
                        }}
                      >
                        {reported ? '✓ Reportado' : 'Reportar'}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
