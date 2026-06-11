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
import BE from 'country-flag-icons/react/3x2/BE'
import HU from 'country-flag-icons/react/3x2/HU'
import CZ from 'country-flag-icons/react/3x2/CZ'
import RU from 'country-flag-icons/react/3x2/RU'
import ML from 'country-flag-icons/react/3x2/ML'
import CD from 'country-flag-icons/react/3x2/CD'
import MZ from 'country-flag-icons/react/3x2/MZ'
import IR from 'country-flag-icons/react/3x2/IR'
import PE from 'country-flag-icons/react/3x2/PE'
import EC from 'country-flag-icons/react/3x2/EC'
import BO from 'country-flag-icons/react/3x2/BO'
import VE from 'country-flag-icons/react/3x2/VE'
import RO from 'country-flag-icons/react/3x2/RO'
import SK from 'country-flag-icons/react/3x2/SK'
import SI from 'country-flag-icons/react/3x2/SI'
import AM from 'country-flag-icons/react/3x2/AM'
import GN from 'country-flag-icons/react/3x2/GN'
import ME from 'country-flag-icons/react/3x2/ME'

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
  'Bélgica': BE, 'Hungría': HU, 'Chequia': CZ, 'Rusia': RU,
  'Mali': ML, 'RD del Congo': CD, 'Mozambique': MZ, 'Irán': IR,
  'Perú': PE, 'Ecuador': EC, 'Bolivia': BO, 'Venezuela': VE,
  'Rumanía': RO, 'Eslovaquia': SK, 'Eslovenia': SI,
  'Armenia': AM, 'Guinea': GN, 'Montenegro': ME,
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
      <path d="M10 5h12v6a6 6 0 0 1-12 0V5Z" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M10 7H6a3 3 0 0 0 4 4M22 7h4a3 3 0 0 1-4 4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 17v4M18 17v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M10 22h12l-1 4H11l-1-4Z" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
    </svg>
  )
}

export function FireIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <path
        d="M16 4c1 4 4 5 5 9 1.5 5-2 11-5 11s-7-3-7-8c0-2 1-3 2-4 0 2 1 3 2.5 3 0-3-1-5 .5-8 1-2 2-2 2-3Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d="M14.5 24c-.8-.6-1.5-1.5-1.5-3 .6.7 1.2 1 2 1 .5-1.5 0-2.5 1-3.5 0 1.5 1.5 2 1.5 3.5 0 1.2-.7 2-2 2Z" fill="currentColor" opacity="0.65" />
    </svg>
  )
}

export function StarIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <path
        d="M16 4l3.6 7.5 8.1 1-6 5.9 1.5 8.2L16 22.7l-7.2 3.9 1.5-8.2-6-5.9 8.1-1L16 4Z"
        fill="currentColor"
        fillOpacity="0.22"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ClapIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M20 15v-3a1.5 1.5 0 0 1 3 0v6c0 4-2 8-7 8s-7-3-8-6l-2-5c-.4-1 .2-2 1.2-2.2 1-.2 1.8.4 2.3 1.4l1.5 3" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 14V8a1.5 1.5 0 0 1 3 0v6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 13V6.5a1.5 1.5 0 0 1 3 0V14" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 13.5V8a1.5 1.5 0 0 1 3 0v7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 6l-2-1M7 4l-1-2M10 5l1-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />
    </svg>
  )
}

export function FlexIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <path
        d="M4 22c2-1 3-2 4-4 1.5-3 3-4 6-4 4 0 5 2 5 5 0 4-2 6-5 6H7c-2 0-3-1-3-3Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M14 14c1-3 4-5 8-5 2 0 3 1 3 2s-1 2-3 2c-3 0-4 1-5 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 22c2 0 4-1 4-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />
    </svg>
  )
}

// ── Eventos de partido ────────────────────────────────────────

