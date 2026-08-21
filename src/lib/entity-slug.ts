// Constructores PUROS de los slugs de ficha (jugador y equipo).
//
// Viven aparte de player-slug.ts / team-slug.ts porque esos módulos también
// RESUELVEN slugs contra la base (player-slug importa `supabase-admin`, que usa
// la service-role key y es solo de servidor). El calendario es un componente
// cliente y solo necesita CONSTRUIR la URL, así que importar aquellos metería
// código de servidor en el bundle del navegador.
//
// Fuente de verdad única: player-slug.ts y team-slug.ts reexportan de aquí.

// Letras que NO se descomponen con NFD (su diacrítico no es un carácter combinante,
// forma parte del glifo). Sin esto, media Europa del Este pierde la última letra:
// "Mitrović" → "mitrovi", "Vlahović" → "vlahovi".
//
// COPIA EXACTA del mapa que vivía en player-slug.ts: tocar una sola entrada
// cambiaría slugs YA indexados, así que se mueve tal cual.
const NON_DECOMPOSABLE: Record<string, string> = {
  đ: 'd', Đ: 'D', ð: 'd', Ð: 'D',
  ø: 'o', Ø: 'O', ł: 'l', Ł: 'L',
  ß: 'ss', æ: 'ae', Æ: 'AE', œ: 'oe', Œ: 'OE',
  ı: 'i', ħ: 'h', ŧ: 't',
}

/** "Kylian Mbappé" → "kylian-mbappe". */
export function toNameSlug(name: string): string {
  let out = ''
  for (const ch of name) out += NON_DECOMPOSABLE[ch] ?? ch
  return out
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // marcas diacríticas combinantes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Slug canónico de una ficha de jugador. Si el nombre se queda en nada al
 * normalizar (alfabetos no latinos), cae a solo el id: sigue siendo una URL
 * válida y resoluble, simplemente sin keyword.
 */
export function canonicalPlayerSlug(name: string | null | undefined, espnId: string): string {
  const base = name ? toNameSlug(name) : ''
  return base ? `${base}-${espnId}` : espnId
}

/** Slug canónico de una ficha de equipo: nombre legible + teamId al final. */
export function canonicalTeamSlug(name: string | null | undefined, teamId: string): string {
  const base = name ? toNameSlug(name) : ''
  return base ? `${base}-${teamId}` : teamId
}
