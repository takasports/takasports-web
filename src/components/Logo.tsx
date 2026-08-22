import Link from 'next/link'
import Image from 'next/image'

const ICON_RATIO = 1 // 500x500
const FULL_RATIO = 1477 / 422 // 3.501

/** LogoMark — isotipo TakaSports (pentágono morado con "T" en negativo). */
export function LogoMark({
  size = 28,
  className,
}: {
  size?: number
  className?: string
}) {
  return (
    <Image
      src="/taka-icon.png"
      width={size}
      height={size}
      alt="TakaSports"
      className={className}
      priority
      style={{ width: size, height: size }}
    />
  )
}

/** LogoFull — logo horizontal completo (isotipo + wordmark "TakaSports"). */
export function LogoFull({
  size = 28,
  href = '/',
  asLink = true,
  onClick,
  priority = true,
}: {
  size?: number
  href?: string
  asLink?: boolean
  onClick?: () => void
  /**
   * `priority` mete un <link rel="preload"> en el <head>. Eso solo vale para un
   * logo que el SERVIDOR ya pinta: si el componente aparece únicamente tras
   * hidratar, el preload no está en el HTML servido, el <head> deja de coincidir
   * y React tira la cabecera entera y la reconstruye (error #418). Pasar `false`
   * en esos casos. Ver SignalIntro.
   */
  priority?: boolean
}) {
  const height = size
  const width = Math.round(size * FULL_RATIO)
  const content = (
    <Image
      src="/taka-logo.png"
      width={width}
      height={height}
      alt="TakaSports"
      priority={priority}
      style={{ width, height }}
    />
  )

  if (!asLink) return content

  return (
    <Link href={href} aria-label="TakaSports — inicio" style={{ display: 'inline-flex' }} onClick={onClick}>
      {content}
    </Link>
  )
}
