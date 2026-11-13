// Serveur de GameSpotter pour l'auto-hébergement (Docker) : fichiers statiques + salles multijoueur.
// Aucune dépendance : Node.js seul. Les salles remplacent la capacité « room » des artefacts Claude :
// chaque joueur publie sa présence (un objet JSON) et reçoit celles des autres en flux SSE.
//
//   node server/server.js            (port 8080, dossier servi = racine du dépôt)
//   PORT=3000 ROOT=/srv/site node server/server.js
"use strict";
const http = require("http");
const crypto = require("crypto");
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
const PRIVATE = /^\/(server|tools|tests|data|\.git)(\/|$)|^\/(Dockerfile|docker-compose\.yml|\.dockerignore|\.gitignore|\.env.*)$/;

// ------------------------------------------------------------------ signalements et corrections
// Les joueurs signalent une vue (position fausse, mauvais jeu…) ; l'administrateur (page /admin,
// mot de passe QJ_ADMIN_PASSWORD du .env) corrige la vue ou la supprime. Tout est gardé dans DATA :
//   reports.json   : [{ id, at, sid, kind, comment, pin, status }]
//   overrides.json : { scenes: { idVue: { x, y, game, place } | { deleted: true } } }
// Les corrections sont appliquées à packs/vrais-jeux.js au moment de le servir ; le dépôt n'est pas modifié.
const DATA = path.resolve(process.env.QJ_DATA || path.join(ROOT, "data"));
const ADMIN_PASSWORD = process.env.QJ_ADMIN_PASSWORD || "";
const KINDS = ["position", "jeu", "image", "autre"];
function loadJSON(name, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, name), "utf8")); } catch (e) { return fallback; }
}
function saveJSON(name, obj) {
  fs.mkdirSync(DATA, { recursive: true });
  const file = path.join(DATA, name), tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 1)); fs.renameSync(tmp, file);
}
let reports = loadJSON("reports.json", []);
let overrides = loadJSON("overrides.json", { scenes: {} });
if (!overrides || typeof overrides.scenes !== "object") overrides = { scenes: {} };
let overridesVersion = crypto.createHash("sha1").update(JSON.stringify(overrides)).digest("hex").slice(0, 8);
function setOverrides(o) { overrides = o; saveJSON("overrides.json", o); overridesVersion = crypto.createHash("sha1").update(JSON.stringify(o)).digest("hex").slice(0, 8); packCache = null; }