export function GoalIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="16" r="11" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="2" />
      <path d="M16 8l4.5 3.3-1.7 5.3h-5.6l-1.7-5.3L16 8Z" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M16 8V5M20.5 11.3l2.7-1.5M13.5 11.3l-2.7-1.5M13.2 16.6l-1.8 2.4M18.8 16.6l1.8 2.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.65" />
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
      <circle cx="16" cy="16" r="11" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="2" />
      <path d="M16 9l4.5 3.3-1.7 5.3h-5.6l-1.7-5.3L16 9Z" fill="currentColor" fillOpacity="0.45" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M16 9V5.2M20.5 12.3l3.2-1.8M11.5 12.3l-3.2-1.8M13.2 17.6l-2.2 2.9M18.8 17.6l2.2 2.9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function BasketballIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="16" r="11" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="2" />
      <path d="M16 5v22M5 16h22" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8.1 8.1c2.5 2.5 2.5 13.3 0 15.8M23.9 8.1c-2.5 2.5-2.5 13.3 0 15.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

export function F1Icon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M3 19c0-1 1-2 2-2h3l2-3h6l3 3h6c2 0 3 1 3 3v1H3v-2Z" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="9" cy="21" r="2.5" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="23" cy="21" r="2.5" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M11 14l3-2h4l2 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 10h6M22 12h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />
    </svg>
  )
}

export function TennisIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="16" r="11" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="2" />
      <path d="M6.5 10.5c4 1.5 6.5 5 7 11M25.5 21.5c-4-1.5-6.5-5-7-11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function PadelIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      {/* Pala (cabeza perforada) */}
      <path d="M16 4c5 0 9 3.8 9 9 0 4.4-3 7.9-7 8.6V24h-4v-2.4c-4-.7-7-4.2-7-8.6 0-5.2 4-9 9-9Z"
        fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="13" cy="11" r="1.05" fill="currentColor" />
      <circle cx="19" cy="11" r="1.05" fill="currentColor" />
      <circle cx="16" cy="14.5" r="1.05" fill="currentColor" />
      <circle cx="13" cy="17.5" r="1.05" fill="currentColor" />
      <circle cx="19" cy="17.5" r="1.05" fill="currentColor" />
      {/* Mango */}
      <path d="M14 24h4v3.4c0 .9-.7 1.6-1.6 1.6h-.8c-.9 0-1.6-.7-1.6-1.6V24Z"
        fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}

export function UFCIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <path
        d="M7 12c0-2 1-3 3-3h9c3 0 5 2 5 5v1c0 2-1 3-3 3h-1v3c0 2-1 3-3 3h-7c-2 0-3-1-3-3v-9Z"
        fill="currentColor"
        fillOpacity="0.18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d="M11 9V6.5c0-.8.7-1.5 1.5-1.5h5c.8 0 1.5.7 1.5 1.5V9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 14h11M10 17h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.55" />
    </svg>
  )
}

export function RugbyIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <ellipse cx="16" cy="16" rx="12" ry="7" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="2" transform="rotate(-35 16 16)" />
      <path d="M12 12l8 8M14 10l8 8M10 14l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.65" />
    </svg>
  )
}

export function WWEIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <rect x="4" y="10" width="24" height="14" rx="2.5" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="2" />
      <path d="M4 14h24M4 20h24" stroke="currentColor" strokeWidth="1.5" opacity="0.55" />
      <path d="M8 10V7M14 10V6M18 10V6M24 10V7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="11" cy="17" r="1.5" fill="currentColor" />
      <circle cx="21" cy="17" r="1.5" fill="currentColor" />
    </svg>
  )
}

// ── UI generales ──────────────────────────────────────────────

export function SearchIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="14" cy="14" r="8" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20l7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

export function CalendarIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <rect x="4" y="7" width="24" height="21" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M4 13h24" stroke="currentColor" strokeWidth="2" />
      <path d="M11 4v6M21 4v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="10" cy="19" r="1.3" fill="currentColor" />
      <circle cx="16" cy="19" r="1.3" fill="currentColor" />
      <circle cx="22" cy="19" r="1.3" fill="currentColor" />
      <circle cx="10" cy="24" r="1.3" fill="currentColor" />
      <circle cx="16" cy="24" r="1.3" fill="currentColor" />
    </svg>
  )
}

export function TvIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <rect x="3" y="7" width="26" height="17" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M11 28h10M16 24v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M11 4l5 4 5-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function BellIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M9 22V14a7 7 0 0 1 14 0v8l2 3H7l2-3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M14 25a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="16" cy="6" r="1.6" fill="currentColor" />
    </svg>
  )
}

