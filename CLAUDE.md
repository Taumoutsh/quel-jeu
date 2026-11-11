# Contexte pour Claude Code

Projet : « Quel Jeu ? », clone en français du concept GameGuessr (devine le jeu à partir d'une vue 360°, puis place l'endroit sur la carte du jeu). Voir README.md pour les règles et la structure.

## État actuel
- Jeu complet en HTML/JS statique, sans build ni dépendance : solo, multijoueur par code (capacité `room` des artefacts Claude), bibliothèque d'images (capacités `db` + `assets`), pack démo procédural (6 jeux fictifs, 48 vues).
- Pack « Vrais jeux » : 133 vues de 18 jeux trouvées en ligne, avec positions (`packs/vrais-jeux.js`) : 360° pour Zelda BotW, Skyrim, Xenoblade X ; captures plates (`"flat": true`, wikis Fandom) pour 15 autres (GTA V/SA/IV/Vice City, RDR 1/2, Elden Ring, Genshin, AC Odyssey/Origins/Black Flag/Unity/Syndicate, Fallout NV, Cyberpunk). Tirage équilibré par jeu (`buildSeq`). Le propriétaire a validé leur usage pour ce jeu privé entre amis. Les images restent hors du dépôt public : `python3 tools/fetch_packs.py` les télécharge dans `packs/img/` (ignoré par git). Pour l'artefact, publier `packs/` comme fichiers.
- Reconnaissance des noms avec demande de précision : `js/matcher.js`, testée par `node tests/matcher.test.js` (43 cas).
- Tests navigateur : `python3 -m http.server 8765` puis `python3 tests/e2e.py /tmp/x` (solo) `python3 tests/e2e_multi.py /tmp/x` (2 joueurs, salle simulée par `tests/mock-room.js`) et `node tests/e2e_real.js /tmp/x` (pack Vrais jeux).
- Publié en artefact claude.ai (slug 519da436-4dfc-4802-87c9-66a555f0524e), **sans capacités déclarées** : le propriétaire a refusé l'activation pour l'instant. Seuls le mode solo, le pack démo et le pack « Vrais jeux » y fonctionnent (version 2 : publiée avec `packs/` et `packs/img/` comme fichiers). Capacités prévues : `{"room": {}, "db": {"rules": [{"path": "", "read": "view", "write": "admin"}]}, "assets": {}, "user": {}}`.

- Docker : `docker compose up -d --build` (nginx, les images sont téléchargées à la construction), port 6103, mode solo.

## Pistes envisagées (pas encore faites)
- Pack « jeux libres » (SuperTuxKart, 0 A.D., Veloren…) à partir d'images sous licence libre (le mode « capture plate » existe maintenant).
- Jeux essayés sans succès pour l'instant : The Witcher 3 (wiki : surtout des concept arts), Fallout 4 et Horizon (cartes sans noms), Ghost of Tsushima (positions incertaines), AC Valhalla, Hogwarts Legacy, Zelda TotK, Fallout 3 (carte satellite sans noms), Mafia II (noms incrustés sur les captures), Watch Dogs 2 et Sleeping Dogs (pas de carte sur le wiki), Oblivion et Morrowind (trop peu de captures).
- Bibliothèque locale (IndexedDB) pour jouer en solo avec ses propres images sans capacités.
- D'autres jeux pour le pack « Vrais jeux » (voir README, section « Ajouter des vues »).

## Conventions
- Interface et commentaires en français.
- Pas de dépendance externe : la vue 360° est en WebGL pur (`js/pano.js`).
