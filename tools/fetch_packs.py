#!/usr/bin/env python3
"""Télécharge les images du pack « Vrais jeux » (packs/vrais-jeux.js) dans packs/img/.

Les images ne sont pas versionnées : ce sont des captures de jeux commerciaux, hébergées par
leurs auteurs. Ce script les récupère depuis leurs sources, les réduit et écrit packs/img/dispo.js
(liste des vues réellement disponibles), que le jeu lit au démarrage.

    python3 tools/fetch_packs.py            # télécharge ce qui manque
    python3 tools/fetch_packs.py --force    # retélécharge tout

Nécessite Pillow et NumPy (pip install pillow numpy).
"""
import io
import json
import math
import os
import sys
import urllib.request

import numpy as np
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


def load_image(url):
    return Image.open(io.BytesIO(fetch(url))).convert("RGB")


def multires_to_equirect(base, out_w=PANO_W):
    """Panorama Pannellum « multires » (6 faces de cube en tuiles) → image équirectangulaire."""
    m = json.loads(fetch(base + "/config.json"))["multiRes"]
    lvl, tile, cube = m["maxLevel"], m["tileResolution"], m["cubeResolution"]
    n = math.ceil(cube / tile)
    faces = {}
    for f in "frblud":
        img = Image.new("RGB", (cube, cube))
        for y in range(n):
            for x in range(n):
                p = m["path"].replace("%l", str(lvl)).replace("%s", f).replace("%y", str(y)).replace("%x", str(x))
                img.paste(load_image(base + p + "." + m["extension"]), (x * tile, y * tile))
        faces[f] = np.asarray(img)
    w, h = out_w, out_w // 2
    lon, lat = np.meshgrid((np.arange(w) + 0.5) / w * 2 * np.pi - np.pi, np.pi / 2 - (np.arange(h) + 0.5) / h * np.pi)
    d = np.stack([np.cos(lat) * np.sin(lon), np.sin(lat), np.cos(lat) * np.cos(lon)], -1)  # x droite, y haut, z avant
    # face : (direction de visée, droite de l'image, bas de l'image)
    axes = {"f": ((0, 0, 1), (1, 0, 0), (0, -1, 0)), "r": ((1, 0, 0), (0, 0, -1), (0, -1, 0)),
            "b": ((0, 0, -1), (-1, 0, 0), (0, -1, 0)), "l": ((-1, 0, 0), (0, 0, 1), (0, -1, 0)),
            "u": ((0, 1, 0), (1, 0, 0), (0, 0, 1)), "d": ((0, -1, 0), (1, 0, 0), (0, 0, -1))}
    keys = list(axes)
    which = np.argmax(np.stack([d @ np.array(axes[k][0], float) for k in keys], -1), -1)
    out = np.zeros((h, w, 3), np.uint8)
    for i, k in enumerate(keys):
        fw, rt, dn = (np.array(a, float) for a in axes[k])
        sel = which == i
        v = d[sel]
        fwd = v @ fw
        px = np.clip((((v @ rt) / fwd + 1) / 2 * cube).astype(int), 0, cube - 1)
        py = np.clip((((v @ dn) / fwd + 1) / 2 * cube).astype(int), 0, cube - 1)
        out[sel] = faces[k][py, px]
    return Image.fromarray(out)


def tiles_to_map(spec):
    """Carte Leaflet en tuiles {z}/{x}/{y} : assemblage au zoom z, puis recadrage (crop normalisé)."""
    z = spec["z"]
    n = 1 << z
    first = load_image(spec["tiles"].format(z=z, x=0, y=0))
    t = first.width
    im = Image.new("RGB", (n * t, n * t))
    for x in range(n):
        for y in range(n):
            im.paste(first if x == y == 0 else load_image(spec["tiles"].format(z=z, x=x, y=y)), (x * t, y * t))
    return im


def save(src, path, max_w, force):
    if os.path.exists(path) and not force:
        im = Image.open(path)
        return im.size
    if "multires" in src:
        im = multires_to_equirect(src["multires"])
    elif "tiles" in src:
        im = tiles_to_map(src)
    else:
        im = load_image(src["url"])
    if im.width < 1000:  # image disparue remplacée par une vignette d'erreur
        raise ValueError("image trop petite (%dx%d)" % im.size)
    if "crop" in src:  # recadrage normalisé [x0, y0, x1, y1]
        c = src["crop"]
        im = im.crop((round(c[0] * im.width), round(c[1] * im.height), round(c[2] * im.width), round(c[3] * im.height)))
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
            w, h = save(g["map"], os.path.join(OUT, "map-" + g["key"] + ".jpg"), MAP_W, force)
            dispo["maps"][g["key"]] = [w, h]
            print("carte", g["key"], w, h)
        except Exception as e:  # noqa: BLE001
            print("ÉCHEC carte", g["key"], e)
    for i, sc in enumerate(pack["scenes"]):
        if sc["game"] not in dispo["maps"]:
            continue
        try:
            w, h = save(sc, os.path.join(OUT, sc["id"] + ".jpg"), PANO_W, force)
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
