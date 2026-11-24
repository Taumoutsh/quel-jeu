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
const MAX_PEERS = 16;
// parties ouvertes en même temps (salles) : au-delà, la création d'une partie est refusée (QJ_MAX_PARTIES, 20 par défaut)
const MAX_ROOMS = Math.max(1, parseInt(process.env.QJ_MAX_PARTIES, 10) || 20);
// signal de vie : chaque page envoie sa présence toutes les 2 s. Une connexion silencieuse depuis LIVE_MS ne compte
// plus (liste des salons publics, « un seul salon à la fois ») ; silencieuse depuis REAP_MS, elle est retirée.
// Utile quand le navigateur ne prévient pas (onglet fermé depuis le sélecteur du téléphone, page gelée, Cloudflare
// qui garde la connexion en direct ouverte). REAP_MS laisse passer un onglet caché que Chrome ralentit à un
// signal par minute ; s'il revient, la page se reconnecte d'elle-même.
const LIVE_MS = parseInt(process.env.QJ_LIVE_MS, 10) || 20000;
const REAP_MS = parseInt(process.env.QJ_REAP_MS, 10) || 75000;
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
//   games.json     : historique des parties terminées [{ at, mode, code, pub, rounds, players: [{ n, s }] }]
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

// ---- historique des parties (page /admin) : une entrée par partie terminée, 5 000 au plus (les plus anciennes
// s'en vont). À plusieurs : relevée par le serveur quand l'hôte annonce la fin (st.ph = "end"), avec les scores
// publiés par chaque joueur ; en solo : envoyée par la page à l'écran final (POST /api/games).
const GAMES_MAX = 5000;
let games = loadJSON("games.json", []);
if (!Array.isArray(games)) games = [];
const gamesSeen = new Set(games.map((g) => g.gen).filter(Boolean));
const gamesByIP = new Map();
// points d'une manche (même calcul que la page : nom + position + boost)
const roundPts = (x) => (Array.isArray(x) ? (Number(x[1]) || 0) + (Number(x[2]) || 0) + (Number(x[6]) || 0) : 0);
const scoreOf = (r) => (Array.isArray(r) ? r.reduce((t, x) => t + roundPts(x), 0) : 0);
function recordGame(g) {
  if (!g.gen || gamesSeen.has(g.gen)) return false;
  gamesSeen.add(g.gen);
  games.push(Object.assign({ at: new Date().toISOString() }, g));
  if (games.length > GAMES_MAX) games = games.slice(-GAMES_MAX);
  saveJSON("games.json", games);
  return true;
}
// partie à plusieurs terminée : joueurs de cette génération (un par navigateur), plus les joueurs partis en route
const groupGamesByIP = new Map();
function recordRoomGame(name, st, ip) {
  const room = rooms.get(name);
  if (!room || !st || typeof st.gen !== "string" || gamesSeen.has(st.gen)) return;
  // une partie qu'on n'a jamais vue en cours, ou finie trop vite pour avoir été jouée (2 s par manche au moins),
  // n'entre pas dans l'historique ; 30 parties à plusieurs au plus par heure et par adresse d'hôte
  const begun = room.plays && room.plays.get(st.gen), n = Array.isArray(st.seq) ? st.seq.length : 0;
  if (!begun || !n || Date.now() - begun < n * 2000) return;
  if (ip && limited(groupGamesByIP, ip, 30, 3600 * 1000)) return;
  if (ip) groupGamesByIP.get(ip).push(Date.now());
  const byKey = new Map();
  const add = (key, nm, r) => {
    if (!nm) return;
    const s = scoreOf(cleanR(r).slice(0, n)), prev = byKey.get(key);
    if (!prev || s > prev.s) byKey.set(key, { n: String(nm).slice(0, 16), s });
  };
  for (const [pid, p] of room) {
    const pr = p.presence || {};
    if (pr.g === st.gen && pr.n) add(UID_RE.test(pr.u || "") ? pr.u : pid, pr.n, pr.r);
  }
  for (const g of Array.isArray(st.gone) ? st.gone : []) if (g && g.name) add(UID_RE.test(g.u || "") ? g.u : "g-" + g.peer, g.name, g.r);
  const players = [...byKey.values()].sort((a, b) => b.s - a.s);
  if (!players.length) return;
  recordGame({ gen: st.gen.slice(0, 24), mode: "groupe", code: name.slice(3).toUpperCase(), pub: !!(st.cfg && st.cfg.pub === 1),
    rounds: Array.isArray(st.seq) ? st.seq.length : 0, players });
}
async function gamesApi(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "méthode non permise" });
  const ip = clientIP(req);
  if (limited(gamesByIP, ip, 30, 3600 * 1000)) return json(res, 429, { error: "trop de parties, réessaie plus tard" });
  let b; try { b = await readJSON(req, 2000); } catch (e) { return json(res, 400, { error: "JSON invalide" }); }
  const rounds = b && Number(b.rounds), score = b && Number(b.score);
  if (!b || typeof b.gen !== "string" || !/^[a-z0-9]{4,24}$/.test(b.gen) || typeof b.name !== "string" || !b.name.trim()
    || !Number.isInteger(rounds) || rounds < 1 || rounds > 15 || !Number.isInteger(score) || score < 0 || score > rounds * 2500) return json(res, 400, { error: "partie invalide" });
  gamesByIP.get(ip).push(Date.now());
  recordGame({ gen: b.gen, mode: "solo", rounds, players: [{ n: b.name.trim().slice(0, 16), s: score }] });
  return json(res, 200, { ok: true });
}
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
// IP réelle du client, pour les limites (connexion admin, signalements, parties, création de salons).
// Derrière Cloudflare : CF-Connecting-IP, que Cloudflare pose lui-même (il écrase ce qu'envoie le client).
// Sinon : la DERNIÈRE entrée de X-Forwarded-For, ajoutée par le dernier relais (NPM) ; jamais la première, que le
// client écrit lui-même (avant la v1.8.1 : il suffisait d'en changer à chaque essai pour ne jamais être bloqué).
// Ces en-têtes ne sont crus que si la connexion vient d'un relais sur le réseau privé (NPM dans Docker, la machine
// elle-même) ; une connexion directe depuis Internet compte pour son adresse réelle, quoi qu'elle écrive.
// Limite : NPM transmet tel quel un CF-Connecting-IP écrit par quelqu'un qui le joint sans passer par Cloudflare ;
// n'ouvrir NPM qu'aux adresses de Cloudflare (pare-feu). QJ_TRUST_CF=0 ignore cet en-tête (site sans Cloudflare).
const IP_RE = /^[0-9a-f.:]{2,45}$/i;
const TRUST_CF = process.env.QJ_TRUST_CF !== "0";
const PRIVATE_PEER = /^(::1|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|f[cd][0-9a-f]{2}:|fe80:)/i;
function clientIP(req) {
  const sock = String(req.socket.remoteAddress || "").replace(/^::ffff:/, "");
  if (!PRIVATE_PEER.test(sock)) return sock;
  const cf = String(req.headers["cf-connecting-ip"] || "").trim();
  if (TRUST_CF && IP_RE.test(cf)) return cf;
  const xff = String(req.headers["x-forwarded-for"] || "").split(",").map((s) => s.trim()).filter(Boolean);
  const last = xff[xff.length - 1];
  if (last && IP_RE.test(last)) return last;
  return sock;
}
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
// joueur d'une salle ; newRoom : la salle peut être ouverte si elle n'existe pas (création d'une partie par
// l'hôte, ?create=1). Rejoindre avec un code n'ouvre jamais de salle : un code inconnu ne prend pas de place.
// Refus : { err: 404 } salle inconnue, { err: "full" } trop de parties ouvertes, { err: 503 } salle pleine.
// connexions retirées à distance par leur joueur (« Le fermer et recréer ») : refusées 10 min, même si la salle a
// disparu entre-temps (l'ancien onglet, encore ouvert, ne revient ni dans le salon ni ne le recrée)
const kicked = new Map();
const KICK_MS = 10 * 60 * 1000;
const createsByIP = new Map();
function getPeer(name, peer, newRoom, ip) {
  const k = kicked.get(peer);
  if (k && Date.now() - k < KICK_MS) return { err: 410 };
  if (k) kicked.delete(peer);
  let room = rooms.get(name);
  if (!room) {
    if (!newRoom) return { err: 404 };
    if (rooms.size >= MAX_ROOMS) return { err: "full" };
    // 15 salons au plus par adresse en 10 minutes : personne ne peut occuper à lui seul toutes les places
    if (ip && limited(createsByIP, ip, 15, 10 * 60 * 1000)) return { err: 429 };
    if (ip) createsByIP.get(ip).push(Date.now());
    room = new Map(); room.rid = crypto.randomBytes(4).toString("hex"); rooms.set(name, room);
  }
  let p = room.get(peer);
  if (!p) {
    if (room.size >= MAX_PEERS) return { err: 503 };
    p = { presence: {}, clients: new Set(), timer: null, since: Date.now(), seen: Date.now() }; room.set(peer, p);
    // pas encore de flux ouvert (arrivée par un envoi de présence) : retiré s'il ne se connecte jamais
    p.timer = setTimeout(() => removePeer(name, peer), GRACE_MS);
  }
  return p;
}
// connexions silencieuses depuis REAP_MS : retirées (fin de leur flux, salle supprimée si elle se vide)
setInterval(() => {
  const now = Date.now();
  for (const [name, room] of [...rooms]) for (const [pid, p] of [...room]) if (now - (p.seen || 0) > REAP_MS) removePeer(name, pid);
}, Math.min(5000, REAP_MS / 3)).unref();
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
    if (!body || !sameSecret(body.password || "", ADMIN_PASSWORD)) {
      fails.get(ip).push(Date.now());
      await new Promise((r) => setTimeout(r, 1000)); // chaque essai raté coûte 1 s : la force brute ralentit encore
      return json(res, 401, { error: "mot de passe incorrect" });
    }
    const t = crypto.randomBytes(24).toString("hex");
    tokens.set(t, Date.now() + TOKEN_MS);
    return json(res, 200, { token: t });
  }
  if (!isAdmin(req)) return json(res, 401, { error: "connexion requise" });
  if (route === "data" && req.method === "GET") return json(res, 200, { reports, overrides, games });
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

