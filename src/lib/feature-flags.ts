// Feature flags centralizados. Cambiar aquí afecta a todo el producto.
//
// RANKED_FUTBOL_ENABLED enciende Ranked Fútbol (la vista de Fechas) como
// deporte de entrada de /predicciones. Lo leen PrediccionesHub, PorraCTA,
// RankedLeaderboard y la portada.
//
// OJO: apagarlo NO detiene el cron sync-football, que sigue publicando y
// liquidando Fechas. Es lo que se quiere —los resultados no deben perderse
// porque la UI esté oculta—, pero si lo apagas por una avería, recuerda que la
// base de datos sigue avanzando por debajo.
export const RANKED_FUTBOL_ENABLED = true

// ── Avisos push (03/10/2026) ───────────────────────────────────────────────
// APAGADOS mientras no exista la variable de entorno (o no valga 'true'/'1').
// Apagado no significa «no hace nada»: el cron y el webhook calculan igual a
// quién avisarían y con qué texto, y lo DEVUELVEN/registran sin enviar ni
// escribir en la base de datos. Así se pueden revisar los textos con datos
// reales antes de encenderlos. Se leen en cada llamada (no al cargar el
// módulo) para que cambiar la variable en Vercel baste con un redeploy.
//
//   AVISOS_EQUIPO_ENABLED   → /api/cron/avisos-equipo («tu equipo juega hoy»
//                             y «resultado final»)
//   AVISOS_NOTICIAS_ENABLED → avisos de noticias desde /api/sanity-webhook
function envActivo(nombre: string): boolean {
  const v = (process.env[nombre] ?? '').trim().toLowerCase()
  return v === 'true' || v === '1'
}
// ENCENDIDO el 10/10/2026 (visto bueno del editor a «hoy juega tu equipo» y
// «resultado final»). Para apagarlo de urgencia sin tocar código basta con poner
// AVISOS_EQUIPO_ENABLED=false (o 0) en Vercel y redesplegar.
export const avisosEquipoEnabled = (): boolean => {
  const v = (process.env.AVISOS_EQUIPO_ENABLED ?? '').trim().toLowerCase()
  return !(v === 'false' || v === '0')
}
export const avisosNoticiasEnabled = (): boolean => envActivo('AVISOS_NOTICIAS_ENABLED')
