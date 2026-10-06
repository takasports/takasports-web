// Piezas visuales del cuerpo de una noticia: el marcador con la línea de tiempo, la
// mini-clasificación, la racha de cada equipo (datos de ESPN, ver
// `lib/partido-visual.ts`) y la cita destacada. Se pintan desde los componentes de
// PortableText de la página de la noticia; son de servidor y sin estado.
//
// Diseño: el sistema de casillas de la nota (`.cas-*`, globals.css). El marcador y la
// figura son PROTAGONISTAS; clasificación, racha y cara a cara son casillas de DATOS
// con la misma cabecera; el destacado es tipografía, sin caja. Los colores salen de
// los tokens `--body-*` y `--border`, así que el modo lectura claro los recoge solo.

import type { CSSProperties } from 'react'
import DynamicImage from '@/components/DynamicImage'
import { accentTexto } from '@/lib/sports'
import type { EquipoVisual, EventoVisual, FilaClasificacion, Figura, PartidoPrevio } from '@/lib/partido-visual'

const ICONO: Record<EventoVisual['tipo'], string> = { gol: '⚽', penalti: '⚽', propia: '⚽', roja: '🟥' }
const NOTA: Record<EventoVisual['tipo'], string> = { gol: '', penalti: 'penalti', propia: 'en propia', roja: 'expulsado' }

const acento = (accent: string) => ({ '--acc': accent, '--acc-text': accentTexto(accent) }) as CSSProperties

function Escudo({ eq, size }: { eq: EquipoVisual; size: number }) {
  if (!eq.escudo) return <span style={{ width: size, height: size, display: 'inline-block' }} />
  return <DynamicImage src={eq.escudo} alt={eq.nombre} width={size} height={size} style={{ width: size, height: size, objectFit: 'contain' }} unoptimized />
}

function Cabecera({ texto, extra }: { texto: string; extra?: string }) {
  return (
    <div className="cas__head">
      <span className="cas__label">{texto}</span>
      {extra && <span className="cas__meta">{extra}</span>}
    </div>
  )
}

export function MarcadorPartido({ home, away, eventos, accent }: { home: EquipoVisual; away: EquipoVisual; eventos: EventoVisual[]; accent: string }) {
  return (
    <figure className="pv-marcador cas cas--hero cas-marcador" style={acento(accent)}>
      <div className="cas-marcador__top">
        <div className="cas-marcador__eq">
          <Escudo eq={home} size={52} />
          <span>{home.nombre}</span>
        </div>
        <div className="cas-marcador__score">
          <div className="cas-marcador__num">
            {home.goles ?? '-'}<span aria-hidden>-</span>{away.goles ?? '-'}
          </div>
          <div className="cas-marcador__estado">Final</div>
        </div>
        <div className="cas-marcador__eq">
          <Escudo eq={away} size={52} />
          <span>{away.nombre}</span>
        </div>
      </div>
      {eventos.length > 0 && (
        <ol className="cas-marcador__eventos">
          <span aria-hidden className="cas-marcador__eje" />
          {eventos.map((e, i) => {
            const izq = e.lado === 'home'
            const texto = (
              <span className={`cas-marcador__ev ${izq ? 'is-izq' : 'is-der'}`}>
                <span className="cas-marcador__jug">{e.jugador}</span>
                {(NOTA[e.tipo] || e.asistencia) && (
                  <span className="cas-marcador__nota">{NOTA[e.tipo] || `asist. ${e.asistencia}`}</span>
                )}
              </span>
            )
            return (
              <li key={i}>
                <span>{izq ? texto : null}</span>
                <span className="cas-marcador__min">
                  <span className={e.tipo === 'roja' ? 'is-roja' : undefined}>{ICONO[e.tipo]}</span>
                  <span>{e.minuto}</span>
                </span>
                <span>{izq ? null : texto}</span>
              </li>
            )
          })}
        </ol>
      )}
      <figcaption className="cas__foot">Datos oficiales del partido</figcaption>
    </figure>
  )
}

