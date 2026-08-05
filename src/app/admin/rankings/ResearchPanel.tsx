'use client'

// Alta de creadores por investigación automática.
//
// Le pasas un nombre y cualquier identificador que tengas —el handle de
// Instagram, el de TikTok, el canal de YouTube, o nada— y el agente reúne el
// resto: identidad y perfiles oficiales en Wikidata, audiencia y engagement en
// YouTube, seguidores en TikTok. Devuelve la ficha con su nota ya calculada.
//
// Investigar y publicar son dos pasos a propósito: la investigación no escribe
// nada, y lo que se ve en pantalla es exactamente lo que se guardará.
//
// Autenticación: la sesión de admin que ya exige la página (requireAdmin), la
// misma que usa el resto del panel. Sin tokens en el cliente.

import { useState } from 'react'

interface Ficha {
  nombre: string
  handles: Record<string, string>
  pais: string | null
  descripcion: string | null
  wikidata: string | null
  metricas: Record<string, number | null>
  factores: { audiencia: number; crecimiento: number; relevancia: number }
  score: number
  imagen: string | null
  fuentes: { paso: string; estado: 'ok' | 'sin-dato' | 'error'; detalle: string }[]
  pendientes: { red: string; handle: string; motivo: string }[]
  sugerenciasYouTube: { canalId: string; titulo: string; subs: number }[]
}

const DEPORTES = [
  { id: 'futbol', label: 'Fútbol' },
  { id: 'baloncesto', label: 'Baloncesto' },
  { id: 'tenis', label: 'Tenis' },
  { id: 'formula1', label: 'Fórmula 1' },
  { id: 'ufc', label: 'UFC' },
  { id: 'wwe', label: 'WWE' },
]

const ESTADO_COLOR = { ok: '#22c55e', 'sin-dato': '#facc15', error: '#f87171' } as const
const ESTADO_ICONO = { ok: '✓', 'sin-dato': '·', error: '✗' } as const

const num = (n: number | null | undefined) => (n ?? 0).toLocaleString('es-ES')

