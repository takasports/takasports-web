import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { PlayerDetail } from '@/app/api/jugador/[slug]/route'
import PlayerPhoto from '@/components/PlayerPhoto'
import { accentForSport } from '@/lib/sports'
import type { TeamResult } from '@/app/api/team/[slug]/route'
import { ShareButton } from '@/components/ShareButton'
import BreadcrumbsNav from '@/components/BreadcrumbsNav'
import RelatedArticlesByEntity from '@/components/RelatedArticlesByEntity'
import PlayerStatsRadar, { hasRadarData } from '@/components/PlayerStatsRadar'
import { SITE_URL, SITE_NAME } from '@/lib/constants'

export const revalidate = 1800

// ── Metadata ──────────────────────────────────────────────────────────
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const player = await fetchPlayer(slug)
  if (!player) return { title: 'Jugador' }
  // Sin sufijo " | TakaSports": el root layout ya aplica title.template '%s | TakaSports'.
  const title = `${player.name} · ${player.leagueLabel}`
  const description = `${player.name}${player.position ? ` · ${player.position}` : ''}${
    player.team ? ` · ${player.team.name}` : ''
  } — estadísticas de la temporada en ${player.leagueLabel}`
  const canonical = `${SITE_URL}/jugador/${slug}`
  const ogImageUrl = player.photo ?? player.team?.logo ?? `${SITE_URL}/taka-icon.png`
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title, description,
      url: canonical,
      images: [{ url: ogImageUrl, width: 200, height: 200 }],
      type: 'profile', siteName: SITE_NAME,
    },
    // Sin `twitter` propio, X mostraba el default genérico del home. Se reflejan
    // título/descripción de la ficha; card 'summary' (cuadrada) porque el escudo
    // es 200×200 y encaja limpio (no estirado como en summary_large_image). (Fix A3 SEO)
    twitter: { card: 'summary', title, description, images: [ogImageUrl] },
  }
}

// ── Fetch ─────────────────────────────────────────────────────────────
async function fetchPlayer(slug: string): Promise<PlayerDetail | null> {
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL
      ?? (process.env.NODE_ENV === 'production' ? SITE_URL : 'http://localhost:3000')
    const res = await fetch(`${base}/api/jugador/${slug}`, { next: { revalidate: 1800 } })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

/** Lee un stat curado por label y lo convierte a número (formato es-ES tolerado). */
function statNum(stats: PlayerDetail['stats'], label: string): number | null {
  const raw = stats.find(s => s.label === label)?.value
  if (!raw) return null
  const n = parseFloat(raw.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
const fmtEs = (n: number) => n.toLocaleString('es-ES')

// ESPN devuelve la posición en inglés; en la cabecera hablamos español. El mapa es POR
// DEPORTE: "Forward" es Delantero en fútbol pero Alero en la NBA.
const POSITION_ES: Record<string, string> = {
  Forward: 'Delantero', Attacker: 'Delantero', Striker: 'Delantero',
  Midfielder: 'Centrocampista', 'Attacking Midfielder': 'Mediapunta',
  'Defensive Midfielder': 'Pivote', Defender: 'Defensa',
  'Centre-Back': 'Central', 'Full-Back': 'Lateral', Goalkeeper: 'Portero',
}
const POSITION_ES_NBA: Record<string, string> = {
  Forward: 'Alero', 'Small Forward': 'Alero', 'Power Forward': 'Ala-pívot',
  Guard: 'Exterior', 'Point Guard': 'Base', 'Shooting Guard': 'Escolta',
  Center: 'Pívot', 'Forward-Center': 'Ala-pívot', 'Guard-Forward': 'Alero',
}

const RESULT_STYLE: Record<string, { letter: string; color: string }> = {
  W: { letter: 'V', color: '#22c55e' },
  D: { letter: 'E', color: '#f59e0b' },
  L: { letter: 'D', color: '#ef4444' },
}

function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso)
    const currentYear = new Date().getFullYear()
    const opts: Intl.DateTimeFormatOptions = d.getFullYear() !== currentYear
      ? { day: '2-digit', month: 'short', year: 'numeric' }
      : { day: '2-digit', month: 'short' }
    return d.toLocaleDateString('es-ES', opts)
  } catch { return iso }
}

