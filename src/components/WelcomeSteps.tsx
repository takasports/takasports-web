'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Bienvenida de TRES PASOS (f1-4) — espejo de lo que la app ya hacía.
//
// Antes: un único modal que abría de golpe una rejilla de ~100 escudos sin decir
// para qué servían, con los deportes como chips pequeños arriba del todo (fáciles
// de saltar) y el botón "Guardar" a ocho pantallas de scroll. Y al guardar no
// cambiaba nada visible: la portada seguía exactamente igual.
//
// Ahora: deportes → equipos → hecho. El paso 3 es la parte que no existía —
// enseña QUÉ acaba de cambiar y el botón lleva al bloque «Tu día» de la portada,
// que es el resultado de haber elegido.
//
// Reutiliza las piezas que ya había (POPULAR_TEAMS y TeamIcon de
// FavoritesOnboarding, useFollowedSports); no duplica catálogos.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from 'react'
import { FOLLOWABLE_SPORTS, useFollowedSports } from '@/lib/useFollowedSports'
import { SLUG_TO_LABEL } from '@/lib/sports'
import { SPORT_EMOJI } from '@/lib/rankings-ui'
import { POPULAR_TEAMS, TeamIcon } from '@/components/FavoritesOnboarding'
import { StarIcon } from '@/components/icons/GameIcons'

// Slug de deporte seguido → valor de `sport` en POPULAR_TEAMS, que usa etiquetas
// de competición y no slugs ('NBA' por baloncesto, 'MMA' no existe: es 'UFC').
// La lucha libre y el rugby no tienen equipos en el catálogo: quien solo elija
// esos ve la rejilla completa en vez de una pantalla vacía.
const SPORT_TO_TEAM_LABEL: Record<string, string> = {
  futbol: 'Fútbol', baloncesto: 'NBA', tenis: 'Tenis', ufc: 'UFC', formula1: 'F1',
}

const TOTAL = 3

/** Bandera de un solo uso: «al recargar, baja a Tu día». */
export const IR_A_TU_DIA = 'ts_ir_a_tu_dia'

