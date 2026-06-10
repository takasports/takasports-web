'use client'

// ── EventHero ───────────────────────────────────────────────────────────────
// Banner cinematográfico de la próxima velada UFC.
// Prioridad:
//   1. posterUrl  → muestra el póster (oficial / IA aprobada · Fases 2-3)
//   2. faceoff    → cara-a-cara con las fotos de ESPN (Fase 1 · $0 · automático)
// Animaciones llamativas con respeto a prefers-reduced-motion.

import { useState } from 'react'

const RED = '#F87171'

export interface EhFighter {
  name:   string
  id:     string | null
  flag:   string | null
  belt:   string | null
  record: string | null
}

interface EventHeroProps {
  eventName:  string
  dateLabel:  string
  timeLabel:  string
  venue:      string | null
  fightCount: number
  isLive:     boolean
  fighterA:   EhFighter
  fighterB:   EhFighter
  posterUrl?: string | null
}

const headshotUrl = (id: string | null) =>
  id ? `https://a.espncdn.com/i/headshots/mma/players/full/${id}.png` : null

const shortBelt = (belt: string | null): string | null => {
  if (!belt) return null
  // "UFC Interim Lightweight Title" → "Campeón interino" / "Campeón"
  if (/interim/i.test(belt)) return 'Campeón interino'
  return 'Campeón'
}

// Brasas de fondo — posiciones/retardos FIJOS (nada de Math.random → evita
// desajustes de hidratación SSR/cliente).
const EMBERS = [
  { left: '8%',  size: 5, delay: '0s',    dur: '7s'   },
  { left: '20%', size: 3, delay: '1.4s',  dur: '9s'   },
  { left: '34%', size: 4, delay: '0.7s',  dur: '8s'   },
  { left: '50%', size: 6, delay: '2.1s',  dur: '6.5s' },
  { left: '66%', size: 3, delay: '1.1s',  dur: '9.5s' },
  { left: '80%', size: 5, delay: '0.35s', dur: '7.5s' },
  { left: '92%', size: 4, delay: '1.8s',  dur: '8.5s' },
]

const ANIM = `
  @keyframes ehFadeDown { from{opacity:0;transform:translateY(-12px)} to{opacity:1;transform:none} }
  @keyframes ehFadeUp   { from{opacity:0;transform:translateY(18px)}  to{opacity:1;transform:none} }
  @keyframes ehInL { from{opacity:0;transform:translateX(-70px) scale(.94)} to{opacity:1;transform:none} }
  @keyframes ehInR { from{opacity:0;transform:translateX(70px)  scale(.94)} to{opacity:1;transform:none} }
  @keyframes ehVs  { 0%{opacity:0;transform:scale(.4) rotate(-8deg)} 60%{transform:scale(1.18) rotate(3deg)} 100%{opacity:1;transform:scale(1) rotate(0)} }
  @keyframes ehGlow { 0%,100%{opacity:.4;transform:translate(-50%,-50%) scale(1)} 50%{opacity:.85;transform:translate(-50%,-50%) scale(1.14)} }
  @keyframes ehSheen{ 0%{transform:translateX(-160%) skewX(-18deg)} 100%{transform:translateX(280%) skewX(-18deg)} }
  @keyframes ehEmber{ 0%{opacity:0;transform:translateY(0) scale(1)} 14%{opacity:.7} 100%{opacity:0;transform:translateY(-230px) scale(.35)} }

  .eh-eyebrow{ animation: ehFadeDown .6s ease-out both }
  .eh-a    { animation: ehInL .7s cubic-bezier(.2,.7,.2,1) .15s both }
  .eh-b    { animation: ehInR .7s cubic-bezier(.2,.7,.2,1) .15s both }
  .eh-vs   { animation: ehVs .7s cubic-bezier(.3,1.4,.5,1) .45s both }
  .eh-glow { animation: ehGlow 2.6s ease-in-out infinite }
  .eh-foot { animation: ehFadeUp .6s ease-out .5s both }
  .eh-sheen{ animation: ehSheen 4s ease-in-out 1.2s infinite }
  .eh-ember{ animation-name: ehEmber; animation-timing-function: ease-out; animation-iteration-count: infinite }
  .eh-face { transition: transform .25s ease, filter .25s ease }
  .eh-face:hover { transform: translateY(-4px) scale(1.03); filter: brightness(1.08) }

  @media (prefers-reduced-motion: reduce){
    .eh-eyebrow,.eh-a,.eh-b,.eh-vs,.eh-glow,.eh-foot,.eh-sheen{ animation: none !important }
    .eh-a,.eh-b,.eh-vs,.eh-eyebrow,.eh-foot{ opacity:1 !important; transform:none !important }
    .eh-ember{ display:none !important }
  }
`

