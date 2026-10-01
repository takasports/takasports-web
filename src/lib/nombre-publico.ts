// Nombre público por defecto de un usuario que no ha dado ninguno.
//
// Hasta el 01/10/2026 el respaldo era la parte del correo antes de la @: quien
// se registraba con email salía en la Liga Taka, en los comentarios y en las
// ligas con media dirección a la vista («contactotakasports+review» llegó a
// estar en el podio). Un correo no es un nombre, y enseñarlo no es decisión
// nuestra.
//
// «Takero» + cuatro cifras sacadas del id: estable (el mismo usuario sale
// siempre igual, en todas partes) y sin revelar nada.

export function nombrePorDefecto(userId: string): string {
  const hex = userId.replace(/-/g, '').slice(0, 8)
  const n = Number.parseInt(hex, 16)
  const cifras = Number.isFinite(n) ? String(n % 10000).padStart(4, '0') : '0000'
  return `Takero ${cifras}`
}
