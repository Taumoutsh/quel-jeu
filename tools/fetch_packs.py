#!/usr/bin/env python3
"""Télécharge les images du pack « Vrais jeux » (packs/vrais-jeux.js) dans packs/img/.

Les images ne sont pas versionnées : ce sont des captures de jeux commerciaux, hébergées par
leurs auteurs. Ce script les récupère depuis leurs sources, les réduit et écrit packs/img/dispo.js
(liste des vues réellement disponibles), que le jeu lit au démarrage.

    python3 tools/fetch_packs.py            # télécharge ce qui manque ou a changé
    python3 tools/fetch_packs.py --force    # retélécharge tout

Téléchargement avec curl s'il est installé (certains CDN refusent le client HTTP de Python),
sinon avec Python. QJ_DOWNLOADER=python|curl pour forcer l'un des deux.

Une image déjà présente est réutilisée tant que sa source (url, crop…) n'a pas changé
(empreintes dans sources.json). Les images qui ne sont plus dans le pack sont supprimées.
QJ_OUT=dossier change le dossier de sortie (cache de construction Docker).
QJ_SEED=dossier : images déjà téléchargées ailleurs (ex. packs/img copié depuis un autre ordinateur),
reprises telles quelles quand leur source correspond, au lieu d'être téléchargées. Utile quand un site
(Fandom) refuse l'accès depuis le serveur.

Nécessite Pillow et NumPy (pip install pillow numpy).
"""
import io
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACK = os.path.join(ROOT, "packs", "vrais-jeux.js")
OUT = os.environ.get("QJ_OUT") or os.path.join(ROOT, "packs", "img")
SEED = os.environ.get("QJ_SEED") or ""
PANO_W, MAP_W = 4096, 2400  # mêmes limites que la bibliothèque


def load_pack():
    s = open(PACK, encoding="utf-8").read()
    return json.loads(s.split("/*JSON*/", 1)[1].split("/*FIN*/", 1)[0])


UA = "quel-jeu-fetch/1.1 (jeu prive entre amis)"
PAUSE = 0.15         # secondes minimum entre deux requêtes vers un même site
RETRIES = 5          # nouvelles tentatives sur 429, 5xx et erreurs réseau
_last = {}
DOWNLOADER = os.environ.get("QJ_DOWNLOADER") or ("curl" if shutil.which("curl") else "python")


class HTTPFail(Exception):
    def __init__(self, code, retry_after=None):
        super().__init__("HTTP Error %d" % code)
        self.code, self.retry_after = code, retry_after


def _get_python(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "image/avif,image/webp,image/png,image/jpeg,*/*"})
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        ra = e.headers.get("Retry-After") if e.headers else None
        raise HTTPFail(e.code, ra) from None


def _get_curl(url):
    with tempfile.NamedTemporaryFile(delete=False) as body, tempfile.NamedTemporaryFile(delete=False) as head:
        pass
    try:
        p = subprocess.run(["curl", "-sS", "-L", "--max-time", "120", "-A", UA, "-H", "Accept: image/avif,image/webp,image/png,image/jpeg,*/*",
                            "-D", head.name, "-o", body.name, "-w", "%{http_code}", url], capture_output=True, text=True)
        if p.returncode != 0:
            raise ConnectionError("curl : " + (p.stderr.strip() or "code %d" % p.returncode))
        code = int(p.stdout.strip() or 0)
        if code != 200:
            ra = None
            for ln in open(head.name, encoding="latin-1"):
                if ln.lower().startswith("retry-after:"):
                    ra = ln.split(":", 1)[1].strip()
            raise HTTPFail(code, ra)
        with open(body.name, "rb") as f:
            return f.read()
    finally:
        for f in (body.name, head.name):
            try:
                os.remove(f)
            except OSError:
                pass


def fetch(url):
    host = urllib.parse.urlparse(url).hostname
    for attempt in range(RETRIES + 1):
        wait = PAUSE - (time.time() - _last.get(host, 0))
        if wait > 0:
            time.sleep(wait)
        _last[host] = time.time()
        try:
            return _get_curl(url) if DOWNLOADER == "curl" else _get_python(url)
        except HTTPFail as e:
            if e.code not in (408, 415, 425, 429, 500, 502, 503, 504) or attempt == RETRIES:
                raise
            delay = 2 ** (attempt + 1)
            ra = e.retry_after
            if ra and ra.isdigit():
                delay = max(delay, min(int(ra), 120))
            print("  %s : HTTP %d, nouvel essai dans %d s" % (host, e.code, delay))
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            if attempt == RETRIES:
                raise
            delay = 2 ** (attempt + 1)
            print("  %s : %s, nouvel essai dans %d s" % (host, getattr(e, "reason", e), delay))
        time.sleep(delay)