export function MicrophoneIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <rect x="12" y="4" width="8" height="15" rx="4" stroke="currentColor" strokeWidth="2" />
      <path d="M7 15c0 5 4 9 9 9s9-4 9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 24v4M12 28h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function PersonIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="11" r="5" stroke="currentColor" strokeWidth="2" />
      <path d="M5 28c1-6 5-9 11-9s10 3 11 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function CrownIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M5 22l-1-12 6 5 6-9 6 9 6-5-1 12H5Z" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M5 22h22v3H5z" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="16" cy="9" r="1.3" fill="currentColor" />
      <circle cx="4" cy="10" r="1.3" fill="currentColor" />
      <circle cx="28" cy="10" r="1.3" fill="currentColor" />
    </svg>
  )
}

export function TargetIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="16" r="11" stroke="currentColor" strokeWidth="2" />
      <circle cx="16" cy="16" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16" cy="16" r="2.2" fill="currentColor" />
    </svg>
  )
}

export function LockIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <rect x="6" y="14" width="20" height="14" rx="2.5" stroke="currentColor" strokeWidth="2" />
      <path d="M10 14V10a6 6 0 0 1 12 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="21" r="1.6" fill="currentColor" />
      <path d="M16 22v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function PinIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M16 4c4 0 7 3 7 7 0 6-7 17-7 17s-7-11-7-17c0-4 3-7 7-7Z" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="16" cy="11" r="2.5" fill="currentColor" />
    </svg>
  )
}

export function GlobeIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="16" r="11" stroke="currentColor" strokeWidth="2" />
      <ellipse cx="16" cy="16" rx="5" ry="11" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5 16h22" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  )
}

export function ClipboardIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <rect x="7" y="6" width="18" height="22" rx="2.5" stroke="currentColor" strokeWidth="2" />
      <rect x="11" y="3" width="10" height="6" rx="1.5" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="1.8" />
      <path d="M11 14h10M11 18h10M11 22h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.65" />
    </svg>
  )
}

export function DiamondIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M16 4l10 8-10 16L6 12l10-8Z" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M6 12h20M11 4l-3 8 8 16M21 4l3 8-8 16" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" opacity="0.65" />
    </svg>
  )
}

export function LightbulbIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M16 4a8 8 0 0 0-5 14c1 1 2 2 2 4v2h6v-2c0-2 1-3 2-4a8 8 0 0 0-5-14Z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 26h8M13 29h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function ChartIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M5 27h22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect x="7" y="17" width="4.5" height="9" rx="1" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="1.9" />
      <rect x="13.75" y="11" width="4.5" height="15" rx="1" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="1.9" />
      <rect x="20.5" y="6" width="4.5" height="20" rx="1" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="1.9" />
    </svg>
  )
}

export function ControllerIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M11 9h10a7 7 0 0 1 7 7v3.4a4 4 0 0 1-7 2.7l-1.5-1.6h-7l-1.5 1.6A4 4 0 0 1 4 19.4V16a7 7 0 0 1 7-7Z" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9 15v4M7 17h4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="21" cy="15.5" r="1.4" fill="currentColor" />
      <circle cx="24" cy="18" r="1.4" fill="currentColor" />
    </svg>
  )
}

export function MedalIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M10 3l4 10M22 3l-4 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="20" r="8" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="2" />
      <circle cx="16" cy="20" r="4" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  )
}

// Medalla de podio teñida por puesto (oro/plata/bronce). A diferencia de
// MedalIcon (que hereda currentColor), ésta lleva el color del puesto fijo
// — sustituye los emojis 🥇🥈🥉 en clasificaciones y leaderboards.
const PODIUM_MEDAL_COLOR: Record<number, string> = { 1: '#F4C95D', 2: '#C8CDD6', 3: '#CD7F4A' }
export function getPodiumMedalColor(position: number): string {
  return PODIUM_MEDAL_COLOR[position] ?? '#7C7C8C'
}
export function PodiumMedal({ position, size = 20, className }: { position: number; size?: number; className?: string }) {
  const c = getPodiumMedalColor(position)
  const label = position === 1 ? 'Oro' : position === 2 ? 'Plata' : position === 3 ? 'Bronce' : `${position}º`
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} role="img" aria-label={label}>
      <path d="M10 3l4 9M22 3l-4 9" stroke={c} strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="21" r="8" fill={c} fillOpacity="0.22" stroke={c} strokeWidth="2" />
      <circle cx="16" cy="21" r="3.6" fill={c} fillOpacity="0.35" stroke={c} strokeWidth="1.6" />
    </svg>
  )
}