// ---- salons publics : l'hôte choisit « Public » dans les réglages (st.cfg.pub = 1, dans sa présence) ; la liste
// de l'accueil (GET /api/public) en est tirée, sans rien garder d'autre en mémoire.
const UID_RE = /^[a-z0-9]{12}$/;
// présence de l'hôte d'une salle : celle qui porte l'état de la partie, au mandat le plus récent (relève d'hôte)
const fresh = (p) => Date.now() - (p.seen || 0) < LIVE_MS;
function hostOf(room) {
  let best = null;
  for (const p of room.values()) {
    const pr = p.presence || {};
    if (pr.h !== 1 || !pr.st || typeof pr.st !== "object" || !fresh(p)) continue;
    if (!best || ((pr.st.term || 0) > (best.st.term || 0))) best = pr;
  }
  return best;
}
// salle dont ce joueur (identifiant de navigateur) est l'hôte, sauf `except` : un seul salon à la fois. Ses
// connexions d'hôte silencieuses (page fermée sans prévenir) sont retirées au passage : ce salon-là est mort.
function roomHostedBy(u, except) {
  if (!UID_RE.test(u || "")) return null;
  for (const [name, room] of [...rooms]) {
    if (name === except) continue;
    for (const [pid, p] of [...room]) {
      if (!p.presence || p.presence.u !== u || p.presence.h !== 1) continue;
      if (fresh(p)) return name;
      kicked.set(pid, Date.now()); removePeer(name, pid);
    }
  }
  return null;
}
const codeOfRoom = (name) => name.slice(3).toUpperCase();
function publicRooms(u) {
  const out = [];
  for (const [name, room] of rooms) {
    if (!/^qj-[a-z0-9]{5}$/.test(name)) continue;
    const h = hostOf(room);
    if (!h || !h.st.cfg || h.st.cfg.pub !== 1) continue;
    const ids = new Set();
    for (const p of room.values()) { const pr = p.presence || {}; if (pr.n && fresh(p)) ids.add(UID_RE.test(pr.u || "") ? pr.u : p); }
    const st = h.st, n = Array.isArray(st.seq) ? st.seq.length : 0;
    out.push({
      code: codeOfRoom(name), n: String(h.n || "?").slice(0, 16), a: typeof h.a === "string" ? h.a.slice(0, 40) : null,
      c: /^#[0-9a-f]{6}$/i.test(h.c || "") ? h.c : null, players: ids.size,
      rounds: st.ph === "lobby" ? (st.cfg.rounds | 0) : n, time: st.cfg.time | 0,
      ph: ["lobby", "play", "rev", "end"].includes(st.ph) ? st.ph : "lobby", i: (st.i | 0) + 1,
      mine: !!(u && h.u === u), since: Math.min(...[...room.values()].map((p) => p.since || Date.now())),
    });
  }
  // salons en attente d'abord, puis parties en cours, puis terminées ; à égalité, le plus ancien d'abord
  const rank = { lobby: 0, end: 1, play: 2, rev: 2 };
  out.sort((a, b) => (rank[a.ph] - rank[b.ph]) || (a.since - b.since));
  return out.map(({ since, ...r }) => r);
}

