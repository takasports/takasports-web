// Componente visual para breadcrumbs. La versión JSON-LD se emite aparte en
// cada page.tsx — esto es solo el render HTML semántico que ven los usuarios
// y que Google también lee para entender la jerarquía del site.
//
// Diseñado para integrarse con el dark theme existente (mismo styling que
// calendario/[slug] y SportHubHeader que ya tienen breadcrumbs visuales).

import Link from 'next/link'

export interface BreadcrumbItem {
  /** Texto mostrado. Última item se renderiza sin link (current page). */
  label: string
  /** Si es undefined, el item es el actual (no link). */
  href?: string
}

interface Props {
  items: BreadcrumbItem[]
  /** Margin bottom override. Default: mb-6 */
  className?: string
}

export default function BreadcrumbsNav({ items, className }: Props) {
  if (items.length === 0) return null

  return (
    <nav
      aria-label="Migas de pan"
      className={className ?? 'mb-6 text-xs flex items-center gap-2 flex-wrap'}
      style={{ color: 'var(--text-muted)' }}
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={i} className="inline-flex items-center gap-2">
            {item.href && !isLast ? (
              <Link href={item.href} className="hover:text-white transition-colors">
                {item.label}
              </Link>
            ) : (
              <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
            )}
            {!isLast && <span aria-hidden>›</span>}
          </span>
        )
      })}
    </nav>
  )
}
