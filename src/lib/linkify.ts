// Linkify a partir de texto plano. Devuelve un array de React nodes:
// strings normales + elementos <a> para las URLs detectadas.
// Sin innerHTML, sin parsing de HTML → cero superficie XSS.
//
// Heurística: detecta http(s)://… delimitado por espacios o final de cadena.

import type { ReactNode } from 'react'
import React from 'react'

const URL_RE = /(https?:\/\/[^\s<>"]+)/g

export function linkifyText(text: string): ReactNode[] {
  if (!text) return []
  const parts: ReactNode[] = []
  let lastIndex = 0
  let key = 0

  text.replace(URL_RE, (match, _grp, offset: number) => {
    if (offset > lastIndex) {
      parts.push(text.slice(lastIndex, offset))
    }
    // Recorte cosmético de URLs largas en el texto visible.
    const visible = match.length > 60 ? match.slice(0, 57) + '…' : match
    parts.push(
      React.createElement(
        'a',
        {
          key: `lk-${key++}`,
          href: match,
          target: '_blank',
          rel: 'noopener noreferrer ugc',
          style: { color: 'var(--purple-light)', textDecoration: 'underline' },
        },
        visible,
      ),
    )
    lastIndex = offset + match.length
    return match
  })

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }
  return parts
}