// pack d'origine (lu dans le fichier) et pack corrigé (servi aux joueurs)
let packCache = null;
function readPack() {
  const txt = fs.readFileSync(path.join(ROOT, "packs", "vrais-jeux.js"), "utf8");
  const a = txt.indexOf("/*JSON*/"), b = txt.indexOf("/*FIN*/");
  return { txt, head: txt.slice(0, a + 8), tail: txt.slice(b), pack: JSON.parse(txt.slice(a + 8, b)) };
}
function applyOverrides(pack) {
  const keys = new Set(pack.games.map((g) => g.key)), o = overrides.scenes || {};
  pack.scenes = pack.scenes.filter((sc) => !(o[sc.id] && o[sc.id].deleted)).map((sc) => {
    const c = o[sc.id];
    if (!c) return sc;
    const out = Object.assign({}, sc);
    if (typeof c.x === "number" && typeof c.y === "number") { out.x = c.x; out.y = c.y; }
    if (c.game && keys.has(c.game)) out.game = c.game;
    if (typeof c.place === "string" && c.place) out.place = c.place;
    return out;
  });
  return pack;
}
// ------------------------------------------------------------------ noms cachés (anti-triche)
// Les noms des vues (« gtav-vespucci-beach ») donnent la réponse : dans ce qui part vers les joueurs, chaque vue
// prend un code neutre (HMAC d'une clé secrète gardée dans DATA, donc stable d'un redémarrage à l'autre),
// ses détails (jeu, lieu, position) sont brouillés, et sa capture est servie sous packs/img/x/<code>.jpg.
// Un joueur qui ouvre les outils du navigateur ne voit plus de nom lisible. (Le jeu reste vérifié dans le
// navigateur : un tricheur très motivé pourrait encore décoder le pack, mais plus d'un simple coup d'œil.)
function loadSecret() {
  const file = path.join(DATA, "secret.txt");
  try { const t = fs.readFileSync(file, "utf8").trim(); if (/^[0-9a-f]{32,}$/.test(t)) return t; } catch (e) { /* à créer */ }
  const t = crypto.randomBytes(32).toString("hex");
  try { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(file, t); } catch (e) { console.warn("clé des codes non enregistrée (" + e.message + ") : codes valables jusqu'au redémarrage"); }
  return t;
}
const SECRET = loadSecret();
const codeOf = (id) => crypto.createHmac("sha256", SECRET).update(id).digest("hex").slice(0, 12);
const CODE_RE = /^[0-9a-f]{12}$/;
let codeMap = null; // code → identifiant de vue
function idOfCode(code) {
  if (!codeMap) {
    codeMap = new Map();
    const pack = readPack().pack;
    for (const sc of pack.scenes) codeMap.set(codeOf(sc.id), sc.id);
    for (const g of pack.games) codeMap.set(codeOf("map-" + g.key), "map-" + g.key); // les cartes aussi
  }
  return codeMap.get(code) || null;
}
// brouillage des détails d'une vue : octets UTF-8 XOR le code, en base64 (le navigateur fait l'inverse)
function scramble(code, obj) {
  const b = Buffer.from(JSON.stringify(obj), "utf8");
  for (let i = 0; i < b.length; i++) b[i] ^= code.charCodeAt(i % code.length);
  return b.toString("base64");
}
function servedPack() {
  if (packCache) return packCache;
  const p = readPack(), pack = applyOverrides(p.pack);
  pack.scenes = pack.scenes.map((sc) => {
    const code = codeOf(sc.id), d = Object.assign({}, sc); delete d.id;
    return { id: code, z: scramble(code, d) };
  });
  codeMap = null;
  return (packCache = p.head + JSON.stringify(pack) + p.tail);
}
// liste des images disponibles, avec les codes à la place des noms de vues
let dispoCache = null;
function servedDispo(file) {
  const st = fs.statSync(file), key = st.mtimeMs + ":" + st.size;
  if (dispoCache && dispoCache.key === key) return dispoCache.body;
  const txt = fs.readFileSync(file, "utf8");
  const d = JSON.parse(txt.slice(txt.indexOf("=") + 1).trim().replace(/;$/, ""));
  const scenes = {};
  for (const [id, v] of Object.entries(d.scenes || {})) scenes[codeOf(id)] = v;
  const maps = {};
  for (const [k, v] of Object.entries(d.maps || {})) maps[k] = v.concat([codeOf("map-" + k)]); // 4e valeur : code de la carte
  const body = "window.REAL_PACK_DISPO = " + JSON.stringify({ maps, scenes, coded: 1 }) + ";\n";
  dispoCache = { key, body };
  return body;
}

// connexion administrateur : jetons en mémoire (12 h), essais ratés limités
const tokens = new Map(), fails = new Map();
const TOKEN_MS = 12 * 3600 * 1000;
function sameSecret(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest(), hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}
function clientIP(req) { return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim(); }
function isAdmin(req) {
  const t = String(req.headers.authorization || "").replace(/^Bearer /, "");
  const exp = tokens.get(t);
  if (!exp || exp < Date.now()) { tokens.delete(t); return false; }
  return true;
}
// limite simple par adresse : n actions par fenêtre
function limited(map, key, n, ms) {
  const now = Date.now(), list = (map.get(key) || []).filter((t) => now - t < ms);
  map.set(key, list);
  return list.length >= n;
}
const reportsByIP = new Map();

// ------------------------------------------------------------------ salles
// rooms : nom → Map(peer → { presence, clients:Set(res), timer })
const rooms = new Map();

