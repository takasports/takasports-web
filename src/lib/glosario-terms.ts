/**
 * Glosario deportivo — entradas evergreen para captar tráfico de búsquedas
 * informacionales ("qué es el VAR", "qué es el offside", etc).
 *
 * Diseño: cada entrada es un objeto plano con slug estable, término, sport,
 * resumen corto (para snippet) y cuerpo en párrafos. El cuerpo soporta
 * subtítulos con **doble asterisco** (mismo formato que renderBodyBlock).
 */

export type GlosarioSport =
  | 'futbol' | 'baloncesto' | 'f1' | 'tenis' | 'ufc' | 'general'

export interface GlosarioTerm {
  slug: string
  term: string
  sport: GlosarioSport
  /** Resumen 1-2 frases para metadata + featured snippet. */
  summary: string
  /** Cuerpo en párrafos. Líneas que empiezan y acaban en ** son H2. */
  body: string[]
  /** Slugs de términos relacionados (interlinking). */
  related?: string[]
  updatedAt: string
}

export const GLOSARIO_TERMS: GlosarioTerm[] = [
  {
    slug: 'que-es-el-var',
    term: 'VAR (Video Assistant Referee)',
    sport: 'futbol',
    summary:
      'El VAR es el sistema de videoarbitraje del fútbol que asiste al árbitro principal mediante revisión por vídeo en cuatro situaciones concretas: goles, penaltis, expulsiones e identidad equivocada.',
    body: [
      'El VAR (Video Assistant Referee, asistente de árbitro por vídeo) es un sistema de arbitraje asistido por tecnología que se introdujo oficialmente en el fútbol profesional a partir de la temporada 2017-2018. Su función es ayudar al árbitro principal a corregir errores claros y manifiestos en cuatro situaciones específicas, sin sustituir su autoridad sobre el campo.',
      '**Cuándo interviene el VAR**',
      'El protocolo de la IFAB establece que el VAR solo puede intervenir en cuatro escenarios: goles (para verificar fueras de juego, faltas previas o si el balón salió del campo), penaltis (concesión o anulación), expulsiones por tarjeta roja directa (no segundas amarillas) e identidad equivocada (cuando el árbitro sanciona al jugador incorrecto).',
      '**Cómo funciona el proceso de revisión**',
      'El equipo del VAR está formado por un árbitro principal de vídeo y al menos un asistente, que trabajan desde una sala de operaciones con acceso a todas las cámaras del partido. Cuando detectan un posible error claro, recomiendan al árbitro principal que revise la jugada en el monitor de campo (On-Field Review) o, en casos puntuales (fuera de juego objetivo), le indican directamente la decisión final.',
      '**Polémicas y críticas habituales**',
      'Aunque el VAR ha reducido errores arbitrales clave, sigue siendo polémico por varios motivos: la subjetividad en algunas manos, la lentitud de algunas revisiones (que cortan el ritmo del partido) y la interpretación del umbral de "error claro y manifiesto". En 2025-2026, la IFAB sigue ajustando el protocolo para hacerlo más ágil y transparente.',
    ],
    related: ['que-es-el-offside', 'que-es-una-mano-en-area'],
    updatedAt: '2026-05-28',
  },
  {
    slug: 'que-es-el-offside',
    term: 'Fuera de juego (offside)',
    sport: 'futbol',
    summary:
      'El fuera de juego sanciona al atacante que recibe el balón estando más cerca de la línea de gol que el balón y el penúltimo defensor en el momento del pase de un compañero.',
    body: [
      'El fuera de juego (offside en inglés) es una de las normas más antiguas y debatidas del fútbol. Está recogido en la Regla 11 del Reglamento de la IFAB y su objetivo es evitar que un atacante se beneficie de quedarse esperando un pase por detrás de la defensa rival.',
      '**La regla, paso a paso**',
      'Un jugador está en posición de fuera de juego si, en el momento exacto en que un compañero le pasa el balón, se encuentra: (1) en el campo rival, (2) más cerca de la línea de gol que el balón, y (3) más cerca de la línea de gol que el penúltimo rival (que suele ser el último defensor, no contando al portero).',
      'Estar en posición de fuera de juego no es por sí solo una infracción: solo se sanciona cuando el jugador interviene en la jugada — toca el balón, interfiere a un rival o saca ventaja de su posición.',
      '**Excepciones importantes**',
      'No hay fuera de juego en saque de meta, saque de banda ni saque de esquina. Tampoco si el balón llega al atacante tras un toque deliberado del rival (no un rebote o despeje involuntario).',
      '**Tecnología actual**',
      'Desde 2022, competiciones como la Champions League y LaLiga utilizan el fuera de juego semiautomático (SAOT, Semi-Automated Offside Technology), que combina cámaras de seguimiento corporal y un balón con chip para determinar la posición con precisión milimétrica.',
    ],
    related: ['que-es-el-var'],
    updatedAt: '2026-05-28',
  },
  {
    slug: 'que-es-una-mano-en-area',
    term: 'Mano en el área',
    sport: 'futbol',
    summary:
      'La mano en el área se sanciona con penalti cuando el jugador toca el balón con la mano o el brazo de forma punible: voluntariamente, en posición antinatural, o cuando se hace el cuerpo más grande.',
    body: [
      'La interpretación de las manos es una de las áreas más cambiantes del reglamento. La regla actual (modificada por última vez por la IFAB en 2021 y matizada en temporadas posteriores) distingue entre manos sancionables y no sancionables en función de la intención, la posición del brazo y el contexto de la jugada.',
      '**Cuándo es penalti**',
      'Se considera infracción si el jugador (1) toca el balón con la mano o el brazo de forma deliberada, (2) hace el cuerpo más grande de forma antinatural, o (3) marca un gol con la mano o el brazo, incluso si es accidental.',
      '**Cuándo NO es penalti**',
      'No se sanciona si el balón rebota en el propio cuerpo del jugador hacia su mano, si la mano está pegada al cuerpo o en una posición que se considere natural para el movimiento, o si el balón le viene desde muy corta distancia sin tiempo de reacción.',
      '**El papel del VAR**',
      'El VAR revisa las manos en jugadas que terminan en gol o que pueden ser penalti, pero el criterio final sigue siendo del árbitro principal: la subjetividad sobre qué es "posición natural" hace que las manos sigan siendo la jugada más polémica del fútbol moderno.',
    ],
    related: ['que-es-el-var'],
    updatedAt: '2026-05-28',
  },
  {
    slug: 'que-es-el-financial-fair-play',
    term: 'Financial Fair Play (FFP)',
    sport: 'futbol',
    summary:
      'El Financial Fair Play es el reglamento económico de la UEFA que obliga a los clubes a no gastar más de lo que ingresan, evitando endeudamientos insostenibles y desequilibrios competitivos.',
    body: [
      'El Financial Fair Play (FFP, "juego limpio financiero") es el conjunto de normas económicas que la UEFA estableció en 2010 para asegurar la sostenibilidad financiera del fútbol europeo. Desde 2022 se reformuló bajo el nombre de Financial Sustainability Regulations (FSR), aunque la mayoría de aficionados y medios siguen llamándolo FFP.',
      '**El principio básico: gastar lo que ingresas**',
      'La regla central exige que los clubes no gasten en plantilla y traspasos más de lo que generan por ingresos ordinarios (entradas, derechos de TV, patrocinios, traspasos). Se permite un margen de pérdidas tolerado en ciclos de tres años, pero excederlo conlleva sanciones.',
      '**Squad cost ratio**',
      'La regulación de 2022 introdujo un límite sobre el porcentaje de ingresos que un club puede destinar a salarios, traspasos y comisiones a agentes. Inicialmente del 90%, este límite baja gradualmente hasta el 70% en 2025-2026.',
      '**Sanciones**',
      'Las sanciones van desde multas económicas y limitaciones en el número de jugadores inscribibles en competiciones europeas hasta la exclusión directa de Champions League o Europa League en casos graves, como ha ocurrido con varios clubes desde la entrada en vigor.',
    ],
    updatedAt: '2026-05-28',
  },
  {
    slug: 'que-es-el-drs-f1',
    term: 'DRS en Fórmula 1',
    sport: 'f1',
    summary:
      'El DRS (Drag Reduction System) es un sistema de la F1 que abre el alerón trasero para reducir la resistencia aerodinámica y facilitar los adelantamientos en zonas específicas del circuito.',
    body: [
      'El DRS (Drag Reduction System, sistema de reducción de resistencia) es uno de los elementos técnicos más característicos de la F1 moderna. Se introdujo en 2011 para combatir la falta de adelantamientos que sufría la categoría.',
      '**Cómo funciona**',
      'El DRS abre una pequeña sección móvil del alerón trasero. Al hacerlo, reduce la resistencia aerodinámica (drag) y permite alcanzar velocidades punta entre 10 y 20 km/h superiores, lo que facilita rebasar al coche de delante.',
      '**Cuándo se puede usar**',
      'Solo se activa en zonas designadas por la FIA — los DRS zones, marcados en la pista — y bajo una condición clara: el piloto perseguidor debe estar a menos de un segundo del coche que tiene delante en el punto de detección, que está justo antes de la zona DRS. En carrera, además, el DRS no se activa hasta haber completado dos vueltas tras la salida, una bandera roja o un coche de seguridad.',
      '**Críticas**',
      'El DRS es polémico porque algunos consideran que "facilita demasiado" los adelantamientos, restándoles mérito. Otros, en cambio, lo defienden como un mal menor frente a una F1 sin adelantamientos como la de finales de los 2000.',
    ],
    updatedAt: '2026-05-28',
  },
  {
    slug: 'que-es-el-pick-and-roll',
    term: 'Pick and roll',
    sport: 'baloncesto',
    summary:
      'El pick and roll es la jugada ofensiva más utilizada del baloncesto moderno: un jugador con balón aprovecha un bloqueo de un compañero para liberarse y, mientras, el bloqueador rueda hacia canasta.',
    body: [
      'El pick and roll (en español, "bloqueo y continuación") es la jugada ofensiva más utilizada en el baloncesto contemporáneo, tanto en la NBA como en la EuroLiga. Es una acción de dos jugadores que combina bloqueo, lectura defensiva y movimiento sincronizado.',
      '**La mecánica**',
      'Un jugador con balón (habitualmente el base) ataca a su defensor mientras un compañero, normalmente un interior, se coloca cerca para "ponerle un bloqueo" (pick). El defensor del bloqueador puede elegir cómo defender: pasarse por encima, por debajo, hacer switch o doblar al balón. En función de esa decisión, el atacante puede tirar, penetrar o pasar al bloqueador, que rueda (roll) hacia canasta tras el bloqueo.',
      '**Variantes**',
      'Las variantes más conocidas son el pick and pop (el bloqueador, en vez de rodar, sale a la línea de tres para recibir y tirar) y el spread pick and roll (la jugada se ejecuta con los otros tres jugadores muy abiertos en el perímetro, para abrir el carril central).',
      '**Por qué es tan dominante**',
      'El pick and roll obliga a la defensa a tomar decisiones rápidas y crea desajustes (mismatches) que el ataque puede explotar de muchas formas. Equipos como los Golden State Warriors o los Denver Nuggets han construido prácticamente todo su ataque en torno a esta acción.',
    ],
    updatedAt: '2026-05-28',
  },
  {
    slug: 'que-es-el-tie-break',
    term: 'Tie-break (tenis)',
    sport: 'tenis',
    summary:
      'El tie-break es el desempate que se juega en el tenis cuando un set llega a 6-6 en juegos. Lo gana el jugador que alcanza primero 7 puntos con dos de diferencia.',
    body: [
      'El tie-break (literalmente "rompe-empates") es el sistema de desempate más utilizado en el tenis para evitar sets infinitos. Se inventó en 1965 y se popularizó en el circuito profesional a lo largo de los 70.',
      '**Reglas básicas**',
      'Cuando un set llega a 6-6 en juegos, se disputa un tie-break. Lo gana el primer jugador en sumar 7 puntos con al menos dos puntos de diferencia. Si llegan empatados a 6-6 en puntos del tie-break, se sigue jugando hasta que alguien saque dos puntos de ventaja (por ejemplo 9-7, 11-9).',
      '**Quién saca**',
      'Saca primero el jugador al que le tocaba ese turno en el set. Tras el primer punto, saca el rival dos veces consecutivas. A partir de ahí se alternan los saques cada dos puntos. Los jugadores cambian de lado de la pista cada seis puntos.',
      '**Variantes**',
      'En el Grand Slam, desde 2022 se aplica el tie-break a 10 puntos en el set decisivo (5º en hombres, 3º en mujeres). El Match Tie-Break (a 10 puntos) se usa además en dobles para sustituir el tercer set en muchos torneos del circuito.',
    ],
    updatedAt: '2026-05-28',
  },
  {
    slug: 'que-es-un-grand-slam',
    term: 'Grand Slam (tenis)',
    sport: 'tenis',
    summary:
      'Los Grand Slam son los cuatro torneos más importantes del tenis: Open de Australia, Roland Garros, Wimbledon y US Open. Ganar los cuatro en una misma temporada se considera "Grand Slam de calendario".',
    body: [
      'El término Grand Slam designa los cuatro torneos más prestigiosos del calendario tenístico: el Open de Australia (enero, pista dura), Roland Garros (mayo-junio, tierra batida), Wimbledon (junio-julio, hierba) y el US Open (agosto-septiembre, pista dura).',
      '**Por qué son los más importantes**',
      'Reparten los premios económicos más altos del circuito, otorgan 2.000 puntos ATP/WTA al campeón (el doble que los Masters 1000), tienen el cuadro más amplio (128 jugadores en individuales) y se juegan al mejor de cinco sets en hombres, lo que tradicionalmente se considera el formato más exigente.',
      '**Grand Slam de calendario vs. Carrera al Grand Slam**',
      'El Grand Slam de calendario consiste en ganar los cuatro torneos en una misma temporada — una hazaña conseguida solo por dos hombres (Don Budge en 1938 y Rod Laver en 1962 y 1969) y tres mujeres (Maureen Connolly, Margaret Court y Steffi Graf). El Career Grand Slam, en cambio, se logra al ganar los cuatro a lo largo de la carrera (no necesariamente seguidos), algo que sí han conseguido Federer, Nadal, Djokovic, Serena Williams y otros pocos.',
    ],
    updatedAt: '2026-05-28',
  },
  {
    slug: 'que-es-un-hat-trick',
    term: 'Hat-trick',
    sport: 'futbol',
    summary:
      'Un hat-trick es la hazaña de marcar tres goles en un mismo partido. En el sentido más estricto, los tres goles deben ser consecutivos y sin que ningún compañero marque entre medias.',
    body: [
      'El hat-trick (literalmente "truco del sombrero") es uno de los logros individuales más celebrados del fútbol. Aunque el término se popularizó en el fútbol, su origen está en el críquet del siglo XIX: cuando un lanzador eliminaba a tres bateadores con tres lanzamientos seguidos, el club le regalaba un sombrero.',
      '**Tipos de hat-trick**',
      'En su versión clásica, un hat-trick "limpio" o "perfecto" requiere que los tres goles sean consecutivos (sin que nadie más marque entre medias) y que los tres se hagan con partes distintas del cuerpo (pierna derecha, pierna izquierda y cabeza). En la práctica, los medios suelen contar como hat-trick cualquier tres goles del mismo jugador en un partido.',
      '**Hat-tricks históricos**',
      'Cristiano Ronaldo y Lionel Messi acumulan, cada uno, más de 50 hat-tricks oficiales en su carrera, una cifra inalcanzable para casi cualquier otro futbolista. En selecciones, el español David Villa, el alemán Miroslav Klose y el francés Kylian Mbappé figuran entre los nombres más recordados por sus tripletas en grandes torneos.',
    ],
    updatedAt: '2026-05-28',
  },
  {
    slug: 'que-es-el-fair-play-financiero-laliga',
    term: 'Límite salarial de LaLiga',
    sport: 'futbol',
    summary:
      'El límite salarial de LaLiga es el tope económico que cada club puede destinar a salarios, fichajes y amortizaciones. Se calcula a partir de los ingresos del club y limita su capacidad de gasto.',
    body: [
      'El límite salarial de LaLiga (oficialmente, "límite de coste de plantilla deportiva") es el mecanismo de control económico que la patronal del fútbol español aplica a todos sus clubes desde 2013. Su objetivo es evitar endeudamientos como los de la primera década del siglo XXI y garantizar la sostenibilidad financiera del fútbol profesional.',
      '**Cómo se calcula**',
      'Cada temporada, LaLiga fija para cada club un tope que cubre salarios, primas, comisiones a agentes, amortizaciones de traspasos y otros costes deportivos. El cálculo parte de los ingresos previstos del club (TV, taquilla, patrocinios) menos los costes no deportivos.',
      '**Inscripción de jugadores**',
      'Para inscribir a un nuevo jugador, la masa salarial total del club tras la incorporación no puede superar su límite. Si lo supera, el club debe rebajar salarios, vender jugadores o aplicar la regla del 1:1 (introducir un euro por cada euro de ahorro). Casos como el de Barcelona en los veranos de 2021-2023 ilustran la dureza de esta norma.',
    ],
    updatedAt: '2026-05-28',
  },
]

export function getGlosarioTerm(slug: string): GlosarioTerm | null {
  return GLOSARIO_TERMS.find(t => t.slug === slug) ?? null
}

export function getRelatedTerms(slug: string, limit = 3): GlosarioTerm[] {
  const term = getGlosarioTerm(slug)
  if (!term) return []
  const related = (term.related ?? [])
    .map(s => getGlosarioTerm(s))
    .filter((t): t is GlosarioTerm => Boolean(t))
  if (related.length >= limit) return related.slice(0, limit)
  // Completar con términos del mismo deporte (excluyendo el propio).
  const fillers = GLOSARIO_TERMS
    .filter(t => t.sport === term.sport && t.slug !== slug && !related.includes(t))
    .slice(0, limit - related.length)
  return [...related, ...fillers]
}
