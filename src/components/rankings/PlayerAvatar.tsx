'use client'

import { useState } from 'react'

export default function PlayerAvatar({
  src, alt, fallback, size = 36, rounded = 'xl',
}: {
  src?: string; alt: string; fallback: string; size?: number; rounded?: string
}) {
  const [ok, setOk] = useState(true)
  return ok && src
    /* eslint-disable-next-line @next/next/no-img-element */
    ? <img
        src={src}
        alt={alt}
        className={`w-full h-full object-cover rounded-${rounded}`}
        onError={() => setOk(false)}
      />
    : <span className="text-2xl leading-none select-none">{fallback}</span>
}
