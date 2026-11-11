# Quel Jeu ? en site statique (mode solo : pack démo + pack « Vrais jeux »).
#   docker compose up -d --build   puis http://localhost:6103
# Le multijoueur et la bibliothèque ont besoin de l'hébergement des artefacts Claude.

# 1. Téléchargement et réduction des images du pack « Vrais jeux »
FROM python:3.12-slim AS images
# affiche la progression du téléchargement au fil de l'eau
ENV PYTHONUNBUFFERED=1
RUN pip install --no-cache-dir pillow==11.0.0 numpy==2.1.3
WORKDIR /src
COPY packs/vrais-jeux.js packs/
COPY tools/fetch_packs.py tools/
RUN python3 tools/fetch_packs.py

# 2. Serveur web
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html style.css /usr/share/nginx/html/
COPY js /usr/share/nginx/html/js
COPY packs/vrais-jeux.js /usr/share/nginx/html/packs/
COPY --from=images /src/packs/img /usr/share/nginx/html/packs/img