// ---- présences validées : le serveur ne relaie que les champs que la page publie, aux valeurs bornées (un client
// trafiqué ne peut ni gonfler un score, ni envoyer n'importe quoi aux autres joueurs). Champs de la page (publish) :
// v u n c a h g r hb j vh rd nx st ; st : gen ph cfg seq i dl t0 term gone ; cfg : rounds time tries hints speed pack pub.
const num = (v, lo, hi, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
const int = (v, lo, hi, d) => Math.round(num(v, lo, hi, d));
const txt = (v, max) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, max) : undefined);
const HEX_RE = /^#[0-9a-f]{6}$/i, PHASES = ["lobby", "play", "rev", "end"];
// réponses d'un joueur, une par manche : [état, points du nom, points de position, erreurs, x, y, boost]
function cleanR(r) {
  if (!Array.isArray(r)) return [];
  return r.slice(0, 15).map((x) => {
    if (!Array.isArray(x)) return null;
    const y = [int(x[0], 0, 3, 0), num(x[1], 0, 1000, 0), num(x[2], 0, 1000, 0), int(x[3], 0, 99, 0), num(x[4], -1, 1, -1), num(x[5], -1, 1, -1)];
    if (x.length > 6) y.push(num(x[6], 0, 500, 0));
    return y;
  });
}
function cleanCfg(c) {
  if (!c || typeof c !== "object") return {};
  const o = {};
  if ("rounds" in c) o.rounds = int(c.rounds, 1, 15, 5);
  if ("time" in c) o.time = int(c.time, 0, 3600, 120);
  if ("tries" in c) o.tries = int(c.tries, 0, 99, 3);
  if ("hints" in c) o.hints = int(c.hints, 0, 1, 1);
  if ("speed" in c) o.speed = int(c.speed, 0, 1, 1);
  if ("pub" in c) o.pub = int(c.pub, 0, 1, 0);
  if ("pack" in c) o.pack = txt(c.pack, 8) || "real";
  return o;
}
function cleanSt(st) {
  if (!st || typeof st !== "object" || Array.isArray(st)) return null;
  const o = { gen: txt(st.gen, 24) || "", ph: PHASES.includes(st.ph) ? st.ph : "lobby", cfg: cleanCfg(st.cfg) };
  o.seq = Array.isArray(st.seq) ? st.seq.slice(0, 15).map((s) => txt(s, 64) || "") : [];
  o.i = int(st.i, -1, 15, -1);
  o.dl = num(st.dl, 0, 1e14, 0);
  if ("t0" in st) o.t0 = num(st.t0, 0, 1e14, 0);
  o.term = int(st.term, 0, 1e6, 0);
  if (Array.isArray(st.gone)) o.gone = st.gone.slice(0, 32).filter((g) => g && typeof g === "object").map((g) => ({
    peer: txt(g.peer, 24) || "", u: UID_RE.test(g.u || "") ? g.u : "", name: txt(g.name, 16) || "?", color: HEX_RE.test(g.color || "") ? g.color : "#8b9fb1",
    avatar: txt(g.avatar, 60) || null, r: cleanR(g.r), j: int(g.j, 0, 15, 0), left: int(g.left, -1, 15, -1) }));
  return o;
}
function cleanPresence(b) {
  const o = {};
  if ("v" in b) o.v = int(b.v, 0, 99, 1);
  if (UID_RE.test(b.u || "")) o.u = b.u;
  if ("n" in b) o.n = (txt(b.n, 16) || "").trim();
  if (HEX_RE.test(b.c || "")) o.c = b.c;
  if ("a" in b) o.a = txt(b.a, 60) || null;
  if ("h" in b) o.h = b.h === 1 ? 1 : 0;
  if ("g" in b) o.g = txt(b.g, 24) || null;
  if ("r" in b) o.r = cleanR(b.r);
  if ("hb" in b) o.hb = int(b.hb, 0, 1e6, 0);
  if ("j" in b) o.j = int(b.j, 0, 15, 0);
  if ("vh" in b) o.vh = b.vh === 1 ? 1 : 0;
  if ("rd" in b) o.rd = typeof b.rd === "string" ? txt(b.rd, 24) : 0;
  if ("nx" in b) o.nx = int(b.nx, -1, 15, -1);
  if ("st" in b) o.st = cleanSt(b.st);
  return o;
}
// rôle d'hôte : refusé tant qu'un AUTRE hôte de la salle (autre navigateur) est connecté et donne signe de vie
// depuis moins de 6 s (le délai au bout duquel les pages elles-mêmes le croient parti et lancent la relève)
const HOST_LIVE_MS = 6000;
function hostTaken(room, peer, u) {
  for (const [pid, q] of room) {
    if (pid === peer) continue;
    const pr = q.presence || {};
    if (pr.h !== 1 || !pr.st || (u && pr.u === u)) continue;
    if (q.clients.size && Date.now() - (q.seen || 0) < HOST_LIVE_MS) return true;
  }
  return false;
}

