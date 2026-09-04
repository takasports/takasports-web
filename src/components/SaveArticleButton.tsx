'use client'

import { useEffect, useState } from 'react'

// Guardar una noticia para después.
//
// Hasta el 03/09/2026 no se podía: solo había un historial pasivo de lo leído en
// el navegador. Es, además, la primera razón práctica para crear cuenta que no
// consiste en competir — y la cuenta no hace falta para empezar.
//
// Reutiliza `user_favorites` vía /api/rankings/favorites, que ya guarda equipos
// (`team:`), ligas (`comp:`) y deportes (`sport:`) y cuyo propio comentario ya
// contemplaba noticias en el campo `meta`. Aquí el prefijo es `noticia:`.
//
// Sin sesión se guarda en el dispositivo y se sube al entrar, igual que los
// pronósticos de invitado: pedir la cuenta antes de dar nada es lo que hunde el
// embudo.

const CLAVE_LOCAL = 'ts_guardados'

export function leerGuardadosLocales(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE_LOCAL) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch { return [] }
}

function escribirGuardadosLocales(slugs: string[]): void {
  try { localStorage.setItem(CLAVE_LOCAL, JSON.stringify(slugs)) } catch { /* sin espacio */ }
}

export default function SaveArticleButton({
  slug, title, imageUrl, sport,
}: {
  slug: string
  title: string
  imageUrl?: string | null
  sport?: string | null
}) {
  const [guardado, setGuardado] = useState(false)
  const [listo, setListo] = useState(false)

  useEffect(() => {
    const locales = leerGuardadosLocales()
    setGuardado(locales.includes(slug))
    setListo(true)
    // La nube completa lo local. Sin sesión devuelve [] y no pasa nada.
    fetch('/api/rankings/favorites', { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : { favorites: [] }))
      .then((j: { favorites?: { entry_id: string }[] }) => {
        const enNube = (j.favorites ?? []).some(f => f.entry_id === `noticia:${slug}`)
        if (enNube) setGuardado(true)
      })
      .catch(() => { /* nos quedamos con lo local */ })
  }, [slug])

  const alternar = () => {
    const siguiente = !guardado
    setGuardado(siguiente)

    const locales = leerGuardadosLocales()
    escribirGuardadosLocales(
      siguiente ? [...new Set([slug, ...locales])] : locales.filter(s => s !== slug),
    )

    const entryId = `noticia:${slug}`
    if (siguiente) {
      void fetch('/api/rankings/favorites', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        // `meta` para que la lista de guardados se pinte sin volver a Sanity.
        body: JSON.stringify({ entry_id: entryId, meta: { title, imageUrl: imageUrl ?? null, sport: sport ?? null } }),
      }).catch(() => { /* sin sesión o sin red: queda en local */ })
    } else {
      void fetch(`/api/rankings/favorites?entry_id=${encodeURIComponent(entryId)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      }).catch(() => { /* idem */ })
    }
  }

  return (
    <button
      onClick={alternar}
      aria-pressed={guardado}
      aria-label={guardado ? 'Quitar de guardados' : 'Guardar para después'}
      title={guardado ? 'Quitar de guardados' : 'Guardar para después'}
      className="inline-flex items-center justify-center rounded-full transition-colors"
      style={{
        width: 36, height: 36,
        background: guardado ? 'rgba(124,58,237,0.16)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${guardado ? 'rgba(124,58,237,0.38)' : 'var(--border)'}`,
        color: guardado ? '#C4B5FD' : 'var(--text-muted)',
        cursor: 'pointer',
        // Hasta leer el almacén no sabemos el estado: sin esto el icono
        // parpadeaba de "sin guardar" a "guardado" en cada carga.
        opacity: listo ? 1 : 0,
      }}
    >
      <svg width="15" height="15" viewBox="0 0 16 16" fill={guardado ? 'currentColor' : 'none'} aria-hidden>
        <path d="M4 2.5h8a.5.5 0 0 1 .5.5v10.2a.3.3 0 0 1-.47.25L8 10.6l-4.03 2.85a.3.3 0 0 1-.47-.25V3a.5.5 0 0 1 .5-.5z"
          stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
