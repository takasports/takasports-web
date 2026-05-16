// OG dinámica del ranking por juego: cuando alguien comparte
// `/juegos/leaderboard/crackquiz` (link al que apunta el modal post-
// partida), la preview muestra imagen brandeada con el juego y un
// subtítulo "Top jugadores semanal / diario / jornada actual".

import { buildGameOgImage, OG_SIZE } from '@/lib/og-game-image'

export const runtime     = 'edge'
export const size        = OG_SIZE
export const contentType = 'image/png'
export const alt         = 'Ranking — TakaSports'

interface GameMeta {
  emoji:    string
  title:    string
  subtitle: string
  accent:   string
}

const META: Record<string, GameMeta> = {
  quiniela:    { emoji: '🎯', title: 'Quiniela',       subtitle: 'Top jugadores · Jornada actual',    accent: '#A78BFA' },
  crackquiz:   { emoji: '🧠', title: 'CrackQuiz',      subtitle: 'Top jugadores · Trivia diaria',     accent: '#FCD34D' },
  mionce:      { emoji: '⚽', title: 'Mi Once',        subtitle: 'Top jugadores · Reto semanal',      accent: '#93C5FD' },
  sopacracks:  { emoji: '🔤', title: 'Sopa de Cracks', subtitle: 'Top jugadores · Puzzle semanal',    accent: '#6EE7B7' },
  takagrid:    { emoji: '🟧', title: 'TakaGrid',       subtitle: 'Top jugadores · Grid diario',       accent: '#FDBA74' },
  strikerrush: { emoji: '🏃', title: 'Striker Rush',   subtitle: 'Top jugadores · Arcade infinito',   accent: '#FCA5A5' },
}

const FALLBACK: GameMeta = {
  emoji:    '🏆',
  title:    'Ranking',
  subtitle: 'Top jugadores · TakaSports',
  accent:   '#A78BFA',
}

interface Props {
  params: Promise<{ game: string }>
}

export default async function Image({ params }: Props) {
  const { game } = await params
  const meta = META[game] ?? FALLBACK
  return buildGameOgImage({
    emoji:       meta.emoji,
    title:       `Ranking ${meta.title}`,
    description: meta.subtitle,
    accentColor: meta.accent,
  })
}
