// Página de "resultado compartible" de una jornada de La Porra.
//
// Slug encoding:
//   {jornadaSlug}-h{hits}-t{total}-w{totalWon}
// Ej.: "jornada-38-h6-t10-w120"
//
// La página en sí es ligera (no necesita datos de Supabase). El valor está
// en la opengraph-image que crawlers de WhatsApp/X leen para renderizar
// la tarjeta enriquecida con el resultado del user. El visitante humano
// que entra al link ve una landing que invita a "Probar tu suerte".

import type { Metadata } from 'next'
import Link from 'next/link'
import { parseResultSlug, formatJornadaFromSlug } from '@/lib/porra-result-slug'
import { SITE_URL } from '@/lib/constants'

interface Params { slug: string }

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>
}): Promise<Metadata> {
  const { slug } = await params
  const parsed = parseResultSlug(slug)
  const jornada = parsed?.jornadaSlug
    ? formatJornadaFromSlug(parsed.jornadaSlug)
    : 'Predicciones'
  const headline = parsed
    ? `${parsed.hits}/${parsed.total} aciertos · +${parsed.totalWon} pts`
    : 'Resultado de Predicciones'
  return {
    title: `${headline} — ${jornada}`,
    description: 'Compite gratis en las Predicciones de TakaSports.',
    // Páginas de "compartir resultado" (slug libre = thin content): noindex
    // pero follow, para no contaminar el índice con casi-duplicados.
    robots: { index: false, follow: true },
    // Self-canonical: sobrescribe el del layout padre que apunta a /predicciones
    alternates: { canonical: `${SITE_URL}/predicciones/resultado/${slug}` },
    openGraph: {
      title: `${headline} — ${jornada}`,
      description: 'Compite gratis en las Predicciones de TakaSports.',
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${headline} — ${jornada}`,
      description: 'Compite gratis en las Predicciones de TakaSports.',
    },
  }
}

export default async function ResultadoPage({
  params,
}: {
  params: Promise<Params>
}) {
  const { slug } = await params
  const parsed = parseResultSlug(slug)
  const jornada = parsed?.jornadaSlug
    ? formatJornadaFromSlug(parsed.jornadaSlug)
    : 'Predicciones'

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#09090F' }}>
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div
          className="w-full max-w-xl rounded-3xl p-8 sm:p-10 text-center"
          style={{
            background:
              'linear-gradient(135deg, rgba(124,58,237,0.18) 0%, rgba(124,58,237,0.06) 45%, rgba(249,115,22,0.16) 100%)',
            border: '1px solid rgba(124,58,237,0.32)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 32px rgba(124,58,237,0.18)',
          }}
        >
          <p
            className="mb-2"
            style={{
              fontFamily: 'var(--font-sport)', fontWeight: 900, fontSize: 12,
              color: '#C4B5FD', letterSpacing: '0.16em',
            }}
          >
            PREDICCIONES · {jornada.toUpperCase()}
          </p>
          {parsed ? (
            <>
              <p style={{
                fontFamily: 'var(--font-display, var(--font-sport))',
                fontWeight: 900, fontSize: 56, color: '#fff',
                lineHeight: 1, margin: '12px 0',
              }}>
                {parsed.hits}<span style={{ color: 'rgba(255,255,255,0.4)' }}>/{parsed.total}</span>
              </p>
              <p style={{
                fontFamily: 'var(--font-sport)', fontWeight: 800, fontSize: 18,
                color: '#F97316', letterSpacing: '0.04em',
              }}>
                +{parsed.totalWon} pts
              </p>
            </>
          ) : (
            <p style={{
              color: 'rgba(255,255,255,0.7)', fontSize: 16, margin: '20px 0',
            }}>
              Resultado de la última jornada.
            </p>
          )}
          <Link
            href="/predicciones"
            className="inline-block mt-8 px-7 py-3 rounded-xl"
            style={{
              background: 'linear-gradient(135deg, #7C3AED 0%, #F97316 100%)',
              border: '1px solid rgba(255,255,255,0.18)',
              color: '#fff',
              fontFamily: 'var(--font-sport)',
              fontWeight: 900, fontSize: 14,
              letterSpacing: '0.06em',
              textDecoration: 'none',
              boxShadow: '0 8px 24px rgba(124,58,237,0.4)',
            }}
          >
            JUGAR LA PRÓXIMA →
          </Link>
          <p className="mt-6" style={{
            fontSize: 11, color: 'rgba(255,255,255,0.4)',
            fontFamily: 'var(--font-sport)', letterSpacing: '0.04em',
          }}>
            Gratis · sin descargas
          </p>
        </div>
      </div>
    </div>
  )
}
