'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { StarIcon } from '@/components/icons/GameIcons'

// Logos vía ESPN CDN (escudos para equipos, headshots para individuales).
// Fallback al icono emoji si la imagen falla en runtime.
const ESPN_SOCCER = (id: number) => `https://a.espncdn.com/i/teamlogos/soccer/500/${id}.png`
const ESPN_NBA = (abbr: string) => `https://a.espncdn.com/i/teamlogos/nba/500/${abbr}.png`

// Curated list of popular teams/athletes per sport. Names match what appears in the
// SportEvent.home/away strings from ESPN/Sanity data.
const POPULAR_TEAMS: { name: string; sport: string; league?: string; icon: string; logo?: string }[] = [
  // ⚽ LaLiga
  { name: 'Barcelona', sport: 'Fútbol', league: 'LaLiga', icon: '🔵', logo: ESPN_SOCCER(83) },
  { name: 'Real Madrid', sport: 'Fútbol', league: 'LaLiga', icon: '⚪', logo: ESPN_SOCCER(86) },
  { name: 'Villarreal', sport: 'Fútbol', league: 'LaLiga', icon: '⚽', logo: ESPN_SOCCER(102) },
  { name: 'Atlético Madrid', sport: 'Fútbol', league: 'LaLiga', icon: '🔴', logo: ESPN_SOCCER(1068) },
  { name: 'Real Betis', sport: 'Fútbol', league: 'LaLiga', icon: '⚽', logo: ESPN_SOCCER(244) },
  { name: 'Celta Vigo', sport: 'Fútbol', league: 'LaLiga', icon: '⚽', logo: ESPN_SOCCER(85) },
  { name: 'Getafe', sport: 'Fútbol', league: 'LaLiga', icon: '⚽', logo: ESPN_SOCCER(2922) },
  { name: 'Rayo Vallecano', sport: 'Fútbol', league: 'LaLiga', icon: '⚽', logo: ESPN_SOCCER(101) },
  { name: 'Valencia', sport: 'Fútbol', league: 'LaLiga', icon: '⚽', logo: ESPN_SOCCER(94) },
  { name: 'Real Sociedad', sport: 'Fútbol', league: 'LaLiga', icon: '⚽', logo: ESPN_SOCCER(89) },
  { name: 'Espanyol', sport: 'Fútbol', league: 'LaLiga', icon: '⚽', logo: ESPN_SOCCER(88) },
  { name: 'Athletic Club', sport: 'Fútbol', league: 'LaLiga', icon: '⚽', logo: ESPN_SOCCER(93) },
  { name: 'Sevilla', sport: 'Fútbol', league: 'LaLiga', icon: '⚽', logo: ESPN_SOCCER(243) },
  { name: 'Alavés', sport: 'Fútbol', league: 'LaLiga', icon: '⚽', logo: ESPN_SOCCER(96) },
  { name: 'Elche', sport: 'Fútbol', league: 'LaLiga', icon: '⚽', logo: ESPN_SOCCER(3751) },
  { name: 'Levante', sport: 'Fútbol', league: 'LaLiga', icon: '⚽', logo: ESPN_SOCCER(1538) },
  { name: 'Osasuna', sport: 'Fútbol', league: 'LaLiga', icon: '⚽', logo: ESPN_SOCCER(97) },
  { name: 'Mallorca', sport: 'Fútbol', league: 'LaLiga', icon: '⚽', logo: ESPN_SOCCER(84) },
  { name: 'Girona', sport: 'Fútbol', league: 'LaLiga', icon: '⚽', logo: ESPN_SOCCER(9812) },
  { name: 'Real Oviedo', sport: 'Fútbol', league: 'LaLiga', icon: '⚽', logo: ESPN_SOCCER(92) },
  // ⚽ Premier
  { name: 'Arsenal', sport: 'Fútbol', league: 'Premier', icon: '🔴', logo: ESPN_SOCCER(359) },
  { name: 'Manchester City', sport: 'Fútbol', league: 'Premier', icon: '🩵', logo: ESPN_SOCCER(382) },
  { name: 'Manchester United', sport: 'Fútbol', league: 'Premier', icon: '🔴', logo: ESPN_SOCCER(360) },
  { name: 'Aston Villa', sport: 'Fútbol', league: 'Premier', icon: '⚽', logo: ESPN_SOCCER(362) },
  { name: 'Liverpool', sport: 'Fútbol', league: 'Premier', icon: '🔴', logo: ESPN_SOCCER(364) },
  { name: 'Bournemouth', sport: 'Fútbol', league: 'Premier', icon: '⚽', logo: ESPN_SOCCER(349) },
  { name: 'Sunderland', sport: 'Fútbol', league: 'Premier', icon: '⚽', logo: ESPN_SOCCER(366) },
  { name: 'Brighton', sport: 'Fútbol', league: 'Premier', icon: '⚽', logo: ESPN_SOCCER(331) },
  { name: 'Brentford', sport: 'Fútbol', league: 'Premier', icon: '⚽', logo: ESPN_SOCCER(337) },
  { name: 'Chelsea', sport: 'Fútbol', league: 'Premier', icon: '🔵', logo: ESPN_SOCCER(363) },
  { name: 'Fulham', sport: 'Fútbol', league: 'Premier', icon: '⚽', logo: ESPN_SOCCER(370) },
  { name: 'Newcastle United', sport: 'Fútbol', league: 'Premier', icon: '⚽', logo: ESPN_SOCCER(361) },
  { name: 'Everton', sport: 'Fútbol', league: 'Premier', icon: '⚽', logo: ESPN_SOCCER(368) },
  { name: 'Leeds United', sport: 'Fútbol', league: 'Premier', icon: '⚽', logo: ESPN_SOCCER(357) },
  { name: 'Crystal Palace', sport: 'Fútbol', league: 'Premier', icon: '⚽', logo: ESPN_SOCCER(384) },
  { name: 'Nottingham Forest', sport: 'Fútbol', league: 'Premier', icon: '⚽', logo: ESPN_SOCCER(393) },
  { name: 'Tottenham', sport: 'Fútbol', league: 'Premier', icon: '⚽', logo: ESPN_SOCCER(367) },
  { name: 'West Ham', sport: 'Fútbol', league: 'Premier', icon: '⚽', logo: ESPN_SOCCER(371) },
  { name: 'Burnley', sport: 'Fútbol', league: 'Premier', icon: '⚽', logo: ESPN_SOCCER(379) },
  { name: 'Wolverhampton', sport: 'Fútbol', league: 'Premier', icon: '⚽', logo: ESPN_SOCCER(380) },
  // ⚽ Serie A
  { name: 'Inter', sport: 'Fútbol', league: 'Serie A', icon: '🔵', logo: ESPN_SOCCER(110) },
  { name: 'Napoli', sport: 'Fútbol', league: 'Serie A', icon: '⚽', logo: ESPN_SOCCER(114) },
  { name: 'Roma', sport: 'Fútbol', league: 'Serie A', icon: '⚽', logo: ESPN_SOCCER(104) },
  { name: 'Como', sport: 'Fútbol', league: 'Serie A', icon: '⚽', logo: ESPN_SOCCER(2572) },
  { name: 'AC Milan', sport: 'Fútbol', league: 'Serie A', icon: '⚽', logo: ESPN_SOCCER(103) },
  { name: 'Juventus', sport: 'Fútbol', league: 'Serie A', icon: '⚫', logo: ESPN_SOCCER(111) },
  { name: 'Atalanta', sport: 'Fútbol', league: 'Serie A', icon: '⚽', logo: ESPN_SOCCER(105) },
  { name: 'Bologna', sport: 'Fútbol', league: 'Serie A', icon: '⚽', logo: ESPN_SOCCER(107) },
  { name: 'Lazio', sport: 'Fútbol', league: 'Serie A', icon: '⚽', logo: ESPN_SOCCER(112) },
  { name: 'Udinese', sport: 'Fútbol', league: 'Serie A', icon: '⚽', logo: ESPN_SOCCER(118) },
  { name: 'Sassuolo', sport: 'Fútbol', league: 'Serie A', icon: '⚽', logo: ESPN_SOCCER(3997) },
  { name: 'Torino', sport: 'Fútbol', league: 'Serie A', icon: '⚽', logo: ESPN_SOCCER(239) },
  { name: 'Parma', sport: 'Fútbol', league: 'Serie A', icon: '⚽', logo: ESPN_SOCCER(115) },
  { name: 'Cagliari', sport: 'Fútbol', league: 'Serie A', icon: '⚽', logo: ESPN_SOCCER(2925) },
  { name: 'Fiorentina', sport: 'Fútbol', league: 'Serie A', icon: '⚽', logo: ESPN_SOCCER(109) },
  { name: 'Genoa', sport: 'Fútbol', league: 'Serie A', icon: '⚽', logo: ESPN_SOCCER(3263) },
  { name: 'Lecce', sport: 'Fútbol', league: 'Serie A', icon: '⚽', logo: ESPN_SOCCER(113) },
  { name: 'Cremonese', sport: 'Fútbol', league: 'Serie A', icon: '⚽', logo: ESPN_SOCCER(4050) },
  { name: 'Verona', sport: 'Fútbol', league: 'Serie A', icon: '⚽', logo: ESPN_SOCCER(119) },
  { name: 'Pisa', sport: 'Fútbol', league: 'Serie A', icon: '⚽', logo: ESPN_SOCCER(3956) },
  // ⚽ Bundesliga
  { name: 'Bayern', sport: 'Fútbol', league: 'Bundesliga', icon: '🔴', logo: ESPN_SOCCER(132) },
  { name: 'Dortmund', sport: 'Fútbol', league: 'Bundesliga', icon: '⚽', logo: ESPN_SOCCER(124) },
  { name: 'RB Leipzig', sport: 'Fútbol', league: 'Bundesliga', icon: '⚽', logo: ESPN_SOCCER(11420) },
  { name: 'Stuttgart', sport: 'Fútbol', league: 'Bundesliga', icon: '⚽', logo: ESPN_SOCCER(134) },
  { name: 'Hoffenheim', sport: 'Fútbol', league: 'Bundesliga', icon: '⚽', logo: ESPN_SOCCER(7911) },
  { name: 'Leverkusen', sport: 'Fútbol', league: 'Bundesliga', icon: '⚽', logo: ESPN_SOCCER(131) },
  { name: 'Freiburg', sport: 'Fútbol', league: 'Bundesliga', icon: '⚽', logo: ESPN_SOCCER(126) },
  { name: 'Frankfurt', sport: 'Fútbol', league: 'Bundesliga', icon: '⚽', logo: ESPN_SOCCER(125) },
  { name: 'Augsburg', sport: 'Fútbol', league: 'Bundesliga', icon: '⚽', logo: ESPN_SOCCER(3841) },
  { name: 'Mainz', sport: 'Fútbol', league: 'Bundesliga', icon: '⚽', logo: ESPN_SOCCER(2950) },
  { name: 'Union Berlin', sport: 'Fútbol', league: 'Bundesliga', icon: '⚽', logo: ESPN_SOCCER(598) },
  { name: 'Gladbach', sport: 'Fútbol', league: 'Bundesliga', icon: '⚽', logo: ESPN_SOCCER(268) },
  { name: 'Hamburg', sport: 'Fútbol', league: 'Bundesliga', icon: '⚽', logo: ESPN_SOCCER(127) },
  { name: 'Cologne', sport: 'Fútbol', league: 'Bundesliga', icon: '⚽', logo: ESPN_SOCCER(122) },
  { name: 'Werder Bremen', sport: 'Fútbol', league: 'Bundesliga', icon: '⚽', logo: ESPN_SOCCER(137) },
  { name: 'Wolfsburg', sport: 'Fútbol', league: 'Bundesliga', icon: '⚽', logo: ESPN_SOCCER(138) },
  { name: 'Heidenheim', sport: 'Fútbol', league: 'Bundesliga', icon: '⚽', logo: ESPN_SOCCER(6418) },
  { name: 'St. Pauli', sport: 'Fútbol', league: 'Bundesliga', icon: '⚽', logo: ESPN_SOCCER(270) },
  // ⚽ Ligue 1
  { name: 'PSG', sport: 'Fútbol', league: 'Ligue 1', icon: '🔵', logo: ESPN_SOCCER(160) },
  { name: 'Lens', sport: 'Fútbol', league: 'Ligue 1', icon: '⚽', logo: ESPN_SOCCER(175) },
  { name: 'Lille', sport: 'Fútbol', league: 'Ligue 1', icon: '⚽', logo: ESPN_SOCCER(166) },
  { name: 'Lyon', sport: 'Fútbol', league: 'Ligue 1', icon: '⚽', logo: ESPN_SOCCER(167) },
  { name: 'Marseille', sport: 'Fútbol', league: 'Ligue 1', icon: '⚽', logo: ESPN_SOCCER(176) },
  { name: 'Stade Rennais', sport: 'Fútbol', league: 'Ligue 1', icon: '⚽', logo: ESPN_SOCCER(169) },
  { name: 'Monaco', sport: 'Fútbol', league: 'Ligue 1', icon: '⚽', logo: ESPN_SOCCER(174) },
  { name: 'Strasbourg', sport: 'Fútbol', league: 'Ligue 1', icon: '⚽', logo: ESPN_SOCCER(180) },
  { name: 'Lorient', sport: 'Fútbol', league: 'Ligue 1', icon: '⚽', logo: ESPN_SOCCER(273) },
  { name: 'Toulouse', sport: 'Fútbol', league: 'Ligue 1', icon: '⚽', logo: ESPN_SOCCER(179) },
  { name: 'Paris FC', sport: 'Fútbol', league: 'Ligue 1', icon: '⚽', logo: ESPN_SOCCER(6851) },
  { name: 'Brest', sport: 'Fútbol', league: 'Ligue 1', icon: '⚽', logo: ESPN_SOCCER(6997) },
  { name: 'Angers', sport: 'Fútbol', league: 'Ligue 1', icon: '⚽', logo: ESPN_SOCCER(7868) },
  { name: 'Le Havre', sport: 'Fútbol', league: 'Ligue 1', icon: '⚽', logo: ESPN_SOCCER(3236) },
  { name: 'Auxerre', sport: 'Fútbol', league: 'Ligue 1', icon: '⚽', logo: ESPN_SOCCER(172) },
  { name: 'Nice', sport: 'Fútbol', league: 'Ligue 1', icon: '⚽', logo: ESPN_SOCCER(2502) },
  { name: 'Nantes', sport: 'Fútbol', league: 'Ligue 1', icon: '⚽', logo: ESPN_SOCCER(165) },
  { name: 'Metz', sport: 'Fútbol', league: 'Ligue 1', icon: '⚽', logo: ESPN_SOCCER(177) },
  // NBA
  { name: 'Lakers', sport: 'NBA', icon: '🟣', logo: ESPN_NBA('lal') },
  { name: 'Celtics', sport: 'NBA', icon: '🟢', logo: ESPN_NBA('bos') },
  { name: 'Warriors', sport: 'NBA', icon: '🔵', logo: ESPN_NBA('gs') },
  { name: 'Bulls', sport: 'NBA', icon: '🔴', logo: ESPN_NBA('chi') },
  { name: 'Heat', sport: 'NBA', icon: '🔥', logo: ESPN_NBA('mia') },
  { name: 'Nuggets', sport: 'NBA', icon: '🟡', logo: ESPN_NBA('den') },
  // Tenis — sin logo de equipo, emoji se mantiene
  { name: 'Alcaraz', sport: 'Tenis', icon: '🎾' },
  { name: 'Sinner', sport: 'Tenis', icon: '🎾' },
  { name: 'Djokovic', sport: 'Tenis', icon: '🎾' },
  { name: 'Swiatek', sport: 'Tenis', icon: '🎾' },
  { name: 'Sabalenka', sport: 'Tenis', icon: '🎾' },
  // F1 — sin logo de equipo, emoji se mantiene
  { name: 'Verstappen', sport: 'F1', icon: '🏎️' },
  { name: 'Hamilton', sport: 'F1', icon: '🏎️' },
  { name: 'Leclerc', sport: 'F1', icon: '🏎️' },
  { name: 'Norris', sport: 'F1', icon: '🏎️' },
  // UFC / MMA — sin logo de equipo, emoji se mantiene
  { name: 'McGregor', sport: 'UFC', icon: '🥊' },
  { name: 'Pereira', sport: 'UFC', icon: '🥊' },
  { name: 'Topuria', sport: 'UFC', icon: '🥊' },
]

