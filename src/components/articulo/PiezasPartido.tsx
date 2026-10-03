// Piezas visuales del cuerpo de una noticia: el marcador con la línea de tiempo, la
// mini-clasificación, la racha de cada equipo (datos de ESPN, ver
// `lib/partido-visual.ts`) y la cita destacada. Se pintan desde los componentes de
// PortableText de la página de la noticia; son de servidor y sin estado.

import DynamicImage from '@/components/DynamicImage'
import type { EquipoVisual, EventoVisual, FilaClasificacion, Figura, PartidoPrevio } from '@/lib/partido-visual'

const ICONO: Record<EventoVisual['tipo'], string> = { gol: '⚽', penalti: '⚽', propia: '⚽', roja: '🟥' }
const NOTA: Record<EventoVisual['tipo'], string> = { gol: '', penalti: 'penalti', propia: 'en propia', roja: 'expulsado' }

function Escudo({ eq, size }: { eq: EquipoVisual; size: number }) {
  if (!eq.escudo) return <span style={{ width: size, height: size, display: 'inline-block' }} />
  return <DynamicImage src={eq.escudo} alt={eq.nombre} width={size} height={size} style={{ width: size, height: size, objectFit: 'contain' }} unoptimized />
}

export function MarcadorPartido({ home, away, eventos, accent }: { home: EquipoVisual; away: EquipoVisual; eventos: EventoVisual[]; accent: string }) {
  return (
    <figure className="pv-marcador" style={{ margin: '2rem 0', borderRadius: 20, overflow: 'hidden', border: '1px solid var(--border)', background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12, padding: '22px 18px 18px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
          <Escudo eq={home} size={52} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', color: 'var(--body-heading)', lineHeight: 1.1 }}>{home.nombre}</span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.6rem', lineHeight: 1, color: 'var(--body-heading)', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em' }}>
            {home.goles ?? '-'}<span style={{ opacity: 0.35, margin: '0 0.35rem' }}>-</span>{away.goles ?? '-'}
          </div>
          <div style={{ marginTop: 6, fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: accent }}>Final</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
          <Escudo eq={away} size={52} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', color: 'var(--body-heading)', lineHeight: 1.1 }}>{away.nombre}</span>
        </div>
      </div>
      {eventos.length > 0 && (
        <ol style={{ listStyle: 'none', margin: 0, padding: '10px 14px 14px', position: 'relative' }}>
          <span aria-hidden style={{ position: 'absolute', left: '50%', top: 10, bottom: 14, width: 2, marginLeft: -1, background: 'var(--border)' }} />
          {eventos.map((e, i) => {
            const izq = e.lado === 'home'
            const texto = (
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: izq ? 'flex-end' : 'flex-start', textAlign: izq ? 'right' : 'left' }}>
                <span style={{ fontWeight: 700, color: 'var(--body-heading)', fontSize: '0.92rem', lineHeight: 1.25 }}>{e.jugador}</span>
                {(NOTA[e.tipo] || e.asistencia) && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                    {NOTA[e.tipo] || `asist. ${e.asistencia}`}
                  </span>
                )}
              </span>
            )
            return (
              <li key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 64px 1fr', alignItems: 'center', padding: '7px 0', position: 'relative' }}>
                <span>{izq ? texto : null}</span>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, zIndex: 1 }}>
                  <span style={{ fontSize: e.tipo === 'roja' ? 13 : 15, lineHeight: 1, background: 'var(--bg-base, #09090F)', padding: '2px 4px', borderRadius: 6 }}>{ICONO[e.tipo]}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: accent, fontVariantNumeric: 'tabular-nums', background: 'var(--bg-base, #09090F)', padding: '0 4px' }}>{e.minuto}</span>
                </span>
                <span>{izq ? null : texto}</span>
              </li>
            )
          })}
        </ol>
      )}
      <figcaption style={{ padding: '8px 14px', fontSize: 10.5, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', letterSpacing: '0.04em' }}>Datos oficiales del partido</figcaption>
    </figure>
  )
}

