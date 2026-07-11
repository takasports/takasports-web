'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import Link from 'next/link'
import { trackGameStart, trackGameComplete } from '@/lib/analytics'
import GameLayout from '@/components/games/GameLayout'
import { searchPlayers, getPlayerById, type Player, type PlayerPosition } from '@/lib/players-catalog'
import { getWeeklyChallenge, type FormationId, type Challenge, type SlotTag } from '@/lib/mionce-challenges'
import { FORMATIONS, FORMATION_LIST, type SlotDef } from '@/lib/mionce-formations'
import { CountryFlag, LockIcon, ClipboardIcon } from '@/components/icons/GameIcons'
import { ensureAudio, getSoundPref, winFanfare, fireConfetti } from '@/lib/game-feedback'
import { recordPlay, currentWeekISO, type GamePlay } from '@/lib/games-store'
import { trackGameEvent } from '@/lib/games-telemetry'
import GameOnboarding from '@/components/games/GameOnboarding'
import { reportPlay } from '@/lib/missions'
import { collectPlayer } from '@/lib/album'
import { saveLineup, SAVED_LINEUP_LIMIT, loadSavedLineups } from '@/lib/mionce-saved'
import { useSearchParams, useRouter } from 'next/navigation'
import PostGameResultModal from '@/components/games/PostGameResultModal'
import GamePointsToast from '@/components/games/GamePointsToast'

// ── Constants ────────────────────────────────────────────────────

const STORAGE_KEY = 'ts_mionce_state'
const SCORED_KEY = 'ts_mionce_scored'  // guard anti-farmeo: última semana ISO puntuada + mejor score
const ACCENT = '#93C5FD'
const ACCENT_DIM = '#2563EB'

// SlotDef + FORMATIONS + FORMATION_LIST viven en @/lib/mionce-formations (fuente
// única, compartida con el generador de tableros y el test de solvencia).

// ── Types ────────────────────────────────────────────────────────

interface StoredState {
  weekKey: string
  formation: FormationId
  slots: Record<string, string>  // slotId -> playerId
}


// ── Helpers ──────────────────────────────────────────────────────

function loadState(): StoredState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function saveState(s: StoredState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch { /* ignore */ }
}

// Guard anti-farmeo: marca de la última semana ISO puntuada + mejor score de esa
// semana. Clave separada de StoredState para no acoplarse al orden del efecto de
// persistencia de slots (que corre antes que el efecto de cierre).
interface ScoredState { week: string; best: number }