function refuse(res, err) {
  if (err === "full") return json(res, 503, { error: "trop de parties en cours", code: "full", max: MAX_ROOMS });
  if (err === 404) return json(res, 404, { error: "partie introuvable", code: "absent" });
  if (err === 410) return json(res, 410, { error: "tu as quitté ce salon", code: "parti" });
  if (err === 429) return json(res, 429, { error: "trop de salons créés, réessaie dans quelques minutes", code: "trop" });
  return json(res, 503, { error: "salle pleine", code: "salle" });
}

async function api(req, res, url) {
  const m = url.pathname.match(/^\/api\/rooms\/([^/]+)\/(events|presence|leave|state|close)$/);
  if (url.pathname === "/api/ping") return json(res, 200, { ok: true });
  if (url.pathname === "/api/public" && req.method === "GET") return json(res, 200, { rooms: publicRooms(url.searchParams.get("u") || "") });
  if (url.pathname === "/api/reports") return reportApi(req, res);
  if (url.pathname === "/api/games") return gamesApi(req, res);
  if (url.pathname.startsWith("/api/admin/")) return adminApi(req, res, url);
  if (!m) return json(res, 404, { error: "introuvable" });
  const name = m[1], action = m[2], peer = url.searchParams.get("peer") || "";
  if (!ROOM_RE.test(name) || !PEER_RE.test(peer)) return json(res, 400, { error: "salle ou joueur invalide" });

  const newRoom = url.searchParams.get("create") === "1";
  if (action === "events" && req.method === "GET") {
    const p = getPeer(name, peer, newRoom, clientIP(req));
    if (p.err) return refuse(res, p.err);
    clearTimeout(p.timer); p.timer = null; p.seen = Date.now();
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
    body = cleanPresence(body);
    // un seul salon à la fois : créer une partie quand on est déjà l'hôte d'une autre salle est refusé (la page
    // propose d'y retourner, ou de la quitter puis de recréer)
    if (newRoom && !rooms.has(name)) {
      const other = roomHostedBy(body.u, name);
      if (other) return json(res, 409, { error: "tu as déjà un salon ouvert", code: "already", room: codeOfRoom(other) });
    }
    const ip = clientIP(req);
    const p = getPeer(name, peer, newRoom, ip);
    if (p.err) return refuse(res, p.err);
    p.seen = Date.now();
    // numéro d'ordre : deux envois rapprochés peuvent arriver dans le désordre ; le plus ancien est ignoré
    const seq = Number(url.searchParams.get("s"));
    if (Number.isFinite(seq) && seq > 0) {
      if (seq <= (p.seq || 0)) return json(res, 200, { ok: true, stale: true });
      p.seq = seq;
    }
    const room = rooms.get(name);
    // un joueur ne peut pas se déclarer hôte (ni imposer un état de partie) tant que le vrai hôte est là
    let host = true;
    if ((body.h === 1 || body.st) && hostTaken(room, peer, body.u || p.presence.u)) { body.h = 0; body.st = null; host = false; }
    p.presence = Object.assign({}, p.presence, body);
    broadcast(name);
    // partie vue en cours par le serveur (preuve qu'elle a été jouée, pour l'historique)
    const isHost = p.presence.h === 1 && !!body.st; // rôle tel qu'enregistré (h peut venir d'un envoi précédent)
    if (isHost && body.st.ph === "play" && body.st.gen) {
      room.plays = room.plays || new Map();
      if (!room.plays.has(body.st.gen)) room.plays.set(body.st.gen, Date.now());
    }
    // fin de partie annoncée par l'hôte : la partie entre dans l'historique (une seule fois par génération)
    if (isHost && body.st.ph === "end") recordRoomGame(name, body.st, ip);
    return json(res, 200, host ? { ok: true } : { ok: true, host: false });
  }
  // secours si le flux en direct est retenu par un proxy : l'état de la salle à la demande
  if (action === "state" && req.method === "GET") {
    const room = rooms.get(name);
    if (!room) return json(res, 200, { peers: {}, meta: {}, v: 0, rid: "vide" });
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store, no-transform" });
    return res.end(snapshot(room));
  }
  // quitter à distance son ancien salon (« Le fermer et recréer ») : toutes les connexions de ce joueur
  // (identifiant de navigateur, ?peer=) en sont retirées ; s'il reste d'autres joueurs, l'un d'eux devient hôte
  if (action === "close" && req.method === "POST") {
    const room = rooms.get(name);
    if (room && UID_RE.test(peer)) for (const [pid, p] of [...room]) if (p.presence && p.presence.u === peer) {
      kicked.set(pid, Date.now());
      if (kicked.size > 5000) for (const [id, t] of kicked) if (Date.now() - t >= KICK_MS) kicked.delete(id);
      removePeer(name, pid);
    }
    return json(res, 200, { ok: true });
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

// en-têtes de sécurité, sur toutes les réponses : pas d'affichage dans un cadre d'un autre site (clickjacking de
// /admin), scripts et connexions limités à ce site (seules exceptions : les polices Google), type des fichiers
// respecté, adresse de la page non transmise aux autres sites, HTTPS imposé au navigateur quand on y est passé.
const CSP = ["default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com", "img-src 'self' data: blob:", "media-src 'self' blob:", "connect-src 'self'",
  "worker-src 'self' blob:", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"].join("; ");
function securityHeaders(req, res) {
  res.setHeader("Content-Security-Policy", CSP);
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  const https = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https" || /"scheme":"https"/.test(String(req.headers["cf-visitor"] || ""));
  if (https) res.setHeader("Strict-Transport-Security", "max-age=15552000");
}
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  securityHeaders(req, res);
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
