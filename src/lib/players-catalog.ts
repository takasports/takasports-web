// Catálogo de jugadores para Mi Once. Mezcla de leyendas históricas y jugadores
// actuales. El campo `club` es el más reconocido del jugador (no necesariamente
// el actual); `altClubs` añade otros clubes históricos relevantes para los grids
// de TakaGrid y los slots de club de Mi Once (multiclub). `country` se usa para
// mostrar bandera. `era` permite filtrar retos.

export type PlayerPosition = 'GK' | 'DEF' | 'MID' | 'FWD'
export type PlayerEra = 'historic' | 'current'

export interface Player {
  id: string
  name: string
  club: string
  // Otros clubes reconocidos (opcional). Para "¿juega en el club X?" cuenta
  // cualquiera de `[club, ...altClubs]`. No afecta a display ni a noRepeatClub.
  altClubs?: string[]
  country: string
  position: PlayerPosition
  era: PlayerEra
}

// ── Porteros (GK) ─────────────────────────────────────────────────
const GK: Player[] = [
  { id: 'yashin', name: 'Lev Yashin', club: 'Dinamo Moscú', country: 'Rusia', position: 'GK', era: 'historic' },
  { id: 'zoff', name: 'Dino Zoff', club: 'Juventus', country: 'Italia', position: 'GK', era: 'historic' },
  { id: 'banks', name: 'Gordon Banks', club: 'Stoke City', country: 'Inglaterra', position: 'GK', era: 'historic' },
  { id: 'schmeichel-p', name: 'Peter Schmeichel', club: 'Manchester United', altClubs: ['Manchester City', 'Aston Villa'], country: 'Dinamarca', position: 'GK', era: 'historic' },
  { id: 'buffon', name: 'Gianluigi Buffon', club: 'Juventus', altClubs: ['Paris Saint-Germain'], country: 'Italia', position: 'GK', era: 'historic' },
  { id: 'casillas', name: 'Iker Casillas', club: 'Real Madrid', country: 'España', position: 'GK', era: 'historic' },
  { id: 'kahn', name: 'Oliver Kahn', club: 'Bayern Múnich', country: 'Alemania', position: 'GK', era: 'historic' },
  { id: 'vansar', name: 'Edwin van der Sar', club: 'Manchester United', altClubs: ['Juventus', 'Fulham'], country: 'Países Bajos', position: 'GK', era: 'historic' },
  { id: 'taffarel', name: 'Cláudio Taffarel', club: 'Galatasaray', country: 'Brasil', position: 'GK', era: 'historic' },
  { id: 'cech', name: 'Petr Čech', club: 'Chelsea', altClubs: ['Arsenal'], country: 'Chequia', position: 'GK', era: 'historic' },
  { id: 'seaman', name: 'David Seaman', club: 'Arsenal', country: 'Inglaterra', position: 'GK', era: 'historic' },
  { id: 'higuita', name: 'René Higuita', club: 'Atlético Nacional', country: 'Colombia', position: 'GK', era: 'historic' },
  { id: 'chilavert', name: 'José Luis Chilavert', club: 'Vélez Sarsfield', country: 'Paraguay', position: 'GK', era: 'historic' },
  { id: 'maier', name: 'Sepp Maier', club: 'Bayern Múnich', country: 'Alemania', position: 'GK', era: 'historic' },
  { id: 'pagliuca', name: 'Gianluca Pagliuca', club: 'Sampdoria', country: 'Italia', position: 'GK', era: 'historic' },
  { id: 'arconada', name: 'Luis Arconada', club: 'Real Sociedad', country: 'España', position: 'GK', era: 'historic' },
  { id: 'zubizarreta', name: 'Andoni Zubizarreta', club: 'FC Barcelona', country: 'España', position: 'GK', era: 'historic' },
  { id: 'cañizares', name: 'Santiago Cañizares', club: 'Valencia', country: 'España', position: 'GK', era: 'historic' },
  { id: 'gordon', name: 'Walter Zenga', club: 'Internazionale', country: 'Italia', position: 'GK', era: 'historic' },
  { id: 'reina', name: 'Pepe Reina', club: 'Liverpool', altClubs: ['Napoli', 'Villarreal', 'Bayern Múnich'], country: 'España', position: 'GK', era: 'historic' },
  { id: 'valdes', name: 'Víctor Valdés', club: 'FC Barcelona', country: 'España', position: 'GK', era: 'historic' },
  { id: 'neuer', name: 'Manuel Neuer', club: 'Bayern Múnich', country: 'Alemania', position: 'GK', era: 'current' },
  { id: 'courtois', name: 'Thibaut Courtois', club: 'Real Madrid', altClubs: ['Chelsea', 'Atlético de Madrid'], country: 'Bélgica', position: 'GK', era: 'current' },
  { id: 'alisson', name: 'Alisson Becker', club: 'Liverpool', altClubs: ['Roma'], country: 'Brasil', position: 'GK', era: 'current' },
  { id: 'ederson', name: 'Ederson', club: 'Manchester City', altClubs: ['Benfica'], country: 'Brasil', position: 'GK', era: 'current' },
  { id: 'oblak', name: 'Jan Oblak', club: 'Atlético de Madrid', country: 'Eslovenia', position: 'GK', era: 'current' },
  { id: 'tersteg', name: 'Marc-André ter Stegen', club: 'FC Barcelona', country: 'Alemania', position: 'GK', era: 'current' },
  { id: 'donnarumma', name: 'Gianluigi Donnarumma', club: 'Paris Saint-Germain', country: 'Italia', position: 'GK', era: 'current' },
  { id: 'lloris', name: 'Hugo Lloris', club: 'Tottenham', altClubs: ['Niza'], country: 'Francia', position: 'GK', era: 'historic' },
  { id: 'navas-k', name: 'Keylor Navas', club: 'Real Madrid', altClubs: ['Paris Saint-Germain'], country: 'Costa Rica', position: 'GK', era: 'current' },
  { id: 'martinez-e', name: 'Emiliano Martínez', club: 'Aston Villa', country: 'Argentina', position: 'GK', era: 'current' },
  { id: 'maignan', name: 'Mike Maignan', club: 'Milan', country: 'Francia', position: 'GK', era: 'current' },
  { id: 'sommer', name: 'Yann Sommer', club: 'Internazionale', altClubs: ['Bayern Múnich'], country: 'Suiza', position: 'GK', era: 'current' },
  { id: 'onana', name: 'André Onana', club: 'Manchester United', altClubs: ['Internazionale'], country: 'Camerún', position: 'GK', era: 'current' },
  { id: 'bono', name: 'Yassine Bounou', club: 'Al-Hilal', country: 'Marruecos', position: 'GK', era: 'current' },
  { id: 'szczesny', name: 'Wojciech Szczęsny', club: 'Juventus', altClubs: ['Arsenal', 'Roma', 'FC Barcelona'], country: 'Polonia', position: 'GK', era: 'current' },
  { id: 'unai-simon', name: 'Unai Simón', club: 'Athletic Club', country: 'España', position: 'GK', era: 'current' },
  { id: 'kepa', name: 'Kepa Arrizabalaga', club: 'Chelsea', altClubs: ['Real Madrid', 'Athletic Club'], country: 'España', position: 'GK', era: 'current' },
  { id: 'pickford', name: 'Jordan Pickford', club: 'Everton', country: 'Inglaterra', position: 'GK', era: 'current' },
  { id: 'vicario', name: 'Guglielmo Vicario', club: 'Tottenham', country: 'Italia', position: 'GK', era: 'current' },
  { id: 'raya', name: 'David Raya', club: 'Arsenal', country: 'España', position: 'GK', era: 'current' },
  { id: 'rulli', name: 'Gerónimo Rulli', club: 'Marsella', country: 'Argentina', position: 'GK', era: 'current' },
]

