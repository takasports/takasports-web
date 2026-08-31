// Ortografía del glosario.
//
// Por qué existe: 10 de las 211 entradas estaban escritas SIN UNA SOLA TILDE ni
// eñe —dos mil letras cada una— y entre ellas estaban las de más tráfico.
// `que-es-la-prorroga-futbol` es la página con más impresiones de todo el sitio
// después de las noticias (57.225 en 90 días) y su título en Google decía
// "Prorroga". El glosario entero rinde al 0,19% de CTR con 244.000 impresiones;
// enseñar el título mal escrito no ayudaba.
//
// Este test no juzga estilo: solo caza formas que en español NO existen sin
// tilde, así que no puede dar falsos positivos. Ojo: el plural de -ción/-sión
// va SIN tilde (acción → acciones), por eso solo se vigilan los singulares.

import { describe, it, expect } from 'vitest'
import { GLOSARIO_TERMS } from './glosario-terms'

/** Formas mal escritas que no admiten discusión. */
const MAL_ESCRITAS = [
  'prorroga', 'arbitro', 'arbitros', 'balon', 'porteria', 'porterias',
  'futbol', 'companero', 'companeros', 'amonestacion', 'agresion', 'expulsion',
  'sancion', 'infraccion', 'posicion', 'situacion', 'accion', 'reaccion',
  'decision', 'direccion', 'presion', 'tension', 'sucesion', 'ocasion',
  'recepcion', 'posesion', 'vision', 'opcion', 'fraccion', 'distincion',
  'participacion', 'acumulacion', 'interrupcion', 'prolongacion', 'competicion',
  'sustitucion', 'duracion', 'definicion', 'formacion', 'clasificacion',
  'automatica', 'automatico', 'numerica', 'numerico', 'fisica', 'fisico',
  'tactica', 'tactico', 'tecnica', 'tecnico', 'basica', 'basico',
  'maxima', 'maximo', 'minima', 'minimo', 'ultimo', 'ultima', 'penultimo',
  'rapido', 'rapida', 'unico', 'unica', 'titulo', 'metodo', 'numero',
  'linea', 'lineas', 'area', 'areas', 'angulo', 'anos', 'ahi', 'asi', 'aqui',
  'tambien', 'despues', 'detras', 'ademas', 'segun', 'atras',
  'senala', 'senalar', 'senal', 'pequena', 'anadido', 'anadir', 'subita',
  'milimetro', 'milimetros', 'centimetros', 'historicas', 'dramaticos',
  'polemica', 'television', 'mayoria', 'estadisticas', 'legitimo', 'valido',
  'psicologica', 'caracteristico', 'enfrentandose', 'matematicamente',
]

/** Interrogativas que al abrir un subtítulo siempre van con tilde. */
const INTERROGATIVAS = ['Como', 'Cuando', 'Donde', 'Cuanto', 'Cuantos', 'Cual', 'Cuales', 'Quien']

const textoVisible = (t: (typeof GLOSARIO_TERMS)[number]) =>
  [t.term, t.summary, ...t.body].join('\n')

describe('ortografía del glosario', () => {
  it('ninguna entrada usa formas que en español no existen sin tilde', () => {
    const fallos: string[] = []
    for (const t of GLOSARIO_TERMS) {
      const texto = textoVisible(t)
      for (const mala of MAL_ESCRITAS) {
        const re = new RegExp(`(?<![\\p{L}])${mala}(?![\\p{L}])`, 'iu')
        if (re.test(texto)) fallos.push(`${t.slug}: "${mala}"`)
      }
    }
    expect(fallos, `escrito sin tilde:\n  ${fallos.join('\n  ')}`).toEqual([])
  })

  it('la segunda interrogativa de un subtítulo encadenado también lleva tilde', () => {
    // No se puede exigir tilde a toda interrogativa que abre subtítulo: "Cuando
    // el marcador se aprieta" es una subordinada temporal y va SIN tilde. Lo que
    // sí es inequívoco es la interrogativa encadenada tras "y", que continúa una
    // pregunta indirecta: "Cuándo cuenta y cuándo no", "Cuándo se pita y cómo se
    // ejecuta". Ese es justo el caso que se coló al corregir solo la primera.
    const fallos: string[] = []
    for (const t of GLOSARIO_TERMS) {
      for (const linea of t.body) {
        const m = /^\*\*(.+)\*\*$/.exec(linea.trim())
        if (!m) continue
        const abre = m[1].trim().split(/\s+/)[0]
        if (!INTERROGATIVAS.map(x => x.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
          .concat(['Cómo', 'Cuándo', 'Dónde', 'Cuánto', 'Cuántos', 'Cuál', 'Cuáles', 'Quién'])
          .includes(abre)) continue
        for (const suelta of INTERROGATIVAS) {
          const re = new RegExp(`\\by ${suelta.toLowerCase()}\\b`, 'u')
          if (re.test(m[1])) fallos.push(`${t.slug}: "${m[1]}"`)
        }
      }
    }
    expect(fallos, `interrogativa encadenada sin tilde:\n  ${fallos.join('\n  ')}`).toEqual([])
  })

  it('ninguna entrada larga se queda sin una sola tilde', () => {
    // El caso que originó todo: 2.000 letras con densidad 0,00%. La media del
    // glosario bien escrito ronda el 1,8%; se exige solo no estar a cero.
    const fallos: string[] = []
    for (const t of GLOSARIO_TERMS) {
      const texto = textoVisible(t)
      const letras = (texto.match(/\p{L}/gu) ?? []).length
      if (letras < 400) continue
      const acentos = (texto.match(/[áéíóúüñÁÉÍÓÚÜÑ]/g) ?? []).length
      if (acentos === 0) fallos.push(t.slug)
    }
    expect(fallos, `sin ninguna tilde:\n  ${fallos.join('\n  ')}`).toEqual([])
  })
})
