'use client'

// Las etiquetas de una noticia: cinco a la vista y «+N» para el resto (V-13).
// Once hashtags en la columna lateral de escritorio, antes que «Compartir
// historia», restaban sobriedad a la hoja; ahora van al final, en todas las
// pantallas, y las que sobran se abren con un toque.

import { useState } from 'react'
import Link from 'next/link'

const VISIBLES = 5

export default function Etiquetas({ tags }: { tags: string[] }) {
  const [abiertas, setAbiertas] = useState(false)
  if (tags.length === 0) return null
  const lista = abiertas ? tags : tags.slice(0, VISIBLES)
  const resto = tags.length - lista.length
  return (
    <div className="flex flex-wrap gap-2">
      {lista.map((tag) => (
        <Link
          prefetch={false}
          key={tag}
          href={`/tag/${encodeURIComponent(tag)}`}
          className="text-[12px] px-3 py-1.5 rounded-full transition-colors hover:border-purple-500/40 hover:text-purple-300"
          style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)', textDecoration: 'none' }}
        >
          #{tag}
        </Link>
      ))}
      {resto > 0 && (
        <button
          type="button"
          onClick={() => setAbiertas(true)}
          className="text-[12px] px-3 py-1.5 rounded-full transition-colors hover:border-purple-500/40"
          style={{ background: 'transparent', color: '#C4B5FD', border: '1px solid var(--border-2)', cursor: 'pointer' }}
          aria-label={`Ver ${resto} etiquetas más`}
        >
          +{resto}
        </button>
      )}
    </div>
  )
}
