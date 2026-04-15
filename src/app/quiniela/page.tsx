import type { Metadata } from 'next'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import QuinielaModule from '@/components/QuinielaModule'

export const metadata: Metadata = {
  title: 'Quiniela — TakaSports',
  description: 'Haz tus predicciones deportivas cada jornada en TakaSports.',
}

const STATS = [
  { value: '2.4K', label: 'participantes' },
  { value: '87%', label: 'participación' },
  { value: 'Jor. 38', label: 'jornada activa' },
]

export default function QuinielaPage() {
  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <Header />

      <main className="max-w-[1440px] mx-auto px-6 xl:px-10 pb-20">

        {/* Page header */}
        <div className="pt-8 pb-6">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="section-accent" />
            <h1
              className="font-black"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(1.6rem, 3vw, 2.4rem)',
                color: '#F8F8FF',
                letterSpacing: '-0.01em',
              }}
            >
              Quiniela
            </h1>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-muted)', marginLeft: 20 }}>
            Predice los resultados de cada jornada y compite con la comunidad.
          </p>
        </div>

        {/* Stats row */}
        <div className="flex gap-4 mb-8 flex-wrap">
          {STATS.map(({ value, label }) => (
            <div
              key={label}
              className="flex-1 min-w-[120px] rounded-2xl px-5 py-4"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <p
                className="font-black mb-0.5"
                style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: '#C4B5FD', letterSpacing: '-0.01em' }}
              >
                {value}
              </p>
              <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* Two-column layout */}
        <div className="flex gap-8 items-start">

          {/* Quiniela principal */}
          <div className="flex-1 min-w-0 max-w-lg">
            <QuinielaModule />

            {/* Reglas */}
            <div
              className="mt-6 rounded-2xl px-5 py-5"
              style={{ background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.1)' }}
            >
              <h3
                className="text-xs font-black uppercase tracking-widest mb-3"
                style={{ color: '#9B7CF6', fontFamily: 'var(--font-sport)' }}
              >
                Cómo funciona
              </h3>
              <ul className="flex flex-col gap-2">
                {[
                  'Elige 1 (local), X (empate) o 2 (visitante) para cada partido.',
                  'Cierra antes del comienzo de la primera jornada del bloque.',
                  'Acumula puntos por cada acierto.',
                  'El ranking se publica al final de cada jornada.',
                ].map((rule, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span
                      className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black mt-0.5"
                      style={{ background: 'rgba(124,58,237,0.15)', color: '#9B7CF6' }}
                    >
                      {i + 1}
                    </span>
                    {rule}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Sidebar — ranking provisional */}
          <div className="w-72 xl:w-80 flex-shrink-0 hidden lg:block">
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              {/* Header */}
              <div
                className="px-4 py-3"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <div className="flex items-center gap-2">
                  <span className="section-accent" />
                  <h2 className="section-label">Ranking · Jornada 37</h2>
                </div>
              </div>

              {/* Entries */}
              <div className="px-4 py-3 flex flex-col gap-1.5">
                {[
                  { pos: 1, name: 'SportFan99', pts: 14, medal: '🥇' },
                  { pos: 2, name: 'GolGolGol', pts: 13, medal: '🥈' },
                  { pos: 3, name: 'ElAnalista', pts: 12, medal: '🥉' },
                  { pos: 4, name: 'TakaUser42', pts: 11, medal: null },
                  { pos: 5, name: 'PronóBlanco', pts: 10, medal: null },
                ].map(({ pos, name, pts, medal }) => (
                  <div
                    key={pos}
                    className="flex items-center gap-3 py-2 px-3 rounded-xl"
                    style={{ background: pos === 1 ? 'rgba(124,58,237,0.08)' : 'transparent' }}
                  >
                    <span
                      className="text-xs font-black w-5 text-center flex-shrink-0"
                      style={{ color: pos <= 3 ? '#C4B5FD' : '#4A4A5A', fontFamily: 'var(--font-sport)' }}
                    >
                      {medal ?? pos}
                    </span>
                    <span className="flex-1 text-xs font-semibold truncate" style={{ color: '#C0C0D8' }}>
                      {name}
                    </span>
                    <span
                      className="text-xs font-black flex-shrink-0"
                      style={{ color: pos === 1 ? '#A78BFA' : '#5A5A6A', fontFamily: 'var(--font-sport)' }}
                    >
                      {pts}pts
                    </span>
                  </div>
                ))}
              </div>

              <div className="px-4 pb-4">
                <p className="text-[10px] text-center" style={{ color: '#3A3A4A' }}>
                  Ranking provisional · datos de prueba
                </p>
              </div>
            </div>

            {/* Próximas jornadas */}
            <div
              className="mt-4 rounded-2xl px-4 py-4"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="section-accent" />
                <h2 className="section-label">Próximas quinielas</h2>
              </div>
              {['Jornada 39 · LaLiga', 'Playoffs · NBA', 'Roland Garros · Semis'].map((q) => (
                <div
                  key={q}
                  className="flex items-center gap-2 py-2 text-xs"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#5A5A6A' }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <circle cx="5" cy="5" r="4" stroke="#7C3AED" strokeWidth="1" opacity="0.4" />
                  </svg>
                  {q}
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  )
}