// état d'une salle : présences, plus pour chaque joueur s'il est connecté (on) et depuis quand il est là (t)
function snapshot(room) {
  const out = {}, meta = {};
  for (const [peer, p] of room) { out[peer] = p.presence; meta[peer] = { on: p.clients.size ? 1 : 0, t: p.since }; }
  return JSON.stringify({ peers: out, meta, v: room.v || 0, rid: room.rid });
}
function broadcast(name) {
  const room = rooms.get(name);
  if (!room) return;
  room.v = (room.v || 0) + 1;
  const data = "data: " + snapshot(room) + "\n\n";
  for (const p of room.values()) for (const res of p.clients) res.write(data);
}
function getPeer(name, peer, create) {
  let room = rooms.get(name);
  if (!room) {
    if (!create || rooms.size >= MAX_ROOMS) return null;
    room = new Map(); room.rid = crypto.randomBytes(4).toString("hex"); rooms.set(name, room);
  }
  let p = room.get(peer);
  if (!p) {
    if (!create || room.size >= MAX_PEERS) return null;
    p = { presence: {}, clients: new Set(), timer: null, since: Date.now() }; room.set(peer, p);
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

async function readJSON(req, max) {
  const txt = await readBody(req);
  if (txt.length > max) throw new Error("trop gros");
  return JSON.parse(txt);
}
const num01 = (v) => typeof v === "number" && isFinite(v) && v >= 0 && v <= 1;

async function adminApi(req, res, url) {
  const route = url.pathname.slice("/api/admin/".length);
  if (!ADMIN_PASSWORD) return json(res, 503, { error: "administration désactivée : définir QJ_ADMIN_PASSWORD dans le .env" });
  if (route === "login" && req.method === "POST") {
    const ip = clientIP(req);
    if (limited(fails, ip, 8, 15 * 60 * 1000)) return json(res, 429, { error: "trop d'essais, réessaie dans 15 minutes" });
    let body; try { body = await readJSON(req, 2000); } catch (e) { return json(res, 400, { error: "JSON invalide" }); }
    if (!body || !sameSecret(body.password || "", ADMIN_PASSWORD)) { fails.get(ip).push(Date.now()); return json(res, 401, { error: "mot de passe incorrect" }); }
    const t = crypto.randomBytes(24).toString("hex");
    tokens.set(t, Date.now() + TOKEN_MS);
    return json(res, 200, { token: t });
  }
  if (!isAdmin(req)) return json(res, 401, { error: "connexion requise" });
  if (route === "data" && req.method === "GET") return json(res, 200, { reports, overrides });
  if (route === "pack" && req.method === "GET") return json(res, 200, readPack().pack);
  if (route === "scene" && req.method === "POST") {
    let b; try { b = await readJSON(req, 4000); } catch (e) { return json(res, 400, { error: "JSON invalide" }); }
    const pack = readPack().pack;
    if (!b || !pack.scenes.some((sc) => sc.id === b.id)) return json(res, 404, { error: "vue inconnue" });
    const o = JSON.parse(JSON.stringify(overrides));
    if (b.reset) delete o.scenes[b.id];
    else if (b.deleted) o.scenes[b.id] = { deleted: true };
    else {
      const c = {};
      if (num01(b.x) && num01(b.y)) { c.x = Math.round(b.x * 1e4) / 1e4; c.y = Math.round(b.y * 1e4) / 1e4; }
      if (typeof b.game === "string" && pack.games.some((g) => g.key === b.game)) c.game = b.game;
      if (typeof b.place === "string" && b.place.trim()) c.place = b.place.trim().slice(0, 80);
      o.scenes[b.id] = c;
    }
    setOverrides(o);
    return json(res, 200, { ok: true, overrides });
  }
  if (route === "report" && req.method === "POST") {
    let b; try { b = await readJSON(req, 2000); } catch (e) { return json(res, 400, { error: "JSON invalide" }); }
    const r = b && reports.find((x) => x.id === b.id);
    if (!r) return json(res, 404, { error: "signalement inconnu" });
    if (b.remove) reports = reports.filter((x) => x !== r);
    else if (["open", "resolved", "ignored"].includes(b.status)) r.status = b.status;
    saveJSON("reports.json", reports);
    return json(res, 200, { ok: true });
  }
  return json(res, 404, { error: "introuvable" });
}

async function reportApi(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "méthode non permise" });
  const ip = clientIP(req);
  if (limited(reportsByIP, ip, 30, 3600 * 1000)) return json(res, 429, { error: "trop de signalements, réessaie plus tard" });
  let b; try { b = await readJSON(req, 3000); } catch (e) { return json(res, 400, { error: "JSON invalide" }); }
  if (!b || typeof b.sid !== "string" || !KINDS.includes(b.kind)) return json(res, 400, { error: "signalement invalide" });
  if (CODE_RE.test(b.sid)) b.sid = idOfCode(b.sid) || b.sid; // la page ne connaît que le code de la vue
  if (!readPack().pack.scenes.some((sc) => sc.id === b.sid)) return json(res, 404, { error: "vue inconnue" });
  if (reports.length >= 5000) return json(res, 507, { error: "trop de signalements en attente" });
  const r = { id: crypto.randomBytes(6).toString("hex"), at: new Date().toISOString(), sid: b.sid, kind: b.kind,
    comment: typeof b.comment === "string" ? b.comment.trim().slice(0, 400) : "", status: "open" };
  if (b.pin && num01(b.pin.x) && num01(b.pin.y)) r.pin = { x: Math.round(b.pin.x * 1e4) / 1e4, y: Math.round(b.pin.y * 1e4) / 1e4 };
  if (typeof b.name === "string") r.name = b.name.trim().slice(0, 16);
  reports.push(r); saveJSON("reports.json", reports);
  reportsByIP.get(ip).push(Date.now());
  return json(res, 200, { ok: true });
}

