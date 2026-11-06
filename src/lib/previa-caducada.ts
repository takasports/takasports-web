// Una previa deja de ser portada en cuanto empieza su partido.
//
// El 06/11/2026 la web y la app abrían con previas del martes que decían «se juega
// hoy». Pasa siempre que entra poca noticia nueva, así que se resuelve aquí y no
// depende de lo que publique el robot. Las previas no se borran ni se esconden:
// bajan detrás del resto.
//
// Va aparte, sin dependencias, para poder usarse en servidor y en las pruebas.

interface ConPartido {
  type?: string | null
  kickoffIso?: string | null
}

export function previaCaducada(a: ConPartido, ahora: number = Date.now()): boolean {
  if (a.type !== 'previa' || !a.kickoffIso) return false
  const saque = Date.parse(a.kickoffIso)
  return Number.isFinite(saque) && saque <= ahora
}

/** Mismo orden, con las previas de partidos ya empezados al final. */
export function sinPreviasDelante<T extends ConPartido>(lista: T[], ahora: number = Date.now()): T[] {
  const vigentes = lista.filter(a => !previaCaducada(a, ahora))
  return vigentes.length === lista.length ? lista : [...vigentes, ...lista.filter(a => previaCaducada(a, ahora))]
}