export function ClasificacionPartido({ filas, accent }: { filas: FilaClasificacion[]; accent: string }) {
  return (
    <figure style={{ margin: '2rem 0', maxWidth: 680, borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <div style={{ padding: '10px 14px', fontSize: 10.5, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: accent, borderBottom: '1px solid var(--border)', background: `${accent}10` }}>
        Clasificación
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem' }}>
        <thead>
          <tr style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            <th style={{ textAlign: 'left', padding: '8px 14px', fontWeight: 600 }}>#</th>
            <th style={{ textAlign: 'left', padding: '8px 4px', fontWeight: 600 }}>Equipo</th>
            <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600 }}>PJ</th>
            <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600 }}>Dif</th>
            <th style={{ textAlign: 'right', padding: '8px 14px', fontWeight: 600 }}>Pts</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.pos + f.equipo} style={{ borderTop: '1px solid var(--border)', background: f.destacado ? `${accent}14` : 'transparent' }}>
              <td style={{ padding: '9px 14px', fontWeight: 700, color: f.destacado ? accent : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', boxShadow: f.destacado ? `inset 3px 0 0 ${accent}` : 'none' }}>{f.pos}</td>
              <td style={{ padding: '9px 4px', fontWeight: f.destacado ? 700 : 500, color: f.destacado ? 'var(--body-heading)' : 'var(--body-text)' }}>{f.equipo}</td>
              <td style={{ padding: '9px 6px', textAlign: 'right', color: 'var(--body-text)', fontVariantNumeric: 'tabular-nums' }}>{f.pj}</td>
              <td style={{ padding: '9px 6px', textAlign: 'right', color: 'var(--body-text)', fontVariantNumeric: 'tabular-nums' }}>{f.dif}</td>
              <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 800, color: 'var(--body-heading)', fontVariantNumeric: 'tabular-nums' }}>{f.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

const COLOR_FORMA: Record<string, string> = { V: '#22C55E', E: '#94A3B8', D: '#EF4444' }

export function FormaPartido({ home, away, forma, accent }: { home: EquipoVisual; away: EquipoVisual; forma: { home: string[]; away: string[] }; accent: string }) {
  const fila = (eq: EquipoVisual, r: string[]) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
      <Escudo eq={eq} size={26} />
      <span style={{ flex: 1, fontWeight: 700, color: 'var(--body-heading)', fontSize: '0.95rem' }}>{eq.nombre}</span>
      <span style={{ display: 'flex', gap: 5 }}>
        {r.map((x, i) => (
          <span key={i} title={x === 'V' ? 'Victoria' : x === 'E' ? 'Empate' : 'Derrota'} style={{ width: 24, height: 24, borderRadius: 7, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#0A0A12', background: COLOR_FORMA[x] ?? '#64748B', opacity: i === 0 ? 1 : 0.85 }}>{x}</span>
        ))}
      </span>
    </div>
  )
  return (
    <figure style={{ margin: '2rem 0', maxWidth: 680, borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <div style={{ padding: '10px 14px', fontSize: 10.5, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: accent, background: `${accent}10` }}>
        Últimos partidos <span style={{ color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'none' }}>· el más reciente, primero</span>
      </div>
      {fila(home, forma.home)}
      {fila(away, forma.away)}
    </figure>
  )
}

export function Destacado({ texto, autor, accent }: { texto: string; autor: string | null; accent: string }) {
  return (
    <figure style={{ margin: '2.4rem 0', padding: '0 0 0 1.25rem', borderLeft: `4px solid ${accent}` }}>
      <blockquote style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 'clamp(1.35rem, 4.6vw, 1.75rem)', lineHeight: 1.18, color: 'var(--body-heading)', letterSpacing: '-0.005em' }}>
        <span aria-hidden style={{ color: accent }}>«</span>{texto}<span aria-hidden style={{ color: accent }}>»</span>
      </blockquote>
      {autor && <figcaption style={{ marginTop: 10, fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>— {autor}</figcaption>}
    </figure>
  )
}

export function FiguraPartido({ figura, equipo, accent }: { figura: Figura; equipo: EquipoVisual; accent: string }) {
  const partes = [
    figura.goles ? `${figura.goles} ${figura.goles === 1 ? 'gol' : 'goles'}${figura.penaltis ? ` (${figura.penaltis} de penalti)` : ''}` : null,
    figura.asistencias ? `${figura.asistencias} ${figura.asistencias === 1 ? 'asistencia' : 'asistencias'}` : null,
  ].filter(Boolean)
  return (
    <figure style={{ margin: '2rem 0', maxWidth: 680, display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 16, border: `1px solid ${accent}55`, background: `linear-gradient(135deg, ${accent}22, ${accent}08)` }}>
      <span aria-hidden style={{ width: 46, height: 46, borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, background: `${accent}2A`, flexShrink: 0 }}>⭐</span>
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: accent }}>Figura del partido</span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--body-heading)', lineHeight: 1.15, marginTop: 2 }}>{figura.jugador}</span>
        <span style={{ fontSize: '0.85rem', color: 'var(--body-text)', marginTop: 2 }}>{partes.join(' · ')}</span>
      </span>
      <Escudo eq={equipo} size={34} />
    </figure>
  )
}

const fechaCorta = (iso: string) => new Intl.DateTimeFormat('es-ES', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso + 'T12:00:00Z'))

