/**
 * seed-articles.mjs
 * Crea artículos de prueba en Sanity vía API Mutations.
 *
 * USO:
 *   1. Asegúrate de tener NEXT_PUBLIC_SANITY_PROJECT_ID y SANITY_API_TOKEN en .env.local
 *   2. node scripts/seed-articles.mjs
 *
 * REQUISITOS:
 *   - El token de Sanity debe tener permisos de escritura (Editor o Deployment)
 *   - Genera el token en: https://www.sanity.io/manage → proyecto → API → Tokens
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Leer .env.local manualmente (sin dotenv) ─────────────────
function loadEnv() {
  const envPath = join(__dirname, '..', '.env.local')
  try {
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      const [key, ...rest] = line.split('=')
      if (key && rest.length) {
        process.env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '')
      }
    }
  } catch {
    console.warn('No se pudo leer .env.local — usa variables de entorno del sistema.')
  }
}

loadEnv()

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
const DATASET    = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production'
const TOKEN      = process.env.SANITY_API_TOKEN

if (!PROJECT_ID) {
  console.error('❌  Falta NEXT_PUBLIC_SANITY_PROJECT_ID en .env.local')
  process.exit(1)
}
if (!TOKEN) {
  console.error('❌  Falta SANITY_API_TOKEN en .env.local')
  console.error('   Genera uno en: https://www.sanity.io/manage → tu proyecto → API → Tokens')
  process.exit(1)
}

// ── Artículos de prueba ───────────────────────────────────────
const now = new Date()
const hoursAgo = (h) => new Date(now - h * 3_600_000).toISOString()

const ARTICLES = [
  {
    _type: 'article',
    title: 'Mbappé lidera la remontada del Real Madrid con hat-trick histórico en el Clásico',
    subtitle: 'El francés marcó tres goles en 22 minutos para sellar una victoria épica ante el Barça en el Bernabéu.',
    short_summary: 'Kylian Mbappé protagonizó una actuación para la historia en el Clásico. Con el Madrid perdiendo 2-0 en el minuto 58, el delantero francés tomó el control del partido y anotó tres veces para darle la vuelta al marcador y entregar los tres puntos al conjunto blanco.',
    body: `El Santiago Bernabéu vivió esta noche una de esas actuaciones que quedan grabadas en la memoria del madridismo. Kylian Mbappé, en un estado de gracia absoluta, firmó un hat-trick de ensueño para remontar un 0-2 adverso ante el FC Barcelona y mantener al Real Madrid en lo más alto de la tabla de La Liga.

Todo apuntaba a una noche difícil para los locales. Raphinha y Lewandowski habían puesto al Barça por delante antes del descanso, y el primer tiempo se fue entre pitidos del Bernabéu. Pero en la segunda mitad el partido cambió de protagonista.

En el minuto 58, Mbappé recortó distancias con un disparo cruzado desde la frontal del área que dejó sin opción a Ter Stegen. Cuatro minutos después, el francés aprovechó un rechace en el área para empatar el partido. Y cuando el cronómetro marcaba el 80, una habilitación milimétrica de Bellingham le dejó mano a mano con el portero alemán: definición perfecta, Bernabéu en éxtasis.

"Es lo que hacemos. Nunca nos rendimos", declaró Mbappé al final del partido. El delantero, que llegó el pasado verano procedente del PSG, suma ya 28 goles en Liga esta temporada y consolida su candidatura al Balón de Oro.

Con esta victoria, el Real Madrid se coloca a cinco puntos de ventaja sobre el Barça con ocho jornadas por disputar.`,
    sport: 'Fútbol',
    category: 'LaLiga',
    tags: ['Real Madrid', 'Clásico', 'Mbappé', 'LaLiga'],
    source_name: 'TakaSports Redacción',
    publishedAt: hoursAgo(2),
  },
  {
    _type: 'article',
    title: 'Los Celtics remontan a los Cavaliers y conquistan las Finales del Este por segundo año',
    subtitle: 'Boston ganó el séptimo partido en Cleveland con una actuación monumental de Jayson Tatum (42 puntos).',
    short_summary: 'En un séptimo partido de infarto, los Boston Celtics confirmaron su condición de favoritos al título NBA al eliminar a los Cleveland Cavaliers y clasificarse para las Finales de Conferencia del Este por segundo año consecutivo.',
    body: `El Rocket Mortgage FieldHouse se quedó en silencio. Los Boston Celtics, con Jayson Tatum como estandarte, desactivaron el sueño de Cleveland en un séptimo partido que se definió en los últimos treinta segundos y que deja al equipo de Joe Mazzulla a dos series de ser campeón de la NBA.

Tatum fue descomunal. 42 puntos, 11 rebotes y 7 asistencias en una actuación de los que hacen historia. El alero de Boston asumió toda la responsabilidad ofensiva cuando el equipo lo necesitó, y su triple a falta de 1:12 para el final, con Cleveland por delante en un punto, fue el golpe definitivo.

Jalen Brown aportó 28 puntos y Al Horford fue la clave defensiva sobre Donovan Mitchell, que se quedó en 29 puntos después de un tercer cuarto extraordinario.

"Este equipo tiene un corazón enorme", declaró Tatum en la zona mixta. "Sabíamos que podíamos ganar aquí, siempre lo supimos."

Los Celtics se medirán en las Finales del Este al ganador de la serie entre los New York Knicks y los Indiana Pacers, actualmente empatada 3-3.`,
    sport: 'NBA',
    category: 'Playoffs',
    tags: ['Celtics', 'NBA Playoffs', 'Tatum', 'Finales del Este'],
    source_name: 'TakaSports Redacción',
    publishedAt: hoursAgo(5),
  },
  {
    _type: 'article',
    title: 'Verstappen domina los libres del GP de España y Lewis Hamilton debuta en rojo en el top 3',
    subtitle: 'El tricampeón marcó el mejor tiempo en las dos sesiones; Hamilton, en su primera carrera con Ferrari, terminó tercero en la FP2.',
    short_summary: 'Max Verstappen dejó clara su superioridad en la primera jornada del Gran Premio de España. El neerlandés de Red Bull lideró ambas sesiones de entrenamientos libres, mientras que Lewis Hamilton protagonizó el momento del fin de semana al marcar el tercer tiempo en la FP2 con su nuevo Ferrari.',
    body: `El Circuit de Barcelona-Catalunya fue testigo de un arranque de fin de semana que prometía emociones, y el viernes no defraudó. Max Verstappen, implacable como siempre, marcó el mejor crono en las dos sesiones de entrenamientos libres del Gran Premio de España y da continuidad a su gran inicio de temporada.

Pero el protagonismo de la jornada se lo llevó Lewis Hamilton. El siete veces campeón del mundo, que este año debuta con la Scuderia Ferrari, completó su segunda sesión libre con un tiempo que le colocó tercero, a apenas 312 milésimas del tiempo de Verstappen. Las gradas del Circuit, repletas de aficionados que esperaban ver al inglés de rojo, se entregaron a él con una ovación que recorrió todo el trazado.

"Ha sido una jornada muy positiva", declaró Hamilton. "El coche me ha dado confianza desde el principio. Todavía hay trabajo por hacer, pero estoy muy contento con el ritmo que hemos mostrado."

Charles Leclerc, compañero de Hamilton en Ferrari, terminó segundo a 0.087 segundos de Verstappen, mientras que Lando Norris completó el top 4 con su McLaren.

La clasificación se celebra este sábado a las 15:00 horas.`,
    sport: 'F1',
    category: 'Fórmula 1',
    tags: ['F1', 'Verstappen', 'Hamilton', 'Ferrari', 'GP España'],
    source_name: 'TakaSports Redacción',
    publishedAt: hoursAgo(8),
  },
  {
    _type: 'article',
    title: 'Alcaraz y Sinner confirman sus semifinales en Roland Garros — la batalla más esperada del año',
    subtitle: 'El español y el italiano ganaron sus cuartos de final con autoridad y se verán las caras el viernes en París.',
    short_summary: 'Carlos Alcaraz y Jannik Sinner sellaron su pase a las semifinales de Roland Garros con victorias convincentes en cuartos. El duelo entre el número 1 y el número 2 del mundo se disputará el viernes en la Philippe-Chatrier.',
    body: `Roland Garros tiene el duelo que esperaba. Carlos Alcaraz y Jannik Sinner, los dos mejores tenistas del planeta, se verán las caras el próximo viernes en las semifinales del Grand Slam parisino después de superar con autoridad sus respectivos cuartos de final.

Alcaraz no dio opción a Holger Rune. El murciano desplegó un tenis de altísimo nivel para ganar 6-3, 6-4, 6-2 en poco más de dos horas, mostrando la variedad táctica que le hace tan difícil de leer sobre la tierra batida. La Philippe-Chatrier vibró con cada punto del español.

Sinner, por su parte, también firmó una victoria cómoda ante Alexander Zverev, resolviéndolo en cuatro sets con una actuación sólida de principio a fin. El italiano lleva 18 victorias consecutivas en Grand Slams y llega a la semifinal con la confianza por las nubes.

El historial entre ambos está igualado: cuatro victorias cada uno. Pero en tierra, Alcaraz tiene ventaja: ganó el año pasado en la final precisamente aquí, en París.

"Voy a darlo todo. Los partidos contra Carlos son siempre los más exigentes", declaró Sinner. Alcaraz, más escueto: "Estoy listo."`,
    sport: 'Tenis',
    category: 'Roland Garros',
    tags: ['Tenis', 'Roland Garros', 'Alcaraz', 'Sinner'],
    source_name: 'TakaSports Redacción',
    publishedAt: hoursAgo(12),
  },
  {
    _type: 'article',
    title: 'Islam Makhachev retiene el cinturón peso ligero de la UFC con un TKO en el tercer round',
    subtitle: 'El campeón daguestaní superó al retador Charles Oliveira en una pelea de altísimo nivel técnico en el UFC 302.',
    short_summary: 'Islam Makhachev defendió con éxito su título peso ligero de la UFC ante Charles Oliveira en el UFC 302. El daguestaní dominó el grappling y finalizó la pelea en el tercer asalto con un TKO que consolidó su reinado en la categoría.',
    body: `Había expectación máxima en el T-Mobile Arena de Las Vegas para este UFC 302, y la pelea estelar no defraudó. Islam Makhachev y Charles Oliveira protagonizaron un combate de enorme calidad técnica, con momentos de alta tensión en los que el cetro pudo cambiar de manos, pero el campeón fue superior en los momentos clave.

Los dos primeros rounds fueron igualados. Oliveira, el mejor finalizador de la historia de la UFC, estuvo cerca de terminar la pelea en el primer asalto con una estrangulación trasera que Makhachev logró escapar con una defensa excepcional. El campeón respondió con takedowns y control en el suelo que le dieron la segunda vuelta.

El tercer round fue diferente. Makhachev salió más agresivo, conectó una combinación a media altura que tambaleo a Oliveira y aprovechó el momento para llevarle al suelo y finalizar con golpes de suelo. El árbitro detuvo la pelea en el minuto 3:47.

"Charles es un campeón. Ha sido la pelea más dura de mi carrera", reconoció Makhachev en el octágono. "Pero soy el campeón y voy a seguir siéndolo."

El siguiente desafío para el daguestaní podría ser Arman Tsarukyan, quien esta misma noche ganó su pelea coestelar.`,
    sport: 'UFC',
    category: 'UFC',
    tags: ['UFC', 'MMA', 'Makhachev', 'Oliveira', 'UFC 302'],
    source_name: 'TakaSports Redacción',
    publishedAt: hoursAgo(18),
  },
  {
    _type: 'article',
    title: 'Argentina convoca a Lautaro Martínez y De Paul para la doble fecha de Eliminatorias de junio',
    subtitle: 'Scaloni incluyó también a tres jóvenes del mercado local en la lista de 26 jugadores para enfrentar a Chile y Colombia.',
    short_summary: 'La selección argentina publicó la lista de convocados para la doble fecha de Eliminatorias de junio. Lionel Scaloni mantiene el bloque campeón del mundo con la vuelta de Lautaro Martínez tras lesión y sumó tres novedades jóvenes del fútbol argentino.',
    body: `Lionel Scaloni dio a conocer esta mañana la nómina de 26 jugadores que defenderán a la Selección Argentina en la doble fecha de Eliminatorias Sudamericanas de junio. La Albiceleste visitará a Chile el 10 de junio y recibirá a Colombia el 14 en el Monumental de Núñez.

La principal noticia es el regreso de Lautaro Martínez, máximo goleador de la Copa del Mundo de Qatar y punta titular del Inter de Milán, que se perdió los últimos dos partidos de clasificación por una lesión muscular. El "Toro" llega en plena forma: lleva 23 goles en la Serie A esta temporada.

Rodrigo De Paul también está de regreso después de cumplir sanción. El mediocampista del Atlético de Madrid es clave en el esquema de Scaloni y su presencia devuelve equilibrio al centro del campo.

Las tres novedades son el delantero Valentino Castillo (River Plate), el lateral izquierdo Agustín Ruberto (Boca Juniors) y el mediocampista Tomás Orjales (Independiente). Los tres vienen de una excelente segunda parte de temporada en la Liga Profesional.

La Argentina lidera las Eliminatorias con 31 puntos, ocho más que el segundo clasificado, Ecuador.`,
    sport: 'Fútbol',
    category: 'Selección',
    tags: ['Argentina', 'Eliminatorias', 'Scaloni', 'Lautaro', 'De Paul'],
    source_name: 'TakaSports Redacción',
    publishedAt: hoursAgo(24),
  },
]

// ── Crear documentos via Mutations API ───────────────────────
async function seedArticles() {
  const mutations = ARTICLES.map((article) => ({
    create: {
      ...article,
      _id: `seed-article-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    },
  }))

  const url = `https://${PROJECT_ID}.api.sanity.io/v2024-01-01/data/mutate/${DATASET}`

  console.log(`\n🌱 Creando ${ARTICLES.length} artículos en Sanity...`)
  console.log(`   Proyecto: ${PROJECT_ID}  ·  Dataset: ${DATASET}\n`)

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ mutations }),
  })

  const data = await res.json()

  if (!res.ok) {
    console.error('❌  Error de la API de Sanity:')
    console.error(JSON.stringify(data, null, 2))
    process.exit(1)
  }

  const created = data.results?.filter((r) => r.operation === 'create') ?? []
  console.log(`✅  ${created.length} artículos creados correctamente.\n`)

  for (const r of data.results ?? []) {
    const match = ARTICLES[data.results.indexOf(r)]
    console.log(`   · [${match?.sport ?? '?'}] ${match?.title?.slice(0, 60)}...`)
  }

  console.log('\n🔄  El feed se actualizará en ~60 segundos (revalidate = 60).')
  console.log('   Si estás en dev, recarga la página en http://localhost:3000\n')
}

seedArticles().catch((err) => {
  console.error('❌  Error inesperado:', err)
  process.exit(1)
})
