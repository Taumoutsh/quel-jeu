# GameSpotter auto-hébergé : site + multijoueur (salles servies par server/server.js, sans dépendance).
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
COPY tools/fetch_packs.py tools/
COPY packs/vrais-jeux.js packs/
# Les images sont gardées dans un cache de construction (BuildKit) qui survit aux reconstructions :
# seules les vues nouvelles ou modifiées sont téléchargées, même quand le pack change.
# packs/img/ (dépôt d'images cloné sur le serveur, utile quand un site comme Fandom refuse l'accès depuis
# le serveur) est monté en lecture seule, sans être copié dans une couche : ses images sont reprises.
RUN --mount=type=cache,id=quel-jeu-images,target=/cache \
    --mount=type=bind,source=packs,target=/seed \
    QJ_OUT=/cache QJ_SEED=/seed/img python3 tools/fetch_packs.py \
    && mkdir -p packs/img && cp /cache/*.jpg /cache/dispo.js packs/img/

# 2. Serveur Node (fichiers statiques + salles multijoueur)
FROM node:22-alpine
WORKDIR /app
# Les images (~750 Mo) d'abord : cette couche est réutilisée tant qu'elles ne changent pas. Copiées après le
# code, elles étaient recopiées à chaque déploiement et l'ancienne copie restait dans le cache de Docker
# (le disque grossissait de ~750 Mo par mise à jour du site ; récupérable par « docker builder prune -f »).
COPY --from=images /src/packs/img packs/img
# signalements des joueurs et corrections de l'administrateur (volume Docker, voir docker-compose.yml)
RUN mkdir -p /app/data && chown node:node /app/data
COPY index.html admin.html style.css admin.css favicon.svg favicon.ico apple-touch-icon.png ./
COPY js js
COPY server server
COPY packs/vrais-jeux.js packs/
ENV PORT=8080 QJ_DATA=/app/data
EXPOSE 8080
USER node
CMD ["node", "server/server.js"]
