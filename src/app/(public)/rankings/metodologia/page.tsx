import Link from 'next/link'
import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Metodología · Índice Taka',
  description: 'Cómo se calcula el Índice Taka — factores, pesos por deporte, capa editorial y reglas de actualización.',
  alternates: { canonical: `${SITE_URL}/rankings/metodologia` },
}

export default function MetodologiaPage() {
  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh', padding: '32px 16px 80px' }}>
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
          <p className="mt-4">Para <strong>creadores y periodistas</strong> aplicamos un criterio
          paralelo, centrado en su oficio y no en resultados deportivos:</p>
          <ul className="space-y-2 mt-3">
            <Factor name="Audiencia" pct="50%" desc="Seguidores y suscriptores totales, ponderados por plataforma (YouTube, Instagram, TikTok, Twitch, X)." />
            <Factor name="Contenido" pct="30%" desc="Calidad, frecuencia y engagement de lo que publican." />
            <Factor name="Momento" pct="15%" desc="Crecimiento, viralidad reciente y relevancia en el debate actual." />
            <Factor name="Profundidad" pct="5%" desc="Nivel de análisis y conocimiento del deporte que cubren." />
          </ul>
          <p className="mt-3 text-[11px]" style={{ color: '#5A5A72' }}>
            Índice de Contenido = (Aud × 0.50) + (Cont × 0.30) + (Mom × 0.15) + (Prof × 0.05)
          </p>
        </Section>

        <Section title="2. Comparabilidad entre deportes">
          <p>El score se calcula con la <strong>misma fórmula</strong> en todos los deportes — no aplicamos pesos ni boosts
          artificiales. Una estrella de la NBA y un futbolista compiten por la misma escala 40-99.</p>
          <p className="mt-3">Eso significa que el top global está dominado por fútbol, porque tenemos
          ~3.000 futbolistas activos contra ~20 pilotos de F1. No es injusticia — es la realidad
          mediática del deporte hispanohablante. Para ver la diversidad real, usa
          <Link href="/rankings/todos" style={{ color: '#7C3AED' }}> Reyes del deporte hispano </Link>
          (el #1 de cada disciplina) o filtra por deporte en el Índice principal.</p>
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
            <li>• <strong>Domingo 23:15</strong> — NBA, F1, UFC y clubes (WF-12)</li>
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
    </div>
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
