# Quel Jeu ? auto-hébergé : site + multijoueur (salles servies par server/server.js, sans dépendance).
#   docker compose up -d --build   puis http://localhost:6103
# La bibliothèque d'images (ajout de vues depuis la page) reste propre aux artefacts Claude.

# 1. Téléchargement et réduction des images du pack « Vrais jeux »
FROM python:3.12-slim AS images
# affiche la progression du téléchargement au fil de l'eau
ENV PYTHONUNBUFFERED=1
RUN pip install --no-cache-dir pillow==11.0.0 numpy==2.1.3
WORKDIR /src
COPY packs/vrais-jeux.js packs/
COPY tools/fetch_packs.py tools/
RUN python3 tools/fetch_packs.py

# 2. Serveur Node (fichiers statiques + salles multijoueur)
FROM node:22-alpine
WORKDIR /app
COPY index.html style.css ./
COPY js js
COPY server server
COPY packs/vrais-jeux.js packs/
COPY --from=images /src/packs/img packs/img
ENV PORT=8080
EXPOSE 8080
USER node
CMD ["node", "server/server.js"]