function loadScored(): ScoredState | null {
  try {
    const raw = localStorage.getItem(SCORED_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function saveScored(s: ScoredState) {
  try {
    localStorage.setItem(SCORED_KEY, JSON.stringify(s))
  } catch { /* ignore */ }
}

// ── Icons ────────────────────────────────────────────────────────

function IconClose() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function IconSearch() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="6" cy="6" r="4.25" stroke="currentColor" strokeWidth="1.4" />
      <path d="M9.5 9.5L12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function IconBack() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M11 7H3M6.5 3.5L3 7l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconShare() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="11" cy="3" r="1.8" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="3" cy="7" r="1.8" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="11" cy="11" r="1.8" stroke="currentColor" strokeWidth="1.3" />
      <path d="M9.5 4L4.5 6.2M4.5 7.8L9.5 10" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}

function IconImage() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1.5" y="2.5" width="11" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="4.5" cy="5.5" r="1" fill="currentColor" />
      <path d="M1.5 9.5l3-3 2.5 2.5 2-2 3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Share image generator (Canvas 2D) ───────────────────────────

function generateShareImage(
  formationSlots: SlotDef[],
  playerSlots: Record<string, string>,
  challengeTitle: string,
  formation: FormationId,
  weekKey: string,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const W = 600
    const H = 900
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) { reject(new Error('no canvas')); return }

    // ── Fondo ──────────────────────────────────────────────────
    ctx.fillStyle = '#09090F'
    ctx.fillRect(0, 0, W, H)

    // Glow azul top-left
    const glowTL = ctx.createRadialGradient(0, 0, 0, 0, 0, 400)
    glowTL.addColorStop(0, 'rgba(37,99,235,0.18)')
    glowTL.addColorStop(1, 'transparent')
    ctx.fillStyle = glowTL
    ctx.fillRect(0, 0, W, H)

    // Glow azul bottom-right
    const glowBR = ctx.createRadialGradient(W, H, 0, W, H, 360)
    glowBR.addColorStop(0, 'rgba(147,197,253,0.08)')
    glowBR.addColorStop(1, 'transparent')
    ctx.fillStyle = glowBR
    ctx.fillRect(0, 0, W, H)

    // ── Header ─────────────────────────────────────────────────
    const HEADER_H = 100
    // Logo
    ctx.font = 'bold 28px "Arial Black", Arial, sans-serif'
    ctx.fillStyle = '#FFFFFF'
    ctx.fillText('TAKA', 32, 46)
    ctx.fillStyle = '#93C5FD'
    const takaW = ctx.measureText('TAKA').width
    ctx.fillText('SPORTS', 32 + takaW, 46)

    // Dot separador + semana
    ctx.font = '600 11px Arial, sans-serif'
    ctx.fillStyle = 'rgba(147,197,253,0.7)'
    ctx.fillText(`MI ONCE  ·  ${weekKey}  ·  ${formation}`, 32, 68)

    // Línea separadora
    ctx.strokeStyle = 'rgba(147,197,253,0.15)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(32, HEADER_H - 8)
    ctx.lineTo(W - 32, HEADER_H - 8)
    ctx.stroke()

    // Título reto
    ctx.font = 'bold 18px "Arial Black", Arial, sans-serif'
    ctx.fillStyle = '#F0F0F5'
    const maxTitleW = W - 64
    let title = challengeTitle
    // Truncar si muy largo
    while (ctx.measureText(title).width > maxTitleW && title.length > 10) {
      title = title.slice(0, -1)
    }
    if (title !== challengeTitle) title += '…'
    ctx.fillText(title, 32, HEADER_H + 26)

    // ── Campo ──────────────────────────────────────────────────
    const FIELD_X = 30
    const FIELD_Y = HEADER_H + 50
    const FIELD_W = W - 60
    const FIELD_H = 620

    // Fondo verde con franjas
    const greenGrad = ctx.createLinearGradient(FIELD_X, FIELD_Y, FIELD_X, FIELD_Y + FIELD_H)
    greenGrad.addColorStop(0, '#0a3d1f')
    greenGrad.addColorStop(0.5, '#0d4a26')
    greenGrad.addColorStop(1, '#0a3d1f')
    ctx.fillStyle = greenGrad
    ctx.beginPath()
    ctx.roundRect(FIELD_X, FIELD_Y, FIELD_W, FIELD_H, 12)
    ctx.fill()

    // Franjas alternadas
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(FIELD_X, FIELD_Y, FIELD_W, FIELD_H, 12)
    ctx.clip()
    const stripeH = FIELD_H / 10
    for (let i = 0; i < 10; i++) {
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.03)'
        ctx.fillRect(FIELD_X, FIELD_Y + i * stripeH, FIELD_W, stripeH)
      }
    }
    ctx.restore()

    // Marcas del campo
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(FIELD_X, FIELD_Y, FIELD_W, FIELD_H, 12)
    ctx.clip()
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'
    ctx.lineWidth = 1.2

    const fx = FIELD_X, fy = FIELD_Y, fw = FIELD_W, fh = FIELD_H

    // Borde
    ctx.strokeRect(fx + 10, fy + 10, fw - 20, fh - 20)
    // Línea media
    ctx.beginPath()
    ctx.moveTo(fx + 10, fy + fh / 2)
    ctx.lineTo(fx + fw - 10, fy + fh / 2)
    ctx.stroke()
    // Círculo central
    ctx.beginPath()
    ctx.arc(fx + fw / 2, fy + fh / 2, fh * 0.08, 0, Math.PI * 2)
    ctx.stroke()
    // Punto central
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.beginPath()
    ctx.arc(fx + fw / 2, fy + fh / 2, 3, 0, Math.PI * 2)
    ctx.fill()

    // Área grande inferior (portería propia)
    const areaW = fw * 0.55, areaH = fh * 0.12
    ctx.strokeRect(fx + (fw - areaW) / 2, fy + fh - 10 - areaH, areaW, areaH)
    // Área pequeña inferior
    const smallW = fw * 0.3, smallH = fh * 0.055
    ctx.strokeRect(fx + (fw - smallW) / 2, fy + fh - 10 - smallH, smallW, smallH)

    // Área grande superior
    ctx.strokeRect(fx + (fw - areaW) / 2, fy + 10, areaW, areaH)
    ctx.strokeRect(fx + (fw - smallW) / 2, fy + 10, smallW, smallH)

    ctx.restore()

    // ── Jugadores ──────────────────────────────────────────────
    const AVATAR_R = 22
    const LABEL_PAD = 4

    formationSlots.forEach(slot => {
      const pid = playerSlots[slot.id]
      const player = pid ? getPlayerById(pid) : null

      // Coordenadas: x% del campo, bottom y% del campo
      const cx = fx + (slot.x / 100) * fw
      const cy = fy + fh - (slot.y / 100) * fh

      if (player) {
        // Círculo relleno azul
        const grad = ctx.createRadialGradient(cx - AVATAR_R * 0.3, cy - AVATAR_R * 0.3, 0, cx, cy, AVATAR_R)
        grad.addColorStop(0, '#3B82F6')
        grad.addColorStop(1, '#1E3A8A')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(cx, cy, AVATAR_R, 0, Math.PI * 2)
        ctx.fill()

        // Borde
        ctx.strokeStyle = '#93C5FD'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(cx, cy, AVATAR_R, 0, Math.PI * 2)
        ctx.stroke()

        // Iniciales
        const initials = player.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')
        ctx.font = 'bold 12px "Arial Black", Arial, sans-serif'
        ctx.fillStyle = '#FFFFFF'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(initials, cx, cy)

        // Apellido en cápsula
        const apellido = player.name.split(' ').slice(-1)[0].toUpperCase()
        ctx.font = 'bold 9px Arial, sans-serif'
        const labelW = Math.min(ctx.measureText(apellido).width + LABEL_PAD * 2 + 4, fw * 0.25)
        const labelH = 16
        const labelX = cx - labelW / 2
        const labelY = cy + AVATAR_R + 3

        ctx.fillStyle = 'rgba(0,0,0,0.75)'
        ctx.beginPath()
        ctx.roundRect(labelX, labelY, labelW, labelH, 4)
        ctx.fill()

        ctx.fillStyle = '#F0F0F5'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        // Truncar apellido si necesario
        let ap = apellido
        while (ctx.measureText(ap).width > labelW - LABEL_PAD * 2 && ap.length > 3) ap = ap.slice(0, -1)
        if (ap !== apellido) ap += '.'
        ctx.fillText(ap, cx, labelY + labelH / 2)
      } else {
        // Círculo vacío punteado
        ctx.setLineDash([4, 3])
        ctx.strokeStyle = 'rgba(147,197,253,0.4)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(cx, cy, AVATAR_R, 0, Math.PI * 2)
        ctx.stroke()
        ctx.setLineDash([])

        // Label de posición
        ctx.font = 'bold 10px "Arial Black", Arial, sans-serif'
        ctx.fillStyle = 'rgba(147,197,253,0.6)'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(slot.label, cx, cy)
      }
    })

    // ── Footer ─────────────────────────────────────────────────
    const FOOTER_Y = FIELD_Y + FIELD_H + 20
    ctx.textAlign = 'center'
    ctx.font = '500 12px Arial, sans-serif'
    ctx.fillStyle = 'rgba(147,197,253,0.5)'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText('takasportsmedia.com', W / 2, FOOTER_Y + 20)

    // Puntos decorativos
    ctx.fillStyle = 'rgba(147,197,253,0.3)'
    ctx.beginPath()
    ctx.arc(W / 2 - 90, FOOTER_Y + 15, 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(W / 2 + 90, FOOTER_Y + 15, 2, 0, Math.PI * 2)
    ctx.fill()

    canvas.toBlob(blob => {
      if (blob) resolve(blob)
      else reject(new Error('canvas toBlob failed'))
    }, 'image/png')
  })
}

function IconReset() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 4.5h6c2.2 0 3.5 1.4 3.5 3.5s-1.3 3.5-3.5 3.5H4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 2L2 4.5 4 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Player search modal ─────────────────────────────────────────

interface SearchModalProps {
  slot: SlotDef
  challenge: Challenge
  slotTag: SlotTag | null
  excludeIds: string[]
  excludedClubs: Set<string>
  onSelect: (player: Player) => void
  onClose: () => void
}

