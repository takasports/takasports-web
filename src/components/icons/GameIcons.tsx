// Iconos SVG monoline para juegos, recompensas y eventos de partido.
// Convención: viewBox 32x32, stroke="currentColor", strokeWidth ~1.5.
// Usar el `color` del contenedor para teñirlos.

import ES from 'country-flag-icons/react/3x2/ES'
import AR from 'country-flag-icons/react/3x2/AR'
import BR from 'country-flag-icons/react/3x2/BR'
import FR from 'country-flag-icons/react/3x2/FR'
import DE from 'country-flag-icons/react/3x2/DE'
import IT from 'country-flag-icons/react/3x2/IT'
import GB from 'country-flag-icons/react/3x2/GB'
import GB_SCT from 'country-flag-icons/react/3x2/GB-SCT'
import PT from 'country-flag-icons/react/3x2/PT'
import NL from 'country-flag-icons/react/3x2/NL'
import HR from 'country-flag-icons/react/3x2/HR'
import UY from 'country-flag-icons/react/3x2/UY'
import CO from 'country-flag-icons/react/3x2/CO'
import CL from 'country-flag-icons/react/3x2/CL'
import MX from 'country-flag-icons/react/3x2/MX'
import US from 'country-flag-icons/react/3x2/US'
import PL from 'country-flag-icons/react/3x2/PL'
import NO from 'country-flag-icons/react/3x2/NO'
import SE from 'country-flag-icons/react/3x2/SE'
import DK from 'country-flag-icons/react/3x2/DK'
import CH from 'country-flag-icons/react/3x2/CH'
import RS from 'country-flag-icons/react/3x2/RS'
import UA from 'country-flag-icons/react/3x2/UA'
import MA from 'country-flag-icons/react/3x2/MA'
import SN from 'country-flag-icons/react/3x2/SN'
import EG from 'country-flag-icons/react/3x2/EG'
import NG from 'country-flag-icons/react/3x2/NG'
import CM from 'country-flag-icons/react/3x2/CM'
import GH from 'country-flag-icons/react/3x2/GH'
import CI from 'country-flag-icons/react/3x2/CI'
import KR from 'country-flag-icons/react/3x2/KR'
import JP from 'country-flag-icons/react/3x2/JP'
import CR from 'country-flag-icons/react/3x2/CR'
import PY from 'country-flag-icons/react/3x2/PY'
import BG from 'country-flag-icons/react/3x2/BG'
import GE from 'country-flag-icons/react/3x2/GE'
import TR from 'country-flag-icons/react/3x2/TR'
import AT from 'country-flag-icons/react/3x2/AT'
import LR from 'country-flag-icons/react/3x2/LR'
import GA from 'country-flag-icons/react/3x2/GA'
import BF from 'country-flag-icons/react/3x2/BF'
import CA from 'country-flag-icons/react/3x2/CA'
import IE from 'country-flag-icons/react/3x2/IE'

type IconProps = { size?: number; className?: string }

const COUNTRY_TO_FLAG: Record<string, React.ComponentType<{ title?: string }>> = {
  'España': ES, 'Argentina': AR, 'Brasil': BR, 'Francia': FR,
  'Alemania': DE, 'Italia': IT, 'Inglaterra': GB, 'Portugal': PT,
  'Países Bajos': NL, 'Croacia': HR, 'Uruguay': UY, 'Colombia': CO,
  'Chile': CL, 'México': MX, 'Estados Unidos': US, 'Polonia': PL,
  'Noruega': NO, 'Suecia': SE, 'Dinamarca': DK, 'Suiza': CH,
  'Serbia': RS, 'Ucrania': UA, 'Marruecos': MA, 'Senegal': SN,
  'Egipto': EG, 'Nigeria': NG, 'Camerún': CM, 'Ghana': GH,
  'Costa de Marfil': CI, 'Corea del Sur': KR, 'Japón': JP,
  'Costa Rica': CR, 'Paraguay': PY, 'Bulgaria': BG, 'Escocia': GB_SCT,
  'Georgia': GE, 'Turquía': TR, 'Austria': AT, 'Liberia': LR,
  'Gabón': GA, 'Burkina Faso': BF, 'Canadá': CA, 'Irlanda': IE,
}

