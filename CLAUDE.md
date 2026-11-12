# Contexte pour Claude Code

Projet : « GameSpotter » (anciennement « Quel Jeu ? » ; ne pas reprendre le nom « GameGuessr », qui appartient à un autre jeu), clone en français du concept GameGuessr (devine le jeu à partir d'une vue 360°, puis place l'endroit sur la carte du jeu). Voir README.md pour les règles et la structure.

## État actuel
- Jeu complet en HTML/JS statique, sans build ni dépendance : solo, multijoueur par code (capacité `room` des artefacts Claude), bibliothèque d'images (capacités `db` + `assets`), pack démo procédural (6 jeux fictifs, 48 vues).
- Pack « Vrais jeux » : 201 vues de 34 jeux trouvées en ligne, avec positions (`packs/vrais-jeux.js`) : 360° pour Zelda BotW, Skyrim, Xenoblade X ; captures plates (`"flat": true`, wikis Fandom) pour les autres (liste complète dans le README). Recherche par lots en arrière-plan : sorties dans scratchpad/batches/<lot>/entries.json, fusionnées après contrôle visuel des repères et des captures. Tirage équilibré par jeu (`buildSeq`). Le propriétaire a validé leur usage pour ce jeu privé entre amis. Les images restent hors du dépôt public : `python3 tools/fetch_packs.py` les télécharge dans `packs/img/` (ignoré par git). Pour l'artefact, publier `packs/` comme fichiers.
- Reconnaissance des noms avec demande de précision : `js/matcher.js`, testée par `node tests/matcher.test.js` (43 cas).
- Tests navigateur : `python3 -m http.server 8765` puis `python3 tests/e2e.py /tmp/x` (solo) `python3 tests/e2e_multi.py /tmp/x` (2 joueurs, salle simulée par `tests/mock-room.js`) et `node tests/e2e_real.js /tmp/x` (pack Vrais jeux).
- Publié en artefact claude.ai (slug 519da436-4dfc-4802-87c9-66a555f0524e), **sans capacités déclarées** : le propriétaire a refusé l'activation pour l'instant. Seuls le mode solo, le pack démo et le pack « Vrais jeux » y fonctionnent (version 2 : publiée avec `packs/` et `packs/img/` comme fichiers). Capacités prévues : `{"room": {}, "db": {"rules": [{"path": "", "read": "view", "write": "admin"}]}, "assets": {}, "user": {}}`.

- Docker : `docker compose up -d --build`, conteneur `gamespotter` sur le réseau du proxy (`QJ_NETWORK`, NPM y pointe `gamespotter:8080`), port 6103 ouvert en local seulement (images téléchargées à la construction, dans un cache BuildKit persistant `RUN --mount=type=cache` : fetch_packs.py réutilise une image tant que sa source n'a pas changé, empreintes dans sources.json, et supprime les vues retirées). Téléchargement via curl (installé dans l'image ; `QJ_DOWNLOADER` pour forcer), Python en secours ; diagnostic par site : `python3 tools/diag_acces.py`. Fandom bloque l'IP du serveur du propriétaire (403 avec python, curl et wget) : les images traitées sont dans le dépôt privé `Taumoutsh/quel-jeu-images`, cloné sur le serveur dans `packs/img/` et repris à la construction. **Après tout ajout de vues : relancer fetch_packs.py ici puis mettre à jour ce dépôt** (copier packs/img/*.jpg, sources.json, dispo.js). Ancienne note : : `packs/img/` copié depuis un autre ordinateur est repris à la construction (`QJ_SEED`, via `COPY packs/`). Servi par `server/server.js` (Node sans dépendance) qui fournit aussi les salles multijoueur (`/api/rooms`, SSE) ; `js/room-server.js` s'active seulement si la page contient `<meta name="qj-server">` (ajoutée par le serveur), donc rien ne change sur claude.ai. Test : `node tests/e2e_server.js /tmp/x`. La bibliothèque (db/assets) reste réservée à claude.ai.
- Pack par défaut : « Vrais jeux » (réglage enregistré basculé une fois via `cfgV`).
- Site auto-hébergé : le choix des images se fait dans `.env` (`QJ_IMAGES` = real|demo|mix, `QJ_JEUX` = filtre de clés), transmis par server.js dans la balise meta ; le bloc « Images » (#packSetting) est alors masqué et `setCfg('pack')` ignoré. Sur claude.ai et en local sans server.js, le choix reste dans la page.

## Pistes envisagées (pas encore faites)
- Pack « jeux libres » (SuperTuxKart, 0 A.D., Veloren…) à partir d'images sous licence libre (le mode « capture plate » existe maintenant).
- Jeux essayés sans succès pour l'instant : The Witcher 3 (wiki : surtout des concept arts), Fallout 4 et Horizon (cartes sans noms), Ghost of Tsushima (positions incertaines), AC Valhalla, Hogwarts Legacy, Zelda TotK, Fallout 3 (carte satellite sans noms), Mafia II (noms incrustés sur les captures), Watch Dogs 2 et Sleeping Dogs (pas de carte sur le wiki), Oblivion et Morrowind (trop peu de captures).
- Bibliothèque locale (IndexedDB) pour jouer en solo avec ses propres images sans capacités.
- D'autres jeux pour le pack « Vrais jeux » (voir README, section « Ajouter des vues »).

## Conventions
- Interface et commentaires en français.
- Pas de dépendance externe : la vue 360° est en WebGL pur (`js/pano.js`).
