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

export type QuizSport = 'football' | 'basketball' | 'tennis' | 'general'
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
    id: 'q011',
    question: '¿En qué ciudad se disputó la final de la Champions 2019?',
    options: ['Madrid', 'Lisboa', 'Wembley', 'Kiev'],
    correctIndex: 2,
    category: 'champions',
    sport: 'football',
    difficulty: 3,
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
    question: '¿Quién tiene el récord de más goles en una temporada de LaLiga?',
    options: ['Cristiano Ronaldo', 'Messi', 'Hugo Sánchez', 'Telmo Zarra'],
    correctIndex: 0,
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
  {
    id: 'q024',
    question: '¿Cuántos goles marcó Ronaldo Nazario en el Mundial 2002?',
    options: ['6', '7', '8', '9'],
    correctIndex: 1,
    category: 'jugadores',
    sport: 'football',
    difficulty: 3,
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
    id: 'q030',
    question: '¿Cuántas Eurocopas ha ganado España?',
    options: ['2', '3', '4', '5'],
    correctIndex: 2,
    category: 'selecciones',
    sport: 'football',
    difficulty: 2,
  },
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
    id: 'q032',
    question: '¿Qué selección lleva más tiempo sin ganar un Mundial (entre las finalistas de 2022)?',
    options: ['Argentina', 'Francia', 'Brasil', 'Alemania'],
    correctIndex: 1,
    category: 'selecciones',
    sport: 'football',
    difficulty: 3,
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
    question: '¿Qué portero paró el famoso penalti de Baggio en el Mundial 1994?',
    options: ['Shilton', 'Taffarel', 'Valdes', 'Oliver Kahn'],
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
    id: 'q057',
    question: '¿Quién es el máximo goleador en la historia de la Champions League?',
    options: ['Lionel Messi', 'Cristiano Ronaldo', 'Raúl', 'Robert Lewandowski'],
    correctIndex: 1,
    category: 'champions',
    sport: 'football',
    difficulty: 1,
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
    id: 'q068',
    question: '¿Qué jugador tiene el récord de goles en un año natural (2012)?',
    options: ['Messi', 'Cristiano Ronaldo', 'Müller', 'Lewandowski'],
    correctIndex: 0,
    category: 'records',
    sport: 'football',
    difficulty: 2,
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
    id: 'q091',
    question: '¿Cuántos jugadores puede tener un equipo de fútbol en el campo?',
    options: ['9', '10', '11', '12'],
    correctIndex: 2,
    category: 'reglas',
    sport: 'football',
    difficulty: 1,
  },
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
    id: 'q094',
    question: '¿Desde qué distancia se lanza un penalti?',
    options: ['10 metros', '11 metros', '12 metros', '9 metros'],
    correctIndex: 1,
    category: 'reglas',
    sport: 'football',
    difficulty: 2,
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
    correctIndex: 2,
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
  {
    id: 'q100',
    question: '¿Quién es conocido como "La Araña" en el baloncesto español?',
    options: ['Pau Gasol', 'Marc Gasol', 'Ricky Rubio', 'Felipe Reyes'],
    correctIndex: 3,
    category: 'jugadores',
    sport: 'basketball',
    difficulty: 3,
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
    id: 'q104',
    question: '¿Quién fue la primera tenista en lograr el Grand Slam de calendario en la era Open?',
    options: ['Steffi Graf', 'Martina Navratilova', 'Serena Williams', 'Billie Jean King'],
    correctIndex: 0,
    category: 'historia',
    sport: 'tennis',
    difficulty: 3,
  },
  {
    id: 'q105',
    question: '¿Qué jugador ganó el US Open, Wimbledon y Roland Garros en 2023?',
    options: ['Rafael Nadal', 'Carlos Alcaraz', 'Novak Djokovic', 'Daniil Medvedev'],
    correctIndex: 2,
    category: 'records',
    sport: 'tennis',
    difficulty: 2,
  },
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

/** Returns a seeded daily selection of N questions */
export function getDailyQuestions(count = 10): QuizQuestion[] {
  const today = todayKey()
  const seed = today.split('-').reduce((acc, n) => acc * 100 + parseInt(n), 0)
  const rand = mulberry32(seed)
  const shuffled = [...QUESTIONS].sort(() => rand() - 0.5)
  return shuffled.slice(0, count)
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
  return shuffled.slice(0, Math.min(count, shuffled.length))
}
