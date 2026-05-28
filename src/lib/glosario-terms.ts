/**
 * Glosario deportivo — entradas evergreen para captar tráfico de búsquedas
 * informacionales ("qué es el VAR", "qué es el pressing", "qué es un KO", etc).
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
  // ─── FÚTBOL ──────────────────────────────────────────────────────────────────
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
      'Aunque el VAR ha reducido errores arbitrales clave, sigue siendo polémico por varios motivos: la subjetividad en algunas manos, la lentitud de algunas revisiones y la interpretación del umbral de "error claro y manifiesto". En 2025-2026, la IFAB sigue ajustando el protocolo para hacerlo más ágil y transparente.',
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
      'Desde 2022, competiciones como la Champions League y LaLiga utilizan el fuera de juego semiautomático (SAOT), que combina cámaras de seguimiento corporal y un balón con chip para determinar la posición con precisión milimétrica.',
    ],
    related: ['que-es-el-var', 'que-es-el-pressing'],
    updatedAt: '2026-05-28',
  },
  {
    slug: 'que-es-una-mano-en-area',
    term: 'Mano en el área',
    sport: 'futbol',
    summary:
      'La mano en el área se sanciona con penalti cuando el jugador toca el balón con la mano o el brazo de forma punible: voluntariamente, en posición antinatural, o cuando se hace el cuerpo más grande.',
    body: [
      'La interpretación de las manos es una de las áreas más cambiantes del reglamento. La regla actual (modificada por la IFAB en 2021 y matizada en temporadas posteriores) distingue entre manos sancionables y no sancionables en función de la intención, la posición del brazo y el contexto de la jugada.',
      '**Cuándo es penalti**',
      'Se considera infracción si el jugador (1) toca el balón con la mano o el brazo de forma deliberada, (2) hace el cuerpo más grande de forma antinatural, o (3) marca un gol con la mano o el brazo, incluso si es accidental.',
      '**Cuándo NO es penalti**',
      'No se sanciona si el balón rebota en el propio cuerpo del jugador hacia su mano, si la mano está pegada al cuerpo o en una posición natural para el movimiento, o si el balón le viene desde muy corta distancia sin tiempo de reacción.',
      '**El papel del VAR**',
      'El VAR revisa las manos en jugadas que terminan en gol o que pueden ser penalti, pero el criterio final sigue siendo del árbitro principal: la subjetividad sobre qué es "posición natural" hace que las manos sigan siendo la jugada más polémica del fútbol moderno.',
    ],
    related: ['que-es-el-var', 'que-es-el-offside'],
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
      'Las sanciones van desde multas económicas y limitaciones en el número de jugadores inscribibles en competiciones europeas hasta la exclusión directa de Champions League o Europa League en casos graves.',
    ],
    related: ['que-es-el-fair-play-financiero-laliga'],
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
      'Cristiano Ronaldo y Lionel Messi acumulan, cada uno, más de 50 hat-tricks oficiales en su carrera. En selecciones, el español David Villa, el alemán Miroslav Klose y el francés Kylian Mbappé figuran entre los nombres más recordados por sus tripletas en grandes torneos.',
    ],
    related: ['que-es-un-pichichi', 'que-es-el-pressing'],
    updatedAt: '2026-05-28',
  },
  {
    slug: 'que-es-el-fair-play-financiero-laliga',
    term: 'Límite salarial de LaLiga',
    sport: 'futbol',
    summary:
      'El límite salarial de LaLiga es el tope económico que cada club puede destinar a salarios, fichajes y amortizaciones. Se calcula a partir de los ingresos del club y limita su capacidad de gasto.',
    body: [
      'El límite salarial de LaLiga (oficialmente, "límite de coste de plantilla deportiva") es el mecanismo de control económico que la patronal del fútbol español aplica a todos sus clubes desde 2013. Su objetivo es evitar endeudamientos como los de la primera década del siglo XXI.',
      '**Cómo se calcula**',
      'Cada temporada, LaLiga fija para cada club un tope que cubre salarios, primas, comisiones a agentes, amortizaciones de traspasos y otros costes deportivos. El cálculo parte de los ingresos previstos del club (TV, taquilla, patrocinios) menos los costes no deportivos.',
      '**Inscripción de jugadores**',
      'Para inscribir a un nuevo jugador, la masa salarial total del club tras la incorporación no puede superar su límite. Si lo supera, el club debe rebajar salarios, vender jugadores o aplicar la regla del 1:1 (introducir un euro por cada euro de ahorro). Casos como el del Barcelona en los veranos de 2021-2023 ilustran la dureza de esta norma.',
    ],
    related: ['que-es-el-financial-fair-play'],
    updatedAt: '2026-05-28',
  },
  {
    slug: 'que-es-el-pressing',
    term: 'Pressing',
    sport: 'futbol',
    summary:
      'El pressing es una estrategia defensiva colectiva en la que el equipo presiona al rival de forma coordinada en cuanto pierde el balón para recuperarlo lo antes posible y en la zona más alta posible del campo.',
    body: [
      'El pressing es hoy una de las piedras angulares del fútbol moderno. Lejos de ser simplemente "correr mucho", el pressing bien ejecutado requiere una organización colectiva precisa, líneas de cobertura y un timing individual afinado.',
      '**Alta presión vs. bloque bajo**',
      'El pressing "alto" o gegenpressing (contrapresión inmediata) busca recuperar el balón en campo rival en los primeros segundos tras perderlo, antes de que el rival se reorganice. El "bloque bajo" o defensa profunda es lo opuesto: ceder el balón y defender cerca de la propia portería. La mayoría de equipos alternan ambas estrategias según el partido.',
      '**Conceptos clave**',
      'La trampa del fuera de juego es un complemento habitual del pressing alto: la defensa sube la línea para dejar al atacante rival en offside en el momento del pase. El pressing también incluye el "trigger" (señal visual o táctica que activa la presión de todo el equipo al mismo tiempo).',
      '**Quién lo popularizó**',
      'Jürgen Klopp popularizó el término gegenpressing en Alemania con su Borussia Dortmund (2008-2015) y lo perfeccionó en el Liverpool. Pep Guardiola, Marcelo Bielsa y Diego Simeone representan otras filosofías de presión igualmente influyentes, aunque con matices distintos.',
    ],
    related: ['que-es-el-offside', 'que-es-el-falso-nueve'],
    updatedAt: '2026-05-28',
  },
  {
    slug: 'que-es-el-xg',
    term: 'xG (Expected Goals)',
    sport: 'futbol',
    summary:
      'El xG, o goles esperados, es una métrica estadística que mide la probabilidad de que un disparo acabe en gol según la posición, el ángulo, el tipo de remate y otras variables del contexto del tiro.',
    body: [
      'El xG (expected goals, "goles esperados") es la estadística avanzada más influyente del fútbol moderno. A diferencia de los goles reales, que son binarios (gol o no gol), el xG asigna a cada disparo un valor entre 0 y 1 que representa su probabilidad de acabar en gol basándose en datos históricos de miles de tiros similares.',
      '**Cómo se calcula**',
      'Los modelos de xG tienen en cuenta variables como la distancia a portería, el ángulo del disparo, si fue de cabeza o de pie, si el jugador estaba en carrera o parado, si precedió de un centro o un pase al hueco, y si había defensores bloqueando. Los modelos más sofisticados incluyen también la presión defensiva y el movimiento del portero.',
      '**Cómo se usa**',
      'Un equipo que acumula consistentemente más xG de los que genera el rival tiende a ganar partidos en el largo plazo, aunque en el corto plazo el azar y la actuación individual del portero pueden distorsionar los resultados. Un delantero con un desempeño muy superior a su xG puede estar en racha o ser genuinamente excepcional en la finalización.',
      '**Limitaciones**',
      'El xG no captura la calidad individual del finalizador (Messi siempre supera su xG), los tiros libres complejos ni jugadas absolutamente únicas. Es una herramienta de contexto, no un veredicto definitivo.',
    ],
    related: ['que-es-el-pressing', 'que-es-un-hat-trick'],
    updatedAt: '2026-05-28',
  },
  {
    slug: 'que-es-el-falso-nueve',
    term: 'Falso nueve',
    sport: 'futbol',
    summary:
      'El falso nueve es una posición táctica en la que el delantero centro tradicional es sustituido por un jugador que cae al centro del campo para crear superioridades, en lugar de quedarse pegado al área rival.',
    body: [
      'El falso nueve (o "nueve y medio") es una de las posiciones más revolucionarias del fútbol moderno. El nombre proviene del número dorsal 9, históricamente asociado al delantero centro puro. El "falso" alude a que no es un nueve clásico: en vez de esperar los balones en el área, baja al centro a conectar el juego.',
      '**Cómo desorganiza a la defensa rival**',
      'Cuando el falso nueve cae al mediocampo, arrastra con él al central que lo marcaba, abriendo espacio para que los mediapuntas o extremos penetren por detrás. Si el central no lo sigue, el falso nueve recibe libre y puede combinar o dirigir el juego. Es un dilema táctico constante para la defensa rival.',
      '**Los mejores falsos nueves de la historia**',
      'Lionel Messi en el Barcelona de Guardiola (2009-2012) es el referente absoluto. Antes que él, Ferenc Puskás y Nándor Hidegkuti en la selección húngara de los 50 ya usaban ese rol. Roberto Firmino en el Liverpool de Klopp fue otro ejemplo moderno de falso nueve colectivo más que goleador individual.',
      '**Ventajas e inconvenientes**',
      'Funciona especialmente bien con jugadores muy técnicos y con inteligencia de juego. El riesgo es que, si el equipo pierde el balón, puede haber carencias en la presencia en el área rival para aprovechar centros o remates.',
    ],
    related: ['que-es-el-pressing', 'que-es-el-xg'],
    updatedAt: '2026-05-28',
  },
  {
    slug: 'que-es-la-chilena',
    term: 'Chilena (bicicleta)',
    sport: 'futbol',
    summary:
      'La chilena o bicicleta es un remate acrobático en el que el jugador salta, realiza un movimiento de tijera con las piernas y golpea el balón con el pie por encima de su propia cabeza, quedando de espaldas al suelo.',
    body: [
      'La chilena, conocida también como bicicleta en muchos países hispanohablantes, es el gol más espectacular del fútbol. No tiene utilidad táctica garantizada, pero cuando se materializa es casi siempre el gol más comentado de la jornada.',
      '**Origen del nombre**',
      'El término "chilena" proviene de Chile, donde se atribuye a Ramon Unzaga Asla el primer registro documentado de ese remate a principios del siglo XX. La denominación "bicicleta" hace referencia al movimiento circular de las piernas que recuerda al pedaleo.',
      '**La técnica**',
      'Para ejecutarla correctamente, el jugador debe calcular con precisión el momento del salto, elevar la pierna contraria a la de remate para darse impulso y usar el balanceo del cuerpo para generar potencia. El error más común es golpear el balón demasiado pronto o demasiado tarde, perdiendo dirección y potencia.',
      '**Chilenas históricas**',
      'La chilena de Cristiano Ronaldo en la Champions League 2017-2018 ante la Juventus, o la de Wayne Rooney ante el Manchester City en 2011, son ejemplos recientes que dieron la vuelta al mundo. En España, el gol de Rabah Madjer al Oporto en 1987 es una de las más recordadas de la historia europea.',
    ],
    related: ['que-es-un-hat-trick', 'que-es-el-falso-nueve'],
    updatedAt: '2026-05-28',
  },
  {
    slug: 'que-es-la-panenka',
    term: 'Panenka',
    sport: 'futbol',
    summary:
      'La panenka es una forma de lanzar un penalti en la que el jugador golpea el balón con suavidad por el centro de la portería, contando con que el portero ya se ha lanzado a un lado.',
    body: [
      'La panenka es uno de los tiros de penalti más arriesgados y elegantes del fútbol. Su nombre proviene del jugador checo Antonín Panenka, quien la ejecutó por primera vez a nivel mundial en la final del Campeonato de Europa de 1976 entre Checoslovaquia y Alemania Occidental, convirtiendo el penalti decisivo.',
      '**Cómo funciona**',
      'El lanzador se aproxima con decisión, como si fuera a disparar con fuerza a un lado, y en el momento del contacto frena y golpea el balón con suavidad por el centro. El portero, que ya se ha comprometido a lanzarse hacia un lado, queda en el suelo mientras el balón entra con calma por el centro.',
      '**El riesgo**',
      'Si el portero no se mueve o se queda en el centro, la panenka resulta en una parada ridícula. Por eso requiere una lectura perfecta del portero y, sobre todo, una frialdad y confianza absolutas. Fallar una panenka es una de las mayores vergüenzas del fútbol.',
      '**Panenkas célebres**',
      'Zinedine Zidane en la final del Mundial de 2006, Andrea Pirlo ante Inglaterra en la Eurocopa 2012 y Leo Messi en varias ocasiones son los nombres más asociados al uso moderno de esta técnica en momentos de máxima presión.',
    ],
    related: ['que-es-el-var', 'que-es-la-chilena'],
    updatedAt: '2026-05-28',
  },
  {
    slug: 'que-es-el-doble-pivote',
    term: 'Doble pivote',
    sport: 'futbol',
    summary:
      'El doble pivote es una estructura táctica de mediocampo en la que dos centrocampistas defensivos ocupan la zona central justo delante de la defensa, protegiendo el bloque y distribuyendo el juego.',
    body: [
      'El doble pivote (o "doble seis") es una de las estructuras más usadas en el fútbol moderno. Su nombre describe la función de eje o pivot que estos dos jugadores ejercen en el centro del campo: reciben, distribuyen y cortan el juego rival.',
      '**Características de un buen pivote**',
      'El perfil ideal mezcla capacidad de corte y anticipación defensiva con la técnica suficiente para circular el balón bajo presión. Jugadores como Busquets, Casemiro, Kante o Kroos son referencias históricas en esta posición, aunque cada uno con un estilo diferente.',
      '**Ventajas del doble pivote**',
      'Frente al pivote simple (un solo mediocentro defensivo), el doble pivote cubre mejor el espacio entre líneas, protege mejor los flancos en transiciones y permite uno de los dos pivotar hacia arriba cuando el equipo tiene el balón. Es especialmente eficaz en sistemas de 4-2-3-1 o 4-2-2-2.',
      '**Inconvenientes**',
      'Usando dos mediocampistas defensivos se puede perder creatividad en la zona central y sobrecargar de trabajo a los extremos u otro mediocampista más avanzado. El equipo depende de que sus laterales o extremos generen amplitud para no ser predecible.',
    ],
    related: ['que-es-el-pressing', 'que-es-el-falso-nueve'],
    updatedAt: '2026-05-28',
  },
  {
    slug: 'que-es-un-pichichi',
    term: 'Pichichi',
    sport: 'futbol',
    summary:
      'El Pichichi es el trofeo que se entrega al máximo goleador de LaLiga española al final de cada temporada. Su nombre honra al delantero del Athletic Club Rafael Moreno "Pichichi", pionero del gol en el fútbol español.',
    body: [
      'El Trofeo Pichichi es uno de los reconocimientos individuales más deseados del fútbol español. Lo entrega el diario Marca desde la temporada 1952-1953 y lleva el apodo del delantero bilbaíno Rafael Moreno Aranzadi (1892-1922), conocido como "Pichichi" por su tamaño pequeño y su enorme instinto goleador.',
      '**Historia del premio**',
      'Antes de que Marca institucionalizara el trofeo, ya se reconocía extraoficialmente al máximo goleador de la Liga desde los años 20. El primer Pichichi oficial fue para Pahiño del Celta de Vigo en 1952-1953. Con el tiempo se convirtió en el galardón más codiciado de la competición doméstica española.',
      '**Récord de Pichichis**',
      'Lionel Messi es el máximo ganador del trofeo con 8 Pichichis en LaLiga (2009-10, 2011-12, 2012-13, 2016-17, 2017-18, 2018-19, 2019-20, 2021-22). Cristiano Ronaldo ganó el trofeo en tres ocasiones durante su etapa en el Real Madrid.',
    ],
    related: ['que-es-un-hat-trick', 'que-es-el-xg'],
    updatedAt: '2026-05-28',
  },
  {
    slug: 'que-es-porteria-a-cero',
    term: 'Portería a cero (clean sheet)',
    sport: 'futbol',
    summary:
      'Una portería a cero o clean sheet es cuando un portero o un equipo termina un partido sin encajar ningún gol. Es un dato clave para evaluar la fortaleza defensiva de un club o la actuación de un guardameta.',
    body: [
      'La portería a cero (clean sheet en inglés) es el equivalente del gol en cero para el portero y la defensa. Cuando un equipo termina un partido oficial sin que el rival marque ningún gol, tanto el portero como la defensa suman una "portería a cero" en sus estadísticas individuales.',
      '**Por qué es importante**',
      'Las porterías a cero son uno de los mejores indicadores de solidez defensiva. En LaLiga, la Premier League y otras grandes ligas, los equipos con más clean sheets suelen ser los que pelean por el título o por no descender, según su nivel. Es también uno de los criterios para los premios al mejor portero de la temporada (como el Trofeo Zamora en España).',
      '**Récords de porterías a cero**',
      'En la Premier League, el récord en una temporada de 38 jornadas lo tienen Chelsea con 25 porterías a cero en 2004-2005. En España, el Trofeo Zamora se entrega al portero con mejor promedio de goles encajados por partido.',
    ],
    related: ['que-es-el-pressing', 'que-es-el-var'],
    updatedAt: '2026-05-28',
  },

  // ─── FÓRMULA 1 ───────────────────────────────────────────────────────────────
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
      'Solo se activa en zonas designadas por la FIA — los DRS zones — y bajo una condición clara: el piloto perseguidor debe estar a menos de un segundo del coche que tiene delante en el punto de detección. En carrera, el DRS no se activa hasta haber completado dos vueltas tras la salida o un safety car.',
      '**Críticas**',
      'El DRS es polémico porque algunos consideran que "facilita demasiado" los adelantamientos, restándoles mérito. Otros lo defienden como un mal menor frente a una F1 sin adelantamientos.',
    ],
    related: ['que-es-el-safety-car-f1', 'que-es-el-pit-stop-f1'],
    updatedAt: '2026-05-28',
  },
  {
    slug: 'que-es-el-safety-car-f1',
    term: 'Safety car en Fórmula 1',
    sport: 'f1',
    summary:
      'El safety car o coche de seguridad es un vehículo oficial que entra en pista en la F1 cuando se producen condiciones de peligro, obligando a todos los pilotos a reducir la velocidad y mantener el orden de carrera.',
    body: [
      'El safety car (coche de seguridad en español) es una herramienta clave de seguridad en la Fórmula 1. Cuando la dirección de carrera considera que las condiciones en pista son peligrosas — por un accidente, debris, lluvia extrema u otras circunstancias — despliega el safety car para neutralizar la carrera.',
      '**Cómo funciona**',
      'El safety car sale del pit lane y toma la delantera del pelotón. Los pilotos deben mantener su posición detrás de él y no adelantarse entre sí. La velocidad se reduce drásticamente, lo que permite a los equipos de comisarios retirar coches accidentados o limpiar la pista de manera segura.',
      '**Safety car virtual (VSC)**',
      'El Safety Car Virtual (VSC) es una variante introducida en 2015 que obliga a los pilotos a reducir la velocidad a un delta mínimo sin que el coche de seguridad físico entre en pista. Es menos disruptivo y se usa en incidentes menores.',
      '**Impacto táctico**',
      'El safety car es un factor táctico enorme: los equipos aprovechan su despliegue para hacer paradas en boxes sin perder tiempo de vuelta, lo que puede cambiar por completo el resultado de una carrera. Gestionar bien un safety car puede suponer ganar o perder el podio.',
    ],
    related: ['que-es-el-drs-f1', 'que-es-el-pit-stop-f1', 'que-es-la-pole-position-f1'],
    updatedAt: '2026-05-28',
  },
  {
    slug: 'que-es-el-pit-stop-f1',
    term: 'Pit stop en Fórmula 1',
    sport: 'f1',
    summary:
      'Un pit stop es la parada en boxes durante una carrera de F1 en la que el equipo cambia los neumáticos del coche —y en ocasiones realiza ajustes— en el menor tiempo posible, normalmente entre 2 y 3 segundos.',
    body: [
      'El pit stop (parada en boxes) es uno de los momentos más intensos y determinantes de la Fórmula 1. Aunque dura apenas unos segundos, puede decidir el resultado de la carrera. Cada equipo cuenta con un equipo de más de 20 mecánicos entrenados específicamente para ejecutar el cambio de cuatro ruedas en el mínimo tiempo posible.',
      '**Récord de pit stop más rápido**',
      'Red Bull Racing ostenta el récord del pit stop más rápido de la historia de la F1: 1,82 segundos en el Gran Premio de Brasil de 2023. En los años 80, las paradas en boxes podían durar más de 10 segundos.',
      '**La estrategia de neumáticos**',
      'En una carrera moderna, la estrategia de cuándo parar y qué compuesto de neumático elegir (blando, medio, duro) es fundamental. Los equipos deben calcular la degradación de los neumáticos, el tráfico en pista y cómo afectará un safety car o un VSC a la ventana de parada óptima.',
      '**Undercut y overcut**',
      'El undercut consiste en parar antes que el rival para montar neumáticos frescos y atacar desde el pit. El overcut es la estrategia contraria: extender el stint para salir por delante cuando el rival se detenga. Ambas son las maniobras tácticas más comunes en la F1 moderna.',
    ],
    related: ['que-es-el-safety-car-f1', 'que-es-el-drs-f1'],
    updatedAt: '2026-05-28',
  },
  {
    slug: 'que-es-la-pole-position-f1',
    term: 'Pole position en Fórmula 1',
    sport: 'f1',
    summary:
      'La pole position es la primera posición de salida en la parrilla de una carrera de Fórmula 1, que se otorga al piloto que marca el tiempo más rápido en la sesión de clasificación (qualifying).',
    body: [
      'La pole position es la posición más codiciada antes de una carrera de F1. Salir desde la pole ofrece una ventaja clara: el piloto arranca en la parte limpia de la pista (sin el "sucio" de los demás coches), tiene la trayectoria ideal en la primera curva y no necesita adelantar a nadie de salida.',
      '**Cómo se decide**',
      'En el formato moderno de clasificación (introducido en 2006), la pole se decide a través de tres segmentos: Q1 (elimina a los cinco más lentos), Q2 (elimina a otros cinco) y Q3 (los diez restantes luchan por la pole en una sesión de 12 minutos). El piloto con la vuelta más rápida en Q3 se lleva la pole.',
      '**Récords de poles**',
      'Lewis Hamilton es el piloto con más poles en la historia de la F1, con 104. Le siguen Michael Schumacher con 68 y Ayrton Senna con 65. En la era moderna, Max Verstappen es el piloto dominante en la clasificación.',
      '**¿Garantiza ganar la carrera?**',
      'No siempre. En algunos circuitos, como Mónaco o Hungría, la pole es casi decisiva porque adelantar es muy difícil. En otros, la estrategia de neumáticos puede invertir el orden de salida a lo largo de la carrera.',
    ],
    related: ['que-es-el-pit-stop-f1', 'que-es-el-safety-car-f1', 'que-es-el-drs-f1'],
    updatedAt: '2026-05-28',
  },

  // ─── BALONCESTO ──────────────────────────────────────────────────────────────
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
      'Las variantes más conocidas son el pick and pop (el bloqueador sale a la línea de tres para recibir y tirar) y el spread pick and roll (los otros tres jugadores muy abiertos en el perímetro para abrir el carril central).',
      '**Por qué es tan dominante**',
      'El pick and roll obliga a la defensa a tomar decisiones rápidas y crea desajustes (mismatches) que el ataque puede explotar de muchas formas. Equipos como los Golden State Warriors o los Denver Nuggets han construido prácticamente todo su ataque en torno a esta acción.',
    ],
    related: ['que-es-el-triple-doble', 'que-es-la-defensa-en-zona'],
    updatedAt: '2026-05-28',
  },
  {
    slug: 'que-es-el-triple-doble',
    term: 'Triple-doble (baloncesto)',
    sport: 'baloncesto',
    summary:
      'Un triple-doble es cuando un jugador de baloncesto alcanza dos dígitos en tres categorías estadísticas distintas en el mismo partido: habitualmente puntos, rebotes y asistencias.',
    body: [
      'El triple-doble es uno de los logros estadísticos individuales más valorados del baloncesto. Alcanzar dos dígitos en tres categorías en el mismo partido demuestra una contribución global excepcional al equipo.',
      '**Qué categorías se cuentan**',
      'Las más frecuentes son puntos, rebotes y asistencias. Sin embargo, también se puede lograr con tapones o robos, aunque es mucho más raro. Un triple-doble con 10 puntos, 10 rebotes y 10 asistencias es el más habitual.',
      '**Los reyes del triple-doble**',
      'Russell Westbrook es el líder histórico en triple-dobles en la NBA, superando el récord de Oscar Robertson en 2021. LeBron James, Magic Johnson y Nikola Jokic también destacan por su capacidad de acumular estadísticas en múltiples categorías.',
      '**Controversia**',
      'El triple-doble se ha convertido en un objetivo personal para algunos jugadores, lo que ha generado debate sobre si en algunos casos se persigue más la estadística que el beneficio del equipo — especialmente en cuanto a rebotes "fáciles" o pérdidas de balón al buscar asistencias.',
    ],
    related: ['que-es-el-pick-and-roll', 'que-es-el-alley-oop'],
    updatedAt: '2026-05-28',
  },
  {
    slug: 'que-es-el-alley-oop',
    term: 'Alley-oop (baloncesto)',
    sport: 'baloncesto',
    summary:
      'El alley-oop es una jugada de baloncesto en la que un jugador lanza el balón cerca del aro y un compañero lo atrapa en el aire para machacar o depositar antes de que caiga al suelo.',
    body: [
      'El alley-oop es una de las jugadas más espectaculares del baloncesto. Combina la visión del pasador, el timing del receptor y el atletismo para rematar el balón mientras aún está en el aire.',
      '**Cómo se ejecuta**',
      'El pasador lanza el balón en parábola hacia el aro. El receptor, que se ha desmarcado o cortado hacia canasta, salta, captura el balón con una o dos manos en el aire y lo deposita (o machaca) antes de que sus pies toquen el suelo. Si hay un defensor de por medio, el timing es aún más difícil.',
      '**Historia**',
      'La jugada se popularizó en el baloncesto universitario norteamericano en los años 60 y 70. En la NBA moderna, dúos como Lob City (Chris Paul y DeAndre Jordan en los Clippers) o Steph Curry con Draymond Green han llevado el alley-oop a su máxima expresión estratégica.',
      '**¿Se puede anotar desde un tiro libre?**',
      'En la NBA, un alley-oop puede incluso anotarse en un saque de banda si el receptor entra antes de que el balón toque el suelo o el aro. Es una jugada de bang-bang timing que requiere entrenamiento y comunicación constante entre los dos implicados.',
    ],
    related: ['que-es-el-pick-and-roll', 'que-es-el-triple-doble'],
    updatedAt: '2026-05-28',
  },
  {
    slug: 'que-es-la-defensa-en-zona',
    term: 'Defensa en zona (baloncesto)',
    sport: 'baloncesto',
    summary:
      'La defensa en zona es una estrategia defensiva del baloncesto en la que cada jugador defiende una área del campo en vez de marcar a un oponente concreto, coordinándose para cubrir espacios y desajustar el ataque rival.',
    body: [
      'En el baloncesto, los equipos pueden elegir entre dos grandes filosofías defensivas: el hombre a hombre (cada defensor sigue a un atacante concreto) o la zona (cada defensor cubre una área del campo). La zona es especialmente popular en el baloncesto universitario, en la selección nacional y como alternativa táctica en la NBA.',
      '**Tipos de zona**',
      'La zona 2-3 (dos defensores arriba, tres abajo) es la más común. También se usa la 3-2 (más agresiva en el perímetro), la 1-3-1 (eficaz para presionar al base y cortar líneas de pase) y la 2-1-2. Cada una tiene sus fortalezas y debilidades.',
      '**Ventajas de la zona**',
      'Protege mejor el área pintada, cansa a los equipos que dependen de ataques individuales y puede desorientar a rivales acostumbrados al juego uno contra uno. También ayuda a equipos con defensores menos atléticos.',
      '**Cómo se ataca la zona**',
      'La mejor respuesta a la zona es el movimiento rápido de balón, los triples de esquina y atacar las costuras (los espacios entre dos defensores de zona). Los equipos con buenos tiradores exteriores tienen ventaja ante cualquier zona.',
    ],
    related: ['que-es-el-pick-and-roll', 'que-es-el-triple-doble'],
    updatedAt: '2026-05-28',
  },

  // ─── TENIS ───────────────────────────────────────────────────────────────────
  {
    slug: 'que-es-el-tie-break',
    term: 'Tie-break (tenis)',
    sport: 'tenis',
    summary:
      'El tie-break es el desempate que se juega en el tenis cuando un set llega a 6-6 en juegos. Lo gana el jugador que alcanza primero 7 puntos con dos de diferencia.',
    body: [
      'El tie-break (literalmente "rompe-empates") es el sistema de desempate más utilizado en el tenis para evitar sets infinitos. Se inventó en 1965 y se popularizó en el circuito profesional a lo largo de los 70.',
      '**Reglas básicas**',
      'Cuando un set llega a 6-6 en juegos, se disputa un tie-break. Lo gana el primer jugador en sumar 7 puntos con al menos dos puntos de diferencia. Si llegan empatados a 6-6 en puntos del tie-break, se sigue jugando hasta que alguien saque dos puntos de ventaja.',
      '**Quién saca**',
      'Saca primero el jugador al que le tocaba ese turno en el set. Tras el primer punto, saca el rival dos veces consecutivas. A partir de ahí se alternan los saques cada dos puntos. Los jugadores cambian de lado de la pista cada seis puntos.',
      '**Variantes**',
      'En el Grand Slam, desde 2022 se aplica el tie-break a 10 puntos en el set decisivo. El Match Tie-Break (a 10 puntos) se usa además en dobles para sustituir el tercer set en muchos torneos del circuito.',
    ],
    related: ['que-es-un-grand-slam', 'que-es-un-ace-tenis'],
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
      'Reparten los premios económicos más altos del circuito, otorgan 2.000 puntos ATP/WTA al campeón (el doble que los Masters 1000), tienen el cuadro más amplio (128 jugadores en individuales) y se juegan al mejor de cinco sets en hombres.',
      '**Grand Slam de calendario vs. Carrera al Grand Slam**',
      'El Grand Slam de calendario consiste en ganar los cuatro torneos en una misma temporada — una hazaña conseguida solo por Don Budge (1938) y Rod Laver (1962 y 1969) en hombres. El Career Grand Slam, en cambio, se logra al ganar los cuatro a lo largo de la carrera, algo que sí han conseguido Federer, Nadal, Djokovic o Serena Williams.',
    ],
    related: ['que-es-el-tie-break', 'que-es-un-ace-tenis', 'que-es-el-ranking-atp-wta'],
    updatedAt: '2026-05-28',
  },
  {
    slug: 'que-es-un-ace-tenis',
    term: 'Ace (tenis)',
    sport: 'tenis',
    summary:
      'Un ace es un saque directo en tenis que el rival no llega a tocar con la raqueta, otorgando al sacador el punto de forma inmediata. Es la forma más contundente de ganar un punto con el servicio.',
    body: [
      'El ace es el punto más limpio que puede conseguir un tenista con su saque: el rival simplemente no alcanza el balón. Requiere velocidad, precisión y, habitualmente, un buen "kick" o efecto para dirigir la bola a la esquina o al cuerpo del contrincante en el momento menos esperado.',
      '**Diferencia con el saque ganador**',
      'Un ace se diferencia de un "saque ganador" en que en el ace el receptor no llega ni a tocar la pelota, mientras que en el saque ganador la toca pero no puede devolverla en juego. En estadísticas, solo el ace cuenta separado.',
      '**Récords de aces**',
      'Ivo Karlovic y John Isner son los tenistas con más aces en la historia del circuito ATP. En WTA, Serena Williams y Karolína Plíšková lideran el ranking histórico. En cuanto a velocidades de servicio, el récord masculino lo tiene Sam Groth con 263,4 km/h.',
      '**Importancia táctica**',
      'Un jugador con mucho porcentaje de aces reduce la presión en su servicio, mantiene el marcador y cansa psicológicamente al rival. Un porcentaje alto de puntos ganados con el primer servicio suele correlacionar con una buena clasificación ATP/WTA.',
    ],
    related: ['que-es-el-tie-break', 'que-es-un-grand-slam', 'que-es-la-doble-falta-tenis'],
    updatedAt: '2026-05-28',
  },
  {
    slug: 'que-es-la-doble-falta-tenis',
    term: 'Doble falta (tenis)',
    sport: 'tenis',
    summary:
      'Una doble falta en tenis ocurre cuando el jugador falla tanto el primer como el segundo saque en el mismo punto, cediendo el punto directamente al rival sin que se haya jugado el peloteo.',
    body: [
      'La doble falta es uno de los errores no forzados más costosos del tenis: regalar un punto al rival sin que haya intercambio de golpes. Ocurre cuando el primer saque cae fuera (falta simple) y el segundo saque también es incorrecto.',
      '**Por qué se permiten dos saques**',
      'El reglamento da dos oportunidades al sacador para que el saque caiga en la caja de servicio diagonal. El primero suele tirarse con más potencia y riesgo; el segundo, con más prudencia y efecto para asegurar que entre. Si el segundo también falla, es doble falta.',
      '**El coste táctico**',
      'Encadenar dobles faltas en momentos clave (break point, tie-break, match point en contra) puede cambiar el rumbo de un partido. Los jugadores más nerviosos o que buscan demasiado el ace en momentos de presión son más propensos a cometer dobles faltas.',
      '**Estadísticas**',
      'El número de dobles faltas es una métrica de las estadísticas oficiales de la ATP y la WTA. Un porcentaje alto indica problemas con el servicio bajo presión, mientras que un porcentaje bajo refleja fiabilidad y consistencia.',
    ],
    related: ['que-es-un-ace-tenis', 'que-es-el-tie-break'],
    updatedAt: '2026-05-28',
  },
  {
    slug: 'que-es-el-ranking-atp-wta',
    term: 'Ranking ATP / WTA',
    sport: 'tenis',
    summary:
      'El ranking ATP (masculino) y WTA (femenino) es el sistema oficial de clasificación del tenis profesional. Se calcula sumando los puntos obtenidos en los torneos de los últimos 52 semanas.',
    body: [
      'El ranking ATP y WTA es la referencia universal para saber quién es el mejor tenista del mundo en un momento dado. Determina la entrada directa a los torneos, el orden de cabezas de serie y, en última instancia, el estatus de los jugadores en el circuito.',
      '**Cómo se calculan los puntos**',
      'Los puntos se acumulan según los resultados en torneos de distintas categorías. Un Grand Slam vale hasta 2.000 puntos al campeón; los Masters 1000 (ATP) o Premier Mandatory (WTA), hasta 1.000; un ATP 500, hasta 500, y así sucesivamente. Los puntos se defienden semana a semana: si el año anterior ganaste un torneo y este año pierdes en primera ronda, pierdes casi todos esos puntos.',
      '**Por qué es tan exigente**',
      'Defendir puntos es tan importante como ganarlos. Un jugador puede tener una gran racha y escalar posiciones, pero si el año anterior fue muy bueno deberá igualar esos resultados para no bajar en el ranking.',
      '**Número 1 del mundo**',
      'Ser número 1 del mundo en la ATP o la WTA requiere una consistencia extraordinaria durante todo el año. Roger Federer, Rafael Nadal y Novak Djokovic han acumulado más semanas en lo más alto del ranking ATP que cualquier otro jugador de la historia.',
    ],
    related: ['que-es-un-grand-slam', 'que-es-el-tie-break'],
    updatedAt: '2026-05-28',
  },

  {
    slug: 'que-es-el-trofeo-zamora',
    term: 'Trofeo Zamora',
    sport: 'futbol',
    summary:
      'El Trofeo Zamora es el premio que se entrega al portero con mejor promedio de goles encajados por partido en LaLiga al final de cada temporada, en honor a Ricardo Zamora, el mejor guardameta de la historia del fútbol español.',
    body: [
      'El Trofeo Zamora es uno de los galardones individuales más prestigiosos del fútbol español. Lo entrega el diario Marca desde la temporada 1958-1959 y rinde homenaje a Ricardo Zamora (1901-1978), considerado el mejor portero que ha dado España y uno de los más grandes de la historia del fútbol.',
      '**Cómo se decide**',
      'El portero ganador es el que tiene el menor promedio de goles encajados por partido al final de la temporada, siempre que haya jugado un mínimo de partidos (habitualmente el 60% de la temporada). Si dos porteros tienen el mismo promedio, se usa el número de partidos jugados como desempate.',
      '**Récord histórico**',
      'Víctor Valdés ganó el Zamora en seis ocasiones, la mayoría con el FC Barcelona entre 2005 y 2012. Iker Casillas lo ganó cuatro veces con el Real Madrid. En la era moderna, Jan Oblak (Atlético de Madrid) y Marc-André ter Stegen (FC Barcelona) han sido los dominadores del galardón.',
    ],
    related: ['que-es-un-pichichi', 'que-es-porteria-a-cero'],
    updatedAt: '2026-05-28',
  },
  {
    slug: 'que-es-el-balon-de-oro',
    term: 'Balón de Oro',
    sport: 'futbol',
    summary:
      'El Balón de Oro es el premio individual más prestigioso del fútbol, entregado cada año por la revista France Football al mejor jugador de la temporada según una votación de periodistas y capitanes de selecciones nacionales.',
    body: [
      'El Balón de Oro (Ballon d\'Or en francés) es el trofeo individual más icónico del mundo del fútbol. Lo entrega la revista France Football desde 1956, cuando el ganador fue el inglés Stanley Matthews. Desde 2010 hasta 2015 se fusionó con el FIFA Ballon d\'Or, pero en 2016 volvió a ser un premio independiente.',
      '**Cómo se vota**',
      'Vota una combinación de periodistas especializados de todo el mundo y, desde 2024, también capitanes y entrenadores de selecciones nacionales. Los criterios principales son el rendimiento individual, los títulos ganados con el club y la selección, y el impacto general en la temporada.',
      '**Récords**',
      'Lionel Messi es el ganador con más Balones de Oro en la historia, con 8 (2009-2012, 2015, 2019, 2021, 2023). Cristiano Ronaldo es el segundo con 5 (2008, 2013-2014, 2016-2017). Ningún otro jugador ha superado los tres galardones.',
    ],
    related: ['que-es-un-hat-trick', 'que-es-un-pichichi'],
    updatedAt: '2026-05-28',
  },
  {
    slug: 'que-es-un-corner',
    term: 'Saque de esquina (corner)',
    sport: 'futbol',
    summary:
      'El saque de esquina o corner se produce cuando el balón sale por la línea de fondo tras tocar a un defensor. El equipo atacante lanza el balón desde la esquina del campo más cercana.',
    body: [
      'El saque de esquina, conocido popularmente como corner (del inglés), es una de las jugadas a balón parado más frecuentes del fútbol. Se produce cuando el balón traspasa completamente la línea de fondo (la línea de gol) y el último jugador en tocarlo es un defensor.',
      '**Cómo se ejecuta**',
      'El jugador que lanza el corner coloca el balón dentro del cuadrante de esquina (un arco de un metro de radio marcado en cada esquina del campo) y lo golpea hacia el área. Los rivales deben estar a un mínimo de 9,15 metros del lanzador hasta que el balón entre en juego. Se puede marcar directamente de corner (se llama "gol de córner directo" o "olimpic goal"), aunque es muy infrecuente.',
      '**Importancia táctica**',
      'Los corners son una de las principales fuentes de gol en el fútbol moderno: se estima que entre el 10 y el 15% de los goles en las principales ligas europeas provienen de jugadas a balón parado, incluyendo corners. Los equipos con jugadores altos o buenos rematadores de cabeza sacan mayor partido de estas situaciones.',
    ],
    related: ['que-es-el-var', 'que-es-el-offside'],
    updatedAt: '2026-05-28',
  },
  {
    slug: 'que-es-un-tiro-libre',
    term: 'Tiro libre (falta)',
    sport: 'futbol',
    summary:
      'Un tiro libre es la sanción con la que se penaliza una falta en el fútbol: el equipo perjudicado lanza el balón desde el lugar donde se cometió la infracción, con los rivales situados a un mínimo de 9,15 metros.',
    body: [
      'El tiro libre (o "falta" en el lenguaje coloquial) es la forma más común de sancionar las infracciones en el fútbol. Existen dos tipos: el tiro libre directo (puede ir directamente a portería) y el tiro libre indirecto (el balón debe tocar a otro jugador antes de entrar en gol).',
      '**Tiro libre directo vs. indirecto**',
      'El tiro libre directo se concede por faltas físicas (patadas, empujones, cargas ilegales, manoseos). El indirecto se concede por infracciones técnicas como juego peligroso, obstaculizar al portero o el doble toque en saque de inicio. En la práctica, casi todos los tiros libres que se ven en televisión son directos.',
      '**La barrera**',
      'El equipo defensor puede formar una "barrera" de jugadores colocados a un mínimo de 9,15 metros del balón para bloquear el tiro. El número de jugadores en la barrera depende de la distancia y la zona; en tiros frontales cerca del área suelen ser entre tres y seis jugadores.',
      '**Especialistas históricos**',
      'Los mejores lanzadores de faltas de la historia incluyen a Ronaldinho, Roberto Carlos, Zidane, David Beckham y, en la era moderna, Lionel Messi y Cristiano Ronaldo. La parábola del disparo, el efecto y la velocidad son los tres factores decisivos para burlar la barrera y al portero.',
    ],
    related: ['que-es-la-panenka', 'que-es-el-var'],
    updatedAt: '2026-05-28',
  },
  {
    slug: 'que-es-una-tarjeta-roja',
    term: 'Tarjeta roja',
    sport: 'futbol',
    summary:
      'La tarjeta roja es la sanción más severa del fútbol: el árbitro la muestra cuando un jugador comete una infracción grave o acumula dos tarjetas amarillas, expulsándolo del partido sin posibilidad de ser sustituido.',
    body: [
      'La tarjeta roja representa la expulsión inmediata en el fútbol. Su uso se generalizó tras el Mundial de México 1970, donde el árbitro inglés Ken Aston ideó el sistema de tarjetas para que las decisiones disciplinarias fueran universalmente comprensibles más allá del idioma.',
      '**Cuándo se muestra**',
      'Un árbitro puede mostrar tarjeta roja directa por: entrada violenta con riesgo de lesión para el rival, agresión, escupir, evitar un gol claro con la mano (salvo el portero en su área), o insultos y gestos graves hacia árbitros o rivales. También se puede acumular con dos tarjetas amarillas en el mismo partido (la segunda amarilla implica automáticamente la roja).',
      '**Consecuencias**',
      'El jugador expulsado abandona el campo y su equipo queda con un jugador menos el resto del partido. Además, el jugador cumple una sanción de al menos un partido (que puede ampliarse según la gravedad), sin poder ser reemplazado por otro jugador en ese encuentro.',
      '**El VAR y las expulsiones**',
      'El VAR puede recomendar al árbitro revisar una jugada para emitir o retirar una tarjeta roja directa, pero no puede intervenir en las segundas amarillas ni en decisiones puramente disciplinarias (como insultos).',
    ],
    related: ['que-es-el-var', 'que-es-una-mano-en-area'],
    updatedAt: '2026-05-28',
  },
  {
    slug: 'que-es-un-penalti',
    term: 'Penalti (penal)',
    sport: 'futbol',
    summary:
      'El penalti es el máximo castigo del fútbol: un disparo a portería desde el punto de penalti (11 metros) frente al portero, concedido cuando se comete una infracción punible dentro del área.',
    body: [
      'El penalti (conocido también como "penal" en Latinoamérica) es la jugada más dramática del fútbol moderno. Se concede cuando un equipo comete una infracción sancionable con tiro libre directo dentro de su propia área de penalti, o cuando un defensor evita un gol seguro con la mano dentro del área.',
      '**El punto de penalti**',
      'El disparo se lanza desde el "punto de penalti", situado a 11 metros de la portería y marcado con un pequeño círculo en el centro del área grande. Solo el lanzador y el portero pueden estar dentro del área en el momento del disparo; el resto de jugadores espera fuera del área y del semicírculo.',
      '**Estadísticas de conversión**',
      'En el fútbol profesional, el porcentaje de penaltis convertidos ronda el 75-78%. Los porteros paran aproximadamente 1 de cada 5 penaltis. Los mejores especialistas en penaltis (Messi, Lewandowski, Jorginho) superan el 85% de conversión a lo largo de su carrera.',
      '**La tanda de penaltis**',
      'Cuando un partido de eliminatoria termina empate después de la prórroga, se resuelve con una tanda de penaltis: cada equipo lanza 5 penaltis alternativamente. Si persiste el empate, se pasa a la "muerte súbita" (cada equipo lanza uno a la vez hasta que uno falla y el otro convierte).',
    ],
    related: ['que-es-la-panenka', 'que-es-el-var', 'que-es-una-mano-en-area'],
    updatedAt: '2026-05-28',
  },
  // ─── UFC / MMA ────────────────────────────────────────────────────────────────
  {
    slug: 'que-es-un-ko-en-ufc',
    term: 'KO (Knockout) en UFC',
    sport: 'ufc',
    summary:
      'Un KO o knockout en UFC y MMA ocurre cuando un golpe deja al rival inconsciente o en un estado de incapacidad tal que el árbitro detiene el combate para proteger su integridad.',
    body: [
      'El KO (knockout, "golpe que tumba") es la forma de victoria más definitiva en el boxeo, el kickboxing y las artes marciales mixtas (MMA). En la UFC, el árbitro para el combate en el momento en que un golpe deja al rival incapaz de defenderse, haya o no pérdida de conciencia.',
      '**Diferencia entre KO y TKO**',
      'En un KO limpio el rival cae inconsciente. El TKO (Technical Knockout) ocurre cuando el árbitro detiene el combate porque el luchador está recibiendo golpes sin poder defenderse, aunque siga en pie o consciente. En la UFC, ambas victorias se registran como "KO/TKO" en las estadísticas oficiales.',
      '**El "ground and pound"**',
      'Muchos KO/TKO en la UFC se producen en el suelo, cuando un luchador derriba al rival y lo remata con golpes. Esta técnica, conocida como ground and pound, es tan devastadora como un KO de pie porque el árbitro para el combate si el rival no se defiende.',
      '**Importancia en el ranking**',
      'Un KO espectacular puede catapultar a un luchador en el ranking e incluso ganarle el "Performance of the Night", un bonus económico que la UFC otorga a las actuaciones más destacadas de cada evento.',
    ],
    related: ['que-es-un-tko-ufc', 'que-es-una-sumision-ufc'],
    updatedAt: '2026-05-28',
  },
  {
    slug: 'que-es-un-tko-ufc',
    term: 'TKO (Technical Knockout) en UFC',
    sport: 'ufc',
    summary:
      'Un TKO o Technical Knockout en UFC ocurre cuando el árbitro detiene el combate porque un luchador está recibiendo daño sin poder defenderse, aunque no haya perdido el conocimiento.',
    body: [
      'El TKO (Technical Knockout, "knockout técnico") es la forma más común de victoria por paro en la UFC. A diferencia del KO limpio, en el que el rival queda inconsciente, el TKO es una decisión del árbitro basada en la seguridad del luchador.',
      '**Cuándo para el árbitro**',
      'El árbitro detiene el combate por TKO cuando un luchador: (1) está recibiendo golpes en el suelo sin poder defenderse o cubrirse, (2) está de pie pero claramente incapaz de seguir combatiendo, o (3) el equipo del luchador lanza la toalla al octágono para rendirse.',
      '**TKO por cuts (heridas)**',
      'En algunos casos, el médico de ringside puede detener el combate por una herida que ponga en riesgo la salud del luchador. Esta detención también cuenta como TKO y se registra como "TKO (doctor stoppage)".',
      '**Controversia en los paros**',
      'Los TKOs son frecuentemente polémicos, ya que los aficionados a veces consideran que el árbitro para "demasiado rápido". Un árbitro que interviene tarde, en cambio, puede poner en riesgo la integridad de un luchador ya incapacitado.',
    ],
    related: ['que-es-un-ko-en-ufc', 'que-es-una-sumision-ufc'],
    updatedAt: '2026-05-28',
  },
  {
    slug: 'que-es-una-sumision-ufc',
    term: 'Sumisión (submission) en UFC',
    sport: 'ufc',
    summary:
      'Una sumisión en UFC ocurre cuando un luchador aplica una llave de articulación o un estrangulamiento que obliga al rival a rendirse dando tapping (golpeando el suelo o al rival) o verbalmente.',
    body: [
      'La sumisión (submission) es una de las tres formas principales de victoria en la UFC, junto al KO/TKO y la decisión de los jueces. Demuestra el dominio técnico en grappling y es el sello de los especialistas en jiu-jitsu brasileño, lucha libre o judo.',
      '**Cómo funciona el "tapping"**',
      'Cuando un luchador está atrapado en una llave dolorosa o peligrosa, puede rendirse golpeando repetidamente el suelo, la colchoneta o el cuerpo del rival con la mano (tap). También puede rendirse verbalmente. El árbitro detiene inmediatamente el combate. No hacer tap cuando la situación es insostenible puede provocar lesiones graves (roturas de ligamentos, pérdida de conciencia por estrangulamiento).',
      '**Tipos de sumisión más comunes**',
      'El rear naked choke (RNC) es el estrangulamiento trasero más eficaz del MMA. El triángulo, la guillotina y el D\'arce son otras opciones desde posición de tierra. En cuanto a llaves de articulación, el armbar (palanca de codo) y el kneebar (palanca de rodilla) son los más usados.',
      '**Sumisión vs. grappling**',
      'No todos los luchadores priorizan las sumisiones. Los wrestlers suelen buscar el control posicional y el ground and pound, mientras que los especialistas en jiu-jitsu prefieren las finalizaciones en el suelo.',
    ],
    related: ['que-es-un-ko-en-ufc', 'que-es-un-tko-ufc'],
    updatedAt: '2026-05-28',
  },
  // ─── BALONCESTO adicional ────────────────────────────────────────────────────
  {
    slug: 'que-es-un-mate-slam-dunk',
    term: 'Mate (Slam Dunk)',
    sport: 'baloncesto',
    summary:
      'Un mate o slam dunk es la acción de anotar en baloncesto introduciendo el balón con fuerza directamente en el aro desde arriba, con una o ambas manos, valiéndose del salto vertical del jugador.',
    body: [
      'El mate (slam dunk en inglés) es la jugada más espectacular del baloncesto. No solo vale dos puntos igual que una canasta ordinaria, sino que tiene un impacto psicológico enorme: electriza al público, desanima al rival y genera una de las imágenes más icónicas del deporte.',
      '**Tipos de mate**',
      'El mate más básico es el de una mano con carrerilla. Entre las variantes más espectaculares están: el windmill (el jugador hace un círculo completo con el brazo antes de clavar), el 360 (el cuerpo gira sobre el eje vertical durante el salto), el between-the-legs (pasa el balón entre las piernas antes de encestarlo) y el lob dunk, normalmente combinado con un alley-oop de un compañero.',
      '**El Concurso de Mates del All-Star**',
      'Desde 1984, la NBA celebra el Slam Dunk Contest en el All-Star Weekend, uno de los eventos más seguidos del baloncesto mundial. Ganadores legendarios: Michael Jordan (1987, 1988), Vince Carter (2000) y Zach LaVine (2015, 2016), cuyas actuaciones se consideran las más memorables de la historia del concurso.',
      '**Jugadores conocidos por sus mates**',
      'Dominique Wilkins, Julius Erving, Shawn Kemp, LeBron James y Ja Morant son algunos de los jugadores más identificados con el mate por su explosividad y creatividad aérea.',
    ],
    related: ['que-es-el-alley-oop', 'que-es-el-pick-and-roll'],
    updatedAt: '2026-05-28',
  },
  {
    slug: 'que-es-un-tapon-baloncesto',
    term: 'Tapón (bloqueo) en baloncesto',
    sport: 'baloncesto',
    summary:
      'Un tapón o bloqueo en baloncesto ocurre cuando un jugador defensor desvía o rechaza legalmente un tiro rival que todavía está en su trayectoria ascendente o en el punto más alto antes de descender.',
    body: [
      'El tapón (block en inglés) es el arte defensivo más espectacular del baloncesto. Requiere una combinación de timing, posición, envergadura y salto vertical para impedir que el balón entre en el aro sin cometer falta sobre el atacante.',
      '**Cuándo es legal**',
      'Un tapón es legal si el defensor toca el balón cuando aún está en fase de subida o en la cima de su parábola. Si el balón ya está descendiendo hacia la canasta o ya está "en el cilindro" (la proyección vertical del aro), tocarlo es goaltending (interferencia de canasta), que se sanciona concediendo los puntos al equipo atacante.',
      '**Tapones históricos**',
      'Bill Russell (Boston Celtics, años 60) es el mayor bloqueador defensivo de la historia de la NBA. En la era moderna, Dikembe Mutombo (cuatro veces máximo taponador de la liga) y su característico dedo índice agitado tras cada bloqueo son una de las imágenes más icónicas de la NBA. Anthony Davis y Brook Lopez son los taponadores más relevantes de la actualidad.',
      '**Diferencia con el manotazo**',
      'Un manotazo (swat) toca el balón de forma más explosiva y a menudo lo manda fuera de la pista, mientras que un tapón técnico trata de dirigir el rechazo hacia un compañero para iniciar la transición. Los mejores defensores intentan controlar la dirección del tapón.',
    ],
    related: ['que-es-el-pick-and-roll', 'que-es-la-defensa-en-zona'],
    updatedAt: '2026-05-28',
  },
  {
    slug: 'que-es-un-triple-baloncesto',
    term: 'Triple (tiro de 3 puntos)',
    sport: 'baloncesto',
    summary:
      'Un triple es un tiro anotado desde más allá de la línea de tres puntos, que vale 3 puntos en vez de 2. La distancia varía: 7,24 metros en la NBA y 6,75 metros en la FIBA y EuroLiga.',
    body: [
      'El triple (o tiro de tres puntos) ha transformado el baloncesto moderno. Su introducción en la NBA en 1979-1980 tardó décadas en adoptarse masivamente, pero desde los años 2010, el juego exterior se ha convertido en el centro de la estrategia ofensiva de la mayoría de equipos profesionales.',
      '**La revolución del triple**',
      'Los Golden State Warriors de Stephen Curry, Klay Thompson y Draymond Green lideraron la revolución del triple entre 2015 y 2022, batiendo récords de triples anotados por partido temporada tras temporada. En 2015-16, Stephen Curry promedió 5,1 triples por partido, rompiendo todos los registros históricos.',
      '**La línea de tres**',
      'En la NBA, la línea de tres puntos está a 7,24 metros del aro en los laterales y a 7,24 metros en el arco central. En la FIBA y la EuroLiga, la distancia es de 6,75 metros. Los "corner threes" (triples de esquina) son los más eficientes estadísticamente porque son los más cortos de la cancha.',
      '**Estadísticas actuales**',
      'En la temporada 2024-25 de la NBA, los equipos promediaron más de 35 intentos de triple por partido, comparado con menos de 10 en 1990. Stephen Curry es el líder histórico de triples en la NBA, superando a Ray Allen en 2021.',
    ],
    related: ['que-es-el-pick-and-roll', 'que-es-el-triple-doble'],
    updatedAt: '2026-05-28',
  },

  // ─── F1 adicional ────────────────────────────────────────────────────────────
  {
    slug: 'que-es-la-vuelta-rapida-f1',
    term: 'Vuelta rápida en Fórmula 1',
    sport: 'f1',
    summary:
      'La vuelta rápida en F1 es el tiempo de vuelta más rápido de toda la carrera, logrado por cualquier piloto. Su autor recibe 1 punto adicional si termina entre los 10 primeros de la clasificación.',
    body: [
      'La vuelta rápida (fastest lap en inglés) es uno de los objetivos secundarios de una carrera de F1. Aunque no afecta al resultado directo, otorga 1 punto adicional al clasificatorio si el piloto que la consigue termina entre los 10 primeros, lo que puede ser determinante en batallas ajustadas por el campeonato.',
      '**Cómo se logra**',
      'Habitualmente, los equipos esperan a las últimas vueltas de la carrera para intentar la vuelta rápida, cuando el tráfico es menor y pueden montar el compuesto de neumáticos más blando (el más rápido pero el que más se desgasta). A veces un coche hace una parada extra solo para intentar la fastest lap, aunque arriesga perder posiciones si sale del pit lane detrás de rivales.',
      '**Historia del punto por vuelta rápida**',
      'El punto extra por vuelta rápida se reintrodujo en la F1 en 2019 (había existido entre 1950-1959 y de nuevo entre 1961-1963). Su impacto en el campeonato es limitado, pero añade un elemento estratégico extra en las últimas vueltas.',
      '**Récords**',
      'Lewis Hamilton y Michael Schumacher lideran el ranking histórico de vueltas rápidas en F1, con más de 40 cada uno. En circuitos como Monza o Spa, donde la velocidad punta es muy alta, los tiempos de vuelta rápida suelen batir récords de la pista.',
    ],
    related: ['que-es-el-pit-stop-f1', 'que-es-la-pole-position-f1'],
    updatedAt: '2026-05-28',
  },
  {
    slug: 'que-es-una-bandera-roja-f1',
    term: 'Bandera roja en Fórmula 1',
    sport: 'f1',
    summary:
      'La bandera roja en F1 detiene completamente la sesión de carrera o clasificación por razones de seguridad extrema: un accidente grave, condiciones de pista muy peligrosas u obstáculos que el safety car no puede resolver.',
    body: [
      'La bandera roja es la señal más drástica que puede mostrar la dirección de carrera en Fórmula 1. Cuando aparece, todos los pilotos deben reducir la velocidad y regresar al pit lane o a la línea de salida de forma ordenada. La sesión queda suspendida hasta que la pista esté en condiciones seguras.',
      '**Cuándo se despliega**',
      'La bandera roja se usa cuando un safety car no es suficiente para proteger la situación. Los motivos más frecuentes son: un accidente con el coche en medio de la pista, derrames de fluidos en zonas peligrosas, lluvia muy intensa que hace la pista intransitable, o daños graves en las protecciones de la pista (barreras, neumáticos).',
      '**Qué ocurre con la carrera**',
      'Cuando se interrumpe una carrera, el clasificador provisional en ese momento puede convertirse en el resultado final si el director de carrera no puede reiniciarse o si ya se han completado suficientes vueltas (el 75% de la distancia total para puntuar al 50%). Si la carrera se puede reanudar, los pilotos deben volver a la parrilla y se da una segunda salida.',
      '**Impacto estratégico**',
      'Las banderas rojas son uno de los grandes imponderables de la F1: los equipos aprovechan la interrupción para cambiar neumáticos o ajustar la configuración del coche sin perder tiempo de carrera. Ha habido casos donde una bandera roja ha dado la vuelta por completo al resultado.',
    ],
    related: ['que-es-el-safety-car-f1', 'que-es-el-pit-stop-f1'],
    updatedAt: '2026-05-28',
  },

  // ─── TENIS adicional ────────────────────────────────────────────────────────
  {
    slug: 'que-es-un-break-de-saque',
    term: 'Break de saque (tenis)',
    sport: 'tenis',
    summary:
      'Un break de saque o simplemente "break" ocurre cuando el jugador que recibe gana un juego al sacador. Es el evento más decisivo de un set de tenis porque rompe la ventaja natural del saque.',
    body: [
      'El break (ruptura del saque) es el momento más importante de un set de tenis. Estadísticamente, el jugador que saca tiene una ventaja natural: controla el inicio del punto con su servicio. Ganar un juego al saque del rival (hacer un break) supone una ventaja enorme en el marcador.',
      '**Break point**',
      'Un "break point" es la situación en la que el que recibe tiene oportunidad de ganar el juego: es decir, que el marcador del juego sea favorable al receptor (40-0, 40-15, 40-30 o ventaja del receptor). Si el que recibe gana ese punto, hace el break. Si el sacador salva el break point, se dice que "salva el quiebre".',
      '**Contrabreak**',
      'Un contrabreak ocurre cuando el equipo que acaba de ser roto (que ha sufrido un break) rompe inmediatamente el saque del rival para restablecer el equilibrio. Es una de las respuestas más comunes en el tenis de alto nivel.',
      '**Importancia estadística**',
      'En el circuito ATP, los mejores sacadores convierten alrededor del 65-70% de sus juegos de saque. Jugadores como Goran Ivanisevic o John Isner son especialmente difíciles de romper gracias a su servicio. En cambio, en tierra batida (Roland Garros), el saque es menos determinante y los breaks son más frecuentes.',
    ],
    related: ['que-es-un-ace-tenis', 'que-es-el-tie-break'],
    updatedAt: '2026-05-28',
  },
  {
    slug: 'que-es-el-golden-slam',
    term: 'Golden Slam (tenis)',
    sport: 'tenis',
    summary:
      'El Golden Slam es el logro de ganar los cuatro Grand Slams y la medalla de oro olímpica en el mismo año natural. Solo lo ha conseguido Steffi Graf en 1988 y, en dobles, Serena Williams y Venus Williams.',
    body: [
      'El Golden Slam es el mayor logro posible en un año en el tenis individual. Va más allá del Grand Slam de calendario (ganar los 4 torneos grandes del año) al añadir la medalla de oro olímpica, que solo está disponible cada cuatro años.',
      '**Steffi Graf, 1988**',
      'La alemana Steffi Graf es la única jugadora que ha completado el Golden Slam en individuales. En 1988 ganó el Open de Australia, Roland Garros, Wimbledon, el US Open y la medalla de oro en los Juegos Olímpicos de Seúl. Ese año solo perdió 3 partidos en toda la temporada.',
      '**Intentos fallidos**',
      'Novak Djokovic tuvo la oportunidad histórica en 2021 de convertirse en el primer hombre en lograr el Golden Slam: ganó los tres primeros Grand Slams del año y llegó a los Juegos de Tokio como favorito, pero perdió en semifinales. Rafael Nadal y Roger Federer tampoco lo consiguieron nunca.',
      '**En dobles**',
      'Serena Williams y Venus Williams han completado el Golden Slam en dobles en múltiples ocasiones juntas. También lo han conseguido varias parejas masculinas y mixtas a lo largo de los años.',
    ],
    related: ['que-es-un-grand-slam', 'que-es-el-ranking-atp-wta'],
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