// ── Defensas (DEF) ────────────────────────────────────────────────
const DEF: Player[] = [
  // Históricos
  { id: 'beckenbauer', name: 'Franz Beckenbauer', club: 'Bayern Múnich', country: 'Alemania', position: 'DEF', era: 'historic' },
  { id: 'maldini', name: 'Paolo Maldini', club: 'Milan', country: 'Italia', position: 'DEF', era: 'historic' },
  { id: 'baresi', name: 'Franco Baresi', club: 'Milan', country: 'Italia', position: 'DEF', era: 'historic' },
  { id: 'cannavaro', name: 'Fabio Cannavaro', club: 'Real Madrid', altClubs: ['Napoli', 'Internazionale', 'Juventus'], country: 'Italia', position: 'DEF', era: 'historic' },
  { id: 'nesta', name: 'Alessandro Nesta', club: 'Milan', country: 'Italia', position: 'DEF', era: 'historic' },
  { id: 'thuram', name: 'Lilian Thuram', club: 'Juventus', altClubs: ['Mónaco', 'FC Barcelona'], country: 'Francia', position: 'DEF', era: 'historic' },
  { id: 'desailly', name: 'Marcel Desailly', club: 'Chelsea', altClubs: ['Milan', 'Marsella'], country: 'Francia', position: 'DEF', era: 'historic' },
  { id: 'blanc', name: 'Laurent Blanc', club: 'Manchester United', altClubs: ['Napoli', 'FC Barcelona', 'Marsella', 'Internazionale'], country: 'Francia', position: 'DEF', era: 'historic' },
  { id: 'puyol', name: 'Carles Puyol', club: 'FC Barcelona', country: 'España', position: 'DEF', era: 'historic' },
  { id: 'hierro', name: 'Fernando Hierro', club: 'Real Madrid', country: 'España', position: 'DEF', era: 'historic' },
  { id: 'sergio-ramos', name: 'Sergio Ramos', club: 'Real Madrid', altClubs: ['Paris Saint-Germain'], country: 'España', position: 'DEF', era: 'historic' },
  { id: 'pique', name: 'Gerard Piqué', club: 'FC Barcelona', altClubs: ['Manchester United'], country: 'España', position: 'DEF', era: 'historic' },
  { id: 'carles-puyol', name: 'Joan Capdevila', club: 'Villarreal', country: 'España', position: 'DEF', era: 'historic' },
  { id: 'salgado', name: 'Míchel Salgado', club: 'Real Madrid', country: 'España', position: 'DEF', era: 'historic' },
  { id: 'roberto-carlos', name: 'Roberto Carlos', club: 'Real Madrid', country: 'Brasil', position: 'DEF', era: 'historic' },
  { id: 'cafu', name: 'Cafú', club: 'Roma', altClubs: ['Milan'], country: 'Brasil', position: 'DEF', era: 'historic' },
  { id: 'aldair', name: 'Aldair', club: 'Roma', country: 'Brasil', position: 'DEF', era: 'historic' },
  { id: 'lucio', name: 'Lúcio', club: 'Internazionale', altClubs: ['Bayern Múnich', 'Juventus'], country: 'Brasil', position: 'DEF', era: 'historic' },
  { id: 'ayala', name: 'Roberto Ayala', club: 'Valencia', country: 'Argentina', position: 'DEF', era: 'historic' },
  { id: 'passarella', name: 'Daniel Passarella', club: 'River Plate', country: 'Argentina', position: 'DEF', era: 'historic' },
  { id: 'samuel', name: 'Walter Samuel', club: 'Internazionale', altClubs: ['Roma'], country: 'Argentina', position: 'DEF', era: 'historic' },
  { id: 'heinze', name: 'Gabriel Heinze', club: 'Manchester United', altClubs: ['Real Madrid', 'Paris Saint-Germain', 'Marsella'], country: 'Argentina', position: 'DEF', era: 'historic' },
  { id: 'sorin', name: 'Juan Pablo Sorín', club: 'Villarreal', country: 'Argentina', position: 'DEF', era: 'historic' },
  { id: 'koeman', name: 'Ronald Koeman', club: 'FC Barcelona', altClubs: ['Feyenoord'], country: 'Países Bajos', position: 'DEF', era: 'historic' },
  { id: 'rijkaard', name: 'Frank Rijkaard', club: 'Milan', country: 'Países Bajos', position: 'DEF', era: 'historic' },
  { id: 'stam', name: 'Jaap Stam', club: 'Manchester United', altClubs: ['Lazio', 'Milan'], country: 'Países Bajos', position: 'DEF', era: 'historic' },
  { id: 'matthaus', name: 'Lothar Matthäus', club: 'Bayern Múnich', altClubs: ['Internazionale'], country: 'Alemania', position: 'DEF', era: 'historic' },
  { id: 'kohler', name: 'Jürgen Kohler', club: 'Borussia Dortmund', altClubs: ['Juventus', 'Bayern Múnich'], country: 'Alemania', position: 'DEF', era: 'historic' },
  { id: 'sammer', name: 'Matthias Sammer', club: 'Borussia Dortmund', altClubs: ['Stuttgart', 'Internazionale'], country: 'Alemania', position: 'DEF', era: 'historic' },
  { id: 'lahm', name: 'Philipp Lahm', club: 'Bayern Múnich', country: 'Alemania', position: 'DEF', era: 'historic' },
  { id: 'mertesacker', name: 'Per Mertesacker', club: 'Arsenal', country: 'Alemania', position: 'DEF', era: 'historic' },
  { id: 'terry', name: 'John Terry', club: 'Chelsea', altClubs: ['Aston Villa'], country: 'Inglaterra', position: 'DEF', era: 'historic' },
  { id: 'ferdinand', name: 'Rio Ferdinand', club: 'Manchester United', altClubs: ['West Ham', 'Newcastle'], country: 'Inglaterra', position: 'DEF', era: 'historic' },
  { id: 'campbell', name: 'Sol Campbell', club: 'Arsenal', altClubs: ['Tottenham', 'Newcastle', 'Everton'], country: 'Inglaterra', position: 'DEF', era: 'historic' },
  { id: 'cole-a', name: 'Ashley Cole', club: 'Chelsea', altClubs: ['Arsenal', 'Roma', 'LA Galaxy'], country: 'Inglaterra', position: 'DEF', era: 'historic' },
  { id: 'gary-neville', name: 'Gary Neville', club: 'Manchester United', country: 'Inglaterra', position: 'DEF', era: 'historic' },
  { id: 'adams', name: 'Tony Adams', club: 'Arsenal', country: 'Inglaterra', position: 'DEF', era: 'historic' },
  { id: 'vidic', name: 'Nemanja Vidić', club: 'Manchester United', altClubs: ['Internazionale'], country: 'Serbia', position: 'DEF', era: 'historic' },
  { id: 'puskas', name: 'Carlos Gamarra', club: 'Atlético Paranaense', country: 'Paraguay', position: 'DEF', era: 'historic' },
  { id: 'stankovic', name: 'Dejan Stanković', club: 'Internazionale', altClubs: ['Lazio'], country: 'Serbia', position: 'DEF', era: 'historic' },
  { id: 'ivanovic', name: 'Branislav Ivanović', club: 'Chelsea', country: 'Serbia', position: 'DEF', era: 'historic' },
  { id: 'chiellini', name: 'Giorgio Chiellini', club: 'Juventus', country: 'Italia', position: 'DEF', era: 'historic' },
  { id: 'bonucci', name: 'Leonardo Bonucci', club: 'Juventus', country: 'Italia', position: 'DEF', era: 'historic' },
  { id: 'barzagli', name: 'Andrea Barzagli', club: 'Juventus', country: 'Italia', position: 'DEF', era: 'historic' },
  { id: 'zambrotta', name: 'Gianluca Zambrotta', club: 'Juventus', altClubs: ['FC Barcelona', 'Milan'], country: 'Italia', position: 'DEF', era: 'historic' },
  { id: 'maicon', name: 'Maicon', club: 'Internazionale', altClubs: ['Roma', 'Manchester City', 'Juventus'], country: 'Brasil', position: 'DEF', era: 'historic' },
  { id: 'thiago-silva', name: 'Thiago Silva', club: 'Paris Saint-Germain', country: 'Brasil', position: 'DEF', era: 'historic', altClubs: ['Milan', 'Chelsea'] },
  { id: 'david-luiz', name: 'David Luiz', club: 'Chelsea', country: 'Brasil', position: 'DEF', era: 'historic', altClubs: ['Paris Saint-Germain', 'Arsenal'] },
  { id: 'dani-alves', name: 'Dani Alves', club: 'FC Barcelona', altClubs: ['Juventus', 'Paris Saint-Germain'], country: 'Brasil', position: 'DEF', era: 'historic' },
  { id: 'marcelo', name: 'Marcelo', club: 'Real Madrid', country: 'Brasil', position: 'DEF', era: 'historic' },
  { id: 'pepe', name: 'Pepe', club: 'Real Madrid', country: 'Portugal', position: 'DEF', era: 'historic' },
  { id: 'carvalho-r', name: 'Ricardo Carvalho', club: 'Chelsea', altClubs: ['Real Madrid', 'Mónaco'], country: 'Portugal', position: 'DEF', era: 'historic' },
  { id: 'coentrao', name: 'Fábio Coentrão', club: 'Real Madrid', country: 'Portugal', position: 'DEF', era: 'historic' },

  // Actuales
  { id: 'van-dijk', name: 'Virgil van Dijk', club: 'Liverpool', altClubs: ['Celtic'], country: 'Países Bajos', position: 'DEF', era: 'current' },
  { id: 'rudiger', name: 'Antonio Rüdiger', club: 'Real Madrid', altClubs: ['Chelsea', 'Roma'], country: 'Alemania', position: 'DEF', era: 'current' },
  { id: 'alaba', name: 'David Alaba', club: 'Real Madrid', altClubs: ['Bayern Múnich'], country: 'Austria', position: 'DEF', era: 'current' },
  { id: 'militao', name: 'Éder Militão', club: 'Real Madrid', country: 'Brasil', position: 'DEF', era: 'current' },
  { id: 'mendy', name: 'Ferland Mendy', club: 'Real Madrid', country: 'Francia', position: 'DEF', era: 'current' },
  { id: 'vazquez', name: 'Lucas Vázquez', club: 'Real Madrid', country: 'España', position: 'DEF', era: 'current' },
  { id: 'carvajal', name: 'Dani Carvajal', club: 'Real Madrid', country: 'España', position: 'DEF', era: 'current' },
  { id: 'nacho', name: 'Nacho Fernández', club: 'Real Madrid', country: 'España', position: 'DEF', era: 'current' },
  { id: 'araujo', name: 'Ronald Araújo', club: 'FC Barcelona', country: 'Uruguay', position: 'DEF', era: 'current' },
  { id: 'kounde', name: 'Jules Koundé', club: 'FC Barcelona', country: 'Francia', position: 'DEF', era: 'current' },
  { id: 'balde', name: 'Alejandro Balde', club: 'FC Barcelona', country: 'España', position: 'DEF', era: 'current' },
  { id: 'cubarsi', name: 'Pau Cubarsí', club: 'FC Barcelona', country: 'España', position: 'DEF', era: 'current' },
  { id: 'christensen', name: 'Andreas Christensen', club: 'FC Barcelona', country: 'Dinamarca', position: 'DEF', era: 'current' },
  { id: 'cancelo', name: 'João Cancelo', club: 'FC Barcelona', country: 'Portugal', position: 'DEF', era: 'current', altClubs: ['Manchester City', 'Juventus'] },
  { id: 'gimenez', name: 'José María Giménez', club: 'Atlético de Madrid', country: 'Uruguay', position: 'DEF', era: 'current' },
  { id: 'savic', name: 'Stefan Savić', club: 'Atlético de Madrid', country: 'Montenegro', position: 'DEF', era: 'current' },
  { id: 'hermoso', name: 'Mario Hermoso', club: 'Atlético de Madrid', country: 'España', position: 'DEF', era: 'current' },
  { id: 'reinildo', name: 'Reinildo Mandava', club: 'Atlético de Madrid', country: 'Mozambique', position: 'DEF', era: 'current' },
  { id: 'le-normand', name: 'Robin Le Normand', club: 'Real Sociedad', country: 'España', position: 'DEF', era: 'current' },
  { id: 'aguerd', name: 'Nayef Aguerd', club: 'West Ham', country: 'Marruecos', position: 'DEF', era: 'current' },
  { id: 'dias-r', name: 'Rúben Dias', club: 'Manchester City', country: 'Portugal', position: 'DEF', era: 'current' },
  { id: 'walker', name: 'Kyle Walker', club: 'Manchester City', altClubs: ['Tottenham'], country: 'Inglaterra', position: 'DEF', era: 'current' },
  { id: 'akanji', name: 'Manuel Akanji', club: 'Manchester City', altClubs: ['Borussia Dortmund'], country: 'Suiza', position: 'DEF', era: 'current' },
  { id: 'gvardiol', name: 'Joško Gvardiol', club: 'Manchester City', altClubs: ['RB Leipzig'], country: 'Croacia', position: 'DEF', era: 'current' },
  { id: 'stones', name: 'John Stones', club: 'Manchester City', altClubs: ['Everton'], country: 'Inglaterra', position: 'DEF', era: 'current' },
  { id: 'taa', name: 'Trent Alexander-Arnold', club: 'Liverpool', country: 'Inglaterra', position: 'DEF', era: 'current' },
  { id: 'robertson', name: 'Andrew Robertson', club: 'Liverpool', country: 'Escocia', position: 'DEF', era: 'current' },
  { id: 'konate', name: 'Ibrahima Konaté', club: 'Liverpool', altClubs: ['RB Leipzig'], country: 'Francia', position: 'DEF', era: 'current' },
  { id: 'saliba', name: 'William Saliba', club: 'Arsenal', country: 'Francia', position: 'DEF', era: 'current' },
  { id: 'gabriel', name: 'Gabriel Magalhães', club: 'Arsenal', country: 'Brasil', position: 'DEF', era: 'current' },
  { id: 'white-b', name: 'Ben White', club: 'Arsenal', country: 'Inglaterra', position: 'DEF', era: 'current' },
  { id: 'zinchenko', name: 'Oleksandr Zinchenko', club: 'Arsenal', altClubs: ['Manchester City'], country: 'Ucrania', position: 'DEF', era: 'current' },
  { id: 'romero-c', name: 'Cristian Romero', club: 'Tottenham', country: 'Argentina', position: 'DEF', era: 'current' },
  { id: 'van-de-ven', name: 'Micky van de Ven', club: 'Tottenham', country: 'Países Bajos', position: 'DEF', era: 'current' },
  { id: 'porro', name: 'Pedro Porro', club: 'Tottenham', country: 'España', position: 'DEF', era: 'current' },
  { id: 'james-r', name: 'Reece James', club: 'Chelsea', country: 'Inglaterra', position: 'DEF', era: 'current' },
  { id: 'colwill', name: 'Levi Colwill', club: 'Chelsea', country: 'Inglaterra', position: 'DEF', era: 'current' },
  { id: 'chilwell', name: 'Ben Chilwell', club: 'Chelsea', country: 'Inglaterra', position: 'DEF', era: 'current' },
  { id: 'bastoni', name: 'Alessandro Bastoni', club: 'Internazionale', country: 'Italia', position: 'DEF', era: 'current' },
  { id: 'dimarco', name: 'Federico Dimarco', club: 'Internazionale', country: 'Italia', position: 'DEF', era: 'current' },
  { id: 'darmian', name: 'Matteo Darmian', club: 'Internazionale', country: 'Italia', position: 'DEF', era: 'current' },
  { id: 'pavard', name: 'Benjamin Pavard', club: 'Internazionale', altClubs: ['Bayern Múnich', 'Stuttgart'], country: 'Francia', position: 'DEF', era: 'current' },
  { id: 'kim', name: 'Kim Min-jae', club: 'Bayern Múnich', altClubs: ['Napoli'], country: 'Corea del Sur', position: 'DEF', era: 'current' },
  { id: 'davies-a', name: 'Alphonso Davies', club: 'Bayern Múnich', country: 'Canadá', position: 'DEF', era: 'current' },
  { id: 'kimmich', name: 'Joshua Kimmich', club: 'Bayern Múnich', country: 'Alemania', position: 'DEF', era: 'current' },
  { id: 'upamecano', name: 'Dayot Upamecano', club: 'Bayern Múnich', country: 'Francia', position: 'DEF', era: 'current' },
  { id: 'hakimi', name: 'Achraf Hakimi', club: 'Paris Saint-Germain', altClubs: ['Real Madrid', 'Borussia Dortmund', 'Internazionale'], country: 'Marruecos', position: 'DEF', era: 'current' },
  { id: 'marquinhos', name: 'Marquinhos', club: 'Paris Saint-Germain', country: 'Brasil', position: 'DEF', era: 'current' },
  { id: 'theo', name: 'Theo Hernández', club: 'Milan', altClubs: ['Real Madrid', 'Atlético de Madrid'], country: 'Francia', position: 'DEF', era: 'current' },
  { id: 'tomori', name: 'Fikayo Tomori', club: 'Milan', altClubs: ['Chelsea'], country: 'Inglaterra', position: 'DEF', era: 'current' },
  { id: 'kalulu', name: 'Pierre Kalulu', club: 'Milan', country: 'Francia', position: 'DEF', era: 'current' },
  { id: 'maguire', name: 'Harry Maguire', club: 'Manchester United', country: 'Inglaterra', position: 'DEF', era: 'current' },
  { id: 'shaw', name: 'Luke Shaw', club: 'Manchester United', country: 'Inglaterra', position: 'DEF', era: 'current' },
  { id: 'martinez-l', name: 'Lisandro Martínez', club: 'Manchester United', country: 'Argentina', position: 'DEF', era: 'current' },
  { id: 'dalot', name: 'Diogo Dalot', club: 'Manchester United', altClubs: ['Milan'], country: 'Portugal', position: 'DEF', era: 'current' },
  { id: 'mings', name: 'Tyrone Mings', club: 'Aston Villa', country: 'Inglaterra', position: 'DEF', era: 'current' },
  { id: 'cash', name: 'Matty Cash', club: 'Aston Villa', country: 'Polonia', position: 'DEF', era: 'current' },
  { id: 'guerreiro', name: 'Raphaël Guerreiro', club: 'Bayern Múnich', country: 'Portugal', position: 'DEF', era: 'current' },
  { id: 'bremer', name: 'Bremer', club: 'Juventus', country: 'Brasil', position: 'DEF', era: 'current' },
  { id: 'demiral', name: 'Merih Demiral', club: 'Al-Ahli', country: 'Turquía', position: 'DEF', era: 'current' },
  { id: 'tapsoba', name: 'Edmond Tapsoba', club: 'Bayer Leverkusen', country: 'Burkina Faso', position: 'DEF', era: 'current' },
  { id: 'frimpong', name: 'Jeremie Frimpong', club: 'Bayer Leverkusen', altClubs: ['Celtic'], country: 'Países Bajos', position: 'DEF', era: 'current' },
  { id: 'grimaldo', name: 'Álex Grimaldo', club: 'Bayer Leverkusen', altClubs: ['Benfica'], country: 'España', position: 'DEF', era: 'current' },
  { id: 'todibo', name: 'Jean-Clair Todibo', club: 'Niza', country: 'Francia', position: 'DEF', era: 'current' },
  { id: 'badiashile', name: 'Benoît Badiashile', club: 'Chelsea', country: 'Francia', position: 'DEF', era: 'current' },
  { id: 'theate', name: 'Arthur Theate', club: 'Eintracht Frankfurt', country: 'Bélgica', position: 'DEF', era: 'current' },
  { id: 'hancko', name: 'Dávid Hancko', club: 'Feyenoord', country: 'Eslovaquia', position: 'DEF', era: 'current' },
  { id: 'nuno-mendes', name: 'Nuno Mendes', club: 'Paris Saint-Germain', altClubs: ['Sporting CP'], country: 'Portugal', position: 'DEF', era: 'current' },
  { id: 'inigo', name: 'Iñigo Martínez', club: 'FC Barcelona', altClubs: ['Athletic Club', 'Real Sociedad'], country: 'España', position: 'DEF', era: 'current' },
  { id: 'laporte', name: 'Aymeric Laporte', club: 'Al-Nassr', altClubs: ['Manchester City', 'Athletic Club'], country: 'España', position: 'DEF', era: 'current' },
]

