'use client'

import { GlovesIcon, TrophyIcon } from '@/components/icons/GameIcons'

// ── EventHero ───────────────────────────────────────────────────────────────
// Banner cinematográfico de TÍTULO de la próxima velada UFC.
// Prioridad:
//   1. posterUrl → muestra el póster (oficial / IA aprobada · Fases 2-3)
//   2. título     → nombre del evento + datos sobre un fondo dramático
// Las CARAS de los luchadores viven ahora en las cartas del cartel (no se
// repiten aquí). Animaciones llamativas con respeto a prefers-reduced-motion.

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
  @keyframes ehTitle    { 0%{opacity:0;transform:translateY(14px) scale(.96)} 100%{opacity:1;transform:none} }
  @keyframes ehGlow     { 0%,100%{opacity:.35;transform:translate(-50%,-50%) scale(1)} 50%{opacity:.7;transform:translate(-50%,-50%) scale(1.1)} }
  @keyframes ehSheen    { 0%{transform:translateX(-160%) skewX(-18deg)} 100%{transform:translateX(280%) skewX(-18deg)} }
  @keyframes ehEmber    { 0%{opacity:0;transform:translateY(0) scale(1)} 14%{opacity:.7} 100%{opacity:0;transform:translateY(-230px) scale(.35)} }

  .eh-eyebrow{ animation: ehFadeDown .6s ease-out both }
  .eh-title  { animation: ehTitle .7s cubic-bezier(.2,.7,.2,1) .12s both }
  .eh-sub    { animation: ehFadeUp .6s ease-out .28s both }
  .eh-foot   { animation: ehFadeUp .6s ease-out .42s both }
  .eh-glow   { animation: ehGlow 3s ease-in-out infinite }
  .eh-sheen  { animation: ehSheen 4.2s ease-in-out 1.2s infinite }
  .eh-ember  { animation-name: ehEmber; animation-timing-function: ease-out; animation-iteration-count: infinite }

  @media (prefers-reduced-motion: reduce){
    .eh-eyebrow,.eh-title,.eh-sub,.eh-foot,.eh-glow,.eh-sheen{ animation: none !important }
    .eh-eyebrow,.eh-title,.eh-sub,.eh-foot{ opacity:1 !important; transform:none !important }
    .eh-ember{ display:none !important }
  }