export function ClasificacionPartido({ filas, accent }: { filas: FilaClasificacion[]; accent: string }) {
  return (
    <figure className="cas cas--data cas-tabla" style={acento(accent)}>
      <Cabecera texto="Clasificación" />
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Equipo</th>
            <th className="num">PJ</th>
            <th className="num">Dif</th>
            <th className="num">Pts</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.pos + f.equipo} className={f.destacado ? 'is-dest' : undefined}>
              <td className="pos">{f.pos}</td>
              <td className="eq">{f.equipo}</td>
              <td className="num">{f.pj}</td>
              <td className="num">{f.dif}</td>
              <td className="num pts">{f.pts}</td>
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
    <div className="cas-forma__fila">
      <Escudo eq={eq} size={26} />
      <span className="cas-forma__eq">{eq.nombre}</span>
      <span className="cas-forma__res">
        {r.map((x, i) => (
          <span key={i} title={x === 'V' ? 'Victoria' : x === 'E' ? 'Empate' : 'Derrota'} style={{ background: COLOR_FORMA[x] ?? '#64748B', opacity: i === 0 ? 1 : 0.85 }}>{x}</span>
        ))}
      </span>
    </div>
  )
  return (
    <figure className="cas cas--data cas-forma" style={acento(accent)}>
      <Cabecera texto="Últimos partidos" extra="el más reciente, primero" />
      {fila(home, forma.home)}
      {fila(away, forma.away)}
    </figure>
  )
}

export function Destacado({ texto, autor, accent }: { texto: string; autor: string | null; accent: string }) {
  return (
    <figure className="cas-quote" style={acento(accent)}>
      <blockquote>
        <span aria-hidden>«</span>{texto}<span aria-hidden>»</span>
      </blockquote>
      {autor && <figcaption>— {autor}</figcaption>}
    </figure>
  )
}

export function FiguraPartido({ figura, equipo, accent }: { figura: Figura; equipo: EquipoVisual; accent: string }) {
  const partes = [
    figura.goles ? `${figura.goles} ${figura.goles === 1 ? 'gol' : 'goles'}${figura.penaltis ? ` (${figura.penaltis} de penalti)` : ''}` : null,
    figura.asistencias ? `${figura.asistencias} ${figura.asistencias === 1 ? 'asistencia' : 'asistencias'}` : null,
  ].filter(Boolean)
  return (
    <figure className="cas cas--hero cas-figura" style={acento(accent)}>
      <span aria-hidden className="cas-figura__star">⭐</span>
      <span className="cas-figura__body">
        <span className="cas__label">Figura del partido</span>
        <span className="cas-figura__nombre">{figura.jugador}</span>
        <span className="cas-figura__datos">{partes.join(' · ')}</span>
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
    <figure className="cas cas--data cas-h2h" style={acento(accent)}>
      <Cabecera texto="Cara a cara" extra={`últimos ${partidos.length}`} />
      <div className="cas-h2h__balance">
        <span>{home} <b className="is-home">{vH}</b></span>
        <span className="cas-h2h__emp">{e} {e === 1 ? 'empate' : 'empates'}</span>
        <span className="is-der"><b className="is-away">{vA}</b> {away}</span>
      </div>
      <div className="cas-h2h__barra">
        <span style={{ width: `${(vH / partidos.length) * 100}%`, background: 'var(--acc)' }} />
        <span style={{ width: `${(e / partidos.length) * 100}%`, background: '#64748B' }} />
        <span style={{ width: `${(vA / partidos.length) * 100}%`, background: '#f5a623' }} />
      </div>
      {partidos.map((p, i) => (
        <div key={i} className="cas-h2h__fila">
          <span className="cas-h2h__fecha">{fechaCorta(p.fecha)}</span>
          <span className={`is-der${p.golesLocal > p.golesVisitante ? ' is-gana' : ''}`}>{p.local}</span>
          <span className="cas-h2h__res">{p.golesLocal}-{p.golesVisitante}</span>
          <span className={p.golesVisitante > p.golesLocal ? 'is-gana' : undefined}>{p.visitante}</span>
        </div>
      ))}
    </figure>
  )
}
