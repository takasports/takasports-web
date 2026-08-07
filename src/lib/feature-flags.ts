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