// ── Match row (player's club) ─────────────────────────────────────────
function MatchRow({ r, teamId }: { r: TeamResult; teamId: string }) {
  const resultColor = r.result === 'W' ? '#22c55e' : r.result === 'L' ? '#ef4444' : r.result === 'D' ? '#f59e0b' : undefined
  return (
    <Link href={`/partido/${r.matchRef}`}>
      <div
        className="flex items-center gap-3 py-3 px-4 rounded-xl mb-1.5 transition-all hover:bg-white/5"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderTop: '1px solid rgba(255,255,255,0.16)' }}
      >
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 text-[11px] font-black"
          style={{
            background: resultColor ? `${resultColor}22` : 'rgba(255,255,255,0.06)',
            color: resultColor ?? 'var(--text-muted)',
            fontFamily: 'var(--font-sport)',
          }}
        >
          {r.result ?? '•'}
        </div>
        <div className="text-[11px] text-[var(--text-muted)] w-16 flex-shrink-0">{formatShortDate(r.date)}</div>
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
            <span className="text-[13px] font-semibold truncate"
              style={{ color: r.homeTeam.id === teamId ? '#fff' : '#9A9AAA' }}>
              {r.homeTeam.abbr}
            </span>
            {r.homeTeam.logo && (
              <Image src={r.homeTeam.logo} alt={r.homeTeam.abbr} width={20} height={20} unoptimized
                style={{ objectFit: 'contain', flexShrink: 0 }} />
            )}
          </div>
          <div className="flex-shrink-0 text-[14px] font-black w-14 text-center"
            style={{ fontFamily: 'var(--font-display)', color: '#fff' }}>
            {`${r.homeScore ?? '?'} · ${r.awayScore ?? '?'}`}
          </div>
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {r.awayTeam.logo && (
              <Image src={r.awayTeam.logo} alt={r.awayTeam.abbr} width={20} height={20} unoptimized
                style={{ objectFit: 'contain', flexShrink: 0 }} />
            )}
            <span className="text-[13px] font-semibold truncate"
              style={{ color: r.awayTeam.id === teamId ? '#fff' : '#9A9AAA' }}>
              {r.awayTeam.abbr}
            </span>
          </div>
        </div>
        <span className="text-[#3A3A4A] flex-shrink-0">›</span>
      </div>
    </Link>
  )
}

