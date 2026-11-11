# Contexte pour Claude Code

Projet : « Quel Jeu ? », clone en français du concept GameGuessr (devine le jeu à partir d'une vue 360°, puis place l'endroit sur la carte du jeu). Voir README.md pour les règles et la structure.

## État actuel
- Jeu complet en HTML/JS statique, sans build ni dépendance : solo, multijoueur par code (capacité `room` des artefacts Claude), bibliothèque d'images (capacités `db` + `assets`), pack démo procédural (6 jeux fictifs, 48 vues).
- Reconnaissance des noms avec demande de précision : `js/matcher.js`, testée par `node tests/matcher.test.js` (43 cas).
- Tests navigateur : `python3 -m http.server 8765` puis `python3 tests/e2e.py /tmp/x` (solo) et `python3 tests/e2e_multi.py /tmp/x` (2 joueurs, salle simulée par `tests/mock-room.js`).
- Publié en artefact claude.ai (slug 519da436-4dfc-4802-87c9-66a555f0524e), **sans capacités déclarées** : le propriétaire a refusé l'activation pour l'instant. Seul le mode solo + pack démo y fonctionne. Capacités prévues : `{"room": {}, "db": {"rules": [{"path": "", "read": "view", "write": "admin"}]}, "assets": {}, "user": {}}`.

## Pistes envisagées (pas encore faites)
- Pack « jeux libres » (SuperTuxKart, 0 A.D., Veloren…) à partir d'images sous licence libre sur GitHub ; nécessiterait un mode « capture plate » en plus du 360°.
- Bibliothèque locale (IndexedDB) pour jouer en solo avec ses propres images sans capacités.
- Ne pas télécharger ni republier de captures de jeux commerciaux : l'utilisateur ajoute les siennes via l'écran Bibliothèque.

## Conventions
- Interface et commentaires en français.
- Pas de dépendance externe : la vue 360° est en WebGL pur (`js/pano.js`).
