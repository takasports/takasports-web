// Sección de newsletter al final de las páginas clave.
// Diseño de dos columnas en desktop: copy izquierda, formulario derecha.
// Se apoya en NewsletterForm (client) para la lógica de suscripción.

import NewsletterForm from './NewsletterForm'

interface Props {
  source?: string   // analytics source tag: 'home' | 'noticias' | 'estadisticas' | etc.
}

export default function NewsletterSection({ source = 'page' }: Props) {
  return (
    <section
      aria-label="Suscríbete a la newsletter de TakaSports"
      className="relative w-full overflow-hidden"
      style={{ margin: 'clamp(3rem,8vw,6rem) 0 0' }}
    >
      {/* Background con glow morado */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(9,9,15,0) 60%)',
        }}
      />
      <div
        className="absolute -top-24 -left-24 w-96 h-96 blur-[120px] pointer-events-none"
        style={{ background: 'rgba(124,58,237,0.12)', borderRadius: '50%' }}
      />

      <div
        className="relative z-10 mx-auto max-w-[1440px] px-4 sm:px-6 xl:px-10 py-14 sm:py-16"
        style={{
          borderTop: '1px solid rgba(124,58,237,0.15)',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-10 lg:gap-16">

          {/* ── Copy ────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            <p
              className="text-[10px] font-black uppercase tracking-[0.25em] mb-3"
              style={{ color: '#7C3AED', fontFamily: 'var(--font-sport)' }}
            >
              Newsletter · Gratis
            </p>
            <h2
              className="font-black leading-[1.05] mb-4"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(1.7rem, 3.5vw, 2.6rem)',
                color: '#F8F8FF',
                letterSpacing: '-0.03em',
              }}
            >
              <span style={{ color: '#F8F8FF' }}>El deporte que importa,</span>
              <br />
              <span style={{ color: '#A78BFA' }}>sin ruido.</span>
            </h2>
            <p
              className="text-[13px] leading-relaxed mb-5"
              style={{ color: 'var(--text-muted)', maxWidth: 440 }}
            >
              Resultados, análisis y lo mejor de la jornada directo a tu bandeja.
              Sin spam, solo deporte.
            </p>

            {/* Beneficios */}
            <ul className="flex flex-col gap-2">
              {[
                { icon: '⚽', text: 'Resumen de fútbol, NBA, F1, UFC y más' },
                { icon: '📊', text: 'Estadísticas y rankings semanales' },
                { icon: '🎮', text: 'Acceso anticipado a nuevos juegos y funciones' },
              ].map(({ icon, text }) => (
                <li key={text} className="flex items-center gap-2.5">
                  <span className="text-sm leading-none">{icon}</span>
                  <span
                    className="text-[12px]"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {text}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Form ────────────────────────────────────────────── */}
          <div
            className="w-full lg:w-auto lg:min-w-[400px] xl:min-w-[460px] rounded-2xl p-6 sm:p-8"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(124,58,237,0.18)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <p
              className="text-sm font-black mb-5"
              style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)' }}
            >
              Únete a la comunidad Taka
            </p>
            <NewsletterForm source={source} variant="stacked" />
          </div>

        </div>
      </div>
    </section>
  )
}
