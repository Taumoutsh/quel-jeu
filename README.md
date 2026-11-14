# GameSpotter

Un jeu de devinettes en français, inspiré de GameGuessr : une **vue** prise dans un jeu vidéo s'affiche (panorama à 360° ou capture d'écran).
1. Trouve **le nom du jeu**.
2. Une fois le jeu trouvé, sa **carte** s'ouvre : place ton repère à l'endroit où la vue a été prise.

Seul ou à plusieurs avec un **code de partie**.

## Règles

| Étape | Points |
|---|---|
| Nom du jeu trouvé | 1 000, −200 par erreur (minimum 200) |
| Position sur la carte | jusqu'à 1 000 : plein score à moins de 4 % de la diagonale de la carte, puis décroissance exponentielle douce (≈ 787 à 10 %, ≈ 527 à 20 %, ≈ 353 à 30 %, ≈ 159 à 50 %) |
| Nom raté / manche passée | 0 |

**Demande de précision.** Une réponse incomplète n'est **pas** comptée comme une erreur : on demande de préciser.
- nom de série : « Zelda », « GTA », « Pokémon », « Final Fantasy 7 »…
- titre sans son numéro ou sous-titre : « Red Dead Redemption » quand c'est le 2, « Super Mario Galaxy » quand c'est le 2, « Dark Souls » quand c'est le III…
- morceau de titre commun à plusieurs jeux : « Odyssey » (Mario ou Assassin's Creed ?)

Un **autre jeu précis** (« GTA 4 » au lieu de GTA V) compte comme une erreur.
Les chiffres romains et arabes sont équivalents (GTA V = GTA 5), les accents, la ponctuation et les petites fautes de frappe sont tolérés.
Avec les suggestions activées, une liste de choix s'affiche quand il faut préciser.

**Réglages** : nombre de manches (1 à 15), temps par manche (1, 2, 3 ou 5 min, ou illimité), nombre d'essais pour le nom (1, 3, 5 ou illimité), suggestions oui/non, images (pack démo, ma bibliothèque, mélange).

## Multijoueur

- L'hôte clique sur « En groupe » (créer une partie) et obtient un code à 5 caractères.
- Les amis ouvrent la même page, tapent le code et « Rejoindre ».
- L'hôte règle la partie et la lance. Tout le monde joue la même vue en même temps. La manche se termine quand tout le monde a fini ou quand le temps est écoulé. L'hôte peut aussi la terminer à la main.
- Si l'hôte part, un autre joueur peut reprendre le rôle.

Le multijoueur utilise la capacité « room » des artefacts Claude, ou les salles du serveur Docker (`server/server.js`) quand le site est auto-hébergé : chaque joueur publie son état (sa présence) dans une salle nommée `qj-<code>`. L'hôte publie l'état de la partie, les autres le suivent. Rien n'est stocké durablement côté serveur.
Pour jouer ensemble, tes amis doivent pouvoir ouvrir la même page : l'artefact (partagé depuis claude.ai) ou ton site Docker.

- Si l'hôte quitte ou ne répond plus (téléphone verrouillé, réseau coupé), le joueur arrivé le plus tôt devient hôte automatiquement (en 2 à 8 secondes environ) et la partie continue ; l'ancien hôte qui revient redevient simple joueur. Un joueur qui ne répond plus ne bloque pas la fin d'une manche.
- Le classement final garde les joueurs partis en cours de partie ; « Jeux trouvés » se lit sur les manches jouées par chacun (ex. 2/2 pour un joueur arrivé à la manche 2 d'une partie de 3).

- Sur téléphone, quitter le navigateur puis y revenir ne fait plus perdre la partie : la connexion se rétablit seule au retour, et si le téléphone a rechargé la page, elle rejoint automatiquement la partie en cours avec les réponses déjà données.
- Anti-triche (site Docker) : les captures et les cartes sont servies sous des codes neutres et les détails des vues sont brouillés ; l'onglet Réseau des outils du navigateur (F12) ne montre plus le nom du jeu ni du lieu.

## Signalements et administration (site Docker)
- Sur l'écran de résultat d'une manche, **« Signaler une erreur »** : position fausse (on peut toucher la carte au bon endroit), mauvais jeu, image inadaptée ou autre, avec un commentaire facultatif. Le bouton n'apparaît que sur le site auto-hébergé (le serveur garde les signalements), pour les vues du pack « Vrais jeux ».
- **Page `/admin`**, protégée par le mot de passe `QJ_ADMIN_PASSWORD` du `.env` (vide = désactivée ; 8 essais ratés par quart d'heure et par adresse) : liste des signalements par vue, capture, carte avec la position actuelle, l'originale et celles proposées par les joueurs. On peut changer le jeu, le nom du lieu et la position (toucher la carte, ou « Utiliser sa position »), rétablir l'original, supprimer la vue, et marquer chaque signalement résolu ou ignoré. L'onglet « Toutes les vues » permet de corriger n'importe quelle vue.
- Les corrections sont gardées par le serveur (volume Docker `gamespotter-data`, fichiers `reports.json` et `overrides.json`) et appliquées au pack servi aux joueurs, sans toucher au dépôt. « Exporter les corrections » les télécharge en JSON pour les reporter dans `packs/vrais-jeux.js`.

## Images

- **Pack démo** : 6 jeux fictifs (« Chroniques d'Astral II », « Chroniques d'Astral : Origines », « Ferro Nexus III », « Lune Pâle », « Le Récif Perdu », « Néon Velours ») et 48 vues. Tout est dessiné par le code (`js/demo.js`). Le décor dépend de la région de la carte, donc la vue donne des indices sur l'endroit.
- **Vrais jeux** : 1196 vues de 144 vrais jeux, trouvées en ligne, avec leur position sur la carte (`packs/vrais-jeux.js`). Chaque jeu a la même chance d'être tiré, quel que soit son nombre de vues.
  - **Panoramas 360°** :
    - *The Legend of Zelda: Breath of the Wild* : 47 vues sur 29 lieux, tirées du projet de fan [Zelda BotW Street View](https://nassimsoftware.github.io/zeldabotwstreetview/) (Nassim's Software), qui fournit aussi la carte et la position de chaque vue.
    - *The Elder Scrolls V: Skyrim* : 13 vues (Solitude, Markarth, Riften, Windhelm, Collège de Fortdhiver…) tirées de [Skyrim Panoramas](https://www.snakebytestudios.com/articles/gaming/skyrim-panoramas/) (Snakebyte Studios), placées sur la carte papier du jeu.
    - *Xenoblade Chronicles X* : 3 vues du wiki [FrontierNav](https://frontiernav.net/wiki/xenoblade-chronicles-x/visualisations/panoramas) (CC BY-SA 4.0), avec la carte de Mira et la position exacte de chaque vue (cubes en tuiles convertis en équirectangulaire).
  - **Captures plates** (wikis Fandom : une capture par lieu connu, placée sur la carte du jeu du même wiki) :
    | Jeu | Vues |
    |---|---|
    | Grand Theft Auto V | Del Perro Pier, Vespucci Beach, aéroport, Maze Bank Arena, hippodrome de Vinewood (carte de Los Santos), Legion Square, Los Santos Golf Club, Little Seoul, Mirror Park, Vespucci Canals |
    | Grand Theft Auto: San Andreas | The Strip, Gant Bridge, Mount Chiliad, Zone 69, Santa Maria Beach, Caligula's Palace (Las Venturas), Sherman Dam, Angel Pine, Bayside, Aéroport de Las Venturas |
    | Red Dead Redemption 2 | Valentine, Strawberry, Rhodes, Tumbleweed, Van Horn, Blackwater, Manoir Braithwaite, Colter, Fort Wallace, Gare de Flatneck |
    | Red Dead Redemption | Armadillo, Blackwater, MacFarlane's Ranch, Tumbleweed, Chuparosa, Rathskeller Fork, Fort Mercer, Las Hermanas, El Presidio, Nosalida |
    | Elden Ring | Église d'Elleh, Leyndell, château de Redmane, manoir du Volcan, manoir de Caria, Troisième église de Marika (Limgrave), Église de la communion draconique (Limgrave), Fort Haight (Limgrave), Pont des Saints (Limgrave), Lac Agheel (Limgrave) |
    | Genshin Impact | Port de Liyue, Inazuma, Sumeru, repaire de Stormterror, Dosdragon, Ville de Mondstadt, Khaj-Nisut, Sanctuaire de Sangonomiya, Sanctuaire d'Asase, Village de Qiaoying |
    | Assassin's Creed Odyssey | Athènes, Olympie, Cnossos, Mykonos, Argos, Delos - mont Cynthe, Sparte - statue de Léonidas, Mytilène (Lesbos), Naxos - port, Corinthe - temple d'Apollon |
    | Assassin's Creed Origins | Memphis, Gizeh, Siwa, Cyrène, Fayoum, Alexandrie - phare de Pharos, Alexandrie - tombeau d'Alexandre, Krokodilopolis |
    | Assassin's Creed IV: Black Flag | La Havane, Kingston, Nassau, Great Inagua |
    | Fallout: New Vegas | Le Strip, Goodsprings, barrage Hoover, Primm, Novac, Jacobstown, Camp McCarran, Black Mountain, Base aérienne de Nellis, Nipton |
    | Cyberpunk 2077 | Marché de Kabuki, Wellsprings, Grand Imperial Mall (position au quartier près), Arasaka Waterfront (Watson), Corpo Plaza (City Center) |
    | Grand Theft Auto IV | Middle Park, Star Junction, Statue of Happiness, Broker Bridge, Hove Beach, The Monoglobe (Dukes), Welham Parkway (Bohan), Soldiers Plaza (Broker), Firefly Island, Algonquin Bridge |
    | Grand Theft Auto: Vice City | Vice Point, Little Havana, Starfish Island, aéroport Escobar, Prawn Island, Hyman Memorial Stadium, Viceport |
    | Assassin's Creed Unity | La Bastille, Hôtel de Ville, Palais-Royal, Panthéon, palais du Luxembourg (plan de Paris de 1789), Notre-Dame de Paris, Collège des Quatre-Nations (Institut) |
    | Assassin's Creed Syndicate | Palais de Westminster, Buckingham Palace, cathédrale Saint-Paul, Tour de Londres, Pont de Londres, Gare de Victoria, Foreign Office (Whitehall) |
    | Zelda: Tears of the Kingdom | Hyrule central, village Rito, Lurelin, hautes terres d'Akkala, ville Goron |
    | Pokémon Écarlate et Violet | Levincia, Porto Marinada, Montenevera, Cascarrafa, Artazon, Medali, Los Platos, Ligue Pokémon de Paldea |
    | Final Fantasy XV | Lestallum, Cap Caem, Galdin Quay, pont vers Insomnia, disque de Cauthess, Hammerhead, Vesperpool, Aire de repos de Taelpar, Aire de repos de Longwythe, Tour de Costlemark |
    | Hollow Knight | Dirtmouth, routes oubliées, Vertchemin, Cité des Larmes, pic de cristal, Colisée des Fous, Village des Mantes (Seigneurs Mantes), Ruche (Chevalier de la Ruche), Antre de Nosk (Deepnest), Antre du Défenseur d'excréments (Voies royales) |
    | Yakuza Kiwami 2 | Theater Square, Millennium Tower, Pink Street, Tenkaichi Street, Nakamichi Street (Kamurocho), Champion District, Shichifuku Street, Taihei Boulevard |
    | The Elder Scrolls Online | Daggerfall, Wayrest, Elden Root, Mournhold, Vivec, Sentinelle, Anvil, Cité impériale, Balmora, Rifton (Riften) |
    | World of Warcraft | Hurlevent, Forgefer, Baie-du-Butin, ruines de Lordaeron, Lune-d'Argent (Quel'Thalas), Mont Rochenoire (Blackrock Mountain) |
    | Mafia: Definitive Edition | Bar de Salieri, aéroport, Works Quarter, hôtel de ville, Porte de Chinatown |
    | Mafia III | Opéra, hôtel de ville, églises de Frisco Fields et de Pointe Verdun, fresque de Delray Hollow |
    | Sleeping Dogs | Business District, North Point, Kennedy Town, Aberdeen, Cimetière de Hong Kong, Victoria Park, Government House, Parc de Yau Ling, Boardwalk (promenade) |
    | Assassin's Creed Brotherhood | Colisée, arc de Constantin, Panthéon (Rome), Château Saint-Ange |
    | Assassin's Creed Revelations | Sainte-Sophie, palais de Topkapı, port de Galata |
    | Assassin's Creed Mirage | Ville ronde, Harbiyah, Karkh, Abbasiyah (Bagdad) |
    | Final Fantasy XIV | Limsa Lominsa, Gridania, Ul'dah, Mor Dhona, Ala Mhigo (Gyr Abania) |
    | Sea of Thieves | Plunder, Sanctuary, Ancient Spire, Golden Sands, Smugglers' Bay, Cannon Cove, Lone Cove, Crook's Hollow, Thieves' Haven, Devil's Ridge |
    | RuneScape | Lumbridge, Varrock, Falador, Al Kharid, East Ardougne, Prifddinas, Brimhaven (Karamja), Canifis (Morytania), Menaphos, Pollnivneach |
    | Pokémon Épée et Bouclier | Circhester, Motostoke, Wedgehurst (gare), Postwick (maison du joueur), Mine de Galar (entrée), Stade de Turffield, Stade de Ballonlea, Hammerlocke, Stade de Stow-on-Side, Stade de Wyndon |
    | Kingdom Come: Deliverance | Rattay, Sasau, Skalitz, Talmberg, Monastère de Sasau, Samopesh, Église de Pribyslavitz, Ledetchko (forge), Auberge de la Clairière, Merhojed (camp de soldats) |
    | Dark Souls | Sanctuaire de Lige-Feu, Bourg des Morts-Vivants, Forteresse de Sen, Jardin de Noiracine, Vallée des drakes, Bassin de Noiracine |
    | Guild Wars 2 | Divinity's Reach, Lion's Arch, Rata Sum, Hoelbrak, Citadelle noire, Le Bosquet (Pale Tree), Œil du Nord, Tour du sorcier, Draconis Mons, Ebonhawke |
    | Fallout 76 | Charleston, Flatwoods, Morgantown, Watoga, Whitespring, Top of the World, Black Bear Lodge, Abri 76, Lewisburg, Palace of the Winding Path |
    | Bloodborne | Yharnam central, quartier de la cathédrale, Vieux Yharnam, Hemwick, château de Cainhurst, Forêt interdite, Byrgenwerth, Cauchemar de Mensis, Haut du quartier de la cathédrale |
    | L.A. Noire | Grauman's Chinese Theatre, décor d'Intolérance, Hall of Records, MacArthur Park, Angels Flight, Gare Union Station, Viaduc de la 4e Rue, Grand magasin Bullocks Wilshire, Siège du Los Angeles Examiner, Chambre de commerce de Hollywood |
    | Batman: Arkham City | Palais de justice, Park Row, Institut d'histoire naturelle Cyrus Pinkney, Aciérie Sionis |
    | Just Cause 3 | Mines de Cava Montana, province de Prospere, monastère, Citate di Ravello, Alte Potentia, Manaea, Costa Del Porto, Soliana, Cava Geminos Sud, Monastère Sancte Malco |
    | Grand Theft Auto III | Red Light District, Callahan Bridge, Belleville Park, Torrington, Cochrane Dam, Liberty Memorial Coliseum (Aspatria), Aéroport Francis International (Shoreside Vale), Chinatown (Portland) |
    | Grand Theft Auto: Liberty City Stories | Fort Staunton, Saint Mark's, Chinatown, Wichita Gardens, Bedford Point |
    | Grand Theft Auto: Vice City Stories | Little Havana, Ocean Beach, Starfish Island, aéroport, Vice Point |
    | Watch Dogs: Legion | Tour de Londres, Trafalgar Square, Big Ben, Buckingham, Tate Modern, Gare de Charing Cross, Brixton Arcade, Pont de Westminster, Piccadilly Circus, Gare de King's Cross |
    | Need for Speed: Most Wanted | Campus de Rosewood, Highlander Stadium, Century Square, Riverfront Stadium, aéroport, Hillcrest (Rosewood), Heritage Heights (Rosewood), Petersburg, Chantier naval Masterson |
    | Far Cry 6 | Esperanza, port de La Joya, Sierra Perdida, Conuco, Armonía (Quito), Maldito, Concepción, Segunda, Fort Quito |
    | The Crew 2 | Central Park, South Beach, le Strip, Millennium Park, Seattle, Golden Gate Bridge (San Francisco), Santa Fe, Nashville, Brooklyn (New York), Centre-ville de La Nouvelle-Orléans |
    | Bully | Bullworth Academy, Bullworth Town |
    | DayZ | Chernogorsk, Elektrozavodsk, Berezino, Novodmitrovsk, Severograd, Gorka, Svetlojarsk, Krasnostav, Kamyshovo, Balota |
    | PUBG: Battlegrounds | Pochinki, Georgopol, Yasnaya Polyana, Primorsk, base militaire (Erangel), Stalber (Erangel), Novorepnoye, le port (Erangel), École rouge de Rozhok (Erangel), Hôpital (Erangel), Centrale de Mylta Power (Erangel) |
    | Call of Duty: Warzone | Station TV, aéroport, port, carrière, fermes (Verdansk), Barrage de Gora (Verdansk), Stade de Verdansk (Verdansk), Prison de Zordaya (Verdansk), Gare de Verdansk (Verdansk), Cimetière d'avions de Zhokov (Verdansk) |
    | Tom Clancy's The Division 2 | Capitole, Federal Triangle, Downtown East, Lincoln Memorial, Archives nationales, Monument à Washington, Maison-Blanche, Eisenhower Executive Office Building |
    | Euro Truck Simulator 2 | Londres, Paris, Berlin, Prague, Vienne, Cologne, Milan, Liverpool, Cracovie, Hanovre |
    | American Truck Simulator | Los Angeles, Las Vegas, San Francisco, Phoenix, Sacramento, San Diego, Tucson, Oakland (port), Reno, Elko |
    | Final Fantasy XII | Cité impériale d'Archadès, Jahara, terre des Garifs, Mont Bur-Omisace, Plaine d'Ozmone, Bois de Feywood, Forteresse de Nalbina, Côte de Phon, Hauts plateaux de Tchita, Cité céleste de Bhujerba, Nécropole de Nabudis |
    | Dragon's Dogma | Cathédrale de Gran Soren, Tour de Lune-Bleue, Le Campement, Butte de Hillfigure, Bois de la Sorcière, Cassardis, Les Catacombes |
    | Dark Souls II | Majula, Tour de flamme de Heide, Bastille perdue, Donjon de fer, Forêt des géants déchus, Château de Drangleic, Donjon d'Aldia, Ravin noir, Quai de Personne, Sanctuaire de l'hiver |
    | Shadow of the Colossus | Temple de l'Adoration, Clairière ombragée (nord-ouest), Chutes brumeuses, Gorge de l'arche de pierre, Falaise de l'est, Forteresse du désert, Forêt d'automne, Sceau brisé, Cap de l'ouest, Repaire sur la mesa |
    | The Legend of Zelda: Echoes of Wisdom | Bourg d'Hyrule, Village Cocorico, Village Goron, Village Gerudo, Lac Hylia, Ranch d'Hyrule, Village de Suthorn, Lac Cœur, Village Zora de la rivière, Sanctuaire du Nord |
    | Fable II | Bowerstone (marché), Bloodstone, Wraithmarsh, Brightwood, Fairfax Gardens, Bowerstone (vieille ville), Bowerstone (cimetière) |
    | Dragon Age: The Veilguard | Minrathous (Tevinter), Forêt d'Arlathan, Weisshaupt (Anderfels), Côte de Rivain, Nécropole (Nevarra) |
    | Pillars of Eternity | Defiance Bay (Copperlane), Caed Nua, Twin Elms (Hearthsong), Defiance Bay (Heritage Hill), Gilded Vale, Raedric's Hold, Dyrford Village, Defiance Bay (Ondra's Gift), Oldsong, Burial Isle |
    | Mount & Blade II: Bannerlord | Ville de Vlandie, Ville aserai (sud), Village de Battanie, Seonon, Sargot |
    | ARK: Survival Evolved | Herbivore Island, The Dead Island, Cratère du volcan |
    | Conan Exiles | Sepermeru, New Asagarth, Black Galleon, Mounds of the Dead, The Summoning Place, The Temple of Frost, The Great Dam, Hullshatter Cove, The Eye that Never Closes, Westwatch Keep |
    | Dishonored 2 | Conservatoire royal (Cyria Gardens), District minier de Batista, Institut Addermire, Quartier d'Aventa, Manoir mécanique, Palais royal (Grand Palace), Manoir Stilton, Carrière nord de Shindaerey, Pêcheries de Santiago |
    | New World | Windsward, Brightwood (colonie), Mourningdale (colonie), Ebonscale Reach |
    | Dying Light 2 Stay Human | Old Villedor, Central Loop, Tour VNC, L'Observatoire, Cathédrale Saint-Paul, Gare Main Terminal, Château d'eau de Horseshoe |
    | Palworld | Astral Mountains, Feybreak Island, Windswept Hills |
    | Kingdoms of Amalur: Reckoning | Rathir, Adessa, Mel Senshir, Ysa, Idylla |
    | Far Cry 4 | Banapur, Utkarsh, Tirtha, Temple de Jalendu, Forteresse de Varshakot, Kyra Tea Weigh Station, Open Hearts Clinic, Shikharpur, Monastère de Namboche, Caserne de Lhumtse |
    | Far Cry 5 | Église Lamb of God (Holland Valley), Domaine de Joseph, Centre F.A.N.G. (Whitetail Mountains), Centre de vétérans St. Francis, Prosperity (Henbane River), Prison du comté de Hope, Arsenal de Jacob, Pont ferroviaire des Whitetail Mountains, Ferme à citrouilles de Rae-Rae, La Misère (The Misery) |
    | Far Cry Primal | Avant-poste Payska River, Avant-poste Rotten Lake, Avant-poste Kaba Blade, Avant-poste Nasan Horn (nord enneigé), Avant-poste Ring Wall, Avant-poste Kwacha Stone, Avant-poste Fallen Tashla, Avant-poste Swaras, Avant-poste Kapal, Avant-poste Nada Swamp |
    | Far Cry New Dawn | The FANG Center, Pont ferroviaire de la Henbane, The Bullet Farm, The Flame of Eden, Mine Blacklung, Meatfort, Hightower, Château Boshaw, Bonecrusher Pit, Atelier Zilon |
    | Just Cause 2 | Gunung Hotel Ski Resort, Kampung Bahari, Kem Jalan Merpati, Port de Pelabuhan Saudagar (Panau City), Temple de Rajang, Lembah Firdaus, Bandar Baru Nipah, Lengkok Sungai (repaire du Gambler), Casino de Panau Falls |
    | Need for Speed Heat | Downtown Palm City, Mendoza Keys, North Rockville (planque de Lucas), Bayview Park, Circuit de Palm City, Planque de Port Murphy, Planque de Cape Castille, Planque de Fort Callahan, Planque de Cloudbank, Planque de Sandino Ranches |
    | Need for Speed Payback | Silver Rock, Airfield 73, Gare de Fortune Valley (désert), Fortune Valley Resort & Casino (Mount Providence), Silver Canyon, Tune-Up Shop de Mount Providence, Tune-Up Shop du désert de Liberty, Concession Race (Ember Valley), Station-service de Carville, Station-service de la casse |
    | Dying Light | Garnison de Rais, Port des ferries, Sunny Apartments, Parking souterrain, Entrepôt chimique, Bazar du Serpent noir, École publique de Harran, Village des pêcheurs, Tunnel de Bright Mountain, Stuffed Turtle |
    | Metal Gear Solid V: The Phantom Pain | Forteresse de Spugmay (Afghanistan), Caserne de Wakh Sind (Afghanistan), Da Ghwandai Khar (Afghanistan), Centrale électrique de Serak (Afghanistan), Camp de base central (Afghanistan), Avant-poste de Yakho Oboo, Da Shago Kallai, Da Wialo Kallai, Poste de communication est, Ruines d'Aabe Shifap |
    | Escape from Tarkov | Customs : sortie Crossroads, Customs : sortie des dortoirs (V-Ex), Customs : passage vers Factory, Customs : passage vers Reserve, Customs : passage vers Shoreline, Customs : Trailer Park, Customs : vieille station-service, Customs : bunker ZB-1011, Customs : voie ferrée vers le port, Customs : bateau du contrebandier |
    | Valorant | Ascent : site A, Ascent : site B, Ascent : Market, Ascent : Mid Bottom, Ascent : spawn des défenseurs, Ascent : Catwalk, Ascent : spawn des attaquants, Ascent : Wine |
    | Counter-Strike 2 | Dust II : site B, Dust II : spawn CT, Dust II : entrée de Long A, Dust II : mid, Dust II : spawn T, Dust II : site A, Dust II : Short A, Dust II : fosse de Long A |
    | Overwatch 2 | King's Row (Londres), Dorado (Mexique), Ilios (Grèce), Busan (Corée du Sud), Paraíso (Rio de Janeiro), Blizzard World (Californie), Numbani (Nigeria) |
    | Arma 3 | Kavala, Aéroport international d'Altis, Sofia, Zaros, Neochori |
    | Team Fortress 2 | 2Fort : le pont, 2Fort : salle des renseignements RED, 2Fort : remparts RED, 2Fort : cour RED, 2Fort : entrée de la spirale RED |
    | Minecraft Dungeons | Squid Coast, Soggy Swamp, Redstone Mines, Desert Temple, Highblock Halls, Obsidian Pinnacle, Pumpkin Pastures, Cacti Canyon, Fiery Forge, Creeper Woods |
    | Left 4 Dead 2 | The Parish : débarquement du bateau, The Parish : Bienville Park, The Parish : statue équestre, The Parish : gare routière |
    | Dishonored | Prison de Coldridge, Place Holger, Île de Kingsparrow, Le pub des Hound Pits, Distillerie de whiskey de Dunwall, Tour de l'horloge, Pont de Kaldwin, Tour de Dunwall, Abattoir Rothwild, Berges du quartier des Drapers |
    | The Last of Us | Boston : le Capitole, Barrage de Tommy (Wyoming), Université du Colorado oriental, Salt Lake City, Seattle, Santa Barbara, Île Catalina, Waverly Township |
    | Fallout 3 | Tenpenny Tower, Washington Monument, Big Town, Jefferson Memorial, Canterbury Commons, Megaton, Rivet City, Le Capitole, La Citadelle, Paradise Falls |
    | Horizon Zero Dawn | Meridian, Cœur-de-la-Mère (terres des Nora), Sunfall, Pitchcliff, Maker's End, Free Heap, Lone Light, Sunstone Rock, Longnotch, Blazon Arch |
    | Ghost of Tsushima | Sanctuaire du Sommet doré (Izuhara), Sanctuaire de la Roche guérisseuse, Sources chaudes d'Hiyoshi, Domaine du Vent salé, Pont de la rivière Kuta, Dojo d'Ogawa, Camp de la plage, Sanctuaire de la Montagne sinueuse, Temple doré, Sanctuaire du Dragon de pierre |
    | The Witcher 3: Wild Hunt | Garnison nilfgaardienne (Vergers Blancs), Pont de Chantemalheur (Vergers Blancs), Moulin (Vergers Blancs), Village pillé (Vergers Blancs), Pont de Cackler (Vergers Blancs), Village abandonné (Vergers Blancs), Pont brisé (Vergers Blancs), Gué (Vergers Blancs), Carrefour (Vergers Blancs), Scierie (Vergers Blancs) |
    | Subnautica | Épave de l'Aurora (zone du crash), Forêt de kelp, Hauts-fonds sûrs, Zone des bulbes, Plateaux herbeux, Îles sous-marines, Forêt de champignons, Tranchée de kelp sanglant, Grand récif, Zone nord du kelp sanglant |
    | Fallout 4 | Sanctuary Hills, Diamond City, Le Château, Salem, Usine d'assemblage Corvega, Goodneighbor, USS Constitution, Musée de la Liberté (Concord), Old North Church, Aéroport de Boston |
    | Hogwarts Legacy | Vallée de Poudlard, Marais de la mer du Sud, Aranshire, Brocburrow, Irondale, Entrée de Pré-au-Lard, Château de Poudlard |
    | Kenshi | The Hub, Squin, Heng, Black Desert City, World's End, Mourn, Catun, Mongrel, Flats Lagoon, Admag |
    | Horizon Forbidden West | Barren Light, Scalding Spear, Salt Bite, Tide's Reach, Thornmarsh, Bleeding Mark, Memorial Grove, The Bulwark, Plainsong, Arrowhand |
    | God of War (2018) | Réserve de Fafnir, Conseil des Valkyries, Tour de guet |
    | Kingdom Come: Deliverance II | Troskowitz, Semine, Forteresse de Nebakov, Auberge des charretiers de Zhelejov, Étang de Rocktower, Tachov, Moulin du bas de Semine, Moulin de Nebakov, Apollonia, Cabane de Bozhena |
    | Fortnite | Tilted Towers, Loot Lake, Pleasant Park, Snobby Shores, Dusty Divot |
    | Dead Island 2 | Base avancée de Venice Beach (FOB), La Tour, Muscle Beach Gym, Ocean Walk Cafe, Brain Freeze, Blue Crab Grill, Deep Cuts, Venice Autos, Roses Tattoo, Gang Green |
    | Fable III | Bowerstone, vieux quartier, Bowerstone, quartier industriel, Vallée de Mistpeak, Camp des Dwellers, Sunset House, Palais de Sandfall |
    | Wuthering Waves | Avinoleum : tour de l'Ascension, Avinoleum : ruines de la salle d'escrime, Avinoleum : tour de l'Unité, Avinoleum : tour du Salut, Avinoleum : jardin de Zargon, Avinoleum : voie de l'Octroi, Avinoleum : ruines du dépôt titulaire |
    | Final Fantasy VII Rebirth | Kalm, Junon, Région de Nibelheim, Gongaga |
    | Black Myth: Wukong | Montagne du Vent Noir : à l'orée de la forêt, Montagne du Vent Noir : temple de Guanyin, Montagne du Vent Noir : sentier du Serpent, Montagne du Vent Noir : devant la caverne, Montagne du Vent Noir : pic Bodhi, Montagne du Vent Noir : collines de l'avant, Montagne du Vent Noir : bosquet de la Griffe du Loong, Montagne du Vent Noir : collines de l'arrière |
    | Infinity Nikki | Florawish : guilde des stylistes, Florawish : puits de la Fortune, Colline des Reliques, Résidence du maire (Florawish), Cabane du chasseur d'insectes, Florawish : auberge Daisy, Florawish : sanctuaire de l'Observateur |
    | Firewatch | Hawk's Rest, Lac Jonesy, Thunder Canyon, Téléphérique de Thorofare, Beartooth Point, Grotte 452, Two Forks Lookout, Largage de ravitaillement |
    | Life is Strange | Le phare, La casse (American Rust), Two Whales Diner, Blackwell Academy, La grange (the barn), Le château d'eau, Parking de Blackwell |
    | Need for Speed Unbound | City Pier, Planque de Rüdiger, Garage Rydell's Rydes, Storm Drain, Dômes de la carrière, Usine automobile (piste d'essai) |
    | Need for Speed: Underground 2 | Aéroport international de Bayview, Beacon Hill East, City Center, Fort Union, Jackson Heights, Pigeon Park, Stade (Cooper Field), Beacon Hill West, Coal Harbor East, Gare de triage de Coal Harbor |
    | Need for Speed: Hot Pursuit | Big Timber Forest, Barrage de Carson Ridge, Grand Ocean Coast, East Gorge Canyon, Boulder Desert, Parc de Mission Beach, Phare de Coral Bay, Tunnel de Memorial Valley, Eagle Crest, Rockingham Point |
    | Baldur's Gate 3 | Blighted Village, Camp gobelin, Repos de Waukeen, Overgrown Ruins, Épave du nautiloïde |
    | Avowed | Lighthouse, Claviger's Landing, Watermill, Magran's Assay, Godless Ruins |
    | The Legend of Zelda: Link's Awakening | Village des Mouettes, Plage de Toronbo, Marais Goponga, Œuf du Poisson-Rêve, Maison de la baie |
    | The Legend of Zelda: Skyward Sword | Terre scellée, Grand Arbre (forêt de Firone), Cascade de Floria, Volcan d'Ordinn, Célesbourg |
    | Xenoblade Chronicles | Syrath Lighthouse (mer d'Eryth), Central Seal Island (mer d'Eryth), High Entia Tomb (mer d'Eryth), Sleeping Dragon Isle (mer d'Eryth), Centre Gate (mer d'Eryth), Latael Shore (mer d'Eryth), Soltnar Seal Island (mer d'Eryth), Khatorl Seal Island (mer d'Eryth), Ether Plant (mer d'Eryth), Bionis' Occipital (mer d'Eryth) |
    | Death Stranding 2: On the Beach | Villa Libre, Abri de Sam, Ciudad Nudo del Norte, C1 South Distribution Center, Former Geophysics Research Lab |
    | The Long Dark | Camp Office, Carter Hydro Dam, Forestry Lookout, Logging Camp, Derailment, Destroyed Lookout, Frozen Creek, Rail Tunnel, Lake Cabins, Train Loading Area |
    | Silent Hill 2 | Société historique de Silent Hill, Pete's Bowl-O-Rama, Heaven's Night, Neely's Bar, Parc de Rosewater, Blue Creek Apartments, Jack's Inn, Happy Burger, Embarcadère (Boat launch), Café Mist |
    | Dead Island | Bunker 03, Bunker 04, Bunker 01, Bunker 06 |
    | Metro Exodus | Église du Tsar des Eaux, Le pont (Volga) |
    | Silent Hill: Homecoming | Cimetière de Rose Heights, Hôtel de ville de Shepherd's Glen, Casse de Curtis, Maison des Shepherd, Commissariat de Shepherd's Glen |
    | Silent Hill | Église Balkan, Queen Burger, Maison Gordon, Fish-n-Fries, Sundries Shop, Food and Liquor, Ghoul, Blue Belle, Café 5to2 |
    | Deus Ex: Mankind Divided | Station Palisade, Station Pilgrim, Station Monument, Station Čapek, Quartier rouge, Appartements Libuše, Appartements Zeleň, The Time Machine, Chez Chikane, 33 Hlavní |
    | Saints Row 2 | Aéroport Wardill, Cecil Park, Mission Beach, Brighton, Misty Lane |
    | Gotham Knights | Le Beffroi (Belfry), Iceberg Lounge, Asile d'Arkham, Prison de Blackgate |
    | Once Human | Overlook Town, Greywater Camp, Deadsville, Silo Psi, Épreuve de l'Ancien, Blackfell, Silo Theta, Silo Alpha, Tall Grass Inn, Silo EX1 |
    | Satisfactory | Côte des Flèches, Cratère bleu, Jungle rouge, Forêt des Titans, Plages de l'Ouest, Marais, Lacs du cratère, Champs de bambou rouge, Canyons du désert, Falaises de l'abysse |
    | Stray | Usine Neco, Place du marché, Prison, Toits, Cité morte, Bar de Midtown, Boîte de nuit, Station de métro de Midtown, Bibliothèque, Égouts |
    | Tom Clancy's Ghost Recon Breakpoint | Smuggler Coves, Mount Hodgson, Liberty, New Stirling, Egg Island, Cape North, Infinity, Seal Islands, Whalers Bay, Wild Coast |
    | Sekiro: Shadows Die Twice | Château d'Ashina, Domaine Hirata, Palais de la Source, Vallée engloutie, Faubourgs d'Ashina, Temple Senpou, Village de Mibu, Donjon abandonné |
    | Dragon Age: Inquisition | Skyhold, Val Royeaux, Forteresse d'Adamant, Redoute de Therinfal, Côte des Tempêtes, Palais d'Hiver (Halamshiral), Redcliffe |
    | Old School RuneScape | Château de Lumbridge, Parc de Falador, Al Kharid, Draynor Village, Edgeville, Canifis, Nardah, Brimhaven, Catherby, Rellekka |
    | 7 Days to Die | Haven Hotel, Navezgane Athletics Complex, Installation Blue Ridge, Jack's Lumber Mill, Correa Rockworx, Fort Choppa, Hurry Harry's, Navezgane Corrections, Trader Rekt, Fort Bags |
    | Hunt: Showdown | Pitching Crematorium, Stillwater Bend, Lockbay Docks, Darrow Livestock, Cyprus Huts, Port Reeker, Alice Farm, Alain & Son's Fish, Davant Ranch, Scupper Lake |
    | Clair Obscur: Expedition 33 | Village gestral, Le Carrousel, Casino volant, Colisée de Sirène, Île des Visages, Lumière, Robe de Sirène, Cimetière flottant, Île des Yeux, Sables blancs |
    | Test Drive Unlimited 2 | Zenith loft, Salines mansion, Seaside apartment, Portinatx residence, Fujinoki residence, Sant Jordi residence, Sant Llorenç hacienda, Fontanelles house, Eivissa house, Santa Eulària residence |
    | Apex Legends | Le Baromètre, Ship Fall, North Pad, Le Moulin (The Mill), Storm Catcher, Cenote Cave, Checkpoint, L'Antenne (The Antenna) |
    | Skull and Bones | Three Brothers, Île Michel, Sunken Goldmine, The Oubliette, Great Ukuta, Dragon's Back, Return Fleet Bight, Vorona Falls, Ruined Lighthouse, Dutchman's Camp |
    | Borderlands 2 | Sanctuary, Opportunity, Friendship Gulag, Bloodshot Stronghold, Frostburn Canyon, Southern Shelf Bay, Thousand Cuts, Lynchwood, Tundra Express, Wildlife Exploitation Preserve |
    | The Legend of Zelda: Tears of the Kingdom | Ville Gerudo, Village de Hateno, Pics jumeaux, Île d'Eventide |

    Les captures portant le logo ou le nom du jeu ont été écartées. Les positions ont été relevées à la main sur les cartes (noms de lieux quand la carte en a, sinon repères visibles) : elles sont justes à quelques pourcents de la carte.
  - La visionneuse affiche une capture plate en plein écran ; on la déplace en glissant et on zoome comme pour un 360°.

  Les images ne sont **pas** dans le dépôt (il est public) : `python3 tools/fetch_packs.py` les télécharge depuis leurs sources dans `packs/img/` (ignoré par git), les réduit à 4096 px et écrit `packs/img/dispo.js`. Sans ce dossier, le bouton « Vrais jeux » reste grisé. Les crédits et le lien vers la source s'affichent à la révélation.
  Les panoramas Skyrim font 360° en largeur mais ne couvrent pas tout le haut et le bas : la visionneuse le détecte au format de l'image (plus large que 2,6:1) et affiche des bandes sombres au-delà.
- **Ma bibliothèque** : le propriétaire de l'artefact (et ses éditeurs) peuvent ajouter de vraies vues 360° de jeux depuis l'écran « Bibliothèque » :
  1. le titre du jeu (reconnu dans la base de ~320 jeux, ou nouveau jeu avec ses alias et sa série) ;
  2. une capture **équirectangulaire 2:1**. Exemples : le mode photo 360° de certains jeux, des outils comme Ansel/NVIDIA, des captures « photosphère » trouvées en ligne ;
  3. la carte du jeu (une seule par jeu) ;
  4. un appui sur la carte à l'endroit exact.

  Les images sont compressées (4096 px pour la vue, 2400 px pour la carte) puis stockées avec l'artefact (`assets`). Les fiches sont dans sa base (`db` : `scenes/`, `maps/`, `games/`).

Pour d'autres jeux, ajoute tes propres vues via la bibliothèque, ou complète `packs/vrais-jeux.js` (voir plus bas).

## Structure

```
index.html        écrans (accueil, salon, jeu, résultats, fin, bibliothèque)
style.css
js/games.js       base de jeux réels : séries, titres, alias
js/matcher.js     reconnaissance des noms (ok / précision / erreur)
js/demo.js        jeux fictifs, cartes et panoramas générés
js/pano.js        visionneuse 360° en WebGL pur (sans bibliothèque)
js/mapview.js     carte zoomable avec repères
js/app.js         déroulement, points, multijoueur, éditeur
js/avatars.js     avatars des joueurs à composer (tenue, couleur, peau, cheveux, yeux, sourcils, bouche, accessoire, fond ; SVG originaux), tirés au hasard la première fois
js/admin.js       page d'administration (/admin) : signalements, correction ou suppression des vues
admin.html, admin.css
packs/            pack « Vrais jeux » : données (versionnées) et images (packs/img/, téléchargées)
tools/            fetch_packs.py : téléchargement des images du pack
server/           server.js : site + salles multijoueur pour l'auto-hébergement (Docker)
js/room-server.js capacité « room » adossée à server.js (inactive sur claude.ai)
tests/            tests de reconnaissance (node) et de bout en bout (Playwright)
```

## Lancer en local

```bash
python3 -m http.server 8765
# puis http://localhost:8765
```
En local, seul le mode solo avec le pack démo fonctionne : le multijoueur et la bibliothèque ont besoin de l'hébergement des artefacts Claude.

Avec Docker (sur ton serveur) :
```bash
git clone https://github.com/taumoutsh/quel-jeu.git
cd quel-jeu
cp .env.example .env      # puis ajuster le choix des images
docker compose up -d --build
# puis, dans Nginx Proxy Manager : hôte gamespotter, port 8080
```
**Choix des images** : sur le site déployé, il ne se fait pas dans les réglages de la page mais dans `.env` :
- `QJ_IMAGES` : `real` (vrais jeux, par défaut), `demo` (jeux fictifs) ou `mix` (les deux) ;
- `QJ_JEUX` : jeux du pack « Vrais jeux » à garder, séparés par des virgules (vide = tous). Clés : `botw skyrim xcx gtav gtasa gta4 gtavc rdr2 rdr1 er gi aco acor ac4 acu acs fnv cp`.

**Derrière Nginx Proxy Manager (ou un autre proxy en conteneur)** : le site rejoint le réseau Docker du proxy (`QJ_NETWORK` dans `.env`, `npm_default` par défaut) et n'ouvre son port qu'en local (`127.0.0.1:6103`). Dans NPM, l'hôte de destination est `gamespotter`, port `8080`, schéma `http`. Le nom du réseau se trouve avec `docker inspect <conteneur NPM> --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}'`.

Après un changement du `.env`, `docker compose up -d` suffit (pas besoin de `--build`). Sur le site déployé, le choix « Images » des réglages et le bloc « Bibliothèque » de l'accueil n'apparaissent pas.

**Derrière un CDN (Cloudflare…)** : la page, les scripts et les styles sont envoyés en `Cache-Control: no-store` (jamais gardés, ni par le CDN ni par le navigateur) ; les images sont gardées longtemps, CDN compris, et leur adresse porte une empreinte de contenu (`?v=…`) pour qu'une image refaite soit rechargée. Une mise à jour est donc visible tout de suite, sans purger le cache du CDN.

Au démarrage, `docker compose logs quel-jeu` affiche les images réellement servies, par exemple `Vrais jeux : 18 jeux, 133 vues (botw 47, skyrim 13, …)`.

**Reconstructions rapides** : les images téléchargées sont gardées dans un cache de construction Docker (BuildKit, `id=quel-jeu-images`). Un `docker compose up -d --build` après un `git pull` ne télécharge que les vues nouvelles ou dont la source a changé ; le reste de l'image vient du cache habituel de Docker. Seule la toute première construction télécharge tout (quelques minutes). `docker builder prune` vide ce cache.

**Si un site refuse ton serveur** (bilan de construction avec `ÉCHEC … HTTP Error 403`) : le téléchargement passe par `curl`, que certains CDN acceptent quand ils refusent le client HTTP de Python. Pour voir ce qui passe depuis ta machine :
```bash
python3 tools/diag_acces.py     # code HTTP par site, avec Python, curl et wget
```
Si même `curl` reçoit 403, c'est l'adresse IP du serveur qui est bloquée (cas des wikis Fandom avec certains hébergeurs). Les images déjà téléchargées sont alors disponibles dans le dépôt **privé** `Taumoutsh/quel-jeu-images`, à cloner à la place de `packs/img/` ; la construction les reprend :
```bash
cd ~/quel-jeu
git clone https://github.com/Taumoutsh/quel-jeu-images.git packs/img
docker compose up -d --build
# mises à jour : git pull && git -C packs/img pull && docker compose up -d --build
```
Autre possibilité : télécharger les images depuis ton ordinateur et les copier sur le serveur.
```bash
# sur ton ordinateur (Python 3)
git clone https://github.com/taumoutsh/quel-jeu.git && cd quel-jeu
pip install pillow numpy
python3 tools/fetch_packs.py
scp -r packs/img <utilisateur>@<serveur>:~/quel-jeu/packs/

# sur le serveur
cd ~/quel-jeu && git pull && docker compose up -d --build
```
Les deux copies doivent être à jour (`git pull`) : une image n'est reprise que si sa source correspond à celle du pack.
Mise à jour plus tard :
```bash
cd quel-jeu
git pull
docker compose up -d --build
```
L'image télécharge elle-même les images du pack « Vrais jeux » à la construction (quelques minutes). Elle tourne avec `server/server.js` (Node, sans dépendance), qui sert le site **et les parties à plusieurs** : les salles passent par `/api/rooms` (flux SSE) au lieu de la capacité « room » de claude.ai. La page le détecte toute seule (balise `<meta name="qj-server">` ajoutée par le serveur). Seule la bibliothèque d'images (ajout de vues depuis la page) reste propre aux artefacts Claude.

Sans Docker : `node server/server.js` (port 8080, `PORT=…` pour en changer), après `python3 tools/fetch_packs.py`.

Tests :
```bash
node tests/matcher.test.js
python3 tests/e2e.py /tmp/captures        # partie solo complète (Chrome headless)
python3 tests/e2e_multi.py /tmp/captures  # partie à deux avec une salle simulée
node tests/e2e_real.js /tmp/captures       # partie avec le pack Vrais jeux (après fetch_packs.py)
node tests/e2e_server.js /tmp/captures     # partie à deux contre server/server.js (deux navigateurs)
```

## Ajouter des jeux à la base

Dans `js/games.js`, ajoute une série `{ s: "Nom de série", a: ["alias"], g: [["Titre officiel", "alias 1", "alias 2"]] }` ou un jeu isolé dans le bloc `s: null`. Puis relance `node tests/matcher.test.js`.

## Ajouter des vues au pack « Vrais jeux »

Dans `packs/vrais-jeux.js` :
- un jeu : `{"key": "...", "t": "Titre exact de js/games.js", "map": {"url": "...", "credit": "..."}, "credit": "...", "source": "..."}` ;
- une vue : `{"id": "cle-unique", "game": "key du jeu", "place": "Nom du lieu", "x": 0.42, "y": 0.31, "url": "..."}`, avec `x`, `y` entre 0 et 1 depuis le coin haut gauche de la carte.

Ajoute `"flat": true` pour une capture plate (et éventuellement `"source"`, lien vers la page d'origine). Une vue peut aussi pointer vers un panorama Pannellum en tuiles (`"multires": "<dossier contenant config.json>"`) et une carte vers des tuiles Leaflet (`"tiles": ".../{z}/tile_{x}_{y}.png", "z": 3`). `"crop": [x0, y0, x1, y1]` recadre une carte.

Puis relance `python3 tools/fetch_packs.py`. Sources essayées sans succès : le site Elden Ring Street View du même auteur a disparu ; on ne trouve pas de panoramas 360° prêts à l'emploi pour GTA V, Red Dead Redemption 2 ou Cyberpunk 2077, sans position connue (il faut les faire soi-même : mod « panorama » de GTA V, Ansel de NVIDIA pour The Witcher 3…). Flickr a des panoramas de Final Fantasy XIV, GTA V, PUBG, Guild Wars 2 ou The Witcher 3, mais presque tous limités à 1024 px en public, trop flous pour une vue 360°. Kuula (4096 px) n'est pas indexé par les moteurs de recherche ; AzerothGPS StreetView (World of Warcraft) est sur CurseForge, inaccessible aux scripts ; l'archive d'Elden Ring Street View est sur la Wayback Machine.
