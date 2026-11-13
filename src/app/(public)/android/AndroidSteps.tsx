'use client'

// Los tres pasos de la prueba cerrada, con una muestra del botón de Google que
// hay que tocar en cada pantalla (las de Google cambian de idioma según la
// cuenta, por eso el paso 2 enseña las dos versiones).
//
// Tocar el paso 3 marca JOINED en localStorage: desde entonces el aviso de
// PWAManager no vuelve a salir en ese móvil y aquí se ve el «¡Listo!».

import { useEffect, useState, type ReactNode } from 'react'
import { GROUP_URL, OPTIN_URL, PLAY_URL, JOINED_KEY } from '@/lib/android-beta'
import { trackAndroidBeta } from '@/lib/analytics'

type Chip = { label: string; kind: 'outline' | 'blue' | 'green' }

const CHIP_STYLE: Record<Chip['kind'], React.CSSProperties> = {
  outline: { border: '1px solid #5f6368', color: '#8ab4f8', background: '#202124' },
  blue: { background: '#1a73e8', color: '#fff' },
  green: { background: '#01875f', color: '#fff' },
}

function GoogleChips({ chips }: { chips: Chip[] }) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg px-2.5 py-2 mb-3"
      style={{ background: 'var(--bg-surface)', fontSize: 12, color: 'var(--text-muted)' }}
    >
      Verás
      {chips.map((c, i) => (
        <span key={c.label} className="contents">
          {i > 0 && <span>o</span>}
          <span className="rounded-md px-2.5 py-1" style={{ fontSize: 12, fontWeight: 700, ...CHIP_STYLE[c.kind] }}>
            {c.label}
          </span>
        </span>
      ))}
    </div>
  )
}

const ArrowIcon = () => (
  <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M7 17 17 7M8 7h9v9" />
  </svg>
)

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="rounded-2xl p-4 mb-2.5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2.5 mb-2">
        <span
          aria-hidden
          className="flex items-center justify-center shrink-0 rounded-full"
          style={{ width: 26, height: 26, background: 'var(--accent-action)', color: '#fff', fontWeight: 900, fontSize: 13 }}
        >
          {n}
        </span>
        <h3 style={{ fontSize: 16, fontWeight: 900 }}>
          <span className="sr-only">Paso {n}: </span>
          {title}
        </h3>
      </div>
      {children}
    </li>
  )
}

const P = ({ children }: { children: ReactNode }) => (
  <p className="mb-2.5" style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{children}</p>
)

const btn = (primary: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%',
  padding: '12px 14px', borderRadius: 12, fontSize: 13, fontWeight: 900,
  textTransform: 'uppercase', letterSpacing: '0.05em', textDecoration: 'none',
  background: primary ? 'var(--accent-action)' : 'var(--text-primary)',
  color: primary ? '#fff' : 'var(--bg-base)',
})

export default function AndroidSteps() {
  const [joined, setJoined] = useState(false)

  useEffect(() => {
    try { if (localStorage.getItem(JOINED_KEY)) setJoined(true) } catch {}
  }, [])

  const onInstall = () => {
    trackAndroidBeta('step_3')
    setJoined(true)
    try { localStorage.setItem(JOINED_KEY, String(Date.now())) } catch {}
  }

  return (
    <>
      <div
        className="flex gap-2.5 rounded-xl p-3 mt-6 mb-4"
        style={{ background: 'var(--bg-surface)', border: '1px dashed var(--border)', fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)' }}
      >
        <span
          aria-hidden
          className="flex items-center justify-center shrink-0 rounded-lg"
          style={{ width: 26, height: 26, background: 'var(--bg-card)', fontWeight: 900, color: 'var(--text-primary)' }}
        >
          !
        </span>
        <span>
          <b style={{ color: 'var(--text-primary)' }}>Antes de empezar:</b> usa la misma cuenta de Google que tienes en
          Play Store. Para verla, abre Play Store y toca tu foto, arriba a la derecha.
        </span>
      </div>

      <h2
        className="mb-2.5"
        style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}
      >
        3 pasos
      </h2>

      <ol>
        <Step n={1} title="Únete al grupo">
          <P>Se abre Grupos de Google. Toca el botón de arriba, junto al nombre del grupo:</P>
          <GoogleChips chips={[{ label: 'Unirse al grupo', kind: 'outline' }]} />
          <a href={GROUP_URL} target="_blank" rel="noopener noreferrer" style={btn(false)} onClick={() => trackAndroidBeta('step_1')}>
            Unirme al grupo <ArrowIcon />
          </a>
        </Step>

        <Step n={2} title="Activa tu acceso">
          <P>Se abre Google Play. Toca el botón para entrar en la prueba (puede salir en inglés):</P>
          <GoogleChips chips={[{ label: 'Convertirme en verificador', kind: 'blue' }, { label: 'Become a tester', kind: 'blue' }]} />
          <a href={OPTIN_URL} target="_blank" rel="noopener noreferrer" style={btn(false)} onClick={() => trackAndroidBeta('step_2')}>
            Activar mi acceso <ArrowIcon />
          </a>
          <p className="mt-2 text-center" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            ¿Pone «App not available»? Espera 2 minutos y vuelve a tocar el botón.
          </p>
        </Step>

        <Step n={3} title="Instala Taka">
          <P>
            Toca <b style={{ color: 'var(--text-primary)' }}>Instalar</b> en Google Play. Mantén la app en tu móvil al
            menos 14 días: es lo que pide Google para abrirla a todos.
          </P>
          <GoogleChips chips={[{ label: 'Instalar', kind: 'green' }]} />
          <a href={PLAY_URL} target="_blank" rel="noopener noreferrer" style={btn(true)} onClick={onInstall}>
            Instalar desde Google Play
          </a>
        </Step>
      </ol>

      {joined && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-xl p-3 mt-3"
          style={{ background: 'rgba(1,135,95,0.12)', border: '1px solid rgba(1,135,95,0.4)', fontSize: 13.5, lineHeight: 1.45 }}
        >
          <span
            aria-hidden
            className="flex items-center justify-center shrink-0 rounded-full"
            style={{ width: 26, height: 26, background: '#01875f', color: '#fff', fontWeight: 900 }}
          >
            ✓
          </span>
          <span>
            <b>¡Listo!</b> Ya eres parte del grupo fundador de Taka en Android. Gracias.
          </span>
        </div>
      )}
    </>
  )
}
