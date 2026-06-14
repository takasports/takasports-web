'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase'
import { LogoMark } from './Logo'

interface AuthModalProps {
  onClose: () => void
}

type AuthMode = 'social' | 'password' | 'register'

export default function AuthModal({ onClose }: AuthModalProps) {
  const [loading, setLoading] = useState<'google' | 'email' | 'password' | 'reset' | null>(null)
  const [error,   setError]   = useState<string | null>(null)
  const [email,   setEmail]   = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [mode,    setMode]    = useState<AuthMode>('social')
  const [password,    setPassword]    = useState('')
  const [confirmPwd,  setConfirmPwd]  = useState('')
  const [resetSent,   setResetSent]   = useState(false)
  const supabase = createClient()

  const touchStartY = useRef<number | null>(null)
  const modalRef    = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])
  function onTouchStart(e: React.TouchEvent) { touchStartY.current = e.touches[0].clientY }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartY.current === null) return
    const dy = e.changedTouches[0].clientY - touchStartY.current
    if (dy > 80) onClose()
    touchStartY.current = null
  }

  async function signInWith(provider: 'google') {
    if (!supabase) { setError('Auth no configurado'); return }
    setLoading(provider)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=/perfil`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
    if (error) {
      setError('No se pudo iniciar sesión. Inténtalo de nuevo.')
      setLoading(null)
    }
  }

  async function sendMagicLink() {
    if (!supabase) { setError('Auth no configurado'); return }
    if (!email.trim() || !email.includes('@')) { setError('Introduce un email válido'); return }
    setLoading('email')
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/api/auth/callback?next=/perfil` },
    })
    setLoading(null)
    if (error) {
      setError('No se pudo enviar el enlace. Inténtalo de nuevo.')
    } else {
      setEmailSent(true)
    }
  }

  async function signInWithPassword() {
    if (!supabase) { setError('Auth no configurado'); return }
    if (!email.trim() || !email.includes('@')) { setError('Introduce un email válido'); return }
    if (!password) { setError('Introduce tu contraseña'); return }
    setLoading('password')
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    setLoading(null)
    if (error) {
      setError(error.message.includes('Invalid') ? 'Email o contraseña incorrectos.' : 'No se pudo iniciar sesión.')
    } else {
      onClose()
    }
  }

  async function signUp() {
    if (!supabase) { setError('Auth no configurado'); return }
    if (!email.trim() || !email.includes('@')) { setError('Introduce un email válido'); return }
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }
    if (password !== confirmPwd) { setError('Las contraseñas no coinciden'); return }
    setLoading('password')
    setError(null)
    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/api/auth/callback?next=/perfil` },
    })
    setLoading(null)
    if (error) {
      setError(error.message.includes('already') ? 'Ya existe una cuenta con ese email.' : 'No se pudo crear la cuenta.')
    } else {
      setEmailSent(true)
    }
  }

  async function sendPasswordReset() {
    if (!supabase) { setError('Auth no configurado'); return }
    if (!email.trim() || !email.includes('@')) { setError('Escribe tu email para recuperar la contraseña'); return }
    setLoading('reset')
    setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/api/auth/callback?next=/auth/reset-password`,
    })
    setLoading(null)
    if (error) {
      setError('No se pudo enviar el correo. Inténtalo de nuevo.')
    } else {
      setResetSent(true)
    }
  }

  function resetMode(m: AuthMode) {
    setMode(m)
    setError(null)
    setPassword('')
    setConfirmPwd('')
    setResetSent(false)
  }

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[200] overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div className="min-h-full flex items-center justify-center p-4">
      <div
        ref={modalRef}
        className="relative w-full"
        style={{ maxWidth: 400, borderRadius: 24 }}
        onClick={e => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Glow */}
        <div
          className="absolute -top-12 -right-12 w-48 h-48 blur-3xl opacity-20 pointer-events-none"
          style={{ background: '#7C3AED' }}
        />

        <div
          style={{
            background: 'linear-gradient(160deg,#1A0030 0%,#110020 50%,#07000E 100%)',
            border: '1px solid rgba(124,58,237,0.32)',
            borderRadius: 24,
            maxHeight: 'calc(100dvh - 2rem)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-8 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
          </div>

          {/* Header */}
          <div className="px-6 pt-6 pb-5 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                {mode !== 'social' && (
                  <button
                    onClick={() => resetMode('social')}
                    className="mr-1 text-[11px] flex items-center gap-1 transition-opacity hover:opacity-70"
                    style={{ color: '#9B7CF6', fontFamily: 'var(--font-sport)' }}
                  >
                    ← Volver
                  </button>
                )}
                {mode === 'social' && <LogoMark size={22} />}
                {mode === 'social' && (
                  <span
                    className="text-[10px] font-black uppercase tracking-widest"
                    style={{ color: '#9B6DB5', fontFamily: 'var(--font-sport)' }}
                  >
                    TakaSports
                  </span>
                )}
              </div>
              <h2
                className="font-black text-xl leading-tight"
                style={{ fontFamily: 'var(--font-display)', color: '#F0F0F8', letterSpacing: '-0.02em' }}
              >
                {mode === 'social'   && 'Únete a TakaSports'}
                {mode === 'password' && 'Entra con contraseña'}
                {mode === 'register' && 'Crea tu cuenta'}
              </h2>
              <p className="text-xs mt-1" style={{ color: '#6060A0', fontFamily: 'var(--font-sport)' }}>
                {mode === 'social'   && 'Tus picks, tu palmarés y tus favoritos. Todo guardado, gratis.'}
                {mode === 'password' && 'Usa tu email y contraseña de TakaSports.'}
                {mode === 'register' && 'Crea tu cuenta en un momento.'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
              style={{ color: '#5A5A7A' }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="px-6 pb-6 flex flex-col gap-3" style={{ overflowY: 'auto', flex: '1 1 auto', minHeight: 0 }}>
            {error && (
              <p
                className="text-[11px] text-center px-3 py-2 rounded-xl"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                {error}
              </p>
            )}

            {/* ── MODO SOCIAL ─────────────────────────────── */}
            {mode === 'social' && (
              <>
                {/* Google */}
                <button
                  onClick={() => signInWith('google')}
                  disabled={loading !== null}
                  className="w-full flex items-center justify-center gap-3 rounded-2xl py-3.5 font-semibold text-sm transition-all hover:brightness-110 active:scale-[0.98]"
                  style={{
                    background: loading === 'google' ? 'rgba(255,255,255,0.08)' : '#fff',
                    color: '#1a1a1a',
                    border: '1px solid rgba(255,255,255,0.1)',
                    opacity: loading !== null && loading !== 'google' ? 0.4 : 1,
                    cursor: loading !== null ? 'wait' : 'pointer',
                  }}
                >
                  {loading === 'google' ? (
                    <span className="w-5 h-5 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin" />
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                  )}
                  {loading === 'google' ? 'Redirigiendo…' : 'Continuar con Google'}
                </button>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                  <span className="text-[10px] uppercase tracking-widest" style={{ color: '#3A3A5A', fontFamily: 'var(--font-sport)' }}>o con email</span>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                </div>

                {/* Magic link */}
                {emailSent ? (
                  <div className="rounded-2xl px-4 py-4 text-center flex flex-col gap-1.5" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                    <span style={{ display: 'inline-flex', justifyContent: 'center', color: '#4ade80' }}>
                      <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
                        <path d="M5 11l11 7 11-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        <rect x="4" y="8" width="24" height="17" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
                        <path d="M14 8V5h4v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </span>
                    <p className="text-xs font-black" style={{ color: '#4ade80', fontFamily: 'var(--font-display)' }}>Enlace enviado</p>
                    <p className="text-[10px]" style={{ color: '#2A5A3A', fontFamily: 'var(--font-sport)' }}>Revisa tu bandeja de entrada en {email}</p>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') sendMagicLink() }}
                      placeholder="tu@email.com"
                      disabled={loading !== null}
                      className="flex-1 rounded-2xl px-4 py-3 text-sm outline-none"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#E0E0F8',
                        fontFamily: 'var(--font-sport)',
                        fontSize: 13,
                      }}
                    />
                    <button
                      onClick={sendMagicLink}
                      disabled={loading !== null}
                      className="flex-shrink-0 rounded-2xl px-4 py-3 font-black text-xs transition-all hover:brightness-110 active:scale-[0.97]"
                      style={{
                        background: loading === 'email' ? 'rgba(124,58,237,0.3)' : 'rgba(124,58,237,0.18)',
                        color: '#C4B5FD',
                        border: '1px solid rgba(124,58,237,0.3)',
                        cursor: loading !== null ? 'wait' : 'pointer',
                        fontFamily: 'var(--font-sport)',
                      }}
                    >
                      {loading === 'email'
                        ? <span className="w-4 h-4 rounded-full border-2 border-purple-400 border-t-white animate-spin inline-block" />
                        : '→'
                      }
                    </button>
                  </div>
                )}

                {/* Contraseña toggle */}
                <button
                  onClick={() => resetMode('password')}
                  className="text-[10px] text-center transition-opacity hover:opacity-70"
                  style={{ color: '#5A5A7A', fontFamily: 'var(--font-sport)' }}
                >
                  Prefiero usar contraseña →
                </button>

                {/* Guest */}
                <button
                  onClick={onClose}
                  className="w-full py-2.5 rounded-2xl text-xs font-semibold transition-opacity hover:opacity-70"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    color: '#5A5A72',
                    border: '1px solid rgba(255,255,255,0.06)',
                    fontFamily: 'var(--font-sport)',
                  }}
                >
                  Continuar sin cuenta
                </button>
              </>
            )}

            {/* ── MODO CONTRASEÑA / REGISTRO ──────────────── */}
            {(mode === 'password' || mode === 'register') && (
              <>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  disabled={loading !== null}
                  className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#E0E0F8',
                    fontFamily: 'var(--font-sport)',
                    fontSize: 13,
                  }}
                />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && mode === 'password') signInWithPassword() }}
                  placeholder={mode === 'register' ? 'Contraseña (mín. 8 caracteres)' : 'Contraseña'}
                  disabled={loading !== null}
                  className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#E0E0F8',
                    fontFamily: 'var(--font-sport)',
                    fontSize: 13,
                  }}
                />
                {mode === 'register' && (
                  <input
                    type="password"
                    value={confirmPwd}
                    onChange={e => setConfirmPwd(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') signUp() }}
                    placeholder="Repite la contraseña"
                    disabled={loading !== null}
                    className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#E0E0F8',
                      fontFamily: 'var(--font-sport)',
                      fontSize: 13,
                    }}
                  />
                )}

                <button
                  onClick={mode === 'password' ? signInWithPassword : signUp}
                  disabled={loading !== null}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 font-black text-sm transition-all hover:brightness-110 active:scale-[0.98]"
                  style={{
                    background: loading === 'password' ? 'rgba(124,58,237,0.4)' : 'linear-gradient(135deg,#7C3AED,#5B21B6)',
                    color: '#fff',
                    cursor: loading !== null ? 'wait' : 'pointer',
                    fontFamily: 'var(--font-sport)',
                  }}
                >
                  {loading === 'password'
                    ? <span className="w-4 h-4 rounded-full border-2 border-purple-300 border-t-white animate-spin" />
                    : mode === 'password' ? 'Entrar' : 'Crear cuenta'
                  }
                </button>

                {/* Recuperar contraseña — solo en modo entrada */}
                {mode === 'password' && (resetSent ? (
                  <div className="rounded-2xl px-4 py-3 text-center flex flex-col gap-1" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                    <p className="text-[11px] font-black" style={{ color: '#4ade80', fontFamily: 'var(--font-display)' }}>Correo enviado</p>
                    <p className="text-[10px]" style={{ color: '#2A5A3A', fontFamily: 'var(--font-sport)' }}>Te enviamos un enlace para restablecer la contraseña a {email}</p>
                  </div>
                ) : (
                  <button
                    onClick={sendPasswordReset}
                    disabled={loading !== null}
                    className="text-[10px] text-center transition-opacity hover:opacity-70"
                    style={{ color: '#5A5A7A', fontFamily: 'var(--font-sport)', cursor: loading !== null ? 'wait' : 'pointer' }}
                  >
                    {loading === 'reset' ? 'Enviando…' : '¿Olvidaste tu contraseña?'}
                  </button>
                ))}

                <button
                  onClick={() => resetMode(mode === 'password' ? 'register' : 'password')}
                  className="text-[10px] text-center transition-opacity hover:opacity-70"
                  style={{ color: '#6060A0', fontFamily: 'var(--font-sport)' }}
                >
                  {mode === 'password' ? '¿Primera vez en TakaSports? Crea tu cuenta →' : '¿Ya tienes cuenta? Inicia sesión →'}
                </button>
              </>
            )}

            <p className="text-center text-[9px]" style={{ color: '#2A2A3A', fontFamily: 'var(--font-sport)' }}>
              Al continuar aceptas los{' '}
              <a href="/terminos" className="underline transition-opacity hover:opacity-70" style={{ color: '#5A5A7A' }}>Términos de Servicio</a>
              {' '}y la{' '}
              <a href="/privacidad" className="underline transition-opacity hover:opacity-70" style={{ color: '#5A5A7A' }}>Política de Privacidad</a>
              {' '}de TakaSports.
            </p>
          </div>
        </div>
      </div>
      </div>
    </div>,
    document.body
  )
}
