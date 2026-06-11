import Header from '@/components/Header'
import Footer from '@/components/Footer'

// Layout del grupo (public): centraliza el armazón universal (Header + Footer)
// que hoy se monta a mano en decenas de páginas. El root layout solo aporta
// <html>/<body> + providers; aquí va el shell + el <main id="main"> semántico
// (destino del skip-link). LiveStrip y BreakingNewsBar NO van aquí: son
// específicos de página (solo algunas los muestran) y se quedan en su contenido.
//
// Las páginas dentro de (public)/ NO deben montar su propio Header/Footer ni el
// <div bg-base> envolvente: lo provee este layout.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <a href="#main" className="skip-link">Saltar al contenido</a>
      <Header />
      <main id="main">{children}</main>
      <Footer />
    </div>
  )
}