def load_image(url):
    im = Image.open(io.BytesIO(fetch(url)))
    if im.mode == "P":  # PNG à palette avec transparence (tuiles de carte) : passage par RGBA
        im = im.convert("RGBA")
    return im.convert("RGB")


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


SOURCE_KEYS = ("url", "multires", "tiles", "z", "crop")


def signature(src):
    """Empreinte de la source d'une image : si elle change, l'image est retéléchargée."""
    return json.dumps({k: src[k] for k in SOURCE_KEYS if k in src}, sort_keys=True)


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
    print("Téléchargement avec " + DOWNLOADER)
    dispo = {"maps": {}, "scenes": {}}
    man_path = os.path.join(OUT, "sources.json")
    try:
        old = json.load(open(man_path, encoding="utf-8"))
    except (OSError, ValueError):
        old = {}
    new = {}
    seed_man = {}
    if SEED and os.path.isdir(SEED) and os.path.abspath(SEED) != os.path.abspath(OUT):
        try:
            seed_man = json.load(open(os.path.join(SEED, "sources.json"), encoding="utf-8"))
            print("Images fournies dans %s : %d" % (SEED, len(seed_man)))
        except (OSError, ValueError):
            print("Dossier %s sans sources.json : ignoré" % SEED)
    seeded = [0]

    def get(name, src, max_w):
        sig = signature(src)
        path = os.path.join(OUT, name)
        stale = force or old.get(name) != sig or not os.path.exists(path)
        if stale and not force and seed_man.get(name) == sig and os.path.exists(os.path.join(SEED, name)):
            shutil.copyfile(os.path.join(SEED, name), path)  # reprise d'une image fournie
            seeded[0] += 1
            stale = False
        size = save(src, path, max_w, stale)
        new[name] = sig  # seulement après réussite
        return size

    failed = []

    def fail(what, src, e):
        u = src.get("url") or src.get("multires") or src.get("tiles") or ""
        failed.append((urllib.parse.urlparse(u).hostname or "?", what, str(e)))
        print("ÉCHEC", what, e)

    for g in pack["games"]:
        try:
            w, h = get("map-" + g["key"] + ".jpg", g["map"], MAP_W)
            dispo["maps"][g["key"]] = [w, h]
            print("carte", g["key"], w, h)
        except Exception as e:  # noqa: BLE001
            fail("carte " + g["key"] + " (jeu ignoré)", g["map"], e)
    for i, sc in enumerate(pack["scenes"]):
        if sc["game"] not in dispo["maps"]:
            continue
        try:
            w, h = get(sc["id"] + ".jpg", sc, PANO_W)
            dispo["scenes"][sc["id"]] = [w, h]
            print("%d/%d" % (i + 1, len(pack["scenes"])), sc["id"], w, h)
        except Exception as e:  # noqa: BLE001
            fail(sc["id"], sc, e)
    # les images qui ne sont plus dans le pack sont supprimées
    gone = [f for f in os.listdir(OUT) if f.endswith(".jpg") and f not in new]
    for f in gone:
        os.remove(os.path.join(OUT, f))
    with open(man_path, "w", encoding="utf-8") as f:
        json.dump(new, f, indent=0)
    with open(os.path.join(OUT, "dispo.js"), "w", encoding="utf-8") as f:
        f.write("/* Généré par tools/fetch_packs.py : images disponibles [largeur, hauteur]. */\n")
        f.write("window.REAL_PACK_DISPO = " + json.dumps(dispo) + ";\n")
    if failed:
        print("\n=== %d téléchargement(s) en échec ===" % len(failed))
        by_host = {}
        for host, what, err in failed:
            by_host.setdefault(host, []).append((what, err))
        for host, items in by_host.items():
            print("%s : %d échec(s), ex. %s → %s" % (host, len(items), items[0][0], items[0][1]))
        skipped = [g["key"] for g in pack["games"] if g["key"] not in dispo["maps"]]
        if skipped:
            print("Jeux absents faute de carte : " + ", ".join(skipped))
        print("Relancer la construction réessaiera seulement ce qui manque.\n")
    reused = sum(1 for k, v in new.items() if old.get(k) == v)
    print("%d vues, %d cartes disponibles (%d images réutilisées, %d reprises des images fournies, %d supprimées)" % (
        len(dispo["scenes"]), len(dispo["maps"]), reused if not force else 0, seeded[0], len(gone)))


if __name__ == "__main__":
    main()
