// Letra de un resultado en toda la web: G (ganó), E (empató), P (perdió), igual que
// la app. Convivían W/D/L, V/E/D y V/D, y «D» era empate en una ficha y derrota en otra.
export function letraForma(r: string | null | undefined): string {
  return r === 'W' ? 'G' : r === 'L' ? 'P' : r === 'D' ? 'E' : (r ?? '')
}
