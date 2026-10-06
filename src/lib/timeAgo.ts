// `lang` es opcional: solo los reportajes con versión en inglés lo usan; para el
// resto de la web la función se comporta exactamente igual que antes.
export function timeAgo(dateStr?: string, lang?: string | null): string {
  if (!dateStr) return ''
  const then = new Date(dateStr)
  if (Number.isNaN(then.getTime())) return ''
  const diff = Math.floor((Date.now() - then.getTime()) / 1000)
  if (lang === 'en') {
    if (diff < 60)     return 'Just now'
    if (diff < 3600)   return `${Math.floor(diff / 60)} min ago`
    if (diff < 86400)  return `${Math.floor(diff / 3600)} h ago`
    if (diff < 172800) return 'Yesterday'
    if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`
    return then.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Madrid' })
  }
  if (diff < 60)     return 'Ahora mismo'
  if (diff < 3600)   return `Hace ${Math.floor(diff / 60)} min`
  if (diff < 86400)  return `Hace ${Math.floor(diff / 3600)} h`
  if (diff < 172800) return 'Ayer'
  if (diff < 604800) return `Hace ${Math.floor(diff / 86400)} días`
  // Fecha absoluta: incluye el año si NO es el año en curso (evita que una noticia
  // del año pasado parezca de este año, p.ej. "3 jul" vs "3 jul 2025").
  // Año calendario en Europe/Madrid (no en la zona del runtime; en Vercel es UTC).
  const madridYear = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric' }).format(d)
  const sameYear = madridYear(then) === madridYear(new Date())
  return then.toLocaleDateString('es-ES', sameYear
    ? { day: 'numeric', month: 'short', timeZone: 'Europe/Madrid' }
    : { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Madrid' })
}