export function CaraACaraPartido({ partidos, home, away, accent }: { partidos: PartidoPrevio[]; home: string; away: string; accent: string }) {
  // Balance desde el punto de vista de los dos equipos de ESTA previa.
  let vH = 0, vA = 0, e = 0
  for (const p of partidos) {
    const gH = p.local === home ? p.golesLocal : p.golesVisitante
    const gA = p.local === home ? p.golesVisitante : p.golesLocal
    if (gH > gA) vH++; else if (gA > gH) vA++; else e++
  }
  return (
    <figure style={{ margin: '2rem 0', maxWidth: 680, borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <div style={{ padding: '10px 14px', fontSize: 10.5, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: accent, background: `${accent}10` }}>
        Cara a cara <span style={{ color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'none' }}>· últimos {partidos.length}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', padding: '12px 14px 4px', gap: 8 }}>
        <span style={{ fontWeight: 700, color: 'var(--body-heading)' }}>{home} <span style={{ fontFamily: 'var(--font-display)', color: accent, marginLeft: 4 }}>{vH}</span></span>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{e} {e === 1 ? 'empate' : 'empates'}</span>
        <span style={{ fontWeight: 700, color: 'var(--body-heading)', textAlign: 'right' }}><span style={{ fontFamily: 'var(--font-display)', color: '#f5a623', marginRight: 4 }}>{vA}</span> {away}</span>
      </div>
      <div style={{ display: 'flex', height: 8, margin: '6px 14px 10px', borderRadius: 6, overflow: 'hidden', background: 'rgba(255,255,255,0.08)' }}>
        <span style={{ width: `${(vH / partidos.length) * 100}%`, background: accent }} />
        <span style={{ width: `${(e / partidos.length) * 100}%`, background: '#64748B' }} />
        <span style={{ width: `${(vA / partidos.length) * 100}%`, background: '#f5a623' }} />
      </div>
      {partidos.map((p, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '64px 1fr auto 1fr', alignItems: 'center', gap: 8, padding: '8px 14px', borderTop: '1px solid var(--border)', fontSize: '0.88rem' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'capitalize' }}>{fechaCorta(p.fecha)}</span>
          <span style={{ textAlign: 'right', color: 'var(--body-text)', fontWeight: p.golesLocal > p.golesVisitante ? 700 : 400 }}>{p.local}</span>
          <span style={{ fontFamily: 'var(--font-display)', color: 'var(--body-heading)', fontVariantNumeric: 'tabular-nums', padding: '0 4px' }}>{p.golesLocal}-{p.golesVisitante}</span>
          <span style={{ color: 'var(--body-text)', fontWeight: p.golesVisitante > p.golesLocal ? 700 : 400 }}>{p.visitante}</span>
        </div>
      ))}
    </figure>
  )
}
