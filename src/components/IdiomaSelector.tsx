'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  IDIOMAS,
  IDIOMA_AUTO_CLAVE,
  IDIOMA_CLAVE,
  elegirIdioma,
  esIdioma,
  esRastreador,
  textosFicha,
  type Idioma,
  type MotivoIdioma,
  type VersionIdioma,
} from '@/lib/idiomas'

// Selector de idioma de un reportaje + elección automática.
//
// - <IdiomaSelector> pinta el botón (chip ES | EN en escritorio, círculo con
//   desplegable en móvil). Elegir un idioma lo RECUERDA y manda sobre la
//   detección automática a partir de entonces.
// - <IdiomaAuto> decide, al abrir la nota por primera vez, si hay que llevar a la
//   persona a otra versión (idioma del navegador → país), y si lo hace avisa
//   una vez con salida a la versión anterior. No actúa con rastreadores.
//
// Ambos solo se montan cuando el reportaje tiene más de una versión.

const PAIS_CLAVE = 'taka_pais'

function leer(almacen: 'local' | 'session', clave: string): string | null {
  try {
    return (almacen === 'local' ? localStorage : sessionStorage).getItem(clave)
  } catch {
    return null
  }
}
function escribir(almacen: 'local' | 'session', clave: string, valor: string | null) {
  try {
    const s = almacen === 'local' ? localStorage : sessionStorage
    if (valor === null) s.removeItem(clave)
    else s.setItem(clave, valor)
  } catch {
    /* modo privado / almacenamiento bloqueado: se sigue sin recordar */
  }
}

function opciones(actual: string, versiones: VersionIdioma[]): { lang: Idioma; slug: string | null }[] {
  const mapa = new Map<Idioma, string | null>()
  if (esIdioma(actual)) mapa.set(actual, null)
  for (const v of versiones) if (esIdioma(v.lang)) mapa.set(v.lang, v.slug)
  // Español primero, el resto por orden alfabético.
  return [...mapa.entries()]
    .sort(([a], [b]) => (a === 'es' ? -1 : b === 'es' ? 1 : a.localeCompare(b)))
    .map(([lang, slug]) => ({ lang, slug }))
}

/** Elige a mano: se recuerda y se quita el aviso de «lo hemos cambiado nosotros». */
function useCambiar(versiones: VersionIdioma[], actual: string) {
  const router = useRouter()
  return useCallback(
    (lang: Idioma) => {
      escribir('local', IDIOMA_CLAVE, lang)
      escribir('session', IDIOMA_AUTO_CLAVE, null)
      if (lang === actual) return
      const destino = versiones.find(v => v.lang === lang)
      if (destino) router.push(`/noticias/${destino.slug}`)
    },
    [router, versiones, actual],
  )
}