export function HomeIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M4 15l12-10 12 10v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V15Z" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M13 29v-8h6v8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

export function SmartphoneIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <rect x="9" y="3" width="14" height="26" rx="3" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="2" />
      <path d="M13 6h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="16" cy="25" r="1.3" fill="currentColor" />
    </svg>
  )
}

export function LiveDotIcon({ size = 12, className }: IconProps) {
  return (
    <span
      className={className}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: '#ef4444',
        boxShadow: '0 0 0 0 rgba(239,68,68,0.7)',
        animation: 'live-pulse 1.6s infinite',
      }}
    />
  )
}

export function StadiumIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <ellipse cx="16" cy="20" rx="12" ry="6" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="2" />
      <path d="M4 20v3c0 2 5 4 12 4s12-2 12-4v-3" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <rect x="13" y="16" width="6" height="4" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M16 16V8M11 11l5-3 5 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── UI extra (item 14: emojis → SVG) ──────────────────────────

export function BoltIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M18 3L8 17h6l-2 12 12-15h-6l2-11Z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export function TimerIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="19" r="10" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="2" />
      <path d="M16 19V13M16 19h4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M13 4h6M16 4v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function CheckIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} role="img" aria-label="Correcto">
      <path d="M6 17l6 6L26 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function CloseIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} role="img" aria-label="Incorrecto">
      <path d="M8 8l16 16M24 8L8 24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function DiceIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <rect x="6" y="6" width="20" height="20" rx="4.5" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="2" />
      <circle cx="11.5" cy="11.5" r="1.7" fill="currentColor" />
      <circle cx="20.5" cy="11.5" r="1.7" fill="currentColor" />
      <circle cx="16" cy="16" r="1.7" fill="currentColor" />
      <circle cx="11.5" cy="20.5" r="1.7" fill="currentColor" />
      <circle cx="20.5" cy="20.5" r="1.7" fill="currentColor" />
    </svg>
  )
}

export function GlovesIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M11 9a5 5 0 0 1 5-5h3a5 5 0 0 1 5 5v6a6 6 0 0 1-6 6h-4a3 3 0 0 1-3-3V9Z" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M11 12a3.5 3.5 0 0 0-3.5 3.5v1.5a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 21v3a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function FilesIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M4 11a2 2 0 0 1 2-2h6l2.5 3H26a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V11Z" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M7 9V7a2 2 0 0 1 2-2h4l2 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
    </svg>
  )
}

export function GalleryIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <rect x="5" y="6" width="22" height="20" rx="3" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="2" />
      <circle cx="11.5" cy="12.5" r="2.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M6 23l6-6 4 4 5-5 5 5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function LinkIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M13 19l-2.5 2.5a4.6 4.6 0 0 1-6.5-6.5L7.5 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 13l2.5-2.5a4.6 4.6 0 0 1 6.5 6.5L24.5 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.5 19.5l7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function AlertIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M16 5l12 21H4L16 5Z" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M16 13v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="23" r="1.4" fill="currentColor" />
    </svg>
  )
}

export function CameraIcon({ size = 32, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M4 11a2 2 0 0 1 2-2h3l2-3h6l2 3h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V11Z" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="16" cy="17" r="4.5" stroke="currentColor" strokeWidth="2" />
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
  if (key === 'pádel' || key === 'padel') return <PadelIcon size={size} className={className} />
  if (key === 'ufc' || key === 'mma') return <UFCIcon size={size} className={className} />
  if (key === 'rugby') return <RugbyIcon size={size} className={className} />
  if (key === 'wwe' || key === 'wrestling') return <WWEIcon size={size} className={className} />
  return <TrophyIcon size={size} className={className} />
}
