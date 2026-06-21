import { madridDayISO } from './taka-time'

export type QuizCategory =
  | 'historia'
  | 'records'
  | 'mundiales'
  | 'champions'
  | 'jugadores'
  | 'selecciones'
  | 'clubes'
  | 'reglas'

export type QuizSport =
  | 'football'
  | 'basketball'
  | 'tennis'
  | 'motor'      // F1 + MotoGP
  | 'mma'        // UFC / artes marciales
  | 'golf'
  | 'cycling'
  | 'general'    // multideporte: olimpismo, atletismo, boxeo, NFL, rugby…

/** 1 = fácil · 2 = media · 3 = difícil. Se usa para componer la curva de
 *  dificultad de la ronda diaria (ver getDailyQuestions). */
export type QuizDifficulty = 1 | 2 | 3

export interface QuizQuestion {
  id: string
  question: string
  options: [string, string, string, string]
  correctIndex: 0 | 1 | 2 | 3
  category: QuizCategory
  sport: QuizSport
  difficulty: QuizDifficulty
}

export const QUESTIONS: QuizQuestion[] = [
  // ── Mundiales ───────────────────────────────────────────────
  {
    id: 'q001',
    question: '¿Cuántos Mundiales ha ganado Brasil?',
    options: ['3', '4', '5', '6'],
    correctIndex: 2,
    category: 'mundiales',
    sport: 'football',
    difficulty: 1,
  },
  {
    id: 'q002',
    question: '¿En qué año ganó Argentina su tercer Mundial?',
    options: ['2018', '2021', '2022', '2023'],
    correctIndex: 2,
    category: 'mundiales',
    sport: 'football',
    difficulty: 1,
  },
  {
    id: 'q003',
    question: '¿Quién fue el máximo goleador del Mundial 2018?',
    options: ['Cristiano Ronaldo', 'Kylian Mbappé', 'Harry Kane', 'Romelu Lukaku'],
    correctIndex: 2,
    category: 'mundiales',
    sport: 'football',
    difficulty: 2,
  },
  {
    id: 'q004',
    question: '¿En qué país se celebró el Mundial 2010?',
    options: ['Brasil', 'Alemania', 'Sudáfrica', 'Argentina'],
    correctIndex: 2,
    category: 'mundiales',
    sport: 'football',
    difficulty: 1,
  },
  {
    id: 'q005',
    question: '¿Qué selección ganó el Mundial de 1966 en Wembley?',
    options: ['Brasil', 'Alemania', 'Italia', 'Inglaterra'],
    correctIndex: 3,
    category: 'mundiales',
    sport: 'football',
    difficulty: 2,
  },
  {
    id: 'q006',
    question: '¿Cuántos goles marcó Miroslav Klose en Mundiales (récord histórico)?',
    options: ['14', '15', '16', '17'],
    correctIndex: 2,
    category: 'mundiales',
    sport: 'football',
    difficulty: 3,
  },
  {
    id: 'q007',
    question: '¿Qué país fue sede del primer Mundial de fútbol en 1930?',
    options: ['Argentina', 'Brasil', 'Uruguay', 'Chile'],
    correctIndex: 2,
    category: 'mundiales',
    sport: 'football',
    difficulty: 2,
  },
  {
    id: 'q008',
    question: '¿Cuál fue el resultado de la final del Mundial 2014?',
    options: ['Alemania 1-0 Argentina', 'Argentina 2-1 Alemania', 'Alemania 4-0 Brasil', 'Brasil 3-1 Argentina'],
    correctIndex: 0,
    category: 'mundiales',
    sport: 'football',
    difficulty: 2,
  },

  // ── Champions League ─────────────────────────────────────────
  {
    id: 'q009',
    question: '¿Cuántas Champions League ha ganado el Real Madrid (hasta 2024)?',
    options: ['13', '14', '15', '16'],
    correctIndex: 2,
    category: 'champions',
    sport: 'football',
    difficulty: 2,
  },
  {
    id: 'q010',
    question: '¿Quién es el máximo goleador histórico de la Champions League?',
    options: ['Messi', 'Cristiano Ronaldo', 'Raúl', 'Benzema'],
    correctIndex: 1,
    category: 'champions',
    sport: 'football',
    difficulty: 1,
  },
  {
    id: 'q012',
    question: '¿Qué equipo ganó la Champions League en 2005 con una remontada histórica?',
    options: ['Manchester United', 'Barcelona', 'Liverpool', 'Chelsea'],
    correctIndex: 2,
    category: 'champions',
    sport: 'football',
    difficulty: 2,
  },
  {
    id: 'q013',
    question: '¿Cuántas Champions League seguidas ganó el Real Madrid entre 2016 y 2018?',
    options: ['2', '3', '4', '5'],
    correctIndex: 1,
    category: 'champions',
    sport: 'football',
    difficulty: 2,
  },

  // ── Records ──────────────────────────────────────────────────
  {
    id: 'q014',
    question: '¿Cuántos Balones de Oro ha ganado Messi (hasta 2023)?',
    options: ['6', '7', '8', '9'],
    correctIndex: 2,
    category: 'records',
    sport: 'football',
    difficulty: 2,
  },
  {
    id: 'q015',
    question: '¿Qué jugador marcó más goles en un año natural (2012)?',
    options: ['Messi', 'Cristiano Ronaldo', 'Falcao', 'Suárez'],
    correctIndex: 0,
    category: 'records',
    sport: 'football',
    difficulty: 2,
  },
  {
    id: 'q016',
    question: '¿Cuántos goles marcó Messi en el año 2012 (récord Guinness)?',
    options: ['85', '86', '91', '95'],
    correctIndex: 2,
    category: 'records',
    sport: 'football',
    difficulty: 3,
  },
  {
    id: 'q017',
    question: '¿Quién tiene el récord de más goles en una temporada de LaLiga (50 en 2011-12)?',
    options: ['Cristiano Ronaldo', 'Messi', 'Hugo Sánchez', 'Telmo Zarra'],
    correctIndex: 1,
    category: 'records',
    sport: 'football',
    difficulty: 3,
  },

  // ── Jugadores ────────────────────────────────────────────────
  {
    id: 'q018',
    question: '¿Con qué club debutó profesionalmente Cristiano Ronaldo?',
    options: ['Manchester United', 'Sporting CP', 'Benfica', 'Nacional'],
    correctIndex: 1,
    category: 'jugadores',
    sport: 'football',
    difficulty: 2,
  },
  {
    id: 'q019',
    question: '¿Qué número dorsal tiene Messi en el Inter Miami?',
    options: ['10', '19', '30', '9'],
    correctIndex: 0,
    category: 'jugadores',
    sport: 'football',
    difficulty: 1,
  },
  {
    id: 'q020',
    question: '¿En qué año nació Kylian Mbappé?',
    options: ['1996', '1997', '1998', '1999'],
    correctIndex: 2,
    category: 'jugadores',
    sport: 'football',
    difficulty: 2,
  },
  {
    id: 'q021',
    question: '¿De qué país es Erling Haaland?',
    options: ['Suecia', 'Dinamarca', 'Noruega', 'Finlandia'],
    correctIndex: 2,
    category: 'jugadores',
    sport: 'football',
    difficulty: 1,
  },
  {
    id: 'q022',
    question: '¿Qué apodo tiene Neymar Jr.?',
    options: ['O Fenômeno', 'La Joya', 'Ney', 'Dinho'],
    correctIndex: 2,
    category: 'jugadores',
    sport: 'football',
    difficulty: 1,
  },
  {
    id: 'q023',
    question: '¿En qué posición juega Pedri del FC Barcelona?',
    options: ['Delantero', 'Defensa', 'Centrocampista', 'Portero'],
    correctIndex: 2,
    category: 'jugadores',
    sport: 'football',
    difficulty: 1,
  },

  // ── Clubes ───────────────────────────────────────────────────
  {
    id: 'q025',
    question: '¿Cuántas ligas inglesas ha ganado el Manchester City bajo Pep Guardiola (hasta 2024)?',
    options: ['5', '6', '7', '8'],
    correctIndex: 1,
    category: 'clubes',
    sport: 'football',
    difficulty: 3,
  },
  {
    id: 'q026',
    question: '¿Cuál es el estadio del FC Barcelona?',
    options: ['Wanda Metropolitano', 'Bernabéu', 'Spotify Camp Nou', 'Etihad Stadium'],
    correctIndex: 2,
    category: 'clubes',
    sport: 'football',
    difficulty: 1,
  },
  {
    id: 'q027',
    question: '¿En qué año fue fundado el Real Madrid?',
    options: ['1899', '1900', '1902', '1905'],
    correctIndex: 2,
    category: 'clubes',
    sport: 'football',
    difficulty: 2,
  },
  {
    id: 'q028',
    question: '¿Cuántos títulos de LaLiga tiene el Barcelona (hasta 2024)?',
    options: ['25', '26', '27', '28'],
    correctIndex: 2,
    category: 'clubes',
    sport: 'football',
    difficulty: 3,
  },
  {
    id: 'q029',
    question: '¿Cuál es el apodo del Atlético de Madrid?',
    options: ['Los Merengues', 'Los Colchoneros', 'Los Vikingos', 'Los Leones'],
    correctIndex: 1,
    category: 'clubes',
    sport: 'football',
    difficulty: 1,
  },

  // ── Selecciones ──────────────────────────────────────────────
  {
    id: 'q031',
    question: '¿En qué año ganó España su primer Mundial?',
    options: ['2006', '2008', '2010', '2012'],
    correctIndex: 2,
    category: 'selecciones',
    sport: 'football',
    difficulty: 1,
  },
  {
    id: 'q033',
    question: '¿Cuántas Copas América ha ganado Argentina (hasta 2024)?',
    options: ['14', '15', '16', '17'],
    correctIndex: 2,
    category: 'selecciones',
    sport: 'football',
    difficulty: 3,
  },

  // ── Historia ─────────────────────────────────────────────────
  {
    id: 'q034',
    question: '¿Quién marcó el gol de la mano de Dios?',
    options: ['Pelé', 'Zidane', 'Maradona', 'Ronaldo'],
    correctIndex: 2,
    category: 'historia',
    sport: 'football',
    difficulty: 1,
  },
  {
    id: 'q035',
    question: '¿En qué Mundial se produjo el gol de la mano de Dios?',
    options: ['1982', '1986', '1990', '1994'],
    correctIndex: 1,
    category: 'historia',
    sport: 'football',
    difficulty: 2,
  },
  {
    id: 'q036',
    question: '¿Cómo se llamaba el equipo del que formaba parte Johan Cruyff con su fútbol total?',
    options: ['PSV Eindhoven', 'Feyenoord', 'Ajax', 'AZ Alkmaar'],
    correctIndex: 2,
    category: 'historia',
    sport: 'football',
    difficulty: 2,
  },
  {
    id: 'q037',
    question: '¿Ante qué portero falló Roberto Baggio su penalti en la final del Mundial 1994?',
    options: ['Shilton', 'Taffarel', 'Valdés', 'Oliver Kahn'],
    correctIndex: 1,
    category: 'historia',
    sport: 'football',
    difficulty: 3,
  },
  {
    id: 'q038',
    question: '¿En qué país se jugó el Mundial que ganó Francia en 1998?',
    options: ['Alemania', 'España', 'Francia', 'Italia'],
    correctIndex: 2,
    category: 'historia',
    sport: 'football',
    difficulty: 1,
  },

  // ── Reglas ───────────────────────────────────────────────────
  {
    id: 'q039',
    question: '¿Cuántos jugadores forman un equipo de fútbol en el campo?',
    options: ['9', '10', '11', '12'],
    correctIndex: 2,
    category: 'reglas',
    sport: 'football',
    difficulty: 1,
  },
  {
    id: 'q040',
    question: '¿Cuántos minutos dura un partido de fútbol (tiempo reglamentario)?',
    options: ['80', '90', '100', '120'],
    correctIndex: 1,
    category: 'reglas',
    sport: 'football',
    difficulty: 1,
  },
  {
    id: 'q041',
    question: '¿A qué distancia se lanza un penalti en fútbol?',
    options: ['10 metros', '11 metros', '12 metros', '13 metros'],
    correctIndex: 1,
    category: 'reglas',
    sport: 'football',
    difficulty: 2,
  },

  // ── General / Otros deportes ──────────────────────────────────
  {
    id: 'q042',
    question: '¿Cuántos anillos de la NBA tiene LeBron James (hasta 2024)?',
    options: ['2', '3', '4', '5'],
    correctIndex: 2,
    category: 'records',
    sport: 'basketball',
    difficulty: 2,
  },
  {
    id: 'q043',
    question: '¿Cuántos Grand Slams ha ganado Rafael Nadal?',
    options: ['19', '20', '22', '23'],
    correctIndex: 2,
    category: 'records',
    sport: 'tennis',
    difficulty: 2,
  },
  {
    id: 'q044',
    question: '¿En qué deporte se compite por la Copa Davis?',
    options: ['Golf', 'Tenis', 'Pádel', 'Squash'],
    correctIndex: 1,
    category: 'historia',
    sport: 'tennis',
    difficulty: 1,
  },
  {
    id: 'q045',
    question: '¿Cuántos Grand Slams tiene Novak Djokovic (hasta 2024)?',
    options: ['22', '23', '24', '25'],
    correctIndex: 2,
    category: 'records',
    sport: 'tennis',
    difficulty: 2,
  },

  // ── Mundiales (extra) ───────────────────────────────────────────
  {
    id: 'q046',
    question: '¿Dónde se celebró el Mundial 2014?',
    options: ['Sudáfrica', 'Brasil', 'Alemania', 'Francia'],
    correctIndex: 1,
    category: 'mundiales',
    sport: 'football',
    difficulty: 1,
  },
  {
    id: 'q047',
    question: '¿Qué selección ganó el primer Mundial de fútbol en 1930?',
    options: ['Argentina', 'Brasil', 'Uruguay', 'Italia'],
    correctIndex: 2,
    category: 'mundiales',
    sport: 'football',
    difficulty: 2,
  },
  {
    id: 'q048',
    question: '¿Cuántos goles marcó Ronaldo (Brasil) en el Mundial 2002?',
    options: ['6', '7', '8', '9'],
    correctIndex: 2,
    category: 'mundiales',
    sport: 'football',
    difficulty: 2,
  },
  {
    id: 'q049',
    question: '¿Quién ganó el Mundial 2010?',
    options: ['Brasil', 'Alemania', 'España', 'Argentina'],
    correctIndex: 2,
    category: 'mundiales',
    sport: 'football',
    difficulty: 1,
  },
  {
    id: 'q050',
    question: '¿Cuál fue el resultado de la final del Mundial 2014 entre Alemania y Argentina?',
    options: ['1-0', '2-0', '1-1 (pen)', '2-1'],
    correctIndex: 0,
    category: 'mundiales',
    sport: 'football',
    difficulty: 2,
  },
  {
    id: 'q051',
    question: '¿Quién marcó el gol de la victoria en la final del Mundial 2014?',
    options: ['Thomas Müller', 'Miroslav Klose', 'Mario Götze', 'Toni Kroos'],
    correctIndex: 2,
    category: 'mundiales',
    sport: 'football',
    difficulty: 2,
  },
  {
    id: 'q052',
    question: '¿Cuántos mundiales ha ganado Alemania?',
    options: ['3', '4', '5', '6'],
    correctIndex: 1,
    category: 'mundiales',
    sport: 'football',
    difficulty: 1,
  },
  {
    id: 'q053',
    question: '¿En qué Mundial debutó Pelé con tan solo 17 años?',
    options: ['1954', '1958', '1962', '1966'],
    correctIndex: 1,
    category: 'mundiales',
    sport: 'football',
    difficulty: 2,
  },

  // ── Champions League (extra) ────────────────────────────────────
  {
    id: 'q055',
    question: '¿Qué equipo ganó la Champions League 2018-19?',
    options: ['Ajax', 'Barcelona', 'Liverpool', 'Tottenham'],
    correctIndex: 2,
    category: 'champions',
    sport: 'football',
    difficulty: 2,
  },
  {
    id: 'q056',
    question: '¿Dónde se jugó la final de la Champions League 2019?',
    options: ['Wembley', 'Madrid', 'Milán', 'Lisboa'],
    correctIndex: 1,
    category: 'champions',
    sport: 'football',
    difficulty: 2,
  },
  {
    id: 'q059',
    question: '¿Qué club inglés ganó la Champions League 2020-21?',
    options: ['Manchester City', 'Liverpool', 'Chelsea', 'Manchester United'],
    correctIndex: 2,
    category: 'champions',
    sport: 'football',
    difficulty: 2,
  },

  // ── Jugadores ───────────────────────────────────────────────────
  {
    id: 'q060',
    question: '¿En qué año se retiró Zinedine Zidane como jugador?',
    options: ['2004', '2005', '2006', '2007'],
    correctIndex: 2,
    category: 'jugadores',
    sport: 'football',
    difficulty: 2,
  },
  {
    id: 'q061',
    question: '¿De qué club proviene Kylian Mbappé antes del Real Madrid?',
    options: ['Monaco', 'PSG', 'Lyon', 'Marsella'],
    correctIndex: 1,
    category: 'jugadores',
    sport: 'football',
    difficulty: 1,
  },
  {
    id: 'q062',
    question: '¿Cuántos Balones de Oro tiene Lionel Messi (hasta 2024)?',
    options: ['7', '8', '9', '6'],
    correctIndex: 1,
    category: 'jugadores',
    sport: 'football',
    difficulty: 1,
  },
  {
    id: 'q063',
    question: '¿En qué posición jugaba Roberto Carlos?',
    options: ['Lateral derecho', 'Mediocentro', 'Lateral izquierdo', 'Extremo'],
    correctIndex: 2,
    category: 'jugadores',
    sport: 'football',
    difficulty: 1,
  },
  {
    id: 'q064',
    question: '¿Cuál es el nombre completo de Ronaldinho?',
    options: ['Ronaldo Luis Nazário', 'Ronaldo de Assis Moreira', 'Edson Arantes do Nascimento', 'Neymar Júnior'],
    correctIndex: 1,
    category: 'jugadores',
    sport: 'football',
    difficulty: 2,
  },
  {
    id: 'q065',
    question: '¿Con qué apodo se conoce a Erling Haaland?',
    options: ['El Máquina', 'El Cyborg', 'La Bestia', 'El Vikingo'],
    correctIndex: 1,
    category: 'jugadores',
    sport: 'football',
    difficulty: 2,
  },
  {
    id: 'q066',
    question: '¿En qué ciudad nació Lionel Messi?',
    options: ['Buenos Aires', 'Córdoba', 'Rosario', 'Mendoza'],
    correctIndex: 2,
    category: 'jugadores',
    sport: 'football',
    difficulty: 2,
  },
  {
    id: 'q067',
    question: '¿Cuántos Balones de Oro tiene Cristiano Ronaldo?',
    options: ['4', '5', '6', '7'],
    correctIndex: 1,
    category: 'jugadores',
    sport: 'football',
    difficulty: 1,
  },
  {
    id: 'q069',
    question: '¿Quién fue elegido mejor jugador del Mundial 2022?',
    options: ['Kylian Mbappé', 'Luka Modrić', 'Lionel Messi', 'Julián Álvarez'],
    correctIndex: 2,
    category: 'mundiales',
    sport: 'football',
    difficulty: 1,
  },
  {
    id: 'q070',
    question: '¿De qué club es seguidor declarado Zinedine Zidane desde su infancia?',
    options: ['PSG', 'Olympique de Marsella', 'Monaco', 'Lyon'],
    correctIndex: 1,
    category: 'jugadores',
    sport: 'football',
    difficulty: 3,
  },

  // ── Historia / Clubes ───────────────────────────────────────────
  {
    id: 'q071',
    question: '¿En qué año fue fundado el FC Barcelona?',
    options: ['1895', '1899', '1902', '1910'],
    correctIndex: 1,
    category: 'historia',
    sport: 'football',
    difficulty: 2,
  },
  {
    id: 'q072',
    question: '¿Cuál es el estadio del Borussia Dortmund?',
    options: ['Allianz Arena', 'Signal Iduna Park', 'BayArena', 'Veltins-Arena'],
    correctIndex: 1,
    category: 'clubes',
    sport: 'football',
    difficulty: 1,
  },
  {
    id: 'q073',
    question: '¿Qué liga es conocida como "La Liga"?',
    options: ['Serie A italiana', 'Premier League inglesa', 'Liga española', 'Bundesliga alemana'],
    correctIndex: 2,
    category: 'historia',
    sport: 'football',
    difficulty: 1,
  },
  {
    id: 'q074',
    question: '¿Quién es el máximo goleador histórico del Real Madrid?',
    options: ['Raúl', 'Hugo Sánchez', 'Cristiano Ronaldo', 'Alfredo Di Stéfano'],
    correctIndex: 2,
    category: 'records',
    sport: 'football',
    difficulty: 1,
  },
  {
    id: 'q075',
    question: '¿Cuántas ligas españolas consecutivas ganó el Real Madrid entre 2016 y 2020? (antes se interrumpió con el Barça)',
    options: ['1', '2', '3', '4'],
    correctIndex: 0,
    category: 'clubes',
    sport: 'football',
    difficulty: 3,
  },
  {
    id: 'q076',
    question: '¿Qué equipo ganó la primera Premier League de la era moderna (1992-93)?',
    options: ['Liverpool', 'Arsenal', 'Manchester United', 'Blackburn Rovers'],
    correctIndex: 2,
    category: 'historia',
    sport: 'football',
    difficulty: 2,
  },
  {
    id: 'q077',
    question: '¿En qué país juega el Ajax?',
    options: ['Bélgica', 'Dinamarca', 'Países Bajos', 'Suecia'],
    correctIndex: 2,
    category: 'clubes',
    sport: 'football',
    difficulty: 1,
  },
  {
    id: 'q078',
    question: '¿Cuál es el estadio del Bayern de Múnich?',
    options: ['Olympiastadion', 'Signal Iduna Park', 'Allianz Arena', 'Mercedes-Benz Arena'],
    correctIndex: 2,
    category: 'clubes',
    sport: 'football',
    difficulty: 1,
  },
  {
    id: 'q079',
    question: '¿Cuántas Champions League ha ganado el Liverpool?',
    options: ['5', '6', '7', '4'],
    correctIndex: 1,
    category: 'champions',
    sport: 'football',
    difficulty: 2,
  },
  {
    id: 'q080',
    question: '¿Qué entrenador ganó la Champions con el Inter de Milán en 2010?',
    options: ['Carlo Ancelotti', 'José Mourinho', 'Marcello Lippi', 'Roberto Mancini'],
    correctIndex: 1,
    category: 'champions',
    sport: 'football',
    difficulty: 2,
  },

  // ── Selecciones ─────────────────────────────────────────────────
  {
    id: 'q081',
    question: '¿Cuál es el apodo de la selección de Brasil?',
    options: ['La Albiceleste', 'La Canarinha', 'La Seleção', 'Les Bleus'],
    correctIndex: 1,
    category: 'selecciones',
    sport: 'football',
    difficulty: 1,
  },
  {
    id: 'q082',
    question: '¿Qué selección es conocida como "La Furia Roja"?',
    options: ['Portugal', 'Italia', 'España', 'Bélgica'],
    correctIndex: 2,
    category: 'selecciones',
    sport: 'football',
    difficulty: 1,
  },
  {
    id: 'q084',
    question: '¿Qué selección ganó la Eurocopa 2020 (jugada en 2021)?',
    options: ['España', 'Francia', 'Italia', 'Inglaterra'],
    correctIndex: 2,
    category: 'selecciones',
    sport: 'football',
    difficulty: 2,
  },
  {
    id: 'q085',
    question: '¿Cuántas veces ha ganado España la Eurocopa (hasta 2024)?',
    options: ['3', '4', '5', '2'],
    correctIndex: 1,
    category: 'selecciones',
    sport: 'football',
    difficulty: 2,
  },
  {
    id: 'q086',
    question: '¿Quién es el máximo goleador histórico de la selección alemana?',
    options: ['Gerd Müller', 'Miroslav Klose', 'Thomas Müller', 'Rudi Völler'],
    correctIndex: 1,
    category: 'selecciones',
    sport: 'football',
    difficulty: 2,
  },

  // ── Récords ─────────────────────────────────────────────────────
  {
    id: 'q087',
    question: '¿Cuál es el récord de goles en una sola temporada de la Champions League (Cristiano Ronaldo, 2013-14)?',
    options: ['15', '17', '16', '14'],
    correctIndex: 1,
    category: 'records',
    sport: 'football',
    difficulty: 3,
  },
  {
    id: 'q088',
    question: '¿Quién marcó 5 goles en un partido de Champions League en 2012 contra Bayer Leverkusen?',
    options: ['Cristiano Ronaldo', 'Lionel Messi', 'Robert Lewandowski', 'Zlatan Ibrahimović'],
    correctIndex: 1,
    category: 'records',
    sport: 'football',
    difficulty: 2,
  },
  {
    id: 'q089',
    question: '¿Qué portero tiene el récord de minutos sin recibir gol en Mundiales?',
    options: ['Iker Casillas', 'Peter Shilton', 'Walter Zenga', 'Oliver Kahn'],
    correctIndex: 2,
    category: 'records',
    sport: 'football',
    difficulty: 3,
  },
  {
    id: 'q090',
    question: '¿Cuál es el estadio con mayor capacidad del mundo (fútbol)?',
    options: ['Camp Nou', 'Wembley', 'Narendra Modi Stadium', 'Rungrado'],
    correctIndex: 3,
    category: 'records',
    sport: 'football',
    difficulty: 3,
  },

  // ── Reglas ──────────────────────────────────────────────────────
  {
    id: 'q092',
    question: '¿Cuánto tiempo dura una prórroga en fútbol?',
    options: ['20 minutos', '25 minutos', '30 minutos', '40 minutos'],
    correctIndex: 2,
    category: 'reglas',
    sport: 'football',
    difficulty: 1,
  },
  {
    id: 'q093',
    question: '¿Cuántos penaltis lanza cada equipo en una tanda estándar?',
    options: ['3', '4', '5', '6'],
    correctIndex: 2,
    category: 'reglas',
    sport: 'football',
    difficulty: 1,
  },
  {
    id: 'q095',
    question: '¿Cuántos cambios puede realizar un equipo en un partido oficial (desde 2022)?',
    options: ['3', '4', '5', '6'],
    correctIndex: 2,
    category: 'reglas',
    sport: 'football',
    difficulty: 2,
  },

  // ── Baloncesto ──────────────────────────────────────────────────
  {
    id: 'q096',
    question: '¿Cuántos anillos de la NBA ganó Michael Jordan?',
    options: ['5', '6', '7', '4'],
    correctIndex: 1,
    category: 'records',
    sport: 'basketball',
    difficulty: 1,
  },
  {
    id: 'q097',
    question: '¿Qué equipo de la NBA tiene más títulos históricos?',
    options: ['Los Angeles Lakers', 'Boston Celtics', 'Chicago Bulls', 'Golden State Warriors'],
    correctIndex: 1,
    category: 'historia',
    sport: 'basketball',
    difficulty: 2,
  },
  {
    id: 'q098',
    question: '¿En qué año ganó España su primer Eurobasket masculino?',
    options: ['1999', '2003', '2007', '2009'],
    correctIndex: 3,
    category: 'selecciones',
    sport: 'basketball',
    difficulty: 3,
  },
  {
    id: 'q099',
    question: '¿Cuántos puntos vale un triple en baloncesto?',
    options: ['2', '3', '4', '1'],
    correctIndex: 1,
    category: 'reglas',
    sport: 'basketball',
    difficulty: 1,
  },

  // ── Tenis (extra) ───────────────────────────────────────────────
  {
    id: 'q101',
    question: '¿Cuántos Roland Garros ha ganado Rafael Nadal?',
    options: ['12', '13', '14', '11'],
    correctIndex: 2,
    category: 'records',
    sport: 'tennis',
    difficulty: 1,
  },
  {
    id: 'q102',
    question: '¿En qué superficie se juega Wimbledon?',
    options: ['Tierra batida', 'Cemento', 'Hierba', 'Moqueta'],
    correctIndex: 2,
    category: 'reglas',
    sport: 'tennis',
    difficulty: 1,
  },
  {
    id: 'q103',
    question: '¿Cuántos sets se juegan en una final masculina de Grand Slam?',
    options: ['3', '4', '5 al mejor de 5', '2 al mejor de 3'],
    correctIndex: 2,
    category: 'reglas',
    sport: 'tennis',
    difficulty: 1,
  },
  {
    id: 'q105',
    question: '¿Qué tenista ganó tres Grand Slams en 2023 (Australia, Roland Garros y US Open)?',
    options: ['Rafael Nadal', 'Carlos Alcaraz', 'Novak Djokovic', 'Daniil Medvedev'],
    correctIndex: 2,
    category: 'records',
    sport: 'tennis',
    difficulty: 2,
  },

  // ═══════════════════════════════════════════════════════════════
  // FÚTBOL — ampliación (6A)
  // ═══════════════════════════════════════════════════════════════

  // ── Mundiales ───────────────────────────────────────────────
  { id: 'fb001', question: '¿Qué país ganó el Mundial de fútbol 2018?', options: ['Croacia', 'Francia', 'Bélgica', 'Inglaterra'], correctIndex: 1, category: 'mundiales', sport: 'football', difficulty: 1 },
  { id: 'fb002', question: '¿En qué país se celebró el Mundial 2022?', options: ['Catar', 'Rusia', 'Emiratos Árabes Unidos', 'Arabia Saudí'], correctIndex: 0, category: 'mundiales', sport: 'football', difficulty: 1 },
  { id: 'fb003', question: '¿Qué selección ganó el Mundial 2006?', options: ['Francia', 'Italia', 'Alemania', 'Brasil'], correctIndex: 1, category: 'mundiales', sport: 'football', difficulty: 2 },
  { id: 'fb004', question: '¿Quién fue el máximo goleador (Bota de Oro) del Mundial 2022?', options: ['Lionel Messi', 'Kylian Mbappé', 'Julián Álvarez', 'Olivier Giroud'], correctIndex: 1, category: 'mundiales', sport: 'football', difficulty: 2 },
  { id: 'fb005', question: '¿En qué Mundial Zidane dio el famoso cabezazo a Materazzi?', options: ['2002', '2006', '2010', '1998'], correctIndex: 1, category: 'mundiales', sport: 'football', difficulty: 2 },
  { id: 'fb006', question: '¿Qué selección ganó el Mundial 1998?', options: ['Brasil', 'Francia', 'Italia', 'Alemania'], correctIndex: 1, category: 'mundiales', sport: 'football', difficulty: 1 },
  { id: 'fb007', question: '¿Quién ganó el Mundial de 1986 en México?', options: ['Brasil', 'Argentina', 'Italia', 'Alemania'], correctIndex: 1, category: 'mundiales', sport: 'football', difficulty: 2 },
  { id: 'fb008', question: '¿Cuál fue la sede del Mundial 2002, el primero en Asia?', options: ['Japón y Corea del Sur', 'China', 'India', 'Tailandia'], correctIndex: 0, category: 'mundiales', sport: 'football', difficulty: 2 },
  { id: 'fb009', question: '¿Qué jugador marcó un triplete en la final del Mundial 2022?', options: ['Kylian Mbappé', 'Lionel Messi', 'Ángel Di María', 'Julián Álvarez'], correctIndex: 0, category: 'mundiales', sport: 'football', difficulty: 2 },
  { id: 'fb010', question: '¿Cuántos goles marcó Just Fontaine en el Mundial 1958, récord en una sola edición?', options: ['11', '13', '9', '15'], correctIndex: 1, category: 'mundiales', sport: 'football', difficulty: 3 },
  { id: 'fb011', question: '¿Contra quién perdió Brasil 7-1 en el Mundial 2014?', options: ['Argentina', 'Alemania', 'Países Bajos', 'Francia'], correctIndex: 1, category: 'mundiales', sport: 'football', difficulty: 2 },
  { id: 'fb012', question: '¿Qué selección africana llegó por primera vez a semifinales de un Mundial en 2022?', options: ['Marruecos', 'Senegal', 'Ghana', 'Camerún'], correctIndex: 0, category: 'mundiales', sport: 'football', difficulty: 2 },
  { id: 'fb013', question: '¿Quién ganó el Mundial de 1970?', options: ['Italia', 'Brasil', 'Alemania', 'Uruguay'], correctIndex: 1, category: 'mundiales', sport: 'football', difficulty: 2 },
  { id: 'fb014', question: '¿Qué jugador ganó tres Mundiales como futbolista?', options: ['Pelé', 'Maradona', 'Beckenbauer', 'Cruyff'], correctIndex: 0, category: 'mundiales', sport: 'football', difficulty: 2 },
  { id: 'fb015', question: '¿Quién fue el máximo goleador del Mundial 2014?', options: ['James Rodríguez', 'Thomas Müller', 'Lionel Messi', 'Neymar'], correctIndex: 0, category: 'mundiales', sport: 'football', difficulty: 2 },

  // ── Champions / Europa ──────────────────────────────────────
  { id: 'fb016', question: '¿Qué equipo ganó la Champions League 2024?', options: ['Borussia Dortmund', 'Real Madrid', 'Bayern de Múnich', 'Manchester City'], correctIndex: 1, category: 'champions', sport: 'football', difficulty: 1 },
  { id: 'fb017', question: '¿Cuántas Copas de Europa/Champions ha ganado el AC Milan?', options: ['5', '6', '7', '8'], correctIndex: 2, category: 'champions', sport: 'football', difficulty: 2 },
  { id: 'fb018', question: '¿Qué entrenador ha ganado más Champions League en la historia?', options: ['Carlo Ancelotti', 'Pep Guardiola', 'Zinedine Zidane', 'Alex Ferguson'], correctIndex: 0, category: 'champions', sport: 'football', difficulty: 2 },
  { id: 'fb019', question: '¿Qué club ganó la primera Copa de Europa en 1956?', options: ['Real Madrid', 'Benfica', 'AC Milan', 'Stade de Reims'], correctIndex: 0, category: 'champions', sport: 'football', difficulty: 2 },
  { id: 'fb020', question: '¿Qué club ganó la Champions 2020, disputada en la burbuja de Lisboa?', options: ['PSG', 'Bayern de Múnich', 'RB Leipzig', 'Olympique de Lyon'], correctIndex: 1, category: 'champions', sport: 'football', difficulty: 2 },
  { id: 'fb021', question: '¿Cuántas Copas de Europa seguidas ganó el Real Madrid entre 1956 y 1960?', options: ['3', '4', '5', '6'], correctIndex: 2, category: 'champions', sport: 'football', difficulty: 3 },
  { id: 'fb022', question: '¿Qué equipo italiano ganó la Champions 2010 completando el triplete?', options: ['Juventus', 'Inter de Milán', 'AC Milan', 'AS Roma'], correctIndex: 1, category: 'champions', sport: 'football', difficulty: 2 },
  { id: 'fb023', question: '¿Qué equipo ganó la Europa League 2024 ante el Bayer Leverkusen?', options: ['Atalanta', 'AS Roma', 'Liverpool', 'Marsella'], correctIndex: 0, category: 'champions', sport: 'football', difficulty: 3 },
  { id: 'fb024', question: '¿Qué club inglés ganó la Champions de 2012 a penaltis en Múnich?', options: ['Manchester United', 'Chelsea', 'Arsenal', 'Manchester City'], correctIndex: 1, category: 'champions', sport: 'football', difficulty: 2 },
  { id: 'fb025', question: '¿Qué club tiene más títulos de Champions League/Copa de Europa?', options: ['AC Milan', 'Real Madrid', 'Bayern de Múnich', 'Liverpool'], correctIndex: 1, category: 'champions', sport: 'football', difficulty: 1 },

  // ── Jugadores ───────────────────────────────────────────────
  { id: 'fb026', question: '¿De qué país es Luka Modrić?', options: ['Serbia', 'Croacia', 'Eslovenia', 'Bosnia'], correctIndex: 1, category: 'jugadores', sport: 'football', difficulty: 1 },
  { id: 'fb027', question: '¿Quién ganó el Balón de Oro 2023?', options: ['Erling Haaland', 'Lionel Messi', 'Kylian Mbappé', 'Kevin De Bruyne'], correctIndex: 1, category: 'jugadores', sport: 'football', difficulty: 2 },
  { id: 'fb028', question: '¿Quién ganó el Balón de Oro 2024?', options: ['Vinícius Júnior', 'Rodri', 'Jude Bellingham', 'Kylian Mbappé'], correctIndex: 1, category: 'jugadores', sport: 'football', difficulty: 2 },
  { id: 'fb029', question: '¿En qué posición juega Virgil van Dijk?', options: ['Defensa central', 'Delantero', 'Portero', 'Extremo'], correctIndex: 0, category: 'jugadores', sport: 'football', difficulty: 1 },
  { id: 'fb030', question: '¿De qué país es Kevin De Bruyne?', options: ['Países Bajos', 'Bélgica', 'Alemania', 'Francia'], correctIndex: 1, category: 'jugadores', sport: 'football', difficulty: 1 },
  { id: 'fb031', question: '¿Qué jugador es apodado "La Pulga"?', options: ['Sergio Agüero', 'Lionel Messi', 'Carlos Tévez', 'Paulo Dybala'], correctIndex: 1, category: 'jugadores', sport: 'football', difficulty: 1 },
  { id: 'fb032', question: '¿De qué país es Mohamed Salah?', options: ['Marruecos', 'Egipto', 'Argelia', 'Túnez'], correctIndex: 1, category: 'jugadores', sport: 'football', difficulty: 1 },
  { id: 'fb033', question: '¿Con qué club ganó Cristiano Ronaldo su primera Champions (2008)?', options: ['Sporting CP', 'Manchester United', 'Real Madrid', 'Juventus'], correctIndex: 1, category: 'jugadores', sport: 'football', difficulty: 2 },
  { id: 'fb034', question: '¿Qué dorsal llevaba Maradona en la selección argentina?', options: ['7', '9', '10', '11'], correctIndex: 2, category: 'jugadores', sport: 'football', difficulty: 1 },
  { id: 'fb035', question: '¿De qué país es Robert Lewandowski?', options: ['Polonia', 'República Checa', 'Ucrania', 'Alemania'], correctIndex: 0, category: 'jugadores', sport: 'football', difficulty: 1 },
  { id: 'fb036', question: '¿Quién es el máximo goleador histórico de la selección de Portugal?', options: ['Luís Figo', 'Cristiano Ronaldo', 'Eusébio', 'Pauleta'], correctIndex: 1, category: 'jugadores', sport: 'football', difficulty: 1 },
  { id: 'fb037', question: '¿En qué club juega Vinícius Júnior?', options: ['FC Barcelona', 'Real Madrid', 'PSG', 'Manchester City'], correctIndex: 1, category: 'jugadores', sport: 'football', difficulty: 1 },
  { id: 'fb038', question: '¿Qué portero alemán ganó el Mundial 2014 y el Guante de Oro?', options: ['Oliver Kahn', 'Manuel Neuer', 'Marc-André ter Stegen', 'Sven Ulreich'], correctIndex: 1, category: 'jugadores', sport: 'football', difficulty: 2 },
  { id: 'fb039', question: '¿De qué nacionalidad es Zlatan Ibrahimović?', options: ['Croata', 'Sueco', 'Bosnio', 'Danés'], correctIndex: 1, category: 'jugadores', sport: 'football', difficulty: 1 },
  { id: 'fb040', question: '¿Quién ganó el premio The Best FIFA 2022 al mejor jugador?', options: ['Karim Benzema', 'Lionel Messi', 'Kylian Mbappé', 'Erling Haaland'], correctIndex: 1, category: 'jugadores', sport: 'football', difficulty: 3 },
  { id: 'fb041', question: '¿En qué posición jugaba la leyenda del Milan Paolo Maldini?', options: ['Defensa', 'Delantero', 'Mediocentro', 'Portero'], correctIndex: 0, category: 'jugadores', sport: 'football', difficulty: 1 },
  { id: 'fb042', question: '¿De qué país es el delantero Harry Kane?', options: ['Inglaterra', 'Irlanda', 'Gales', 'Escocia'], correctIndex: 0, category: 'jugadores', sport: 'football', difficulty: 1 },
  { id: 'fb043', question: '¿A qué club fichó Neymar en 2017 por una cifra récord?', options: ['Real Madrid', 'PSG', 'FC Barcelona', 'Manchester City'], correctIndex: 1, category: 'jugadores', sport: 'football', difficulty: 1 },
  { id: 'fb044', question: '¿Quién es el máximo goleador histórico de la selección argentina?', options: ['Gabriel Batistuta', 'Lionel Messi', 'Sergio Agüero', 'Diego Maradona'], correctIndex: 1, category: 'jugadores', sport: 'football', difficulty: 1 },
  { id: 'fb045', question: '¿Qué jugador del Liverpool es apodado "El Faraón"?', options: ['Sadio Mané', 'Mohamed Salah', 'Naby Keïta', 'Roberto Firmino'], correctIndex: 1, category: 'jugadores', sport: 'football', difficulty: 2 },

  // ── Clubes ──────────────────────────────────────────────────
  { id: 'fb046', question: '¿De qué ciudad es el club Boca Juniors?', options: ['Buenos Aires', 'Rosario', 'Córdoba', 'La Plata'], correctIndex: 0, category: 'clubes', sport: 'football', difficulty: 1 },
  { id: 'fb047', question: '¿Cuál es el estadio de Boca Juniors?', options: ['El Monumental', 'La Bombonera', 'El Cilindro', 'El Gigante de Arroyito'], correctIndex: 1, category: 'clubes', sport: 'football', difficulty: 2 },
  { id: 'fb048', question: '¿Qué club inglés es conocido como "Los Diablos Rojos"?', options: ['Liverpool', 'Manchester United', 'Arsenal', 'Manchester City'], correctIndex: 1, category: 'clubes', sport: 'football', difficulty: 2 },
  { id: 'fb049', question: '¿En qué país juega el Benfica?', options: ['España', 'Portugal', 'Brasil', 'Italia'], correctIndex: 1, category: 'clubes', sport: 'football', difficulty: 1 },
  { id: 'fb050', question: '¿Cuál es el gran clásico del fútbol argentino?', options: ['Boca-River', 'Racing-Independiente', 'Boca-San Lorenzo', 'River-Racing'], correctIndex: 0, category: 'clubes', sport: 'football', difficulty: 1 },
  { id: 'fb051', question: '¿Qué club ganó la Premier League 2015-16 como gran sorpresa?', options: ['Leicester City', 'Tottenham', 'Arsenal', 'Chelsea'], correctIndex: 0, category: 'clubes', sport: 'football', difficulty: 2 },
  { id: 'fb052', question: '¿En qué ciudad juega el Celtic FC?', options: ['Glasgow', 'Edimburgo', 'Liverpool', 'Dublín'], correctIndex: 0, category: 'clubes', sport: 'football', difficulty: 2 },
  { id: 'fb053', question: '¿Cuál es el estadio del Liverpool?', options: ['Old Trafford', 'Anfield', 'Goodison Park', 'Stamford Bridge'], correctIndex: 1, category: 'clubes', sport: 'football', difficulty: 1 },
  { id: 'fb054', question: '¿Qué club italiano es conocido como "La Vecchia Signora"?', options: ['AC Milan', 'Juventus', 'Inter de Milán', 'Napoli'], correctIndex: 1, category: 'clubes', sport: 'football', difficulty: 2 },
  { id: 'fb055', question: '¿Qué club brasileño ganó la Copa Libertadores 2022?', options: ['Flamengo', 'Palmeiras', 'River Plate', 'Boca Juniors'], correctIndex: 0, category: 'clubes', sport: 'football', difficulty: 3 },
  { id: 'fb056', question: '¿Cuál es el derbi de la ciudad de Madrid?', options: ['Real Madrid-Atlético', 'Real Madrid-Getafe', 'Atlético-Rayo', 'Real Madrid-Barcelona'], correctIndex: 0, category: 'clubes', sport: 'football', difficulty: 1 },
  { id: 'fb057', question: '¿Qué club alemán es el más laureado de la Bundesliga?', options: ['Borussia Dortmund', 'Bayern de Múnich', 'RB Leipzig', 'Schalke 04'], correctIndex: 1, category: 'clubes', sport: 'football', difficulty: 1 },
  { id: 'fb058', question: '¿En qué estadio juega el Atlético de Madrid desde 2017?', options: ['Vicente Calderón', 'Metropolitano', 'Santiago Bernabéu', 'La Cerámica'], correctIndex: 1, category: 'clubes', sport: 'football', difficulty: 2 },

  // ── Selecciones ─────────────────────────────────────────────
  { id: 'fb059', question: '¿Qué selección ganó la Copa América 2024?', options: ['Brasil', 'Argentina', 'Uruguay', 'Colombia'], correctIndex: 1, category: 'selecciones', sport: 'football', difficulty: 2 },
  { id: 'fb060', question: '¿Qué selección ganó la Eurocopa 2024?', options: ['Inglaterra', 'España', 'Francia', 'Alemania'], correctIndex: 1, category: 'selecciones', sport: 'football', difficulty: 1 },
  { id: 'fb061', question: '¿Cuántos Mundiales ha ganado Italia?', options: ['2', '3', '4', '5'], correctIndex: 2, category: 'selecciones', sport: 'football', difficulty: 2 },
  { id: 'fb062', question: '¿Cuántos Mundiales ha ganado Uruguay?', options: ['1', '2', '3', '4'], correctIndex: 1, category: 'selecciones', sport: 'football', difficulty: 2 },
  { id: 'fb063', question: '¿Qué selección ganó el "Maracanazo" en el Mundial de 1950?', options: ['Brasil', 'Uruguay', 'Argentina', 'Italia'], correctIndex: 1, category: 'selecciones', sport: 'football', difficulty: 3 },
  { id: 'fb064', question: '¿Qué país albergará el Mundial 2026 junto a EE. UU. y Canadá?', options: ['México', 'Brasil', 'Argentina', 'Colombia'], correctIndex: 0, category: 'selecciones', sport: 'football', difficulty: 1 },
  { id: 'fb065', question: '¿Cuál es el apodo de la selección de Italia?', options: ['La Azzurra', 'Les Bleus', 'La Roja', 'A Seleção'], correctIndex: 0, category: 'selecciones', sport: 'football', difficulty: 2 },
  { id: 'fb066', question: '¿Qué selección es apodada "Les Bleus"?', options: ['Bélgica', 'Francia', 'Italia', 'Países Bajos'], correctIndex: 1, category: 'selecciones', sport: 'football', difficulty: 1 },
  { id: 'fb067', question: '¿Quién ganó la Eurocopa 2016?', options: ['Francia', 'Portugal', 'Alemania', 'Gales'], correctIndex: 1, category: 'selecciones', sport: 'football', difficulty: 2 },
  { id: 'fb068', question: '¿En qué país se jugó la Eurocopa 2024?', options: ['Alemania', 'Francia', 'Inglaterra', 'Italia'], correctIndex: 0, category: 'selecciones', sport: 'football', difficulty: 2 },
  { id: 'fb069', question: '¿Cuántas Copas del Mundo ha ganado Francia?', options: ['1', '2', '3', '4'], correctIndex: 1, category: 'selecciones', sport: 'football', difficulty: 2 },
  { id: 'fb070', question: '¿Qué selección ganó la Copa América 2015 y 2016?', options: ['Argentina', 'Chile', 'Brasil', 'Uruguay'], correctIndex: 1, category: 'selecciones', sport: 'football', difficulty: 2 },

  // ── Historia ────────────────────────────────────────────────
  { id: 'fb071', question: '¿Quién es considerado el "Rey del Fútbol"?', options: ['Maradona', 'Pelé', 'Di Stéfano', 'Cruyff'], correctIndex: 1, category: 'historia', sport: 'football', difficulty: 1 },
  { id: 'fb072', question: '¿En qué club se hizo leyenda Alfredo Di Stéfano?', options: ['FC Barcelona', 'Real Madrid', 'Atlético de Madrid', 'Valencia'], correctIndex: 1, category: 'historia', sport: 'football', difficulty: 2 },
  { id: 'fb073', question: '¿Qué jugador neerlandés popularizó el "fútbol total"?', options: ['Marco van Basten', 'Johan Cruyff', 'Ruud Gullit', 'Dennis Bergkamp'], correctIndex: 1, category: 'historia', sport: 'football', difficulty: 2 },
  { id: 'fb074', question: '¿Qué selección ganó el primer Campeonato de Europa (1960)?', options: ['España', 'Unión Soviética', 'Yugoslavia', 'Italia'], correctIndex: 1, category: 'historia', sport: 'football', difficulty: 3 },
  { id: 'fb075', question: '¿Quién ganó el primer Balón de Oro de la historia, en 1956?', options: ['Alfredo Di Stéfano', 'Stanley Matthews', 'Raymond Kopa', 'Ferenc Puskás'], correctIndex: 1, category: 'historia', sport: 'football', difficulty: 3 },
  { id: 'fb076', question: '¿En qué año se celebró el primer Mundial femenino?', options: ['1991', '1995', '1999', '1987'], correctIndex: 0, category: 'historia', sport: 'football', difficulty: 3 },
  { id: 'fb077', question: '¿Qué entrenador dirigió a España en el Mundial 2010?', options: ['Luis Aragonés', 'Vicente del Bosque', 'Luis Enrique', 'Julen Lopetegui'], correctIndex: 1, category: 'historia', sport: 'football', difficulty: 2 },
  { id: 'fb078', question: '¿Qué entrenador dirigió a España en la Eurocopa 2008?', options: ['Luis Aragonés', 'Vicente del Bosque', 'Luis Enrique', 'José Antonio Camacho'], correctIndex: 0, category: 'historia', sport: 'football', difficulty: 2 },
  { id: 'fb079', question: '¿Qué equipo español logró el primer triplete (Liga, Copa y Champions) en 2009?', options: ['Real Madrid', 'FC Barcelona', 'Valencia', 'Atlético de Madrid'], correctIndex: 1, category: 'historia', sport: 'football', difficulty: 2 },
  { id: 'fb080', question: '¿Quién es el máximo goleador en la historia de las selecciones (fútbol masculino)?', options: ['Lionel Messi', 'Cristiano Ronaldo', 'Ali Daei', 'Pelé'], correctIndex: 1, category: 'historia', sport: 'football', difficulty: 2 },

  // ── Récords ─────────────────────────────────────────────────
  { id: 'fb081', question: '¿Qué club español tiene más títulos de LaLiga?', options: ['FC Barcelona', 'Real Madrid', 'Atlético de Madrid', 'Athletic Club'], correctIndex: 1, category: 'records', sport: 'football', difficulty: 2 },
  { id: 'fb082', question: '¿Quién ha ganado más veces el Balón de Oro?', options: ['Cristiano Ronaldo', 'Lionel Messi', 'Johan Cruyff', 'Michel Platini'], correctIndex: 1, category: 'records', sport: 'football', difficulty: 1 },
  { id: 'fb083', question: '¿Qué portero español fue apodado "San Iker" por sus paradas decisivas?', options: ['Iker Casillas', 'David de Gea', 'Pepe Reina', 'Víctor Valdés'], correctIndex: 0, category: 'records', sport: 'football', difficulty: 1 },
  { id: 'fb084', question: '¿Qué selección tiene el récord de más Copas del Mundo?', options: ['Alemania', 'Brasil', 'Italia', 'Argentina'], correctIndex: 1, category: 'records', sport: 'football', difficulty: 1 },
  { id: 'fb085', question: '¿Qué jugador ha ganado más veces la Bota de Oro europea?', options: ['Cristiano Ronaldo', 'Lionel Messi', 'Luis Suárez', 'Gerd Müller'], correctIndex: 1, category: 'records', sport: 'football', difficulty: 3 },
  { id: 'fb096', question: '¿Quién ganó la Bota de Oro del Mundial 2010?', options: ['David Villa', 'Thomas Müller', 'Wesley Sneijder', 'Diego Forlán'], correctIndex: 1, category: 'records', sport: 'football', difficulty: 3 },

  // ── Reglas ──────────────────────────────────────────────────
  { id: 'fb086', question: '¿Qué tecnología asiste al árbitro para revisar jugadas desde 2018?', options: ['VAR', 'GLT', 'Ojo de Halcón', 'TMO'], correctIndex: 0, category: 'reglas', sport: 'football', difficulty: 1 },
  { id: 'fb087', question: '¿Cuántos árbitros asistentes (jueces de línea) hay en un partido de fútbol?', options: ['1', '2', '3', '4'], correctIndex: 1, category: 'reglas', sport: 'football', difficulty: 1 },
  { id: 'fb088', question: '¿De qué color es la tarjeta que expulsa a un jugador?', options: ['Amarilla', 'Roja', 'Verde', 'Azul'], correctIndex: 1, category: 'reglas', sport: 'football', difficulty: 1 },
  { id: 'fb089', question: '¿Qué significa que un atacante esté en "fuera de juego"?', options: ['Está lesionado', 'Está adelantado al penúltimo defensa al recibir el balón', 'Está fuera del campo', 'Ha sido sancionado'], correctIndex: 1, category: 'reglas', sport: 'football', difficulty: 2 },
  { id: 'fb090', question: '¿Cada cuántos años se celebra la Copa del Mundo masculina?', options: ['2', '3', '4', '5'], correctIndex: 2, category: 'reglas', sport: 'football', difficulty: 1 },
  { id: 'fb091', question: '¿Cuántos puntos otorga una victoria en la liga con el sistema actual?', options: ['1', '2', '3', '4'], correctIndex: 2, category: 'reglas', sport: 'football', difficulty: 1 },
  { id: 'fb092', question: '¿Qué se señala cuando el balón sale por la línea de banda?', options: ['Saque de esquina', 'Saque de banda', 'Saque de puerta', 'Penalti'], correctIndex: 1, category: 'reglas', sport: 'football', difficulty: 1 },
  { id: 'fb093', question: '¿Cuánto mide de ancho una portería de fútbol reglamentaria?', options: ['7,32 metros', '5 metros', '6 metros', '8 metros'], correctIndex: 0, category: 'reglas', sport: 'football', difficulty: 3 },

  // ── Más jugadores / actualidad ──────────────────────────────
  { id: 'fb097', question: '¿Cuál es el torneo de clubes más importante de Sudamérica?', options: ['Copa Sudamericana', 'Copa Libertadores', 'Recopa Sudamericana', 'Copa de Oro'], correctIndex: 1, category: 'clubes', sport: 'football', difficulty: 1 },
  { id: 'fb098', question: '¿En qué club se retiró del fútbol europeo Andrés Iniesta antes de jugar en Japón?', options: ['Real Madrid', 'FC Barcelona', 'Atlético de Madrid', 'Villarreal'], correctIndex: 1, category: 'jugadores', sport: 'football', difficulty: 2 },
  { id: 'fb099', question: '¿Quién marcó el gol del título para España en la final del Mundial 2010?', options: ['David Villa', 'Andrés Iniesta', 'Carles Puyol', 'Xavi Hernández'], correctIndex: 1, category: 'jugadores', sport: 'football', difficulty: 1 },
  { id: 'fb100', question: '¿Qué jugador brasileño ganó el Balón de Oro en 2007?', options: ['Ronaldinho', 'Kaká', 'Ronaldo Nazário', 'Robinho'], correctIndex: 1, category: 'jugadores', sport: 'football', difficulty: 3 },
  { id: 'fb101', question: '¿Quién fue el primer futbolista africano en ganar el Balón de Oro (1995)?', options: ['George Weah', 'Samuel Eto’o', 'Didier Drogba', 'Yaya Touré'], correctIndex: 0, category: 'historia', sport: 'football', difficulty: 3 },
  { id: 'fb102', question: '¿Qué jugador es conocido por las siglas "CR7"?', options: ['Cristiano Ronaldo', 'Ronaldo Nazário', 'Ronaldinho', 'Romário'], correctIndex: 0, category: 'jugadores', sport: 'football', difficulty: 1 },
  { id: 'fb103', question: '¿Qué selección ganó la Liga de Naciones de la UEFA 2023?', options: ['Croacia', 'España', 'Italia', 'Países Bajos'], correctIndex: 1, category: 'selecciones', sport: 'football', difficulty: 3 },
  { id: 'fb104', question: '¿Qué entrenador dirigió al Barcelona del "tiki-taka" y el sextete (2008-2012)?', options: ['Luis Enrique', 'Pep Guardiola', 'Tito Vilanova', 'Frank Rijkaard'], correctIndex: 1, category: 'clubes', sport: 'football', difficulty: 1 },
  { id: 'fb105', question: '¿Qué club ganó su primera Champions League en 2025?', options: ['Inter de Milán', 'Paris Saint-Germain', 'Arsenal', 'Borussia Dortmund'], correctIndex: 1, category: 'champions', sport: 'football', difficulty: 2 },

  // ═══════════════════════════════════════════════════════════════
  // BALONCESTO (6A)
  // ═══════════════════════════════════════════════════════════════
  { id: 'bk001', question: '¿Quién es el máximo anotador en la historia de la NBA?', options: ['Kareem Abdul-Jabbar', 'LeBron James', 'Karl Malone', 'Michael Jordan'], correctIndex: 1, category: 'records', sport: 'basketball', difficulty: 2 },
  { id: 'bk002', question: '¿Cuántos puntos anotó Wilt Chamberlain en un solo partido, récord de la NBA?', options: ['81', '100', '73', '92'], correctIndex: 1, category: 'records', sport: 'basketball', difficulty: 2 },
  { id: 'bk003', question: '¿Qué equipo ganó el campeonato de la NBA en 2024?', options: ['Dallas Mavericks', 'Boston Celtics', 'Denver Nuggets', 'Golden State Warriors'], correctIndex: 1, category: 'records', sport: 'basketball', difficulty: 2 },
  { id: 'bk004', question: '¿Cuántos anillos ganó Bill Russell con los Boston Celtics?', options: ['8', '11', '6', '9'], correctIndex: 1, category: 'records', sport: 'basketball', difficulty: 3 },
  { id: 'bk005', question: '¿Qué jugador es conocido como "King James"?', options: ['Kevin Durant', 'LeBron James', 'James Harden', 'Kyrie Irving'], correctIndex: 1, category: 'jugadores', sport: 'basketball', difficulty: 1 },
  { id: 'bk006', question: '¿De qué país es Giannis Antetokounmpo?', options: ['Nigeria', 'Grecia', 'Camerún', 'España'], correctIndex: 1, category: 'jugadores', sport: 'basketball', difficulty: 2 },
  { id: 'bk007', question: '¿Qué equipo ganó el anillo de la NBA en 2016 tras remontar un 3-1 en las Finales?', options: ['Golden State Warriors', 'Cleveland Cavaliers', 'San Antonio Spurs', 'Toronto Raptors'], correctIndex: 1, category: 'historia', sport: 'basketball', difficulty: 3 },
  { id: 'bk008', question: '¿Cuántos jugadores de cada equipo hay en pista en baloncesto?', options: ['4', '5', '6', '7'], correctIndex: 1, category: 'reglas', sport: 'basketball', difficulty: 1 },
  { id: 'bk009', question: '¿Cuánto vale un tiro libre en baloncesto?', options: ['1 punto', '2 puntos', '3 puntos', 'No puntúa'], correctIndex: 0, category: 'reglas', sport: 'basketball', difficulty: 1 },
  { id: 'bk010', question: '¿Qué pívot español ganó dos anillos de la NBA con Los Angeles Lakers?', options: ['Marc Gasol', 'Pau Gasol', 'Felipe Reyes', 'Rudy Fernández'], correctIndex: 1, category: 'jugadores', sport: 'basketball', difficulty: 2 },
  { id: 'bk011', question: '¿Quién ganó 6 anillos y 6 MVP de las Finales con los Chicago Bulls?', options: ['Scottie Pippen', 'Michael Jordan', 'Dennis Rodman', 'Phil Jackson'], correctIndex: 1, category: 'jugadores', sport: 'basketball', difficulty: 2 },
  { id: 'bk012', question: '¿Quién tiene el récord de más premios MVP de temporada en la NBA?', options: ['Michael Jordan', 'Kareem Abdul-Jabbar', 'LeBron James', 'Bill Russell'], correctIndex: 1, category: 'records', sport: 'basketball', difficulty: 3 },
  { id: 'bk013', question: '¿Qué selección domina el baloncesto olímpico masculino?', options: ['España', 'Estados Unidos', 'Argentina', 'Francia'], correctIndex: 1, category: 'selecciones', sport: 'basketball', difficulty: 1 },
  { id: 'bk014', question: '¿En qué año ganó España su primer Mundial de baloncesto?', options: ['2006', '2010', '2014', '2019'], correctIndex: 0, category: 'selecciones', sport: 'basketball', difficulty: 2 },
  { id: 'bk015', question: '¿Cuántos cuartos tiene un partido de la NBA?', options: ['2', '3', '4', '5'], correctIndex: 2, category: 'reglas', sport: 'basketball', difficulty: 1 },
  { id: 'bk016', question: '¿Qué base español fue MVP del Mundial de baloncesto 2019?', options: ['Ricky Rubio', 'Sergio Llull', 'José Calderón', 'Juan Carlos Navarro'], correctIndex: 0, category: 'jugadores', sport: 'basketball', difficulty: 3 },
  { id: 'bk017', question: '¿Qué equipo de la NBA jugaba en Seattle antes de mudarse a Oklahoma?', options: ['SuperSonics', 'Thunder', 'Jazz', 'Kings'], correctIndex: 0, category: 'historia', sport: 'basketball', difficulty: 3 },
  { id: 'bk018', question: '¿Qué base revolucionó el tiro de tres puntos liderando a los Golden State Warriors?', options: ['Stephen Curry', 'Klay Thompson', 'Draymond Green', 'Kevin Durant'], correctIndex: 0, category: 'jugadores', sport: 'basketball', difficulty: 1 },
  { id: 'bk019', question: '¿Qué jugador alemán ganó el anillo de la NBA con los Dallas Mavericks en 2011?', options: ['Dirk Nowitzki', 'Detlef Schrempf', 'Dennis Schröder', 'Daniel Theis'], correctIndex: 0, category: 'jugadores', sport: 'basketball', difficulty: 2 },
  { id: 'bk020', question: '¿Cómo se llama la principal competición de clubes de baloncesto en Europa?', options: ['Eurocup', 'Euroliga', 'Champions League', 'Liga ACB'], correctIndex: 1, category: 'clubes', sport: 'basketball', difficulty: 1 },
  { id: 'bk021', question: '¿Qué club español tiene más títulos de Euroliga?', options: ['FC Barcelona', 'Real Madrid', 'Baskonia', 'Valencia Basket'], correctIndex: 1, category: 'clubes', sport: 'basketball', difficulty: 3 },
  { id: 'bk022', question: '¿Qué término describe encestar saltando y machacando el aro?', options: ['Mate', 'Bandeja', 'Gancho', 'Tapón'], correctIndex: 0, category: 'reglas', sport: 'basketball', difficulty: 1 },
  { id: 'bk023', question: '¿Cómo se llama la liga profesional de baloncesto de Estados Unidos?', options: ['NFL', 'NBA', 'MLB', 'NHL'], correctIndex: 1, category: 'reglas', sport: 'basketball', difficulty: 1 },
  { id: 'bk024', question: '¿Qué jugador de los Lakers fue apodado "Black Mamba"?', options: ['Kobe Bryant', 'Allen Iverson', 'Tracy McGrady', 'Vince Carter'], correctIndex: 0, category: 'jugadores', sport: 'basketball', difficulty: 1 },
  { id: 'bk025', question: '¿Cuántos segundos tiene un equipo para lanzar a canasta en la NBA?', options: ['24', '30', '35', '45'], correctIndex: 0, category: 'reglas', sport: 'basketball', difficulty: 2 },
  { id: 'bk026', question: '¿Qué jugador fue MVP de las Finales 2023 con los Denver Nuggets?', options: ['Jamal Murray', 'Nikola Jokić', 'Aaron Gordon', 'Michael Porter Jr.'], correctIndex: 1, category: 'jugadores', sport: 'basketball', difficulty: 3 },
  { id: 'bk027', question: '¿De qué país es Luka Dončić?', options: ['Croacia', 'Eslovenia', 'Serbia', 'Montenegro'], correctIndex: 1, category: 'jugadores', sport: 'basketball', difficulty: 2 },
  { id: 'bk028', question: '¿Qué pívot dominó los años 90 con los Houston Rockets, ganando dos anillos?', options: ['Hakeem Olajuwon', 'Patrick Ewing', 'David Robinson', 'Shaquille O’Neal'], correctIndex: 0, category: 'jugadores', sport: 'basketball', difficulty: 3 },
  { id: 'bk029', question: '¿Qué infracción se comete al avanzar con el balón sin botarlo?', options: ['Falta personal', 'Pasos', 'Tres segundos', 'Campo atrás'], correctIndex: 1, category: 'reglas', sport: 'basketball', difficulty: 1 },
  { id: 'bk030', question: '¿Qué entrenador ganó 11 anillos de la NBA dirigiendo a Bulls y Lakers?', options: ['Phil Jackson', 'Gregg Popovich', 'Pat Riley', 'Red Auerbach'], correctIndex: 0, category: 'historia', sport: 'basketball', difficulty: 3 },
  { id: 'bk031', question: '¿Qué jugador de los Lakers fue apodado "Magic"?', options: ['Larry Bird', 'Earvin Johnson', 'Isiah Thomas', 'James Worthy'], correctIndex: 1, category: 'jugadores', sport: 'basketball', difficulty: 2 },
  { id: 'bk032', question: '¿Qué selección ganó la plata olímpica en Pekín 2008 y Londres 2012, solo por detrás de EE. UU.?', options: ['Argentina', 'España', 'Francia', 'Lituania'], correctIndex: 1, category: 'selecciones', sport: 'basketball', difficulty: 3 },
  { id: 'bk033', question: '¿Cuántos puntos vale una canasta normal dentro de la línea de 6,75?', options: ['1', '2', '3', '4'], correctIndex: 1, category: 'reglas', sport: 'basketball', difficulty: 1 },
  { id: 'bk034', question: '¿Qué equipo logró el primer "three-peat" de los Chicago Bulls (1991-1993)?', options: ['Chicago Bulls', 'Detroit Pistons', 'Los Angeles Lakers', 'Boston Celtics'], correctIndex: 0, category: 'historia', sport: 'basketball', difficulty: 2 },
  { id: 'bk035', question: '¿Qué evento reúne a las estrellas de la NBA a mitad de temporada?', options: ['All-Star Game', 'Draft', 'Summer League', 'Playoffs'], correctIndex: 0, category: 'reglas', sport: 'basketball', difficulty: 1 },

  // ═══════════════════════════════════════════════════════════════
  // TENIS (6A)
  // ═══════════════════════════════════════════════════════════════
  { id: 'tn001', question: '¿Cuántos Grand Slams ganó Roger Federer?', options: ['17', '18', '20', '22'], correctIndex: 2, category: 'records', sport: 'tennis', difficulty: 1 },
  { id: 'tn002', question: '¿En qué superficie se juega Roland Garros?', options: ['Hierba', 'Tierra batida', 'Cemento', 'Moqueta'], correctIndex: 1, category: 'reglas', sport: 'tennis', difficulty: 1 },
  { id: 'tn003', question: '¿Quién tiene el récord masculino de más Grand Slams?', options: ['Roger Federer', 'Rafael Nadal', 'Novak Djokovic', 'Pete Sampras'], correctIndex: 2, category: 'records', sport: 'tennis', difficulty: 1 },
  { id: 'tn004', question: '¿Cuántos Wimbledon ganó Roger Federer, récord masculino?', options: ['6', '7', '8', '9'], correctIndex: 2, category: 'records', sport: 'tennis', difficulty: 2 },
  { id: 'tn005', question: '¿Qué tenista ganó el Open de Australia 2024?', options: ['Novak Djokovic', 'Jannik Sinner', 'Daniil Medvedev', 'Carlos Alcaraz'], correctIndex: 1, category: 'records', sport: 'tennis', difficulty: 2 },
  { id: 'tn006', question: '¿De qué país es Carlos Alcaraz?', options: ['Argentina', 'España', 'Italia', 'Serbia'], correctIndex: 1, category: 'jugadores', sport: 'tennis', difficulty: 1 },
  { id: 'tn007', question: '¿Quién ganó Wimbledon 2023 batiendo a Djokovic en la final?', options: ['Daniil Medvedev', 'Carlos Alcaraz', 'Jannik Sinner', 'Stefanos Tsitsipas'], correctIndex: 1, category: 'records', sport: 'tennis', difficulty: 2 },
  { id: 'tn008', question: '¿Cuántos Grand Slams ganó Serena Williams?', options: ['21', '22', '23', '24'], correctIndex: 2, category: 'records', sport: 'tennis', difficulty: 2 },
  { id: 'tn009', question: '¿Qué tenista alemana ganó 22 Grand Slams y el Golden Slam en 1988?', options: ['Martina Hingis', 'Steffi Graf', 'Monica Seles', 'Martina Navratilova'], correctIndex: 1, category: 'historia', sport: 'tennis', difficulty: 3 },
  { id: 'tn010', question: '¿Cómo se llama el torneo por equipos nacionales masculino de tenis?', options: ['Copa Davis', 'Copa Federación', 'Laver Cup', 'Copa Hopman'], correctIndex: 0, category: 'reglas', sport: 'tennis', difficulty: 1 },
  { id: 'tn011', question: '¿En qué ciudad se juega el US Open?', options: ['Melbourne', 'Nueva York', 'Londres', 'París'], correctIndex: 1, category: 'reglas', sport: 'tennis', difficulty: 1 },
  { id: 'tn012', question: '¿Cuál de estos NO es un torneo de Grand Slam?', options: ['Wimbledon', 'Roland Garros', 'Masters de Madrid', 'US Open'], correctIndex: 2, category: 'reglas', sport: 'tennis', difficulty: 2 },
  { id: 'tn013', question: '¿Qué tenista es apodado "el Rey de la Tierra batida"?', options: ['Novak Djokovic', 'Rafael Nadal', 'Roger Federer', 'Björn Borg'], correctIndex: 1, category: 'jugadores', sport: 'tennis', difficulty: 1 },
  { id: 'tn014', question: '¿Cuántos sets debe ganar un hombre para llevarse un partido de Grand Slam?', options: ['1', '2', '3', '4'], correctIndex: 2, category: 'reglas', sport: 'tennis', difficulty: 2 },
  { id: 'tn015', question: '¿Qué término describe un saque ganador que el rival no llega a tocar?', options: ['Ace', 'Drive', 'Passing', 'Drop shot'], correctIndex: 0, category: 'reglas', sport: 'tennis', difficulty: 1 },
  { id: 'tn016', question: '¿Quién ganó el oro olímpico de tenis individual masculino en París 2024?', options: ['Carlos Alcaraz', 'Novak Djokovic', 'Rafael Nadal', 'Stefanos Tsitsipas'], correctIndex: 1, category: 'records', sport: 'tennis', difficulty: 3 },
  { id: 'tn017', question: '¿Qué tenista estadounidense ganó 14 Grand Slams y dominó los años 90?', options: ['Andre Agassi', 'Pete Sampras', 'Jim Courier', 'John McEnroe'], correctIndex: 1, category: 'historia', sport: 'tennis', difficulty: 2 },
  { id: 'tn018', question: '¿Cómo se llama el desempate que se juega al llegar a 6-6 en un set?', options: ['Tie-break', 'Deuce', 'Ventaja', 'Break'], correctIndex: 0, category: 'reglas', sport: 'tennis', difficulty: 2 },
  { id: 'tn019', question: '¿Qué tenista belga ganó 4 Grand Slams y volvió a ser número 1 tras ser madre?', options: ['Justine Henin', 'Kim Clijsters', 'Amélie Mauresmo', 'Jelena Janković'], correctIndex: 1, category: 'historia', sport: 'tennis', difficulty: 3 },
  { id: 'tn020', question: '¿De qué país es Novak Djokovic?', options: ['Croacia', 'Serbia', 'Rusia', 'Bosnia'], correctIndex: 1, category: 'jugadores', sport: 'tennis', difficulty: 1 },
  { id: 'tn021', question: '¿Qué tenista rusa ganó 5 Grand Slams y se retiró en 2020?', options: ['Maria Sharapova', 'Anna Kournikova', 'Svetlana Kuznetsova', 'Dinara Safina'], correctIndex: 0, category: 'jugadores', sport: 'tennis', difficulty: 3 },
  { id: 'tn022', question: '¿Quién ganó el US Open 2024 masculino?', options: ['Jannik Sinner', 'Taylor Fritz', 'Carlos Alcaraz', 'Alexander Zverev'], correctIndex: 0, category: 'records', sport: 'tennis', difficulty: 3 },
  { id: 'tn023', question: '¿Cuál de estas superficies de tenis es tradicionalmente la más rápida?', options: ['Tierra batida', 'Hierba', 'Cemento', 'Arcilla'], correctIndex: 1, category: 'reglas', sport: 'tennis', difficulty: 2 },
  { id: 'tn024', question: '¿Cómo se llama el Masters de fin de año del circuito ATP?', options: ['ATP Finals', 'Copa Davis', 'Roland Garros', 'Indian Wells'], correctIndex: 0, category: 'reglas', sport: 'tennis', difficulty: 2 },
  { id: 'tn025', question: '¿Qué tenista sueco ganó 11 Grand Slams y 5 Wimbledon consecutivos?', options: ['Stefan Edberg', 'Björn Borg', 'Mats Wilander', 'Robin Söderling'], correctIndex: 1, category: 'historia', sport: 'tennis', difficulty: 3 },
  { id: 'tn026', question: '¿Qué tenista estadounidense ganó múltiples Slams junto a su hermana Serena en dobles?', options: ['Venus Williams', 'Martina Hingis', 'Lindsay Davenport', 'Jennifer Capriati'], correctIndex: 0, category: 'jugadores', sport: 'tennis', difficulty: 2 },
  { id: 'tn027', question: '¿Cuántos torneos forman el Grand Slam de calendario?', options: ['3', '4', '5', '2'], correctIndex: 1, category: 'reglas', sport: 'tennis', difficulty: 1 },
  { id: 'tn028', question: '¿Qué tenista español fue número 1 del mundo y ganó Roland Garros 1998?', options: ['Sergi Bruguera', 'Carlos Moyá', 'Albert Costa', 'Juan Carlos Ferrero'], correctIndex: 1, category: 'jugadores', sport: 'tennis', difficulty: 3 },
  { id: 'tn029', question: '¿Qué tenista suizo, famoso por su elegancia, ganó 20 Grand Slams?', options: ['Stan Wawrinka', 'Roger Federer', 'Marc Rosset', 'Heinz Günthardt'], correctIndex: 1, category: 'jugadores', sport: 'tennis', difficulty: 1 },
  { id: 'tn030', question: '¿Qué Grand Slam se juega sobre hierba en Londres?', options: ['Roland Garros', 'Wimbledon', 'US Open', 'Open de Australia'], correctIndex: 1, category: 'reglas', sport: 'tennis', difficulty: 1 },
  { id: 'tn031', question: '¿Qué tenista italiano ganó el Open de Australia y el US Open en 2024?', options: ['Lorenzo Musetti', 'Jannik Sinner', 'Matteo Berrettini', 'Fabio Fognini'], correctIndex: 1, category: 'jugadores', sport: 'tennis', difficulty: 2 },
  { id: 'tn032', question: '¿Cómo se llama ganar un juego al resto, rompiendo el servicio del rival?', options: ['Break', 'Ace', 'Tie-break', 'Smash'], correctIndex: 0, category: 'reglas', sport: 'tennis', difficulty: 1 },
  { id: 'tn033', question: '¿Quién ostenta el récord absoluto de Grand Slams, con 24 (incluida la era amateur)?', options: ['Steffi Graf', 'Margaret Court', 'Serena Williams', 'Martina Navratilova'], correctIndex: 1, category: 'records', sport: 'tennis', difficulty: 3 },

  // ═══════════════════════════════════════════════════════════════
  // MOTOR — F1 y MotoGP (6A)
  // ═══════════════════════════════════════════════════════════════
  { id: 'mt001', question: '¿Cuántos campeonatos del mundo de F1 ganó Michael Schumacher?', options: ['5', '6', '7', '8'], correctIndex: 2, category: 'records', sport: 'motor', difficulty: 1 },
  { id: 'mt002', question: '¿Qué piloto británico igualó el récord de 7 títulos de F1?', options: ['Lewis Hamilton', 'Jenson Button', 'Nigel Mansell', 'George Russell'], correctIndex: 0, category: 'records', sport: 'motor', difficulty: 1 },
  { id: 'mt003', question: '¿Cuántos títulos del mundo de F1 ganó Fernando Alonso?', options: ['1', '2', '3', '4'], correctIndex: 1, category: 'records', sport: 'motor', difficulty: 1 },
  { id: 'mt004', question: '¿Con qué escudería ganó Fernando Alonso sus dos títulos de F1?', options: ['Ferrari', 'Renault', 'McLaren', 'Aston Martin'], correctIndex: 1, category: 'historia', sport: 'motor', difficulty: 2 },
  { id: 'mt005', question: '¿Qué piloto neerlandés ganó los Mundiales de F1 de 2021 a 2024?', options: ['Max Verstappen', 'Sergio Pérez', 'Lando Norris', 'Charles Leclerc'], correctIndex: 0, category: 'records', sport: 'motor', difficulty: 1 },
  { id: 'mt006', question: '¿Cuántos títulos consecutivos de F1 ganó Sebastian Vettel con Red Bull (2010-2013)?', options: ['2', '3', '4', '5'], correctIndex: 2, category: 'records', sport: 'motor', difficulty: 2 },
  { id: 'mt007', question: '¿Qué piloto argentino ganó 5 títulos de F1 en los años 50?', options: ['Juan Manuel Fangio', 'Carlos Reutemann', 'José Froilán González', 'Carlos Pace'], correctIndex: 0, category: 'historia', sport: 'motor', difficulty: 2 },
  { id: 'mt008', question: '¿Qué escudería es la más laureada de la historia de la F1?', options: ['Mercedes', 'Ferrari', 'McLaren', 'Red Bull'], correctIndex: 1, category: 'records', sport: 'motor', difficulty: 2 },
  { id: 'mt009', question: '¿En qué circuito se corre el Gran Premio de Mónaco?', options: ['Montecarlo', 'Monza', 'Silverstone', 'Spa-Francorchamps'], correctIndex: 0, category: 'reglas', sport: 'motor', difficulty: 1 },
  { id: 'mt010', question: '¿Qué bandera indica el final de una carrera de F1?', options: ['Roja', 'A cuadros', 'Amarilla', 'Azul'], correctIndex: 1, category: 'reglas', sport: 'motor', difficulty: 1 },
  { id: 'mt011', question: '¿Cuántos campeonatos del mundo ganó Valentino Rossi en total?', options: ['7', '8', '9', '10'], correctIndex: 2, category: 'records', sport: 'motor', difficulty: 2 },
  { id: 'mt012', question: '¿Cuántos títulos de MotoGP (categoría reina) ganó Marc Márquez entre 2013 y 2019?', options: ['4', '5', '6', '7'], correctIndex: 2, category: 'records', sport: 'motor', difficulty: 3 },
  { id: 'mt013', question: '¿De qué país es el piloto de MotoGP Marc Márquez?', options: ['Italia', 'España', 'Francia', 'Portugal'], correctIndex: 1, category: 'jugadores', sport: 'motor', difficulty: 1 },
  { id: 'mt014', question: '¿Qué piloto español ganó el Mundial de MotoGP en 2010, 2012 y 2015?', options: ['Dani Pedrosa', 'Jorge Lorenzo', 'Álex Rins', 'Maverick Viñales'], correctIndex: 1, category: 'jugadores', sport: 'motor', difficulty: 3 },
  { id: 'mt015', question: '¿Qué marca italiana domina MotoGP en los últimos años de la mano de Bagnaia?', options: ['Yamaha', 'Ducati', 'Honda', 'Aprilia'], correctIndex: 1, category: 'clubes', sport: 'motor', difficulty: 2 },
  { id: 'mt016', question: '¿Qué piloto ganó el Mundial de MotoGP en 2022 y 2023?', options: ['Fabio Quartararo', 'Francesco Bagnaia', 'Jorge Martín', 'Marc Márquez'], correctIndex: 1, category: 'records', sport: 'motor', difficulty: 3 },
  { id: 'mt017', question: '¿Qué piloto tiene el récord de más victorias en la historia de la F1?', options: ['Lewis Hamilton', 'Michael Schumacher', 'Sebastian Vettel', 'Ayrton Senna'], correctIndex: 0, category: 'records', sport: 'motor', difficulty: 2 },
  { id: 'mt018', question: '¿Qué circuito italiano es conocido como "el templo de la velocidad"?', options: ['Monza', 'Imola', 'Mugello', 'Misano'], correctIndex: 0, category: 'historia', sport: 'motor', difficulty: 2 },
  { id: 'mt019', question: '¿Cuántos pilotos compiten por cada escudería en un Gran Premio de F1?', options: ['1', '2', '3', '4'], correctIndex: 1, category: 'reglas', sport: 'motor', difficulty: 1 },
  { id: 'mt020', question: '¿Qué piloto alemán ganó títulos de F1 con Benetton y con Ferrari?', options: ['Sebastian Vettel', 'Michael Schumacher', 'Nico Rosberg', 'Ralf Schumacher'], correctIndex: 1, category: 'historia', sport: 'motor', difficulty: 2 },
  { id: 'mt021', question: '¿Qué piloto finlandés fue campeón de F1 en 2007 con Ferrari?', options: ['Mika Häkkinen', 'Kimi Räikkönen', 'Valtteri Bottas', 'Heikki Kovalainen'], correctIndex: 1, category: 'historia', sport: 'motor', difficulty: 3 },
  { id: 'mt022', question: '¿De qué país es Max Verstappen?', options: ['Bélgica', 'Países Bajos', 'Alemania', 'Austria'], correctIndex: 1, category: 'jugadores', sport: 'motor', difficulty: 1 },
  { id: 'mt023', question: '¿Cuál es la categoría reina del motociclismo de velocidad?', options: ['Moto3', 'Moto2', 'MotoGP', 'Superbike'], correctIndex: 2, category: 'reglas', sport: 'motor', difficulty: 1 },
  { id: 'mt024', question: '¿Qué piloto británico ganó su primer título de F1 en 2008 con McLaren?', options: ['Lewis Hamilton', 'Jenson Button', 'David Coulthard', 'Damon Hill'], correctIndex: 0, category: 'historia', sport: 'motor', difficulty: 2 },
  { id: 'mt025', question: '¿Qué legendario piloto brasileño falleció en el circuito de Imola en 1994?', options: ['Nelson Piquet', 'Ayrton Senna', 'Rubens Barrichello', 'Emerson Fittipaldi'], correctIndex: 1, category: 'historia', sport: 'motor', difficulty: 2 },

  // ═══════════════════════════════════════════════════════════════
  // MMA / UFC (6A)
  // ═══════════════════════════════════════════════════════════════
  { id: 'mm001', question: '¿En qué año se fundó la UFC?', options: ['1985', '1993', '2001', '1996'], correctIndex: 1, category: 'historia', sport: 'mma', difficulty: 2 },
  { id: 'mm002', question: '¿Cómo se llama el recinto de combate de la UFC?', options: ['El ring', 'El octágono', 'El tatami', 'El cuadrilátero'], correctIndex: 1, category: 'reglas', sport: 'mma', difficulty: 1 },
  { id: 'mm003', question: '¿Qué luchador irlandés fue el primero en tener dos cinturones de la UFC a la vez?', options: ['Conor McGregor', 'Michael Bisping', 'Khabib Nurmagomedov', 'Jon Jones'], correctIndex: 0, category: 'historia', sport: 'mma', difficulty: 2 },
  { id: 'mm004', question: '¿Qué luchador ruso se retiró invicto (29-0) siendo campeón de peso ligero?', options: ['Khabib Nurmagomedov', 'Islam Makhachev', 'Fedor Emelianenko', 'Petr Yan'], correctIndex: 0, category: 'jugadores', sport: 'mma', difficulty: 2 },
  { id: 'mm005', question: '¿Qué peleadora estadounidense fue la gran estrella del peso gallo femenino hasta 2015?', options: ['Amanda Nunes', 'Ronda Rousey', 'Holly Holm', 'Valentina Shevchenko'], correctIndex: 1, category: 'jugadores', sport: 'mma', difficulty: 3 },
  { id: 'mm006', question: '¿Qué luchador dominó el peso semipesado y es considerado de los mejores libra por libra?', options: ['Israel Adesanya', 'Jon Jones', 'Daniel Cormier', 'Stipe Miocic'], correctIndex: 1, category: 'jugadores', sport: 'mma', difficulty: 2 },
  { id: 'mm007', question: '¿De qué país es Conor McGregor?', options: ['Inglaterra', 'Irlanda', 'Escocia', 'Australia'], correctIndex: 1, category: 'jugadores', sport: 'mma', difficulty: 1 },
  { id: 'mm008', question: '¿Qué brasileña fue doble campeona de la UFC y dominó el peso gallo?', options: ['Amanda Nunes', 'Cris Cyborg', 'Jéssica Andrade', 'Mackenzie Dern'], correctIndex: 0, category: 'jugadores', sport: 'mma', difficulty: 3 },
  { id: 'mm009', question: '¿Qué significa "KO" en los deportes de combate?', options: ['Knockout (fuera de combate)', 'Knock open', 'Keep on', 'Kick out'], correctIndex: 0, category: 'reglas', sport: 'mma', difficulty: 1 },
  { id: 'mm010', question: '¿Cómo se llama la victoria lograda al forzar al rival a rendirse con una llave?', options: ['Sumisión', 'Decisión', 'Nocaut', 'Descalificación'], correctIndex: 0, category: 'reglas', sport: 'mma', difficulty: 1 },
  { id: 'mm011', question: '¿Qué canadiense, leyenda de la UFC, fue campeón del peso wélter?', options: ['Georges St-Pierre', 'Rory MacDonald', 'Patrick Côté', 'Tristan Connelly'], correctIndex: 0, category: 'jugadores', sport: 'mma', difficulty: 2 },
  { id: 'mm012', question: '¿Qué luchador brasileño tuvo una de las rachas de defensas de título más largas en el peso medio?', options: ['Anderson Silva', 'Vitor Belfort', 'Lyoto Machida', 'José Aldo'], correctIndex: 0, category: 'historia', sport: 'mma', difficulty: 3 },
  { id: 'mm013', question: '¿Qué deporte combina lucha, boxeo y artes marciales dentro de una jaula?', options: ['Boxeo', 'MMA', 'Kickboxing', 'Judo'], correctIndex: 1, category: 'reglas', sport: 'mma', difficulty: 1 },
  { id: 'mm014', question: '¿Qué luchadora es considerada de las mejores del peso mosca femenino de la UFC?', options: ['Rose Namajunas', 'Valentina Shevchenko', 'Zhang Weili', 'Joanna Jędrzejczyk'], correctIndex: 1, category: 'jugadores', sport: 'mma', difficulty: 3 },
  { id: 'mm015', question: '¿Cuántos minutos dura cada asalto en un combate de la UFC?', options: ['3', '5', '10', '12'], correctIndex: 1, category: 'reglas', sport: 'mma', difficulty: 2 },

  // ═══════════════════════════════════════════════════════════════
  // GOLF (6A)
  // ═══════════════════════════════════════════════════════════════
  { id: 'gf001', question: '¿Quién ostenta el récord de más "majors" en el golf masculino?', options: ['Tiger Woods', 'Jack Nicklaus', 'Arnold Palmer', 'Gary Player'], correctIndex: 1, category: 'records', sport: 'golf', difficulty: 2 },
  { id: 'gf002', question: '¿Cuántos "majors" ha ganado Tiger Woods?', options: ['12', '14', '15', '18'], correctIndex: 2, category: 'records', sport: 'golf', difficulty: 2 },
  { id: 'gf003', question: '¿En qué campo se juega siempre el Masters de golf?', options: ['Augusta National', 'Pebble Beach', 'St Andrews', 'Pinehurst'], correctIndex: 0, category: 'reglas', sport: 'golf', difficulty: 2 },
  { id: 'gf004', question: '¿Cuál de estos es uno de los cuatro "majors" del golf?', options: ['Ryder Cup', 'The Masters', 'Copa del Mundo', 'The Players'], correctIndex: 1, category: 'reglas', sport: 'golf', difficulty: 2 },
  { id: 'gf005', question: '¿Qué golfista español, leyenda del deporte, ganó 5 "majors"?', options: ['Sergio García', 'Severiano Ballesteros', 'José María Olazábal', 'Jon Rahm'], correctIndex: 1, category: 'historia', sport: 'golf', difficulty: 3 },
  { id: 'gf006', question: '¿Qué golfista español ganó el Masters de Augusta en 2023?', options: ['Sergio García', 'Jon Rahm', 'José María Olazábal', 'Rafael Cabrera-Bello'], correctIndex: 1, category: 'jugadores', sport: 'golf', difficulty: 3 },
  { id: 'gf007', question: '¿Cómo se llama meter la bola en el hoyo de un solo golpe desde la salida?', options: ['Birdie', 'Hoyo en uno', 'Eagle', 'Par'], correctIndex: 1, category: 'reglas', sport: 'golf', difficulty: 1 },
  { id: 'gf008', question: '¿Qué término significa terminar un hoyo con un golpe bajo el par?', options: ['Bogey', 'Birdie', 'Par', 'Doble bogey'], correctIndex: 1, category: 'reglas', sport: 'golf', difficulty: 2 },
  { id: 'gf009', question: '¿Cómo se llama la competición de golf por equipos entre Europa y Estados Unidos?', options: ['Ryder Cup', 'Copa Davis', 'Presidents Cup', 'Solheim Cup'], correctIndex: 0, category: 'reglas', sport: 'golf', difficulty: 2 },

  // ═══════════════════════════════════════════════════════════════
  // CICLISMO (6A)
  // ═══════════════════════════════════════════════════════════════
  { id: 'cy001', question: '¿Cuál es la carrera ciclista por etapas más famosa del mundo?', options: ['Giro de Italia', 'Tour de Francia', 'Vuelta a España', 'París-Roubaix'], correctIndex: 1, category: 'reglas', sport: 'cycling', difficulty: 1 },
  { id: 'cy002', question: '¿Qué ciclista español ganó 5 Tours de Francia consecutivos (1991-1995)?', options: ['Alberto Contador', 'Miguel Induráin', 'Pedro Delgado', 'Óscar Pereiro'], correctIndex: 1, category: 'historia', sport: 'cycling', difficulty: 2 },
  { id: 'cy003', question: '¿De qué color es el maillot del líder del Tour de Francia?', options: ['Verde', 'Amarillo', 'De lunares', 'Blanco'], correctIndex: 1, category: 'reglas', sport: 'cycling', difficulty: 1 },
  { id: 'cy004', question: '¿Qué ciclista belga, apodado "El Caníbal", ganó 5 Tours de Francia?', options: ['Eddy Merckx', 'Tom Boonen', 'Philippe Gilbert', 'Greg Van Avermaet'], correctIndex: 0, category: 'historia', sport: 'cycling', difficulty: 2 },
  { id: 'cy005', question: '¿De qué país es el ciclista Tadej Pogačar?', options: ['Croacia', 'Eslovenia', 'Italia', 'Colombia'], correctIndex: 1, category: 'jugadores', sport: 'cycling', difficulty: 2 },
  { id: 'cy006', question: '¿Cómo se llama la gran vuelta ciclista por etapas de Italia?', options: ['Giro de Italia', 'Tour de Italia', 'Vuelta a Italia', 'Tirreno-Adriático'], correctIndex: 0, category: 'reglas', sport: 'cycling', difficulty: 1 },
  { id: 'cy007', question: '¿Qué maillot premia al mejor escalador en el Tour de Francia?', options: ['Verde', 'Amarillo', 'De lunares rojos', 'Blanco'], correctIndex: 2, category: 'reglas', sport: 'cycling', difficulty: 2 },
  { id: 'cy008', question: '¿Qué ciclista español ganó dos Tours de Francia (2007 y 2009)?', options: ['Alejandro Valverde', 'Alberto Contador', 'Joaquim Rodríguez', 'Carlos Sastre'], correctIndex: 1, category: 'jugadores', sport: 'cycling', difficulty: 3 },
  { id: 'cy009', question: '¿Cuántas "grandes vueltas" hay en el ciclismo (Tour, Giro y Vuelta)?', options: ['2', '3', '4', '5'], correctIndex: 1, category: 'reglas', sport: 'cycling', difficulty: 1 },
  { id: 'cy010', question: '¿Qué español ganó el Tour de Francia 2006 tras la descalificación de Floyd Landis?', options: ['Carlos Sastre', 'Óscar Pereiro', 'Alejandro Valverde', 'Joseba Beloki'], correctIndex: 1, category: 'historia', sport: 'cycling', difficulty: 3 },
  { id: 'cy011', question: '¿En qué país termina tradicionalmente el Tour de Francia, en los Campos Elíseos?', options: ['Bélgica', 'Francia', 'Suiza', 'Italia'], correctIndex: 1, category: 'reglas', sport: 'cycling', difficulty: 1 },

  // ═══════════════════════════════════════════════════════════════
  // GENERAL — multideporte (6A)
  // ═══════════════════════════════════════════════════════════════
  { id: 'gn001', question: '¿Cada cuántos años se celebran los Juegos Olímpicos de verano?', options: ['2', '3', '4', '5'], correctIndex: 2, category: 'reglas', sport: 'general', difficulty: 1 },
  { id: 'gn002', question: '¿Qué nadador estadounidense ganó 23 oros olímpicos, récord histórico?', options: ['Mark Spitz', 'Michael Phelps', 'Caeleb Dressel', 'Ryan Lochte'], correctIndex: 1, category: 'records', sport: 'general', difficulty: 1 },
  { id: 'gn003', question: '¿Qué velocista jamaicano posee el récord mundial de los 100 metros (9,58 s)?', options: ['Usain Bolt', 'Yohan Blake', 'Tyson Gay', 'Asafa Powell'], correctIndex: 0, category: 'records', sport: 'general', difficulty: 1 },
  { id: 'gn004', question: '¿En qué ciudad se celebraron los Juegos Olímpicos de 2024?', options: ['Tokio', 'París', 'Los Ángeles', 'Río de Janeiro'], correctIndex: 1, category: 'historia', sport: 'general', difficulty: 1 },
  { id: 'gn005', question: '¿Qué boxeador venció a George Foreman en "la pelea del siglo" en Zaire (1974)?', options: ['Mike Tyson', 'Muhammad Ali', 'Joe Frazier', 'Floyd Mayweather'], correctIndex: 1, category: 'historia', sport: 'general', difficulty: 2 },
  { id: 'gn006', question: '¿Qué boxeador fue el campeón mundial de los pesos pesados más joven, con 20 años?', options: ['Mike Tyson', 'Muhammad Ali', 'Evander Holyfield', 'Lennox Lewis'], correctIndex: 0, category: 'records', sport: 'general', difficulty: 2 },
  { id: 'gn007', question: '¿Qué boxeador estadounidense se retiró invicto con un récord de 50-0?', options: ['Floyd Mayweather', 'Manny Pacquiao', 'Canelo Álvarez', 'Oscar de la Hoya'], correctIndex: 0, category: 'records', sport: 'general', difficulty: 2 },
  { id: 'gn008', question: '¿En qué deporte destacó Tom Brady, ganador de 7 Super Bowls?', options: ['Béisbol', 'Fútbol americano', 'Baloncesto', 'Hockey hielo'], correctIndex: 1, category: 'jugadores', sport: 'general', difficulty: 1 },
  { id: 'gn009', question: '¿Cómo se llama el partido por el título de la NFL?', options: ['Super Bowl', 'World Series', 'Stanley Cup', 'Final Four'], correctIndex: 0, category: 'reglas', sport: 'general', difficulty: 1 },
  { id: 'gn010', question: '¿Cuántos jugadores por equipo hay en el campo en el fútbol americano?', options: ['9', '10', '11', '12'], correctIndex: 2, category: 'reglas', sport: 'general', difficulty: 2 },
  { id: 'gn011', question: '¿Qué país domina históricamente el rugby con los "All Blacks"?', options: ['Australia', 'Nueva Zelanda', 'Sudáfrica', 'Inglaterra'], correctIndex: 1, category: 'selecciones', sport: 'general', difficulty: 2 },
  { id: 'gn012', question: '¿Qué danza realizan los All Blacks antes de sus partidos?', options: ['Haka', 'Samba', 'Sirtaki', 'Flamenco'], correctIndex: 0, category: 'historia', sport: 'general', difficulty: 2 },
  { id: 'gn013', question: '¿Cuántos puntos vale un "ensayo" (try) en el rugby unión?', options: ['3', '5', '7', '2'], correctIndex: 1, category: 'reglas', sport: 'general', difficulty: 3 },
  { id: 'gn014', question: '¿En qué estilo de natación se nada boca arriba?', options: ['Mariposa', 'Espalda', 'Braza', 'Crol'], correctIndex: 1, category: 'reglas', sport: 'general', difficulty: 2 },
  { id: 'gn015', question: '¿En qué deporte fue campeón olímpico y mundial Usain Bolt?', options: ['Natación', 'Atletismo', 'Ciclismo', 'Boxeo'], correctIndex: 1, category: 'jugadores', sport: 'general', difficulty: 1 },
  { id: 'gn016', question: '¿Cuál es la distancia oficial de una maratón?', options: ['21,1 km', '42,195 km', '50 km', '100 km'], correctIndex: 1, category: 'reglas', sport: 'general', difficulty: 2 },
  { id: 'gn017', question: '¿Qué país ganó más medallas en total en los Juegos de París 2024?', options: ['China', 'Estados Unidos', 'Francia', 'Gran Bretaña'], correctIndex: 1, category: 'records', sport: 'general', difficulty: 3 },
  { id: 'gn018', question: '¿Cómo se llama el trofeo que levanta el campeón del Mundial de rugby?', options: ['Copa Webb Ellis', 'Copa Jules Rimet', 'Copa Davis', 'Copa Heineken'], correctIndex: 0, category: 'historia', sport: 'general', difficulty: 3 },
  { id: 'gn019', question: '¿En qué deporte se disputa la prueba de los "100 metros lisos"?', options: ['Natación', 'Atletismo', 'Ciclismo', 'Remo'], correctIndex: 1, category: 'reglas', sport: 'general', difficulty: 1 },
  { id: 'gn020', question: '¿Cuántos asaltos como máximo tiene un combate de boxeo por un título mundial?', options: ['10', '12', '15', '8'], correctIndex: 1, category: 'reglas', sport: 'general', difficulty: 2 },
  { id: 'gn021', question: '¿En qué país se disputa la liga de fútbol americano NFL?', options: ['Canadá', 'Estados Unidos', 'México', 'Reino Unido'], correctIndex: 1, category: 'reglas', sport: 'general', difficulty: 1 },
  { id: 'gn022', question: '¿Qué equipo ganó la Super Bowl de febrero de 2024?', options: ['San Francisco 49ers', 'Kansas City Chiefs', 'Philadelphia Eagles', 'Baltimore Ravens'], correctIndex: 1, category: 'records', sport: 'general', difficulty: 3 },
  { id: 'gn023', question: '¿Qué mariscal de campo (QB) de los Chiefs ha ganado varios Super Bowls?', options: ['Josh Allen', 'Patrick Mahomes', 'Joe Burrow', 'Jalen Hurts'], correctIndex: 1, category: 'jugadores', sport: 'general', difficulty: 2 },
  { id: 'gn024', question: '¿Qué disciplina olímpica combina esquí de fondo y tiro?', options: ['Biatlón', 'Triatlón', 'Pentatlón', 'Decatlón'], correctIndex: 0, category: 'reglas', sport: 'general', difficulty: 3 },
  { id: 'gn025', question: '¿Cuántas disciplinas componen un triatlón clásico?', options: ['2', '3', '4', '5'], correctIndex: 1, category: 'reglas', sport: 'general', difficulty: 2 },
  { id: 'gn026', question: '¿Qué selección ganó el primer Mundial de rugby, en 1987?', options: ['Australia', 'Nueva Zelanda', 'Sudáfrica', 'Inglaterra'], correctIndex: 1, category: 'historia', sport: 'general', difficulty: 3 },
  { id: 'gn027', question: '¿Qué selección ganó el Mundial de rugby 2023?', options: ['Nueva Zelanda', 'Sudáfrica', 'Inglaterra', 'Irlanda'], correctIndex: 1, category: 'selecciones', sport: 'general', difficulty: 3 },
  { id: 'gn028', question: '¿Qué prueba de atletismo combina 10 disciplinas?', options: ['Heptatlón', 'Decatlón', 'Pentatlón', 'Triatlón'], correctIndex: 1, category: 'reglas', sport: 'general', difficulty: 2 },
]

