'use client'

// Zona de peligro del perfil: borrado de cuenta con doble confirmación.
// Solo se monta cuando hay sesión. Llama a POST /api/account/delete (que usa
// service_role + auth.admin.deleteUser); al terminar, cierra la sesión local y
// lleva a la portada.

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase'

const CONFIRM_WORD = 'ELIMINAR'

export default function DeleteAccountSection() {
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => { setMounted(true) }, [])

  // Al abrir: bloquear scroll, enfocar el input, Escape para cerrar.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = setTimeout(() => inputRef.current?.focus(), 50)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !deleting) closeModal() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      clearTimeout(t)
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, deleting])

  function closeModal() {
    setOpen(false)
    setConfirmText('')
    setError(null)
    triggerRef.current?.focus()
  }

  const canDelete = confirmText.trim().toUpperCase() === CONFIRM_WORD

  async function handleDelete() {
    if (!canDelete || deleting) return
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch('/api/account/delete', { method: 'POST' })
      if (!res.ok) {
        const d = await res.json().catch(() => null)
        setError(
          d?.error === 'rate_limited'
            ? 'Demasiados intentos. Espera un momento y vuelve a intentarlo.'
            : 'No se pudo eliminar la cuenta. Inténtalo de nuevo en unos minutos.',
        )
        setDeleting(false)
        return
      }
      // Cierra la sesión local y muestra confirmación antes de redirigir.
      try { await createClient()?.auth.signOut() } catch { /* sesión ya inválida */ }
      setDone(true)
      setTimeout(() => { window.location.href = '/' }, 2200)
    } catch {
      setError('No se pudo eliminar la cuenta. Inténtalo de nuevo en unos minutos.')
      setDeleting(false)
    }
  }

  return (
    <section className="mt-2 mb-4">
      <div
        className="rounded-2xl p-4 sm:p-5"
        style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.22)' }}
      >
        <p
          className="text-[10px] font-black uppercase tracking-widest mb-1.5"
          style={{ color: '#f87171', fontFamily: 'var(--font-sport)', letterSpacing: '0.08em' }}
        >
          Zona de peligro
        </p>
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Elimina tu cuenta y todos tus datos (picks, predicciones, puntos, favoritos,
          recordatorios e historial). Es <strong style={{ color: '#fca5a5' }}>irreversible</strong>.
        </p>
        <button
          ref={triggerRef}
          onClick={() => setOpen(true)}
          className="text-[12px] font-bold transition-all hover:brightness-110 active:scale-[0.98]"
          style={{
            color: '#f87171',
            fontFamily: 'var(--font-sport)',
            background: 'rgba(239,68,68,0.10)',
            border: '1px solid rgba(239,68,68,0.32)',
            cursor: 'pointer',
            padding: '9px 16px',
            borderRadius: 12,
          }}
        >
          Eliminar mi cuenta
        </button>
      </div>

      {mounted && open && createPortal(
        <div
          className="fixed inset-0 z-[200] overflow-y-auto"
          style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)' }}
          onClick={() => { if (!deleting) closeModal() }}
        >
          <div className="min-h-full flex items-center justify-center p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="del-acc-title"
              aria-describedby="del-acc-desc"
              className="relative w-full"
              style={{
                maxWidth: 400,
                borderRadius: 24,
                background: 'linear-gradient(160deg,#2A0010 0%,#1A0008 50%,#0A0004 100%)',
                border: '1px solid rgba(239,68,68,0.32)',
                padding: 24,
              }}
              onClick={e => e.stopPropagation()}
            >
              {done ? (
                <div className="flex flex-col items-center gap-3 text-center py-4">
                  <span style={{ color: '#4ade80' }}>
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" />
                      <path d="M8 12.5l2.5 2.5L16 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <p className="text-sm font-black" style={{ color: '#F0F0F8', fontFamily: 'var(--font-display)' }}>
                    Tu cuenta se ha eliminado
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Gracias por haber pasado por TakaSports. Te llevamos a la portada…
                  </p>
                </div>
              ) : (
                <>
                  <h2
                    id="del-acc-title"
                    className="text-lg font-black mb-1.5"
                    style={{ fontFamily: 'var(--font-display)', color: '#F8F0F0', letterSpacing: '-0.02em' }}
                  >
                    ¿Eliminar tu cuenta?
                  </h2>
                  <p id="del-acc-desc" className="text-xs mb-2" style={{ color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                    Esta acción es <strong style={{ color: '#fca5a5' }}>permanente</strong>. Se borrarán
                    tu perfil, picks, predicciones, puntos, badges, favoritos, recordatorios e historial.
                    Las ligas que hayas creado seguirán existiendo para sus miembros, pero sin tu nombre.
                  </p>
                  <label htmlFor="del-acc-input" className="block text-[11px] mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Escribe <strong style={{ color: '#fca5a5' }}>{CONFIRM_WORD}</strong> para confirmar:
                  </label>
                  <input
                    id="del-acc-input"
                    ref={inputRef}
                    type="text"
                    value={confirmText}
                    onChange={e => setConfirmText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && canDelete) handleDelete() }}
                    autoComplete="off"
                    disabled={deleting}
                    aria-label={`Escribe ${CONFIRM_WORD} para confirmar el borrado`}
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none mb-3 focus-visible:ring-2 focus-visible:ring-[#ef4444]"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(239,68,68,0.3)',
                      color: '#F0E0E0',
                      fontFamily: 'var(--font-sport)',
                      letterSpacing: '0.08em',
                    }}
                  />
                  {error && (
                    <p
                      className="text-[11px] text-center px-3 py-2 rounded-xl mb-3"
                      style={{ background: 'rgba(239,68,68,0.12)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.25)' }}
                    >
                      {error}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={closeModal}
                      disabled={deleting}
                      className="flex-1 rounded-xl py-2.5 text-sm font-bold transition-all hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border)',
                        fontFamily: 'var(--font-sport)',
                        cursor: deleting ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={!canDelete || deleting}
                      className="flex-1 rounded-xl py-2.5 text-sm font-black transition-all hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ef4444]"
                      style={{
                        background: canDelete && !deleting ? '#dc2626' : 'rgba(239,68,68,0.3)',
                        color: '#fff',
                        border: '1px solid rgba(239,68,68,0.5)',
                        fontFamily: 'var(--font-sport)',
                        cursor: canDelete && !deleting ? 'pointer' : 'not-allowed',
                        opacity: canDelete || deleting ? 1 : 0.7,
                      }}
                    >
                      {deleting
                        ? <span className="inline-block w-4 h-4 rounded-full border-2 border-red-200 border-t-white animate-spin align-middle" />
                        : 'Eliminar definitivamente'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </section>
  )
}
