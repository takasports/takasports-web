'use client'

// Llamada a compartir la noticia como historia, al terminar de leer.
//
// Existe porque la misma acción dentro del desplegable de "Compartir" está a dos
// toques y detrás de un menú que casi nadie abre — y el objetivo de toda esta
// función es alcance. Va justo después del cuerpo del artículo y ANTES del aviso
// de notificaciones: pedir un clic cuesta menos que pedir un permiso.
//
// A propósito NO pinta una miniatura de la placa: cargarla serían ~300 KB en
// cada visita de artículo, se comparta o no.

import { useShareStory } from '@/lib/useShareStory'
import { SHARE_CTA_ANCHOR_ID } from '@/components/ShareStoryFab'

export default function ShareStoryCta({
  slug,
  title,
  accent = '#A855F7',
  variant = 'end',
}: {
  slug?: string
  title: string
  accent?: string
  /**
   * 'end'     = cierre del artículo (lleva el ancla que esconde el flotante).
   * 'inline'  = intercalado a mitad del cuerpo, con aire por arriba y por abajo.
   * 'sidebar' = barra lateral sticky de escritorio: sin márgenes propios, que el
   *             contenedor ya reparte el espacio.
   */
  variant?: 'end' | 'inline' | 'sidebar'
}) {
  const { state, share } = useShareStory({ slug, title })
  if (!slug) return null

  const heading =
    state === 'busy'       ? 'Creando la imagen…' :
    state === 'shared'     ? 'Enlace copiado' :
    state === 'downloaded' ? 'Imagen descargada' :
    state === 'failed'     ? 'No se pudo crear la imagen' :
    variant === 'sidebar' ? 'Compartir historia' : 'Compártelo en tu historia'

  const sub =
    state === 'shared'     ? 'Añade el sticker «Enlace» en Instagram y pégalo.' :
    state === 'downloaded' ? 'El enlace está en tu portapapeles para el sticker.' :
    state === 'failed'     ? 'Inténtalo otra vez en un momento.' :
    'Te preparamos una imagen con el titular, lista para Instagram.'

  const done = state === 'shared' || state === 'downloaded'
  const compact = variant !== 'end'   // icono y relleno más contenidos

  return (
    <button
      onClick={share}
      disabled={state === 'busy'}
      // El de cierre lleva el ancla: el botón flotante se esconde cuando este
      // entra en pantalla para no pedir lo mismo dos veces a la vez.
      id={variant === 'end' ? SHARE_CTA_ANCHOR_ID : undefined}
      className={`w-full flex items-center ${variant === 'sidebar' ? 'gap-3' : 'gap-4'} rounded-2xl text-left transition-all hover:opacity-90 active:scale-[0.995] disabled:opacity-70 ${
        variant === 'end' ? 'mt-8 p-4' : variant === 'inline' ? 'my-7 p-3.5' : 'p-3.5'
      }`}
      style={{
        background: `linear-gradient(100deg, ${accent}1f, ${accent}08 60%, transparent)`,
        border: `1px solid ${accent}3d`,
      }}
    >
      <span
        className="flex items-center justify-center flex-shrink-0 rounded-xl"
        style={{ width: compact ? 40 : 44, height: compact ? 40 : 44, background: `${accent}26`, color: accent }}
        aria-hidden="true"
      >
        {state === 'busy' ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="animate-spin">
            <circle cx="10" cy="10" r="7.6" stroke="currentColor" strokeWidth="2"
                    strokeLinecap="round" strokeDasharray="30 16" />
          </svg>
        ) : done ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M4 10.4l3.6 3.6L16 5.6" stroke="currentColor" strokeWidth="2.2"
                  strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
            <rect x="2.6" y="2.6" width="18.8" height="18.8" rx="5.6"
                  stroke="currentColor" strokeWidth="1.9" />
            <circle cx="12" cy="12" r="4.3" stroke="currentColor" strokeWidth="1.9" />
            <circle cx="17.5" cy="6.6" r="1.3" fill="currentColor" />
          </svg>
        )}
      </span>

      <span className="flex flex-col gap-0.5 min-w-0">
        <span
          className="text-[11px] font-black uppercase tracking-widest"
          style={{ color: state === 'failed' ? '#F87171' : accent, fontFamily: 'var(--font-sport)' }}
        >
          {heading}
        </span>
        <span className="text-xs leading-snug" style={{ color: 'var(--text-muted)' }}>
          {state !== 'idle' ? sub
            : variant === 'sidebar' ? 'Imagen para Instagram'
            : variant === 'inline'  ? 'Una imagen con el titular, lista para Instagram.'
            : sub}
        </span>
      </span>

      {state === 'idle' && variant !== 'sidebar' && (
        <span className="ml-auto flex-shrink-0" style={{ color: accent }} aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M6.5 3.5L12 9l-5.5 5.5" stroke="currentColor" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}
    </button>
  )
}