// ── Una cara del faceoff ────────────────────────────────────────────────────
function FighterFace({ f, side }: { f: EhFighter; side: 'a' | 'b' }) {
  const [err, setErr] = useState(false)
  const url = headshotUrl(f.id)
  const initials = f.name.split(' ').filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase()
  const belt = shortBelt(f.belt)

  return (
    <div
      className={side === 'a' ? 'eh-a' : 'eh-b'}
      style={{
        flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 8, textAlign: 'center',
      }}
    >
      {/* Foto o fallback */}
      <div
        className="eh-face"
        style={{
          position: 'relative',
          width: 'clamp(120px, 26vw, 230px)',
          height: 'clamp(150px, 32vw, 290px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}
      >
        {/* halo bajo la foto */}
        <div style={{
          position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)',
          width: '78%', height: 26, borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, rgba(248,113,113,0.35) 0%, transparent 70%)',
          filter: 'blur(3px)',
        }} />
        {url && !err ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={f.name}
            onError={() => setErr(true)}
            style={{
              maxWidth: '100%', maxHeight: '100%', objectFit: 'contain',
              filter: 'drop-shadow(0 14px 22px rgba(0,0,0,0.6))',
              position: 'relative', zIndex: 1,
            }}
          />
        ) : (
          <div style={{
            width: 'clamp(96px,22vw,170px)', height: 'clamp(96px,22vw,170px)',
            borderRadius: '50%', position: 'relative', zIndex: 1,
            background: 'linear-gradient(145deg, rgba(248,113,113,0.22), rgba(20,12,12,0.9))',
            border: '2px solid rgba(248,113,113,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,7vw,52px)', fontWeight: 900,
            color: 'rgba(255,255,255,0.85)',
          }}>
            {initials || '🥊'}
          </div>
        )}
      </div>

      {/* Nombre */}
      <div style={{
        fontFamily: 'var(--font-display)', fontWeight: 900,
        fontSize: 'clamp(15px, 2.6vw, 28px)', lineHeight: 1, color: '#fff',
        letterSpacing: '-0.02em', textShadow: '0 2px 12px rgba(0,0,0,0.6)',
        maxWidth: '100%', wordBreak: 'break-word',
      }}>
        {f.name}
      </div>

      {/* Bandera · récord · cinturón */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center', minHeight: 20 }}>
        {f.flag && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={f.flag} alt="" width={20} height={14} style={{ borderRadius: 2, objectFit: 'cover', boxShadow: '0 1px 3px rgba(0,0,0,0.5)' }} />
        )}
        {f.record && (
          <span style={{
            fontFamily: 'var(--font-sport)', fontSize: 11, fontWeight: 800,
            color: 'rgba(255,255,255,0.7)', letterSpacing: '0.04em',
          }}>
            {f.record}
          </span>
        )}
        {belt && (
          <span style={{
            fontFamily: 'var(--font-sport)', fontSize: 9, fontWeight: 900,
            padding: '2px 7px', borderRadius: 20, letterSpacing: '0.08em', textTransform: 'uppercase',
            background: 'rgba(250,204,21,0.14)', border: '1px solid rgba(250,204,21,0.45)', color: '#FACC15',
          }}>
            🏆 {belt}
          </span>
        )}
      </div>
    </div>
  )
}

