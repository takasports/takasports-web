export function timeAgo(dateStr?: string): string {
  if (!dateStr) return ''
  const then = new Date(dateStr)
  if (Number.isNaN(then.getTime())) return ''
  const diff = Math.floor((Date.now() - then.getTime()) / 1000)
  if (diff < 60)     return 'Ahora mismo'
  if (diff < 3600)   return `Hace ${Math.floor(diff / 60)} min`
  if (diff < 86400)  return `Hace ${Math.floor(diff / 3600)} h`
  if (diff < 172800) return 'Ayer'
  if (diff < 604800) return `Hace ${Math.floor(diff / 86400)} días`
  // Fecha absoluta: incluye el año si NO es el año en curso (evita que una noticia
  // del año pasado parezca de este año, p.ej. "3 jul" vs "3 jul 2025").
  const sameYear = then.getFullYear() === new Date().getFullYear()
  return then.toLocaleDateString('es-ES', sameYear
    ? { day: 'numeric', month: 'short' }
    : { day: 'numeric', month: 'short', year: 'numeric' })
}
