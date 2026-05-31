// ─────────────────────────────────────────────────────────────────
// Badges registry — catálogo central de logros de TakaSports.
//
// Cada badge tiene:
//   · id          PK estable (NUNCA cambia, se guarda en quiniela_badges)
//   · name        nombre humano corto (sidebar/perfil)
//   · emoji       icono compacto (mostrado en ranking junto al nick)
//   · color       hex del aro/border (UI consistente con rarity)
//   · description texto largo para tooltip / modal de perfil
//   · rarity      'common' | 'rare' | 'epic' | 'legendary' (orden visual)
//   · category    'season' | 'jornada' | 'mundial' | 'special' | 'milestone'
//
// Reglas:
//   · El catálogo vive en código, NO en DB — agregar/modificar requiere
//     deploy, lo cual queremos (audit + revisión).
//   · La DB (quiniela_badges) solo guarda (user_id, badge_id, unlocked_at)
//     — el badge_id se valida contra este catálogo antes de upsert.
//   · Si un badge_id desconocido aparece en DB (e.g. tras revert), la UI
//     lo ignora silenciosamente — no rompe el render.
//
// Cuándo agregar un badge:
//   · Hito de producto recurrente (primera apuesta, pleno, racha)
//   · Cierre de torneo (mundialista_2026, top3_mundial_2026)
//   · Eventos especiales temporales (admin define vía /admin/badges) —
//     estos NO viven aquí, viven en quiniela_special_badges (Fase 4).
// ─────────────────────────────────────────────────────────────────

export type BadgeRarity = 'common' | 'rare' | 'epic' | 'legendary'
export type BadgeCategory = 'milestone' | 'jornada' | 'season' | 'mundial' | 'special'

/**
 * Ítems que desbloquea este badge (por rareza).
 * common  → solo badge
 * rare    → badge + title
 * epic    → badge + title + frame
 * legendary → badge + title + frame + cardBg
 */
export interface BadgeUnlocks {
  /** Epíteto corto visible bajo el nick en el ranking. */
  title?: string
  /** Color hex del borde de la fila entera en el ranking (epic+). */
  frameColor?: string
  /** Gradiente CSS del fondo de la fila (legendary only). */
  cardBg?: string
}

export interface BadgeDef {
  id: string
  name: string
  emoji: string
  color: string          // hex del aro
  bg: string             // hex del background del chip (con alpha)
  description: string
  rarity: BadgeRarity
  category: BadgeCategory
  /** Ítems equipables que desbloquea este badge. */
  unlocks?: BadgeUnlocks
  /** Si true, NO se muestra en ranking público (solo en perfil propio). */
  privateOnly?: boolean
}

const RARITY_ORDER: Record<BadgeRarity, number> = {
  legendary: 0,
  epic: 1,
  rare: 2,
  common: 3,
}

// IDs de badges de bienvenida — se otorga uno al azar en el registro.
export const WELCOME_BADGE_IDS = ['nuevo_fichaje', 'rookie_crack', 'taker_inicial'] as const