export function CountryFlag({ country, width = 18, className }: { country: string; width?: number; className?: string }) {
  const FlagComp = COUNTRY_TO_FLAG[country]
  if (!FlagComp) {
    return (
      <span
        className={className}
        aria-label={country}
        style={{ display: 'inline-block', width, height: width * 2 / 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}
      />
    )
  }
  return (
    <span
      className={className}
      aria-label={country}
      style={{ display: 'inline-block', width, height: width * 2 / 3, borderRadius: 2, overflow: 'hidden', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.15)', verticalAlign: 'middle' }}
    >
      <FlagComp title={country} />
    </span>
  )
}

// ── Recompensas ───────────────────────────────────────────────

export function TrophyIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M10 5h12v6a6 6 0 0 1-12 0V5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M10 7H6a3 3 0 0 0 4 4M22 7h4a3 3 0 0 1-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 17v4M18 17v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M10 22h12l-1 4H11l-1-4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M14 9.5l1.5 1.5 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function FireIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <path
        d="M16 4c1 4 4 5 5 9 1.5 5-2 11-5 11s-7-3-7-8c0-2 1-3 2-4 0 2 1 3 2.5 3 0-3-1-5 .5-8 1-2 2-2 2-3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M14.5 24c-.8-.6-1.5-1.5-1.5-3 .6.7 1.2 1 2 1 .5-1.5 0-2.5 1-3.5 0 1.5 1.5 2 1.5 3.5 0 1.2-.7 2-2 2Z" fill="currentColor" opacity="0.55" />
    </svg>
  )
}

export function StarIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <path
        d="M16 4l3.6 7.5 8.1 1-6 5.9 1.5 8.2L16 22.7l-7.2 3.9 1.5-8.2-6-5.9 8.1-1L16 4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ClapIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M11 14V8a1.5 1.5 0 0 1 3 0v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 13V6.5a1.5 1.5 0 0 1 3 0V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M17 13.5V8a1.5 1.5 0 0 1 3 0v7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M20 15v-3a1.5 1.5 0 0 1 3 0v6c0 4-2 8-7 8s-7-3-8-6l-2-5c-.4-1 .2-2 1.2-2.2 1-.2 1.8.4 2.3 1.4l1.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 6l-2-1M7 4l-1-2M10 5l1-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.5" />
    </svg>
  )
}

export function FlexIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <path
        d="M4 22c2-1 3-2 4-4 1.5-3 3-4 6-4 4 0 5 2 5 5 0 4-2 6-5 6H7c-2 0-3-1-3-3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M14 14c1-3 4-5 8-5 2 0 3 1 3 2s-1 2-3 2c-3 0-4 1-5 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 22c2 0 4-1 4-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
    </svg>
  )
}

// ── Eventos de partido ────────────────────────────────────────

export function GoalIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="16" r="11" stroke="currentColor" strokeWidth="1.6" />
      <path d="M16 8l4.5 3.3-1.7 5.3h-5.6l-1.7-5.3L16 8Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M16 8V5M20.5 11.3l2.7-1.5M13.5 11.3l-2.7-1.5M13.2 16.6l-1.8 2.4M18.8 16.6l1.8 2.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.55" />
    </svg>
  )
}

export function YellowCardIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <rect x="9" y="4" width="14" height="22" rx="2" fill="#FACC15" stroke="#A16207" strokeWidth="1.2" transform="rotate(-6 16 15)" />
    </svg>
  )
}

