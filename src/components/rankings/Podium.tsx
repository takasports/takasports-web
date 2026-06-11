'use client'

import type { RankingEntry } from '@/lib/rankings'
import { getDisplayScore, scoreColor, SPORT_EMOJI } from '@/lib/rankings-ui'
import PlayerAvatar from './PlayerAvatar'
import Link from 'next/link'
import { CrownIcon } from '@/components/icons/GameIcons'

// Podio del Índice (identidad "La Señal"): el top-3 como pieza editorial
// "power rankings" en vez de tres filas iguales. #1 elevado con corona, #2/#3
// flanqueando, medallas oro/plata/bronce, foto a sangre y acento del deporte.
// $0 (CSS/SVG). Entrada en cascada con hero-enter (respeta reduced-motion).

const MEDAL: Record<number, { ring: string; ped: string }> = {
  1: { ring: '#FACC15', ped: '#FACC15' }, // oro
  2: { ring: '#C7CBD4', ped: '#C7CBD4' }, // plata
  3: { ring: '#D08B4E', ped: '#D08B4E' }, // bronce
}

function avatarEmojiFor(entry: RankingEntry): string {
  if (entry.emoji && entry.emoji !== entry.country) return entry.emoji
  return entry.sport ? (SPORT_EMOJI[entry.sport] ?? '🏅') : '🏅'
}

function PodiumColumn({
  entry, place, accent, elevated, showSportEmoji, delay,
}: {
  entry: RankingEntry
  place: 1 | 2 | 3
  accent: string
  elevated?: boolean
  showSportEmoji?: boolean
  delay: number
}) {
  const score = getDisplayScore(entry)
  const sc = scoreColor(score)
  const medal = MEDAL[place]
  const avatarSize = elevated ? 84 : 62
  const pedH = place === 1 ? 60 : place === 2 ? 42 : 32
  const sportEmoji = entry.sport ? SPORT_EMOJI[entry.sport] : null

  return (
    <Link
      href={`/rankings/${entry.id}`}
      className="hero-enter group flex flex-col items-center flex-1 min-w-0"
      style={{ animationDelay: `${delay}ms`, paddingTop: elevated ? 0 : 18, textDecoration: 'none' }}
    >
      {/* Corona del #1 */}
      {place === 1 && (
        <span className="leading-none mb-1" style={{ color: '#FACC15', filter: 'drop-shadow(0 2px 8px rgba(250,204,21,0.45))' }}>
          <CrownIcon size={22} />
        </span>
      )}

      {/* Avatar con anillo de medalla + glow */}
      <div className="relative flex-shrink-0">
        <div
          className="flex items-center justify-center rounded-full overflow-hidden transition-transform group-hover:scale-105"
          style={{
            width: avatarSize, height: avatarSize,
            background: `${accent}18`,
            border: `2.5px solid ${medal.ring}`,
            boxShadow: `0 6px 22px ${medal.ring}38, 0 0 0 4px ${accent}10`,
          }}
        >
          <PlayerAvatar src={entry.image} alt={entry.name} fallback={avatarEmojiFor(entry)} size={avatarSize} rounded="full" />
        </div>
        {entry.country && (
          <span className="absolute -bottom-1 -right-1 leading-none" style={{ fontSize: elevated ? 18 : 14 }}>{entry.country}</span>
        )}
      </div>

      {/* Nombre */}
      <div className="flex items-center gap-1 mt-2 max-w-full px-1">
        <span
          className="font-black truncate text-center group-hover:underline"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: elevated ? 'clamp(0.85rem, 3.6vw, 1.15rem)' : 'clamp(0.72rem, 3vw, 0.95rem)',
            color: '#F8F8FF', letterSpacing: '-0.01em',
          }}
        >
          {entry.name}
        </span>
        {showSportEmoji && sportEmoji && <span className="leading-none flex-shrink-0" style={{ fontSize: 12 }}>{sportEmoji}</span>}
      </div>

      {/* Score */}
      <span
        className="font-black tabular-nums leading-none mt-1"
        style={{ fontFamily: 'var(--font-display)', fontSize: elevated ? 30 : 22, color: sc, letterSpacing: '-0.03em' }}
      >
        {score.toFixed(1)}
      </span>
      <span className="text-[8px] font-semibold mb-2" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>/ 100</span>

      {/* Pedestal con la posición */}
      <div
        className="w-full rounded-t-lg flex items-start justify-center pt-1.5"
        style={{
          height: pedH,
          background: `linear-gradient(180deg, ${accent}26 0%, ${accent}0d 100%)`,
          borderTop: `2px solid ${medal.ped}`,
          boxShadow: `inset 0 1px 0 ${medal.ped}40`,
        }}
      >
        <span className="font-black tabular-nums leading-none" style={{ fontFamily: 'var(--font-display)', fontSize: elevated ? 26 : 20, color: medal.ped, opacity: 0.9 }}>
          {place}
        </span>
      </div>
    </Link>
  )
}

export default function Podium({
  entries, accent = '#7C3AED', showSportEmoji = false,
}: {
  entries: RankingEntry[]
  accent?: string
  showSportEmoji?: boolean
}) {
  const [first, second, third] = entries
  if (!first || !second || !third) return null

  return (
    <div
      className="relative mb-4 rounded-2xl px-3 sm:px-5 pt-5 overflow-hidden"
      style={{
        background: `linear-gradient(180deg, ${accent}12 0%, rgba(9,9,15,0.35) 70%)`,
        border: `1px solid ${accent}24`,
      }}
    >
      {/* Hairline de rótulo broadcast */}
      <span aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 2, background: `linear-gradient(90deg, transparent, ${accent}80, transparent)` }} />
      <div className="flex items-end justify-center gap-1.5 sm:gap-4">
        <PodiumColumn entry={second} place={2} accent={accent} showSportEmoji={showSportEmoji} delay={0} />
        <PodiumColumn entry={first} place={1} accent={accent} elevated showSportEmoji={showSportEmoji} delay={90} />
        <PodiumColumn entry={third} place={3} accent={accent} showSportEmoji={showSportEmoji} delay={170} />
      </div>
    </div>
  )
}