// Catálogo principal. Mantener orden estable (no reordenar arbitrariamente).
export const BADGES: Record<string, BadgeDef> = {
  // ── Bienvenida (se regala uno al azar al registrarse) ───────────
  nuevo_fichaje: {
    id: 'nuevo_fichaje',
    name: 'Nuevo fichaje',
    emoji: '✍️',
    color: '#818cf8',
    bg: 'rgba(129,140,248,0.12)',
    description: 'Te fichamos. Bienvenido al equipo TakaSports.',
    rarity: 'common',
    category: 'milestone',
  },
  rookie_crack: {
    id: 'rookie_crack',
    name: 'Crack en potencia',
    emoji: '⭐',
    color: '#fbbf24',
    bg: 'rgba(251,191,36,0.12)',
    description: 'El talento ya se ve desde el primer día.',
    rarity: 'common',
    category: 'milestone',
  },
  taker_inicial: {
    id: 'taker_inicial',
    name: 'Takero de pura cepa',
    emoji: '🎯',
    color: '#34d399',
    bg: 'rgba(52,211,153,0.12)',
    description: 'Desde el minuto uno, ya eres de los nuestros.',
    rarity: 'common',
    category: 'milestone',
  },

  // ── Milestones (primera vez que hacés X) ────────────────────────
  primera_prediccion: {
    id: 'primera_prediccion',
    name: 'Primera predicción',
    emoji: '🔮',
    color: '#60a5fa',
    bg: 'rgba(96,165,250,0.12)',
    description: 'Hiciste tu primera predicción en el Ranked TakaSports.',
    rarity: 'common',
    category: 'milestone',
  },
  primera_prediccion_correcta: {
    id: 'primera_prediccion_correcta',
    name: 'Primer acierto',
    emoji: '✅',
    color: '#34d399',
    bg: 'rgba(52,211,153,0.12)',
    description: 'Acertaste tu primera predicción Ranked. El olfato no miente.',
    rarity: 'common',
    category: 'milestone',
  },
  first_bet: {
    id: 'first_bet',
    name: 'Primera apuesta',
    emoji: '🎲',
    color: '#94a3b8',
    bg: 'rgba(148,163,184,0.12)',
    description: 'Sellaste tu primera jornada de Ranked Fútbol.',
    rarity: 'common',
    category: 'milestone',
  },
  first_win: {
    id: 'first_win',
    name: 'Primera ganancia',
    emoji: '💰',
    color: '#34d399',
    bg: 'rgba(52,211,153,0.12)',
    description: 'Recuperaste más de lo que apostaste en una jornada.',
    rarity: 'common',
    category: 'milestone',
  },

  // ── Jornada (logros de una sola jornada) ────────────────────────
  pleno_jornada: {
    id: 'pleno_jornada',
    name: 'Pleno',
    emoji: '🎯',
    color: '#fbbf24',
    bg: 'rgba(251,191,36,0.14)',
    description: 'Acertaste TODOS los partidos de una jornada.',
    rarity: 'epic',
    category: 'jornada',
    unlocks: {
      title: 'El Pleno',
      frameColor: '#fbbf24',
    },
  },
  oraculo: {
    id: 'oraculo',
    name: 'Oráculo',
    emoji: '🔮',
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.14)',
    description: 'Acertaste 4 o más partidos en una jornada.',
    rarity: 'rare',
    category: 'jornada',
    unlocks: {
      title: 'El Oráculo',
    },
  },
  high_roller: {
    id: 'high_roller',
    name: 'High Roller',
    emoji: '💎',
    color: '#22d3ee',
    bg: 'rgba(34,211,238,0.14)',
    description: 'Apostaste 500 pts o más en una sola jornada y ganaste.',
    rarity: 'epic',
    category: 'jornada',
    unlocks: {
      title: 'High Roller',
      frameColor: '#22d3ee',
    },
  },
  underdog: {
    id: 'underdog',
    name: 'Underdog',
    emoji: '🐺',
    color: '#fb923c',
    bg: 'rgba(251,146,60,0.14)',
    description: 'Ganaste con una cuota igual o mayor a 4.0 en algún pick.',
    rarity: 'rare',
    category: 'jornada',
    unlocks: {
      title: 'Cazador de Cuotas',
    },
  },

  // ── Season (logros acumulativos de temporada) ───────────────────
  racha_3: {
    id: 'racha_3',
    name: 'Racha x3',
    emoji: '🔥',
    color: '#f97316',
    bg: 'rgba(249,115,22,0.14)',
    description: 'Tres jornadas consecutivas con ganancias.',
    rarity: 'rare',
    category: 'season',
    unlocks: {
      title: 'En Racha',
    },
  },
  racha_5: {
    id: 'racha_5',
    name: 'En llamas',
    emoji: '🔥',
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.14)',
    description: 'Cinco jornadas consecutivas con ganancias.',
    rarity: 'epic',
    category: 'season',
    unlocks: {
      title: 'En Llamas',
      frameColor: '#ef4444',
    },
  },

  // ── Milestones de racha diaria ──────────────────────────────────
  racha_dias_3: {
    id: 'racha_dias_3',
    name: 'Racha de 3 días',
    emoji: '🔥',
    color: '#f97316',
    bg: 'rgba(249,115,22,0.12)',
    description: 'Jugaste 3 días seguidos en TakaSports.',
    rarity: 'common',
    category: 'milestone',
  },
  racha_dias_7: {
    id: 'racha_dias_7',
    name: 'Semana en racha',
    emoji: '🔥',
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.12)',
    description: 'Una semana entera jugando cada día.',
    rarity: 'rare',
    category: 'milestone',
    unlocks: { title: 'Semana de Fuego' },
  },
  racha_dias_30: {
    id: 'racha_dias_30',
    name: 'Mes en racha',
    emoji: '💥',
    color: '#fb7185',
    bg: 'rgba(251,113,133,0.12)',
    description: '30 días seguidos. Esto ya es religión.',
    rarity: 'epic',
    category: 'milestone',
    unlocks: { title: 'El Constante', frameColor: '#fb7185' },
  },

  top_3_weekly: {
    id: 'top_3_weekly',
    name: 'Podio semanal',
    emoji: '🥉',
    color: '#cd7f32',
    bg: 'rgba(205,127,50,0.16)',
    description: 'Terminaste TOP 3 en el ranking semanal de una jornada.',
    rarity: 'rare',
    category: 'season',
    unlocks: {
      title: 'El Podio',
    },
  },
  champion_weekly: {
    id: 'champion_weekly',
    name: 'Campeón semanal',
    emoji: '👑',
    color: '#fbbf24',
    bg: 'rgba(251,191,36,0.18)',
    description: 'Ganaste el ranking semanal de una jornada.',
    rarity: 'epic',
    category: 'season',
    unlocks: {
      title: 'Campeón Semanal',
      frameColor: '#fbbf24',
    },
  },

  // ── Mundial 2026 ────────────────────────────────────────────────
  profeta_mundial_2026: {
    id: 'profeta_mundial_2026',
    name: 'Profeta del Mundial',
    emoji: '🔮',
    color: '#fbbf24',
    bg: 'rgba(251,191,36,0.18)',
    description: 'Acertaste 3 o más predicciones long-term del Mundial 2026.',
    rarity: 'legendary',
    category: 'mundial',
    unlocks: {
      title: 'El Profeta',
      frameColor: '#fbbf24',
      cardBg: 'linear-gradient(135deg, rgba(245,158,11,0.18) 0%, rgba(180,83,9,0.10) 100%)',
    },
  },
  mundialista_2026: {
    id: 'mundialista_2026',
    name: 'Mundialista 2026',
    emoji: '🌍',
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.14)',
    description: 'Participaste en al menos una jornada del Mundial 2026. Badge conmemorativo.',
    rarity: 'rare',
    category: 'mundial',
    unlocks: {
      title: 'Mundialista 2026',
    },
  },
  top3_mundial_2026: {
    id: 'top3_mundial_2026',
    name: 'Podio Mundial 2026',
    emoji: '🏆',
    color: '#fbbf24',
    bg: 'rgba(251,191,36,0.20)',
    description: 'Terminaste TOP 3 en el ranking acumulado del Mundial 2026.',
    rarity: 'legendary',
    category: 'mundial',
    unlocks: {
      title: 'Podio Mundial',
      frameColor: '#fbbf24',
      cardBg: 'linear-gradient(135deg, rgba(251,191,36,0.22) 0%, rgba(180,83,9,0.12) 100%)',
    },
  },
}

export function getBadge(id: string): BadgeDef | null {
  return BADGES[id] ?? null
}

/** Lista todos los badges conocidos ordenados por rareza (legendary primero). */
export function listAllBadges(): BadgeDef[] {
  return Object.values(BADGES).sort((a, b) =>
    RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity] || a.name.localeCompare(b.name)
  )
}

/**
 * Toma una lista de badge_ids (de DB) y devuelve los N más prestigiosos
 * para mostrar en ranking público. Filtra desconocidos y privateOnly.
 */
export function selectDisplayBadges(badgeIds: string[], limit = 3): BadgeDef[] {
  const known = badgeIds
    .map(id => BADGES[id])
    .filter((b): b is BadgeDef => b != null && !b.privateOnly)
  // Orden: rareza desc, luego categoría mundial primero (visualmente más vistoso)
  known.sort((a, b) => {
    const r = RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity]
    if (r !== 0) return r
    if (a.category === 'mundial' && b.category !== 'mundial') return -1
    if (b.category === 'mundial' && a.category !== 'mundial') return 1
    return 0
  })
  return known.slice(0, limit)
}