// Pequeño componente con fallback a emoji si la imagen del escudo falla.
function TeamIcon({ logo, fallback, name, active }: { logo?: string; fallback: string; name: string; active: boolean }) {
  const [failed, setFailed] = useState(false)
  if (logo && !failed) {
    return (
      <Image
        src={logo}
        alt={name}
        width={36}
        height={36}
        unoptimized
        style={{ objectFit: 'contain', filter: active ? 'none' : 'brightness(0.92)' }}
        onError={() => setFailed(true)}
      />
    )
  }
  return <span className="text-[22px]">{fallback}</span>
}

interface Props {
  onClose: () => void
  onSave: (favorites: string[]) => void
}

export default function FavoritesOnboarding({ onClose, onSave }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<string>('Todos')

  // Diálogo accesible: foco inicial dentro del modal, foco atrapado (Tab/Shift+Tab
  // no se escapan), Escape cierra y al cerrar devolvemos el foco a quien lo abrió.
  const modalRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
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

  // Los equipos de fútbol se agrupan por LIGA (LaLiga, Premier…); el resto de
  // deportes (NBA, Tenis, F1, UFC) por su propio `sport`. Así con ~100 equipos
  // el usuario navega por pestañas de liga en vez de una lista plana enorme.
  const groups = ['Todos', ...Array.from(new Set(POPULAR_TEAMS.map(t => t.league ?? t.sport)))]
  const visibleTeams = filter === 'Todos'
    ? POPULAR_TEAMS
    : POPULAR_TEAMS.filter(t => (t.league ?? t.sport) === filter)

  const toggle = (name: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const handleSave = () => {
    onSave(Array.from(selected))
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-[199] backdrop-blur-sm"
        style={{ background: 'rgba(0, 0, 0, 0.7)' }}
      />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fav-onb-title"
        onClick={e => e.stopPropagation()}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[200] max-h-[85vh] overflow-y-auto rounded-2xl w-[92vw] sm:w-[520px]"
        style={{
          background: 'linear-gradient(135deg, rgba(20,20,30,0.97) 0%, rgba(15,15,22,0.99) 100%)',
          border: '1px solid rgba(124,58,237,0.3)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.8), 0 0 40px rgba(124,58,237,0.15)',
        }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(124,58,237,0.18)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest"
                style={{ color: '#C4B5FD', fontFamily: 'var(--font-sport)' }}>
                <StarIcon size={11} className="inline-block align-middle mr-1" />Bienvenido
              </p>
              <h2 id="fav-onb-title" className="text-lg font-black leading-tight mt-1"
                style={{ color: '#F8F8FF', fontFamily: 'var(--font-display)' }}>
                Elige tus equipos favoritos
              </h2>
              <p className="text-[10px] mt-1" style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)' }}>
                Personalizamos tu calendario · puedes cambiarlo después
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 rounded-full transition-all hover:brightness-125"
              style={{ background: 'rgba(255,255,255,0.06)' }}
              aria-label="Saltar"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="#9090A8" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Sport filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto px-5 py-3" style={{ scrollbarWidth: 'none' }}>
          {groups.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all flex-shrink-0"
              style={{
                background: filter === s ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.04)',
                color: filter === s ? '#C4B5FD' : '#7A7A8E',
                border: filter === s ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.06)',
                fontFamily: 'var(--font-sport)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Team grid */}
        <div className="px-5 py-2 grid grid-cols-3 sm:grid-cols-4 gap-2">
          {visibleTeams.map(team => {
            const active = selected.has(team.name)
            return (
              <button
                key={team.name}
                onClick={() => toggle(team.name)}
                className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-lg transition-all"
                style={{
                  background: active ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.03)',
                  border: active ? '1px solid rgba(124,58,237,0.5)' : '1px solid rgba(255,255,255,0.06)',
                  cursor: 'pointer',
                  minHeight: 76,
                }}
              >
                <div className="flex items-center justify-center" style={{ width: 36, height: 36 }}>
                  <TeamIcon logo={team.logo} fallback={team.icon} name={team.name} active={active} />
                </div>
                <span className="text-[9.5px] font-black text-center leading-tight"
                  style={{
                    color: active ? '#E0D0FF' : '#C0C0D8',
                    fontFamily: 'var(--font-sport)',
                  }}>
                  {team.name}
                </span>
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t flex items-center justify-between gap-3"
          style={{ borderColor: 'rgba(124,58,237,0.15)' }}>
          <button
            onClick={onClose}
            className="text-[10px] font-bold uppercase tracking-widest transition-opacity hover:opacity-70"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)', cursor: 'pointer' }}
          >
            Explorar sin elegir
          </button>
          <button
            onClick={handleSave}
            disabled={selected.size === 0}
            className="px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all"
            style={{
              background: selected.size > 0 ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.04)',
              color: selected.size > 0 ? '#E0D0FF' : 'var(--text-muted)',
              border: selected.size > 0 ? '1px solid rgba(124,58,237,0.5)' : '1px solid rgba(255,255,255,0.06)',
              fontFamily: 'var(--font-sport)',
              cursor: selected.size > 0 ? 'pointer' : 'not-allowed',
              boxShadow: selected.size > 0 ? '0 0 14px rgba(124,58,237,0.25)' : 'none',
            }}
          >
            Guardar {selected.size > 0 && `(${selected.size})`}
          </button>
        </div>
      </div>
    </>
  )
}
