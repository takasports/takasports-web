// Acceso de una previa a la ficha de su partido (/partido/[ref]): alineaciones,
// estadísticas y marcador en directo. Solo lo llevan las notas con `matchRef`
// (las previas automáticas), así que el enlace es exacto, no adivinado.
//
// prefetch={false} a propósito: el prefetch de enlaces a páginas pesadas ya tumbó
// el sitio dos veces (ver /comparar). Una ficha de partido es de las más caras.

import Link from 'next/link'

export default function FichaPartidoLink({
  matchRef,
  home,
  away,
  accent = '#7c3aed',
}: {
  matchRef: string
  home?: string | null
  away?: string | null
  accent?: string
}) {
  const partido = home && away ? `${home} – ${away}` : 'Ficha del partido'
  return (
    <Link
      href={`/partido/${encodeURIComponent(matchRef)}`}
      prefetch={false}
      className="ts-ficha-link mb-8 flex items-center gap-4 rounded-2xl px-5 py-4 transition-colors"
      style={{ border: `1px solid ${accent}33`, background: `${accent}0d`, maxWidth: 680 }}
    >
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ background: `${accent}1f`, color: accent }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M12 5v14M3 9h3v6H3M21 9h-3v6h3" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      </span>
      <span className="flex min-w-0 flex-col">
        <span
          className="text-[10px] font-black uppercase tracking-widest"
          style={{ color: accent, fontFamily: 'var(--font-sport)' }}
        >
          Ficha del partido
        </span>
        <span className="truncate text-[15px] font-bold">{partido}</span>
        <span className="text-[12.5px]" style={{ color: 'var(--body-lede, #9aa0aa)' }}>
          Alineaciones, estadísticas y marcador en directo
        </span>
      </span>
      <span aria-hidden className="ml-auto text-[20px] font-bold" style={{ color: accent }}>→</span>
    </Link>
  )
}