export default function ResearchPanel() {
  const [nombre, setNombre] = useState('')
  const [instagram, setInstagram] = useState('')
  const [tiktok, setTiktok] = useState('')
  const [youtube, setYoutube] = useState('')
  const [sport, setSport] = useState('futbol')
  const [category, setCategory] = useState('creadores')

  const [cargando, setCargando] = useState(false)
  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [publicando, setPublicando] = useState(false)
  const [resultado, setResultado] = useState<string | null>(null)

  async function investigar(canalForzado?: string) {
    setCargando(true); setError(null); setFicha(null); setResultado(null)
    try {
      const r = await fetch('/api/rankings/research', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ nombre, instagram, tiktok, youtube: canalForzado ?? youtube }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`)
      setFicha(j.ficha)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setCargando(false)
    }
  }

  async function publicar() {
    if (!ficha) return
    setPublicando(true); setError(null)
    try {
      const r = await fetch('/api/rankings/entry', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          nombre: ficha.nombre, sport, category,
          country: ficha.pais, handles: ficha.handles,
          metricas: ficha.metricas, imagen: ficha.imagen,
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`)
      setResultado(
        `Publicado como «${j.id}» con ${j.entry?.score ?? '—'} puntos.` +
          (j.encargadoInstagram
            ? ` Instagram (@${j.encargadoInstagram}) queda encargado al Mac; la ficha se completará sola.`
            : ''),
      )
      setFicha(null); setNombre(''); setInstagram(''); setTiktok(''); setYoutube('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setPublicando(false)
    }
  }

  const campo = { background: '#12121A', border: '1px solid #2A2A3A', borderRadius: 8, padding: '10px 12px', color: '#EDEDF5', fontSize: 14, width: '100%' }
  const etiqueta = { fontSize: 11, color: '#8A8AA0', textTransform: 'uppercase' as const, letterSpacing: 0.6, marginBottom: 6, display: 'block' }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ background: '#16161F', border: '1px solid #23232F', borderRadius: 12, padding: 20 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, color: '#EDEDF5' }}>Alta por investigación</h3>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: '#8A8AA0', lineHeight: 1.5 }}>
          Con el nombre basta. Si además sabes alguno de sus perfiles, mejor: el agente los corrobora
          contra Wikidata, que es lo único que distingue a la persona de quien le ocupó el nombre de usuario.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          <div>
            <label style={etiqueta}>Nombre</label>
            <input style={campo} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Gerard Romero" />
          </div>
          <div>
            <label style={etiqueta}>Instagram</label>
            <input style={campo} value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="@gerardromero" />
          </div>
          <div>
            <label style={etiqueta}>TikTok</label>
            <input style={campo} value={tiktok} onChange={e => setTiktok(e.target.value)} placeholder="@gerardromero" />
          </div>
          <div>
            <label style={etiqueta}>YouTube</label>
            <input style={campo} value={youtube} onChange={e => setYoutube(e.target.value)} placeholder="@gerardromero o UC…" />
          </div>
          <div>
            <label style={etiqueta}>Deporte</label>
            <select style={campo} value={sport} onChange={e => setSport(e.target.value)}>
              {DEPORTES.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
          <div>
            <label style={etiqueta}>Categoría</label>
            <select style={campo} value={category} onChange={e => setCategory(e.target.value)}>
              <option value="creadores">Creador</option>
              <option value="periodistas">Periodista</option>
              <option value="creadores_wwe">Creador WWE</option>
            </select>
          </div>
        </div>

        <button
          onClick={() => investigar()}
          disabled={!nombre.trim() || cargando}
          style={{
            marginTop: 18, padding: '11px 22px', borderRadius: 8, border: 'none',
            background: !nombre.trim() || cargando ? '#2A2A3A' : '#6366f1',
            color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: !nombre.trim() || cargando ? 'default' : 'pointer',
          }}
        >
          {cargando ? 'Investigando…' : 'Investigar'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#2A1416', border: '1px solid #7f1d1d', borderRadius: 10, padding: 14, color: '#fca5a5', fontSize: 13 }}>
          {error}
        </div>
      )}

      {resultado && (
        <div style={{ background: '#0f2419', border: '1px solid #166534', borderRadius: 10, padding: 14, color: '#86efac', fontSize: 13 }}>
          {resultado}
        </div>
      )}

      {ficha && (
        <div style={{ background: '#16161F', border: '1px solid #23232F', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 18 }}>
            {ficha.imagen && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ficha.imagen} alt="" width={56} height={56} style={{ borderRadius: '50%', objectFit: 'cover' }} />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#EDEDF5' }}>{ficha.nombre}</div>
              <div style={{ fontSize: 12, color: '#8A8AA0' }}>
                {[ficha.pais, ficha.descripcion].filter(Boolean).join(' · ') || 'sin datos de identidad'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 34, fontWeight: 800, color: '#6366f1', lineHeight: 1 }}>{ficha.score}</div>
              <div style={{ fontSize: 10, color: '#8A8AA0', textTransform: 'uppercase', letterSpacing: 0.6 }}>Índice</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 18 }}>
            {([
              ['Audiencia', ficha.factores.audiencia, '50%'],
              ['Crecimiento', ficha.factores.crecimiento, '25%'],
              ['Relevancia', ficha.factores.relevancia, '25%'],
            ] as const).map(([label, valor, peso]) => (
              <div key={label} style={{ background: '#12121A', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 11, color: '#8A8AA0' }}>{label} <span style={{ opacity: 0.6 }}>{peso}</span></div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#EDEDF5' }}>{valor}</div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 12, color: '#8A8AA0', marginBottom: 8 }}>
            YouTube {num(ficha.metricas.yt_subscribers)} · TikTok {num(ficha.metricas.tiktok_known)} ·
            Instagram {num(ficha.metricas.instagram_known)}
            {ficha.metricas.videos_last_30d !== null && ` · ${ficha.metricas.videos_last_30d} vídeos en 30 días`}
          </div>

          {ficha.sugerenciasYouTube?.length > 0 && (
            <div style={{ background: '#1c1a12', border: '1px solid #6b5b16', borderRadius: 8, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#facc15', marginBottom: 4, fontWeight: 600 }}>
                Ningún canal se llama como él
              </div>
              <div style={{ fontSize: 12, color: '#8A8AA0', marginBottom: 10, lineHeight: 1.5 }}>
                Muchos publican bajo el nombre de su programa — el canal de Gerard Romero se llama
                «Jijantes FC». Si alguno es suyo, elígelo y se recalcula todo con ese canal.
              </div>
              {ficha.sugerenciasYouTube.map(sug => (
                <button
                  key={sug.canalId}
                  onClick={() => investigar(sug.canalId)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', marginBottom: 6,
                    background: '#12121A', border: '1px solid #2A2A3A', borderRadius: 6,
                    padding: '8px 12px', color: '#EDEDF5', fontSize: 13, cursor: 'pointer',
                  }}
                >
                  {sug.titulo}
                  <span style={{ color: '#8A8AA0', marginLeft: 8, fontSize: 12 }}>
                    {num(sug.subs)} suscriptores
                  </span>
                </button>
              ))}
            </div>
          )}

          <div style={{ borderTop: '1px solid #23232F', paddingTop: 14, marginBottom: 16 }}>
            <div style={{ ...etiqueta, marginBottom: 10 }}>Qué se pudo averiguar</div>
            {ficha.fuentes.map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, fontSize: 12, marginBottom: 6, lineHeight: 1.5 }}>
                <span style={{ color: ESTADO_COLOR[f.estado], fontWeight: 700, width: 12 }}>{ESTADO_ICONO[f.estado]}</span>
                <span style={{ color: '#EDEDF5', minWidth: 72 }}>{f.paso}</span>
                <span style={{ color: '#8A8AA0', flex: 1 }}>{f.detalle}</span>
              </div>
            ))}
          </div>

          <button
            onClick={publicar}
            disabled={publicando}
            style={{
              padding: '11px 22px', borderRadius: 8, border: 'none',
              background: publicando ? '#2A2A3A' : '#22c55e', color: '#08130c',
              fontSize: 14, fontWeight: 700, cursor: publicando ? 'default' : 'pointer',
            }}
          >
            {publicando ? 'Publicando…' : 'Publicar en el ranking'}
          </button>
          <button
            onClick={() => setFicha(null)}
            style={{ marginLeft: 10, padding: '11px 18px', borderRadius: 8, border: '1px solid #2A2A3A', background: 'transparent', color: '#8A8AA0', fontSize: 14, cursor: 'pointer' }}
          >
            Descartar
          </button>
        </div>
      )}
    </div>
  )
}