`

export default function EventHero({
  eventName, dateLabel, timeLabel, venue, fightCount, isLive,
  fighterA, fighterB, posterUrl,
}: EventHeroProps) {
  // "UFC Freedom 250: Topuria vs. Gaethje" → título + subtítulo (matchup)
  const colon     = eventName.indexOf(': ')
  const titlePart = colon === -1 ? eventName : eventName.slice(0, colon)
  const subPart   = colon === -1 ? null      : eventName.slice(colon + 2)
  const vsParts   = subPart ? subPart.split(/\s+vs\.?\s+/i) : null
  const isTitleFight = !!(fighterA.belt || fighterB.belt)

  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      borderRadius: 24, marginBottom: 28,
      background: 'radial-gradient(120% 130% at 50% 0%, #2A0E0E 0%, #160808 55%, #0D0606 100%)',
      border: '1px solid rgba(248,113,113,0.18)',
      boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
    }}>
      <style>{ANIM}</style>

      {/* Brillo que barre */}
      <div className="eh-sheen" style={{
        position: 'absolute', top: 0, left: 0, width: '40%', height: '100%',
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)',
        pointerEvents: 'none', zIndex: 3,
      }} />

      {/* Brasas */}
      {EMBERS.map((e, i) => (
        <span key={i} className="eh-ember" style={{
          position: 'absolute', bottom: 16, left: e.left,
          width: e.size, height: e.size, borderRadius: '50%',
          background: 'rgba(248,113,113,0.8)', boxShadow: '0 0 8px rgba(248,113,113,0.8)',
          animationDelay: e.delay, animationDuration: e.dur, pointerEvents: 'none', zIndex: 1,
        }} />
      ))}

      {/* Viñeta */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
        background: 'radial-gradient(120% 80% at 50% 35%, transparent 55%, rgba(0,0,0,0.5) 100%)',
      }} />

      <div style={{
        position: 'relative', zIndex: 4,
        padding: posterUrl
          ? 'clamp(20px,4vw,36px) clamp(16px,4vw,40px)'
          : 'clamp(30px,6vw,64px) clamp(16px,4vw,40px)',
        textAlign: 'center',
      }}>
        {/* Eyebrow */}
        <div className="eh-eyebrow" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: posterUrl ? 18 : 'clamp(16px,3vw,26px)' }}>
          <span style={{
            fontFamily: 'var(--font-sport)', fontSize: 9, fontWeight: 900, letterSpacing: '0.3em',
            textTransform: 'uppercase', color: 'rgba(248,113,113,0.7)',
          }}>
            <GlovesIcon size={13} className="inline-block align-middle mr-1" />Ranked UFC
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '5px 16px', borderRadius: 'var(--radius-xl)',
            background: isLive ? 'rgba(255,77,46,0.16)' : 'rgba(248,113,113,0.1)',
            border: `1px solid ${isLive ? 'rgba(255,77,46,0.5)' : 'rgba(248,113,113,0.3)'}`,
            fontFamily: 'var(--font-sport)', fontSize: 10, fontWeight: 900,
            color: isLive ? '#FF4D2E' : RED, letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            {isLive
              ? <><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#FF4D2E', boxShadow: '0 0 8px #FF4D2E', display: 'inline-block' }} /> En vivo</>
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
          /* ── Banner de título (sin fotos: las caras están en las cartas) ── */
          <div style={{ position: 'relative' }}>
            {/* Resplandor detrás del título */}
            <div className="eh-glow" style={{
              position: 'absolute', top: '46%', left: '50%',
              width: 'min(560px, 90%)', height: 180, borderRadius: '50%',
              background: 'radial-gradient(ellipse at center, rgba(248,113,113,0.4) 0%, transparent 68%)',
              pointerEvents: 'none', zIndex: -1,
            }} />

            <h1 className="eh-title" style={{
              fontFamily: 'var(--font-display)', fontWeight: 900, color: '#fff',
              fontSize: 'clamp(2rem, 7vw, 4.6rem)', lineHeight: 0.95, letterSpacing: '-0.03em',
              textShadow: '0 2px 30px rgba(0,0,0,0.6)', textTransform: 'uppercase',
            }}>
              {titlePart}
            </h1>

            {subPart && (
              <div className="eh-sub" style={{
                marginTop: 'clamp(8px,1.5vw,16px)',
                fontFamily: 'var(--font-display)', fontWeight: 900,
                fontSize: 'clamp(1rem, 3.2vw, 2rem)', letterSpacing: '-0.01em',
                color: 'rgba(255,255,255,0.92)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'clamp(8px,2vw,16px)', flexWrap: 'wrap',
              }}>
                {vsParts && vsParts.length === 2 ? (
                  <>
                    <span>{vsParts[0]}</span>
                    <span style={{ color: RED, fontStyle: 'italic', textShadow: `0 0 18px ${RED}80` }}>VS</span>
                    <span>{vsParts[1]}</span>
                  </>
                ) : subPart}
              </div>
            )}

            {/* Stakes (combate de campeonato) */}
            {isTitleFight && (
              <div className="eh-sub" style={{
                marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '5px 14px', borderRadius: 'var(--radius-xl)',
                background: 'rgba(250,204,21,0.12)', border: '1px solid rgba(250,204,21,0.4)',
                fontFamily: 'var(--font-sport)', fontSize: 10, fontWeight: 900,
                color: '#FACC15', letterSpacing: '0.1em', textTransform: 'uppercase',
              }}>
                <TrophyIcon size={13} className="inline-block align-middle mr-1" />Combate de campeonato
              </div>
            )}
          </div>
        )}

        {/* Footer: datos del evento */}
        <div className="eh-foot" style={{ marginTop: 'clamp(18px,3vw,30px)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap',
            fontFamily: 'var(--font-sport)', fontSize: 11, color: 'rgba(255,255,255,0.45)',
            letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>
            <span>{dateLabel} · {timeLabel}</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>{fightCount} combate{fightCount === 1 ? '' : 's'}</span>
            {venue && <><span style={{ opacity: 0.4 }}>·</span><span style={{ textTransform: 'none' }}>{venue}</span></>}
          </div>
          <p style={{ marginTop: 14, color: 'rgba(255,255,255,0.5)', fontSize: 13, maxWidth: 460, margin: '14px auto 0' }}>
            Predice al ganador de cada combate. +2 pts extra si aciertas el método. El estelar vale el doble.
          </p>
        </div>
      </div>
    </div>
  )
}