// ── Centrocampistas (MID) ─────────────────────────────────────────
const MID: Player[] = [
  // Históricos
  { id: 'cruyff', name: 'Johan Cruyff', club: 'FC Barcelona', country: 'Países Bajos', position: 'MID', era: 'historic' },
  { id: 'platini', name: 'Michel Platini', club: 'Juventus', country: 'Francia', position: 'MID', era: 'historic' },
  { id: 'zidane', name: 'Zinédine Zidane', club: 'Real Madrid', altClubs: ['Juventus'], country: 'Francia', position: 'MID', era: 'historic' },
  { id: 'maradona', name: 'Diego Maradona', club: 'Napoli', altClubs: ['FC Barcelona'], country: 'Argentina', position: 'MID', era: 'historic' },
  { id: 'pele', name: 'Pelé', club: 'Santos', country: 'Brasil', position: 'MID', era: 'historic' },
  { id: 'di-stefano', name: 'Alfredo Di Stéfano', club: 'Real Madrid', altClubs: ['River Plate'], country: 'Argentina', position: 'MID', era: 'historic' },
  { id: 'puskas-f', name: 'Ferenc Puskás', club: 'Real Madrid', country: 'Hungría', position: 'MID', era: 'historic' },
  { id: 'rivera', name: 'Gianni Rivera', club: 'Milan', country: 'Italia', position: 'MID', era: 'historic' },
  { id: 'rivelino', name: 'Rivellino', club: 'Corinthians', country: 'Brasil', position: 'MID', era: 'historic' },
  { id: 'socrates', name: 'Sócrates', club: 'Corinthians', country: 'Brasil', position: 'MID', era: 'historic' },
  { id: 'zico', name: 'Zico', club: 'Flamengo', country: 'Brasil', position: 'MID', era: 'historic' },
  { id: 'falcao', name: 'Paulo Roberto Falcão', club: 'Roma', country: 'Brasil', position: 'MID', era: 'historic' },
  { id: 'rivaldo', name: 'Rivaldo', club: 'FC Barcelona', altClubs: ['Milan'], country: 'Brasil', position: 'MID', era: 'historic' },
  { id: 'ronaldinho', name: 'Ronaldinho', club: 'FC Barcelona', country: 'Brasil', position: 'MID', era: 'historic', altClubs: ['Milan', 'Paris Saint-Germain'] },
  { id: 'kaka', name: 'Kaká', club: 'Milan', country: 'Brasil', position: 'MID', era: 'historic', altClubs: ['Real Madrid'] },
  { id: 'gerson', name: 'Gérson', club: 'Botafogo', country: 'Brasil', position: 'MID', era: 'historic' },
  { id: 'didi', name: 'Didi', club: 'Botafogo', country: 'Brasil', position: 'MID', era: 'historic' },
  { id: 'beckham', name: 'David Beckham', club: 'Manchester United', altClubs: ['Real Madrid', 'LA Galaxy', 'Milan', 'Paris Saint-Germain'], country: 'Inglaterra', position: 'MID', era: 'historic' },
  { id: 'scholes', name: 'Paul Scholes', club: 'Manchester United', country: 'Inglaterra', position: 'MID', era: 'historic' },
  { id: 'gerrard', name: 'Steven Gerrard', club: 'Liverpool', altClubs: ['LA Galaxy'], country: 'Inglaterra', position: 'MID', era: 'historic' },
  { id: 'lampard', name: 'Frank Lampard', club: 'Chelsea', country: 'Inglaterra', position: 'MID', era: 'historic' },
  { id: 'keane', name: 'Roy Keane', club: 'Manchester United', altClubs: ['Celtic'], country: 'Irlanda', position: 'MID', era: 'historic' },
  { id: 'vieira', name: 'Patrick Vieira', club: 'Arsenal', country: 'Francia', position: 'MID', era: 'historic', altClubs: ['Juventus', 'Internazionale', 'Manchester City'] },
  { id: 'henry-thierry', name: 'Robert Pirès', club: 'Arsenal', altClubs: ['Marsella', 'Villarreal'], country: 'Francia', position: 'MID', era: 'historic' },
  { id: 'makelele', name: 'Claude Makélélé', club: 'Real Madrid', country: 'Francia', position: 'MID', era: 'historic', altClubs: ['Chelsea'] },
  { id: 'deschamps', name: 'Didier Deschamps', club: 'Juventus', altClubs: ['Marsella', 'Chelsea', 'Valencia'], country: 'Francia', position: 'MID', era: 'historic' },
  { id: 'petit', name: 'Emmanuel Petit', club: 'Arsenal', altClubs: ['FC Barcelona', 'Chelsea', 'Mónaco'], country: 'Francia', position: 'MID', era: 'historic' },
  { id: 'zambrano', name: 'Yaya Touré', club: 'Manchester City', altClubs: ['FC Barcelona', 'Mónaco'], country: 'Costa de Marfil', position: 'MID', era: 'historic' },
  { id: 'essien', name: 'Michael Essien', club: 'Chelsea', altClubs: ['Real Madrid', 'Milan'], country: 'Ghana', position: 'MID', era: 'historic' },
  { id: 'pirlo', name: 'Andrea Pirlo', club: 'Milan', country: 'Italia', position: 'MID', era: 'historic', altClubs: ['Juventus', 'Internazionale'] },
  { id: 'gattuso', name: 'Gennaro Gattuso', club: 'Milan', country: 'Italia', position: 'MID', era: 'historic' },
  { id: 'totti', name: 'Francesco Totti', club: 'Roma', country: 'Italia', position: 'MID', era: 'historic' },
  { id: 'del-piero', name: 'Alessandro Del Piero', club: 'Juventus', country: 'Italia', position: 'MID', era: 'historic' },
  { id: 'baggio', name: 'Roberto Baggio', club: 'Juventus', altClubs: ['Milan', 'Internazionale', 'Fiorentina'], country: 'Italia', position: 'MID', era: 'historic' },
  { id: 'mancini-r', name: 'Roberto Mancini', club: 'Sampdoria', altClubs: ['Lazio'], country: 'Italia', position: 'MID', era: 'historic' },
  { id: 'de-rossi', name: 'Daniele De Rossi', club: 'Roma', country: 'Italia', position: 'MID', era: 'historic' },
  { id: 'xavi', name: 'Xavi Hernández', club: 'FC Barcelona', country: 'España', position: 'MID', era: 'historic' },
  { id: 'iniesta', name: 'Andrés Iniesta', club: 'FC Barcelona', country: 'España', position: 'MID', era: 'historic' },
  { id: 'busquets', name: 'Sergio Busquets', club: 'FC Barcelona', country: 'España', position: 'MID', era: 'historic' },
  { id: 'fabregas', name: 'Cesc Fàbregas', club: 'Arsenal', altClubs: ['FC Barcelona', 'Chelsea', 'Mónaco'], country: 'España', position: 'MID', era: 'historic' },
  { id: 'alonso-x', name: 'Xabi Alonso', club: 'Liverpool', country: 'España', position: 'MID', era: 'historic', altClubs: ['Real Madrid', 'Bayern Múnich'] },
  { id: 'silva-d', name: 'David Silva', club: 'Manchester City', altClubs: ['Valencia', 'Real Sociedad'], country: 'España', position: 'MID', era: 'historic' },
  { id: 'guardiola', name: 'Pep Guardiola', club: 'FC Barcelona', altClubs: ['Roma'], country: 'España', position: 'MID', era: 'historic' },
  { id: 'redondo', name: 'Fernando Redondo', club: 'Real Madrid', altClubs: ['Milan'], country: 'Argentina', position: 'MID', era: 'historic' },
  { id: 'verón', name: 'Juan Sebastián Verón', club: 'Lazio', altClubs: ['Manchester United', 'Chelsea', 'Internazionale', 'Sampdoria'], country: 'Argentina', position: 'MID', era: 'historic' },
  { id: 'riquelme', name: 'Juan Román Riquelme', club: 'Villarreal', country: 'Argentina', position: 'MID', era: 'historic', altClubs: ['FC Barcelona'] },
  { id: 'aimar', name: 'Pablo Aimar', club: 'Valencia', country: 'Argentina', position: 'MID', era: 'historic' },
  { id: 'ortega', name: 'Ariel Ortega', club: 'River Plate', country: 'Argentina', position: 'MID', era: 'historic' },
  { id: 'figo', name: 'Luís Figo', club: 'Real Madrid', country: 'Portugal', position: 'MID', era: 'historic', altClubs: ['FC Barcelona', 'Internazionale'] },
  { id: 'rui-costa', name: 'Rui Costa', club: 'Milan', altClubs: ['Fiorentina', 'Benfica'], country: 'Portugal', position: 'MID', era: 'historic' },
  { id: 'deco', name: 'Deco', club: 'FC Barcelona', altClubs: ['Chelsea'], country: 'Portugal', position: 'MID', era: 'historic' },
  { id: 'effenberg', name: 'Stefan Effenberg', club: 'Bayern Múnich', altClubs: ['Fiorentina'], country: 'Alemania', position: 'MID', era: 'historic' },
  { id: 'ballack', name: 'Michael Ballack', club: 'Bayern Múnich', altClubs: ['Chelsea', 'Bayer Leverkusen'], country: 'Alemania', position: 'MID', era: 'historic' },
  { id: 'schweinsteiger', name: 'Bastian Schweinsteiger', club: 'Bayern Múnich', country: 'Alemania', position: 'MID', era: 'historic' },
  { id: 'ozil', name: 'Mesut Özil', club: 'Real Madrid', country: 'Alemania', position: 'MID', era: 'historic', altClubs: ['Arsenal'] },
  { id: 'kroos', name: 'Toni Kroos', club: 'Real Madrid', altClubs: ['Bayern Múnich', 'Bayer Leverkusen'], country: 'Alemania', position: 'MID', era: 'historic' },
  { id: 'davids', name: 'Edgar Davids', club: 'Juventus', altClubs: ['Milan', 'Internazionale', 'Tottenham'], country: 'Países Bajos', position: 'MID', era: 'historic' },
  { id: 'seedorf', name: 'Clarence Seedorf', club: 'Milan', country: 'Países Bajos', position: 'MID', era: 'historic', altClubs: ['Real Madrid', 'Internazionale'] },
  { id: 'sneijder', name: 'Wesley Sneijder', club: 'Internazionale', country: 'Países Bajos', position: 'MID', era: 'historic', altClubs: ['Real Madrid'] },
  { id: 'van-bommel', name: 'Mark van Bommel', club: 'Bayern Múnich', altClubs: ['FC Barcelona', 'Milan'], country: 'Países Bajos', position: 'MID', era: 'historic' },

  // Actuales
  { id: 'modric', name: 'Luka Modrić', club: 'Real Madrid', altClubs: ['Tottenham'], country: 'Croacia', position: 'MID', era: 'current' },
  { id: 'bellingham', name: 'Jude Bellingham', club: 'Real Madrid', country: 'Inglaterra', position: 'MID', era: 'current' },
  { id: 'valverde', name: 'Federico Valverde', club: 'Real Madrid', country: 'Uruguay', position: 'MID', era: 'current' },
  { id: 'tchouameni', name: 'Aurélien Tchouaméni', club: 'Real Madrid', country: 'Francia', position: 'MID', era: 'current' },
  { id: 'camavinga', name: 'Eduardo Camavinga', club: 'Real Madrid', country: 'Francia', position: 'MID', era: 'current' },
  { id: 'pedri', name: 'Pedri', club: 'FC Barcelona', country: 'España', position: 'MID', era: 'current' },
  { id: 'gavi', name: 'Gavi', club: 'FC Barcelona', country: 'España', position: 'MID', era: 'current' },
  { id: 'de-jong-f', name: 'Frenkie de Jong', club: 'FC Barcelona', country: 'Países Bajos', position: 'MID', era: 'current' },
  { id: 'ilkay', name: 'İlkay Gündoğan', club: 'FC Barcelona', altClubs: ['Manchester City', 'Borussia Dortmund'], country: 'Alemania', position: 'MID', era: 'current' },
  { id: 'kdb', name: 'Kevin De Bruyne', club: 'Manchester City', country: 'Bélgica', position: 'MID', era: 'current' },
  { id: 'rodri', name: 'Rodri', club: 'Manchester City', country: 'España', position: 'MID', era: 'current' },
  { id: 'bernardo', name: 'Bernardo Silva', club: 'Manchester City', country: 'Portugal', position: 'MID', era: 'current' },
  { id: 'foden', name: 'Phil Foden', club: 'Manchester City', country: 'Inglaterra', position: 'MID', era: 'current' },
  { id: 'kovacic', name: 'Mateo Kovačić', club: 'Manchester City', altClubs: ['Chelsea', 'Real Madrid', 'Internazionale'], country: 'Croacia', position: 'MID', era: 'current' },
  { id: 'odegaard', name: 'Martin Ødegaard', club: 'Arsenal', country: 'Noruega', position: 'MID', era: 'current' },
  { id: 'rice', name: 'Declan Rice', club: 'Arsenal', country: 'Inglaterra', position: 'MID', era: 'current' },
  { id: 'havertz', name: 'Kai Havertz', club: 'Arsenal', altClubs: ['Chelsea', 'Bayer Leverkusen'], country: 'Alemania', position: 'MID', era: 'current' },
  { id: 'partey', name: 'Thomas Partey', club: 'Arsenal', altClubs: ['Atlético de Madrid'], country: 'Ghana', position: 'MID', era: 'current' },
  { id: 'mac-allister', name: 'Alexis Mac Allister', club: 'Liverpool', country: 'Argentina', position: 'MID', era: 'current' },
  { id: 'szoboszlai', name: 'Dominik Szoboszlai', club: 'Liverpool', country: 'Hungría', position: 'MID', era: 'current' },
  { id: 'jones-c', name: 'Curtis Jones', club: 'Liverpool', country: 'Inglaterra', position: 'MID', era: 'current' },
  { id: 'gravenberch', name: 'Ryan Gravenberch', club: 'Liverpool', country: 'Países Bajos', position: 'MID', era: 'current' },
  { id: 'maddison', name: 'James Maddison', club: 'Tottenham', country: 'Inglaterra', position: 'MID', era: 'current' },
  { id: 'bissouma', name: 'Yves Bissouma', club: 'Tottenham', country: 'Mali', position: 'MID', era: 'current' },
  { id: 'enzo', name: 'Enzo Fernández', club: 'Chelsea', country: 'Argentina', position: 'MID', era: 'current' },
  { id: 'caicedo', name: 'Moisés Caicedo', club: 'Chelsea', country: 'Ecuador', position: 'MID', era: 'current' },
  { id: 'palmer', name: 'Cole Palmer', club: 'Chelsea', country: 'Inglaterra', position: 'MID', era: 'current' },
  { id: 'mainoo', name: 'Kobbie Mainoo', club: 'Manchester United', country: 'Inglaterra', position: 'MID', era: 'current' },
  { id: 'mount', name: 'Mason Mount', club: 'Manchester United', country: 'Inglaterra', position: 'MID', era: 'current' },
  { id: 'fernandes', name: 'Bruno Fernandes', club: 'Manchester United', country: 'Portugal', position: 'MID', era: 'current' },
  { id: 'casemiro', name: 'Casemiro', club: 'Manchester United', altClubs: ['Real Madrid'], country: 'Brasil', position: 'MID', era: 'current' },
  { id: 'eriksen', name: 'Christian Eriksen', club: 'Manchester United', altClubs: ['Tottenham', 'Internazionale'], country: 'Dinamarca', position: 'MID', era: 'current' },
  { id: 'barella', name: 'Nicolò Barella', club: 'Internazionale', country: 'Italia', position: 'MID', era: 'current' },
  { id: 'calhanoglu', name: 'Hakan Çalhanoğlu', club: 'Internazionale', altClubs: ['Milan', 'Bayer Leverkusen'], country: 'Turquía', position: 'MID', era: 'current' },
  { id: 'mkhitaryan', name: 'Henrikh Mkhitaryan', club: 'Internazionale', altClubs: ['Manchester United', 'Arsenal', 'Roma', 'Borussia Dortmund'], country: 'Armenia', position: 'MID', era: 'current' },
  { id: 'frattesi', name: 'Davide Frattesi', club: 'Internazionale', country: 'Italia', position: 'MID', era: 'current' },
  { id: 'reijnders', name: 'Tijjani Reijnders', club: 'Milan', country: 'Países Bajos', position: 'MID', era: 'current' },
  { id: 'pulisic', name: 'Christian Pulisic', club: 'Milan', altClubs: ['Chelsea', 'Borussia Dortmund'], country: 'Estados Unidos', position: 'MID', era: 'current' },
  { id: 'loftus-cheek', name: 'Ruben Loftus-Cheek', club: 'Milan', altClubs: ['Chelsea'], country: 'Inglaterra', position: 'MID', era: 'current' },
  { id: 'musiala', name: 'Jamal Musiala', club: 'Bayern Múnich', country: 'Alemania', position: 'MID', era: 'current' },
  { id: 'goretzka', name: 'Leon Goretzka', club: 'Bayern Múnich', country: 'Alemania', position: 'MID', era: 'current' },
  { id: 'sane', name: 'Leroy Sané', club: 'Bayern Múnich', altClubs: ['Manchester City'], country: 'Alemania', position: 'MID', era: 'current' },
  { id: 'rabiot', name: 'Adrien Rabiot', club: 'Marsella', altClubs: ['Juventus', 'Paris Saint-Germain'], country: 'Francia', position: 'MID', era: 'current' },
  { id: 'locatelli', name: 'Manuel Locatelli', club: 'Juventus', country: 'Italia', position: 'MID', era: 'current' },
  { id: 'zakaria', name: 'Denis Zakaria', club: 'Mónaco', country: 'Suiza', position: 'MID', era: 'current' },
  { id: 'wirtz', name: 'Florian Wirtz', club: 'Bayer Leverkusen', country: 'Alemania', position: 'MID', era: 'current' },
  { id: 'xhaka', name: 'Granit Xhaka', club: 'Bayer Leverkusen', altClubs: ['Arsenal'], country: 'Suiza', position: 'MID', era: 'current' },
  { id: 'fabian', name: 'Fabián Ruiz', club: 'Paris Saint-Germain', altClubs: ['Napoli', 'Real Betis'], country: 'España', position: 'MID', era: 'current' },
  { id: 'vitinha', name: 'Vitinha', club: 'Paris Saint-Germain', country: 'Portugal', position: 'MID', era: 'current' },
  { id: 'ugarte', name: 'Manuel Ugarte', club: 'Manchester United', altClubs: ['Paris Saint-Germain', 'Sporting CP'], country: 'Uruguay', position: 'MID', era: 'current' },
  { id: 'zubimendi', name: 'Martín Zubimendi', club: 'Real Sociedad', country: 'España', position: 'MID', era: 'current' },
  { id: 'merino', name: 'Mikel Merino', club: 'Real Sociedad', altClubs: ['Arsenal'], country: 'España', position: 'MID', era: 'current' },
  { id: 'olmo', name: 'Dani Olmo', club: 'FC Barcelona', altClubs: ['RB Leipzig'], country: 'España', position: 'MID', era: 'current' },
  { id: 'fati', name: 'Ansu Fati', club: 'FC Barcelona', country: 'España', position: 'MID', era: 'current' },
  { id: 'koke', name: 'Koke', club: 'Atlético de Madrid', country: 'España', position: 'MID', era: 'current' },
  { id: 'de-paul', name: 'Rodrigo De Paul', club: 'Atlético de Madrid', country: 'Argentina', position: 'MID', era: 'current' },
  { id: 'saul', name: 'Saúl Ñíguez', club: 'Atlético de Madrid', country: 'España', position: 'MID', era: 'current' },
  { id: 'isco', name: 'Isco', club: 'Real Betis', altClubs: ['Real Madrid'], country: 'España', position: 'MID', era: 'current' },
  { id: 'guler', name: 'Arda Güler', club: 'Real Madrid', country: 'Turquía', position: 'MID', era: 'current' },
  { id: 'ceballos', name: 'Dani Ceballos', club: 'Real Madrid', altClubs: ['Real Betis', 'Arsenal'], country: 'España', position: 'MID', era: 'current' },
  { id: 'thiago', name: 'Thiago Alcântara', club: 'Liverpool', country: 'España', position: 'MID', era: 'historic', altClubs: ['Bayern Múnich', 'FC Barcelona'] },
  { id: 'verratti', name: 'Marco Verratti', club: 'Paris Saint-Germain', country: 'Italia', position: 'MID', era: 'historic' },
  { id: 'pogba', name: 'Paul Pogba', club: 'Juventus', country: 'Francia', position: 'MID', era: 'historic', altClubs: ['Manchester United'] },
  { id: 'kante', name: "N'Golo Kanté", club: 'Chelsea', country: 'Francia', position: 'MID', era: 'historic' },
  { id: 'matuidi', name: 'Blaise Matuidi', club: 'Paris Saint-Germain', altClubs: ['Juventus'], country: 'Francia', position: 'MID', era: 'historic' },
  { id: 'griezmann', name: 'Antoine Griezmann', club: 'Atlético de Madrid', country: 'Francia', position: 'MID', era: 'current', altClubs: ['FC Barcelona', 'Real Sociedad'] },
  { id: 'james-r2', name: 'James Rodríguez', club: 'Real Madrid', altClubs: ['Mónaco', 'Bayern Múnich', 'Everton'], country: 'Colombia', position: 'MID', era: 'historic' },
]

