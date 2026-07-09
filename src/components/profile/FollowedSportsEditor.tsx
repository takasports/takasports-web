'use client'

// FASE 5 — Editor de "Mis deportes" en el Perfil. Los 7 deportes como chips que
// se activan/desactivan; el chip activo se tiñe con el COLOR DEL DEPORTE (variante
// aprobada por José Tomás). Elegir aquí personaliza el escaparate de Inicio y los
// Destacados del calendario. Funciona con y sin sesión (invitado en localStorage;
// con cuenta, useFollowedSports sincroniza `sport:<slug>`). Espejo de la app.

import { useFollowedSports, FOLLOWABLE_SPORTS } from '@/lib/useFollowedSports'
import { SLUG_TO_LABEL, accentForSport } from '@/lib/sports'
import { SportIcon } from '@/components/icons/GameIcons'

export default function FollowedSportsEditor() {
  const { sports, toggle } = useFollowedSports()

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <span className="section-accent" />
        <h2 className="section-label">Mis deportes</h2>
        <span className="ml-auto text-[11px] font-bold tabular-nums" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sport)' }}>
          {sports.size} / {FOLLOWABLE_SPORTS.length}
        </span>
      </div>
      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)', lineHeight: 1.5 }}>
        Elige tus deportes para personalizar tu Inicio y los Destacados del calendario.
      </p>
      <div className="flex flex-wrap gap-2">
        {FOLLOWABLE_SPORTS.map((slug) => {
          const on = sports.has(slug)
          const accent = accentForSport(slug, '#A78BFA')
          return (
            <button
              key={slug}
              type="button"
              onClick={() => toggle(slug)}
              aria-pressed={on}
              aria-label={SLUG_TO_LABEL[slug] ?? slug}
              className="inline-flex items-center gap-1.5 rounded-full text-[13px] font-bold px-3 py-2 transition-all"
              style={{
                background: on ? `${accent}26` : 'rgba(255,255,255,0.04)',
                color: on ? accent : '#9090A4',
                border: on ? `1px solid ${accent}6B` : '1px solid rgba(255,255,255,0.08)',
                fontFamily: 'var(--font-sport)',
                cursor: 'pointer',
              }}
            >
              <span className="inline-flex" style={{ color: on ? accent : '#8A8AA0' }} aria-hidden>
                <SportIcon sport={slug} size={15} />
              </span>
              {SLUG_TO_LABEL[slug] ?? slug}
            </button>
          )
        })}
      </div>
    </section>
  )
}
