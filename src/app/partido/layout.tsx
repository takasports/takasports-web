// Layout de paso, a propósito. Sin él, el notFound() que lanza el layout de
// [ref] no lo recoge el not-found.tsx de esta carpeta (sale el 404 genérico de
// la raíz): Next solo monta aquí esa frontera si el segmento tiene layout.
export default function PartidoSeccionLayout({ children }: { children: React.ReactNode }) {
  return children
}