/** Deterministic shuffle using mulberry32 PRNG */
function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Returns today's ISO date string YYYY-MM-DD */
export function todayKey(): string {
  return madridDayISO()
}

/** Barajado uniforme (Fisher-Yates) con PRNG sembrado. Sustituye al viejo
 *  `sort(() => rand()-0.5)`, que es sesgado y no determinista de forma fiable. */
function seededShuffle<T>(arr: readonly T[], rand: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Compone una ronda a partir de un pool ya barajado, USANDO el campo
 * `difficulty`:
 *   · curva de dificultad ≈ 40% fácil (1), 40% media (2), 20% difícil (3),
 *   · variedad de deporte (tope ~60% de fútbol) para que no salga monotemática,
 *   · orden final ascendente por dificultad → la ronda "calienta".
 * Es tolerante: si una cuota no se llena (pool pequeño o muy sesgado),
 * completa con lo que haya manteniendo la unicidad.
 */
function composeRound(shuffled: QuizQuestion[], count: number): QuizQuestion[] {
  const wantHard = Math.round(count * 0.2)
  const wantEasy = Math.round(count * 0.4)
  const quota: Record<QuizDifficulty, number> = { 1: wantEasy, 2: count - wantEasy - wantHard, 3: wantHard }
  const maxFootball = Math.max(1, Math.round(count * 0.6))

  const picked: QuizQuestion[] = []
  const used = new Set<string>()
  let football = 0

  // 1ª pasada: respeta la cuota de dificultad y el tope de fútbol.
  for (const q of shuffled) {
    if (picked.length >= count) break
    if (quota[q.difficulty] <= 0) continue
    if (q.sport === 'football' && football >= maxFootball) continue
    picked.push(q); used.add(q.id); quota[q.difficulty]--
    if (q.sport === 'football') football++
  }
  // 2ª pasada: completa lo que falte relajando cuotas/tope, sin repetir.
  if (picked.length < count) {
    for (const q of shuffled) {
      if (picked.length >= count) break
      if (used.has(q.id)) continue
      picked.push(q); used.add(q.id)
    }
  }
  // Orden ascendente por dificultad (sort estable → conserva el orden sembrado
  // dentro de cada nivel, así que la ronda sigue variando cada día).
  return picked.sort((a, b) => a.difficulty - b.difficulty)
}

/** Selección diaria determinista para un día concreto "YYYY-MM-DD". Fuente
 *  única del set del día; la usan tanto el cliente web (vía getDailyQuestions)
 *  como el endpoint /api/crackquiz/today (para que la app reciba EL MISMO set). */
export function getDailyQuestionsFor(day: string, count = 10): QuizQuestion[] {
  const seed = day.split('-').reduce((acc, n) => acc * 100 + parseInt(n), 0)
  const rand = mulberry32(seed)
  const shuffled = seededShuffle(QUESTIONS, rand)
  return composeRound(shuffled, Math.min(count, QUESTIONS.length))
}

/** Returns a seeded, difficulty-curved daily selection of N questions */
export function getDailyQuestions(count = 10): QuizQuestion[] {
  return getDailyQuestionsFor(todayKey(), count)
}

/** Lista única de categorías presentes en el pool actual. */
export function listCategories(): QuizCategory[] {
  return Array.from(new Set(QUESTIONS.map(q => q.category))).sort() as QuizCategory[]
}

/**
 * Selección no-determinista (cada llamada distinta) filtrada opcionalmente
 * por categoría. Usada por el modo práctica para variar las rondas extra
 * sin tocar la selección diaria oficial.
 *
 * Si la categoría no tiene suficientes preguntas, devuelve las que haya.
 */
export function getPracticeQuestions(count = 10, category?: QuizCategory): QuizQuestion[] {
  const pool = category ? QUESTIONS.filter(q => q.category === category) : QUESTIONS
  const seed = (Date.now() & 0xffffffff) ^ Math.floor(Math.random() * 0xffffffff)
  const rand = mulberry32(seed)
  const shuffled = pool.map(q => ({ q, k: rand() })).sort((a, b) => a.k - b.k).map(x => x.q)
  // Misma curva que la ronda diaria: orden ascendente por dificultad.
  return shuffled.slice(0, Math.min(count, shuffled.length)).sort((a, b) => a.difficulty - b.difficulty)
}