// ── Delanteros (FWD) ──────────────────────────────────────────────
const FWD: Player[] = [
  // Históricos
  { id: 'puskas-fwd', name: 'Eusébio', club: 'Benfica', country: 'Portugal', position: 'FWD', era: 'historic' },
  { id: 'cruyff-fwd', name: 'Garrincha', club: 'Botafogo', country: 'Brasil', position: 'FWD', era: 'historic' },
  { id: 'muller', name: 'Gerd Müller', club: 'Bayern Múnich', country: 'Alemania', position: 'FWD', era: 'historic' },
  { id: 'romario', name: 'Romário', club: 'FC Barcelona', altClubs: ['Flamengo', 'Valencia'], country: 'Brasil', position: 'FWD', era: 'historic' },
  { id: 'ronaldo-r9', name: 'Ronaldo Nazário', club: 'Real Madrid', country: 'Brasil', position: 'FWD', era: 'historic', altClubs: ['FC Barcelona', 'Internazionale', 'Milan'] },
  { id: 'ronaldo-cr7', name: 'Cristiano Ronaldo', club: 'Real Madrid', country: 'Portugal', position: 'FWD', era: 'current', altClubs: ['Manchester United', 'Juventus'] },
  { id: 'messi', name: 'Lionel Messi', club: 'FC Barcelona', country: 'Argentina', position: 'FWD', era: 'current' },
  { id: 'henry', name: 'Thierry Henry', club: 'Arsenal', country: 'Francia', position: 'FWD', era: 'historic', altClubs: ['FC Barcelona', 'Juventus'] },
  { id: 'shearer', name: 'Alan Shearer', club: 'Newcastle', country: 'Inglaterra', position: 'FWD', era: 'historic' },
  { id: 'owen', name: 'Michael Owen', club: 'Liverpool', country: 'Inglaterra', position: 'FWD', era: 'historic' },
  { id: 'rooney', name: 'Wayne Rooney', club: 'Manchester United', country: 'Inglaterra', position: 'FWD', era: 'historic' },
  { id: 'cantona', name: 'Eric Cantona', club: 'Manchester United', country: 'Francia', position: 'FWD', era: 'historic' },
  { id: 'bergkamp', name: 'Dennis Bergkamp', club: 'Arsenal', country: 'Países Bajos', position: 'FWD', era: 'historic' },
  { id: 'van-basten', name: 'Marco van Basten', club: 'Milan', country: 'Países Bajos', position: 'FWD', era: 'historic' },
  { id: 'gullit', name: 'Ruud Gullit', club: 'Milan', country: 'Países Bajos', position: 'FWD', era: 'historic' },
  { id: 'van-nistelrooy', name: 'Ruud van Nistelrooy', club: 'Manchester United', altClubs: ['Real Madrid'], country: 'Países Bajos', position: 'FWD', era: 'historic' },
  { id: 'kluivert', name: 'Patrick Kluivert', club: 'FC Barcelona', altClubs: ['Milan', 'Newcastle', 'Valencia'], country: 'Países Bajos', position: 'FWD', era: 'historic' },
  { id: 'van-persie', name: 'Robin van Persie', club: 'Arsenal', altClubs: ['Manchester United', 'Feyenoord'], country: 'Países Bajos', position: 'FWD', era: 'historic' },
  { id: 'robben', name: 'Arjen Robben', club: 'Bayern Múnich', country: 'Países Bajos', position: 'FWD', era: 'historic', altClubs: ['Chelsea', 'Real Madrid'] },
  { id: 'overmars', name: 'Marc Overmars', club: 'Arsenal', altClubs: ['FC Barcelona'], country: 'Países Bajos', position: 'FWD', era: 'historic' },
  { id: 'raul', name: 'Raúl González', club: 'Real Madrid', country: 'España', position: 'FWD', era: 'historic' },
  { id: 'butragueno', name: 'Emilio Butragueño', club: 'Real Madrid', country: 'España', position: 'FWD', era: 'historic' },
  { id: 'morientes', name: 'Fernando Morientes', club: 'Real Madrid', altClubs: ['Liverpool', 'Valencia', 'Mónaco'], country: 'España', position: 'FWD', era: 'historic' },
  { id: 'villa', name: 'David Villa', club: 'Valencia', altClubs: ['FC Barcelona', 'Atlético de Madrid'], country: 'España', position: 'FWD', era: 'historic' },
  { id: 'torres', name: 'Fernando Torres', club: 'Liverpool', altClubs: ['Chelsea', 'Atlético de Madrid', 'Milan'], country: 'España', position: 'FWD', era: 'historic' },
  { id: 'pedro', name: 'Pedro Rodríguez', club: 'FC Barcelona', country: 'España', position: 'FWD', era: 'historic' },
  { id: 'kubala', name: 'Ladislao Kubala', club: 'FC Barcelona', country: 'España', position: 'FWD', era: 'historic' },
  { id: 'gento', name: 'Francisco Gento', club: 'Real Madrid', country: 'España', position: 'FWD', era: 'historic' },
  { id: 'stoichkov', name: 'Hristo Stoichkov', club: 'FC Barcelona', country: 'Bulgaria', position: 'FWD', era: 'historic' },
  { id: 'baggio-d', name: 'Christian Vieri', club: 'Internazionale', altClubs: ['Juventus', 'Milan', 'Lazio', 'Atlético de Madrid', 'Fiorentina', 'Mónaco'], country: 'Italia', position: 'FWD', era: 'historic' },
  { id: 'inzaghi-f', name: 'Filippo Inzaghi', club: 'Milan', altClubs: ['Juventus', 'Atalanta'], country: 'Italia', position: 'FWD', era: 'historic' },
  { id: 'shevchenko', name: 'Andriy Shevchenko', club: 'Milan', country: 'Ucrania', position: 'FWD', era: 'historic', altClubs: ['Chelsea'] },
  { id: 'weah', name: 'George Weah', club: 'Milan', altClubs: ['Paris Saint-Germain', 'Chelsea', 'Manchester City', 'Mónaco'], country: 'Liberia', position: 'FWD', era: 'historic' },
  { id: 'ronaldo-luiz', name: 'Adriano', club: 'Internazionale', country: 'Brasil', position: 'FWD', era: 'historic' },
  { id: 'crespo', name: 'Hernán Crespo', club: 'Lazio', country: 'Argentina', position: 'FWD', era: 'historic', altClubs: ['Internazionale', 'Milan', 'Chelsea'] },
  { id: 'batistuta', name: 'Gabriel Batistuta', club: 'Fiorentina', altClubs: ['Roma', 'Internazionale'], country: 'Argentina', position: 'FWD', era: 'historic' },
  { id: 'kempes', name: 'Mario Kempes', club: 'Valencia', country: 'Argentina', position: 'FWD', era: 'historic' },
  { id: 'tevez', name: 'Carlos Tevez', club: 'Manchester United', country: 'Argentina', position: 'FWD', era: 'historic', altClubs: ['Manchester City', 'Juventus'] },
  { id: 'aguero', name: 'Sergio Agüero', club: 'Manchester City', altClubs: ['Atlético de Madrid', 'FC Barcelona'], country: 'Argentina', position: 'FWD', era: 'historic' },
  { id: 'higuain', name: 'Gonzalo Higuaín', club: 'Real Madrid', country: 'Argentina', position: 'FWD', era: 'historic', altClubs: ['Napoli', 'Juventus', 'Milan'] },
  { id: 'ibra', name: 'Zlatan Ibrahimović', club: 'Milan', country: 'Suecia', position: 'FWD', era: 'historic', altClubs: ['Juventus', 'Internazionale', 'FC Barcelona', 'Paris Saint-Germain', 'Manchester United'] },
  { id: 'larsson', name: 'Henrik Larsson', club: 'Celtic', altClubs: ['FC Barcelona', 'Manchester United'], country: 'Suecia', position: 'FWD', era: 'historic' },
  { id: 'klinsmann', name: 'Jürgen Klinsmann', club: 'Tottenham', altClubs: ['Internazionale', 'Bayern Múnich', 'Mónaco', 'Sampdoria'], country: 'Alemania', position: 'FWD', era: 'historic' },
  { id: 'gomez-m', name: 'Mario Gómez', club: 'Bayern Múnich', altClubs: ['Fiorentina', 'Stuttgart'], country: 'Alemania', position: 'FWD', era: 'historic' },
  { id: 'klose', name: 'Miroslav Klose', club: 'Lazio', altClubs: ['Bayern Múnich'], country: 'Alemania', position: 'FWD', era: 'historic' },
  { id: 'podolski', name: 'Lukas Podolski', club: 'Arsenal', altClubs: ['Bayern Múnich', 'Internazionale', 'Galatasaray'], country: 'Alemania', position: 'FWD', era: 'historic' },
  { id: 'ronaldo-portu', name: 'Pauleta', club: 'Paris Saint-Germain', country: 'Portugal', position: 'FWD', era: 'historic' },
  { id: 'eusebio2', name: 'Mário Jardel', club: 'Sporting CP', country: 'Brasil', position: 'FWD', era: 'historic' },
  { id: 'forlan', name: 'Diego Forlán', club: 'Atlético de Madrid', altClubs: ['Manchester United', 'Villarreal', 'Internazionale'], country: 'Uruguay', position: 'FWD', era: 'historic' },
  { id: 'francescoli', name: 'Enzo Francescoli', club: 'River Plate', country: 'Uruguay', position: 'FWD', era: 'historic' },
  { id: 'eto-o', name: "Samuel Eto'o", club: 'FC Barcelona', country: 'Camerún', position: 'FWD', era: 'historic', altClubs: ['Internazionale'] },
  { id: 'drogba', name: 'Didier Drogba', club: 'Chelsea', altClubs: ['Marsella', 'Galatasaray'], country: 'Costa de Marfil', position: 'FWD', era: 'historic' },
  { id: 'okocha', name: 'Jay-Jay Okocha', club: 'Bolton', country: 'Nigeria', position: 'FWD', era: 'historic' },
  { id: 'kanu', name: 'Nwankwo Kanu', club: 'Arsenal', altClubs: ['Internazionale'], country: 'Nigeria', position: 'FWD', era: 'historic' },
  { id: 'milla', name: 'Roger Milla', club: 'Tonnerre Yaoundé', country: 'Camerún', position: 'FWD', era: 'historic' },
  { id: 'valderrama', name: 'Carlos Valderrama', club: 'Tampa Bay', country: 'Colombia', position: 'FWD', era: 'historic' },
  { id: 'asprilla', name: 'Faustino Asprilla', club: 'Newcastle', country: 'Colombia', position: 'FWD', era: 'historic' },
  { id: 'falcao-r', name: 'Radamel Falcao', club: 'Atlético de Madrid', altClubs: ['Manchester United', 'Chelsea', 'Mónaco'], country: 'Colombia', position: 'FWD', era: 'historic' },
  { id: 'hagi', name: 'Gheorghe Hagi', club: 'Galatasaray', altClubs: ['Real Madrid', 'FC Barcelona'], country: 'Rumanía', position: 'FWD', era: 'historic' },
  { id: 'stoichkov2', name: 'Krasimir Balakov', club: 'Stuttgart', country: 'Bulgaria', position: 'FWD', era: 'historic' },
  { id: 'salenko', name: 'Oleg Salenko', club: 'Valencia', country: 'Rusia', position: 'FWD', era: 'historic' },
  { id: 'davor-suker', name: 'Davor Šuker', club: 'Real Madrid', altClubs: ['Arsenal', 'West Ham'], country: 'Croacia', position: 'FWD', era: 'historic' },
  { id: 'boban', name: 'Zvonimir Boban', club: 'Milan', country: 'Croacia', position: 'FWD', era: 'historic' },
  { id: 'hazard', name: 'Eden Hazard', club: 'Chelsea', country: 'Bélgica', position: 'FWD', era: 'historic', altClubs: ['Real Madrid'] },
  { id: 'lukaku', name: 'Romelu Lukaku', club: 'Internazionale', country: 'Bélgica', position: 'FWD', era: 'historic', altClubs: ['Manchester United', 'Chelsea', 'Napoli', 'Roma'] },
  { id: 'mertens', name: 'Dries Mertens', club: 'Napoli', altClubs: ['Galatasaray'], country: 'Bélgica', position: 'FWD', era: 'historic' },
  { id: 'suarez-l', name: 'Luis Suárez', club: 'FC Barcelona', country: 'Uruguay', position: 'FWD', era: 'historic', altClubs: ['Liverpool', 'Atlético de Madrid'] },
  { id: 'cavani', name: 'Edinson Cavani', club: 'Paris Saint-Germain', altClubs: ['Napoli', 'Manchester United', 'Valencia'], country: 'Uruguay', position: 'FWD', era: 'historic' },
  { id: 'neymar', name: 'Neymar Jr.', club: 'FC Barcelona', country: 'Brasil', position: 'FWD', era: 'historic', altClubs: ['Paris Saint-Germain'] },
  { id: 'ronaldinho-2', name: 'Robinho', club: 'Real Madrid', altClubs: ['Manchester City', 'Milan', 'Santos'], country: 'Brasil', position: 'FWD', era: 'historic' },
  { id: 'fred', name: 'Fred', club: 'Fluminense', country: 'Brasil', position: 'FWD', era: 'historic' },
  { id: 'pato', name: 'Alexandre Pato', club: 'Milan', country: 'Brasil', position: 'FWD', era: 'historic' },
  { id: 'dempsey', name: 'Clint Dempsey', club: 'Fulham', country: 'Estados Unidos', position: 'FWD', era: 'historic' },
  { id: 'donovan', name: 'Landon Donovan', club: 'LA Galaxy', country: 'Estados Unidos', position: 'FWD', era: 'historic' },

  // Actuales
  { id: 'haaland', name: 'Erling Haaland', club: 'Manchester City', altClubs: ['Borussia Dortmund'], country: 'Noruega', position: 'FWD', era: 'current' },
  { id: 'mbappe', name: 'Kylian Mbappé', club: 'Real Madrid', altClubs: ['Paris Saint-Germain', 'Mónaco'], country: 'Francia', position: 'FWD', era: 'current' },
  { id: 'vinicius', name: 'Vinícius Júnior', club: 'Real Madrid', country: 'Brasil', position: 'FWD', era: 'current' },
  { id: 'rodrygo', name: 'Rodrygo', club: 'Real Madrid', country: 'Brasil', position: 'FWD', era: 'current' },
  { id: 'joselu', name: 'Joselu', club: 'Al-Gharafa', country: 'España', position: 'FWD', era: 'current' },
  { id: 'lewandowski', name: 'Robert Lewandowski', club: 'FC Barcelona', altClubs: ['Bayern Múnich', 'Borussia Dortmund'], country: 'Polonia', position: 'FWD', era: 'current' },
  { id: 'raphinha', name: 'Raphinha', club: 'FC Barcelona', country: 'Brasil', position: 'FWD', era: 'current' },
  { id: 'yamal', name: 'Lamine Yamal', club: 'FC Barcelona', country: 'España', position: 'FWD', era: 'current' },
  { id: 'lewa-ferran', name: 'Ferran Torres', club: 'FC Barcelona', country: 'España', position: 'FWD', era: 'current' },
  { id: 'griezmann2', name: 'Álvaro Morata', club: 'Milan', country: 'España', position: 'FWD', era: 'current', altClubs: ['Real Madrid', 'Juventus', 'Atlético de Madrid'] },
  { id: 'felix', name: 'João Félix', club: 'Atlético de Madrid', altClubs: ['Chelsea', 'FC Barcelona', 'Benfica'], country: 'Portugal', position: 'FWD', era: 'current' },
  { id: 'depay', name: 'Memphis Depay', club: 'Atlético de Madrid', altClubs: ['Manchester United', 'FC Barcelona'], country: 'Países Bajos', position: 'FWD', era: 'current' },
  { id: 'sorloth', name: 'Alexander Sørloth', club: 'Atlético de Madrid', country: 'Noruega', position: 'FWD', era: 'current' },
  { id: 'correa', name: 'Ángel Correa', club: 'Atlético de Madrid', country: 'Argentina', position: 'FWD', era: 'current' },
  { id: 'salah', name: 'Mohamed Salah', club: 'Liverpool', country: 'Egipto', position: 'FWD', era: 'current' },
  { id: 'mane', name: 'Sadio Mané', club: 'Liverpool', altClubs: ['Bayern Múnich'], country: 'Senegal', position: 'FWD', era: 'current' },
  { id: 'firmino', name: 'Roberto Firmino', club: 'Liverpool', altClubs: ['Al-Ahli'], country: 'Brasil', position: 'FWD', era: 'current' },
  { id: 'nunez', name: 'Darwin Núñez', club: 'Liverpool', country: 'Uruguay', position: 'FWD', era: 'current' },
  { id: 'diaz-l', name: 'Luis Díaz', club: 'Liverpool', country: 'Colombia', position: 'FWD', era: 'current' },
  { id: 'jota-d', name: 'Diogo Jota', club: 'Liverpool', country: 'Portugal', position: 'FWD', era: 'current' },
  { id: 'saka', name: 'Bukayo Saka', club: 'Arsenal', country: 'Inglaterra', position: 'FWD', era: 'current' },
  { id: 'martinelli', name: 'Gabriel Martinelli', club: 'Arsenal', country: 'Brasil', position: 'FWD', era: 'current' },
  { id: 'jesus', name: 'Gabriel Jesus', club: 'Arsenal', country: 'Brasil', position: 'FWD', era: 'current' },
  { id: 'trossard', name: 'Leandro Trossard', club: 'Arsenal', country: 'Bélgica', position: 'FWD', era: 'current' },
  { id: 'son', name: 'Son Heung-min', club: 'Tottenham', altClubs: ['Bayer Leverkusen'], country: 'Corea del Sur', position: 'FWD', era: 'current' },
  { id: 'kane', name: 'Harry Kane', club: 'Bayern Múnich', altClubs: ['Tottenham'], country: 'Inglaterra', position: 'FWD', era: 'current' },
  { id: 'richarlison', name: 'Richarlison', club: 'Tottenham', country: 'Brasil', position: 'FWD', era: 'current' },
  { id: 'kulusevski', name: 'Dejan Kulusevski', club: 'Tottenham', country: 'Suecia', position: 'FWD', era: 'current' },
  { id: 'sterling', name: 'Raheem Sterling', club: 'Chelsea', altClubs: ['Manchester City', 'Liverpool', 'Arsenal'], country: 'Inglaterra', position: 'FWD', era: 'current' },
  { id: 'jackson-n', name: 'Nicolas Jackson', club: 'Chelsea', country: 'Senegal', position: 'FWD', era: 'current' },
  { id: 'mudryk', name: 'Mykhailo Mudryk', club: 'Chelsea', country: 'Ucrania', position: 'FWD', era: 'current' },
  { id: 'rashford', name: 'Marcus Rashford', club: 'Manchester United', altClubs: ['Aston Villa', 'FC Barcelona'], country: 'Inglaterra', position: 'FWD', era: 'current' },
  { id: 'garnacho', name: 'Alejandro Garnacho', club: 'Manchester United', country: 'Argentina', position: 'FWD', era: 'current' },
  { id: 'antony', name: 'Antony', club: 'Manchester United', country: 'Brasil', position: 'FWD', era: 'current' },
  { id: 'hojlund', name: 'Rasmus Højlund', club: 'Manchester United', country: 'Dinamarca', position: 'FWD', era: 'current' },
  { id: 'haaland-ruben', name: 'Julián Álvarez', club: 'Atlético de Madrid', altClubs: ['Manchester City', 'River Plate'], country: 'Argentina', position: 'FWD', era: 'current' },
  { id: 'doku', name: 'Jérémy Doku', club: 'Manchester City', country: 'Bélgica', position: 'FWD', era: 'current' },
  { id: 'grealish', name: 'Jack Grealish', club: 'Manchester City', altClubs: ['Aston Villa', 'Everton'], country: 'Inglaterra', position: 'FWD', era: 'current' },
  { id: 'savinho', name: 'Sávio', club: 'Manchester City', country: 'Brasil', position: 'FWD', era: 'current' },
  { id: 'thuram-m', name: 'Marcus Thuram', club: 'Internazionale', country: 'Francia', position: 'FWD', era: 'current' },
  { id: 'lautaro', name: 'Lautaro Martínez', club: 'Internazionale', country: 'Argentina', position: 'FWD', era: 'current' },
  { id: 'taremi', name: 'Mehdi Taremi', club: 'Internazionale', country: 'Irán', position: 'FWD', era: 'current' },
  { id: 'leao', name: 'Rafael Leão', club: 'Milan', altClubs: ['Sporting CP'], country: 'Portugal', position: 'FWD', era: 'current' },
  { id: 'giroud', name: 'Olivier Giroud', club: 'LAFC', altClubs: ['Arsenal', 'Chelsea', 'Milan'], country: 'Francia', position: 'FWD', era: 'current' },
  { id: 'osimhen', name: 'Victor Osimhen', club: 'Napoli', country: 'Nigeria', position: 'FWD', era: 'current' },
  { id: 'kvara', name: 'Khvicha Kvaratskhelia', club: 'Napoli', country: 'Georgia', position: 'FWD', era: 'current' },
  { id: 'lookman', name: 'Ademola Lookman', club: 'Atalanta', country: 'Nigeria', position: 'FWD', era: 'current' },
  { id: 'retegui', name: 'Mateo Retegui', club: 'Atalanta', country: 'Italia', position: 'FWD', era: 'current' },
  { id: 'vlahovic', name: 'Dušan Vlahović', club: 'Juventus', country: 'Serbia', position: 'FWD', era: 'current' },
  { id: 'chiesa', name: 'Federico Chiesa', club: 'Liverpool', altClubs: ['Juventus', 'Fiorentina'], country: 'Italia', position: 'FWD', era: 'current' },
  { id: 'yildiz', name: 'Kenan Yıldız', club: 'Juventus', country: 'Turquía', position: 'FWD', era: 'current' },
  { id: 'thuram-f', name: 'Khéphren Thuram', club: 'Juventus', country: 'Francia', position: 'MID', era: 'current' },
  { id: 'gnabry', name: 'Serge Gnabry', club: 'Bayern Múnich', country: 'Alemania', position: 'FWD', era: 'current' },
  { id: 'olise', name: 'Michael Olise', club: 'Bayern Múnich', country: 'Francia', position: 'FWD', era: 'current' },
  { id: 'coman', name: 'Kingsley Coman', club: 'Bayern Múnich', country: 'Francia', position: 'FWD', era: 'current' },
  { id: 'dembele-o', name: 'Ousmane Dembélé', club: 'Paris Saint-Germain', country: 'Francia', position: 'FWD', era: 'current' },
  { id: 'barcola', name: 'Bradley Barcola', club: 'Paris Saint-Germain', country: 'Francia', position: 'FWD', era: 'current' },
  { id: 'kolo-muani', name: 'Randal Kolo Muani', club: 'Paris Saint-Germain', country: 'Francia', position: 'FWD', era: 'current' },
  { id: 'asensio', name: 'Marco Asensio', club: 'Paris Saint-Germain', country: 'España', position: 'FWD', era: 'current' },
  { id: 'aubameyang', name: 'Pierre-Emerick Aubameyang', club: 'Marsella', altClubs: ['Arsenal', 'FC Barcelona', 'Chelsea', 'Borussia Dortmund'], country: 'Gabón', position: 'FWD', era: 'historic' },
  { id: 'icardi', name: 'Mauro Icardi', club: 'Galatasaray', altClubs: ['Internazionale', 'Paris Saint-Germain', 'Sampdoria'], country: 'Argentina', position: 'FWD', era: 'historic' },
  { id: 'mertens-f', name: 'Boniface', club: 'Bayer Leverkusen', country: 'Nigeria', position: 'FWD', era: 'current' },
  { id: 'alvarez-j2', name: 'Iago Aspas', club: 'Celta de Vigo', country: 'España', position: 'FWD', era: 'current' },
  { id: 'oyarzabal', name: 'Mikel Oyarzabal', club: 'Real Sociedad', country: 'España', position: 'FWD', era: 'current' },
  { id: 'williams-i', name: 'Iñaki Williams', club: 'Athletic Club', country: 'Ghana', position: 'FWD', era: 'current' },
  { id: 'williams-n', name: 'Nico Williams', club: 'Athletic Club', country: 'España', position: 'FWD', era: 'current' },
  { id: 'sancet', name: 'Oihan Sancet', club: 'Athletic Club', country: 'España', position: 'FWD', era: 'current' },
  { id: 'iago-aspas2', name: 'Borja Iglesias', club: 'Real Betis', country: 'España', position: 'FWD', era: 'current' },
  { id: 'bakambu', name: 'Cédric Bakambu', club: 'Real Betis', country: 'RD Congo', position: 'FWD', era: 'current' },
  { id: 'enciso', name: 'Julio Enciso', club: 'Brighton', country: 'Paraguay', position: 'FWD', era: 'current' },
  { id: 'mitoma', name: 'Kaoru Mitoma', club: 'Brighton', country: 'Japón', position: 'FWD', era: 'current' },
  { id: 'isak', name: 'Alexander Isak', club: 'Newcastle', country: 'Suecia', position: 'FWD', era: 'current' },
  { id: 'gordon-a', name: 'Anthony Gordon', club: 'Newcastle', country: 'Inglaterra', position: 'FWD', era: 'current' },
  { id: 'watkins', name: 'Ollie Watkins', club: 'Aston Villa', country: 'Inglaterra', position: 'FWD', era: 'current' },
  { id: 'ramsey-j', name: 'Jacob Ramsey', club: 'Aston Villa', country: 'Inglaterra', position: 'MID', era: 'current' },
  { id: 'mitchell-p', name: 'Phil Mitchell', club: 'Crystal Palace', country: 'Inglaterra', position: 'FWD', era: 'current' },
  { id: 'eze', name: 'Eberechi Eze', club: 'Crystal Palace', country: 'Inglaterra', position: 'MID', era: 'current' },
  { id: 'olise-m', name: 'Jean-Philippe Mateta', club: 'Crystal Palace', country: 'Francia', position: 'FWD', era: 'current' },
  { id: 'simeone-g', name: 'Giovanni Simeone', club: 'Napoli', country: 'Argentina', position: 'FWD', era: 'current' },
  { id: 'gimenez-s', name: 'Santiago Giménez', club: 'Feyenoord', country: 'México', position: 'FWD', era: 'current' },
  { id: 'guirassy', name: 'Serhou Guirassy', club: 'Borussia Dortmund', country: 'Guinea', position: 'FWD', era: 'current' },
  { id: 'sabitzer', name: 'Marcel Sabitzer', club: 'Borussia Dortmund', country: 'Austria', position: 'MID', era: 'current' },
  { id: 'reus', name: 'Marco Reus', club: 'LA Galaxy', altClubs: ['Borussia Dortmund'], country: 'Alemania', position: 'FWD', era: 'current' },
  { id: 'sancho', name: 'Jadon Sancho', club: 'Borussia Dortmund', altClubs: ['Manchester United', 'Chelsea'], country: 'Inglaterra', position: 'FWD', era: 'current' },
  { id: 'adeyemi', name: 'Karim Adeyemi', club: 'Borussia Dortmund', country: 'Alemania', position: 'FWD', era: 'current' },
  { id: 'fullkrug', name: 'Niclas Füllkrug', club: 'West Ham', country: 'Alemania', position: 'FWD', era: 'current' },
  { id: 'havertz-2', name: 'Timo Werner', club: 'RB Leipzig', altClubs: ['Chelsea', 'Tottenham'], country: 'Alemania', position: 'FWD', era: 'current' },
  { id: 'openda', name: 'Loïs Openda', club: 'RB Leipzig', country: 'Bélgica', position: 'FWD', era: 'current' },
  { id: 'sesko', name: 'Benjamin Šeško', club: 'RB Leipzig', country: 'Eslovenia', position: 'FWD', era: 'current' },
  { id: 'moukoko', name: 'Youssoufa Moukoko', club: 'Niza', country: 'Alemania', position: 'FWD', era: 'current' },
  { id: 'colo', name: 'Folarin Balogun', club: 'Mónaco', country: 'Estados Unidos', position: 'FWD', era: 'current' },
  { id: 'thauvin', name: 'Florian Thauvin', club: 'Udinese', altClubs: ['Marsella'], country: 'Francia', position: 'FWD', era: 'current' },
  { id: 'benzema', name: 'Karim Benzema', club: 'Al-Ittihad', altClubs: ['Real Madrid'], country: 'Francia', position: 'FWD', era: 'current' },
  { id: 'jovic', name: 'Luka Jović', club: 'Milan', altClubs: ['Real Madrid', 'Eintracht Frankfurt', 'Benfica'], country: 'Serbia', position: 'FWD', era: 'current' },
  { id: 'kean', name: 'Moise Kean', club: 'Fiorentina', altClubs: ['Juventus', 'Paris Saint-Germain', 'Everton'], country: 'Italia', position: 'FWD', era: 'current' },
  { id: 'zaniolo', name: 'Nicolò Zaniolo', club: 'Fiorentina', country: 'Italia', position: 'FWD', era: 'current' },
  { id: 'modeste', name: 'Anthony Modeste', club: 'St. Pauli', country: 'Francia', position: 'FWD', era: 'current' },
]

