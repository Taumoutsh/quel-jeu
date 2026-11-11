# Quel Jeu ?

Un jeu de devinettes en français, inspiré de GameGuessr : une **vue à 360°** prise dans un jeu vidéo s'affiche.
1. Trouve **le nom du jeu**.
2. Une fois le jeu trouvé, sa **carte** s'ouvre : place ton repère à l'endroit où la vue a été prise.

Seul ou à plusieurs avec un **code de partie**.

## Règles

| Étape | Points |
|---|---|
| Nom du jeu trouvé | 1 000, −200 par erreur (minimum 200) |
| Position sur la carte | jusqu'à 4 000 : plein score à moins de 0,8 % de la diagonale de la carte, puis décroissance exponentielle (≈ 2 500 à 5 %, ≈ 1 450 à 10 %, ≈ 480 à 20 %) |
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

Le multijoueur utilise la capacité « room » des artefacts Claude : chaque joueur publie son état (sa présence) dans une salle nommée `qj-<code>`. L'hôte publie l'état de la partie, les autres le suivent. Rien n'est stocké côté serveur.
Pour jouer ensemble, tes amis doivent pouvoir ouvrir l'artefact : partage-le avec eux depuis claude.ai.

## Images

- **Pack démo** : 6 jeux fictifs (« Chroniques d'Astral II », « Chroniques d'Astral : Origines », « Ferro Nexus III », « Lune Pâle », « Le Récif Perdu », « Néon Velours ») et 48 vues. Tout est dessiné par le code (`js/demo.js`). Le décor dépend de la région de la carte, donc la vue donne des indices sur l'endroit.
- **Vrais jeux** : 63 vues à 360° de vrais jeux, trouvées en ligne, avec leur position sur la carte (`packs/vrais-jeux.js`).
  - *The Legend of Zelda: Breath of the Wild* : 47 vues sur 29 lieux, tirées du projet de fan [Zelda BotW Street View](https://nassimsoftware.github.io/zeldabotwstreetview/) (Nassim's Software), qui fournit aussi la carte et la position de chaque vue.
  - *The Elder Scrolls V: Skyrim* : 13 vues (Solitude, Markarth, Riften, Windhelm, Collège de Fortdhiver…) tirées de [Skyrim Panoramas](https://www.snakebytestudios.com/articles/gaming/skyrim-panoramas/) (Snakebyte Studios). Positions relevées sur la carte papier du jeu et recoupées avec le wiki Elder Scrolls.

  - *Xenoblade Chronicles X* : 3 vues (Talon Rock Summit, Silent Mire, Dopang Caravan) du wiki [FrontierNav](https://frontiernav.net/wiki/xenoblade-chronicles-x/visualisations/panoramas) (CC BY-SA 4.0), avec la carte de Mira et la position exacte de chaque vue. Les panoramas y sont des cubes en tuiles : le script les assemble et les convertit en équirectangulaire.

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
docker compose up -d --build
# puis http://<serveur>:8080
```
L'image télécharge elle-même les images du pack « Vrais jeux » à la construction. Comme en local, seul le mode solo fonctionne hors des artefacts Claude.

Tests :
```bash
node tests/matcher.test.js
python3 tests/e2e.py /tmp/captures        # partie solo complète (Chrome headless)
python3 tests/e2e_multi.py /tmp/captures  # partie à deux avec une salle simulée
node tests/e2e_real.js /tmp/captures       # partie avec le pack Vrais jeux (après fetch_packs.py)
```

## Ajouter des jeux à la base

Dans `js/games.js`, ajoute une série `{ s: "Nom de série", a: ["alias"], g: [["Titre officiel", "alias 1", "alias 2"]] }` ou un jeu isolé dans le bloc `s: null`. Puis relance `node tests/matcher.test.js`.

## Ajouter des vues au pack « Vrais jeux »

Dans `packs/vrais-jeux.js` :
- un jeu : `{"key": "...", "t": "Titre exact de js/games.js", "map": {"url": "...", "credit": "..."}, "credit": "...", "source": "..."}` ;
- une vue : `{"id": "cle-unique", "game": "key du jeu", "place": "Nom du lieu", "x": 0.42, "y": 0.31, "url": "..."}`, avec `x`, `y` entre 0 et 1 depuis le coin haut gauche de la carte.

Une vue peut aussi pointer vers un panorama Pannellum en tuiles (`"multires": "<dossier contenant config.json>"`) et une carte vers des tuiles Leaflet (`"tiles": ".../{z}/tile_{x}_{y}.png", "z": 3, "crop": [x0, y0, x1, y1]`).

Puis relance `python3 tools/fetch_packs.py`. Sources essayées sans succès : le site Elden Ring Street View du même auteur a disparu ; on ne trouve pas de panoramas 360° prêts à l'emploi pour GTA V, Red Dead Redemption 2 ou Cyberpunk 2077, sans position connue (il faut les faire soi-même : mod « panorama » de GTA V, Ansel de NVIDIA pour The Witcher 3…). Flickr a des panoramas de Final Fantasy XIV, GTA V, PUBG, Guild Wars 2 ou The Witcher 3, mais presque tous limités à 1024 px en public, trop flous pour une vue 360°. Kuula (4096 px) n'est pas indexé par les moteurs de recherche ; AzerothGPS StreetView (World of Warcraft) est sur CurseForge, inaccessible aux scripts ; l'archive d'Elden Ring Street View est sur la Wayback Machine.
