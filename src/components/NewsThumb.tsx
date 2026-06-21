'use client'
import { useState } from 'react'
import DynamicImage from '@/components/DynamicImage'

// Miniatura de noticia (72×48) con degradación: si la imagen no carga (404,
// hotlink bloqueado, host caído), se oculta y queda el hueco con el fondo sutil
// en vez del icono de "imagen rota" del navegador. Es un client component
// mínimo para poder usar onError; MatchNews / RelatedArticlesByEntity siguen
// siendo server components (solo delegan la miniatura aquí).
export default function NewsThumb({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <div
      className="rounded-lg overflow-hidden flex-shrink-0"
      style={{ width: 72, height: 48, background: 'rgba(255,255,255,0.04)' }}
    >
      {!failed && (
        <DynamicImage
          src={src}
          alt={alt}
          width={72}
          height={48}
          style={{ objectFit: 'cover', width: '100%', height: '100%' }}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  )
}
