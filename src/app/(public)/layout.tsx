import HeaderConsole from '@/components/HeaderConsole'
import Footer from '@/components/Footer'

// Layout del grupo (public): centraliza el armazón universal que antes se
// montaba a mano en decenas de páginas. El root layout solo aporta <html>/<body>
// + providers; aquí va la consola "La Señal" (HeaderConsole = Header + LiveStrip
// sticky como bloque único) + el <main id="main"> semántico (destino del
// skip-link) + Footer. El LiveStrip vive AQUÍ (en la consola) en vez de en el
// contenido de cada página, para que el directo no se pierda al hacer scroll.
//
// BreakingNewsBar sigue siendo por-página (solo /noticias lo muestra).
// Las páginas dentro de (public)/ NO deben montar su propio Header/Footer/
// LiveStrip ni el <div bg-base> envolvente: lo provee este layout.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <a href="#main" className="skip-link">Saltar al contenido</a>
      <HeaderConsole />
      <main id="main">{children}</main>
      <Footer />
    </div>
  )
}