function PlayerSearchModal({ slot, challenge, slotTag, excludeIds, excludedClubs, onSelect, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // a11y: recuerda quién abrió el diálogo para devolverle el foco al cerrar.
    const opener = document.activeElement as HTMLElement | null
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      // Focus trap: Tab cicla dentro del diálogo.
      if (e.key === 'Tab' && containerRef.current) {
        const f = containerRef.current.querySelectorAll<HTMLElement>('button, input, [href], [tabindex]:not([tabindex="-1"])')
        if (f.length === 0) return
        const first = f[0], last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      opener?.focus?.()   // devuelve el foco al hueco que abrió el buscador
    }
  }, [onClose])

  const results = useMemo(() => {
    // Con query vacía traemos un pool amplio ANTES del filtro de club del slotTag,
    // para que un slot con club no oculte jugadores válidos por el corte de límite.
    let all = searchPlayers(query, { position: slot.position, excludeIds, limit: query ? 60 : 400 })
    if (challenge.filter) all = all.filter(challenge.filter)
    if (slotTag) all = all.filter(slotTag.match)
    if (challenge.noRepeatClub && excludedClubs.size > 0) all = all.filter(p => !excludedClubs.has(p.club))
    return all.slice(0, 60)
  }, [query, slot.position, excludeIds, challenge, slotTag, excludedClubs])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mionce-search-title"
        className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--bg-card)', border: `1px solid ${ACCENT_DIM}40`, maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[10px] font-black"
            style={{ background: `${ACCENT_DIM}28`, color: ACCENT, border: `1px solid ${ACCENT_DIM}40`, fontFamily: 'var(--font-sport)' }}
          >
            {slot.label}
          </div>
          <div className="flex-1 min-w-0">
            <p id="mionce-search-title" className="text-[10px] font-black uppercase tracking-widest" style={{ color: ACCENT, fontFamily: 'var(--font-sport)' }}>
              Buscar {slot.position === 'GK' ? 'portero' : slot.position === 'DEF' ? 'defensa' : slot.position === 'MID' ? 'centrocampista' : 'delantero'}
            </p>
            {slotTag ? (
              <p className="text-xs mt-0.5 inline-flex items-center gap-1.5" style={{ color: '#F0F0F5' }}>
                <span>{slotTag.emoji}</span>
                <span className="font-bold">Solo {slotTag.label.toLowerCase()}</span>
                {challenge.noRepeatClub && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(220,38,38,0.12)', color: '#FCA5A5', border: '1px solid rgba(220,38,38,0.25)' }}>
                    sin repetir club
                  </span>
                )}
              </p>
            ) : (
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {challenge.title}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)' }}
            aria-label="Cerrar"
          >
            <IconClose />
          </button>
        </div>

        {/* Search input */}
        <div className="p-4 pb-2">
          <div
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <span style={{ color: 'var(--text-muted)' }}><IconSearch /></span>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Nombre del jugador o club…"
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: '#F0F0F5' }}
            />
            {query && (
              <button onClick={() => setQuery('')} style={{ color: 'var(--text-muted)' }}>
                <IconClose />
              </button>
            )}
          </div>
        </div>

        {/* Results list */}
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {results.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No hay jugadores que encajen.
              </p>
              <p className="text-[11px] mt-1" style={{ color: '#3A3A52' }}>
                Prueba a cambiar el término de búsqueda.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-1">
              {results.map(p => (
                <li key={p.id}>
                  <button
                    onClick={() => onSelect(p)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left hover:bg-white/5"
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-black flex-shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${ACCENT_DIM}40, ${ACCENT_DIM}10)`,
                        color: ACCENT,
                        border: `1px solid ${ACCENT_DIM}40`,
                        fontFamily: 'var(--font-display)',
                      }}
                    >
                      {p.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black truncate flex items-center gap-1.5" style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)' }}>
                        <CountryFlag country={p.country} width={16} />
                        <span className="truncate">{p.name}</span>
                      </p>
                      {/* FASE 9 "sin pista": NO mostramos el club del jugador en los
                          resultados (era la pista que confirmaba la respuesta). El
                          enunciado del hueco —"Solo {club}"— sigue en la cabecera. */}
                    </div>
                    <span
                      className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{
                        background: p.era === 'current' ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)',
                        color: p.era === 'current' ? '#4ade80' : '#5A5A7A',
                        fontFamily: 'var(--font-sport)',
                      }}
                    >
                      {p.era === 'current' ? 'Activo' : 'Leyenda'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Pitch slot ───────────────────────────────────────────────────

interface PitchSlotProps {
  slot: SlotDef
  player: Player | null
  slotTag: SlotTag | null
  isValid: boolean
  onClick: () => void
  onClear: () => void
}

function PitchSlot({ slot, player, slotTag, isValid, onClick, onClear }: PitchSlotProps) {
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${slot.x}%`, bottom: `${slot.y}%` }}
    >
      {player ? (
        <div className="relative group">
          <button
            onClick={onClick}
            aria-label={`${player.name} en ${slot.label}${slotTag ? ` (${slotTag.label})` : ''}: ${isValid ? 'válido' : 'no válido'}. Pulsa para cambiar.`}
            className="flex flex-col items-center gap-1 transition-transform hover:scale-105"
          >
            <div
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-xs sm:text-sm font-black"
              style={{
                background: isValid
                  ? `linear-gradient(135deg, ${ACCENT_DIM}, #1E3A8A)`
                  : 'linear-gradient(135deg, #7F1D1D, #450a0a)',
                color: '#fff',
                border: `2px solid ${isValid ? ACCENT : '#FCA5A5'}`,
                boxShadow: `0 4px 16px ${isValid ? `${ACCENT_DIM}60` : 'rgba(220,38,38,0.5)'}, 0 0 0 3px rgba(0,0,0,0.4)`,
                fontFamily: 'var(--font-display)',
              }}
            >
              {player.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
            </div>
            <div
              className="px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-black whitespace-nowrap max-w-[90px] sm:max-w-[110px] truncate inline-flex items-center gap-1"
              style={{
                background: 'rgba(0,0,0,0.7)',
                color: '#F0F0F5',
                border: '1px solid rgba(255,255,255,0.1)',
                fontFamily: 'var(--font-display)',
              }}
            >
              <CountryFlag country={player.country} width={11} />
              <span className="truncate">{player.name.split(' ').slice(-1)[0]}</span>
            </div>
          </button>
          <span
            aria-hidden
            className="absolute -top-1 -left-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black"
            style={{ background: isValid ? ACCENT_DIM : '#7F1D1D', color: '#fff', border: '2px solid #0F0A20' }}
          >
            {isValid ? '✓' : '✗'}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onClear() }}
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
            style={{ background: '#DC2626', color: '#fff', border: '2px solid #0F0A20' }}
            aria-label="Quitar jugador"
          >
            <IconClose />
          </button>
        </div>
      ) : (
        <button
          onClick={onClick}
          className="flex flex-col items-center gap-1 transition-transform hover:scale-110"
        >
          <div
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center"
            style={{
              background: 'rgba(0,0,0,0.4)',
              color: ACCENT,
              border: `2px dashed ${ACCENT}80`,
              backdropFilter: 'blur(2px)',
            }}
          >
            <IconPlus />
          </div>
          <span
            className="px-1.5 py-0.5 rounded text-[9px] font-black"
            style={{
              background: 'rgba(0,0,0,0.6)',
              color: ACCENT,
              fontFamily: 'var(--font-sport)',
              letterSpacing: '0.08em',
            }}
          >
            {slot.label}
          </span>
          {slotTag && (
            <span
              className="mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-black inline-flex items-center gap-1 whitespace-nowrap"
              style={{
                background: 'rgba(252,211,77,0.18)',
                color: '#FCD34D',
                border: '1px solid rgba(252,211,77,0.35)',
                fontFamily: 'var(--font-sport)',
              }}
              title={slotTag.label}
            >
              <span>{slotTag.emoji}</span>
              <span className="hidden sm:inline">{slotTag.label}</span>
            </span>
          )}
        </button>
      )}
    </div>
  )
}

