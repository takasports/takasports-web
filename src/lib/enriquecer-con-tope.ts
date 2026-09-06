// ─────────────────────────────────────────────────────────────────────────────
// Un adorno que tarda no puede dejar la pantalla en blanco.
//
// POR QUÉ EXISTE. El 06/09/2026 el inicio y el calendario de la app salían
// vacíos. La causa no estaba en el código: **Supabase estaba caído** y devolvía
// 522 de Cloudflare… **tardando 19,4 s en fallar**, en todas las tablas. Los tres
// adjuntos del feed (historial, fotos y forma reciente) leen de Supabase, así que
// `/api/events/feed` pasaba a costar ~21 s. La app se rinde a los 15 y degrada a
// lista vacía. Resultado: sin barritas de forma nos quedamos SIN CALENDARIO.
//
// Y eso es un mal negocio. Los tres son ENRIQUECIMIENTOS: el partido, la hora, el
// escudo y el marcador ya vienen de ESPN, que tardó 2,6 s. Lo que aporta Supabase
// es la rachita de cinco letras, la cara del tenista y el "se vieron en abril".
// Cosas que se echan de menos, no que impidan usar la página.
//
// QUÉ HACE. Le da a cada adjunto un tope corto. Si no llega, se sigue sin él: los
// campos que rellenan son opcionales en `SportEvent`, así que la respuesta
// mantiene exactamente la misma forma y ni la web ni la app se enteran de nada
// más allá de que falta un adorno. Nunca lanza.
//
// El tope es 3 s: en un día normal los tres tardan milisegundos (van cacheados),
// así que solo salta cuando algo va mal de verdad.
// ─────────────────────────────────────────────────────────────────────────────

/** Tope por adjunto. Generoso para un día normal, corto frente a una caída. */
export const TOPE_ENRIQUECIMIENTO_MS = 3_000

/**
 * Espera a `tarea` como mucho `ms`. Si vence o falla, se sigue sin ella.
 *
 * Devuelve `true` si llegó a tiempo — útil para registrar cuándo nos estamos
 * quedando sin adornos, que es la señal de que algo de abajo va mal.
 */
/**
 * Como `conTope`, pero devolviendo el VALOR de la tarea, o `null` si no llegó a
 * tiempo o falló. Para cuando lo que se acota no es un adorno sino una fuente de
 * datos que tiene alternativa: `/api/events/past` consulta Supabase y, si no
 * responde, tira de ESPN — pero antes esperaba los 19,4 s que Supabase tardaba
 * en fallar, y la app se rendía antes de ver la alternativa.
 */
export async function conTopeValor<T>(
  nombre: string,
  tarea: Promise<T>,
  ms: number = TOPE_ENRIQUECIMIENTO_MS,
): Promise<T | null> {
  let temporizador: ReturnType<typeof setTimeout> | undefined
  try {
    const r = await Promise.race([
      tarea,
      new Promise<null>((res) => { temporizador = setTimeout(() => res(null), ms) }),
    ])
    if (r === null) console.warn(`[enriquecer] "${nombre}" pasó de ${ms} ms — se usa la alternativa`)
    return r
  } catch (e) {
    console.warn(`[enriquecer] "${nombre}" falló (${(e as Error).message}) — se usa la alternativa`)
    return null
  } finally {
    if (temporizador) clearTimeout(temporizador)
  }
}

export async function conTope(
  nombre: string,
  tarea: Promise<unknown>,
  ms: number = TOPE_ENRIQUECIMIENTO_MS,
): Promise<boolean> {
  let temporizador: ReturnType<typeof setTimeout> | undefined
  try {
    const llego = await Promise.race([
      tarea.then(() => true),
      new Promise<false>((r) => { temporizador = setTimeout(() => r(false), ms) }),
    ])
    if (!llego) console.warn(`[enriquecer] "${nombre}" pasó de ${ms} ms — se sirve sin ello`)
    return llego
  } catch (e) {
    console.warn(`[enriquecer] "${nombre}" falló (${(e as Error).message}) — se sirve sin ello`)
    return false
  } finally {
    if (temporizador) clearTimeout(temporizador)
  }
}
