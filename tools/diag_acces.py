#!/usr/bin/env python3
"""Diagnostic : les sites d'où viennent les images répondent-ils depuis cette machine ?

    python3 tools/diag_acces.py

Pour chaque site du pack « Vrais jeux », teste une image avec Python (urllib), curl et wget
(s'ils sont installés) et affiche le code HTTP obtenu. Aucune dépendance (pas besoin de Pillow).
"""
import json
import os
import shutil
import subprocess
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = "quel-jeu-fetch/1.1 (jeu prive entre amis)"


def load_pack():
    s = open(os.path.join(ROOT, "packs", "vrais-jeux.js"), encoding="utf-8").read()
    return json.loads(s.split("/*JSON*/", 1)[1].split("/*FIN*/", 1)[0])


def sample_urls():
    pack, out = load_pack(), {}
    items = [g["map"] for g in pack["games"]] + pack["scenes"]
    for it in items:
        u = it.get("url") or (it.get("multires") and it["multires"] + "/config.json") or (it.get("tiles") and it["tiles"].format(z=0, x=0, y=0))
        if u:
            out.setdefault(urllib.parse.urlparse(u).hostname, u)
    return out


def with_python(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=30) as r:
            r.read(1)
            return str(r.status)
    except urllib.error.HTTPError as e:
        return str(e.code)
    except Exception as e:  # noqa: BLE001
        return "erreur (" + type(e).__name__ + ")"


def with_cmd(cmd):
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=40)
        return (p.stdout.strip() or "erreur").splitlines()[-1]
    except Exception as e:  # noqa: BLE001
        return "erreur (" + type(e).__name__ + ")"


def main():
    has_curl, has_wget = shutil.which("curl"), shutil.which("wget")
    print("%-32s %-10s %-10s %-10s" % ("site", "python", "curl" if has_curl else "(curl absent)", "wget" if has_wget else "(wget absent)"))
    for host, url in sample_urls().items():
        py = with_python(url)
        cu = with_cmd(["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "-A", UA, "--max-time", "30", url]) if has_curl else "-"
        wg = "-"
        if has_wget:
            r = subprocess.run(["wget", "-q", "-S", "-O", "/dev/null", "-U", UA, "--timeout=30", "--tries=1", url], capture_output=True, text=True)
            codes = [ln.split()[1] for ln in r.stderr.splitlines() if ln.strip().startswith("HTTP/")]
            wg = codes[-1] if codes else "erreur"
        print("%-32s %-10s %-10s %-10s" % (host, py, cu, wg))
    print("\n200 = accès OK · 403 = refusé · 429 = trop de requêtes")


if __name__ == "__main__":
    main()
