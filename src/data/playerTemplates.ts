import type { Position } from '@/types/game';

export interface PlayerTemplate {
  fn: string;
  ln: string;
  pos: Position;
  age: number;
  nat: string;
  ovr: number;
  pot?: number;
}

export const CLUB_TEMPLATES: Record<string, PlayerTemplate[]> = {
  // ═══ DIV-1: Monarch Premier League (20 clubs) ═══

  'crown-city': [
    { fn: 'Erling', ln: 'Haagland', pos: 'ST', age: 25, nat: 'Norway', ovr: 91 },
    { fn: 'Rodrigo', ln: 'Hernando', pos: 'CDM', age: 29, nat: 'Spain', ovr: 89 },
    { fn: 'Kevin', ln: 'De Bruin', pos: 'CM', age: 34, nat: 'Belgium', ovr: 85 },
    { fn: 'Phil', ln: 'Foyden', pos: 'CAM', age: 25, nat: 'England', ovr: 87 },
    { fn: 'Bernardo', ln: 'Silvo', pos: 'CM', age: 31, nat: 'Portugal', ovr: 84 },
    { fn: 'Edersen', ln: 'Moraez', pos: 'GK', age: 32, nat: 'Brazil', ovr: 84 },
    { fn: 'Ruben', ln: 'Dios', pos: 'CB', age: 28, nat: 'Portugal', ovr: 85 },
    { fn: 'Josko', ln: 'Gvardiola', pos: 'CB', age: 23, nat: 'Croatia', ovr: 83 },
    { fn: 'Jeremy', ln: 'Dokou', pos: 'RW', age: 23, nat: 'Belgium', ovr: 80 },
    { fn: 'Jack', ln: 'Greilish', pos: 'LW', age: 30, nat: 'England', ovr: 80 },
    { fn: 'Rico', ln: 'Lewes', pos: 'RB', age: 22, nat: 'England', ovr: 78, pot: 86 },
    { fn: 'Savino', ln: 'Ferreira', pos: 'RW', age: 21, nat: 'Brazil', ovr: 78, pot: 87 },
  ],

  'redfield-utd': [
    { fn: 'Bruno', ln: 'Fernandos', pos: 'CAM', age: 30, nat: 'Portugal', ovr: 86 },
    { fn: 'Andre', ln: 'Onano', pos: 'GK', age: 29, nat: 'Cameroon', ovr: 84 },
    { fn: 'Lisandro', ln: 'Martinoz', pos: 'CB', age: 27, nat: 'Argentina', ovr: 83 },
    { fn: 'Marcus', ln: 'Rashforth', pos: 'LW', age: 27, nat: 'England', ovr: 82 },
    { fn: 'Casimero', ln: 'Santos', pos: 'CDM', age: 33, nat: 'Brazil', ovr: 77 },
    { fn: 'Luke', ln: 'Shawe', pos: 'LB', age: 29, nat: 'England', ovr: 80 },
    { fn: 'Amad', ln: 'Dialo', pos: 'RW', age: 22, nat: 'Ivory Coast', ovr: 79 },
    { fn: 'Rasmus', ln: 'Hoyland', pos: 'ST', age: 22, nat: 'Denmark', ovr: 79, pot: 86 },
    { fn: 'Mason', ln: 'Mounty', pos: 'CM', age: 26, nat: 'England', ovr: 79 },
    { fn: 'Kobbie', ln: 'Manino', pos: 'CM', age: 19, nat: 'England', ovr: 78, pot: 88 },
    { fn: 'Diogo', ln: 'Dalotto', pos: 'RB', age: 26, nat: 'Portugal', ovr: 78 },
    { fn: 'Alejandro', ln: 'Garnach', pos: 'LW', age: 21, nat: 'Argentina', ovr: 78, pot: 86 },
  ],

  'ashford-fc': [
    { fn: 'Bukayo', ln: 'Sakka', pos: 'RW', age: 23, nat: 'England', ovr: 88 },
    { fn: 'Martin', ln: 'Odegard', pos: 'CAM', age: 26, nat: 'Norway', ovr: 88 },
    { fn: 'William', ln: 'Salibba', pos: 'CB', age: 24, nat: 'France', ovr: 87 },
    { fn: 'Declan', ln: 'Ryce', pos: 'CDM', age: 26, nat: 'England', ovr: 86 },
    { fn: 'David', ln: 'Rayo', pos: 'GK', age: 29, nat: 'Spain', ovr: 85 },
    { fn: 'Gabriel', ln: 'Magalhas', pos: 'CB', age: 27, nat: 'Brazil', ovr: 85 },
    { fn: 'Kai', ln: 'Haverz', pos: 'ST', age: 26, nat: 'Germany', ovr: 83 },
    { fn: 'Gabriel', ln: 'Martineli', pos: 'LW', age: 24, nat: 'Brazil', ovr: 82 },
    { fn: 'Ben', ln: 'Whyte', pos: 'CB', age: 27, nat: 'England', ovr: 82 },
    { fn: 'Leandro', ln: 'Trossart', pos: 'LW', age: 30, nat: 'Belgium', ovr: 81 },
    { fn: 'Jurrien', ln: 'Timba', pos: 'RB', age: 24, nat: 'Netherlands', ovr: 80 },
    { fn: 'Oleksandr', ln: 'Zinchenkó', pos: 'LB', age: 28, nat: 'Ukraine', ovr: 79 },
  ],

  'merseyside-fc': [
    { fn: 'Alisson', ln: 'Beckar', pos: 'GK', age: 32, nat: 'Brazil', ovr: 88 },
    { fn: 'Mohamed', ln: 'Saleh', pos: 'RW', age: 33, nat: 'Egypt', ovr: 85 },
    { fn: 'Virgil', ln: 'Van Dyke', pos: 'CB', age: 34, nat: 'Netherlands', ovr: 83 },
    { fn: 'Trent', ln: 'Alexander-Arnoldi', pos: 'RB', age: 26, nat: 'England', ovr: 86 },
    { fn: 'Alexis', ln: 'MacAlliston', pos: 'CM', age: 26, nat: 'Argentina', ovr: 84 },
    { fn: 'Ibrahima', ln: 'Konata', pos: 'CB', age: 25, nat: 'France', ovr: 84 },
    { fn: 'Darwin', ln: 'Nunoz', pos: 'ST', age: 26, nat: 'Uruguay', ovr: 83 },
    { fn: 'Luis', ln: 'Dioz', pos: 'LW', age: 28, nat: 'Colombia', ovr: 83 },
    { fn: 'Cody', ln: 'Gakpa', pos: 'LW', age: 25, nat: 'Netherlands', ovr: 83 },
    { fn: 'Dominik', ln: 'Szobozslai', pos: 'CAM', age: 25, nat: 'Hungary', ovr: 82 },
    { fn: 'Ryan', ln: 'Gravenberg', pos: 'CM', age: 22, nat: 'Netherlands', ovr: 80, pot: 87 },
    { fn: 'Curtis', ln: 'Jonez', pos: 'CM', age: 23, nat: 'England', ovr: 78, pot: 84 },
  ],

  'royal-blues': [
    { fn: 'Cole', ln: 'Palmers', pos: 'RW', age: 23, nat: 'England', ovr: 86 },
    { fn: 'Enzo', ln: 'Fernandoz', pos: 'CM', age: 24, nat: 'Argentina', ovr: 83 },
    { fn: 'Moises', ln: 'Caiceda', pos: 'CDM', age: 23, nat: 'Ecuador', ovr: 83 },
    { fn: 'Christopher', ln: 'Nkunka', pos: 'ST', age: 27, nat: 'France', ovr: 82 },
    { fn: 'Wesley', ln: 'Fofano', pos: 'CB', age: 24, nat: 'France', ovr: 80 },
    { fn: 'Noni', ln: 'Madueki', pos: 'RW', age: 22, nat: 'England', ovr: 80 },
    { fn: 'Romeo', ln: 'Lavio', pos: 'CM', age: 21, nat: 'Belgium', ovr: 80, pot: 87 },
    { fn: 'Robert', ln: 'Sanchéz', pos: 'GK', age: 27, nat: 'Spain', ovr: 80 },
    { fn: 'Nicolas', ln: 'Jacksen', pos: 'ST', age: 23, nat: 'Senegal', ovr: 79 },
    { fn: 'Levi', ln: 'Colwel', pos: 'CB', age: 22, nat: 'England', ovr: 79, pot: 85 },
    { fn: 'Marc', ln: 'Cucurelo', pos: 'LB', age: 26, nat: 'Spain', ovr: 78 },
    { fn: 'Mykhailo', ln: 'Mudrýk', pos: 'LW', age: 24, nat: 'Ukraine', ovr: 77 },
  ],

  'north-wanderers': [
    { fn: 'Heung-Min', ln: 'Son', pos: 'LW', age: 33, nat: 'South Korea', ovr: 83 },
    { fn: 'Cristian', ln: 'Romera', pos: 'CB', age: 27, nat: 'Argentina', ovr: 84 },
    { fn: 'James', ln: 'Maddisone', pos: 'CAM', age: 28, nat: 'England', ovr: 83 },
    { fn: 'Dejan', ln: 'Kulusevsky', pos: 'RW', age: 25, nat: 'Sweden', ovr: 82 },
    { fn: 'Micky', ln: 'Van de Veen', pos: 'CB', age: 24, nat: 'Netherlands', ovr: 82, pot: 87 },
    { fn: 'Guglielmo', ln: 'Vicaria', pos: 'GK', age: 28, nat: 'Italy', ovr: 82 },
    { fn: 'Rodrigo', ln: 'Bentancourt', pos: 'CM', age: 28, nat: 'Uruguay', ovr: 81 },
    { fn: 'Yves', ln: 'Bissoume', pos: 'CDM', age: 29, nat: 'Mali', ovr: 80 },
    { fn: 'Pedro', ln: 'Porró', pos: 'RB', age: 25, nat: 'Spain', ovr: 80 },
    { fn: 'Brennan', ln: 'Johnsen', pos: 'RW', age: 24, nat: 'Wales', ovr: 79 },
    { fn: 'Destiny', ln: 'Udoghie', pos: 'LB', age: 22, nat: 'Italy', ovr: 78, pot: 85 },
    { fn: 'Richarlisón', ln: 'Silva', pos: 'ST', age: 28, nat: 'Brazil', ovr: 79 },
  ],

  'tyneside-utd': [
    { fn: 'Alexander', ln: 'Isàk', pos: 'ST', age: 25, nat: 'Sweden', ovr: 86 },
    { fn: 'Bruno', ln: 'Guimaraez', pos: 'CM', age: 27, nat: 'Brazil', ovr: 85 },
    { fn: 'Sandro', ln: 'Tonáli', pos: 'CM', age: 25, nat: 'Italy', ovr: 82 },
    { fn: 'Anthony', ln: 'Gordón', pos: 'LW', age: 24, nat: 'England', ovr: 82 },
    { fn: 'Nick', ln: 'Popé', pos: 'GK', age: 33, nat: 'England', ovr: 80 },
    { fn: 'Sven', ln: 'Botmann', pos: 'CB', age: 25, nat: 'Netherlands', ovr: 81 },
    { fn: 'Harvey', ln: 'Barnés', pos: 'LW', age: 27, nat: 'England', ovr: 80 },
    { fn: 'Dan', ln: 'Burne', pos: 'CB', age: 33, nat: 'England', ovr: 78 },
    { fn: 'Joelintón', ln: 'Cassio', pos: 'CM', age: 28, nat: 'Brazil', ovr: 79 },
    { fn: 'Kieran', ln: 'Trippiar', pos: 'RB', age: 35, nat: 'England', ovr: 74 },
    { fn: 'Lewis', ln: 'Halley', pos: 'LB', age: 20, nat: 'England', ovr: 76, pot: 84 },
  ],

  'aston-bridge': [
    { fn: 'Emiliano', ln: 'Martinoz', pos: 'GK', age: 32, nat: 'Argentina', ovr: 85 },
    { fn: 'Ollie', ln: 'Wotkins', pos: 'ST', age: 29, nat: 'England', ovr: 84 },
    { fn: 'Pau', ln: 'Torrez', pos: 'CB', age: 28, nat: 'Spain', ovr: 82 },
    { fn: 'Youri', ln: 'Tielemàns', pos: 'CM', age: 28, nat: 'Belgium', ovr: 81 },
    { fn: 'Boubacar', ln: 'Kamará', pos: 'CDM', age: 25, nat: 'France', ovr: 81 },
    { fn: 'John', ln: 'McGin', pos: 'CM', age: 31, nat: 'Scotland', ovr: 81 },
    { fn: 'Leon', ln: 'Bailéy', pos: 'RW', age: 28, nat: 'Jamaica', ovr: 80 },
    { fn: 'Moussa', ln: 'Diabý', pos: 'RW', age: 25, nat: 'France', ovr: 80 },
    { fn: 'Ezri', ln: 'Konz', pos: 'CB', age: 27, nat: 'England', ovr: 80 },
    { fn: 'Morgan', ln: 'Rogérs', pos: 'CAM', age: 22, nat: 'England', ovr: 79, pot: 86 },
    { fn: 'Amadou', ln: 'Onanà', pos: 'CDM', age: 23, nat: 'Belgium', ovr: 79 },
    { fn: 'Lucas', ln: 'Digné', pos: 'LB', age: 32, nat: 'France', ovr: 79 },
  ],

  'western-hammers': [
    { fn: 'Jarrod', ln: 'Bowén', pos: 'RW', age: 28, nat: 'England', ovr: 82 },
    { fn: 'Lucas', ln: 'Paketa', pos: 'CM', age: 28, nat: 'Brazil', ovr: 82 },
    { fn: 'Mohammed', ln: 'Kudùs', pos: 'CAM', age: 24, nat: 'Ghana', ovr: 81 },
    { fn: 'Edson', ln: 'Alvaréz', pos: 'CDM', age: 27, nat: 'Mexico', ovr: 79 },
    { fn: 'Niclas', ln: 'Fullkrüg', pos: 'ST', age: 32, nat: 'Germany', ovr: 79 },
    { fn: 'Tomas', ln: 'Souchek', pos: 'CDM', age: 30, nat: 'Czech Republic', ovr: 79 },
    { fn: 'Alphonse', ln: 'Areoula', pos: 'GK', age: 32, nat: 'France', ovr: 79 },
    { fn: 'Kurt', ln: 'Zumá', pos: 'CB', age: 30, nat: 'France', ovr: 77 },
    { fn: 'Emerson', ln: 'Palmiéri', pos: 'LB', age: 30, nat: 'Italy', ovr: 77 },
    { fn: 'Vladimir', ln: 'Coufall', pos: 'RB', age: 32, nat: 'Czech Republic', ovr: 77 },
  ],

  'brighton-shore': [
    { fn: 'Kaoru', ln: 'Mitomà', pos: 'LW', age: 28, nat: 'Japan', ovr: 82 },
    { fn: 'Joao', ln: 'Pédro', pos: 'ST', age: 23, nat: 'Brazil', ovr: 80 },
    { fn: 'Pervis', ln: 'Estupiñàn', pos: 'LB', age: 27, nat: 'Ecuador', ovr: 80 },
    { fn: 'Lewis', ln: 'Dunke', pos: 'CB', age: 33, nat: 'England', ovr: 77 },
    { fn: 'Evan', ln: 'Fergusen', pos: 'ST', age: 20, nat: 'Ireland', ovr: 78, pot: 88 },
    { fn: 'Carlos', ln: 'Balába', pos: 'CM', age: 21, nat: 'Cameroon', ovr: 77, pot: 85 },
    { fn: 'Bart', ln: 'Verbrugge', pos: 'GK', age: 22, nat: 'Netherlands', ovr: 77, pot: 85 },
    { fn: 'Julio', ln: 'Encisa', pos: 'CAM', age: 21, nat: 'Paraguay', ovr: 77, pot: 85 },
    { fn: 'Jack', ln: 'Hinshelwod', pos: 'RB', age: 19, nat: 'England', ovr: 75, pot: 84 },
    { fn: 'Danny', ln: 'Welbéck', pos: 'ST', age: 34, nat: 'England', ovr: 73 },
    { fn: 'James', ln: 'Milnar', pos: 'CM', age: 25, nat: 'England', ovr: 78 },
  ],

  'wolverton': [
    { fn: 'Matheus', ln: 'Cunhà', pos: 'ST', age: 26, nat: 'Brazil', ovr: 82 },
    { fn: 'Joao', ln: 'Gomés', pos: 'CM', age: 23, nat: 'Brazil', ovr: 79 },
    { fn: 'Rayan', ln: 'Ait-Nourri', pos: 'LB', age: 23, nat: 'Algeria', ovr: 79 },
    { fn: 'José', ln: 'Sà', pos: 'GK', age: 31, nat: 'Portugal', ovr: 79 },
    { fn: 'Hwang', ln: 'Hee-Chàn', pos: 'ST', age: 29, nat: 'South Korea', ovr: 78 },
    { fn: 'Mario', ln: 'Lemena', pos: 'CDM', age: 31, nat: 'Gabon', ovr: 77 },
    { fn: 'Nelson', ln: 'Semedu', pos: 'RB', age: 31, nat: 'Portugal', ovr: 78 },
    { fn: 'Pablo', ln: 'Sarabi', pos: 'CAM', age: 32, nat: 'Spain', ovr: 77 },
    { fn: 'Craig', ln: 'Dawsón', pos: 'CB', age: 34, nat: 'England', ovr: 72 },
    { fn: 'Toti', ln: 'Gomez', pos: 'CB', age: 25, nat: 'Portugal', ovr: 76 },
  ],

  'everton-blue': [
    { fn: 'Jordan', ln: 'Pickforde', pos: 'GK', age: 31, nat: 'England', ovr: 81 },
    { fn: 'Jarrad', ln: 'Branthwaité', pos: 'CB', age: 22, nat: 'England', ovr: 78, pot: 86 },
    { fn: 'Dominic', ln: 'Calvert-Lewen', pos: 'ST', age: 28, nat: 'England', ovr: 78 },
    { fn: 'Dwight', ln: 'McNéil', pos: 'LW', age: 25, nat: 'England', ovr: 78 },
    { fn: 'James', ln: 'Tarkowskì', pos: 'CB', age: 32, nat: 'England', ovr: 78 },
    { fn: 'Abdoulaye', ln: 'Doucouré', pos: 'CM', age: 32, nat: 'France', ovr: 77 },
    { fn: 'Idrissa', ln: 'Gueya', pos: 'CDM', age: 35, nat: 'Senegal', ovr: 72 },
    { fn: 'Vitaliy', ln: 'Mykolenkó', pos: 'LB', age: 25, nat: 'Ukraine', ovr: 76 },
    { fn: 'Beto', ln: 'Betuncàl', pos: 'ST', age: 26, nat: 'Portugal', ovr: 76 },
    { fn: 'Jack', ln: 'Harrisen', pos: 'RW', age: 28, nat: 'England', ovr: 77 },
  ],

  'brentwood': [
    { fn: 'Bryan', ln: 'Mbéumo', pos: 'RW', age: 25, nat: 'Cameroon', ovr: 82 },
    { fn: 'Yoane', ln: 'Wissà', pos: 'ST', age: 28, nat: 'France', ovr: 79 },
    { fn: 'Mark', ln: 'Flekkan', pos: 'GK', age: 31, nat: 'Netherlands', ovr: 79 },
    { fn: 'Ethan', ln: 'Pinnóck', pos: 'CB', age: 31, nat: 'Jamaica', ovr: 78 },
    { fn: 'Christian', ln: 'Norgárd', pos: 'CDM', age: 31, nat: 'Denmark', ovr: 78 },
    { fn: 'Nathan', ln: 'Collinz', pos: 'CB', age: 23, nat: 'Ireland', ovr: 77 },
    { fn: 'Mathias', ln: 'Jensén', pos: 'CM', age: 29, nat: 'Denmark', ovr: 77 },
    { fn: 'Rico', ln: 'Henrý', pos: 'LB', age: 27, nat: 'England', ovr: 78 },
    { fn: 'Kevin', ln: 'Schadé', pos: 'LW', age: 23, nat: 'Germany', ovr: 77, pot: 84 },
    { fn: 'Ben', ln: 'Meé', pos: 'CB', age: 35, nat: 'England', ovr: 73 },
  ],

  'forest-green': [
    { fn: 'Morgan', ln: 'Gibb-Whyte', pos: 'CAM', age: 25, nat: 'England', ovr: 80 },
    { fn: 'Chris', ln: 'Wùd', pos: 'ST', age: 33, nat: 'New Zealand', ovr: 76 },
    { fn: 'Callum', ln: 'Hudsón-Odoi', pos: 'LW', age: 24, nat: 'England', ovr: 79 },
    { fn: 'Murillö', ln: 'Santos', pos: 'CB', age: 22, nat: 'Brazil', ovr: 79, pot: 86 },
    { fn: 'Matz', ln: 'Selz', pos: 'GK', age: 32, nat: 'Belgium', ovr: 79 },
    { fn: 'Danilö', ln: 'Pereira', pos: 'CDM', age: 23, nat: 'Brazil', ovr: 78, pot: 84 },
    { fn: 'Neco', ln: 'Williamz', pos: 'RB', age: 24, nat: 'Wales', ovr: 77 },
    { fn: 'Anthony', ln: 'Elangà', pos: 'LW', age: 22, nat: 'Sweden', ovr: 77 },
    { fn: 'Ryan', ln: 'Yatés', pos: 'CM', age: 27, nat: 'England', ovr: 77 },
    { fn: 'Taiwo', ln: 'Awoniyì', pos: 'ST', age: 27, nat: 'Nigeria', ovr: 77 },
  ],

  'palace-park': [
    { fn: 'Eberechi', ln: 'Ezé', pos: 'CAM', age: 26, nat: 'England', ovr: 82 },
    { fn: 'Marc', ln: 'Guehì', pos: 'CB', age: 24, nat: 'England', ovr: 81 },
    { fn: 'Jean-Philippe', ln: 'Matéta', pos: 'ST', age: 27, nat: 'France', ovr: 80 },
    { fn: 'Adam', ln: 'Whartón', pos: 'CM', age: 21, nat: 'England', ovr: 79, pot: 87 },
    { fn: 'Joachim', ln: 'Andersón', pos: 'CB', age: 29, nat: 'Denmark', ovr: 78 },
    { fn: 'Daniel', ln: 'Muñóz', pos: 'RB', age: 28, nat: 'Colombia', ovr: 78 },
    { fn: 'Sam', ln: 'Johnstoné', pos: 'GK', age: 32, nat: 'England', ovr: 78 },
    { fn: 'Tyrick', ln: 'Mitchéll', pos: 'LB', age: 25, nat: 'England', ovr: 77 },
    { fn: 'Jeffrey', ln: 'Schluppe', pos: 'LW', age: 31, nat: 'Ghana', ovr: 74 },
    { fn: 'Odsonne', ln: 'Edouárd', pos: 'ST', age: 27, nat: 'France', ovr: 76 },
  ],

  'fulham-cross': [
    { fn: 'Bernd', ln: 'Lenó', pos: 'GK', age: 32, nat: 'Germany', ovr: 81 },
    { fn: 'Andreas', ln: 'Pereiro', pos: 'CAM', age: 29, nat: 'Brazil', ovr: 79 },
    { fn: 'Antonee', ln: 'Robinsón', pos: 'LB', age: 27, nat: 'USA', ovr: 79 },
    { fn: 'Rodrigo', ln: 'Muníz', pos: 'ST', age: 23, nat: 'Brazil', ovr: 78, pot: 84 },
    { fn: 'Alex', ln: 'Iwobì', pos: 'CM', age: 29, nat: 'Nigeria', ovr: 78 },
    { fn: 'Harrison', ln: 'Reéd', pos: 'CDM', age: 29, nat: 'England', ovr: 77 },
    { fn: 'Kenny', ln: 'Teté', pos: 'RB', age: 29, nat: 'Netherlands', ovr: 77 },
    { fn: 'Issa', ln: 'Diope', pos: 'CB', age: 28, nat: 'France', ovr: 77 },
    { fn: 'Adama', ln: 'Traora', pos: 'RW', age: 29, nat: 'Spain', ovr: 77 },
    { fn: 'Tim', ln: 'Réam', pos: 'CB', age: 37, nat: 'USA', ovr: 70 },
  ],

  'bourneport': [
    { fn: 'Dominic', ln: 'Solanké', pos: 'ST', age: 27, nat: 'England', ovr: 80 },
    { fn: 'Illia', ln: 'Zabarnyí', pos: 'CB', age: 22, nat: 'Ukraine', ovr: 79, pot: 86 },
    { fn: 'Marcos', ln: 'Senèsi', pos: 'CB', age: 27, nat: 'Argentina', ovr: 78 },
    { fn: 'Justin', ln: 'Kluiverd', pos: 'LW', age: 26, nat: 'Netherlands', ovr: 78 },
    { fn: 'Milos', ln: 'Kerkéz', pos: 'LB', age: 21, nat: 'Hungary', ovr: 77, pot: 85 },
    { fn: 'Antoine', ln: 'Semenyó', pos: 'ST', age: 25, nat: 'Ghana', ovr: 77 },
    { fn: 'Philip', ln: 'Billinge', pos: 'CDM', age: 28, nat: 'Denmark', ovr: 76 },
    { fn: 'Netto', ln: 'Murara', pos: 'GK', age: 35, nat: 'Brazil', ovr: 75 },
    { fn: 'Alex', ln: 'Scotte', pos: 'CM', age: 21, nat: 'England', ovr: 76, pot: 83 },
    { fn: 'Lewis', ln: 'Cooke', pos: 'CM', age: 24, nat: 'England', ovr: 77 },
  ],

  'southgate-fc': [
    { fn: 'Adam', ln: 'Armstróng', pos: 'ST', age: 28, nat: 'England', ovr: 77 },
    { fn: 'Kyle', ln: 'Walker-Péters', pos: 'RB', age: 28, nat: 'England', ovr: 77 },
    { fn: 'Gavin', ln: 'Bazùnu', pos: 'GK', age: 23, nat: 'Ireland', ovr: 76 },
    { fn: 'Flynn', ln: 'Downés', pos: 'CDM', age: 25, nat: 'England', ovr: 76 },
    { fn: 'Armel', ln: 'Bella-Kocha', pos: 'CB', age: 23, nat: 'Germany', ovr: 76 },
    { fn: 'Taylor', ln: 'Harwóod-Bellis', pos: 'CB', age: 22, nat: 'England', ovr: 76 },
    { fn: 'Tyler', ln: 'Diblíng', pos: 'RW', age: 19, nat: 'England', ovr: 74, pot: 85 },
    { fn: 'Joe', ln: 'Aribó', pos: 'CM', age: 28, nat: 'Nigeria', ovr: 75 },
    { fn: 'Sekou', ln: 'Mará', pos: 'ST', age: 22, nat: 'France', ovr: 74 },
  ],

  'ipswich-vale': [
    { fn: 'Sammie', ln: 'Szmodicz', pos: 'ST', age: 29, nat: 'England', ovr: 77 },
    { fn: 'Liam', ln: 'Delàp', pos: 'ST', age: 22, nat: 'England', ovr: 77, pot: 84 },
    { fn: 'Kalvin', ln: 'Phillipz', pos: 'CDM', age: 29, nat: 'England', ovr: 77 },
    { fn: 'Jack', ln: 'Clarké', pos: 'LW', age: 24, nat: 'England', ovr: 77 },
    { fn: 'Omari', ln: 'Hutchinsón', pos: 'RW', age: 21, nat: 'England', ovr: 76, pot: 84 },
    { fn: 'Arijanet', ln: 'Murìc', pos: 'GK', age: 26, nat: 'Kosovo', ovr: 76 },
    { fn: 'Dara', ln: "O'Shéa", pos: 'CB', age: 25, nat: 'Ireland', ovr: 76 },
    { fn: 'Leif', ln: 'Daviés', pos: 'LB', age: 25, nat: 'Wales', ovr: 75 },
    { fn: 'Wes', ln: 'Burnz', pos: 'RW', age: 32, nat: 'Wales', ovr: 75 },
    { fn: 'Ben', ln: 'Godfréy', pos: 'CB', age: 27, nat: 'England', ovr: 76 },
  ],

  'leicester-fox': [
    { fn: 'Jamie', ln: 'Vardý', pos: 'ST', age: 38, nat: 'England', ovr: 68 },
    { fn: 'Wilfred', ln: 'Ndidí', pos: 'CDM', age: 28, nat: 'Nigeria', ovr: 78 },
    { fn: 'Patson', ln: 'Dakà', pos: 'ST', age: 26, nat: 'Zambia', ovr: 77 },
    { fn: 'Wout', ln: 'Faez', pos: 'CB', age: 26, nat: 'Belgium', ovr: 77 },
    { fn: 'Timothy', ln: 'Castagné', pos: 'RB', age: 29, nat: 'Belgium', ovr: 77 },
    { fn: 'Mads', ln: 'Hermansén', pos: 'GK', age: 24, nat: 'Denmark', ovr: 76 },
    { fn: 'James', ln: 'Justìn', pos: 'LB', age: 26, nat: 'England', ovr: 76 },
    { fn: 'Stephy', ln: 'Maviddí', pos: 'LW', age: 27, nat: 'England', ovr: 76 },
    { fn: 'Harry', ln: 'Winkz', pos: 'CM', age: 29, nat: 'England', ovr: 75 },
    { fn: 'Abdul', ln: 'Fatawú', pos: 'RW', age: 21, nat: 'Ghana', ovr: 76, pot: 83 },
  ],

  // ═══ DIV-2: Dynasty Championship (24 clubs) ═══

  'burnston': [
    { fn: 'Josh', ln: 'Brownhíll', pos: 'CM', age: 29, nat: 'England', ovr: 76 },
    { fn: 'James', ln: 'Traffórd', pos: 'GK', age: 22, nat: 'England', ovr: 75, pot: 84 },
    { fn: 'Sander', ln: 'Berga', pos: 'CDM', age: 27, nat: 'Norway', ovr: 76 },
    { fn: 'Anass', ln: 'Zarourý', pos: 'LW', age: 24, nat: 'Belgium', ovr: 75 },
    { fn: 'Jay', ln: 'Rodriguéz', pos: 'ST', age: 35, nat: 'England', ovr: 73 },
    { fn: 'Connor', ln: 'Robérts', pos: 'RB', age: 29, nat: 'Wales', ovr: 74 },
    { fn: 'Josh', ln: 'Cullén', pos: 'CM', age: 28, nat: 'Ireland', ovr: 74 },
    { fn: 'Luca', ln: 'Koleosho', pos: 'RW', age: 20, nat: 'Italy', ovr: 72, pot: 82 },
  ],

  'sheffield-steel': [
    { fn: 'Gustavo', ln: 'Hamér', pos: 'CM', age: 27, nat: 'Netherlands', ovr: 74 },
    { fn: 'Wes', ln: 'Foderinghame', pos: 'GK', age: 33, nat: 'England', ovr: 73 },
    { fn: 'Anel', ln: 'Ahmedhodžic', pos: 'CB', age: 25, nat: 'Bosnia', ovr: 74 },
    { fn: 'Oli', ln: 'McBurnié', pos: 'ST', age: 29, nat: 'Scotland', ovr: 73 },
    { fn: 'Chris', ln: 'Bashàm', pos: 'CB', age: 35, nat: 'England', ovr: 71 },
    { fn: 'Rhian', ln: 'Brewstar', pos: 'ST', age: 25, nat: 'England', ovr: 72 },
    { fn: 'Vini', ln: 'Souzà', pos: 'CDM', age: 27, nat: 'Brazil', ovr: 73 },
  ],

  'luton-rise': [
    { fn: 'Ross', ln: 'Barkléy', pos: 'CM', age: 31, nat: 'England', ovr: 74 },
    { fn: 'Elijah', ln: 'Adebayó', pos: 'ST', age: 26, nat: 'England', ovr: 73 },
    { fn: 'Carlton', ln: 'Morriz', pos: 'ST', age: 30, nat: 'England', ovr: 73 },
    { fn: 'Thomas', ln: 'Kaminskí', pos: 'GK', age: 31, nat: 'Belgium', ovr: 73 },
    { fn: 'Tom', ln: 'Lockyér', pos: 'CB', age: 30, nat: 'Wales', ovr: 72 },
    { fn: 'Alfie', ln: 'Doughtý', pos: 'LW', age: 24, nat: 'England', ovr: 72 },
  ],

  'stonebridge-city': [
    { fn: 'Viktor', ln: 'Gyokerés', pos: 'ST', age: 27, nat: 'Sweden', ovr: 74 },
    { fn: 'Mateo', ln: 'Bridgewater', pos: 'CM', age: 25, nat: 'England', ovr: 71 },
    { fn: 'Stefan', ln: 'Kovíc', pos: 'CB', age: 27, nat: 'Serbia', ovr: 70 },
    { fn: 'Danny', ln: 'Fairfíeld', pos: 'ST', age: 24, nat: 'England', ovr: 72 },
    { fn: 'Ryan', ln: 'Ashwórth', pos: 'GK', age: 29, nat: 'England', ovr: 70 },
    { fn: 'Nathan', ln: 'Bridges', pos: 'CDM', age: 28, nat: 'England', ovr: 70 },
  ],

  'coventry-phoenix': [
    { fn: 'Haji', ln: 'Wrighte', pos: 'ST', age: 26, nat: 'USA', ovr: 73 },
    { fn: 'Callum', ln: "O'Haré", pos: 'CAM', age: 26, nat: 'England', ovr: 74 },
    { fn: 'Ben', ln: 'Sheafe', pos: 'CDM', age: 26, nat: 'England', ovr: 73 },
    { fn: 'Ben', ln: 'Wilsón', pos: 'GK', age: 31, nat: 'England', ovr: 72 },
    { fn: 'Jake', ln: 'Bidwéll', pos: 'LB', age: 31, nat: 'England', ovr: 71 },
    { fn: 'Kasey', ln: 'Palmér', pos: 'CAM', age: 27, nat: 'England', ovr: 72 },
  ],

  'blackpool-tide': [
    { fn: 'Jerry', ln: 'Yaté', pos: 'ST', age: 27, nat: 'England', ovr: 70 },
    { fn: 'CJ', ln: 'Hamiltón', pos: 'LW', age: 25, nat: 'England', ovr: 69 },
    { fn: 'Marvin', ln: 'Ekpitéta', pos: 'CB', age: 28, nat: 'England', ovr: 69 },
    { fn: 'Chris', ln: 'Maxwéll', pos: 'GK', age: 34, nat: 'Wales', ovr: 69 },
    { fn: 'Kenny', ln: 'Dougáll', pos: 'CDM', age: 31, nat: 'Australia', ovr: 68 },
    { fn: 'Jordan', ln: 'Rhodés', pos: 'ST', age: 34, nat: 'England', ovr: 68 },
  ],

  'norwich-canary': [
    { fn: 'Josh', ln: 'Sargéant', pos: 'ST', age: 25, nat: 'USA', ovr: 75 },
    { fn: 'Gabriel', ln: 'Sará', pos: 'CAM', age: 25, nat: 'Brazil', ovr: 75 },
    { fn: 'Angus', ln: 'Gunne', pos: 'GK', age: 28, nat: 'Scotland', ovr: 74 },
    { fn: 'Grant', ln: 'Hanléy', pos: 'CB', age: 33, nat: 'Scotland', ovr: 73 },
    { fn: 'Kenny', ln: 'McLéan', pos: 'CM', age: 32, nat: 'Scotland', ovr: 73 },
    { fn: 'Onel', ln: 'Hernandéz', pos: 'LW', age: 31, nat: 'Cuba', ovr: 72 },
    { fn: 'Borja', ln: 'Sainz', pos: 'RW', age: 28, nat: 'Spain', ovr: 73 },
  ],

  'middlesbrough-iron': [
    { fn: 'Chuba', ln: 'Akpóm', pos: 'ST', age: 29, nat: 'England', ovr: 74 },
    { fn: 'Emmanuel', ln: 'Latte-Láth', pos: 'ST', age: 24, nat: 'Ivory Coast', ovr: 73 },
    { fn: 'Hayden', ln: 'Hacknéy', pos: 'CM', age: 22, nat: 'England', ovr: 73, pot: 80 },
    { fn: 'Matt', ln: 'Clarké', pos: 'CB', age: 28, nat: 'England', ovr: 72 },
    { fn: 'Tom', ln: 'Glovér', pos: 'GK', age: 26, nat: 'Australia', ovr: 72 },
    { fn: 'Paddy', ln: 'McNaír', pos: 'CB', age: 29, nat: 'Northern Ireland', ovr: 72 },
  ],

  'sunderland-port': [
    { fn: 'Jobe', ln: 'Bellinghan', pos: 'CM', age: 19, nat: 'England', ovr: 73, pot: 85 },
    { fn: 'Dan', ln: 'Ballardy', pos: 'CB', age: 25, nat: 'Northern Ireland', ovr: 74 },
    { fn: 'Ross', ln: 'Stewárt', pos: 'ST', age: 28, nat: 'Scotland', ovr: 74 },
    { fn: 'Anthony', ln: 'Pattersón', pos: 'GK', age: 24, nat: 'England', ovr: 73 },
    { fn: 'Dennis', ln: 'Cirkín', pos: 'LB', age: 22, nat: 'England', ovr: 73, pot: 80 },
    { fn: 'Patrick', ln: 'Robérts', pos: 'RW', age: 28, nat: 'England', ovr: 73 },
  ],

  'swansea-swan': [
    { fn: 'Ollie', ln: 'Coopér', pos: 'CM', age: 24, nat: 'Wales', ovr: 71 },
    { fn: 'Ben', ln: 'Cabangó', pos: 'CB', age: 24, nat: 'Wales', ovr: 72 },
    { fn: 'Carl', ln: 'Rushwórth', pos: 'GK', age: 23, nat: 'England', ovr: 72 },
    { fn: 'Nathan', ln: 'Wóod', pos: 'CB', age: 22, nat: 'England', ovr: 71 },
    { fn: 'Jamie', ln: 'Patersón', pos: 'CAM', age: 32, nat: 'England', ovr: 71 },
    { fn: 'Josh', ln: 'Kéy', pos: 'RB', age: 24, nat: 'England', ovr: 70 },
  ],

  'watford-horn': [
    { fn: 'Vakoun', ln: 'Bayò', pos: 'ST', age: 27, nat: 'Ivory Coast', ovr: 72 },
    { fn: 'Imran', ln: 'Louzà', pos: 'CM', age: 25, nat: 'Morocco', ovr: 72 },
    { fn: 'Ken', ln: 'Semà', pos: 'LW', age: 29, nat: 'Sweden', ovr: 71 },
    { fn: 'Daniel', ln: 'Bachmánn', pos: 'GK', age: 30, nat: 'Austria', ovr: 72 },
    { fn: 'Francisco', ln: 'Sieraltà', pos: 'CB', age: 27, nat: 'Chile', ovr: 71 },
    { fn: 'Edo', ln: 'Kayembé', pos: 'CM', age: 24, nat: 'DR Congo', ovr: 71 },
  ],

  'hull-tigers': [
    { fn: 'Liam', ln: 'Millár', pos: 'LW', age: 25, nat: 'Canada', ovr: 72 },
    { fn: 'Ozan', ln: 'Tufán', pos: 'CM', age: 30, nat: 'Turkey', ovr: 72 },
    { fn: 'Jean-Michel', ln: 'Serí', pos: 'CM', age: 33, nat: 'Ivory Coast', ovr: 72 },
    { fn: 'Matt', ln: 'Ingrám', pos: 'GK', age: 30, nat: 'England', ovr: 71 },
    { fn: 'Oscar', ln: 'Estupiñán', pos: 'ST', age: 26, nat: 'Colombia', ovr: 71 },
    { fn: 'Ryan', ln: 'Gilés', pos: 'LB', age: 24, nat: 'England', ovr: 71 },
  ],

  'bristol-bear': [
    { fn: 'Tommy', ln: 'Conwáy', pos: 'ST', age: 22, nat: 'Scotland', ovr: 72 },
    { fn: 'Andi', ln: 'Weimánn', pos: 'RW', age: 32, nat: 'Austria', ovr: 72 },
    { fn: 'Mark', ln: 'Sykés', pos: 'CM', age: 27, nat: 'Northern Ireland', ovr: 71 },
    { fn: 'Rob', ln: 'Dickey', pos: 'CB', age: 28, nat: 'England', ovr: 71 },
    { fn: 'Max', ln: "O'Leáry", pos: 'GK', age: 27, nat: 'England', ovr: 71 },
    { fn: 'Jay', ln: 'Dasilvà', pos: 'LB', age: 26, nat: 'England', ovr: 71 },
  ],

  'cardiff-dragon': [
    { fn: 'Aaron', ln: 'Ramsèy', pos: 'CM', age: 34, nat: 'Wales', ovr: 73 },
    { fn: 'Callum', ln: 'Robinsón', pos: 'ST', age: 29, nat: 'Ireland', ovr: 72 },
    { fn: 'Perry', ln: 'Nge', pos: 'RB', age: 28, nat: 'England', ovr: 70 },
    { fn: 'Joe', ln: 'Rallz', pos: 'CM', age: 30, nat: 'England', ovr: 71 },
    { fn: 'Ryan', ln: 'Allsoppe', pos: 'GK', age: 32, nat: 'England', ovr: 70 },
    { fn: 'Kion', ln: 'Eteté', pos: 'ST', age: 22, nat: 'England', ovr: 69 },
  ],

  'derby-rams': [
    { fn: 'James', ln: 'Collinz', pos: 'ST', age: 33, nat: 'Ireland', ovr: 71 },
    { fn: 'Curtis', ln: 'Nelsón', pos: 'CB', age: 30, nat: 'England', ovr: 70 },
    { fn: 'Joe', ln: 'Wildsmíth', pos: 'GK', age: 29, nat: 'England', ovr: 69 },
    { fn: 'Conor', ln: 'Houriháne', pos: 'CM', age: 33, nat: 'Ireland', ovr: 70 },
    { fn: 'Eiran', ln: 'Cashín', pos: 'CB', age: 22, nat: 'England', ovr: 69, pot: 77 },
    { fn: 'Dwight', ln: 'Gaylé', pos: 'ST', age: 34, nat: 'England', ovr: 70 },
  ],

  'millwall-lions': [
    { fn: 'Zian', ln: 'Flemmíng', pos: 'CM', age: 26, nat: 'Netherlands', ovr: 72 },
    { fn: 'Tom', ln: 'Bradshàw', pos: 'ST', age: 31, nat: 'Wales', ovr: 70 },
    { fn: 'Jake', ln: 'Coopér', pos: 'CB', age: 30, nat: 'England', ovr: 71 },
    { fn: 'George', ln: 'Savillé', pos: 'CM', age: 31, nat: 'Northern Ireland', ovr: 70 },
    { fn: 'Bartosz', ln: 'Bialkowskì', pos: 'GK', age: 36, nat: 'Poland', ovr: 70 },
    { fn: 'Murray', ln: 'Wallàce', pos: 'CB', age: 30, nat: 'Scotland', ovr: 69 },
  ],

  'preston-end': [
    { fn: 'Emil', ln: 'Riís', pos: 'ST', age: 26, nat: 'Denmark', ovr: 72 },
    { fn: 'Ben', ln: 'Whitemàn', pos: 'CM', age: 27, nat: 'England', ovr: 71 },
    { fn: 'Freddie', ln: 'Woodmàn', pos: 'GK', age: 27, nat: 'England', ovr: 70 },
    { fn: 'Liam', ln: 'Lindsáy', pos: 'CB', age: 29, nat: 'Scotland', ovr: 70 },
    { fn: 'Ched', ln: 'Evàns', pos: 'ST', age: 35, nat: 'Wales', ovr: 69 },
    { fn: 'Greg', ln: 'Cunninghàm', pos: 'LB', age: 33, nat: 'Ireland', ovr: 68 },
  ],

  'queens-park': [
    { fn: 'Ilias', ln: 'Chaír', pos: 'CAM', age: 27, nat: 'Morocco', ovr: 73 },
    { fn: 'Chris', ln: 'Willocke', pos: 'RW', age: 27, nat: 'England', ovr: 72 },
    { fn: 'Lyndon', ln: 'Dykés', pos: 'ST', age: 29, nat: 'Scotland', ovr: 72 },
    { fn: 'Seny', ln: 'Diéng', pos: 'GK', age: 30, nat: 'Senegal', ovr: 72 },
    { fn: 'Jimmy', ln: 'Dunné', pos: 'CB', age: 27, nat: 'Ireland', ovr: 71 },
    { fn: 'Stefan', ln: 'Johansén', pos: 'CM', age: 34, nat: 'Norway', ovr: 70 },
  ],

  'plymouth-argyle': [
    { fn: 'Morgan', ln: 'Whittakér', pos: 'CAM', age: 24, nat: 'England', ovr: 72 },
    { fn: 'Sam', ln: 'Cosgrové', pos: 'ST', age: 28, nat: 'England', ovr: 69 },
    { fn: 'Michael', ln: 'Coopér', pos: 'GK', age: 24, nat: 'England', ovr: 70 },
    { fn: 'Dan', ln: 'Scarré', pos: 'CB', age: 29, nat: 'England', ovr: 68 },
    { fn: 'Bali', ln: 'Mumbá', pos: 'LB', age: 22, nat: 'England', ovr: 68, pot: 76 },
  ],

  'stoke-potter': [
    { fn: 'Tyrese', ln: 'Campbéll', pos: 'ST', age: 25, nat: 'England', ovr: 72 },
    { fn: 'Lewis', ln: 'Bakér', pos: 'CM', age: 29, nat: 'England', ovr: 71 },
    { fn: 'Ben', ln: 'Wilmótt', pos: 'CB', age: 25, nat: 'England', ovr: 71 },
    { fn: 'Jack', ln: 'Bonhàm', pos: 'GK', age: 30, nat: 'Ireland', ovr: 70 },
    { fn: 'Josh', ln: 'Laurént', pos: 'CDM', age: 29, nat: 'England', ovr: 71 },
    { fn: 'Dujon', ln: 'Sterlíng', pos: 'RB', age: 24, nat: 'England', ovr: 70 },
  ],

  'west-bromwich': [
    { fn: 'Jed', ln: 'Wallàce', pos: 'RW', age: 30, nat: 'England', ovr: 73 },
    { fn: 'John', ln: 'Swíft', pos: 'CAM', age: 29, nat: 'England', ovr: 72 },
    { fn: 'Okay', ln: 'Yokushlú', pos: 'CDM', age: 30, nat: 'Turkey', ovr: 72 },
    { fn: 'Alex', ln: 'Palmér', pos: 'GK', age: 27, nat: 'England', ovr: 71 },
    { fn: 'Semi', ln: 'Ajayí', pos: 'CB', age: 30, nat: 'Nigeria', ovr: 71 },
    { fn: 'Darnell', ln: 'Furlóng', pos: 'RB', age: 28, nat: 'England', ovr: 71 },
  ],

  'reading-royals': [
    { fn: 'Tom', ln: 'Incé', pos: 'RW', age: 32, nat: 'England', ovr: 68 },
    { fn: 'Andy', ln: 'Carróll', pos: 'ST', age: 36, nat: 'England', ovr: 67 },
    { fn: 'Jeff', ln: 'Hendríck', pos: 'CM', age: 32, nat: 'Ireland', ovr: 67 },
    { fn: 'Sam', ln: 'Walkér', pos: 'GK', age: 31, nat: 'England', ovr: 67 },
    { fn: 'Tom', ln: 'Holmés', pos: 'CB', age: 24, nat: 'England', ovr: 66 },
  ],

  'birmingham-hart': [
    { fn: 'Jay', ln: 'Stansfíeld', pos: 'ST', age: 22, nat: 'England', ovr: 72, pot: 80 },
    { fn: 'Krystian', ln: 'Bielík', pos: 'CDM', age: 27, nat: 'Poland', ovr: 72 },
    { fn: 'Seung-Ho', ln: 'Paik', pos: 'CM', age: 26, nat: 'South Korea', ovr: 71 },
    { fn: 'Dion', ln: 'Sandersón', pos: 'CB', age: 24, nat: 'England', ovr: 70 },
    { fn: 'Neil', ln: 'Etheridgé', pos: 'GK', age: 34, nat: 'Philippines', ovr: 70 },
    { fn: 'Juninho', ln: 'Bacuná', pos: 'CM', age: 27, nat: 'Netherlands', ovr: 70 },
  ],

  'leeds-white': [
    { fn: 'Crysencio', ln: 'Summervìll', pos: 'LW', age: 23, nat: 'Netherlands', ovr: 78 },
    { fn: 'Ethan', ln: 'Ampadú', pos: 'CB', age: 25, nat: 'Wales', ovr: 77 },
    { fn: 'Illan', ln: 'Meslie', pos: 'GK', age: 25, nat: 'France', ovr: 77 },
    { fn: 'Daniel', ln: 'Jamés', pos: 'RW', age: 27, nat: 'Wales', ovr: 77 },
    { fn: 'Joe', ln: 'Rodón', pos: 'CB', age: 27, nat: 'Wales', ovr: 77 },
    { fn: 'Wilfried', ln: 'Gnónt', pos: 'RW', age: 21, nat: 'Italy', ovr: 76, pot: 84 },
    { fn: 'Patrick', ln: 'Bamforde', pos: 'ST', age: 31, nat: 'England', ovr: 76 },
    { fn: 'Junior', ln: 'Fírpo', pos: 'LB', age: 29, nat: 'Dominican Republic', ovr: 76 },
  ],

  // ═══ DIV-3: Sovereign First Division (24 clubs) ═══

  'barnsley-tyke': [
    { fn: 'Devante', ln: 'Colé', pos: 'ST', age: 29, nat: 'England', ovr: 64 },
    { fn: 'Luca', ln: 'Connéll', pos: 'CM', age: 23, nat: 'Ireland', ovr: 63 },
    { fn: 'Mads', ln: 'Andersén', pos: 'CB', age: 26, nat: 'Denmark', ovr: 64 },
    { fn: 'Brad', ln: 'Collinz', pos: 'GK', age: 27, nat: 'England', ovr: 63 },
  ],

  'bolton-trotter': [
    { fn: 'Dion', ln: 'Charlés', pos: 'ST', age: 28, nat: 'Northern Ireland', ovr: 65 },
    { fn: 'Aaron', ln: 'Morléy', pos: 'CM', age: 24, nat: 'England', ovr: 64 },
    { fn: 'Ricardo', ln: 'Santoz', pos: 'CB', age: 28, nat: 'Portugal', ovr: 64 },
    { fn: 'Joel', ln: 'Dixón', pos: 'GK', age: 30, nat: 'England', ovr: 63 },
    { fn: 'George', ln: 'Thomasón', pos: 'CM', age: 22, nat: 'England', ovr: 63, pot: 72 },
  ],

  'charlton-vale': [
    { fn: 'Alfie', ln: 'Máy', pos: 'ST', age: 31, nat: 'England', ovr: 63 },
    { fn: 'Joe', ln: 'Wollacótt', pos: 'GK', age: 27, nat: 'England', ovr: 62 },
    { fn: 'Scott', ln: 'Frasér', pos: 'CM', age: 29, nat: 'Scotland', ovr: 62 },
    { fn: 'Miles', ln: 'Leaburne', pos: 'ST', age: 20, nat: 'England', ovr: 60, pot: 72 },
  ],

  'exeter-city': [
    { fn: 'Sam', ln: 'Nombé', pos: 'ST', age: 25, nat: 'England', ovr: 60 },
    { fn: 'Pierce', ln: 'Sweenéy', pos: 'CB', age: 30, nat: 'Ireland', ovr: 59 },
    { fn: 'Jack', ln: 'Sparkés', pos: 'LB', age: 24, nat: 'England', ovr: 59 },
    { fn: 'Ilmari', ln: 'Niskanén', pos: 'CM', age: 23, nat: 'Finland', ovr: 59 },
  ],

  'portsmouth-dock': [
    { fn: 'Colby', ln: 'Bishóp', pos: 'ST', age: 27, nat: 'England', ovr: 66 },
    { fn: 'Marlon', ln: 'Packe', pos: 'CDM', age: 33, nat: 'England', ovr: 65 },
    { fn: 'Paddy', ln: 'Lané', pos: 'RW', age: 23, nat: 'Northern Ireland', ovr: 64 },
    { fn: 'Sean', ln: 'Raggétt', pos: 'CB', age: 30, nat: 'England', ovr: 64 },
    { fn: 'Will', ln: 'Norrís', pos: 'GK', age: 31, nat: 'England', ovr: 64 },
  ],

  'oxford-scholar': [
    { fn: 'Cameron', ln: 'Brannagán', pos: 'CM', age: 28, nat: 'England', ovr: 62 },
    { fn: 'Mark', ln: 'Harrís', pos: 'ST', age: 25, nat: 'Wales', ovr: 61 },
    { fn: 'Sam', ln: 'Lóng', pos: 'RB', age: 28, nat: 'England', ovr: 60 },
    { fn: 'Simon', ln: 'Eastwóod', pos: 'GK', age: 33, nat: 'England', ovr: 60 },
  ],

  'wigan-pier': [
    { fn: 'Charlie', ln: 'Wyké', pos: 'ST', age: 31, nat: 'England', ovr: 62 },
    { fn: 'Thelo', ln: 'Aasgárd', pos: 'CM', age: 22, nat: 'Norway', ovr: 62, pot: 72 },
    { fn: 'Jason', ln: 'Kérr', pos: 'CB', age: 27, nat: 'Scotland', ovr: 61 },
    { fn: 'Ben', ln: 'Amós', pos: 'GK', age: 34, nat: 'England', ovr: 61 },
  ],

  'rotherham-mill': [
    { fn: 'Chiedozie', ln: 'Ogbené', pos: 'RW', age: 27, nat: 'Ireland', ovr: 60 },
    { fn: 'Sam', ln: 'Clucás', pos: 'CM', age: 33, nat: 'England', ovr: 58 },
    { fn: 'Viktor', ln: 'Johanssón', pos: 'GK', age: 27, nat: 'Sweden', ovr: 57 },
    { fn: 'Grant', ln: 'Háll', pos: 'CB', age: 32, nat: 'England', ovr: 57 },
  ],

  'peterborough-eagle': [
    { fn: 'Jonson', ln: 'Clarke-Harrís', pos: 'ST', age: 30, nat: 'England', ovr: 60 },
    { fn: 'Hector', ln: 'Kyprianóu', pos: 'CM', age: 23, nat: 'England', ovr: 59 },
    { fn: 'Harvey', ln: 'Cartwríght', pos: 'GK', age: 22, nat: 'England', ovr: 58 },
    { fn: 'Frankie', ln: 'Ként', pos: 'CB', age: 27, nat: 'England', ovr: 59 },
  ],

  'lincoln-imp': [
    { fn: 'John', ln: 'Marquís', pos: 'ST', age: 31, nat: 'England', ovr: 59 },
    { fn: 'Paudie', ln: "O'Connór", pos: 'CB', age: 27, nat: 'Ireland', ovr: 58 },
    { fn: 'Jordan', ln: 'Wríght', pos: 'GK', age: 26, nat: 'England', ovr: 57 },
    { fn: 'Jorge', ln: 'Gránt', pos: 'CAM', age: 28, nat: 'England', ovr: 58 },
  ],

  'shrewsbury-town': [
    { fn: 'Daniel', ln: 'Udóh', pos: 'ST', age: 28, nat: 'England', ovr: 57 },
    { fn: 'Luke', ln: 'Leahý', pos: 'LB', age: 31, nat: 'Ireland', ovr: 56 },
    { fn: 'Marko', ln: 'Marosí', pos: 'GK', age: 30, nat: 'Slovakia', ovr: 56 },
    { fn: 'Chey', ln: 'Dunkléy', pos: 'CB', age: 31, nat: 'England', ovr: 56 },
  ],

  'cambridge-united': [
    { fn: 'Joe', ln: 'Ironsidé', pos: 'ST', age: 30, nat: 'England', ovr: 59 },
    { fn: 'Lloyd', ln: 'Jonés', pos: 'CB', age: 28, nat: 'England', ovr: 58 },
    { fn: 'Dimitar', ln: 'Mitóv', pos: 'GK', age: 27, nat: 'Bulgaria', ovr: 58 },
    { fn: 'Sam', ln: 'Smíth', pos: 'CAM', age: 25, nat: 'England', ovr: 58 },
  ],

  'burton-athletic': [
    { fn: 'Victor', ln: 'Adeboyéjo', pos: 'ST', age: 26, nat: 'Ireland', ovr: 56 },
    { fn: 'Terry', ln: 'Taylór', pos: 'CM', age: 24, nat: 'England', ovr: 55 },
    { fn: 'Ben', ln: 'Garrátt', pos: 'GK', age: 31, nat: 'England', ovr: 55 },
    { fn: 'Deji', ln: 'Oshilajá', pos: 'CB', age: 30, nat: 'England', ovr: 55 },
  ],

  'northampton-cobblers': [
    { fn: 'Sam', ln: 'Hoskinz', pos: 'RW', age: 31, nat: 'England', ovr: 57 },
    { fn: 'Jon', ln: 'Guthríe', pos: 'CB', age: 31, nat: 'Scotland', ovr: 56 },
    { fn: 'Lee', ln: 'Burgé', pos: 'GK', age: 31, nat: 'England', ovr: 56 },
    { fn: 'Marc', ln: 'Leonárd', pos: 'CM', age: 23, nat: 'Scotland', ovr: 56 },
  ],

  'leyton-orient': [
    { fn: 'Dan', ln: 'Kémpe', pos: 'RW', age: 26, nat: 'England', ovr: 58 },
    { fn: 'Charlie', ln: 'Kelmán', pos: 'ST', age: 23, nat: 'England', ovr: 57 },
    { fn: 'Lawrence', ln: 'Vigouróux', pos: 'GK', age: 30, nat: 'Chile', ovr: 57 },
    { fn: 'Omar', ln: 'Becklés', pos: 'CB', age: 32, nat: 'England', ovr: 57 },
  ],

  'cheltenham-spa': [
    { fn: 'Ryan', ln: 'Broóm', pos: 'CM', age: 27, nat: 'Wales', ovr: 55 },
    { fn: 'Sean', ln: 'Lónge', pos: 'RB', age: 28, nat: 'Ireland', ovr: 54 },
    { fn: 'Owen', ln: 'Evàns', pos: 'GK', age: 26, nat: 'Wales', ovr: 54 },
    { fn: 'Charlie', ln: 'Raglàn', pos: 'CB', age: 29, nat: 'England', ovr: 54 },
  ],

  'fleetwood-cod': [
    { fn: 'Ged', ln: 'Garnér', pos: 'ST', age: 26, nat: 'England', ovr: 56 },
    { fn: 'Josh', ln: 'Earle', pos: 'LB', age: 26, nat: 'England', ovr: 55 },
    { fn: 'Jay', ln: 'Lynché', pos: 'GK', age: 28, nat: 'England', ovr: 55 },
    { fn: 'Shaun', ln: 'Roonéy', pos: 'RB', age: 27, nat: 'Scotland', ovr: 55 },
  ],

  'wycombe-chair': [
    { fn: 'Garath', ln: 'McClearý', pos: 'RW', age: 36, nat: 'England', ovr: 57 },
    { fn: 'Sam', ln: 'Vokés', pos: 'ST', age: 34, nat: 'Wales', ovr: 56 },
    { fn: 'David', ln: 'Stockdalé', pos: 'GK', age: 38, nat: 'England', ovr: 56 },
    { fn: 'Ryan', ln: 'Tafazollí', pos: 'CB', age: 31, nat: 'England', ovr: 56 },
  ],

  'huddersfield-terrier': [
    { fn: 'Sorba', ln: 'Thomás', pos: 'RW', age: 25, nat: 'Wales', ovr: 64 },
    { fn: 'Michal', ln: 'Helík', pos: 'CB', age: 29, nat: 'Poland', ovr: 63 },
    { fn: 'Lee', ln: 'Nichollz', pos: 'GK', age: 31, nat: 'England', ovr: 63 },
    { fn: 'Josh', ln: 'Koromá', pos: 'LW', age: 26, nat: 'Sierra Leone', ovr: 63 },
    { fn: 'Jonathan', ln: 'Hogge', pos: 'CDM', age: 35, nat: 'England', ovr: 62 },
  ],

  'blackburn-rover': [
    { fn: 'Tyrhys', ln: 'Dolán', pos: 'LW', age: 22, nat: 'England', ovr: 64 },
    { fn: 'Lewis', ln: 'Travìs', pos: 'CDM', age: 26, nat: 'England', ovr: 64 },
    { fn: 'Dominic', ln: 'Hyám', pos: 'CB', age: 28, nat: 'Scotland', ovr: 64 },
    { fn: 'Aynsley', ln: 'Pearce', pos: 'GK', age: 25, nat: 'England', ovr: 64 },
    { fn: 'Sam', ln: 'Gallaghér', pos: 'ST', age: 28, nat: 'England', ovr: 64 },
  ],

  'charlbury-athletic': [
    { fn: 'Marcus', ln: 'Sherwoode', pos: 'ST', age: 26, nat: 'England', ovr: 61 },
    { fn: 'Tom', ln: 'Bradburey', pos: 'CB', age: 28, nat: 'England', ovr: 60 },
    { fn: 'Nathan', ln: 'Hoole', pos: 'CM', age: 24, nat: 'England', ovr: 60 },
    { fn: 'Ryan', ln: 'Prescótt', pos: 'GK', age: 27, nat: 'England', ovr: 59 },
  ],

  'stockport-hat': [
    { fn: 'Paddy', ln: 'Maddén', pos: 'ST', age: 33, nat: 'Ireland', ovr: 59 },
    { fn: 'Antoni', ln: 'Sarcevíc', pos: 'CM', age: 31, nat: 'England', ovr: 58 },
    { fn: 'Ben', ln: 'Hinchlíffe', pos: 'GK', age: 25, nat: 'England', ovr: 58 },
    { fn: 'Ash', ln: 'Palmér', pos: 'CB', age: 29, nat: 'England', ovr: 58 },
  ],

  'bristol-manor': [
    { fn: 'Aaron', ln: 'Collinz', pos: 'ST', age: 26, nat: 'Wales', ovr: 63 },
    { fn: 'Luke', ln: 'Thomás', pos: 'RW', age: 24, nat: 'England', ovr: 62 },
    { fn: 'James', ln: 'Connollý', pos: 'CB', age: 23, nat: 'England', ovr: 62 },
    { fn: 'James', ln: 'Belshàw', pos: 'GK', age: 28, nat: 'England', ovr: 61 },
  ],

  'reading-park': [
    { fn: 'Danny', ln: 'Loáder', pos: 'ST', age: 24, nat: 'England', ovr: 60 },
    { fn: 'Mike', ln: 'Morrisón', pos: 'CB', age: 30, nat: 'England', ovr: 59 },
    { fn: 'Jake', ln: 'Sheridán', pos: 'GK', age: 26, nat: 'England', ovr: 59 },
    { fn: 'Tom', ln: 'Crawfórd', pos: 'CM', age: 27, nat: 'England', ovr: 59 },
  ],

  // ═══ DIV-4: Foundation League (24 clubs) ═══

  'grimsby-mariner': [
    { fn: 'John', ln: 'McAtèe', pos: 'ST', age: 24, nat: 'England', ovr: 54 },
    { fn: 'Danny', ln: 'Amós', pos: 'CB', age: 26, nat: 'England', ovr: 53 },
    { fn: 'Max', ln: 'Crocombé', pos: 'GK', age: 30, nat: 'New Zealand', ovr: 53 },
  ],

  'carlisle-border': [
    { fn: 'Jon', ln: 'Mellísh', pos: 'CM', age: 26, nat: 'England', ovr: 52 },
    { fn: 'Paul', ln: 'Farmán', pos: 'GK', age: 34, nat: 'England', ovr: 51 },
    { fn: 'Morgan', ln: 'Feenéy', pos: 'CB', age: 24, nat: 'England', ovr: 51 },
  ],

  'swindon-robin': [
    { fn: 'Harry', ln: 'McKirdý', pos: 'ST', age: 26, nat: 'England', ovr: 53 },
    { fn: 'Louie', ln: 'Barrý', pos: 'ST', age: 21, nat: 'England', ovr: 53, pot: 65 },
    { fn: 'Lewis', ln: 'Wàrd', pos: 'GK', age: 28, nat: 'England', ovr: 52 },
  ],

  'crewe-railway': [
    { fn: 'Chris', ln: 'Lónge', pos: 'ST', age: 29, nat: 'England', ovr: 51 },
    { fn: 'Luke', ln: 'Murphý', pos: 'CM', age: 34, nat: 'England', ovr: 50 },
    { fn: 'Dave', ln: 'Richárds', pos: 'GK', age: 29, nat: 'England', ovr: 50 },
  ],

  'doncaster-bell': [
    { fn: 'George', ln: 'Millér', pos: 'ST', age: 25, nat: 'England', ovr: 53 },
    { fn: 'Tom', ln: 'Andersón', pos: 'CB', age: 30, nat: 'England', ovr: 52 },
    { fn: 'Jonathan', ln: 'Mitchéll', pos: 'GK', age: 29, nat: 'England', ovr: 52 },
  ],

  'morecambe-bay': [
    { fn: 'Cole', ln: 'Stocktón', pos: 'ST', age: 29, nat: 'England', ovr: 49 },
    { fn: 'Shane', ln: 'McLoughlín', pos: 'CM', age: 27, nat: 'Ireland', ovr: 48 },
    { fn: 'Connor', ln: 'Ripléy', pos: 'GK', age: 30, nat: 'England', ovr: 48 },
  ],

  'accrington-crown': [
    { fn: 'Sean', ln: 'McConvillé', pos: 'RW', age: 36, nat: 'England', ovr: 48 },
    { fn: 'Harvey', ln: 'Rodgérs', pos: 'CB', age: 25, nat: 'England', ovr: 47 },
    { fn: 'Toby', ln: 'Savín', pos: 'GK', age: 23, nat: 'England', ovr: 47 },
  ],

  'harrogate-spa': [
    { fn: 'Luke', ln: 'Armstróng', pos: 'ST', age: 27, nat: 'England', ovr: 48 },
    { fn: 'Warren', ln: 'Burréll', pos: 'CB', age: 30, nat: 'England', ovr: 47 },
    { fn: 'Pete', ln: 'Jamesón', pos: 'GK', age: 33, nat: 'England', ovr: 47 },
  ],

  'mansfield-stag': [
    { fn: 'Davis', ln: 'Keillor-Dúnn', pos: 'ST', age: 26, nat: 'England', ovr: 51 },
    { fn: 'Stephen', ln: 'McLaughlín', pos: 'LW', age: 33, nat: 'Ireland', ovr: 50 },
    { fn: 'Christy', ln: 'Pýme', pos: 'GK', age: 28, nat: 'England', ovr: 50 },
  ],

  'colchester-eagle': [
    { fn: 'Freddie', ln: 'Seárs', pos: 'ST', age: 33, nat: 'England', ovr: 50 },
    { fn: 'Luke', ln: 'Chambérs', pos: 'CB', age: 38, nat: 'England', ovr: 49 },
    { fn: 'Sam', ln: 'Hornbý', pos: 'GK', age: 28, nat: 'England', ovr: 49 },
  ],

  'bradford-bantam': [
    { fn: 'Andy', ln: 'Cooke', pos: 'ST', age: 32, nat: 'England', ovr: 55 },
    { fn: 'Brad', ln: 'Hallidáy', pos: 'RB', age: 28, nat: 'England', ovr: 54 },
    { fn: 'Harry', ln: 'Lewís', pos: 'GK', age: 27, nat: 'England', ovr: 54 },
  ],

  'tranmere-rover': [
    { fn: 'Paul', ln: 'Mullín', pos: 'ST', age: 29, nat: 'England', ovr: 52 },
    { fn: 'Peter', ln: 'Clarké', pos: 'CB', age: 38, nat: 'England', ovr: 51 },
    { fn: 'Joe', ln: 'Murphý', pos: 'GK', age: 36, nat: 'Ireland', ovr: 51 },
  ],

  'newport-dragon': [
    { fn: 'Omar', ln: 'Boglé', pos: 'ST', age: 31, nat: 'England', ovr: 49 },
    { fn: 'Mickey', ln: 'Demetrióu', pos: 'CB', age: 33, nat: 'England', ovr: 48 },
    { fn: 'Nick', ln: 'Townsénd', pos: 'GK', age: 29, nat: 'Wales', ovr: 48 },
  ],

  'gillingham-fc': [
    { fn: 'Jordan', ln: 'Greén', pos: 'RW', age: 28, nat: 'England', ovr: 51 },
    { fn: 'Stuart', ln: "O'Keéfe", pos: 'CM', age: 32, nat: 'England', ovr: 50 },
    { fn: 'Aaron', ln: 'Chapmán', pos: 'GK', age: 33, nat: 'England', ovr: 50 },
  ],

  'salford-red': [
    { fn: 'Matt', ln: 'Smíthe', pos: 'ST', age: 34, nat: 'England', ovr: 56 },
    { fn: 'Ibou', ln: 'Touráy', pos: 'LB', age: 27, nat: 'Gambia', ovr: 55 },
    { fn: 'Tom', ln: 'Kíng', pos: 'GK', age: 28, nat: 'Wales', ovr: 55 },
  ],

  'walsall-town': [
    { fn: 'Tom', ln: 'Knowlés', pos: 'RW', age: 25, nat: 'England', ovr: 50 },
    { fn: 'Donervon', ln: 'Daniéls', pos: 'CB', age: 29, nat: 'England', ovr: 49 },
    { fn: 'Jackson', ln: 'Smíth', pos: 'GK', age: 23, nat: 'England', ovr: 49 },
  ],

  'barrow-blue': [
    { fn: 'Josh', ln: 'Gordón', pos: 'ST', age: 27, nat: 'England', ovr: 46 },
    { fn: 'Jason', ln: 'Taylór', pos: 'CDM', age: 33, nat: 'England', ovr: 45 },
    { fn: 'Paul', ln: 'Fármane', pos: 'GK', age: 34, nat: 'England', ovr: 45 },
  ],

  'sutton-amber': [
    { fn: 'David', ln: 'Ajiboyé', pos: 'RW', age: 26, nat: 'England', ovr: 46 },
    { fn: 'Ben', ln: 'Goodlíffe', pos: 'CB', age: 24, nat: 'England', ovr: 45 },
    { fn: 'Dean', ln: 'Bouzanís', pos: 'GK', age: 33, nat: 'Australia', ovr: 45 },
  ],

  'crawley-red': [
    { fn: 'Tom', ln: 'Nichólz', pos: 'ST', age: 30, nat: 'England', ovr: 48 },
    { fn: 'Ludwig', ln: 'Francillétte', pos: 'CB', age: 23, nat: 'France', ovr: 47 },
    { fn: 'Glenn', ln: 'Morrís', pos: 'GK', age: 40, nat: 'England', ovr: 47 },
  ],

  'notts-county': [
    { fn: 'Macaulay', ln: 'Langstáff', pos: 'ST', age: 27, nat: 'England', ovr: 53 },
    { fn: 'Connell', ln: 'Rawlinsón', pos: 'CB', age: 29, nat: 'England', ovr: 52 },
    { fn: 'Sam', ln: 'Slocombé', pos: 'GK', age: 33, nat: 'England', ovr: 52 },
  ],

  'rochdale-dale': [
    { fn: 'Jake', ln: 'Beesléy', pos: 'ST', age: 27, nat: 'England', ovr: 49 },
    { fn: 'Eoghan', ln: "O'Connéll", pos: 'CB', age: 28, nat: 'Ireland', ovr: 48 },
    { fn: 'Richard', ln: "O'Donnéll", pos: 'GK', age: 35, nat: 'England', ovr: 48 },
  ],

  'stevenage-boro': [
    { fn: 'Danny', ln: 'Rosé', pos: 'ST', age: 30, nat: 'England', ovr: 47 },
    { fn: 'Dan', ln: 'Sweenéy', pos: 'CB', age: 28, nat: 'England', ovr: 46 },
    { fn: 'Taye', ln: 'Ashby-Hammónd', pos: 'GK', age: 24, nat: 'England', ovr: 46 },
  ],

  'wimbledon-fc': [
    { fn: 'Ali', ln: 'Al-Hamadí', pos: 'ST', age: 23, nat: 'Iraq', ovr: 52, pot: 64 },
    { fn: 'Lee', ln: 'Hodsón', pos: 'RB', age: 32, nat: 'Northern Ireland', ovr: 51 },
    { fn: 'Nik', ln: 'Tzanév', pos: 'GK', age: 26, nat: 'New Zealand', ovr: 51 },
  ],

  'hartlepool-monkey': [
    { fn: 'Josh', ln: 'Umeráh', pos: 'ST', age: 26, nat: 'England', ovr: 45 },
    { fn: 'Gary', ln: 'Liddlé', pos: 'CB', age: 36, nat: 'England', ovr: 44 },
    { fn: 'Ben', ln: 'Killípe', pos: 'GK', age: 29, nat: 'England', ovr: 44 },
  ],
};