// ── Content ───────────────────────────────────────────────────────────
function PlayerContent({ player }: { player: PlayerDetail }) {
  const sportSlug = player.leagueSlug.split('/')[0] === 'soccer' ? 'futbol'
    : player.leagueSlug.startsWith('basketball') ? 'baloncesto' : ''
  // Acento del deporte (fútbol verde, NBA naranja…) en vez del morado genérico.
  const accent = accentForSport(sportSlug || undefined)
  const isSoccer = sportSlug === 'futbol'

  const bio: string[] = []
  const posMap = sportSlug === 'baloncesto' ? POSITION_ES_NBA : POSITION_ES
  if (player.position) bio.push(posMap[player.position] ?? player.position)
  if (player.jersey) bio.push(`#${player.jersey}`)
  if (player.age != null) bio.push(`${player.age} años`)
  if (player.nationality) bio.push(player.nationality)
  if (player.height) bio.push(player.height)

  const showRadar = !!sportSlug && hasRadarData(player.stats)
  const hasRecent = player.recent.length > 0 && !!player.team

  // Titulares derivados (solo fútbol): calculados de las stats reales, nunca inventados.
  const goals = statNum(player.stats, 'Goles')
  const assists = statNum(player.stats, 'Asistencias')
  const minutes = statNum(player.stats, 'Minutos')
  const matches = statNum(player.stats, 'Partidos')
  const goalsPer90 = goals != null && minutes ? goals / (minutes / 90) : null
  const minPerGoal = goals && minutes ? Math.round(minutes / goals) : null
  // Forma: últimos 5 del log del jugador, de más antiguo (izq.) a más reciente (dcha.).
  const forma = (player.matchLog ?? []).slice(0, 5).reverse()
  // NBA: los valores ya vienen formateados del API ('26.8', '50.7%') → solo coma decimal.
  const isBasketball = sportSlug === 'baloncesto'
  const statStr = (label: string) => player.stats.find(s => s.label === label)?.value
  const esNum = (v?: string) => v?.replace('.', ',')
  const heroTiles = isSoccer
    ? ([
        goals != null && { value: fmtEs(goals), label: 'Goles', hot: true },
        assists != null && { value: fmtEs(assists), label: 'Asistencias' },
        minutes != null && {
          value: fmtEs(minutes),
          label: matches != null ? `Minutos (${fmtEs(matches)} PJ)` : 'Minutos',
        },
        goalsPer90 != null && { value: goalsPer90.toFixed(2).replace('.', ','), label: 'Goles / 90' },
        minPerGoal != null && { value: fmtEs(minPerGoal), label: 'Min / gol' },
      ].filter(Boolean) as { value: string; label: string; hot?: boolean }[])
    : isBasketball
      ? ([
          statStr('Puntos/partido') && { value: esNum(statStr('Puntos/partido'))!, label: 'PTS / partido', hot: true },
          statStr('Rebotes/partido') && { value: esNum(statStr('Rebotes/partido'))!, label: 'REB / partido' },
          statStr('Asist./partido') && { value: esNum(statStr('Asist./partido'))!, label: 'AST / partido' },
          statStr('% Tiros campo') && { value: esNum(statStr('% Tiros campo'))!, label: 'Tiros campo' },
          statStr('Partidos') && { value: statStr('Partidos')!, label: 'Partidos' },
        ].filter(Boolean) as { value: string; label: string; hot?: boolean }[])
      : []
  // Columnas de la tabla de partidos según deporte (línea del jugador).
  const logCols: { head: string; key: string; accent?: boolean; white?: boolean }[] = isSoccer
    ? [
        { head: 'G', key: 'totalGoals', accent: true },
        { head: 'A', key: 'goalAssists', white: true },
        { head: 'Tiros', key: 'totalShots' },
      ]
    : [
        { head: 'PTS', key: 'points', accent: true },
        { head: 'REB', key: 'totalRebounds', white: true },
        { head: 'AST', key: 'assists', white: true },
      ]
  const logGrid = isSoccer
    ? '52px minmax(0,1fr) 58px 24px 24px 40px'
    : '52px minmax(0,1fr) 58px 30px 30px 30px'
  const glassCard = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderTop: '1px solid rgba(255,255,255,0.16)',
  }

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 py-6">
      {/* Breadcrumbs semánticos — mirror del BreadcrumbList JSON-LD */}
      <BreadcrumbsNav
        items={[
          { label: 'Inicio', href: '/' },
          { label: 'Estadísticas', href: '/estadisticas' },
          ...(player.team
            ? [{ label: player.team.name, href: `/equipo/${player.team.slug ?? player.team.id}` }]
            : []),
          { label: player.name },
        ]}
        className="mb-4 text-[11px] flex items-center gap-2 flex-wrap"
      />

      {/* Back + Share */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/estadisticas/futbol"
          className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-white transition-colors"
          style={{ fontFamily: 'var(--font-sport)' }}
        >
          ‹ Volver a estadísticas
        </Link>
        <ShareButton title={`${player.name} · ${player.leagueLabel}`} />
      </div>

      {/* 2 columnas en escritorio: principal (perfil + estadísticas) + lateral (comparar / partidos / noticias).
          En móvil/tablet se apila (flex-col). */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* ── Columna principal ── */}
        <div className="flex-1 min-w-0 w-full">
          {/* Header — Vidrio Taka: panel translúcido con glow del deporte */}
          <div
            className="relative rounded-2xl p-5 mb-6 flex items-center gap-5 backdrop-blur-xl"
            style={glassCard}
          >
            <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none" aria-hidden>
              <div
                className="absolute -top-16 -left-10 w-56 h-56 rounded-full"
                style={{ background: `radial-gradient(circle, ${accent}2E, transparent 65%)`, filter: 'blur(26px)' }}
              />
            </div>
            <PlayerPhoto
              photo={player.photo}
              attribution={player.photoAttribution}
              headshot={player.headshot}
              teamLogo={player.team?.logo}
              teamName={player.team?.name}
              name={player.name}
              accent={accent}
              size={88}
            />
            <div className="relative flex-1 min-w-0">
              <div
                className="text-[11px] font-black uppercase tracking-widest mb-1 flex items-center gap-1.5"
                style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}
              >
                {player.flag && (
                  <Image src={player.flag} alt="" width={16} height={11} unoptimized
                    style={{ objectFit: 'contain' }} />
                )}
                {player.leagueLabel}
              </div>
              <h1 className="text-2xl font-black text-white leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
                {player.name}
              </h1>
              {bio.length > 0 && (
                <div className="text-[12px] text-[#9A9AAA] mt-1">{bio.join(' · ')}</div>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {player.team && (
                  <Link
                    href={`/equipo/${player.team.slug}`}
                    className="inline-flex items-center gap-1.5 text-[12px] font-semibold transition-opacity hover:opacity-80"
                    style={{ color: accent, fontFamily: 'var(--font-sport)' }}
                  >
                    {player.team.name} ›
                  </Link>
                )}
                {player.season && (
                  <span
                    className="text-[10px] font-bold tracking-wider rounded-md px-2 py-0.5"
                    style={{ color: accent, background: `${accent}1F`, border: `1px solid ${accent}4D`, fontFamily: 'var(--font-sport)' }}
                  >
                    {player.season}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Season stats — titulares derivados (fútbol) o grid clásico (otros deportes) */}
          {player.stats.length > 0 && (
            <>
              <div
                className="text-[10px] font-black uppercase tracking-widest mb-3"
                style={{ color: accent, fontFamily: 'var(--font-sport)' }}
              >
                {player.season ? `Temporada ${player.season}` : 'Estadísticas de la temporada'}
              </div>

              {heroTiles.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-2">
                  {heroTiles.map(t => (
                    <div
                      key={t.label}
                      className="rounded-xl p-3 text-center backdrop-blur-xl"
                      style={t.hot
                        ? { background: `${accent}14`, border: `1px solid ${accent}59`, borderTop: `1px solid ${accent}80` }
                        : glassCard}
                    >
                      <div className="text-xl font-black" style={{ fontFamily: 'var(--font-display)', color: t.hot ? accent : '#fff' }}>
                        {t.value}
                      </div>
                      <div className="text-[9px] uppercase tracking-wide mt-0.5" style={{ color: t.hot ? `${accent}B3` : 'var(--text-muted)' }}>
                        {t.label}
                      </div>
                    </div>
                  ))}
                  {forma.length > 0 && (
                    <div className="rounded-xl p-3 text-center backdrop-blur-xl" style={glassCard}>
                      <div className="flex justify-center gap-1 mt-1">
                        {forma.map(m => {
                          const rs = RESULT_STYLE[m.result ?? ''] ?? { letter: '·', color: '#9A9AAA' }
                          return (
                            <span
                              key={m.eventId}
                              className="w-[15px] h-[15px] rounded text-[9px] font-black flex items-center justify-center"
                              style={{ background: `${rs.color}26`, color: rs.color }}
                            >
                              {rs.letter}
                            </span>
                          )
                        })}
                      </div>
                      <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wide mt-1.5">Forma</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
                  {player.stats.map(s => (
                    <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div className="text-xl font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>
                        {s.value}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Grid completo plegado: los titulares mandan, el detalle no estorba */}
              {heroTiles.length > 0 && (
                <details className="group rounded-2xl mb-6 backdrop-blur-xl" style={glassCard}>
                  <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none flex items-center gap-2 px-4 py-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white" style={{ fontFamily: 'var(--font-sport)' }}>
                      Todas las estadísticas
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">{player.stats.length}</span>
                    <span className="ml-auto text-[11px] text-[var(--text-muted)] transition-transform group-open:rotate-180">▾</span>
                  </summary>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 px-4 pb-4">
                    {player.stats.map(s => (
                      <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <div className="text-xl font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>
                          {s.value}
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mt-0.5">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* Perfil de rendimiento — radar/barras que se "viste" del deporte */}
              {showRadar && (
                <div
                  data-sport={sportSlug}
                  className="rounded-2xl p-5 mb-6 backdrop-blur-xl"
                  style={glassCard}
                >
                  <div
                    className="text-[10px] font-black uppercase tracking-widest mb-4"
                    style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}
                  >
                    Perfil de rendimiento
                  </div>
                  <PlayerStatsRadar stats={player.stats} />
                </div>
              )}
            </>
          )}

          {/* Últimos partidos — la línea DEL JUGADOR (no la del club) */}
          {(isSoccer || isBasketball) && (player.matchLog?.length ?? 0) > 0 && (
            <>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: accent, fontFamily: 'var(--font-sport)' }}>
                  Últimos partidos
                </span>
                <span className="text-[9px] font-semibold rounded px-1.5 py-0.5" style={{ color: accent, background: `${accent}1F` }}>
                  línea del jugador
                </span>
              </div>
              <div className="rounded-2xl mb-6 overflow-hidden backdrop-blur-xl" style={glassCard}>
                <div
                  className="grid gap-1 px-4 py-2 text-[9px] uppercase tracking-wider text-[var(--text-muted)]"
                  style={{ gridTemplateColumns: logGrid, borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <span>Fecha</span><span>Rival</span><span className="text-center">Res</span>
                  {logCols.map(c => <span key={c.head} className="text-center">{c.head}</span>)}
                </div>
                {player.matchLog!.map((m, i) => {
                  const rs = m.result ? RESULT_STYLE[m.result] : undefined
                  return (
                    <div
                      key={m.eventId}
                      className="grid gap-1 px-4 py-2.5 items-center text-[12px] text-[#DDDDE6]"
                      style={{
                        gridTemplateColumns: logGrid,
                        borderBottom: i < player.matchLog!.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      }}
                    >
                      <span className="text-[11px] text-[var(--text-muted)]">{formatShortDate(m.date)}</span>
                      <span className="flex items-center gap-1.5 min-w-0">
                        {m.opponentLogo && (
                          <Image src={m.opponentLogo} alt="" width={16} height={16} unoptimized
                            style={{ objectFit: 'contain', flexShrink: 0 }} />
                        )}
                        <span className="truncate">{m.homeAway === '@' ? '@' : 'vs'} {m.opponent}</span>
                      </span>
                      <span className="text-center">
                        {rs ? (
                          <span className="text-[10px] font-bold rounded px-1.5 py-0.5" style={{ color: rs.color, background: `${rs.color}22` }}>
                            {rs.letter} {m.score ?? ''}
                          </span>
                        ) : (
                          <span className="text-[10px] text-[var(--text-muted)]">{m.score ?? '—'}</span>
                        )}
                      </span>
                      {logCols.map(c => {
                        const v = m.stats[c.key] ?? 0
                        const color = c.accent && v > 0 ? accent : c.white && v > 0 ? '#fff' : undefined
                        return (
                          <span
                            key={c.head}
                            className={`text-center${color ? ' font-black' : ''}`}
                            style={color ? { color, fontFamily: 'var(--font-display)' } : undefined}
                          >
                            {v}
                          </span>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* Trayectoria — desplegable, abierto por defecto */}
          {(player.career?.length ?? 0) > 0 && (
            <details open className="group rounded-2xl mb-2 backdrop-blur-xl" style={glassCard}>
              <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none flex items-center gap-2 px-4 py-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-white" style={{ fontFamily: 'var(--font-sport)' }}>
                  Trayectoria
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">
                  {player.career!.length} {player.career!.length === 1 ? 'club' : 'clubes'}
                </span>
                <span className="ml-auto text-[11px] text-[var(--text-muted)] transition-transform group-open:rotate-180">▾</span>
              </summary>
              <div className="px-4 pb-4">
                <div className="pl-3 space-y-2.5" style={{ borderLeft: `2px solid ${accent}66` }}>
                  {player.career!.map(c => (
                    <div key={`${c.club}-${c.from ?? ''}`}>
                      <div className="text-[12px] font-bold text-white flex items-center gap-1.5">
                        {c.club}
                        {!c.to && (
                          <span className="text-[9px] font-bold rounded px-1.5 py-px" style={{ color: accent, background: `${accent}1F` }}>
                            ACTUAL
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)]">{c.from ?? '?'} — {c.to ?? 'hoy'}</div>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          )}

          {/* Distinciones individuales — desplegable, plegado por defecto */}
          {(player.honors?.length ?? 0) > 0 && (
            <details className="group rounded-2xl mb-6 backdrop-blur-xl" style={glassCard}>
              <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none flex items-center gap-2 px-4 py-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-white" style={{ fontFamily: 'var(--font-sport)' }}>
                  Distinciones
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">
                  {player.honors!.length} {player.honors!.length === 1 ? 'premio' : 'premios'}
                </span>
                <span className="ml-auto text-[11px] text-[var(--text-muted)] transition-transform group-open:rotate-180">▾</span>
              </summary>
              <div className="px-4 pb-4">
                <div className="flex flex-wrap gap-1.5">
                  {player.honors!.map(h => (
                    <span
                      key={`${h.title}-${h.year ?? ''}`}
                      className="text-[11px] rounded-md px-2 py-1 text-[#DDDDE6]"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}
                    >
                      {h.title}{h.year ? ` · ${h.year}` : ''}
                    </span>
                  ))}
                </div>
                <div className="text-[9px] text-[var(--text-muted)] mt-2">Premios individuales.</div>
              </div>
            </details>
          )}

          {player.stats.length === 0 && !hasRecent && (
            <div className="text-center py-10 text-[var(--text-muted)] text-sm">
              Sin estadísticas disponibles para este jugador
            </div>
          )}
        </div>

        {/* ── Barra lateral ── */}
        <aside className="w-full lg:w-72 xl:w-80 flex-shrink-0 space-y-4">
          {/* Comparar */}
          <Link
            href={`/comparar?p1=${player.leagueSlug.replaceAll('/', '_')}_${player.id}`}
            className="block rounded-2xl p-4 transition-opacity hover:opacity-90"
            style={{ background: 'rgba(124,58,237,0.10)', border: '1px solid rgba(124,58,237,0.25)' }}
          >
            <div className="text-[13px] font-bold text-white" style={{ fontFamily: 'var(--font-sport)' }}>⇄ Comparar jugador</div>
            <div className="text-[11px] text-[#9A9AAA] mt-0.5">Mídelo contra otro crack de la liga.</div>
          </Link>

          {/* Club recent matches */}
          {hasRecent && (
            <div
              className="rounded-2xl p-4"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderTop: '1px solid rgba(255,255,255,0.16)' }}
            >
              <div
                className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-3"
                style={{ fontFamily: 'var(--font-sport)' }}
              >
                Últimos partidos · {player.team!.name}
              </div>
              {player.recent.map(r => (
                <MatchRow key={r.matchRef} r={r} teamId={player.team!.id} />
              ))}
            </div>
          )}

          {/* Noticias relacionadas con el jugador */}
          <Suspense>
            <RelatedArticlesByEntity entityName={player.name} limit={6} />
          </Suspense>
        </aside>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────
export default async function JugadorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const player = await fetchPlayer(slug)
  if (!player) notFound()

  const canonicalUrl = `${SITE_URL}/jugador/${slug}`

  const playerJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: player.name,
    url: canonicalUrl,
    ...(player.photo || player.headshot ? { image: player.photo ?? player.headshot } : {}),
    ...(player.nationality ? { nationality: { '@type': 'Country', name: player.nationality } } : {}),
    ...(player.position ? { jobTitle: player.position } : {}),
    // `sameAs` a Wikidata es la señal que DESAMBIGUA al atleta como entidad: sin ella
    // Google no puede unir esta ficha al deportista real (hay homónimos de sobra) y no
    // opta a Knowledge Panel. El QID viene ya corroborado por nacionalidad/club/fecha
    // en player-wikidata.ts, así que no se enlaza a un homónimo.
    ...(player.wikidataQid ? { sameAs: [`https://www.wikidata.org/wiki/${player.wikidataQid}`] } : {}),
    ...(player.birthDate ? { birthDate: player.birthDate } : {}),
    ...(player.height ? { height: player.height } : {}),
    // P166 de Wikidata: distinciones INDIVIDUALES (Balón de Oro, Bota de Oro…), ya
    // filtradas de ruido no deportivo. Los títulos de equipo no entran aquí.
    ...(player.honors?.length
      ? { award: player.honors.map(h => (h.year ? `${h.title} (${h.year})` : h.title)) }
      : {}),
    ...(player.team ? {
      memberOf: {
        '@type': 'SportsTeam',
        name: player.team.name,
        url: `${SITE_URL}/equipo/${player.team.slug}`,
      },
    } : {}),
    ...(player.leagueLabel ? {
      affiliation: {
        '@type': 'SportsOrganization',
        name: player.leagueLabel,
      },
    } : {}),
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Estadísticas', item: `${SITE_URL}/estadisticas` },
      ...(player.team
        ? [{ '@type': 'ListItem', position: 3, name: player.team.name, item: `${SITE_URL}/equipo/${player.team.slug ?? player.team.id}` }]
        : []),
      { '@type': 'ListItem', position: player.team ? 4 : 3, name: player.name, item: canonicalUrl },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(playerJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
        <Suspense>
          <PlayerContent player={player} />
        </Suspense>
      </div>
    </>
  )
}