export function RedCardIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <rect x="9" y="4" width="14" height="22" rx="2" fill="#DC2626" stroke="#7F1D1D" strokeWidth="1.2" transform="rotate(-6 16 15)" />
    </svg>
  )
}

// ── Deportes ──────────────────────────────────────────────────

export function FootballIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="16" r="11" stroke="currentColor" strokeWidth="1.6" />
      <path d="M16 9l4.5 3.3-1.7 5.3h-5.6l-1.7-5.3L16 9Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M16 9V5.2M20.5 12.3l3.2-1.8M11.5 12.3l-3.2-1.8M13.2 17.6l-2.2 2.9M18.8 17.6l2.2 2.9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

export function BasketballIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="16" r="11" stroke="currentColor" strokeWidth="1.6" />
      <path d="M16 5v22M5 16h22" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8.1 8.1c2.5 2.5 2.5 13.3 0 15.8M23.9 8.1c-2.5 2.5-2.5 13.3 0 15.8" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

export function F1Icon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M3 19c0-1 1-2 2-2h3l2-3h6l3 3h6c2 0 3 1 3 3v1H3v-2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="9" cy="21" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="23" cy="21" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11 14l3-2h4l2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M21 10h6M22 12h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.5" />
    </svg>
  )
}

export function TennisIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="16" r="11" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6.5 10.5c4 1.5 6.5 5 7 11M25.5 21.5c-4-1.5-6.5-5-7-11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function UFCIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <path
        d="M7 12c0-2 1-3 3-3h9c3 0 5 2 5 5v1c0 2-1 3-3 3h-1v3c0 2-1 3-3 3h-7c-2 0-3-1-3-3v-9Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M11 9V6.5c0-.8.7-1.5 1.5-1.5h5c.8 0 1.5.7 1.5 1.5V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10 14h11M10 17h11" stroke="currentColor" strokeWidth="1.3" opacity="0.5" />
    </svg>
  )
}

export function RugbyIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <ellipse cx="16" cy="16" rx="12" ry="7" stroke="currentColor" strokeWidth="1.6" transform="rotate(-35 16 16)" />
      <path d="M12 12l8 8M14 10l8 8M10 14l8 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.55" />
    </svg>
  )
}

export function WWEIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <rect x="4" y="10" width="24" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 14h24M4 20h24" stroke="currentColor" strokeWidth="1.3" opacity="0.5" />
      <path d="M8 10V7M14 10V6M18 10V6M24 10V7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="11" cy="17" r="1.5" fill="currentColor" />
      <circle cx="21" cy="17" r="1.5" fill="currentColor" />
    </svg>
  )
}

export function StadiumIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <ellipse cx="16" cy="20" rx="12" ry="6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 20v3c0 2 5 4 12 4s12-2 12-4v-3" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13" y="16" width="6" height="4" stroke="currentColor" strokeWidth="1.3" />
      <path d="M16 16V8M11 11l5-3 5 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Sport lookup ──────────────────────────────────────────────

export function SportIcon({ sport, size = 32, className }: { sport: string } & IconProps) {
  const key = sport.toLowerCase()
  // Acepta tanto slug ('futbol') como label ('Fútbol')
  if (key === 'futbol' || key === 'fútbol' || key === 'football' || key === 'soccer') return <FootballIcon size={size} className={className} />
  if (key === 'baloncesto' || key === 'basketball' || key === 'nba' || key === 'basket') return <BasketballIcon size={size} className={className} />
  if (key === 'formula1' || key === 'f1') return <F1Icon size={size} className={className} />
  if (key === 'tenis' || key === 'tennis') return <TennisIcon size={size} className={className} />
  if (key === 'ufc' || key === 'mma') return <UFCIcon size={size} className={className} />
  if (key === 'rugby') return <RugbyIcon size={size} className={className} />
  if (key === 'wwe' || key === 'wrestling') return <WWEIcon size={size} className={className} />
  return <TrophyIcon size={size} className={className} />
}
