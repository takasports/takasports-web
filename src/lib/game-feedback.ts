// ─────────────────────────────────────────────────────────────────
// game-feedback — motor de feedback compartido para los minijuegos.
//
// Extraído VERBATIM del motor que ya funcionaba en crackquiz (WebAudio +
// háptica) y ampliado con:
//   · sfx.pop      → acierto puntual (resolver celda/palabra)
//   · winFanfare() → arpegio de victoria
//   · fireConfetti → confeti DOM con el keyframe `confettiFall` (globals.css)
//   · preferencia de sonido COMPARTIDA entre juegos (una sola key)
//
// Todo 0 KB de dependencias (WebAudio + DOM). Respeta prefers-reduced-motion
// en el confeti. El sonido es opt-in (por defecto OFF) y por gesto del usuario.
// ─────────────────────────────────────────────────────────────────

// Key ÚNICA compartida (antes cada juego tenía la suya). Default OFF.
export const SOUND_KEY = 'ts_game_sound'

let audioCtx: AudioContext | null = null

export function ensureAudio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    if (!audioCtx) audioCtx = new Ctor()
    if (audioCtx.state === 'suspended') void audioCtx.resume()
    return audioCtx
  } catch { return null }
}

function tone(freq: number, durMs: number, type: OscillatorType = 'sine', gain = 0.05) {
  const ctx = audioCtx
  if (!ctx) return
  try {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    g.gain.setValueAtTime(gain, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durMs / 1000)
    osc.connect(g); g.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + durMs / 1000)
  } catch { /* ignore */ }
}

export function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate(pattern) } catch { /* ignore */ }
  }
}

export const sfx = {
  tick:    () => tone(660, 70, 'square', 0.025),
  correct: () => { tone(720, 90, 'sine', 0.05); setTimeout(() => tone(960, 130, 'sine', 0.05), 90); vibrate(20) },
  wrong:   () => { tone(180, 220, 'sawtooth', 0.04); vibrate([45, 40, 45]) },
  // Acierto puntual (resolver una celda / encontrar una palabra): pop corto.
  pop:     () => { tone(520, 55, 'sine', 0.045); setTimeout(() => tone(780, 70, 'sine', 0.04), 55); vibrate(12) },
}

// Fanfarria de victoria — arpegio ascendente (Do mayor) + háptica de remate.
export function winFanfare() {
  const notes = [523.25, 659.25, 783.99, 1046.5]
  notes.forEach((f, i) => setTimeout(() => tone(f, i === notes.length - 1 ? 320 : 150, 'triangle', 0.05), i * 110))
  vibrate([24, 36, 24, 60])
}

// ── Confeti DOM (keyframe `confettiFall` ya definido en globals.css) ──────────
// Cae una lluvia de piezas de colores de marca. 0 KB. Respeta reduced-motion
// (no dispara). Auto-limpia el contenedor al terminar.

const CONFETTI_COLORS = ['#FF4D2E', '#FBBF24', '#3DF06B', '#A78BFA', '#22D3EE', '#F0F0F8']

export function fireConfetti(count = 42) {
  if (typeof document === 'undefined') return
  // Respeta la preferencia de movimiento reducido.
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

  const wrap = document.createElement('div')
  wrap.setAttribute('aria-hidden', 'true')
  wrap.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden'

  for (let i = 0; i < count; i++) {
    const p = document.createElement('div')
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length]
    const size = 6 + (i % 4) * 2
    const left = (i / count) * 100 + (i % 5) * 2
    const dur = 2.4 + (i % 7) * 0.18
    const delay = (i % 9) * 0.08
    const rounded = i % 3 === 0 ? '50%' : '2px'
    p.style.cssText =
      `position:absolute;top:-24px;left:${left}%;width:${size}px;height:${size * (i % 2 ? 1 : 0.5)}px;` +
      `background:${color};border-radius:${rounded};opacity:0;` +
      `animation:confettiFall ${dur}s linear ${delay}s forwards`
    wrap.appendChild(p)
  }

  document.body.appendChild(wrap)
  // Duración máxima de una pieza ≈ dur(3.5) + delay(0.64); limpiamos a los 4.4s.
  setTimeout(() => { wrap.remove() }, 4400)
}

// ── Preferencia de sonido (compartida entre juegos) ──────────────────────────

export function getSoundPref(): boolean {
  if (typeof window === 'undefined') return false
  try { return window.localStorage.getItem(SOUND_KEY) === '1' } catch { return false }
}

export function setSoundPref(on: boolean) {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(SOUND_KEY, on ? '1' : '0') } catch { /* ignore */ }
}
