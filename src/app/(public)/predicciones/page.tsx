import PrediccionesHub from './PrediccionesHub'
import BreadcrumbJsonLd from '@/components/BreadcrumbJsonLd'

export default function PrediccionesPage() {
  return (
    <>
      <BreadcrumbJsonLd items={[{ name: 'TakaSports', path: '' }, { name: 'Predicciones', path: '/predicciones' }]} />
      {/* H1 server-rendered para SEO: el hub es un componente cliente y no
          emitía ningún H1 en el HTML que ve Google. (Fix M1 SEO) */}
      <h1 className="sr-only">Predicciones deportivas — Ranked y Mundial 2026</h1>
      <PrediccionesHub />
    </>
  )
}