async function api(req, res, url) {
  const m = url.pathname.match(/^\/api\/rooms\/([^/]+)\/(events|presence|leave|state)$/);
  if (url.pathname === "/api/ping") return json(res, 200, { ok: true });
  if (url.pathname === "/api/reports") return reportApi(req, res);
  if (url.pathname.startsWith("/api/admin/")) return adminApi(req, res, url);
  if (!m) return json(res, 404, { error: "introuvable" });
  const name = m[1], action = m[2], peer = url.searchParams.get("peer") || "";
  if (!ROOM_RE.test(name) || !PEER_RE.test(peer)) return json(res, 400, { error: "salle ou joueur invalide" });

  if (action === "events" && req.method === "GET") {
    const p = getPeer(name, peer, true);
    if (!p) return json(res, 503, { error: "salle pleine" });
    clearTimeout(p.timer); p.timer = null;
    // flux en direct : ni mise en tampon (Nginx : X-Accel-Buffering), ni compression ou transformation par un CDN
    // comme Cloudflare (no-transform, identity), qui retiendrait les messages ; un commentaire de 2 Ko force le départ.
    res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-store, no-transform", "Content-Encoding": "identity", "Connection": "keep-alive", "X-Accel-Buffering": "no" });
    res.write(":" + " ".repeat(2048) + "\nretry: 2000\n\n");
    p.clients.add(res);
    res.write("data: " + snapshot(rooms.get(name)) + "\n\n");
    broadcast(name); // les autres voient tout de suite que ce joueur est (re)connecté
    const ping = setInterval(() => res.write(": ping\n\n"), 15000);
    req.on("close", () => {
      clearInterval(ping); p.clients.delete(res);
      if (!p.clients.size && rooms.get(name) && rooms.get(name).get(peer) === p) {
        p.timer = setTimeout(() => removePeer(name, peer), GRACE_MS);
        broadcast(name); // signale la déconnexion (le joueur reste dans la salle pendant le délai de grâce)
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
    // numéro d'ordre : deux envois rapprochés peuvent arriver dans le désordre ; le plus ancien est ignoré
    const seq = Number(url.searchParams.get("s"));
    if (Number.isFinite(seq) && seq > 0) {
      if (seq <= (p.seq || 0)) return json(res, 200, { ok: true, stale: true });
      p.seq = seq;
    }
    p.presence = Object.assign({}, p.presence, body);
    broadcast(name);
    return json(res, 200, { ok: true });
  }
  // secours si le flux en direct est retenu par un proxy : l'état de la salle à la demande
  if (action === "state" && req.method === "GET") {
    const room = rooms.get(name);
    if (!room) return json(res, 200, { peers: {}, meta: {}, v: 0, rid: "vide" });
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store, no-transform" });
    return res.end(snapshot(room));
  }
  if (action === "leave" && req.method === "POST") {
    removePeer(name, peer);
    return json(res, 200, { ok: true });
  }
  return json(res, 405, { error: "méthode non permise" });
}

// ------------------------------------------------------------------ fichiers statiques
// Empreinte du contenu des fichiers appelés par la page (js, css) : la page les demande en « fichier?v=empreinte ».
// Une nouvelle version a donc une nouvelle adresse, qu'aucun cache (navigateur, Cloudflare…) n'a déjà gardée.
const versions = new Map();
function version(rel) {
  const file = path.join(ROOT, rel);
  try {
    const st = fs.statSync(file);
    const key = st.mtimeMs + ":" + st.size, hit = versions.get(rel);
    if (hit && hit.key === key) return hit.v;
    const v = crypto.createHash("sha1").update(fs.readFileSync(file)).digest("hex").slice(0, 10);
    versions.set(rel, { key, v });
    return v;
  } catch (e) {
    return null;
  }
}
function versionAssets(html) {
  return html.replace(/(src|href)="((?:js|packs)\/[^"?#]+\.js|[^"?#/:]+\.css)"/g, (m, attr, rel) => {
    const v = version(rel);
    return v ? attr + '="' + rel + "?v=" + v + (rel === "packs/vrais-jeux.js" ? overridesVersion : "") + '"' : m;
  });
}
function serveFile(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === "/admin" || rel === "/admin/") rel = "/admin.html";
  // lien d'une partie : /K6P7V → la page du jeu (le code est lu dans l'adresse) ; /packs, /tools… restent des dossiers
  else if (/^\/[A-Za-z0-9]{5}$/.test(rel) && !fs.existsSync(path.join(ROOT, rel))) rel = "/index.html";
  const coded = /^\/packs\/img\/x\/([0-9a-f]{12})\.jpg$/.exec(rel);
  if (coded) { const id = idOfCode(coded[1]); if (!id) { res.writeHead(404); return res.end("Introuvable"); } rel = "/packs/img/" + id + ".jpg"; }
  if (rel.endsWith("/")) rel += "index.html";
  if (PRIVATE.test(rel)) { res.writeHead(404); return res.end("Introuvable"); }
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end("Interdit"); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("Introuvable"); }
    const ext = path.extname(file).toLowerCase();
    // Cache : la page, les scripts, les styles et les données (html, css, js, json) ne sont jamais gardés,
    // ni par le navigateur ni par un CDN comme Cloudflare (no-store) : une mise à jour se voit tout de suite.
    // Les images, elles, se gardent longtemps (CDN compris) ; leur adresse porte une empreinte (?v=…)
    // quand elle change, donc une image refaite est quand même rechargée.
    const IMG = /^\.(jpe?g|png|webp|svg|ico)$/.test(ext);
    const headers = { "Content-Type": TYPES[ext] || "application/octet-stream", "Content-Length": st.size,
      "Cache-Control": !IMG ? "no-store" : url.searchParams.has("v") ? "public, max-age=31536000, immutable" : "public, max-age=86400" };
    if (rel === "/packs/img/dispo.js") {
      let body; try { body = servedDispo(file); } catch (e) { body = fs.readFileSync(file, "utf8"); }
      headers["Content-Length"] = Buffer.byteLength(body);
      res.writeHead(200, headers); return res.end(req.method === "HEAD" ? undefined : body);
    }
    if (rel === "/packs/vrais-jeux.js") {
      // pack « Vrais jeux » avec les corrections de l'administrateur
      let body; try { body = servedPack(); } catch (e) { body = fs.readFileSync(file, "utf8"); }
      headers["Content-Length"] = Buffer.byteLength(body);
      res.writeHead(200, headers); return res.end(req.method === "HEAD" ? undefined : body);
    }
    if (rel === "/index.html" || rel === "/admin.html") {
      // signale à la page qu'elle est servie par ce serveur : le multijoueur passe alors par /api/rooms
      const meta = '<meta name="qj-server" content="1" data-images="' + IMAGES + '" data-jeux="' + JEUX.join(",") + '">';
      const html = versionAssets(fs.readFileSync(file, "utf8").replace("</head>", meta + "\n</head>"));
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
  console.log("GameSpotter sur http://localhost:" + PORT + " (dossier " + ROOT + ") · images : " + IMAGES + (JEUX.length ? " · jeux : " + JEUX.join(", ") : ""));
  console.log(imagesReport());
  console.log("Signalements : " + reports.filter((r) => r.status === "open").length + " en attente · corrections : " + Object.keys(overrides.scenes || {}).length + " vue(s) · administration " + (ADMIN_PASSWORD ? "active (/admin)" : "désactivée (QJ_ADMIN_PASSWORD vide)") + " · données dans " + DATA);
});
process.on("SIGTERM", () => server.close(() => process.exit(0)));
