# Quel Jeu ? auto-hébergé : site + multijoueur (salles servies par server/server.js, sans dépendance).
#   docker compose up -d --build   puis http://localhost:6103
# La bibliothèque d'images (ajout de vues depuis la page) reste propre aux artefacts Claude.

# 1. Téléchargement et réduction des images du pack « Vrais jeux »
FROM python:3.12-slim AS images
# affiche la progression du téléchargement au fil de l'eau
ENV PYTHONUNBUFFERED=1
# curl sert au téléchargement (certains CDN refusent le client HTTP de Python)
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir pillow==11.0.0 numpy==2.1.3
WORKDIR /src
# packs/ contient la liste des vues et, si tu l'y as copié, packs/img/ téléchargé sur un autre ordinateur
# (utile quand un site, comme Fandom, refuse l'accès depuis le serveur) : ces images sont reprises.
COPY packs/ packs/
COPY tools/fetch_packs.py tools/
# Les images sont gardées dans un cache de construction (BuildKit) qui survit aux reconstructions :
# seules les vues nouvelles ou modifiées sont téléchargées, même quand le pack change.
RUN --mount=type=cache,id=quel-jeu-images,target=/cache \
    QJ_OUT=/cache QJ_SEED=/src/packs/img python3 tools/fetch_packs.py \
    && rm -rf packs/img && mkdir -p packs/img && cp /cache/*.jpg /cache/dispo.js packs/img/

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
