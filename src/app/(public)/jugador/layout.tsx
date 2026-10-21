// Layout de paso, a propósito. Sin él, el notFound() que lanza el layout de
// [slug] no lo recoge el not-found.tsx de esta carpeta (sale el 404 genérico de
// la raíz): Next solo monta aquí esa frontera si el segmento tiene layout.
export default function JugadorSeccionLayout({ children }: { children: React.ReactNode }) {
  return children
}