export default function WelcomeSteps({
  onClose, onSave,
}: {
  onClose: () => void
  /** Persiste los equipos elegidos. NO cierra: el paso 3 va después. */
  onSave: (teams: string[]) => void
}) {
  const { sports: followedSports, toggle: toggleFollowedSport } = useFollowedSports()
  const [step, setStep] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('Todos')

  const modalRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Diálogo accesible: foco dentro, foco atrapado, Escape cierra y al salir se
  // devuelve el foco a quien lo abrió. Mismo contrato que FavoritesOnboarding.
  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null
    const node = modalRef.current
    const focusables = () =>
      Array.from(
        node?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter(el => !el.hasAttribute('disabled'))
    focusables()[0]?.focus()
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCloseRef.current(); return }
      if (e.key !== 'Tab') return
      const els = focusables()
      if (els.length === 0) return
      const firstEl = els[0]
      const lastEl = els[els.length - 1]
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus() }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      prevFocus?.focus?.()
    }
  }, [])

  // Al cambiar de paso, el contenido vuelve arriba (el paso 2 es largo).
  const bodyRef = useRef<HTMLDivElement>(null)
  useEffect(() => { bodyRef.current?.scrollTo({ top: 0 }) }, [step])

  // Equipos: solo de los deportes elegidos. Sin elección (o sin equipos para lo
  // elegido), el catálogo entero — nunca una pantalla en blanco.
  const teams = useMemo(() => {
    const labels = [...followedSports].map(s => SPORT_TO_TEAM_LABEL[s]).filter(Boolean)
    if (labels.length === 0) return POPULAR_TEAMS
    const filtrados = POPULAR_TEAMS.filter(t => labels.includes(t.sport))
    return filtrados.length > 0 ? filtrados : POPULAR_TEAMS
  }, [followedSports])

  const groups = useMemo(
    () => ['Todos', ...Array.from(new Set(teams.map(t => t.league ?? t.sport)))],
    [teams],
  )
  const visibleTeams = filter === 'Todos' ? teams : teams.filter(t => (t.league ?? t.sport) === filter)
  // Si el filtro activo ya no existe tras cambiar de deportes, vuelve a "Todos".
  useEffect(() => { if (!groups.includes(filter)) setFilter('Todos') }, [groups, filter])

  const toggleTeam = (name: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const deportesElegidos = [...followedSports]
    .map(s => SLUG_TO_LABEL[s] ?? s)
  const equiposElegidos = [...selected]

  const avanzar = () => {
    if (step === 1) onSave(equiposElegidos)   // se guarda ANTES de enseñar el resumen
    setStep(s => Math.min(s + 1, TOTAL - 1))
  }

  const terminar = () => {
    onClose()
    // Recarga la portada y baja a «Tu día». Sin recargar el usuario volvía a la
    // MISMA página de antes —que es justo lo que había que arreglar—: «Tu día»,
    // el orden del calendario y los deportes seguidos se leen del navegador al
    // montar, así que los componentes ya montados no se enteran de lo que se
    // acaba de elegir. La bandera la recoge WelcomeOnboarding al cargar.
    try { sessionStorage.setItem(IR_A_TU_DIA, '1') } catch { /* modo privado */ }
    window.location.assign('/')
  }

  const primaryLabel = step === TOTAL - 1 ? 'Ver lo mío →' : 'Siguiente →'

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-[199] backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.7)' }} />

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-steps-title"
        onClick={e => e.stopPropagation()}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[200] flex flex-col rounded-2xl w-[92vw] sm:w-[520px] max-h-[85vh]"
        style={{
          background: 'linear-gradient(135deg, rgba(20,20,30,0.97) 0%, rgba(15,15,22,0.99) 100%)',
          border: '1px solid rgba(124,58,237,0.3)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.8), 0 0 40px rgba(124,58,237,0.15)',
        }}
      >
        {/* Progreso + salida */}
        <div className="px-5 pt-4 pb-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5 flex-1" role="presentation">
              {Array.from({ length: TOTAL }).map((_, i) => (
                <span key={i} className="flex-1 rounded-full"
                  style={{ height: 3, background: i <= step ? '#8B5CF6' : 'rgba(255,255,255,0.09)', transition: 'background 200ms ease' }} />
              ))}
            </div>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 transition-all hover:brightness-125"
              style={{ background: 'rgba(255,255,255,0.06)' }}
              aria-label="Saltar la bienvenida"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="#9090A8" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <p className="text-[9.5px] font-black uppercase tracking-[0.18em] mt-3.5"
            style={{ color: '#9B7CF6', fontFamily: 'var(--font-sport)' }}>
            <StarIcon size={10} className="inline-block align-middle mr-1" />Paso {step + 1} de {TOTAL}
          </p>
          <h2 id="welcome-steps-title" className="font-black leading-[1.05] mt-1.5"
            style={{ fontFamily: 'var(--font-display)', fontSize: 27, color: '#F8F8FF', letterSpacing: '-0.02em' }}>
            {step === 0 ? '¿Qué deportes te apasionan?' : step === 1 ? '¿Y tus equipos?' : 'Listo'}
          </h2>
          <p className="text-[12.5px] mt-1.5 leading-snug" style={{ color: '#9090A4', fontFamily: 'var(--font-sport)' }}>
            {step === 0 && 'Ordenan tu portada, tu calendario y el Ranking. Puedes cambiarlo cuando quieras.'}
            {step === 1 && 'Sus partidos se te marcan en el calendario y suben en «Tu día».'}
            {step === 2 && 'Esto es lo que acaba de cambiar:'}
          </p>
        </div>

        {/* Cuerpo */}
        <div ref={bodyRef} className="px-5 pb-2 overflow-y-auto flex-1">

          {step === 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {FOLLOWABLE_SPORTS.map(slug => {
                const on = followedSports.has(slug)
                return (
                  <button
                    key={slug}
                    type="button"
                    onClick={() => toggleFollowedSport(slug)}
                    aria-pressed={on}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl text-[13.5px] font-bold transition-all"
                    style={{
                      background: on ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.035)',
                      color: on ? '#E0D0FF' : '#9090A4',
                      border: on ? '1px solid rgba(124,58,237,0.5)' : '1px solid rgba(255,255,255,0.08)',
                      fontFamily: 'var(--font-sport)', cursor: 'pointer',
                    }}
                  >
                    <span aria-hidden="true">{SPORT_EMOJI[slug] ?? '🏅'}</span>
                    {SLUG_TO_LABEL[slug] ?? slug}
                  </button>
                )
              })}
              <p className="text-[11px] w-full mt-1" style={{ color: '#5C5C6C', fontFamily: 'var(--font-sport)' }}>
                Sin ninguno marcado se ven todos.
              </p>
            </div>
          )}

          {step === 1 && (
            <>
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-3">
                {groups.map(g => (
                  <button
                    key={g}
                    onClick={() => setFilter(g)}
                    className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all flex-shrink-0"
                    style={{
                      background: filter === g ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.04)',
                      color: filter === g ? '#C4B5FD' : '#7A7A8E',
                      border: filter === g ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.06)',
                      fontFamily: 'var(--font-sport)', cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {visibleTeams.map(team => {
                  const active = selected.has(team.name)
                  return (
                    <button
                      key={team.name}
                      onClick={() => toggleTeam(team.name)}
                      aria-pressed={active}
                      className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-lg transition-all"
                      style={{
                        background: active ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.03)',
                        border: active ? '1px solid rgba(124,58,237,0.5)' : '1px solid rgba(255,255,255,0.06)',
                        cursor: 'pointer', minHeight: 76,
                      }}
                    >
                      <div className="flex items-center justify-center" style={{ width: 36, height: 36 }}>
                        <TeamIcon logo={team.logo} fallback={team.icon} name={team.name} active={active} />
                      </div>
                      <span className="text-[9.5px] font-black text-center leading-tight"
                        style={{ color: active ? '#E0D0FF' : '#C0C0D8', fontFamily: 'var(--font-sport)' }}>
                        {team.name}
                      </span>
                    </button>
                  )
                })}
              </div>
              <p className="text-[11px] mt-3" style={{ color: '#5C5C6C', fontFamily: 'var(--font-sport)' }}>
                {followedSports.size > 0
                  ? 'Solo se ofrecen equipos de los deportes que elegiste.'
                  : 'Puedes seguir sin elegir ninguno.'}
              </p>
            </>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-2.5 pt-1">
              <Resumen
                emoji="📰" titulo="Tu portada"
                texto={deportesElegidos.length > 0
                  ? `${listar(deportesElegidos)} primero en «Tu día» y en el calendario.`
                  : 'Sin deportes elegidos se sigue viendo todo, sin orden personal.'}
              />
              <Resumen
                emoji="👑" titulo="Tu Ranking"
                texto={deportesElegidos.length > 0
                  ? `Los podios de ${listar(deportesElegidos)}, arriba del todo.`
                  : 'Los podios salen en orden fijo, empezando por fútbol.'}
              />
              <Resumen
                emoji="🔔" titulo="Tus partidos"
                texto={equiposElegidos.length > 0
                  ? `${listar(equiposElegidos.slice(0, 3))}${equiposElegidos.length > 3 ? ` y ${equiposElegidos.length - 3} más` : ''} marcados en el calendario, con aviso opcional.`
                  : 'Aún no has elegido equipos: puedes hacerlo desde el calendario.'}
              />
              <p className="text-[11.5px] leading-snug rounded-xl px-3.5 py-3 mt-1"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: '#7A7A92', fontFamily: 'var(--font-sport)' }}>
                Sin cuenta se guarda en este navegador. Crea una cuenta gratis y te sigue en el móvil.
              </p>
            </div>
          )}
        </div>

        {/* Pie */}
        <div className="px-5 py-4 border-t flex items-center justify-between gap-3 flex-shrink-0"
          style={{ borderColor: 'rgba(124,58,237,0.15)' }}>
          <button
            onClick={step === 0 ? onClose : () => setStep(s => s - 1)}
            className="text-[10px] font-bold uppercase tracking-widest transition-opacity hover:opacity-70"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)', cursor: 'pointer' }}
          >
            {step === 0 ? 'Ahora no' : '‹ Atrás'}
          </button>
          <button
            onClick={step === TOTAL - 1 ? terminar : avanzar}
            className="px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all hover:brightness-125"
            style={{
              background: 'rgba(124,58,237,0.28)', color: '#EFE6FF',
              border: '1px solid rgba(124,58,237,0.55)',
              fontFamily: 'var(--font-sport)', cursor: 'pointer',
              boxShadow: '0 0 14px rgba(124,58,237,0.25)',
            }}
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </>
  )
}

function listar(xs: string[]): string {
  if (xs.length === 0) return ''
  if (xs.length === 1) return xs[0]
  return `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`
}

function Resumen({ emoji, titulo, texto }: { emoji: string; titulo: string; texto: string }) {
  return (
    <div className="flex gap-3 items-start rounded-xl px-3.5 py-3"
      style={{ background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.2)' }}>
      <span aria-hidden="true" style={{ fontSize: 19, lineHeight: 1.2 }}>{emoji}</span>
      <div>
        <p className="text-[13px] font-black" style={{ color: '#E4E4F0', fontFamily: 'var(--font-sport)' }}>{titulo}</p>
        <p className="text-[11.5px] leading-snug mt-0.5" style={{ color: '#7A7A92', fontFamily: 'var(--font-sport)' }}>{texto}</p>
      </div>
    </div>
  )
}