// ── Catálogo combinado ────────────────────────────────────────────
export const PLAYERS: Player[] = [...GK, ...DEF, ...MID, ...FWD]

// Quitar duplicados accidentales por id (defensivo)
const seen = new Set<string>()
export const PLAYERS_DEDUP: Player[] = PLAYERS.filter(p => {
  if (seen.has(p.id)) return false
  seen.add(p.id)
  return true
})

// ── Búsqueda ──────────────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface SearchOptions {
  position?: PlayerPosition
  era?: PlayerEra
  excludeIds?: string[]
  limit?: number
}

export function searchPlayers(query: string, opts: SearchOptions = {}): Player[] {
  const q = normalize(query)
  const exclude = new Set(opts.excludeIds ?? [])
  const limit = opts.limit ?? 30

  const candidates = PLAYERS_DEDUP.filter(p => {
    if (opts.position && p.position !== opts.position) return false
    if (opts.era && p.era !== opts.era) return false
    if (exclude.has(p.id)) return false
    return true
  })

  if (!q) return candidates.slice(0, limit)

  const scored = candidates
    .map(p => {
      const name = normalize(p.name)
      const club = normalize(p.club)
      let score = 0
      if (name.startsWith(q)) score += 100
      else if (name.includes(' ' + q)) score += 60
      else if (name.includes(q)) score += 30
      if (club.startsWith(q)) score += 20
      else if (club.includes(q)) score += 10
      return { p, score }
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.p)

  return scored
}

export function getPlayerById(id: string): Player | undefined {
  return PLAYERS_DEDUP.find(p => p.id === id)
}

// Lista de clubes reconocidos de un jugador: el principal (`club`, usado para
// display, búsqueda y noRepeatClub) más los `altClubs` opcionales. Para resolver
// condiciones "X × club" (TakaGrid) o slots de club (Mi Once) basta con cumplir
// CUALQUIERA de ellos.
export function playerClubs(p: Player): string[] {
  return p.altClubs && p.altClubs.length > 0 ? [p.club, ...p.altClubs] : [p.club]
}

// Levenshtein distance with early exit at `cap`
function levenshtein(a: string, b: string, cap: number): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > cap) return cap + 1
  const al = a.length, bl = b.length
  if (al === 0) return bl
  if (bl === 0) return al
  const prev = new Array(bl + 1)
  const curr = new Array(bl + 1)
  for (let j = 0; j <= bl; j++) prev[j] = j
  for (let i = 1; i <= al; i++) {
    curr[0] = i
    let rowMin = curr[0]
    for (let j = 1; j <= bl; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
      if (curr[j] < rowMin) rowMin = curr[j]
    }
    if (rowMin > cap) return cap + 1
    for (let j = 0; j <= bl; j++) prev[j] = curr[j]
  }
  return prev[bl]
}

