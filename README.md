# Quel Jeu ?

Un jeu de devinettes en français, inspiré de GameGuessr : une **vue** prise dans un jeu vidéo s'affiche (panorama à 360° ou capture d'écran).
1. Trouve **le nom du jeu**.
2. Une fois le jeu trouvé, sa **carte** s'ouvre : place ton repère à l'endroit où la vue a été prise.

Seul ou à plusieurs avec un **code de partie**.

## Règles

| Étape | Points |
|---|---|
| Nom du jeu trouvé | 1 000, −200 par erreur (minimum 200) |
| Position sur la carte | jusqu'à 1 000 : plein score à moins de 0,8 % de la diagonale de la carte, puis décroissance exponentielle (≈ 630 à 5 %, ≈ 365 à 10 %, ≈ 120 à 20 %) |
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

- L'hôte clique sur « Créer une partie à plusieurs » et obtient un code à 5 caractères.
- Les amis ouvrent la même page, tapent le code et « Rejoindre ».
- L'hôte règle la partie et la lance. Tout le monde joue la même vue en même temps. La manche se termine quand tout le monde a fini ou quand le temps est écoulé. L'hôte peut aussi la terminer à la main.
- Si l'hôte part, un autre joueur peut reprendre le rôle.

Le multijoueur utilise la capacité « room » des artefacts Claude, ou les salles du serveur Docker (`server/server.js`) quand le site est auto-hébergé : chaque joueur publie son état (sa présence) dans une salle nommée `qj-<code>`. L'hôte publie l'état de la partie, les autres le suivent. Rien n'est stocké durablement côté serveur.
Pour jouer ensemble, tes amis doivent pouvoir ouvrir la même page : l'artefact (partagé depuis claude.ai) ou ton site Docker.

## Images

- **Pack démo** : 6 jeux fictifs (« Chroniques d'Astral II », « Chroniques d'Astral : Origines », « Ferro Nexus III », « Lune Pâle », « Le Récif Perdu », « Néon Velours ») et 48 vues. Tout est dessiné par le code (`js/demo.js`). Le décor dépend de la région de la carte, donc la vue donne des indices sur l'endroit.
- **Vrais jeux** : 133 vues de 18 vrais jeux, trouvées en ligne, avec leur position sur la carte (`packs/vrais-jeux.js`). Chaque jeu a la même chance d'être tiré, quel que soit son nombre de vues.
  - **Panoramas 360°** :
    - *The Legend of Zelda: Breath of the Wild* : 47 vues sur 29 lieux, tirées du projet de fan [Zelda BotW Street View](https://nassimsoftware.github.io/zeldabotwstreetview/) (Nassim's Software), qui fournit aussi la carte et la position de chaque vue.
    - *The Elder Scrolls V: Skyrim* : 13 vues (Solitude, Markarth, Riften, Windhelm, Collège de Fortdhiver…) tirées de [Skyrim Panoramas](https://www.snakebytestudios.com/articles/gaming/skyrim-panoramas/) (Snakebyte Studios), placées sur la carte papier du jeu.
    - *Xenoblade Chronicles X* : 3 vues du wiki [FrontierNav](https://frontiernav.net/wiki/xenoblade-chronicles-x/visualisations/panoramas) (CC BY-SA 4.0), avec la carte de Mira et la position exacte de chaque vue (cubes en tuiles convertis en équirectangulaire).
  - **Captures plates** (wikis Fandom : une capture par lieu connu, placée sur la carte du jeu du même wiki) :
    | Jeu | Vues |
    |---|---|
    | Grand Theft Auto V | Del Perro Pier, Vespucci Beach, aéroport, Maze Bank Arena, hippodrome de Vinewood (carte de Los Santos) |
    | Grand Theft Auto: San Andreas | The Strip, Gant Bridge, Mount Chiliad, Zone 69, Santa Maria Beach |
    | Red Dead Redemption 2 | Valentine, Strawberry, Rhodes, Tumbleweed, Van Horn |
    | Red Dead Redemption | Armadillo, Blackwater, MacFarlane's Ranch, Tumbleweed, Chuparosa |
    | Elden Ring | Église d'Elleh, Leyndell, château de Redmane, manoir du Volcan, manoir de Caria |
    | Genshin Impact | Port de Liyue, Inazuma, Sumeru, repaire de Stormterror, Dosdragon |
    | Assassin's Creed Odyssey | Athènes, Olympie, Cnossos, Mykonos, Argos |
    | Assassin's Creed Origins | Memphis, Gizeh, Siwa, Cyrène, Fayoum |
    | Assassin's Creed IV: Black Flag | La Havane, Kingston, Nassau, Great Inagua |
    | Fallout: New Vegas | Le Strip, Goodsprings, barrage Hoover, Primm |
    | Cyberpunk 2077 | Marché de Kabuki, Wellsprings, Grand Imperial Mall (position au quartier près) |
    | Grand Theft Auto IV | Middle Park, Star Junction, Statue of Happiness, Broker Bridge, Hove Beach |
    | Grand Theft Auto: Vice City | Vice Point, Little Havana, Starfish Island, aéroport Escobar, Prawn Island |
    | Assassin's Creed Unity | La Bastille, Hôtel de Ville, Palais-Royal, Panthéon, palais du Luxembourg (plan de Paris de 1789) |
    | Assassin's Creed Syndicate | Palais de Westminster, Buckingham Palace, cathédrale Saint-Paul, Tour de Londres |

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
# puis http://<serveur>:6103
```
**Choix des images** : sur le site déployé, il ne se fait pas dans les réglages de la page mais dans `.env` :
- `QJ_IMAGES` : `real` (vrais jeux, par défaut), `demo` (jeux fictifs) ou `mix` (les deux) ;
- `QJ_JEUX` : jeux du pack « Vrais jeux » à garder, séparés par des virgules (vide = tous). Clés : `botw skyrim xcx gtav gtasa gta4 gtavc rdr2 rdr1 er gi aco acor ac4 acu acs fnv cp`.

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