// ── Pitch ────────────────────────────────────────────────────────

function Pitch({ slots, players, slotTags, validBySlot, onSlotClick, onSlotClear }: {
  slots: SlotDef[]
  players: Record<string, string>
  slotTags: Record<string, SlotTag> | undefined
  validBySlot: Record<string, boolean>
  onSlotClick: (slot: SlotDef) => void
  onSlotClear: (slotId: string) => void
}) {
  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden"
      style={{
        aspectRatio: '3 / 4',
        background: 'linear-gradient(180deg, #0a3d1f 0%, #0d4a26 50%, #0a3d1f 100%)',
        border: `1px solid ${ACCENT_DIM}40`,
        boxShadow: `inset 0 0 80px rgba(0,0,0,0.5)`,
      }}
    >
      {/* Stripes */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent 0, transparent 10%, rgba(255,255,255,0.08) 10%, rgba(255,255,255,0.08) 20%)',
        }}
      />

      {/* Field markings */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 133" preserveAspectRatio="none">
        {/* Outer */}
        <rect x="2" y="2" width="96" height="129" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.4" />
        {/* Halfway line */}
        <line x1="2" y1="66.5" x2="98" y2="66.5" stroke="rgba(255,255,255,0.35)" strokeWidth="0.4" />
        {/* Center circle */}
        <circle cx="50" cy="66.5" r="10" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.4" />
        <circle cx="50" cy="66.5" r="0.6" fill="rgba(255,255,255,0.5)" />
        {/* Bottom box (own goal) */}
        <rect x="28" y="119" width="44" height="12" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.4" />
        <rect x="38" y="127" width="24" height="4" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.4" />
        <circle cx="50" cy="123" r="0.6" fill="rgba(255,255,255,0.5)" />
        {/* Top box (opponent goal) */}
        <rect x="28" y="2" width="44" height="12" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.4" />
        <rect x="38" y="2" width="24" height="4" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.4" />
        <circle cx="50" cy="10" r="0.6" fill="rgba(255,255,255,0.5)" />
        {/* Corners */}
        <path d="M2,4 A2,2 0 0 0 4,2" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.3" />
        <path d="M96,2 A2,2 0 0 0 98,4" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.3" />
        <path d="M2,129 A2,2 0 0 1 4,131" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.3" />
        <path d="M98,129 A2,2 0 0 0 96,131" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.3" />
      </svg>

      {/* Slots */}
      {slots.map(slot => {
        const playerId = players[slot.id]
        const player = playerId ? getPlayerById(playerId) ?? null : null
        const slotTag = slotTags?.[slot.id] ?? null
        return (
          <PitchSlot
            key={slot.id}
            slot={slot}
            player={player}
            slotTag={slotTag}
            isValid={validBySlot[slot.id] ?? true}
            onClick={() => onSlotClick(slot)}
            onClear={() => onSlotClear(slot.id)}
          />
        )
      })}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────

export default function MiOncePage() {
  const [hydrated, setHydrated] = useState(false)
  const [formation, setFormation] = useState<FormationId>('4-3-3')
  const [slots, setSlots] = useState<Record<string, string>>({})
  const [activeSlot, setActiveSlot] = useState<SlotDef | null>(null)
  const [shareToast, setShareToast] = useState<string | null>(null)
  // Puntos acreditadas al Ranked tras recordPlay (auto-dismiss 5s en
  // GamePointsToast; null = sin respuesta o sin puntos por idempotencia/cap).
  const [awardedPoints, setAwardedPoints] = useState<number | null>(null)
  // Anti-farmeo (ver loadScored): la última semana ya puntuada y la mejor marca.
  // Persisten en localStorage para sobrevivir a recargas y a quitar+poner.
  const scoredWeekRef = useRef<string | null>(null)
  const bestScoreRef = useRef(0)

  const { challenge, week } = useMemo(() => getWeeklyChallenge(), [])
  const searchParams = useSearchParams()
  const router = useRouter()

  // Hydrate from localStorage; reset si la semana cambió
  useEffect(() => {
    const stored = loadState()
    if (stored && stored.weekKey === week.key) {
      setFormation(stored.formation)
      setSlots(stored.slots ?? {})
    } else {
      setFormation(challenge.recommendedFormation)
      setSlots({})
    }
    // Anti-farmeo: rehidrata el guard "ya puntuado" SOLO si es la misma semana;
    // si la semana cambió, se resetea (vuelve a poder puntuar esta semana).
    const sc = loadScored()
    if (sc && sc.week === week.key) {
      scoredWeekRef.current = sc.week
      bestScoreRef.current = sc.best
    } else {
      scoredWeekRef.current = null
      bestScoreRef.current = 0
    }
    setHydrated(true)
  }, [week.key, challenge.recommendedFormation])

  // Cargar un once guardado desde /perfil/onces vía ?load=ID. Sólo aplica
  // sobre el reto actual si la formación coincide (slot ids cuadran).
  useEffect(() => {
    const loadId = searchParams?.get('load')
    if (!loadId) return
    const entry = loadSavedLineups().find(e => e.id === loadId)
    if (entry) {
      // El reto de la semana fija la formación; un once guardado de otra
      // formación no encaja en los huecos → avisamos en vez de romper el tablero.
      if (entry.formation !== challenge.recommendedFormation) {
        setShareToast(`"${entry.name}" es de otra formación (${entry.formation}); esta semana el reto usa ${challenge.recommendedFormation}`)
      } else {
        setFormation(entry.formation)
        setSlots(entry.slots ?? {})
        setShareToast(`Cargado "${entry.name}"`)
      }
    }
    // Limpiar el query param para que un reload no recargue otra vez
    router.replace('/mionce')
  }, [searchParams, router, challenge.recommendedFormation])

  // Persist
  useEffect(() => {
    if (!hydrated) return
    saveState({ weekKey: week.key, formation, slots })
  }, [hydrated, week.key, formation, slots])

  // Auto-clear toast
  useEffect(() => {
    if (!shareToast) return
    const t = setTimeout(() => setShareToast(null), 2200)
    return () => clearTimeout(t)
  }, [shareToast])

  const formationSlots = FORMATIONS[formation]
  const filledCount = formationSlots.filter(s => !!slots[s.id]).length
  const isComplete = filledCount === 11
  const isTagged = !!challenge.slotTags
  const formationLocked = isTagged

  // Validez por slot (cumple posición + filtro global + tag + no-repeat-club).
  // En modo clásico (sin slotTags) todo slot ocupado es válido por defecto.
  const validBySlot = useMemo<Record<string, boolean>>(() => {
    const out: Record<string, boolean> = {}
    const seenClubs = new Map<string, string>() // club -> first slotId
    formationSlots.forEach(s => {
      const pid = slots[s.id]
      if (!pid) { out[s.id] = true; return }
      const p = getPlayerById(pid)
      if (!p) { out[s.id] = false; return }
      let ok = true
      if (p.position !== s.position) ok = false   // la posición del jugador debe casar con la del hueco
      if (challenge.filter && !challenge.filter(p)) ok = false
      const tag = challenge.slotTags?.[s.id]
      if (tag && !tag.match(p)) ok = false
      if (challenge.noRepeatClub) {
        const owner = seenClubs.get(p.club)
        if (owner && owner !== s.id) ok = false
        seenClubs.set(p.club, s.id)
      }
      out[s.id] = ok
    })
    return out
  }, [formationSlots, slots, challenge])

  const validCount = formationSlots.filter(s => slots[s.id] && validBySlot[s.id]).length
  const score = isTagged ? validCount * 10 : filledCount * 10

  const prevFilledRef = useRef(0)
  useEffect(() => {
    const period = currentWeekISO()
    if (prevFilledRef.current === 0 && filledCount === 1) {
      trackGameStart('mi_once')
      trackGameEvent({ gameId: 'mionce', event: 'started', period })
    }
    if (filledCount === 11) {
      // Victoria al colocar el 11º jugador (transición 10→11): confeti + fanfarria.
      // Solo en la transición real, no al hidratar un once ya completo (0→11).
      if (prevFilledRef.current === 10) {
        fireConfetti()
        if (getSoundPref()) { ensureAudio(); winFanfare() }
      }
      // Anti-farmeo: el premio de Liga Taka (XP + misión + racha) se otorga UNA
      // sola vez por semana ISO. Como prevFilledRef se reinicia a 0 en cada
      // montaje, sin este guard recargar con el once completo en localStorage —o
      // quitar y volver a poner un jugador— re-disparaba addXp/reportPlay. Los
      // puntos y el ranking ya eran idempotentes server-side; el daño era XP/
      // misión/racha, que sí inflaban la Liga Taka.
      const alreadyScored = scoredWeekRef.current === week.key
      const isNewBest = score > bestScoreRef.current
      // Ranking (server: greatest + idempotente): registra solo una mejor marca
      // semanal, para que mejorar el once siga subiendo en la tabla.
      if (!alreadyScored || isNewBest) {
        recordPlay({
          gameId:  'mionce',
          period,
          score,
          payload: { formation, filled: filledCount, valid: validCount, tagged: isTagged, slots },
        }).then(r => { if (r.awarded > 0) setAwardedPoints(r.awarded) })
          .catch(() => { /* sin toast — el resto del flujo no se afecta */ })
        bestScoreRef.current = Math.max(bestScoreRef.current, score)
      }
      // misión + racha + evento "completed": exactamente 1 vez por semana.
      if (!alreadyScored) {
        trackGameComplete({ game: 'mi_once', correct: validCount, total: 11 })
        reportPlay('mionce', { score })
        trackGameEvent({ gameId: 'mionce', event: 'completed', period, meta: { formation, filled: filledCount, valid: validCount, tagged: isTagged } })
        scoredWeekRef.current = week.key
      }
      saveScored({ week: week.key, best: bestScoreRef.current })
    }
    prevFilledRef.current = filledCount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filledCount])

  const usedPlayerIds = useMemo(() => Object.values(slots).filter(Boolean), [slots])

  // Clubes ya usados por otros slots (para meta-regla noRepeatClub).
  const excludedClubsForActive = useMemo<Set<string>>(() => {
    const out = new Set<string>()
    if (!challenge.noRepeatClub || !activeSlot) return out
    for (const s of formationSlots) {
      if (s.id === activeSlot.id) continue
      const pid = slots[s.id]
      if (!pid) continue
      const p = getPlayerById(pid)
      if (p) out.add(p.club)
    }
    return out
  }, [challenge.noRepeatClub, activeSlot, formationSlots, slots])

  const activeSlotTag = activeSlot ? (challenge.slotTags?.[activeSlot.id] ?? null) : null

  const handleSelectPlayer = useCallback((player: Player) => {
    if (!activeSlot) return
    setSlots(prev => ({ ...prev, [activeSlot.id]: player.id }))
    // El search modal ya filtra por challenge.filter + slotTag, así que
    // cualquier jugador colocado cuenta como cromo válido para el álbum.
    collectPlayer(player.id, 'mionce')
    setActiveSlot(null)
  }, [activeSlot])

  const handleClearSlot = useCallback((slotId: string) => {
    setSlots(prev => {
      const next = { ...prev }
      delete next[slotId]
      return next
    })
  }, [])

  const handleChangeFormation = (newFormation: FormationId) => {
    if (newFormation === formation) return
    // Migrar jugadores compatibles por posición. Slots sin coincidencia se pierden.
    const oldSlots = FORMATIONS[formation]
    const newSlots = FORMATIONS[newFormation]
    const migrated: Record<string, string> = {}

    // Pool de jugadores agrupados por posición
    const byPos: Record<PlayerPosition, string[]> = { GK: [], DEF: [], MID: [], FWD: [] }
    oldSlots.forEach(s => {
      const pid = slots[s.id]
      if (pid) byPos[s.position].push(pid)
    })

    newSlots.forEach(s => {
      const pid = byPos[s.position].shift()
      if (pid) migrated[s.id] = pid
    })

    setFormation(newFormation)
    setSlots(migrated)
  }

  const handleReset = () => {
    if (filledCount === 0) return
    if (!confirm('¿Vaciar todo el once?')) return
    setSlots({})
  }

  const [generatingImage, setGeneratingImage] = useState(false)

  // Once editorial canónico (publicado por la redacción) + heatmap social
  // por slot. Ambos se piden al montar; si la semana aún no tiene datos
  // simplemente no se renderizan los paneles.
  const [editorial, setEditorial] = useState<{ title: string; formation: string; slots: Record<string, string>; note: string | null; source?: 'editorial' | 'auto' } | null>(null)
  const [slotHeatmap, setSlotHeatmap] = useState<{ bySlot: Record<string, Record<string, number>>; totalPlays: number } | null>(null)

  useEffect(() => {
    const wk = week.key
    fetch(`/api/mionce/editorial?week=${wk}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j?.editorial) setEditorial(j.editorial) })
      .catch(() => { /* silencioso */ })
    fetch(`/api/games/mionce/heatmap?period=${wk}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j) setSlotHeatmap({ bySlot: j.bySlot ?? {}, totalPlays: j.totalPlays ?? 0 }) })
      .catch(() => { /* silencioso */ })
  }, [week.key])

  const editorialMatches = useMemo(() => {
    if (!editorial?.slots) return null
    let matches = 0
    let total = 0
    for (const [slotId, eid] of Object.entries(editorial.slots)) {
      total += 1
      if (slots[slotId] === eid) matches += 1
    }
    return { matches, total }
  }, [editorial, slots])
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [saveName, setSaveName] = useState('')

  const handleSaveLineup = () => {
    if (filledCount === 0) return
    const defaultName = challenge.title.length > 30 ? challenge.title.slice(0, 30) + '…' : challenge.title
    setSaveName(`${defaultName} · ${formation}`)
    setSaveModalOpen(true)
  }

  const confirmSave = () => {
    saveLineup({
      name: saveName,
      formation,
      slots,
      challengeId: challenge.id,
      challengeTitle: challenge.title,
    })
    setSaveModalOpen(false)
    setShareToast('Once guardado en tu perfil')
  }

  const handleShareImage = async () => {
    if (generatingImage) return
    setGeneratingImage(true)
    try {
      const blob = await generateShareImage(formationSlots, slots, challenge.title, formation, week.key)
      const file = new File([blob], 'mi-once-takasports.png', { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Mi Once — ${challenge.title}` })
        setShareToast('¡Imagen compartida!')
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'mi-once-takasports.png'
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
        setShareToast('Imagen descargada')
      }
    } catch {
      setShareToast('No se pudo generar la imagen')
    } finally {
      setGeneratingImage(false)
    }
  }

  const handleShare = async () => {
    // Build visual formation text
    const bySlot: Record<string, string> = {}
    formationSlots.forEach(s => {
      const p = slots[s.id] ? getPlayerById(slots[s.id]) : null
      bySlot[s.id] = p ? p.name.split(' ').pop()! : '?'
    })
    // Group by y-band (row) sorted top to bottom (highest y first = attack)
    const bands = formationSlots
      .slice()
      .sort((a, b) => b.y - a.y)
      .reduce<SlotDef[][]>((acc, slot) => {
        const last = acc[acc.length - 1]
        if (last && Math.abs(last[0].y - slot.y) < 14) {
          last.push(slot)
        } else {
          acc.push([slot])
        }
        return acc
      }, [])
    const pitchLines = bands.map(band =>
      band.sort((a, b) => a.x - b.x).map(s => bySlot[s.id]).join('  ')
    )
    const filled = formationSlots.filter(s => !!slots[s.id]).length
    const stars = filled >= 11 ? '⭐' : filled >= 8 ? '✨' : ''
    const text = [
      `⚽ Mi Once — ${challenge.title} ${stars}`,
      `📐 ${formation} | TakaSports`,
      '',
      ...pitchLines,
      '',
      `takasportsmedia.com/mionce`,
    ].join('\n')
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Mi Once — TakaSports', text })
        setShareToast('¡Compartido!')
      } else {
        await navigator.clipboard.writeText(text)
        setShareToast('Copiado al portapapeles')
      }
    } catch {
      try {
        await navigator.clipboard.writeText(text)
        setShareToast('Copiado al portapapeles')
      } catch {
        setShareToast('No se pudo compartir')
      }
    }
  }

  return (
    <>
      <GameOnboarding
        storageKey="ts-onboarded-mionce"
        accent="#93C5FD"
        ctaFinal="Crear mi once"
        steps={[
          { emoji: '⚽', title: 'Una posición, un club', body: 'El reto fija una formación y un club en cada hueco. Pon a un jugador que jugó en esa posición y ese club en algún momento de su carrera.' },
          { emoji: '🌍', title: 'Vale toda su carrera', body: 'Cuenta cualquier club por el que pasó el jugador, no solo el actual. Acierta los 11 sin repetir jugador.' },
          { emoji: '💾', title: 'Se guarda solo', body: 'Tu once se guarda automáticamente y puedes comparar tus elecciones con las de la comunidad en el mapa de calor.' },
        ]}
      />
      <GameLayout accent="#93C5FD" accentDim="#60A5FA">
        {/* Breadcrumb */}
        <div className="pt-6 sm:pt-8">
          <Link
            href="/juegos"
            className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest transition-colors hover:text-white"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}
          >
            <IconBack />
            Volver a juegos
          </Link>
        </div>

        {/* Hero */}
        <div className="pt-4 pb-6">
          <div className="flex items-center gap-2.5 mb-2">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: ACCENT }} />
            <span
              className="text-[10px] font-black uppercase tracking-widest"
              style={{ color: ACCENT, fontFamily: 'var(--font-sport)' }}
            >
              Mi Once · Reto semanal · {week.key}
            </span>
          </div>
          <h1
            className="font-black leading-tight mb-2"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(1.6rem, 3.5vw, 2.6rem)',
              color: '#F8F8FF',
              letterSpacing: '-0.02em',
            }}
          >
            {challenge.title}
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)', maxWidth: 620 }}>
            {challenge.description}
          </p>
        </div>

        {/* Layout principal */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* Campo */}
          <div className="flex flex-col gap-4">
            {/* Toolbar formación */}
            <div
              className="flex items-center gap-2 p-2 rounded-xl overflow-x-auto"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <span
                className="text-[10px] font-black uppercase tracking-widest px-2 flex-shrink-0"
                style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}
              >
                Formación
              </span>
              {FORMATION_LIST.map(f => {
                const active = f === formation
                const disabled = formationLocked && !active
                return (
                  <button
                    key={f}
                    onClick={() => !disabled && handleChangeFormation(f)}
                    disabled={disabled}
                    className="flex-shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all disabled:cursor-not-allowed disabled:opacity-30"
                    style={{
                      background: active ? `linear-gradient(135deg, ${ACCENT_DIM}, #1E3A8A)` : 'rgba(255,255,255,0.04)',
                      color: active ? '#fff' : 'var(--text-muted)',
                      border: active ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.06)',
                      fontFamily: 'var(--font-sport)',
                      boxShadow: active ? `0 2px 12px ${ACCENT_DIM}40` : 'none',
                    }}
                    title={disabled ? 'Este reto bloquea la formación' : undefined}
                  >
                    {f}
                  </button>
                )
              })}
              {formationLocked && (
                <span className="text-[10px] font-black uppercase tracking-widest px-2 inline-flex items-center gap-1 flex-shrink-0"
                  style={{ color: '#FCD34D', fontFamily: 'var(--font-sport)' }}
                >
                  <LockIcon size={11} />Fijada por el reto
                </span>
              )}
            </div>

            {/* Pitch */}
            <div className="max-w-[560px] mx-auto w-full">
              {hydrated && (
                <Pitch
                  slots={formationSlots}
                  players={slots}
                  slotTags={challenge.slotTags}
                  validBySlot={validBySlot}
                  onSlotClick={setActiveSlot}
                  onSlotClear={handleClearSlot}
                />
              )}
            </div>
          </div>

          {/* Sidebar */}
          <aside className="flex flex-col gap-4">
            {/* Progress card */}
            <div
              className="rounded-2xl p-5"
              style={{
                background: isComplete
                  ? `linear-gradient(135deg, ${ACCENT_DIM}28, ${ACCENT_DIM}10)`
                  : 'var(--bg-card)',
                border: isComplete ? `1px solid ${ACCENT}` : '1px solid var(--border)',
              }}
            >
              <p
                className="text-[10px] font-black uppercase tracking-widest mb-2"
                style={{ color: ACCENT, fontFamily: 'var(--font-sport)' }}
              >
                Progreso
              </p>
              <div className="flex items-baseline gap-2 mb-3">
                <span
                  className="font-black"
                  style={{ fontFamily: 'var(--font-display)', fontSize: 36, color: '#F0F0F5' }}
                >
                  {filledCount}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>/ 11</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${(filledCount / 11) * 100}%`,
                    background: `linear-gradient(90deg, ${ACCENT_DIM}, ${ACCENT})`,
                  }}
                />
              </div>
              {isTagged && (
                <div className="mt-3 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>Slots válidos</span>
                    <span className="font-black" style={{ color: validCount === filledCount && filledCount > 0 ? '#86EFAC' : '#FCD34D', fontFamily: 'var(--font-display)' }}>
                      {validCount}/{filledCount || 11}
                    </span>
                  </div>
                  {challenge.noRepeatClub && (
                    <div className="flex items-center justify-between text-[10px]">
                      <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>Sin repetir club</span>
                      <span style={{ color: '#FCA5A5', fontFamily: 'var(--font-sport)' }}>obligatorio</span>
                    </div>
                  )}
                </div>
              )}
              {isComplete && (
                <p className="mt-3 text-xs font-black" style={{ color: validCount === 11 ? '#86EFAC' : ACCENT, fontFamily: 'var(--font-sport)' }}>
                  {isTagged
                    ? (validCount === 11 ? '¡11/11 perfecto! Comparte tu hazaña.' : `Once completo — ${validCount}/11 cumplen el reto.`)
                    : '¡Once completo! Comparte tu alineación.'}
                </p>
              )}
            </div>

            {/* Comparativa con once editorial */}
            {isComplete && editorial && editorialMatches && (
              <div
                className="rounded-2xl p-4"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: ACCENT, fontFamily: 'var(--font-sport)' }}>
                    {editorial.source === 'auto' ? 'Once de referencia' : 'Once editorial'}
                  </p>
                  <span
                    className="text-[10px] font-black px-2 py-0.5 rounded"
                    style={{
                      background: editorialMatches.matches >= 8 ? 'rgba(74,222,128,0.12)' : 'rgba(252,211,77,0.10)',
                      color: editorialMatches.matches >= 8 ? '#86EFAC' : '#FCD34D',
                      border: `1px solid ${editorialMatches.matches >= 8 ? 'rgba(74,222,128,0.25)' : 'rgba(252,211,77,0.25)'}`,
                      fontFamily: 'var(--font-sport)',
                    }}
                  >
                    {editorialMatches.matches}/{editorialMatches.total} coinciden
                  </span>
                </div>
                <p className="text-sm font-black mb-1" style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)' }}>
                  {editorial.title}
                </p>
                {editorial.note && (
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{editorial.note}</p>
                )}
                <details className="mt-2">
                  <summary className="text-[10px] font-black uppercase tracking-widest cursor-pointer" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
                    {editorial.source === 'auto' ? 'Ver alineación' : 'Ver canónico'} ({editorial.formation})
                  </summary>
                  <ul className="mt-2 grid grid-cols-1 gap-1">
                    {Object.entries(editorial.slots).map(([sid, pid]) => {
                      const p = getPlayerById(pid)
                      const userPick = slots[sid]
                      const match = userPick === pid
                      return (
                        <li key={sid} className="flex items-center gap-2 text-[11px]">
                          <span
                            className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ background: match ? '#86EFAC' : '#5A5A7A' }}
                          />
                          <span className="font-black w-10 flex-shrink-0" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>{sid.toUpperCase()}</span>
                          <span className="truncate" style={{ color: match ? '#86EFAC' : '#F0F0F5', fontFamily: 'var(--font-display)' }}>
                            {p ? p.name : pid}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </details>
              </div>
            )}

            {/* Heatmap social por slot */}
            {isComplete && slotHeatmap && slotHeatmap.totalPlays > 0 && (
              <div
                className="rounded-2xl p-4"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: ACCENT, fontFamily: 'var(--font-sport)' }}>
                    Coincidencias con la comunidad
                  </p>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
                    {slotHeatmap.totalPlays} {slotHeatmap.totalPlays === 1 ? 'jugada' : 'jugadas'}
                  </span>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {formationSlots.map(s => {
                    const userPid = slots[s.id]
                    if (!userPid) return null
                    const slotCounts = slotHeatmap.bySlot[s.id]
                    if (!slotCounts) return null
                    const denom = Object.values(slotCounts).reduce((a, b) => a + b, 0)
                    if (denom === 0) return null
                    const userPickedCount = slotCounts[userPid] ?? 0
                    const pct = Math.round((userPickedCount / denom) * 100)
                    const colorStrong = pct >= 50
                    return (
                      <li key={s.id} className="flex items-center gap-2 text-[11px]">
                        <span className="font-black w-10 flex-shrink-0" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>{s.label}</span>
                        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                          <div className="h-full" style={{ width: `${pct}%`, background: colorStrong ? '#86EFAC' : pct >= 20 ? '#FCD34D' : '#F87171' }} />
                        </div>
                        <span className="text-[10px] tabular-nums font-bold w-12 text-right" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
                          {pct}%
                        </span>
                      </li>
                    )
                  })}
                </ul>
                <p className="mt-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  % de la comunidad que puso al mismo jugador en cada hueco.
                </p>
              </div>
            )}

            {/* Acciones */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={handleShareImage}
                disabled={generatingImage || filledCount === 0}
                className="py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 col-span-1"
                style={{
                  background: `linear-gradient(135deg, ${ACCENT_DIM}, #1E3A8A)`,
                  color: '#fff',
                  border: `1px solid ${ACCENT}80`,
                  fontFamily: 'var(--font-sport)',
                  letterSpacing: '0.06em',
                  boxShadow: `0 4px 16px ${ACCENT_DIM}30`,
                }}
              >
                <IconImage />
                {generatingImage ? '…' : 'Imagen'}
              </button>
              <button
                onClick={handleShare}
                className="py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 col-span-1"
                style={{
                  background: 'rgba(147,197,253,0.08)',
                  color: ACCENT,
                  border: `1px solid ${ACCENT_DIM}40`,
                  fontFamily: 'var(--font-sport)',
                  letterSpacing: '0.06em',
                }}
              >
                <IconShare />
                Texto
              </button>
              <button
                onClick={handleSaveLineup}
                disabled={filledCount === 0}
                className="py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 col-span-1"
                style={{
                  background: 'rgba(252,211,77,0.12)',
                  color: '#FCD34D',
                  border: '1px solid rgba(252,211,77,0.3)',
                  fontFamily: 'var(--font-sport)',
                  letterSpacing: '0.06em',
                }}
                title="Guardar este once en tu perfil"
              >
                <ClipboardIcon size={13} className="inline-block align-middle mr-1" />Guardar
              </button>
              <button
                onClick={handleReset}
                disabled={filledCount === 0}
                className="py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 col-span-1"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  color: 'var(--text-muted)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  fontFamily: 'var(--font-sport)',
                  letterSpacing: '0.06em',
                }}
              >
                <IconReset />
                Vaciar
              </button>
            </div>

            {/* Lista del once */}
            <div
              className="rounded-2xl p-4"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <p
                className="text-[10px] font-black uppercase tracking-widest mb-3"
                style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}
              >
                Tu plantilla
              </p>
              <ul className="flex flex-col gap-1.5">
                {formationSlots.map(s => {
                  const p = slots[s.id] ? getPlayerById(slots[s.id]) : null
                  return (
                    <li key={s.id}>
                      <button
                        onClick={() => setActiveSlot(s)}
                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left hover:bg-white/5"
                      >
                        <span
                          className="w-9 text-[9px] font-black uppercase tracking-widest text-center px-1 py-0.5 rounded flex-shrink-0"
                          style={{
                            background: `${ACCENT_DIM}20`,
                            color: ACCENT,
                            border: `1px solid ${ACCENT_DIM}30`,
                            fontFamily: 'var(--font-sport)',
                          }}
                        >
                          {s.label}
                        </span>
                        {p ? (
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-black truncate flex items-center gap-1.5" style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)' }}>
                              <CountryFlag country={p.country} width={13} />
                              <span className="truncate">{p.name}</span>
                            </p>
                            <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                              {p.club}
                            </p>
                          </div>
                        ) : (
                          <span className="flex-1 text-[12px]" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>
                            Sin jugador
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>

            {/* Tip */}
            <div
              className="rounded-2xl p-4"
              style={{ background: 'rgba(147,197,253,0.04)', border: `1px solid ${ACCENT_DIM}20` }}
            >
              <p
                className="text-[9px] font-black uppercase tracking-widest mb-1.5"
                style={{ color: ACCENT, fontFamily: 'var(--font-sport)' }}
              >
                Cómo funciona
              </p>
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Toca cada hueco para buscar un jugador. Cada lunes hay un reto distinto.
                Tu plantilla se guarda automáticamente en este dispositivo.
              </p>
            </div>
          </aside>
        </div>

      {isComplete && (
        <PostGameResultModal
          gameId="mionce"
          period={currentWeekISO()}
          accent="#93C5FD"
          onClose={() => { /* abre una vez por semana */ }}
          play={{
            game_id:     'mionce',
            period:      currentWeekISO(),
            score,
            payload:     { formation, filled: filledCount, valid: validCount, tagged: isTagged },
            duration_ms: null,
          } as GamePlay}
        />
      )}

      {/* Modal */}
      {activeSlot && (
        <PlayerSearchModal
          slot={activeSlot}
          challenge={challenge}
          slotTag={activeSlotTag}
          excludeIds={usedPlayerIds.filter(id => id !== slots[activeSlot.id])}
          excludedClubs={excludedClubsForActive}
          onSelect={handleSelectPlayer}
          onClose={() => setActiveSlot(null)}
        />
      )}

      {/* Toast */}
      {/* Modal guardar once */}
      {saveModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSaveModalOpen(false)}
        >
          <div
            className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5"
            style={{ background: 'var(--bg-card)', border: `1px solid ${ACCENT_DIM}40` }}
            onClick={e => e.stopPropagation()}
          >
            <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: ACCENT, fontFamily: 'var(--font-sport)' }}>
              Guardar este once
            </p>
            <h3 className="text-lg font-black mb-3" style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)' }}>
              Ponle un nombre que recuerdes
            </h3>
            <input
              autoFocus
              value={saveName}
              onChange={e => setSaveName(e.target.value.slice(0, 40))}
              onKeyDown={e => { if (e.key === 'Enter') confirmSave() }}
              placeholder="Mi mejor once de los 2000"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none mb-2"
              style={{
                background: 'rgba(0,0,0,0.3)',
                color: '#F0F0F5',
                border: '1px solid rgba(255,255,255,0.08)',
                fontFamily: 'var(--font-display)',
              }}
            />
            <p className="text-[10px] mb-4" style={{ color: 'var(--text-muted)' }}>
              Lo encontrarás en <strong style={{ color: '#F0F0F5' }}>/perfil → tus onces</strong>. Tope: {SAVED_LINEUP_LIMIT} guardados.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSaveModalOpen(false)}
                className="py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'var(--font-sport)' }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmSave}
                disabled={saveName.trim().length === 0}
                className="py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: `linear-gradient(135deg, ${ACCENT_DIM}, #1E3A8A)`, color: '#fff', border: `1px solid ${ACCENT}80`, fontFamily: 'var(--font-sport)' }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {shareToast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-xs font-black"
          style={{
            background: `linear-gradient(135deg, ${ACCENT_DIM}, #1E3A8A)`,
            color: '#fff',
            border: `1px solid ${ACCENT}`,
            boxShadow: `0 8px 28px ${ACCENT_DIM}50`,
            fontFamily: 'var(--font-sport)',
            letterSpacing: '0.04em',
          }}
        >
          {shareToast}
        </div>
      )}

      <GamePointsToast
        awarded={awardedPoints}
        accent={ACCENT}
        onDismiss={() => setAwardedPoints(null)}
      />
      </GameLayout>
    </>
  )
}
