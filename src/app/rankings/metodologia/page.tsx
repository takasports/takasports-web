import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Metodología · Índice Taka',
  description: 'Cómo se calcula el Índice Taka — factores, pesos por deporte, capa editorial y reglas de actualización.',
}

export default function MetodologiaPage() {
  return (
    <main style={{ background: 'var(--bg-base)', minHeight: '100vh', padding: '32px 16px 80px' }}>
      <div className="max-w-3xl mx-auto">
        <Link href="/rankings"
          className="inline-block text-[10px] font-black uppercase tracking-[0.2em] mb-3"
          style={{ color: '#7C3AED', fontFamily: 'var(--font-sport)' }}>
          ← Volver al Índice
        </Link>

        <h1 className="text-3xl font-black mb-2"
          style={{ color: '#E8E8F0', fontFamily: 'var(--font-display)' }}>
          Cómo calculamos el <span style={{ color: '#7C3AED' }}>Índice Taka</span>
        </h1>
        <p className="text-sm mb-8 leading-relaxed"
          style={{ color: '#8E8E9E', fontFamily: 'var(--font-sport)' }}>
          El Índice Taka mide la relevancia de cada deportista, club, creador o periodista en el panorama deportivo
          hispanohablante. Combina datos objetivos (ESPN, Jolpica, redes sociales) con criterio editorial para
          casos donde los números no cuentan toda la historia.
        </p>

        <Section title="1. Los cuatro factores">
          <p>Cada entry se mide en una escala 40-99 sobre cuatro pilares:</p>
          <ul className="space-y-2 mt-3">
            <Factor name="Rendimiento" pct="40%" desc="Resultados deportivos reales: goles, asistencias, victorias, puntos, KOs, títulos." />
            <Factor name="Contexto" pct="20%" desc="Posición del equipo, fase del campeonato, dificultad del rival." />
            <Factor name="Mediático" pct="25%" desc="Presencia social, seguidores, apariciones, debate público." />
            <Factor name="Narrativa" pct="15%" desc="Historia detrás del deportista — joven promesa, regreso, derrota épica." />
          </ul>
          <p className="mt-3 text-[11px]" style={{ color: '#5A5A72' }}>
            Score = (Rend × 0.40) + (Ctx × 0.20) + (Med × 0.25) + (Narr × 0.15)
          </p>
        </Section>

        <Section title="2. Peso por deporte">
          <p>El ranking <strong>global</strong> aplica un peso por deporte para que el #1 mundial no sea siempre un piloto
          de F1 (donde solo hay 20 puestos) sobre una estrella del fútbol. El score visible no cambia — solo la posición global.</p>
          <table className="w-full mt-3 text-xs" style={{ fontFamily: 'var(--font-sport)' }}>
            <thead><tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <th className="text-left py-1.5" style={{ color: '#5A5A72' }}>Deporte</th>
              <th className="text-right py-1.5" style={{ color: '#5A5A72' }}>Peso</th>
            </tr></thead>
            <tbody>
              {[
                ['Fútbol', '1.00'], ['Baloncesto', '0.95'], ['Tenis', '0.93'],
                ['MotoGP', '0.90'], ['Fórmula 1', '0.88'],
                ['UFC / Boxeo / Béisbol / NFL / Atletismo', '0.85'],
                ['WWE / Pádel / Ciclismo', '0.82'], ['Golf', '0.80'],
              ].map(([s, p]) => (
                <tr key={s} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td className="py-1.5" style={{ color: '#D0D0E0' }}>{s}</td>
                  <td className="text-right py-1.5 tabular-nums" style={{ color: '#C4B5FD' }}>{p}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="3. Capa automática + capa editorial">
          <p>Cada domingo, un proceso automático recalcula el score de deportistas y clubes con datos reales de ESPN,
          Jolpica (F1) y stats individuales. Para creadores, periodistas y casos especiales, el equipo editorial de Taka
          ajusta a mano.</p>
          <ul className="mt-3 space-y-1">
            <li><span style={{ color: '#C4B5FD' }}>🤖 score_auto</span> — calculado por cron.</li>
            <li><span style={{ color: '#C4B5FD' }}>✏️ score_manual</span> — override editorial. Pisa al automático.</li>
            <li><span style={{ color: '#C4B5FD' }}>🔒 editorial_locked</span> — el cron jamás toca esa entry.</li>
          </ul>
        </Section>

        <Section title="4. Tendencia semanal">
          <p>El indicador <span style={{ color: '#22c55e' }}>↑</span>/<span style={{ color: '#f87171' }}>↓</span> compara
          el score actual con el de la semana anterior. Una variación de ±1 punto es un movimiento real;
          ±0.5 ya es notable en el bloque alto del ranking.</p>
        </Section>

        <Section title="5. Cuándo se actualiza">
          <ul className="space-y-1">
            <li>• <strong>Domingo 22:00</strong> — ligas europeas + tenis (WF-11)</li>
            <li>• <strong>Domingo 23:15</strong> — NBA, F1, UFC, clubes, entrenadores (WF-12)</li>
            <li>• Creadores y periodistas — overrides editoriales en tiempo real desde el admin.</li>
          </ul>
        </Section>

        <Section title="6. Fuentes">
          <ul className="space-y-1 text-[11px]" style={{ color: '#8E8E9E' }}>
            <li>• ESPN API (rosters, stats individuales, standings)</li>
            <li>• Jolpica F1 (clasificación pilotos)</li>
            <li>• TheSportsDB + Wikipedia (fotos de deportistas)</li>
            <li>• YouTube Data API + redes públicas (métricas de creadores)</li>
          </ul>
        </Section>

        <p className="text-[11px] mt-10 text-center" style={{ color: '#4A4A5A', fontFamily: 'var(--font-sport)' }}>
          ¿Crees que un score está mal? Escríbenos a <a href="mailto:contacto@takasportsmedia.com" style={{ color: '#7C3AED' }}>contacto@takasportsmedia.com</a> y lo revisamos.
        </p>
      </div>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-base font-black mb-3"
        style={{ color: '#E8E8F0', fontFamily: 'var(--font-display)' }}>{title}</h2>
      <div className="text-sm leading-relaxed" style={{ color: '#B0B0C0', fontFamily: 'var(--font-sport)' }}>
        {children}
      </div>
    </section>
  )
}

function Factor({ name, pct, desc }: { name: string; pct: string; desc: string }) {
  return (
    <li className="flex items-baseline gap-3 text-sm" style={{ color: '#B0B0C0', fontFamily: 'var(--font-sport)' }}>
      <span className="font-black text-xs tabular-nums w-12 flex-shrink-0" style={{ color: '#C4B5FD' }}>{pct}</span>
      <span><strong style={{ color: '#E8E8F0' }}>{name}.</strong> {desc}</span>
    </li>
  )
}
