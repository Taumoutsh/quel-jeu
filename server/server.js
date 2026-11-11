// Serveur de « Quel Jeu ? » pour l'auto-hébergement (Docker) : fichiers statiques + salles multijoueur.
// Aucune dépendance : Node.js seul. Les salles remplacent la capacité « room » des artefacts Claude :
// chaque joueur publie sa présence (un objet JSON) et reçoit celles des autres en flux SSE.
//
//   node server/server.js            (port 8080, dossier servi = racine du dépôt)
//   PORT=3000 ROOT=/srv/site node server/server.js
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = +process.env.PORT || 8080;
const ROOT = path.resolve(process.env.ROOT || path.join(__dirname, ".."));
const MAX_BODY = 512 * 1024;        // présence maximale (l'hôte y met l'état de la partie)
const MAX_PEERS = 16, MAX_ROOMS = 500;
const GRACE_MS = 15000;             // délai avant de retirer un joueur dont la connexion a coupé
const ROOM_RE = /^qj-[a-z0-9]{1,12}$/, PEER_RE = /^[a-z0-9]{6,24}$/;

// Choix des images, réglé par le .env (et non depuis le site) :
//   QJ_IMAGES = real (vrais jeux, par défaut) | demo (jeux fictifs) | mix (les deux)
//   QJ_JEUX   = liste facultative de clés de jeux du pack « Vrais jeux » (ex. gtav,rdr2,er) ; vide = tous
const IMAGES = ["real", "demo", "mix"].includes(process.env.QJ_IMAGES) ? process.env.QJ_IMAGES : "real";
const JEUX = (process.env.QJ_JEUX || "").split(",").map((s) => s.trim().toLowerCase()).filter((s) => /^[a-z0-9]{1,16}$/.test(s));
if (process.env.QJ_IMAGES && process.env.QJ_IMAGES !== IMAGES) console.warn("QJ_IMAGES inconnu (« " + process.env.QJ_IMAGES + " ») : real utilisé");

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".md": "text/plain; charset=utf-8" };
const PRIVATE = /^\/(server|tools|tests|\.git)(\/|$)|^\/(Dockerfile|docker-compose\.yml|\.dockerignore|\.gitignore)$/;

// ------------------------------------------------------------------ salles
// rooms : nom → Map(peer → { presence, clients:Set(res), timer })
const rooms = new Map();