// ── EventHero (principal) ───────────────────────────────────────────────────
export default function EventHero({
  eventName, dateLabel, timeLabel, venue, fightCount, isLive,
  fighterA, fighterB, posterUrl,
}: EventHeroProps) {
  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      borderRadius: 24, marginBottom: 28,
      background: 'radial-gradient(120% 120% at 50% 0%, #2A0E0E 0%, #160808 55%, #0D0606 100%)',
      border: '1px solid rgba(248,113,113,0.18)',
      boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
    }}>
      <style>{ANIM}</style>

      {/* Brillo que barre */}
      <div className="eh-sheen" style={{
        position: 'absolute', top: 0, left: 0, width: '40%', height: '100%',
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)',
        pointerEvents: 'none', zIndex: 3,
      }} />

      {/* Brasas */}
      {EMBERS.map((e, i) => (
        <span key={i} className="eh-ember" style={{
          position: 'absolute', bottom: 20, left: e.left,
          width: e.size, height: e.size, borderRadius: '50%',
          background: 'rgba(248,113,113,0.8)', boxShadow: '0 0 8px rgba(248,113,113,0.8)',
          animationDelay: e.delay, animationDuration: e.dur, pointerEvents: 'none', zIndex: 1,
        }} />
      ))}

      {/* Viñeta */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
        background: 'radial-gradient(120% 80% at 50% 40%, transparent 55%, rgba(0,0,0,0.5) 100%)',
      }} />

      <div style={{ position: 'relative', zIndex: 4, padding: 'clamp(20px, 4vw, 40px) clamp(16px, 4vw, 40px) clamp(22px, 4vw, 36px)' }}>
        {/* Eyebrow */}
        <div className="eh-eyebrow" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 'clamp(14px, 3vw, 26px)' }}>
          <span style={{
            fontFamily: 'var(--font-sport)', fontSize: 9, fontWeight: 900, letterSpacing: '0.28em',
            textTransform: 'uppercase', color: 'rgba(248,113,113,0.7)',
          }}>
            🥊 Ranked UFC
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '5px 16px', borderRadius: 20,
            background: isLive ? 'rgba(239,68,68,0.16)' : 'rgba(248,113,113,0.1)',
            border: `1px solid ${isLive ? 'rgba(239,68,68,0.5)' : 'rgba(248,113,113,0.3)'}`,
            fontFamily: 'var(--font-sport)', fontSize: 10, fontWeight: 900,
            color: isLive ? '#EF4444' : RED, letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            {isLive
              ? <><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#EF4444', boxShadow: '0 0 8px #EF4444', display: 'inline-block' }} /> En vivo</>
              : <>Próxima velada · {dateLabel} · {timeLabel}</>}
          </span>
        </div>

        {posterUrl ? (
          /* ── Póster oficial / IA (Fases 2-3) ── */
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={posterUrl} alt={eventName} style={{
              maxWidth: 'min(560px, 100%)', maxHeight: 520, width: 'auto', borderRadius: 14,
              boxShadow: '0 16px 48px rgba(0,0,0,0.6)', border: '1px solid rgba(248,113,113,0.25)',
            }} />
          </div>
        ) : (
          /* ── Faceoff con fotos ESPN (Fase 1) ── */
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 'clamp(4px, 2vw, 24px)' }}>
            <FighterFace f={fighterA} side="a" />

            {/* VS */}
            <div style={{ position: 'relative', flexShrink: 0, alignSelf: 'center', padding: '0 clamp(2px, 1vw, 10px)' }}>
              <div className="eh-glow" style={{
                position: 'absolute', top: '50%', left: '50%', width: 110, height: 110, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(248,113,113,0.55) 0%, transparent 68%)', pointerEvents: 'none',
              }} />
              <span className="eh-vs" style={{
                position: 'relative', display: 'block',
                fontFamily: 'var(--font-display)', fontWeight: 900, fontStyle: 'italic',
                fontSize: 'clamp(26px, 6vw, 60px)', lineHeight: 1, color: '#fff',
                textShadow: '0 0 24px rgba(248,113,113,0.7), 0 2px 6px rgba(0,0,0,0.8)',
              }}>
                VS
              </span>
            </div>

            <FighterFace f={fighterB} side="b" />
          </div>
        )}

        {/* Footer: nombre del evento + datos */}
        <div className="eh-foot" style={{ textAlign: 'center', marginTop: 'clamp(16px, 3vw, 28px)' }}>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontWeight: 900, color: '#fff',
            fontSize: 'clamp(1.15rem, 3.2vw, 2.1rem)', lineHeight: 1.05, letterSpacing: '-0.02em',
            textShadow: '0 2px 16px rgba(0,0,0,0.6)',
          }}>
            {eventName}
          </h1>
          <div style={{
            marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap',
            fontFamily: 'var(--font-sport)', fontSize: 11, color: 'rgba(255,255,255,0.45)',
            letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>
            <span>{dateLabel}</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>{fightCount} combate{fightCount === 1 ? '' : 's'}</span>
            {venue && <><span style={{ opacity: 0.4 }}>·</span><span style={{ textTransform: 'none' }}>{venue}</span></>}
          </div>
          <p style={{
            marginTop: 14, color: 'rgba(255,255,255,0.5)', fontSize: 13, maxWidth: 440, margin: '14px auto 0',
          }}>
            Predice al ganador de cada combate. +2 pts extra si aciertas el método. El estelar vale el doble.
          </p>
        </div>
      </div>
    </div>
  )
}
