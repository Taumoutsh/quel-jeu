#!/usr/bin/env python3
"""Télécharge les images du pack « Vrais jeux » (packs/vrais-jeux.js) dans packs/img/.

Les images ne sont pas versionnées : ce sont des captures de jeux commerciaux, hébergées par
leurs auteurs. Ce script les récupère depuis leurs sources, les réduit et écrit packs/img/dispo.js
(liste des vues réellement disponibles), que le jeu lit au démarrage.

    python3 tools/fetch_packs.py            # télécharge ce qui manque
    python3 tools/fetch_packs.py --force    # retélécharge tout

Nécessite Pillow (pip install pillow).
"""
import io
import json
import os
import sys
import urllib.request

from PIL import Image

Image.MAX_IMAGE_PIXELS = None
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACK = os.path.join(ROOT, "packs", "vrais-jeux.js")
OUT = os.path.join(ROOT, "packs", "img")
PANO_W, MAP_W = 4096, 2400  # mêmes limites que la bibliothèque


def load_pack():
    s = open(PACK, encoding="utf-8").read()
    return json.loads(s.split("/*JSON*/", 1)[1].split("/*FIN*/", 1)[0])


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "quel-jeu-fetch/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def save(url, path, max_w, force):
    if os.path.exists(path) and not force:
        im = Image.open(path)
        return im.size
    im = Image.open(io.BytesIO(fetch(url))).convert("RGB")
    if im.width < 1000:  # image disparue remplacée par une vignette d'erreur
        raise ValueError("image trop petite (%dx%d)" % im.size)
    if im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    im.save(path, "JPEG", quality=82, optimize=True, progressive=True)
    return im.size


def main():
    force = "--force" in sys.argv
    os.makedirs(OUT, exist_ok=True)
    pack = load_pack()
    dispo = {"maps": {}, "scenes": {}}
    for g in pack["games"]:
        try:
            w, h = save(g["map"]["url"], os.path.join(OUT, "map-" + g["key"] + ".jpg"), MAP_W, force)
            dispo["maps"][g["key"]] = [w, h]
            print("carte", g["key"], w, h)
        except Exception as e:  # noqa: BLE001
            print("ÉCHEC carte", g["key"], e)
    for i, sc in enumerate(pack["scenes"]):
        if sc["game"] not in dispo["maps"]:
            continue
        try:
            w, h = save(sc["url"], os.path.join(OUT, sc["id"] + ".jpg"), PANO_W, force)
            dispo["scenes"][sc["id"]] = [w, h]
            print("%d/%d" % (i + 1, len(pack["scenes"])), sc["id"], w, h)
        except Exception as e:  # noqa: BLE001
            print("ÉCHEC", sc["id"], e)
    with open(os.path.join(OUT, "dispo.js"), "w", encoding="utf-8") as f:
        f.write("/* Généré par tools/fetch_packs.py : images disponibles [largeur, hauteur]. */\n")
        f.write("window.REAL_PACK_DISPO = " + json.dumps(dispo) + ";\n")
    print("%d vues, %d cartes disponibles" % (len(dispo["scenes"]), len(dispo["maps"])))


if __name__ == "__main__":
    main()