function snapshot(room) {
  const out = {};
  for (const [peer, p] of room) out[peer] = p.presence;
  return JSON.stringify({ peers: out });
}
function broadcast(name) {
  const room = rooms.get(name);
  if (!room) return;
  const data = "data: " + snapshot(room) + "\n\n";
  for (const p of room.values()) for (const res of p.clients) res.write(data);
}
function getPeer(name, peer, create) {
  let room = rooms.get(name);
  if (!room) {
    if (!create || rooms.size >= MAX_ROOMS) return null;
    room = new Map(); rooms.set(name, room);
  }
  let p = room.get(peer);
  if (!p) {
    if (!create || room.size >= MAX_PEERS) return null;
    p = { presence: {}, clients: new Set(), timer: null }; room.set(peer, p);
  }
  return p;
}
function removePeer(name, peer) {
  const room = rooms.get(name);
  if (!room || !room.has(peer)) return;
  const p = room.get(peer);
  clearTimeout(p.timer);
  for (const res of p.clients) res.end();
  room.delete(peer);
  if (!room.size) rooms.delete(name); else broadcast(name);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > MAX_BODY) { reject(new Error("trop gros")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
function json(res, code, obj) { res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(obj)); }

async function api(req, res, url) {
  const m = url.pathname.match(/^\/api\/rooms\/([^/]+)\/(events|presence|leave)$/);
  if (url.pathname === "/api/ping") return json(res, 200, { ok: true });
  if (!m) return json(res, 404, { error: "introuvable" });
  const name = m[1], action = m[2], peer = url.searchParams.get("peer") || "";
  if (!ROOM_RE.test(name) || !PEER_RE.test(peer)) return json(res, 400, { error: "salle ou joueur invalide" });

  if (action === "events" && req.method === "GET") {
    const p = getPeer(name, peer, true);
    if (!p) return json(res, 503, { error: "salle pleine" });
    clearTimeout(p.timer); p.timer = null;
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", "Connection": "keep-alive", "X-Accel-Buffering": "no" });
    res.write("retry: 2000\n\n");
    p.clients.add(res);
    res.write("data: " + snapshot(rooms.get(name)) + "\n\n");
    const ping = setInterval(() => res.write(": ping\n\n"), 20000);
    req.on("close", () => {
      clearInterval(ping); p.clients.delete(res);
      if (!p.clients.size && rooms.get(name) && rooms.get(name).get(peer) === p) {
        p.timer = setTimeout(() => removePeer(name, peer), GRACE_MS);
      }
    });
    return;
  }
  if (action === "presence" && req.method === "POST") {
    let body;
    try { body = JSON.parse(await readBody(req)); } catch (e) { return json(res, 400, { error: "JSON invalide" }); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return json(res, 400, { error: "objet attendu" });
    const p = getPeer(name, peer, true);
    if (!p) return json(res, 503, { error: "salle pleine" });
    p.presence = Object.assign({}, p.presence, body);
    broadcast(name);
    return json(res, 200, { ok: true });
  }
  if (action === "leave" && req.method === "POST") {
    removePeer(name, peer);
    return json(res, 200, { ok: true });
  }
  return json(res, 405, { error: "méthode non permise" });
}

// ------------------------------------------------------------------ fichiers statiques
function serveFile(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith("/")) rel += "index.html";
  if (PRIVATE.test(rel)) { res.writeHead(404); return res.end("Introuvable"); }
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end("Interdit"); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("Introuvable"); }
    const ext = path.extname(file).toLowerCase();
    const headers = { "Content-Type": TYPES[ext] || "application/octet-stream", "Content-Length": st.size,
      "Cache-Control": rel.startsWith("/packs/img/") && ext !== ".js" ? "public, max-age=2592000" : "no-cache" };
    if (rel === "/index.html") {
      // signale à la page qu'elle est servie par ce serveur : le multijoueur passe alors par /api/rooms
      const meta = '<meta name="qj-server" content="1" data-images="' + IMAGES + '" data-jeux="' + JEUX.join(",") + '">';
      const html = fs.readFileSync(file, "utf8").replace("</head>", meta + "\n</head>");
      headers["Content-Length"] = Buffer.byteLength(html);
      res.writeHead(200, headers); return res.end(req.method === "HEAD" ? undefined : html);
    }
    res.writeHead(200, headers);
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname.startsWith("/api/")) {
    api(req, res, url).catch((e) => { if (!res.headersSent) json(res, 500, { error: String(e.message || e) }); });
  } else if (req.method === "GET" || req.method === "HEAD") serveFile(req, res, url);
  else { res.writeHead(405); res.end(); }
});
// bilan des images réellement présentes (packs/img/dispo.js), pour vérifier un déploiement d'un coup d'œil
function imagesReport() {
  try {
    const txt = fs.readFileSync(path.join(ROOT, "packs", "img", "dispo.js"), "utf8");
    const d = JSON.parse(txt.slice(txt.indexOf("=") + 1).trim().replace(/;$/, ""));
    const per = {};
    for (const id of Object.keys(d.scenes || {})) { const k = id.split("-")[0]; per[k] = (per[k] || 0) + 1; }
    const keys = Object.keys(d.maps || {}).filter((k) => !JEUX.length || JEUX.includes(k));
    return "Vrais jeux : " + keys.length + " jeux, " + keys.reduce((n, k) => n + (per[k] || 0), 0) + " vues (" + keys.map((k) => k + " " + (per[k] || 0)).join(", ") + ")";
  } catch (e) {
    return "Vrais jeux : AUCUNE image (packs/img/dispo.js absent) — seul le pack démo est jouable";
  }
}
server.listen(PORT, () => {
  console.log("Quel Jeu ? sur http://localhost:" + PORT + " (dossier " + ROOT + ") · images : " + IMAGES + (JEUX.length ? " · jeux : " + JEUX.join(", ") : ""));
  console.log(imagesReport());
});
process.on("SIGTERM", () => server.close(() => process.exit(0)));