// Fuzzy fallback for typos. Returns players whose name (or any name token) is
// within Levenshtein distance ≤ 2 of the query. Useful when exact search yields nothing.
export function fuzzySearchPlayers(query: string, opts: SearchOptions = {}): Player[] {
  const q = normalize(query)
  if (q.length < 3) return []
  const exclude = new Set(opts.excludeIds ?? [])
  const limit = opts.limit ?? 5
  const cap = q.length <= 4 ? 1 : 2

  const candidates = PLAYERS_DEDUP.filter(p => {
    if (opts.position && p.position !== opts.position) return false
    if (opts.era && p.era !== opts.era) return false
    if (exclude.has(p.id)) return false
    return true
  })

  const scored: Array<{ p: Player; dist: number }> = []
  for (const p of candidates) {
    const tokens = normalize(p.name).split(' ').filter(Boolean)
    let best = cap + 1
    for (const t of tokens) {
      if (t.length < q.length - cap || t.length > q.length + cap) continue
      const d = levenshtein(t, q, cap)
      if (d < best) best = d
      if (best === 0) break
    }
    if (best <= cap && best > 0) scored.push({ p, dist: best })
  }
  scored.sort((a, b) => a.dist - b.dist)
  return scored.slice(0, limit).map(x => x.p)
}
