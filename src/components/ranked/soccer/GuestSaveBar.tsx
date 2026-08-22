'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Barra de invitado: aparece en cuanto hay un pick sin cuenta.
//
// Es la contrapartida de dejar jugar sin registrarse. Si se puede pronosticar
// de invitado y nadie lo dice, el usuario cree que ya está compitiendo y se va;
// hay que ser explícito en que eso vive solo en su navegador, y ofrecer la
// salida en el mismo sitio donde está mirando.
//
// Se pide la cuenta por lo que DA (guardar, competir, que te avisen), no por lo
// que impide. Y no antes de que haya nada que guardar: sin picks, esta barra no
// se monta.
// ─────────────────────────────────────────────────────────────────────────────

import { LockIcon } from '@/components/icons/GameIcons'

export default function GuestSaveBar({
  picks, total, complete, accent, busy, onSignIn,
}: {
  picks: number
  total: number
  /** Lo decide el padre con la misma regla que el resto de la pantalla: todos
   *  los picks Y capitán. Calcularlo aquí como `picks >= total` decía "lo
   *  tienes todo" a quien aún no había nombrado capitán. */
  complete: boolean
  accent: string
  busy: boolean
  onSignIn: () => void
}) {
  if (picks <= 0) return null

  return (
    // Reutiliza la primitiva sticky del sitio: en móvil se eleva sobre la
    // cápsula del BottomNav y en lg+ se ancla al borde. Duplicar esos offsets
    // aquí sería la forma de que se desincronicen.
    <div className="qn-betslip-sticky z-30 mt-4">
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
        style={{
          borderRadius: 'var(--radius-card)',
          background: 'rgba(17, 17, 24, 0.96)',
          backdropFilter: 'blur(20px)',
          border: `1px solid ${complete ? `${accent}55` : 'rgba(255,255,255,0.10)'}`,
          boxShadow: '0 18px 40px -14px rgba(0,0,0,0.7)',
        }}
      >
        <span style={{ display: 'inline-flex', color: complete ? accent : 'var(--text-muted)' }}>
          <LockIcon size={16} />
        </span>

        <div className="flex-1 min-w-0" style={{ minWidth: 190 }}>
          {/* Sin "N de M": la cabecera de cada Jornada ya lleva su propio
              "3 de 11 pronosticados", contado sobre el universo del Pleno. Dos
              fracciones distintas para lo mismo en la misma pantalla no se
              entienden — aquí lo que importa no es cuánto falta, es que lo
              hecho todavía no está guardado. */}
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 900,
            color: complete ? '#F4F4FA' : 'var(--text-secondary)', letterSpacing: '-0.01em',
            lineHeight: 1.2,
          }}>
            {complete
              ? 'Lo tienes todo — pero aún no cuenta'
              : `${picks} pick${picks === 1 ? '' : 's'} sin guardar`}
          </p>
          <p style={{
            fontFamily: 'var(--font-sport)', fontSize: 11, color: 'var(--text-muted)',
            marginTop: 2, lineHeight: 1.35,
          }}>
            Estás jugando como invitado: viven solo en este navegador.
            Entra y se guardan{complete ? ' y compiten en la Liga Taka' : ''}.
          </p>
        </div>

        <button
          type="button"
          onClick={onSignIn}
          disabled={busy}
          style={{
            padding: '9px 18px', borderRadius: 'var(--radius-md)',
            background: accent, color: '#04140C', border: 'none',
            fontFamily: 'var(--font-sport)', fontSize: 12, fontWeight: 900,
            letterSpacing: '0.09em', textTransform: 'uppercase',
            cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1,
            whiteSpace: 'nowrap',
          }}
        >
          {busy ? 'Entrando…' : 'Entrar y guardar'}
        </button>
      </div>
    </div>
  )
}
