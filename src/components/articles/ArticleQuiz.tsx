'use client'

// Pregunta interactiva embebida en el body del artículo (bloque PortableText
// `articleQuiz`). Gancho de engagement: el lector responde y recibe feedback
// inmediato (correcto/incorrecto + explicación). Autoevaluación — NO otorga
// puntos ni toca la Liga Taka. Estética "liquid glass", espejo del statChart.
// Queda inerte hasta que el pipeline (WF-07/08) emita el bloque en el body.

import { useState } from 'react'

const GOOD = '#34D399'
const BAD = '#EF4444'

interface Props {
  question: string
  options: string[]
  correctIndex: number
  explanation?: string
  eyebrow?: string
  accent: string
}

export default function ArticleQuiz({ question, options, correctIndex, explanation, eyebrow, accent }: Props) {
  const [picked, setPicked] = useState<number | null>(null)

  const opts = Array.isArray(options) ? options.filter((o) => typeof o === 'string' && o.trim().length > 0) : []
  const correct =
    Number.isInteger(correctIndex) && correctIndex >= 0 && correctIndex < opts.length ? correctIndex : -1

  // Inerte-safe: sin pregunta, sin ≥2 opciones o sin correcta válida no renderiza nada.
  if (!question || opts.length < 2 || correct < 0) return null

  const answered = picked !== null
  const isRight = answered && picked === correct
  const stageStyle = { '--q-accent': accent, '--q-good': GOOD, '--q-bad': BAD } as React.CSSProperties

  return (
    <figure className="tk-quiz-stage" style={stageStyle}>
      <style>{`
        .tk-quiz-stage{position:relative;margin:2.25rem auto;max-width:620px;padding:22px 16px;border-radius:26px;overflow:hidden;isolation:isolate;}
        .tk-quiz-stage::before,.tk-quiz-stage::after{content:"";position:absolute;border-radius:50%;filter:blur(52px);opacity:.34;z-index:0;pointer-events:none;}
        .tk-quiz-stage::before{width:220px;height:220px;left:-56px;top:-72px;background:radial-gradient(circle,var(--q-accent),transparent 70%);}
        .tk-quiz-stage::after{width:210px;height:210px;right:-60px;bottom:-78px;background:radial-gradient(circle,var(--q-good),transparent 72%);}
        .tk-quiz-glass{position:relative;z-index:1;border-radius:20px;padding:19px 19px 15px;background:rgba(255,255,255,.06);-webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);border:1px solid rgba(255,255,255,.14);box-shadow:0 20px 50px -20px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.22),inset 0 -1px 0 rgba(0,0,0,.25);}
        .tk-quiz-kick{display:flex;align-items:center;gap:7px;font-size:10px;letter-spacing:.16em;text-transform:uppercase;font-weight:800;color:var(--q-accent);}
        .tk-quiz-kick svg{width:13px;height:13px;flex:none;}
        .tk-quiz-q{font-size:1.18rem;font-weight:800;letter-spacing:-.02em;color:var(--body-heading);margin:7px 0 14px;line-height:1.3;text-wrap:balance;}
        .tk-quiz-opts{display:flex;flex-direction:column;gap:9px;list-style:none;margin:0;padding:0;}
        .tk-quiz-opt{display:flex;align-items:center;gap:11px;width:100%;text-align:left;padding:12px 13px;border-radius:13px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);color:var(--body-text);font-size:.98rem;font-weight:600;cursor:pointer;transition:background .18s ease,border-color .18s ease,transform .12s ease,opacity .18s ease;}
        .tk-quiz-opt:hover:not(:disabled){background:rgba(255,255,255,.09);border-color:var(--q-accent);}
        .tk-quiz-opt:active:not(:disabled){transform:scale(.99);}
        .tk-quiz-opt:disabled{cursor:default;}
        .tk-quiz-opt:focus-visible{outline:2px solid var(--q-accent);outline-offset:2px;}
        .tk-quiz-badge{flex:none;width:26px;height:26px;border-radius:8px;display:grid;place-items:center;font-size:.8rem;font-weight:800;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);color:var(--body-heading);font-variant-numeric:tabular-nums;}
        .tk-quiz-txt{flex:1;min-width:0;}
        .tk-quiz-mark{flex:none;width:18px;height:18px;}
        .tk-quiz-opt.correct{background:color-mix(in srgb,var(--q-good) 15%,transparent);border-color:color-mix(in srgb,var(--q-good) 55%,transparent);color:var(--body-heading);}
        .tk-quiz-opt.correct .tk-quiz-badge{background:var(--q-good);border-color:var(--q-good);color:#04120b;}
        .tk-quiz-opt.wrong{background:color-mix(in srgb,var(--q-bad) 13%,transparent);border-color:color-mix(in srgb,var(--q-bad) 52%,transparent);}
        .tk-quiz-opt.wrong .tk-quiz-badge{background:var(--q-bad);border-color:var(--q-bad);color:#160404;}
        .tk-quiz-opt.dim{opacity:.5;}
        .tk-quiz-feed{display:flex;gap:9px;margin-top:14px;padding-top:13px;border-top:1px solid rgba(255,255,255,.1);}
        .tk-quiz-feed-ico{flex:none;width:20px;height:20px;margin-top:1px;}
        .tk-quiz-verdict{font-weight:800;font-size:.92rem;margin:0 0 2px;}
        .tk-quiz-exp{font-size:.86rem;line-height:1.55;color:var(--body-text);opacity:.82;margin:0;}
        .tk-quiz-hint{margin-top:12px;font-size:.62rem;letter-spacing:.04em;color:var(--body-text);opacity:.5;}
        @media (prefers-reduced-motion:reduce){.tk-quiz-opt{transition:none;}}
      `}</style>

      <div className="tk-quiz-glass">
        <div className="tk-quiz-kick">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
            <path d="M9.1 9a3 3 0 1 1 4.5 2.6c-.9.5-1.6 1.3-1.6 2.4v.5" strokeLinecap="round" />
            <circle cx="12" cy="18" r=".9" fill="currentColor" stroke="none" />
          </svg>
          {eyebrow || 'Pon a prueba lo que sabes'}
        </div>

        <p className="tk-quiz-q">{question}</p>

        <ul className="tk-quiz-opts" role="group" aria-label={question}>
          {opts.map((opt, i) => {
            const cls = !answered
              ? ''
              : i === correct
                ? 'correct'
                : i === picked
                  ? 'wrong'
                  : 'dim'
            return (
              <li key={i}>
                <button
                  type="button"
                  className={`tk-quiz-opt ${cls}`.trim()}
                  disabled={answered}
                  aria-label={`${opt}${answered && i === correct ? ' (respuesta correcta)' : ''}${answered && i === picked && i !== correct ? ' (tu respuesta, incorrecta)' : ''}`}
                  onClick={() => !answered && setPicked(i)}
                >
                  <span className="tk-quiz-badge" aria-hidden="true">
                    {answered && i === correct
                      ? '✓'
                      : answered && i === picked
                        ? '✕'
                        : String.fromCharCode(65 + i)}
                  </span>
                  <span className="tk-quiz-txt">{opt}</span>
                </button>
              </li>
            )
          })}
        </ul>

        {answered && (
          <div className="tk-quiz-feed" aria-live="polite">
            <svg
              className="tk-quiz-feed-ico"
              viewBox="0 0 24 24"
              fill="none"
              stroke={isRight ? GOOD : BAD}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {isRight ? <path d="M20 6 9 17l-5-5" /> : <path d="M18 6 6 18M6 6l12 12" />}
            </svg>
            <div>
              <p className="tk-quiz-verdict" style={{ color: isRight ? GOOD : BAD }}>
                {isRight ? '¡Correcto!' : 'No exactamente'}
              </p>
              {explanation ? <p className="tk-quiz-exp">{explanation}</p> : null}
            </div>
          </div>
        )}

        {!answered && <div className="tk-quiz-hint">Elige una respuesta</div>}
      </div>
    </figure>
  )
}
