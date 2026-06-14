'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { LogoMark } from '@/components/Logo'

// Página de la última etapa del flujo "¿Olvidaste tu contraseña?".
// El correo de recuperación enlaza al callback OAuth (exchangeCodeForSession),
// que deja la sesión de recuperación lista y redirige aquí. Comprobamos que
// exista sesión, pedimos la nueva contraseña y la guardamos con updateUser.
type Status = 'checking' | 'ready' | 'invalid' | 'saving' | 'done'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('checking')
  const [password, setPassword] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    if (!supabase) { setStatus('invalid'); return }
    supabase.auth.getUser().then(({ data }) => {
      setStatus(data.user ? 'ready' : 'invalid')
    })
  }, [])

  async function save() {
    const supabase = createClient()
    if (!supabase) { setStatus('invalid'); return }
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }
    if (password !== confirmPwd) { setError('Las contraseñas no coinciden'); return }
    setStatus('saving')
    setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError('No se pudo guardar la contraseña. El enlace puede haber caducado; pídelo de nuevo.')
      setStatus('ready')
    } else {
      setStatus('done')
      setTimeout(() => router.push('/perfil'), 1600)
    }
  }

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }} className="flex items-center justify-center p-4">
      <div
        className="relative w-full"
        style={{
          maxWidth: 400,
          background: 'linear-gradient(160deg,#1A0030 0%,#110020 50%,#07000E 100%)',
          border: '1px solid rgba(124,58,237,0.32)',
          borderRadius: 24,
          padding: '28px 24px',
        }}
      >
        <div
          className="absolute -top-12 -right-12 w-48 h-48 blur-3xl opacity-20 pointer-events-none"
          style={{ background: '#7C3AED' }}
        />

        <div className="flex items-center gap-2 mb-5">
          <LogoMark size={22} />
          <span
            className="text-[10px] font-black uppercase tracking-widest"
            style={{ color: '#9B6DB5', fontFamily: 'var(--font-sport)' }}
          >
            TakaSports
          </span>
        </div>

        {/* Comprobando enlace */}
        {status === 'checking' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <span className="w-7 h-7 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
            <p className="text-xs" style={{ color: '#8888A8', fontFamily: 'var(--font-sport)' }}>Comprobando el enlace…</p>
          </div>
        )}

        {/* Enlace no válido */}
        {status === 'invalid' && (
          <div className="flex flex-col gap-3">
            <h1 className="font-black text-xl" style={{ fontFamily: 'var(--font-display)', color: '#F0F0F8', letterSpacing: '-0.02em' }}>
              Enlace no válido
            </h1>
            <p className="text-xs" style={{ color: '#8888A8', fontFamily: 'var(--font-sport)', lineHeight: 1.6 }}>
              Este enlace de recuperación no es válido o ha caducado. Vuelve a tu perfil y pide uno nuevo desde &laquo;¿Olvidaste tu contraseña?&raquo;.
            </p>
            <Link
              href="/perfil"
              className="mt-1 text-center rounded-2xl py-3 font-black text-sm transition-all hover:brightness-110 active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg,#7C3AED,#5B21B6)', color: '#fff', fontFamily: 'var(--font-sport)' }}
            >
              Ir a mi perfil
            </Link>
          </div>
        )}

        {/* Listo / guardando — formulario */}
        {(status === 'ready' || status === 'saving') && (
          <div className="flex flex-col gap-3">
            <div>
              <h1 className="font-black text-xl leading-tight" style={{ fontFamily: 'var(--font-display)', color: '#F0F0F8', letterSpacing: '-0.02em' }}>
                Nueva contraseña
              </h1>
              <p className="text-xs mt-1" style={{ color: '#6060A0', fontFamily: 'var(--font-sport)' }}>
                Elige una contraseña nueva para tu cuenta de TakaSports.
              </p>
            </div>

            {error && (
              <p
                className="text-[11px] text-center px-3 py-2 rounded-xl"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                {error}
              </p>
            )}

            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Nueva contraseña (mín. 8 caracteres)"
              disabled={status === 'saving'}
              className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#E0E0F8', fontFamily: 'var(--font-sport)', fontSize: 13 }}
            />
            <input
              type="password"
              value={confirmPwd}
              onChange={e => setConfirmPwd(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') save() }}
              placeholder="Repite la contraseña"
              disabled={status === 'saving'}
              className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#E0E0F8', fontFamily: 'var(--font-sport)', fontSize: 13 }}
            />
            <button
              onClick={save}
              disabled={status === 'saving'}
              className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 font-black text-sm transition-all hover:brightness-110 active:scale-[0.98]"
              style={{
                background: status === 'saving' ? 'rgba(124,58,237,0.4)' : 'linear-gradient(135deg,#7C3AED,#5B21B6)',
                color: '#fff',
                cursor: status === 'saving' ? 'wait' : 'pointer',
                fontFamily: 'var(--font-sport)',
              }}
            >
              {status === 'saving'
                ? <span className="w-4 h-4 rounded-full border-2 border-purple-300 border-t-white animate-spin" />
                : 'Guardar contraseña'}
            </button>
          </div>
        )}

        {/* Hecho */}
        {status === 'done' && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <span style={{ color: '#4ade80' }}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="1.6" />
                <path d="M10 16.5l4 4 8-8.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <p className="text-sm font-black" style={{ color: '#4ade80', fontFamily: 'var(--font-display)' }}>Contraseña actualizada</p>
            <p className="text-[11px]" style={{ color: '#6060A0', fontFamily: 'var(--font-sport)' }}>Te llevamos a tu perfil…</p>
          </div>
        )}
      </div>
    </div>
  )
}
