'use client'
// Foto dentro del cuerpo de una noticia, enlazada de la web de un medio. Si el medio
// bloquea el enlace o la foto ya no existe, la figura entera desaparece: antes quedaba
// un recuadro en blanco con su pie de foto (Colapinto y Zidane, 02/10/2026).
import { useState } from 'react'
import Image from 'next/image'

export default function ImagenIntermedia({ src, alt, caption }: { src: string; alt: string; caption?: string | null }) {
  const [rota, setRota] = useState(false)
  if (rota) return null
  return (
    <figure style={{ margin: '2.25rem 0' }}>
      <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
        <Image src={src} alt={alt} width={900} height={540} className="w-full h-auto object-cover" unoptimized onError={() => setRota(true)} />
      </div>
      {caption && (
        <figcaption style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.6rem', textAlign: 'center', fontStyle: 'italic', lineHeight: 1.5 }}>
          {caption}
        </figcaption>
      )}
    </figure>
  )
}