function Globo({ tamano = 14 }: { tamano?: number }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 12h18M12 3c2.6 2.5 4 5.6 4 9s-1.4 6.5-4 9c-2.6-2.5-4-5.6-4-9s1.4-6.5 4-9Z" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

export function IdiomaSelector({
  actual,
  versiones,
  variante,
}: {
  actual: string
  versiones: VersionIdioma[]
  variante: 'chip' | 'icono'
}) {
  const cambiar = useCambiar(versiones, actual)
  const lista = opciones(actual, versiones)
  const [abierto, setAbierto] = useState(false)
  const caja = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false)
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', esc)
    }
  }, [abierto])

  if (lista.length < 2) return null
  const acento = 'var(--sport-accent, #f5c518)'

  if (variante === 'chip') {
    return (
      <div
        role="group"
        aria-label="Idioma / Language"
        className="ml-auto inline-flex items-center gap-0.5 rounded-full p-[3px]"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', fontFamily: 'var(--font-sport)' }}
      >
        <span className="pl-2 pr-1.5 flex items-center" style={{ color: 'var(--text-muted)' }}>
          <Globo />
        </span>
        {lista.map(o => {
          const activo = o.lang === actual
          return (
            <button
              key={o.lang}
              type="button"
              lang={o.lang}
              aria-pressed={activo}
              title={IDIOMAS[o.lang].nombre}
              onClick={() => cambiar(o.lang)}
              className="rounded-full px-3 py-1.5 text-[11px] font-bold tracking-wider leading-none transition-colors"
              style={activo ? { background: acento, color: '#0A0A12' } : { color: 'var(--text-muted)' }}
            >
              {IDIOMAS[o.lang].etiqueta}
            </button>
          )
        })}
      </div>
    )
  }

  // Móvil: círculo como el resto de iconos de la fila, con desplegable.
  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label="Idioma / Language"
        onClick={() => setAbierto(a => !a)}
        className="flex flex-col items-center justify-center gap-px rounded-full"
        style={{
          width: 36,
          height: 36,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-sport)',
        }}
      >
        <Globo tamano={14} />
        <span className="text-[9px] font-extrabold leading-none tracking-wide">{IDIOMAS[actual as Idioma]?.etiqueta ?? ''}</span>
      </button>
      {abierto && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 z-50 min-w-[150px] rounded-xl p-1.5"
          style={{ background: 'var(--surface-2, #15151f)', border: '1px solid var(--border)', boxShadow: '0 10px 30px rgba(0,0,0,.45)' }}
        >
          {lista.map(o => {
            const activo = o.lang === actual
            return (
              <button
                key={o.lang}
                type="button"
                role="menuitemradio"
                aria-checked={activo}
                lang={o.lang}
                onClick={() => {
                  setAbierto(false)
                  cambiar(o.lang)
                }}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm"
                style={{ color: activo ? acento : 'var(--text-primary)', fontWeight: activo ? 700 : 500 }}
              >
                <span>{IDIOMAS[o.lang].nombre}</span>
                <span className="text-[10px] font-bold tracking-wider opacity-70">{IDIOMAS[o.lang].etiqueta}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

interface AvisoAuto {
  a: string
  de: string
  motivo: MotivoIdioma
  cerrado?: boolean
}

export function IdiomaAuto({ actual, versiones }: { actual: string; versiones: VersionIdioma[] }) {
  const router = useRouter()
  const cambiar = useCambiar(versiones, actual)
  const [aviso, setAviso] = useState<AvisoAuto | null>(null)

  useEffect(() => {
    if (versiones.length === 0) return

    // ¿Venimos de un cambio automático? Entonces se avisa (una vez, hasta cerrarlo).
    const previo = leer('session', IDIOMA_AUTO_CLAVE)
    if (previo) {
      try {
        const a = JSON.parse(previo) as AvisoAuto
        if (a.a === actual && !a.cerrado) setAviso(a)
      } catch {
        escribir('session', IDIOMA_AUTO_CLAVE, null)
      }
    }

    if (esRastreador(navigator.userAgent)) return

    const disponibles = [actual, ...versiones.map(v => v.lang)]
    const guardado = leer('local', IDIOMA_CLAVE)
    const navegador = navigator.languages?.length ? navigator.languages : [navigator.language]

    const aplicar = (pais: string | null) => {
      const r = elegirIdioma({ actual, disponibles, guardado, navegador, pais })
      if (r.lang === actual) return
      const destino = versiones.find(v => v.lang === r.lang)
      if (!destino) return
      // Si lo decidió la persona (guardado) no hace falta avisar: ya sabe lo que quiere.
      if (r.motivo !== 'guardado') {
        escribir('session', IDIOMA_AUTO_CLAVE, JSON.stringify({ a: r.lang, de: actual, motivo: r.motivo } satisfies AvisoAuto))
      }
      router.replace(`/noticias/${destino.slug}`)
    }

    // 1) Con lo que ya sabemos en el navegador (elección guardada o idioma): sin red.
    const local = elegirIdioma({ actual, disponibles, guardado, navegador })
    if (local.motivo !== 'actual') return aplicar(null)

    // 2) Sin pista local: el país. Una consulta por sesión, y solo si no hay elección guardada.
    const pais = leer('session', PAIS_CLAVE)
    if (pais !== null) return aplicar(pais || null)
    let vivo = true
    fetch('/api/geo', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then((j: { country?: string | null } | null) => {
        const cc = j?.country ?? null
        escribir('session', PAIS_CLAVE, cc ?? '')
        if (vivo) aplicar(cc)
      })
      .catch(() => {
        /* sin país: nos quedamos en la versión de la página */
      })
    return () => {
      vivo = false
    }
  }, [actual, versiones, router])

  if (!aviso) return null
  const t = textosFicha(actual)
  const { texto, volver } = t.aviso(actual as Idioma, aviso.motivo)
  const origen: Idioma = esIdioma(aviso.de) ? aviso.de : 'es'
  const acento = 'var(--sport-accent, #f5c518)'

  return (
    <div
      role="status"
      className="mb-4 flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13px] leading-snug"
      style={{ background: 'rgba(245,197,24,0.08)', border: '1px solid rgba(245,197,24,0.35)', color: 'var(--text-primary)' }}
    >
      <span style={{ color: acento }}>
        <Globo tamano={16} />
      </span>
      <span className="min-w-0 flex-1">
        {texto}{' '}
        <button type="button" onClick={() => cambiar(origen)} className="underline underline-offset-2 font-semibold" style={{ color: acento }}>
          {volver}
        </button>
      </span>
      <button
        type="button"
        aria-label="Cerrar / Close"
        onClick={() => {
          escribir('session', IDIOMA_AUTO_CLAVE, JSON.stringify({ ...aviso, cerrado: true }))
          setAviso(null)
        }}
        className="opacity-60 hover:opacity-100 px-1"
      >
        ✕
      </button>
    </div>
  )
}
