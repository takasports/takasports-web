// Redirect permanente: /quiniela → /predicciones
// Preserva SEO (301) y mantiene compatibilidad con enlaces externos.
import { redirect } from 'next/navigation'

export default function QuinielaPage() {
  redirect('/predicciones')
}
