// Previa ↔ crónica del mismo partido (06/10/2026). Mucha gente llega desde Google a la
// previa cuando el partido ya ha terminado: arriba de la previa, «Ya terminó · 2-1 · lee
// la crónica». Y la crónica enlaza a su previa. El cruce es por `matchRef` exacto, nunca
// por texto, y Google ve las dos notas unidas.
//
// prefetch={false}, como el resto de enlaces de la nota a páginas pesadas.

import Link from 'next/link'

export default function NotaHermanaLink({
  tipo,
  slug,
  partido,
  accent = '#7c3aed',
}: {
  /** La nota a la que se enlaza. */
  tipo: 'cronica' | 'previa'
  slug: string
  /** «Francia 1-1 Italia» o «Francia – Italia». */
  partido: string
  accent?: string
}) {
  const cronica = tipo === 'cronica'
  return (
    <Link
      href={`/noticias/${slug}`}
      prefetch={false}
      className="ts-ficha-link mb-4 flex items-center gap-4 rounded-2xl px-5 py-4 transition-colors"
      style={{ border: `1px solid ${accent}${cronica ? '66' : '33'}`, background: `${accent}${cronica ? '1a' : '0d'}`, maxWidth: 680 }}
    >
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[18px]"
        style={{ background: `${accent}1f`, color: accent }}
      >
        {cronica ? '🏁' : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        )}
      </span>
      <span className="flex min-w-0 flex-col">
        <span
          className="text-[10px] font-black uppercase tracking-widest"
          style={{ color: accent, fontFamily: 'var(--font-sport)' }}
        >
          {cronica ? 'Ya terminó' : 'Antes del partido'}
        </span>
        <span className="truncate text-[15px] font-bold">{partido}</span>
        <span className="text-[12.5px]" style={{ color: 'var(--body-lede, #9aa0aa)' }}>
          {cronica ? 'Lee la crónica: goles, figura y estadísticas' : 'La previa: lo que se jugaban y cómo llegaban'}
        </span>
      </span>
      <span aria-hidden className="ml-auto text-[20px] font-bold" style={{ color: accent }}>→</span>
    </Link>
  )
}
