// Jornada de cada partido de liga, calculada a partir de la clasificación.
//
// ESPN no publica el número de jornada en el fútbol (ni `week` ni notas), y
// quien busca «horarios de la próxima jornada» o «jornada la liga» llegaba a un
// calendario sin la palabra «jornada» en toda la página (02/10/2026).
//
// El cálculo: la clasificación dice cuántos partidos lleva jugados cada equipo
// (`gp`). Su siguiente partido es el gp+1, el de después el gp+2… Un partido
// pertenece a la jornada MAYOR de sus dos equipos: si uno arrastra un
// aplazado, va por detrás y no debe tirar del partido hacia una jornada ya
// jugada.
//
// APLAZADOS: un partido recuperado (Levante–Athletic del 21/10/2026, de la
// jornada 7) sale por recuento en la jornada en curso, donde sus dos equipos
// ya juegan. Si alguno de los dos ya tiene partido en esa jornada, ese no es
// de ella: va aparte como «Partido aplazado».
//
// Si algo no cuadra (un equipo que no está en la tabla, o una jornada con más
// partidos de los que caben), devuelve null y la página se queda con la
// agrupación por días de siempre. Mejor sin jornada que con una equivocada.

import type { SportEvent } from './types'

export interface FilaTabla {
  teamId?: string
  name: string
  gp: number
}

export interface Jornada {
  /** null = partido aplazado (de una jornada ya pasada). */
  numero: number | null
  partidos: SportEvent[]
  /** YYYY-MM-DD del primer y del último partido (hora de Madrid). */
  desde: string
  hasta: string
}

function clave(nombre: string): string {
  return nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function asignarJornadas(
  partidos: SportEvent[],
  tabla: FilaTabla[],
  diaDe: (e: SportEvent) => string,
): Jornada[] | null {
  if (partidos.length === 0 || tabla.length < 4) return null
  const porId = new Map<string, number>()
  const porNombre = new Map<string, number>()
  for (const f of tabla) {
    if (f.teamId) porId.set(f.teamId, f.gp)
    porNombre.set(clave(f.name), f.gp)
  }
  const jugados = (id: string | undefined, nombre: string | undefined): number | undefined =>
    (id ? porId.get(id) : undefined) ?? (nombre ? porNombre.get(clave(nombre)) : undefined)

  const ordenados = [...partidos].sort((a, b) => (a.isoDate ?? '').localeCompare(b.isoDate ?? ''))
  // Partidos ya asignados a cada equipo dentro de esta lista.
  const siguientes = new Map<string, number>()
  const porJornada = new Map<number, SportEvent[]>()
  const equiposEn = new Map<number, Set<string>>()
  const aplazados: SportEvent[] = []

  for (const e of ordenados) {
    if (!e.away) return null
    const kH = e.homeTeamId ?? clave(e.home)
    const kA = e.awayTeamId ?? clave(e.away)
    const gpH = jugados(e.homeTeamId, e.home)
    const gpA = jugados(e.awayTeamId, e.away)
    if (gpH === undefined || gpA === undefined) return null
    const nH = (siguientes.get(kH) ?? 0) + 1
    const nA = (siguientes.get(kA) ?? 0) + 1
    siguientes.set(kH, nH)
    siguientes.set(kA, nA)
    const numero = Math.max(gpH + nH, gpA + nA)
    const equipos = equiposEn.get(numero) ?? new Set<string>()
    if (equipos.has(kH) || equipos.has(kA)) { aplazados.push(e); continue }
    equipos.add(kH); equipos.add(kA); equiposEn.set(numero, equipos)
    const lista = porJornada.get(numero) ?? []
    lista.push(e)
    porJornada.set(numero, lista)
  }

  // En una jornada juegan todos una vez: nunca más de la mitad de la tabla.
  const maximo = Math.floor(tabla.length / 2)
  for (const lista of porJornada.values()) if (lista.length > maximo) return null

  const bloques: Jornada[] = [...porJornada.entries()].map(([numero, lista]) => {
    const dias = lista.map(diaDe).sort()
    return { numero, partidos: lista, desde: dias[0], hasta: dias[dias.length - 1] }
  })
  for (const e of aplazados) bloques.push({ numero: null, partidos: [e], desde: diaDe(e), hasta: diaDe(e) })
  // Por fecha: un aplazado entre semana va entre las dos jornadas que lo rodean.
  return bloques.sort((a, b) => a.desde.localeCompare(b.desde) || (a.numero ?? 0) - (b.numero ?? 0))
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** "2026-10-09","2026-10-12" → "del 9 al 12 de octubre"; un solo día → "el 9 de octubre". */
export function rangoJornada(desde: string, hasta: string): string {
  const [, m1, d1] = desde.split('-').map(Number)
  const [, m2, d2] = hasta.split('-').map(Number)
  if (desde === hasta) return `el ${d1} de ${MESES[m1 - 1]}`
  return m1 === m2
    ? `del ${d1} al ${d2} de ${MESES[m2 - 1]}`
    : `del ${d1} de ${MESES[m1 - 1]} al ${d2} de ${MESES[m2 - 1]}`
}
