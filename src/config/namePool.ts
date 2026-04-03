/**
 * Nationality-specific name pools for realistic player name generation.
 * Each nationality has a set of first and last names common to that country.
 */

interface NationalityNamePool {
  firstNames: string[];
  lastNames: string[];
}

export const NATIONALITY_NAME_POOLS: Record<string, NationalityNamePool> = {
  'England': {
    firstNames: ['James', 'Harry', 'Jack', 'Oliver', 'Charlie', 'George', 'Thomas', 'William', 'Alfie', 'Mason', 'Callum', 'Declan', 'Jude', 'Marcus', 'Raheem', 'Jordan', 'Aaron', 'Reece', 'Bukayo', 'Phil', 'Kyle', 'Ben', 'Luke', 'Conor', 'Dominic', 'Tyrone', 'Ashley', 'Ryan', 'Nathan', 'Danny'],
    lastNames: ['Smith', 'Jones', 'Taylor', 'Brown', 'Wilson', 'Walker', 'White', 'Clarke', 'Hall', 'Wright', 'Robinson', 'Green', 'Thompson', 'Baker', 'Ward', 'Cooper', 'Palmer', 'Hughes', 'Powell', 'Mitchell', 'Shaw', 'Rice', 'Stone', 'Bell', 'Barker', 'Hart', 'Brooks', 'Price', 'Cole', 'Dixon'],
  },
  'Scotland': {
    firstNames: ['Andrew', 'Callum', 'Scott', 'Kieran', 'Stuart', 'Craig', 'Ross', 'Grant', 'Angus', 'Fraser', 'Hamish', 'John', 'Billy', 'Kenny', 'Liam', 'Ryan', 'Graeme', 'Darren', 'Lewis', 'Jamie'],
    lastNames: ['McGregor', 'Robertson', 'Campbell', 'Stewart', 'Murray', 'Anderson', 'MacDonald', 'Thomson', 'Reid', 'Henderson', 'Fraser', 'Hamilton', 'Graham', 'Kerr', 'Wallace', 'Burns', 'Crawford', 'Sinclair', 'Douglas', 'Watt'],
  },
  'Wales': {
    firstNames: ['Gareth', 'Aaron', 'Ben', 'Joe', 'Ethan', 'Daniel', 'Connor', 'Brennan', 'Harry', 'Neco', 'David', 'Rhys', 'Owen', 'Dylan', 'Ieuan', 'Gethin', 'Dai', 'Emyr', 'Tomos', 'Iwan'],
    lastNames: ['Williams', 'Davies', 'Evans', 'Thomas', 'Roberts', 'Lewis', 'Morgan', 'Jones', 'Griffiths', 'Edwards', 'Owen', 'Price', 'Rees', 'Humphreys', 'Vaughan', 'Parry', 'Jenkins', 'Morris', 'Lloyd', 'Bowen'],
  },
  'Ireland': {
    firstNames: ['Sean', 'Conor', 'Patrick', 'Liam', 'Ciaran', 'Declan', 'Shane', 'Kevin', 'Ronan', 'Niall', 'Dara', 'Eoin', 'Callum', 'Padraig', 'Rory', 'Darragh', 'Cillian', 'Oisin', 'Fionn', 'Cathal'],
    lastNames: ["O'Brien", 'Murphy', 'Kelly', 'Sullivan', 'Walsh', 'Byrne', 'Ryan', 'Doherty', 'McCarthy', 'Gallagher', 'Duffy', 'Brady', 'Nolan', 'Quinn', 'Connolly', 'Flanagan', 'Maguire', 'Coleman', 'Hogan', 'Kavanagh'],
  },
  'Spain': {
    firstNames: ['Carlos', 'Diego', 'Alejandro', 'Pablo', 'Alvaro', 'Marcos', 'Sergio', 'Dani', 'Pedri', 'Gavi', 'Ferran', 'Rodri', 'Mikel', 'Jordi', 'Raul', 'Fernando', 'Andres', 'David', 'Iker', 'Nico'],
    lastNames: ['Garcia', 'Martinez', 'Lopez', 'Hernandez', 'Rodriguez', 'Gonzalez', 'Fernandez', 'Sanchez', 'Romero', 'Torres', 'Moreno', 'Ruiz', 'Diaz', 'Navarro', 'Alvarez', 'Jimenez', 'Ramos', 'Perez', 'Gutierrez', 'Molina'],
  },
  'France': {
    firstNames: ['Pierre', 'Jean', 'Antoine', 'Karim', 'Ousmane', 'Kylian', 'Hugo', 'Florian', 'Adrien', 'Paul', 'Theo', 'Aurelien', 'Moussa', 'Olivier', 'Raphael', 'Lucas', 'Clement', 'Mathieu', 'Remy', 'Youssouf'],
    lastNames: ['Dupont', 'Bernard', 'Moreau', 'Laurent', 'Lefevre', 'Roux', 'Girard', 'Bonnet', 'Lambert', 'Fontaine', 'Masson', 'Blanc', 'Petit', 'Deschamps', 'Dubois', 'Mercier', 'Andre', 'Leclerc', 'Fournier', 'Morel'],
  },
  'Germany': {
    firstNames: ['Thomas', 'Felix', 'Kai', 'Leon', 'Timo', 'Joshua', 'Florian', 'Julian', 'Leroy', 'Niklas', 'Lukas', 'Jonas', 'Bastian', 'Marco', 'Manuel', 'Max', 'Jamal', 'Serge', 'Ilkay', 'Robin'],
    lastNames: ['Mueller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Wagner', 'Becker', 'Schulz', 'Hoffmann', 'Koch', 'Richter', 'Wolf', 'Schaefer', 'Zimmermann', 'Krause', 'Braun', 'Hartmann', 'Lange', 'Werner', 'Kroos'],
  },
  'Italy': {
    firstNames: ['Marco', 'Andrea', 'Luca', 'Giovanni', 'Alessandro', 'Federico', 'Lorenzo', 'Matteo', 'Nicolo', 'Gianluigi', 'Stefano', 'Fabio', 'Giorgio', 'Roberto', 'Davide', 'Sandro', 'Pietro', 'Simone', 'Claudio', 'Riccardo'],
    lastNames: ['Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Conti', 'Galli', 'Mancini', 'Barbieri', 'Moretti', 'Marchetti', 'Rinaldi', 'Pellegrini', 'Santoro', 'De Luca'],
  },
  'Brazil': {
    firstNames: ['Gabriel', 'Lucas', 'Rafael', 'Pedro', 'Bruno', 'Vinicius', 'Matheus', 'Felipe', 'Thiago', 'Gustavo', 'Rodrigo', 'Eduardo', 'Leonardo', 'Fernando', 'Diego', 'Marcos', 'Caio', 'Danilo', 'Eder', 'Richarlison'],
    lastNames: ['Silva', 'Santos', 'Oliveira', 'Souza', 'Pereira', 'Costa', 'Fernandes', 'Rodrigues', 'Almeida', 'Lima', 'Gomes', 'Ribeiro', 'Martins', 'Carvalho', 'Araujo', 'Barbosa', 'Moreira', 'Nascimento', 'Ferreira', 'Vieira'],
  },
  'Argentina': {
    firstNames: ['Lionel', 'Lautaro', 'Angel', 'Paulo', 'Nicolas', 'Leandro', 'Gonzalo', 'Maxi', 'Emiliano', 'Julian', 'Cristian', 'Lisandro', 'Enzo', 'Alejandro', 'Rodrigo', 'Giovani', 'Sergio', 'Marcos', 'Thiago', 'Matias'],
    lastNames: ['Martinez', 'Gonzalez', 'Rodriguez', 'Lopez', 'Fernandez', 'Garcia', 'Alvarez', 'Romero', 'Perez', 'Diaz', 'Acuna', 'Paredes', 'Molina', 'Otamendi', 'Ruiz', 'Correa', 'Garay', 'Ocampo', 'Medina', 'Zarate'],
  },
  'Portugal': {
    firstNames: ['Bruno', 'Bernardo', 'Ruben', 'Joao', 'Diogo', 'Nuno', 'Rafael', 'Goncalo', 'Vitinha', 'Andre', 'Pedro', 'Rui', 'Ricardo', 'Sergio', 'Nelson', 'Luis', 'Tiago', 'Eduardo', 'Helder', 'Hugo'],
    lastNames: ['Silva', 'Santos', 'Ferreira', 'Pereira', 'Oliveira', 'Costa', 'Fernandes', 'Rodrigues', 'Martins', 'Sousa', 'Gomes', 'Lopes', 'Almeida', 'Ribeiro', 'Pinto', 'Neves', 'Mendes', 'Tavares', 'Vieira', 'Dias'],
  },
  'Netherlands': {
    firstNames: ['Virgil', 'Frenkie', 'Memphis', 'Matthijs', 'Denzel', 'Steven', 'Daley', 'Cody', 'Wout', 'Xavi', 'Teun', 'Jurrien', 'Donyell', 'Nathan', 'Ryan', 'Marten', 'Kenneth', 'Jerdy', 'Tyrell', 'Quinten'],
    lastNames: ['De Jong', 'Van Dijk', 'De Ligt', 'Bakker', 'Jansen', 'Visser', 'Smit', 'Mulder', 'De Boer', 'Bos', 'Peters', 'Hendriks', 'Dijkstra', 'Vermeer', 'Schouten', 'Koopmeiners', 'Berghuis', 'Wijnaldum', 'Gravenberch', 'Timber'],
  },
  'Belgium': {
    firstNames: ['Kevin', 'Romelu', 'Eden', 'Thibaut', 'Yannick', 'Axel', 'Amadou', 'Leandro', 'Timothy', 'Youri', 'Thorgan', 'Dries', 'Michy', 'Nacer', 'Jan', 'Thomas', 'Divock', 'Christian', 'Dennis', 'Arthur'],
    lastNames: ['Peeters', 'Janssens', 'Maes', 'Jacobs', 'Willems', 'Claes', 'Goossens', 'Wouters', 'De Bruyne', 'Mertens', 'Hazard', 'Lukaku', 'Tielemans', 'Dendoncker', 'Castagne', 'Vertonghen', 'Alderweireld', 'Boyata', 'Vanaken', 'Openda'],
  },
  'Colombia': {
    firstNames: ['James', 'Luis', 'Juan', 'David', 'Carlos', 'Santiago', 'Daniel', 'Andres', 'Miguel', 'Rafael', 'Yerry', 'Duvan', 'Wilmar', 'Jefferson', 'Jhon', 'Mateus', 'Alfredo', 'Radamel', 'Camilo', 'Stefan'],
    lastNames: ['Rodriguez', 'Martinez', 'Garcia', 'Lopez', 'Gonzalez', 'Hernandez', 'Diaz', 'Moreno', 'Sanchez', 'Ramirez', 'Muriel', 'Zapata', 'Cuadrado', 'Ospina', 'Mina', 'Barrios', 'Arias', 'Mojica', 'Lerma', 'Sinisterra'],
  },
  'Uruguay': {
    firstNames: ['Luis', 'Edinson', 'Federico', 'Rodrigo', 'Giorgian', 'Jose', 'Martin', 'Ronald', 'Diego', 'Sebastian', 'Matias', 'Nicolas', 'Agustin', 'Facundo', 'Maximiliano', 'Gaston', 'Nahitan', 'Mathias', 'Darwin', 'Manuel'],
    lastNames: ['Suarez', 'Cavani', 'Valverde', 'Godin', 'Nunez', 'Araujo', 'Bentancur', 'Gimenez', 'Torreira', 'Vecino', 'Caceres', 'Coates', 'Olivera', 'Pellistri', 'Vina', 'Ugarte', 'Canobbio', 'Alvarez', 'Torres', 'Muslera'],
  },
  'Croatia': {
    firstNames: ['Luka', 'Ivan', 'Mateo', 'Marcelo', 'Mario', 'Ante', 'Josko', 'Andrej', 'Lovro', 'Josip', 'Nikola', 'Borna', 'Dominik', 'Marko', 'Dejan', 'Duje', 'Mislav', 'Bruno', 'Kristijan', 'Martin'],
    lastNames: ['Modric', 'Perisic', 'Kovacic', 'Brozovic', 'Kramaric', 'Rebic', 'Gvardiol', 'Vlasic', 'Livakovic', 'Juranovic', 'Lovren', 'Pasalic', 'Budimir', 'Majer', 'Sucic', 'Sosa', 'Vida', 'Stanisic', 'Ivanusec', 'Erlic'],
  },
  'Denmark': {
    firstNames: ['Christian', 'Pierre', 'Thomas', 'Kasper', 'Andreas', 'Simon', 'Mikkel', 'Rasmus', 'Joakim', 'Daniel', 'Joachim', 'Martin', 'Henrik', 'Alexander', 'Victor', 'Jesper', 'Jonas', 'Mads', 'Jannik', 'Oliver'],
    lastNames: ['Eriksen', 'Hojbjerg', 'Schmeichel', 'Christensen', 'Kjaer', 'Delaney', 'Damsgaard', 'Dolberg', 'Maehle', 'Braithwaite', 'Lindstrom', 'Skov', 'Olsen', 'Andersen', 'Jensen', 'Nielsen', 'Poulsen', 'Wind', 'Hjulmand', 'Smed'],
  },
  'Norway': {
    firstNames: ['Erling', 'Martin', 'Sander', 'Alexander', 'Kristian', 'Birger', 'Morten', 'Fredrik', 'Stefan', 'Jens', 'Ola', 'Stian', 'Mohamed', 'Joshua', 'Patrick', 'Andreas', 'Leo', 'Julian', 'Mathias', 'Oscar'],
    lastNames: ['Haaland', 'Odegaard', 'Berge', 'Sorloth', 'Ajer', 'Thorsby', 'Elyounoussi', 'Nyland', 'Meling', 'King', 'Normann', 'Pedersen', 'Berg', 'Larsen', 'Hansen', 'Johansen', 'Strand', 'Bakke', 'Iversen', 'Lund'],
  },
  'Sweden': {
    firstNames: ['Zlatan', 'Alexander', 'Emil', 'Viktor', 'Robin', 'Marcus', 'Ludwig', 'Dejan', 'Mattias', 'Albin', 'Sebastian', 'Joel', 'Jens', 'Patrik', 'Ken', 'Oscar', 'Anthony', 'Kristoffer', 'Pontus', 'Hugo'],
    lastNames: ['Ibrahimovic', 'Isak', 'Forsberg', 'Kulusevski', 'Claesson', 'Svanberg', 'Olsson', 'Krafth', 'Lindelof', 'Ekdal', 'Larsson', 'Johansson', 'Andersson', 'Nilsson', 'Svensson', 'Karlsson', 'Eriksson', 'Gustafsson', 'Lindqvist', 'Berg'],
  },
  'Switzerland': {
    firstNames: ['Xherdan', 'Granit', 'Haris', 'Manuel', 'Fabian', 'Breel', 'Remo', 'Denis', 'Djibril', 'Ricardo', 'Cedric', 'Nico', 'Renato', 'Ruben', 'Silvan', 'Noah', 'Dan', 'Kevin', 'Leonidas', 'Ardon'],
    lastNames: ['Shaqiri', 'Xhaka', 'Seferovic', 'Akanji', 'Schar', 'Embolo', 'Freuler', 'Zakaria', 'Rodriguez', 'Elvedi', 'Steffen', 'Widmer', 'Okafor', 'Vargas', 'Rieder', 'Ndoye', 'Zuber', 'Mehmedi', 'Gavranovic', 'Jashari'],
  },
  'Nigeria': {
    firstNames: ['Victor', 'Alex', 'Wilfred', 'Kelechi', 'Samuel', 'Emmanuel', 'Ahmed', 'Moses', 'Ola', 'Calvin', 'Joe', 'Frank', 'Taiwo', 'Kenneth', 'Bright', 'Ademola', 'Sadiq', 'Terem', 'Zaidu', 'Cyriel'],
    lastNames: ['Osimhen', 'Iwobi', 'Ndidi', 'Iheanacho', 'Chukwueze', 'Osayi-Samuel', 'Musa', 'Simon', 'Aina', 'Awoniyi', 'Lookman', 'Ekong', 'Bassey', 'Troost-Ekong', 'Sanusi', 'Aribo', 'Dennis', 'Onuachu', 'Okoye', 'Ejuke'],
  },
  'Senegal': {
    firstNames: ['Sadio', 'Kalidou', 'Edouard', 'Ismaila', 'Cheikhou', 'Idrissa', 'Abdou', 'Boulaye', 'Pape', 'Famara', 'Krepin', 'Moussa', 'Habib', 'Nampalys', 'Saliou', 'Iliman', 'Nicolas', 'Bamba', 'Lamine', 'Aliou'],
    lastNames: ['Mane', 'Koulibaly', 'Mendy', 'Sarr', 'Kouyate', 'Gueye', 'Diallo', 'Dia', 'Cisse', 'Diedhiou', 'Diatta', 'Niakhate', 'Ndiaye', 'Dieng', 'Sabaly', 'Balde', 'Diouf', 'Gomis', 'Seck', 'Wague'],
  },
  'Morocco': {
    firstNames: ['Achraf', 'Hakim', 'Youssef', 'Sofiane', 'Nayef', 'Noussair', 'Romain', 'Selim', 'Sofyan', 'Yassine', 'Bilal', 'Ayoub', 'Munir', 'Amine', 'Zakaria', 'Azzedine', 'Jawad', 'Imran', 'Walid', 'Ilias'],
    lastNames: ['Hakimi', 'Ziyech', 'En-Nesyri', 'Boufal', 'Aguerd', 'Mazraoui', 'Saiss', 'Amrabat', 'Bounou', 'El Kaabi', 'Ounahi', 'Amallah', 'Cheddira', 'Bennacer', 'Aboukhlal', 'Harit', 'Tissoudali', 'Dari', 'El Khannouss', 'Ezzalzouli'],
  },
  'Japan': {
    firstNames: ['Takumi', 'Takehiro', 'Daichi', 'Kaoru', 'Junya', 'Wataru', 'Ritsu', 'Ao', 'Yuto', 'Hiroki', 'Keisuke', 'Shinji', 'Gaku', 'Daizen', 'Kyogo', 'Koji', 'Ayase', 'Mao', 'Hidemasa', 'Reo'],
    lastNames: ['Minamino', 'Tomiyasu', 'Kamada', 'Mitoma', 'Ito', 'Endo', 'Doan', 'Tanaka', 'Nagatomo', 'Sakai', 'Honda', 'Kagawa', 'Shibasaki', 'Maeda', 'Furuhashi', 'Miyoshi', 'Ueda', 'Hosoya', 'Morita', 'Hatate'],
  },
  'South Korea': {
    firstNames: ['Heung-Min', 'Min-Jae', 'Jae-Sung', 'Hwang', 'Woo-Young', 'In-Beom', 'Ui-Jo', 'Gue-Sung', 'Jin-Su', 'Seung-Ho', 'Chang-Hoon', 'Young-Gwon', 'Dong-Jun', 'Sang-Ho', 'Tae-Hwan', 'Hee-Chan', 'Ji-Sung', 'Myung-Bo', 'Sung-Yueng', 'Min-Hyeok'],
    lastNames: ['Son', 'Kim', 'Lee', 'Park', 'Hwang', 'Jung', 'Cho', 'Kwon', 'Hong', 'Na', 'Jeong', 'Song', 'Kang', 'Bae', 'Yoon', 'Paik', 'Moon', 'Choi', 'Oh', 'Seol'],
  },
  'Ghana': {
    firstNames: ['Thomas', 'Andre', 'Mohammed', 'Jordan', 'Daniel', 'Jeffrey', 'Kamaldeen', 'Osman', 'Alexander', 'Jonathan', 'Abdul', 'Baba', 'John', 'Kasim', 'Fatawu', 'Elisha', 'Antoine', 'Richmond', 'Edmund', 'Tariq'],
    lastNames: ['Partey', 'Ayew', 'Kudus', 'Sulemana', 'Amartey', 'Schlupp', 'Bukari', 'Rahman', 'Djiku', 'Mensah', 'Nuamah', 'Semenyo', 'Ofori', 'Owusu', 'Salisu', 'Issahaku', 'Lamptey', 'Addo', 'Boateng', 'Agyemang'],
  },
  'Ivory Coast': {
    firstNames: ['Nicolas', 'Franck', 'Sebastien', 'Serge', 'Eric', 'Maxwel', 'Ibrahim', 'Wilfried', 'Simon', 'Jean', 'Odilon', 'Amad', 'Ghislain', 'Christian', 'Willy', 'Emmanuel', 'Seko', 'Hamed', 'Jeremie', 'Moussa'],
    lastNames: ['Pepe', 'Kessie', 'Haller', 'Aurier', 'Bailly', 'Cornet', 'Sangare', 'Zaha', 'Adingra', 'Diallo', 'Konan', 'Boly', 'Gradel', 'Bamba', 'Deli', 'Fofana', 'Traore', 'Kone', 'Diomande', 'Seri'],
  },
  'Cameroon': {
    firstNames: ['Vincent', 'Andre', 'Eric', 'Karl', 'Bryan', 'Collins', 'Martin', 'Jean', 'Samuel', 'Moumi', 'Pierre', 'Christian', 'Georges', 'Olivier', 'Arnaud', 'Harold', 'Clinton', 'James', 'Nicolas', 'Stephane'],
    lastNames: ['Aboubakar', 'Choupo-Moting', 'Onana', 'Toko Ekambi', 'Anguissa', 'Fai', 'Ngamaleu', 'Mbeumo', 'Hongla', 'Nkoulou', 'Bassogog', 'Njie', 'Malong', 'Ntcham', 'Dawa', 'Castelletto', 'Ganago', 'Mbekeli', 'Wooh', 'Ondoua'],
  },
  'Poland': {
    firstNames: ['Robert', 'Piotr', 'Arkadiusz', 'Kamil', 'Wojciech', 'Grzegorz', 'Jakub', 'Mateusz', 'Sebastian', 'Bartosz', 'Krzysztof', 'Przemyslaw', 'Jan', 'Maciej', 'Lukasz', 'Tomasz', 'Michal', 'Kacper', 'Nicola', 'Damian'],
    lastNames: ['Lewandowski', 'Zielinski', 'Milik', 'Szczesny', 'Krychowiak', 'Glik', 'Kiwior', 'Moder', 'Szymanski', 'Bednarek', 'Cash', 'Zalewski', 'Frankowski', 'Piatek', 'Zurkowski', 'Linetty', 'Bereszynski', 'Dawidowicz', 'Buksa', 'Swiderski'],
  },
  'Turkey': {
    firstNames: ['Hakan', 'Cengiz', 'Burak', 'Irfan', 'Yusuf', 'Merih', 'Caglar', 'Enes', 'Kerem', 'Ferdi', 'Orkun', 'Baris', 'Arda', 'Cenk', 'Oguzhan', 'Emre', 'Okay', 'Dorukhan', 'Serdar', 'Halil'],
    lastNames: ['Calhanoglu', 'Under', 'Yilmaz', 'Kahveci', 'Yazici', 'Demiral', 'Soyuncu', 'Unal', 'Akturkoglu', 'Kadioglu', 'Kokcu', 'Alper', 'Guler', 'Tosun', 'Ozyakup', 'Mor', 'Yokuslu', 'Tokoz', 'Aziz', 'Dervisoglu'],
  },
  'Serbia': {
    firstNames: ['Dusan', 'Aleksandar', 'Sergej', 'Filip', 'Nikola', 'Nemanja', 'Luka', 'Sasa', 'Strahinja', 'Stefan', 'Andrija', 'Ivan', 'Djordje', 'Marko', 'Predrag', 'Dejan', 'Branislav', 'Darko', 'Veljko', 'Milos'],
    lastNames: ['Vlahovic', 'Mitrovic', 'Milinkovic-Savic', 'Kostic', 'Milenkovic', 'Gudelj', 'Jovic', 'Lukic', 'Pavlovic', 'Lazovic', 'Zivkovic', 'Tadic', 'Gacinovic', 'Grujic', 'Radonjic', 'Maksimovic', 'Ivanovic', 'Matic', 'Veljkovic', 'Birmancevic'],
  },
  'Czech Republic': {
    firstNames: ['Patrik', 'Tomas', 'Vladimir', 'Adam', 'Jakub', 'Jan', 'Alex', 'Pavel', 'Vaclav', 'Antonin', 'David', 'Petr', 'Ladislav', 'Ondrej', 'Matej', 'Michael', 'Lukas', 'Daniel', 'Filip', 'Michal'],
    lastNames: ['Schick', 'Soucek', 'Coufal', 'Hlozek', 'Jankto', 'Holes', 'Kral', 'Darida', 'Barak', 'Cerny', 'Provod', 'Krejci', 'Brabec', 'Zima', 'Stanek', 'Sadilek', 'Lingr', 'Chytil', 'Vlkanova', 'Sevcik'],
  },
  'Austria': {
    firstNames: ['David', 'Marcel', 'Konrad', 'Christoph', 'Valentino', 'Xaver', 'Kevin', 'Stefan', 'Michael', 'Marko', 'Florian', 'Patrick', 'Martin', 'Romano', 'Sasa', 'Gernot', 'Louis', 'Andreas', 'Alexander', 'Maximilian'],
    lastNames: ['Alaba', 'Sabitzer', 'Laimer', 'Baumgartner', 'Schlager', 'Arnautovic', 'Lainer', 'Grillitsch', 'Gregoritsch', 'Kalajdzic', 'Posch', 'Wober', 'Seiwald', 'Trauner', 'Danso', 'Hinteregger', 'Lienhart', 'Wimmer', 'Schmid', 'Prass'],
  },
  'USA': {
    firstNames: ['Christian', 'Weston', 'Tyler', 'Giovanni', 'Brenden', 'Sergino', 'Yunus', 'Timothy', 'Josh', 'Malik', 'Jordan', 'Brandon', 'Ricardo', 'DeAndre', 'Matt', 'Ethan', 'Folarin', 'Haji', 'Chris', 'Walker'],
    lastNames: ['Pulisic', 'McKennie', 'Adams', 'Reyna', 'Aaronson', 'Dest', 'Musah', 'Weah', 'Sargent', 'Tillman', 'Morris', 'Pepi', 'Robinson', 'Yedlin', 'Turner', 'Horvath', 'Balogun', 'Wright', 'Richards', 'Zimmerman'],
  },
  // ── Additional European nationalities for real leagues ──
  'Bulgaria': {
    firstNames: ['Ivan', 'Georgi', 'Dimitar', 'Kiril', 'Todor', 'Atanas', 'Vasil', 'Bozhidar', 'Martin', 'Kristiyan', 'Stanislav', 'Aleksandar', 'Nikolay', 'Petar', 'Hristo'],
    lastNames: ['Petrov', 'Ivanov', 'Dimitrov', 'Georgiev', 'Todorov', 'Nikolov', 'Stoyanov', 'Angelov', 'Kolev', 'Marinov', 'Popov', 'Hristov', 'Iliev', 'Bozhikov', 'Despodov'],
  },
  'Finland': {
    firstNames: ['Teemu', 'Jari', 'Mikael', 'Joel', 'Robin', 'Fredrik', 'Rasmus', 'Daniel', 'Lukas', 'Oliver', 'Pyry', 'Urho', 'Joona', 'Kaan', 'Riku'],
    lastNames: ['Pukki', 'Laine', 'Raitala', 'Kamara', 'Pohjanpalo', 'Hradecky', 'Sparv', 'Jensen', 'Soiri', 'Valakari', 'Forss', 'Niskanen', 'Ojala', 'Lod', 'Karjalainen'],
  },
  'Greece': {
    firstNames: ['Giorgos', 'Kostas', 'Dimitris', 'Sotiris', 'Vangelis', 'Anastasios', 'Petros', 'Manolis', 'Panagiotis', 'Thanasis', 'Christos', 'Nikos', 'Alexandros', 'Efthymis', 'Lazaros'],
    lastNames: ['Papadopoulos', 'Nikolaou', 'Mavropanos', 'Tzolis', 'Bakasetas', 'Pelkas', 'Fortounis', 'Mantalos', 'Vlachodimos', 'Tzavellas', 'Giannoulis', 'Limnios', 'Kourbelis', 'Svarnas', 'Ioannidis'],
  },
  'Hungary': {
    firstNames: ['Dominik', 'Roland', 'Ádám', 'Willi', 'Attila', 'Dániel', 'László', 'Zsolt', 'Barnabás', 'Loïc', 'Milos', 'Bendegúz', 'Péter', 'Márton', 'Tamás'],
    lastNames: ['Szoboszlai', 'Szalai', 'Gulácsi', 'Fiola', 'Orbán', 'Kecskés', 'Nagy', 'Botka', 'Varga', 'Kleinheisler', 'Schäfer', 'Gazdag', 'Bolla', 'Nego', 'Csonka'],
  },
  'Iceland': {
    firstNames: ['Aron', 'Birkir', 'Gylfi', 'Ragnar', 'Jón', 'Kolbeinn', 'Alfreð', 'Rúnar', 'Víðir', 'Mikael', 'Daníel', 'Hólmar', 'Arnór', 'Stefán', 'Sveinn'],
    lastNames: ['Sigurdsson', 'Gunnarsson', 'Finnbogason', 'Bjarnason', 'Árnason', 'Magnússon', 'Sigþórsson', 'Sævarsson', 'Halldórsson', 'Hermannsson', 'Guðmundsson', 'Ingason', 'Andersen', 'Traustason', 'Pálsson'],
  },
  'Israel': {
    firstNames: ['Eran', 'Yossi', 'Dor', 'Manor', 'Shon', 'Nir', 'Eli', 'Omer', 'Tal', 'Lior', 'Hatem', 'Sagiv', 'Raz', 'Gadi', 'Dan'],
    lastNames: ['Zahavi', 'Peretz', 'Dabbur', 'Solomon', 'Weissman', 'Haziza', 'Atzili', 'Bitton', 'Natcho', 'Tibi', 'Arad', 'Elhamed', 'Golasa', 'Glazer', 'Lavi'],
  },
  'Romania': {
    firstNames: ['Nicolae', 'Alexandru', 'Florin', 'Denis', 'Ianis', 'Răzvan', 'Valentin', 'George', 'Adrian', 'Ciprian', 'Marius', 'Bogdan', 'Claudiu', 'Andrei', 'Ionuț'],
    lastNames: ['Popescu', 'Ionescu', 'Stanciu', 'Hagi', 'Marin', 'Mitriță', 'Drăgușin', 'Radu', 'Nedelcu', 'Tătărușanu', 'Chiricheș', 'Bancu', 'Coman', 'Maxim', 'Keșerü'],
  },
  'Slovakia': {
    firstNames: ['Marek', 'Ondrej', 'Milan', 'Stanislav', 'Peter', 'Juraj', 'Dávid', 'Róbert', 'Vladimír', 'Tomáš', 'Norbert', 'Lukáš', 'Martin', 'Erik', 'Patrik'],
    lastNames: ['Hamšík', 'Škriniar', 'Dúbravka', 'Lobotka', 'Kucka', 'Mak', 'Valjent', 'Hancko', 'Gyömbér', 'Boženik', 'Suslov', 'Haraslín', 'Pekarík', 'Schranz', 'Strelec'],
  },
  'Ukraine': {
    firstNames: ['Andriy', 'Oleksandr', 'Taras', 'Mykola', 'Vitaliy', 'Ruslan', 'Artem', 'Viktor', 'Serhiy', 'Roman', 'Illia', 'Bohdan', 'Eduard', 'Denys', 'Yevhen'],
    lastNames: ['Shevchenko', 'Zinchenko', 'Mudryk', 'Malinovskyi', 'Yarmolenko', 'Mykolenko', 'Tsygankov', 'Dovbyk', 'Bondar', 'Zabarnyi', 'Sydorchuk', 'Stepanenko', 'Matviyenko', 'Shaparenko', 'Lunin'],
  },
  'Bosnia': {
    firstNames: ['Edin', 'Miralem', 'Sead', 'Anel', 'Ermedin', 'Haris', 'Gojko', 'Smail', 'Kenan', 'Riad', 'Amar', 'Ivan', 'Eldar', 'Luka', 'Denis'],
    lastNames: ['Džeko', 'Pjanić', 'Kolašinac', 'Ahmedhodžić', 'Demirović', 'Hajradinović', 'Cimirot', 'Prevljak', 'Kodro', 'Bešić', 'Mehmedović', 'Kvržić', 'Hadžić', 'Šunjić', 'Hasanović'],
  },
  'Cyprus': {
    firstNames: ['Giorgos', 'Pieros', 'Kostas', 'Grigoris', 'Ioannis', 'Fanos', 'Marios', 'Nicholas', 'Christos', 'Alexandros', 'Michalis', 'Andronikos', 'Loizos', 'Charalambos', 'Stelios'],
    lastNames: ['Sotiriou', 'Laifis', 'Kastanos', 'Pittas', 'Loizou', 'Kyriakou', 'Papoulis', 'Artymatas', 'Ioannou', 'Christofi', 'Makris', 'Katelaris', 'Spoljaric', 'Wheeler', 'Panayiotou'],
  },
  'Montenegro': {
    firstNames: ['Stefan', 'Stevan', 'Marko', 'Nikola', 'Adam', 'Mirko', 'Igor', 'Fatos', 'Ilija', 'Filip', 'Luka', 'Damir', 'Nemanja', 'Vladimir', 'Žarko'],
    lastNames: ['Savić', 'Jovetić', 'Marušić', 'Vujačić', 'Janković', 'Bećiraj', 'Ivanović', 'Mugosa', 'Raičković', 'Haksabanovic', 'Đurđević', 'Simić', 'Tomašević', 'Boljević', 'Krstović'],
  },
  'Slovenia': {
    firstNames: ['Jan', 'Benjamin', 'Josip', 'Miha', 'Andraž', 'Petar', 'Žan', 'Adam', 'Jasmin', 'Domen', 'Sandi', 'Aljaz', 'Erik', 'Timi', 'Luka'],
    lastNames: ['Oblak', 'Iličić', 'Kurtić', 'Šeško', 'Čerin', 'Bijol', 'Balkovec', 'Verbič', 'Mevlja', 'Stojinović', 'Zajc', 'Blažič', 'Lovrić', 'Gnezda Čerin', 'Horvat'],
  },
  'Albania': {
    firstNames: ['Elseid', 'Armando', 'Berat', 'Myrto', 'Nedim', 'Thomas', 'Amir', 'Kristjan', 'Ermir', 'Jasir', 'Ardian', 'Qazim', 'Keidi', 'Taulant', 'Ylber'],
    lastNames: ['Hysaj', 'Broja', 'Djimsiti', 'Uzuni', 'Bajrami', 'Strakosha', 'Abrashi', 'Asani', 'Lenjani', 'Roshi', 'Ismajli', 'Kumbulla', 'Bare', 'Xhaka', 'Ramadani'],
  },
  'Algeria': {
    firstNames: ['Riyad', 'Ismaël', 'Saïd', 'Yacine', 'Baghdad', 'Aïssa', 'Adlène', 'Hicham', 'Ramy', 'Adam', 'Youcef', 'Mohamed', 'Amir', 'Djamel', 'Sofiane'],
    lastNames: ['Mahrez', 'Bennacer', 'Brahimi', 'Feghouli', 'Slimani', 'Bounedjah', 'Guedioura', 'Boudaoui', 'Atal', 'Bensebaini', 'Delort', 'Belaïli', 'Mandi', 'Benrahma', 'Ounas'],
  },
  'Egypt': {
    firstNames: ['Mohamed', 'Ahmed', 'Mahmoud', 'Mostafa', 'Omar', 'Tarek', 'Ramadan', 'Amr', 'Karim', 'Trezeguet', 'Ibrahim', 'Ali', 'Marwan', 'Hamdi', 'Fathi'],
    lastNames: ['Salah', 'Hegazi', 'Elneny', 'Trezeguet', 'Sobhi', 'Warda', 'Kamal', 'Ashraf', 'Hassan', 'El Shenawy', 'Mohsen', 'Gaber', 'Hamdi', 'Fathy', 'Marmoush'],
  },
  'Mexico': {
    firstNames: ['Raúl', 'Hirving', 'Edson', 'Jesús', 'César', 'Diego', 'Héctor', 'Guillermo', 'Orbelín', 'Alexis', 'Uriel', 'Roberto', 'Luis', 'Carlos', 'Jorge'],
    lastNames: ['Jiménez', 'Lozano', 'Álvarez', 'Corona', 'Montes', 'Lainez', 'Herrera', 'Ochoa', 'Pineda', 'Vega', 'Antuna', 'Alvarado', 'Romo', 'Gutiérrez', 'Araujo'],
  },
  'Chile': {
    firstNames: ['Arturo', 'Alexis', 'Claudio', 'Gary', 'Mauricio', 'Eduardo', 'Charles', 'Erick', 'Guillermo', 'Pablo', 'Ben', 'Marcelino', 'Joaquín', 'Darío', 'Felipe'],
    lastNames: ['Vidal', 'Sánchez', 'Bravo', 'Medel', 'Isla', 'Vargas', 'Aránguiz', 'Pulgar', 'Maripán', 'Galdames', 'Brereton', 'Núñez', 'Montecinos', 'Osorio', 'Mora'],
  },
  'Tunisia': {
    firstNames: ['Youssef', 'Wahbi', 'Hannibal', 'Ellyes', 'Aïssa', 'Mohamed', 'Ali', 'Naïm', 'Saâd', 'Ferjani', 'Hamza', 'Aymen', 'Ghaylen', 'Seifeddine', 'Bilel'],
    lastNames: ['Msakni', 'Khazri', 'Mejbri', 'Skhiri', 'Laidouni', 'Sliti', 'Maaloul', 'Bronn', 'Bguir', 'Sassi', 'Mathlouthi', 'Jaziri', 'Chaalali', 'Meriah', 'Khenissi'],
  },
  'Jamaica': {
    firstNames: ['Leon', 'Michail', 'Bobby', 'Kemar', 'Shamar', 'Ravel', 'Damion', 'Andre', 'Daniel', 'Joel', 'Oniel', 'Javain', 'Dillon', 'Lamar', 'Ethan'],
    lastNames: ['Bailey', 'Antonio', 'Reid', 'Roofe', 'Nicholson', 'Morrison', 'Lowe', 'Gray', 'Johnson', 'Malcolm', 'Fisher', 'Brown', 'Pinnock', 'Walker', 'Beckford'],
  },
  'Ecuador': {
    firstNames: ['Moisés', 'Enner', 'Gonzalo', 'Piero', 'Pervis', 'Carlos', 'Byron', 'Ángel', 'Jeremy', 'Jhegson', 'Alan', 'Michael', 'Jackson', 'Romario', 'Jordy'],
    lastNames: ['Caicedo', 'Valencia', 'Plata', 'Hincapié', 'Estupiñán', 'Gruezo', 'Castillo', 'Mena', 'Sarmiento', 'Méndez', 'Franco', 'Estrada', 'Porozo', 'Ibarra', 'Caicedo'],
  },
};

/** Generic fallback names for nationalities not in the pools */
export const FALLBACK_FIRST_NAMES = [
  'James', 'Marcus', 'Lucas', 'Gabriel', 'Oliver', 'Noah', 'Ethan', 'Liam', 'Mason', 'Logan',
  'Alexander', 'Sebastian', 'Mateo', 'Daniel', 'Henry', 'Michael', 'Benjamin', 'Samuel', 'David', 'Joseph',
];

export const FALLBACK_LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Martinez', 'Rodriguez', 'Lopez', 'Wilson',
  'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White', 'Harris',
];
