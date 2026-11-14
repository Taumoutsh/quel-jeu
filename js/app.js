/* GameSpotter — logique de l'application : écrans, manches, points, multijoueur, bibliothèque. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const COLORS = ["#f4b740", "#ff7b72", "#4cc9c0", "#9d8cff", "#6fd69b", "#ff9f5a", "#f07ac0", "#e3ecf2"]; // couleurs de joueur, accordées à la palette
  const AV = window.AVATAR; // avatars composés (js/avatars.js) : "tenue.couleur.peau.yeux"
  const avaOK = (spec) => !!(AV && AV.ok(spec));
  // petite figurine d'un joueur (repli : pastille de couleur si l'avatar est inconnu)
  const ava = (p, size) => avaOK(p.avatar)
    ? "<span class='ava' style='width:" + size + "px;height:" + size + "px'>" + window.avatarSVG(p.avatar) + "</span>"
    : "<span class='dot' style='display:inline-block;vertical-align:middle;background:" + p.color + "'></span>";
  const CODE_ABC = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const LS = {
    get(k, d) { try { const v = localStorage.getItem("qj." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("qj." + k, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } },
  };
  const rid = (n) => { let s = ""; const a = "abcdefghijkmnopqrstuvwxyz0123456789"; for (let i = 0; i < (n || 10); i++) s += a[(Math.random() * a.length) | 0]; return s; };
  const fmt = (n) => Math.round(n).toLocaleString("fr-FR");

  // ------------------------------------------------------------------ points
  const NAME_MAX = 1000, NAME_STEP = 200, NAME_MIN = 200, LOC_MAX = 1000;
  const namePoints = (errors) => Math.max(NAME_MIN, NAME_MAX - NAME_STEP * errors);
  function mapDist(a, b, w, h) {
    // distance normalisée par la diagonale de la carte (0 = parfait, 1 = coins opposés)
    const asp = h / w;
    return Math.hypot(a.x - b.x, (a.y - b.y) * asp) / Math.hypot(1, asp);
  }
  // position : plein score à moins de 4 % de la diagonale, puis décroissance douce
  // (≈ 787 à 10 %, ≈ 527 à 20 %, ≈ 353 à 30 %, ≈ 159 à 50 %) ; beaucoup de repères sont placés au niveau du quartier ou de la région
  const LOC_FULL = 0.04, LOC_K = 4;
  const locPoints = (d) => (d <= LOC_FULL ? LOC_MAX : Math.round(LOC_MAX * Math.exp(-LOC_K * (d - LOC_FULL))));

  // ------------------------------------------------------------------ état
  const A = {
    name: LS.get("name", ""),
    color: LS.get("color", COLORS[(Math.random() * COLORS.length) | 0]),
    cfg: Object.assign({ rounds: 5, time: 120, tries: 3, hints: 1, pack: "real" }, LS.get("cfg", {})),
    caps: { db: null, room: null, assets: null, user: null },
    lib: { scenes: {}, maps: {}, games: {} }, libReady: false,
    matcher: null,
    mode: null, nroom: null, code: null, st: null, gen: null, res: [], peers: [],
    R: null, shownReveal: -1, shownFinal: false, sawHost: false, reported: {},
  };

  // couleur choisie avec l'ancienne palette : on prend sa remplaçante
  const OLD_COLORS = ["#c6ff3d", "#ff5d8f", "#3de0ff", "#ffc94d", "#b48bff", "#ff8a3d", "#5dffb0", "#f2f2f2"];
  if (!COLORS.includes(A.color)) { const k = OLD_COLORS.indexOf(String(A.color).toLowerCase()); A.color = COLORS[k >= 0 ? k : 0]; LS.set("color", A.color); }
  // avatar : celui enregistré (les anciennes figurines sont converties), sinon un avatar au hasard ;
  // sa couleur est celle du joueur (repères et traits sur la carte)
  A.avatar = LS.get("avatar", null);
  if (AV) {
    A.avatar = avaOK(A.avatar) ? AV.format(AV.parse(A.avatar)) : AV.random();
    LS.set("avatar", A.avatar);
    A.color = AV.color(A.avatar); LS.set("color", A.color);
  }

  // réglages enregistrés avant l'arrivée du pack « Vrais jeux » : on bascule une fois sur ce pack
  if (LS.get("cfgV", 0) < 2) { A.cfg.pack = "real"; LS.set("cfg", A.cfg); LS.set("cfgV", 2); }

  function rebuildMatcher() {
    const extra = DEMO.GAMES.map((g) => ({ id: g.id, t: g.t, a: g.a, s: g.s, sa: g.sa }));
    for (const [id, g] of Object.entries(A.lib.games)) extra.push({ id, t: g.t, a: g.a || [], s: g.s || null });
    A.matcher = Matcher.createMatcher(GAME_SERIES, extra);
  }
  rebuildMatcher();

  // ------------------------------------------------------------------ utilitaires d'interface
  const SCREENS = ["home", "lobby", "game", "reveal", "final", "library"];
  function show(id) { for (const s of SCREENS) $(s).classList.toggle("hidden", s !== id); A.screen = id; if (id !== "game" && cdT) stopCountdown(); }
  let toastT = null;
  function toast(msg, ms) { const t = $("toast"); t.textContent = msg; t.classList.remove("hidden"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add("hidden"), ms || 2600); }
  function confirmBox(html, yes) {
    return new Promise((res) => {
      $("cfTxt").innerHTML = html; $("cfYes").textContent = yes || "Confirmer";
      $("confirm").classList.remove("hidden");
      const done = (v) => { $("confirm").classList.add("hidden"); $("cfYes").onclick = $("cfNo").onclick = null; res(v); };
      $("cfYes").onclick = () => done(true); $("cfNo").onclick = () => done(false);
    });
  }

  // ------------------------------------------------------------------ pack « Vrais jeux »
  // Données : packs/vrais-jeux.js (versionné). Images : packs/img/ (tools/fetch_packs.py), listées dans dispo.js.
  // Site auto-hébergé (server/server.js) : le choix des images vient du .env, pas des réglages de la page.
  const SERVER = (function () {
    const m = document.querySelector('meta[name="qj-server"]');
    if (!m) return null;
    const images = ["real", "demo", "mix"].includes(m.dataset.images) ? m.dataset.images : "real";
    const jeux = (m.dataset.jeux || "").split(",").filter(Boolean);
    return { images, jeux };
  })();
  // lien de la partie dans la barre d'adresse : gamespotter…/K6P7V sur le site (server.js sert la page pour
  // ce chemin), #K6P7V ailleurs (artefact claude.ai, simple serveur de fichiers : le chemin ne peut pas changer)
  const HOME_PATH = SERVER ? "/" : location.pathname;
  function setLink(code) {
    const url = !code ? HOME_PATH + location.search : SERVER ? "/" + code + location.search : HOME_PATH + location.search + "#" + code;
    try { history.replaceState(null, "", url); } catch (e) { /* ignore */ }
  }
  function codeFromLink() {
    // /K6P7V (site), #K6P7V, et les anciens liens #partie-k6p7v
    const m = (SERVER && /^\/([a-z0-9]{5})$/i.exec(location.pathname)) || /^#(?:partie-)?([a-z0-9]{5})$/i.exec(location.hash);
    return m ? m[1].toUpperCase() : "";
  }
  // inverse du brouillage du serveur (server.js, scramble) : base64 → octets XOR le code → JSON
  function unscramble(code, z) {
    try {
      const bin = atob(z), b = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i) ^ code.charCodeAt(i % code.length);
      return JSON.parse(new TextDecoder().decode(b));
    } catch (e) { return null; }
  }
  const REAL = (function () {
    const P = window.REAL_PACK, D = window.REAL_PACK_DISPO;
    const out = { scenes: {}, maps: {}, games: {} };
    if (!P || !D) return out;
    for (const g of P.games) {
      const m = D.maps[g.key];
      if (!m) continue;
      if (SERVER && SERVER.jeux.length && !SERVER.jeux.includes(g.key)) continue;
      const id = Matcher.slug(g.t);
      out.games[g.key] = Object.assign({ id }, g);
      // site Docker : carte servie sous un code neutre (4e valeur), pour que son adresse ne donne pas le jeu
      const mapUrl = m[3] ? "packs/img/x/" + m[3] + ".jpg" : "packs/img/map-" + g.key + ".jpg";
      out.maps[id] = { url: mapUrl + (SERVER && m[2] ? "?v=" + m[2] : ""), w: m[0], h: m[1] };
    }
    for (const raw of P.scenes) {
      // site Docker : la vue arrive sous un code, ses détails brouillés (z) ; on les décode ici
      const sc = raw.z ? Object.assign({ id: raw.id }, unscramble(raw.id, raw.z)) : raw;
      const g = sc && out.games[sc.game];
      if (!g || !D.scenes[sc.id]) continue;
      const url = (raw.z ? "packs/img/x/" : "packs/img/") + sc.id + ".jpg" + (SERVER && D.scenes[sc.id][2] ? "?v=" + D.scenes[sc.id][2] : "");
      out.scenes[sc.id] = { game: g.id, x: sc.x, y: sc.y, place: sc.place, flat: !!sc.flat, credit: sc.credit || g.credit, source: sc.source || g.source, url };
    }
    return out;
  })();
  if (SERVER) A.cfg.pack = SERVER.images; // imposé par le .env
  // site auto-hébergé : les images se règlent dans le .env, la bibliothèque (propre à claude.ai) disparaît
  if (SERVER) { const lc = document.getElementById("libCard"); if (lc) lc.classList.add("hidden"); }

  // ------------------------------------------------------------------ scènes et cartes
  const demoMapUrl = {};
  function sceneInfo(sid) {
    if (!sid) return null;
    if (sid.startsWith("d-")) { const sc = DEMO.SCENES.find((s) => s.id === sid); return sc ? { sid, kind: "demo", game: sc.game, x: sc.x, y: sc.y, sc } : null; }
    if (sid.startsWith("l-")) { const sc = A.lib.scenes[sid.slice(2)]; return sc ? { sid, kind: "lib", game: sc.game, x: sc.x, y: sc.y, asset: sc.asset, url: "/_blob/" + sc.asset } : null; }
    if (sid.startsWith("r-")) { const sc = REAL.scenes[sid.slice(2)]; return sc ? Object.assign({ sid, kind: "real" }, sc) : null; }
    return null;
  }
  function mapInfo(gameId) {
    if (DEMO.byId[gameId]) {
      if (!demoMapUrl[gameId]) demoMapUrl[gameId] = DEMO.renderMap(gameId).toDataURL("image/jpeg", 0.88);
      return { url: demoMapUrl[gameId], w: DEMO.MAP_W, h: DEMO.MAP_H };
    }
    if (REAL.maps[gameId]) return REAL.maps[gameId];
    const m = A.lib.maps[gameId];
    return m ? { url: "/_blob/" + m.asset, w: m.w, h: m.h } : null;
  }
  function gameTitle(id) { const g = A.matcher.byId[id]; return g ? g.t : (A.lib.games[id] && A.lib.games[id].t) || id; }
  function pool(pack) {
    const d = DEMO.SCENES.map((s) => s.id);
    const l = Object.keys(A.lib.scenes).filter((id) => A.lib.maps[A.lib.scenes[id].game]).map((id) => "l-" + id);
    const r = Object.keys(REAL.scenes).map((id) => "r-" + id);
    return pack === "demo" ? d : pack === "lib" ? l : pack === "real" ? r : d.concat(l, r);
  }
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function buildSeq(cfg) {
    let src;
    if (cfg.pack === "mix") {
      // alterne les sources : vrais jeux, bibliothèque, démo
      const ls = [shuffle(pool("real")), shuffle(pool("lib")), shuffle(pool("demo"))]; src = [];
      while (ls.some((x) => x.length)) for (const x of ls) if (x.length) src.push(x.shift());
    } else src = shuffle(pool(cfg.pack));
    // chaque jeu a la même chance d'être tiré, quel que soit son nombre de vues :
    // on regroupe par jeu (ordre des jeux au hasard) puis on prend une vue de chaque jeu à tour de rôle
    const byGame = new Map();
    for (const sid of src) { const g = sceneInfo(sid).game; if (!byGame.has(g)) byGame.set(g, []); byGame.get(g).push(sid); }
    const groups = shuffle([...byGame.values()]); src = [];
    while (groups.some((x) => x.length)) for (const x of groups) if (x.length) src.push(x.shift());
    const out = [], usedGames = {};
    while (out.length < cfg.rounds && src.length) {
      // évite deux fois le même jeu d'affilée et limite les répétitions d'un même jeu
      const prev = out.length ? sceneInfo(out[out.length - 1]).game : null;
      let k = src.findIndex((s) => { const g = sceneInfo(s).game; return g !== prev && (usedGames[g] || 0) < 2; });
      if (k < 0) k = src.findIndex((s) => sceneInfo(s).game !== prev);
      if (k < 0) k = 0;
      const s = src.splice(k, 1)[0]; const g = sceneInfo(s).game;
      usedGames[g] = (usedGames[g] || 0) + 1; out.push(s);
    }
    return out;
  }

  // ------------------------------------------------------------------ capacités de l'artefact
  // ---- reprise après rechargement (téléphone qui a déchargé la page en arrière-plan) : la partie en cours
  // est retenue pour l'onglet, la page s'y reconnecte seule et retrouve ses réponses de la partie
  const SS = {
    get() { try { const v = JSON.parse(sessionStorage.getItem("qj.room") || "null"); return v && Date.now() - v.t < 6 * 3600 * 1000 ? v : null; } catch (e) { return null; } },
    set(v) { try { sessionStorage.setItem("qj.room", JSON.stringify(Object.assign({ t: Date.now() }, v))); } catch (e) { /* indisponible */ } },
    clear() { try { sessionStorage.removeItem("qj.room"); } catch (e) { /* indisponible */ } },
  };
  function saveSession() { if (A.nroom && A.code) SS.set({ code: A.code, gen: A.gen, res: A.res, j: A.j || 0 }); }
  async function resumeSession() {
    const s = SS.get();
    if (!s || !A.caps.room || A.nroom || !/^[A-Z0-9]{5}$/.test(s.code || "")) return;
    A.resume = s; // réponses à reprendre si la partie est toujours la même (même génération)
    $("joinCode").value = s.code;
    toast("Reconnexion à la partie " + s.code + "…");
    await startJoin(true);
  }
  async function initCaps() {
    let tries = 0;
    while (!(window.claude && window.claude.use) && tries < 15) { await new Promise((r) => setTimeout(r, 200)); tries++; }
    if (window.claude && window.claude.use) {
      const names = ["db", "room", "assets", "user"];
      const got = await Promise.all(names.map((n) => window.claude.use(n).then((x) => x, () => null)));
      names.forEach((n, i) => (A.caps[n] = got[i]));
    }
    $("noRoom").classList.toggle("hidden", !!A.caps.room);
    $("bHost").disabled = !A.caps.room; $("bJoin").disabled = !A.caps.room;
    subLib();
    renderLibInfo();
    resumeSession();
  }

  function subLib() {
    const db = A.caps.db;
    if (!db) { A.libReady = true; return; }
    let got = 0;
    const timer = setTimeout(() => { if (got < 3) { A.libReady = true; renderLibInfo(); } }, 10000);
    for (const col of ["scenes", "maps", "games"]) {
      let first = true;
      db.collection(col).onSnapshot((snap) => {
        const o = {};
        for (const d of snap.docs) if (d.exists) o[d.id] = d.data();
        A.lib[col] = o;
        if (first && !snap.metadata.fromCache) { first = false; got++; if (got === 3) { clearTimeout(timer); A.libReady = true; } }
        if (col === "games") rebuildMatcher();
        onLibChange();
      }, (e) => { console.warn("db", col, e); got++; if (got >= 3) A.libReady = true; onLibChange(); });
    }
  }
  function onLibChange() {
    renderLibInfo();
    if (A.screen === "library") renderLibrary();
    if (A.screen === "lobby") renderSettings();
    if (A.pendingRound != null && A.st && A.st.ph === "play") { const i = A.pendingRound; A.pendingRound = null; startRound(i); }
  }
  function renderLibInfo() {
    const n = Object.keys(A.lib.scenes).length;
    const rn = Object.keys(REAL.scenes).length, rg = Object.keys(REAL.maps).length;
    $("libInfo").textContent = "Pack démo : 6 jeux fictifs, " + DEMO.SCENES.length + " vues · Vrais jeux : " + (rn ? rg + " jeux, " + rn + " vues" : "images non installées") + " · Ma bibliothèque : " + n + " vue" + (n > 1 ? "s" : "") + (A.caps.db ? "" : " (indisponible ici)");
  }

  // ------------------------------------------------------------------ multijoueur (présence dans un salon nommé)
  function players(forScore) {
    const me = { me: true, name: A.name, color: A.color, avatar: A.avatar, r: A.res, host: A.mode === "host" || A.mode === "solo", peer: "me", j: A.j || 0, alive: true, ready: !!A.ready };
    if (!A.nroom) return [me];
    const out = []; let sawMe = false;
    for (const p of A.peers) {
      const pr = p.presence || {};
      if (!pr.n) continue;
      if (p.sameTab) { sawMe = true; out.push(me); continue; }
      if (forScore && pr.g !== A.gen) continue;
      out.push({ me: false, name: String(pr.n).slice(0, 16), color: /^#[0-9a-f]{6}$/i.test(pr.c) ? pr.c : "#ffffff", avatar: avaOK(pr.a) ? pr.a : null, r: Array.isArray(pr.r) ? pr.r : [], host: pr.h === 1, peer: p.peer, j: pr.j | 0, alive: alive(p), active: active(p), ready: !!pr.rd && pr.rd === A.gen });
    }
    if (!sawMe) out.unshift(me);
    return out;
  }
  let pubT = null;
  function publish() {
    if (!A.nroom) return;
    saveSession();
    clearTimeout(pubT);
    pubT = setTimeout(() => {
      const p = { v: 1, n: A.name, c: A.color, a: A.avatar, h: A.mode === "host" ? 1 : 0, g: A.gen, r: A.res.map((x) => x || null), hb: A.hb || 0, j: A.j || 0, vh: document.visibilityState === "hidden" ? 1 : 0, rd: A.ready && A.gen ? A.gen : 0 };
      p.st = A.mode === "host" ? A.st : null;
      if (A.nroom) A.nroom.presence(p).catch((e) => console.warn("presence", e)); // salle quittée entre-temps : rien
    }, 40);
  }
  async function joinRoom(code) {
    const room = A.caps.room;
    if (!room) throw new Error("Multijoueur indisponible");
    const nr = await room.join("qj-" + code.toLowerCase());
    A.nroom = nr; A.code = code; A.peers = nr.peers();
    A.unPeers = nr.onPeers((ch) => { A.peers = ch.peers; onPeers(); }, (e) => toast("Connexion à la partie perdue (" + e.code + ")", 5000));
  }
  // ---- vie des joueurs : chacun publie un signal (hb) toutes les 2 s ; un joueur dont le signal ne change plus
  // depuis 6 s, ou que le serveur voit déconnecté, est considéré absent (téléphone verrouillé, onglet fermé…) ;
  // l'hôte absent est remplacé 2 s plus tard (≈ 8 s au total s'il est figé, ≈ 2 s s'il a fermé la page)
  const HB_MS = 2000, DEAD_MS = 6000, HOST_WAIT_MS = 2000;
  A.seen = {}; A.track = {};
  function refreshSeen() {
    const now = Date.now();
    for (const p of A.peers) {
      if (p.sameTab) { A.myPeer = p.peer; A.mySince = p.since || 0; continue; }
      const pr = p.presence || {}, s = A.seen[p.peer];
      if (!s || s.hb !== pr.hb) A.seen[p.peer] = Object.assign({ hid: 0 }, s, { hb: pr.hb, at: now });
      const t = A.seen[p.peer];
      t.hid = pr.vh ? t.hid || now : 0; // page cachée depuis (téléphone passé sur une autre application)
    }
  }
  function alive(p) {
    if (!p || p.sameTab) return true;
    const s = A.seen[p.peer];
    return p.online !== false && !!s && Date.now() - s.at < DEAD_MS;
  }
  // présent ET disponible : page visible (ou cachée depuis moins de 4 s). Un téléphone peut garder la page
  // en marche un moment après être passé sur une autre application : l'hôte paraît vivant mais ne joue plus.
  const AWAY_MS = 4000;
  function active(p) {
    if (!p || p.sameTab) return true;
    const s = A.seen[p.peer];
    return alive(p) && !(s && s.hid && Date.now() - s.hid > AWAY_MS);
  }
  // joueurs de la partie en cours (même génération), gardés même après leur départ pour le classement final
  function trackPlayers() {
    if (!A.gen) return;
    const here = new Set();
    for (const p of A.peers) {
      if (p.sameTab) continue;
      const pr = p.presence || {};
      here.add(p.peer);
      if (pr.n && pr.g === A.gen) A.track[p.peer] = { peer: p.peer, name: String(pr.n).slice(0, 16), color: pr.c, avatar: avaOK(pr.a) ? pr.a : null, r: Array.isArray(pr.r) ? pr.r : [], j: pr.j | 0, gen: A.gen, absent: false };
    }
    for (const t of Object.values(A.track)) if (t.gen !== A.gen) delete A.track[t.peer]; else if (!here.has(t.peer)) t.absent = true;
  }
  // l'hôte note dans l'état de la partie les joueurs partis (pour le classement final de tout le monde)
  function hostRecordGone() {
    if (A.mode !== "host" || !A.st || A.st.ph === "lobby" || !A.gen) return;
    const gone = (A.st.gone || []).slice();
    // joueurs encore là et qui répondent (un joueur figé, réseau coupé ou téléphone verrouillé, compte comme parti)
    const live = players(true).filter((p) => !p.me && p.alive !== false), liveNames = new Set(live.map((p) => p.name).concat([A.name]));
    const livePeers = new Set(live.map((p) => p.peer));
    let changed = false;
    for (const t of Object.values(A.track)) {
      if (livePeers.has(t.peer) || gone.some((g) => g.peer === t.peer)) continue;
      gone.push({ peer: t.peer, name: t.name, color: t.color, avatar: t.avatar, r: t.r, j: t.j, left: A.st.i });
      changed = true;
    }
    const keep = gone.filter((g) => !livePeers.has(g.peer) && !liveNames.has(g.name)); // revenu : il reprend sa place
    if (keep.length !== gone.length) changed = true;
    if (changed) { A.st = Object.assign({}, A.st, { gone: keep }); publish(); }
  }
  // un seul hôte : le plus récent mandat (term) l'emporte ; s'il n'y a plus d'hôte vivant, le joueur arrivé le plus tôt
  // parmi ceux qui restent le devient, sans rien demander
  // page arrêtée un moment (téléphone figé, onglet suspendu) : ce qu'on sait des autres date d'avant l'arrêt ;
  // on leur laisse un nouveau délai au lieu de les croire tous partis (et de prendre la place de l'hôte)
  function freshenSeen(now) {
    for (const s of Object.values(A.seen)) { s.at = now; if (s.hid) s.hid = now; }
    A.hostLostAt = 0;
  }
  function checkHost() {
    if (!A.nroom || (A.mode !== "host" && A.mode !== "guest")) return;
    const now = Date.now();
    if (A.lastCheck && now - A.lastCheck > 2500) freshenSeen(now);
    A.lastCheck = now;
    // pendant une manche ou ses résultats, un hôte passé sur une autre application bloque la partie : il est
    // remplacé ; dans le salon (partage du code par message…) ou au classement final, seul son départ compte
    const busy = !!A.st && (A.st.ph === "play" || A.st.ph === "rev");
    const avail = (p) => (busy ? active(p) : alive(p));
    const hosts = A.peers.filter((p) => !p.sameTab && p.presence && p.presence.h === 1 && p.presence.st && avail(p));
    const rank = (p) => [-((p.presence.st && p.presence.st.term) || 0), p.peer];
    hosts.sort((a, b) => { const x = rank(a), y = rank(b); return x[0] - y[0] || (x[1] < y[1] ? -1 : 1); });
    const best = hosts[0];
    if (A.mode === "host") {
      const mine = (A.st && A.st.term) || 0, theirs = best ? best.presence.st.term || 0 : -1;
      if (best && (theirs > mine || (theirs === mine && A.myPeer && best.peer < A.myPeer))) {
        A.mode = "guest"; A._stjs = null; A.hostPeer = best.peer; A.sawHost = true;
        applyState(best.presence.st); publish();
        toast((best.presence.n || "Un joueur") + " est l'hôte de la partie.");
      }
      return;
    }
    if (best) {
      if (A.hostPeer && A.hostPeer !== best.peer) {
        const old = A.peers.find((p) => p.peer === A.hostPeer);
        toast((old && avail(old) ? "" : "L'hôte a quitté la partie : ") + (best.presence.n || "un joueur") + " est maintenant l'hôte.", 5000);
      }
      A.hostPeer = best.peer; A.sawHost = true; A.hostLostAt = 0;
      applyState(best.presence.st);
      return;
    }
    if (!A.sawHost || !A.st) return;
    if (!A.hostLostAt) { A.hostLostAt = now; toast("L'hôte a quitté la partie : un autre joueur prend le relais…", 5000); }
    if (now - A.hostLostAt < HOST_WAIT_MS) return;
    if (document.visibilityState === "hidden") return; // pas de relève prise par une page cachée
    const cands = A.peers.filter((p) => (p.sameTab || (avail(p) && p.presence && p.presence.n && p.presence.g === A.gen)))
      .map((p) => ({ peer: p.peer, me: !!p.sameTab, since: p.since || 0 }))
      .sort((a, b) => (a.since - b.since) || (a.peer < b.peer ? -1 : 1));
    if (cands.length && cands[0].me) becomeHost();
  }
  function becomeHost() {
    A.mode = "host"; A.hostLostAt = 0; A.hostPeer = null;
    A.st = Object.assign({}, A.st, { term: ((A.st && A.st.term) || 0) + 1 });
    // la partie reprend où elle en était : manche en cours, résultats affichés ou classement
    if (A.st.ph === "rev") A.shownReveal = -1;
    if (A.st.ph === "end") A.shownFinal = false;
    // invité qui attendait la partie suivante dans le salon : il la prépare lui-même, avec le même code
    if (A.st.ph === "end" && A.screen === "lobby") { hostReplay(); toast("L'hôte a quitté la partie : tu es maintenant l'hôte.", 5000); return; }
    hostRecordGone(); publish(); route();
    if (A.screen === "lobby") showLobby();
    toast("L'hôte a quitté la partie : tu es maintenant l'hôte.", 5000);
    renderChips();
  }
  function onPeers() {
    refreshSeen(); trackPlayers();
    checkHost();
    if (A.mode === "host") { hostRecordGone(); hostCheck(); hostReadyCheck(); }
    renderPlayers();
    if (A.screen === "reveal") renderRevealTable();
    if (A.screen === "final") renderFinal();
  }
  function applyState(st) {
    if (!st || typeof st !== "object" || !Array.isArray(st.seq) || !st.cfg) return;
    const js = JSON.stringify(st);
    if (A._stjs === js) return;
    A._stjs = js;
    if (st.gen !== A.gen) {
      A.gen = st.gen; A.res = []; A.R = null; A.shownReveal = -1; A.shownFinal = false; A.ready = false;
      A.j = st.ph === "lobby" ? 0 : st.ph === "play" ? st.i : st.ph === "rev" ? st.i + 1 : st.seq.length; // arrivé en cours de partie ?
      // page rechargée en pleine partie : on reprend ses réponses et sa manche d'arrivée
      if (A.resume && A.resume.gen === st.gen) { A.res = Array.isArray(A.resume.res) ? A.resume.res.slice() : []; A.j = A.resume.j | 0; }
      A.resume = null;
      publish();
    }
    A.st = st;
    route();
  }
  function route() {
    const st = A.st;
    if (!st) return;
    if (st.ph === "lobby") showLobby();
    else if (st.ph === "play") { if (!A.R || A.R.i !== st.i) startRound(st.i); else if (A.screen !== "game") show("game"); }
    else if (st.ph === "rev") { if (A.shownReveal !== st.i) showReveal(st.i); }
    else if (st.ph === "end") { if (!A.shownFinal) showFinal(); }
  }

  // ------------------------------------------------------------------ hôte (ou partie solo)
  const isHost = () => A.mode === "host" || A.mode === "solo";
  function newDeadline(cfg) { return cfg.time ? Date.now() + cfg.time * 1000 + 1500 : 0; }
  function hostStart() {
    const cfg = Object.assign({}, A.cfg);
    const seq = buildSeq(cfg);
    if (!seq.length) { toast("Aucune vue disponible pour ce choix d'images."); return; }
    cfg.rounds = seq.length;
    A.ready = false;
    A.gen = rid(8); A.res = []; A.R = null; A.shownReveal = -1; A.shownFinal = false; A.j = 0; A.track = {};
    // à plusieurs : décompte 3, 2, 1 chez tout le monde avant la 1re manche (t0 : départ, le chrono attend la fin)
    const cd = A.mode === "host" ? CD_MS : 0;
    A.st = { gen: A.gen, ph: "play", cfg, seq, i: 0, dl: newDeadline(cfg) + (cfg.time ? cd : 0), t0: cd ? Date.now() : 0, term: (A.st && A.st.term) || 0, gone: [] };
    publish(); route();
  }
  // décompte affiché par chacun dès qu'il reçoit le départ (pas d'horloge commune : les écarts d'heure entre
  // appareils dépassent souvent l'écart de réception) ; la vue se charge derrière pendant ce temps
  const CD_MS = 3000;
  let cdT = null;
  // calé sur l'heure réelle (pas sur le nombre de tours de minuterie, ralentie quand l'appareil est chargé ou la
  // page en arrière-plan) : il disparaît au bout de 3 s quoi qu'il arrive, et dès qu'on quitte l'écran de jeu
  function countdown() {
    const el = $("cd"), num = $("cdNum"), t0 = Date.now();
    let shown = 0;
    const step = () => {
      const n = Math.ceil((CD_MS - (Date.now() - t0)) / 1000);
      if (n <= 0 || A.screen !== "game") { stopCountdown(); return; }
      if (n !== shown) { shown = n; num.textContent = n; num.classList.remove("pop"); void num.offsetWidth; num.classList.add("pop"); }
    };
    clearInterval(cdT);
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    el.classList.remove("hidden"); step(); cdT = setInterval(step, 100);
  }
  function stopCountdown() { clearInterval(cdT); cdT = null; $("cd").classList.add("hidden"); }
  function maybeCountdown(i) {
    const st = A.st;
    if (i !== 0 || !A.nroom || !st.t0 || A.cdGen === A.gen || A.res[0]) return;
    A.cdGen = A.gen;
    // arrivé (ou page rechargée) bien après le départ : pas de décompte
    if (Math.abs(Date.now() - st.t0) > 2 * CD_MS) return;
    countdown();
  }
  function hostCheck() {
    if (!isHost() || !A.st || A.st.ph !== "play") return;
    const i = A.st.i, ps = players(true);
    const live = ps.filter((p) => p.active !== false);
    const allDone = live.length > 0 && live.every((p) => p.r[i] && p.r[i][0] >= 2);
    const timeUp = A.st.dl && Date.now() > A.st.dl + 1200;
    if (allDone || timeUp) { A.st = Object.assign({}, A.st, { ph: "rev" }); publish(); route(); }
  }
  // « Terminer la manche maintenant » : en temps illimité seulement (sinon, on attend la fin du temps)
  const canForceEnd = () => !!A.st && !A.st.cfg.time;
  function hostForceEnd() { if (isHost() && A.st && A.st.ph === "play" && canForceEnd()) { A.st = Object.assign({}, A.st, { ph: "rev" }); publish(); route(); } }
  function hostNext() {
    if (!isHost() || !A.st) return;
    if (A.st.i + 1 < A.st.seq.length) A.st = Object.assign({}, A.st, { ph: "play", i: A.st.i + 1, dl: newDeadline(A.st.cfg) });
    else A.st = Object.assign({}, A.st, { ph: "end" });
    publish(); route();
  }
  function hostReplay() {
    A.gen = rid(8); A.res = []; A.R = null; A.shownReveal = -1; A.shownFinal = false; A.j = 0; A.track = {}; A.ready = false;
    A.st = { gen: A.gen, ph: "lobby", cfg: Object.assign({}, A.cfg), seq: [], i: -1, dl: 0, term: (A.st && A.st.term) || 0 };
    publish(); route();
  }

  // ------------------------------------------------------------------ accueil
  function renderHome() {
    $("pseudo").value = A.name;
    renderAvatar();
  }
  // éditeur d'avatar : aperçu (agrandi pendant l'édition), « au hasard », rangées à flèches pour les formes
  // (tenue, yeux, sourcils, bouche, accessoire, fond) et pastilles pour les couleurs (couleur, peau, cheveux)
  function setAvatar(spec) {
    A.avatar = spec; A.color = AV.color(spec);
    LS.set("avatar", spec); LS.set("color", A.color);
    renderAvatar(); publish();
  }
  const ICON_L = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 l-7 7 l7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_R = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5 l7 7 l-7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function avaRows(o) {
    const u = AV.uses(o.t);
    return [
      { k: "t", lab: "Tenue", list: AV.TENUES, name: (x) => x.nom },
      { k: "c", lab: "Couleur", sw: AV.COULEURS },
      { k: "s", lab: "Peau", sw: AV.PEAUX, hide: !u.s },
      { k: "h", lab: "Cheveux", sw: AV.CHEVEUX.map((x) => x.c), names: AV.CHEVEUX.map((x) => x.nom), hide: !u.h },
      { k: "e", lab: "Yeux", list: AV.YEUX, name: (x) => x.nom },
      { k: "br", lab: "Sourcils", list: AV.SOURCILS, name: (x) => x.nom, hide: !u.br },
      { k: "b", lab: "Bouche", list: AV.BOUCHES, name: (x) => x.nom, hide: !u.b },
      { k: "a", lab: "Accessoire", list: AV.ACCESSOIRES, name: (x) => x.nom, hide: !u.a },
      { k: "f", lab: "Fond", list: AV.FONDS, name: (x) => x.nom },
    ];
  }
  function stepAvatar(k, d) {
    const o = AV.parse(A.avatar), row = avaRows(o).find((r) => r.k === k);
    const n = row.list.length, cur = k === "t" ? row.list.findIndex((x) => x.id === o.t) : o[k];
    const next = (cur + d + n) % n;
    o[k] = k === "t" ? row.list[next].id : next;
    setAvatar(AV.format(o));
  }
  function renderAvatar() {
    if (!AV || !avaOK(A.avatar)) return;
    const o = AV.parse(A.avatar), col = AV.COULEURS[o.c];
    $("avaPrev").innerHTML = AV.svg(A.avatar);
    $("avaPrev").style.setProperty("--c", col);
    if ($("avaOpts").classList.contains("hidden")) return;
    const box = $("avaRows"), focused = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.f;
    box.innerHTML = "";
    for (const r of avaRows(o)) {
      if (r.hide) continue;
      const line = document.createElement("div"); line.className = "ava-line";
      line.innerHTML = '<span class="ava-lab">' + r.lab + "</span>";
      if (r.list) {
        const i = r.k === "t" ? r.list.findIndex((x) => x.id === o.t) : o[r.k];
        const sel = document.createElement("div"); sel.className = "ava-sel";
        sel.innerHTML = '<button type="button" class="ava-arr" data-f="' + r.k + '-1" aria-label="' + r.lab + ' : précédent">' + ICON_L + "</button>"
          + '<span class="ava-val" aria-live="polite">' + esc(r.name(r.list[i])) + "<small>" + (i + 1) + " / " + r.list.length + "</small></span>"
          + '<button type="button" class="ava-arr" data-f="' + r.k + '1" aria-label="' + r.lab + ' : suivant">' + ICON_R + "</button>";
        const [bl, br] = sel.querySelectorAll("button");
        bl.onclick = () => stepAvatar(r.k, -1); br.onclick = () => stepAvatar(r.k, 1);
        line.append(sel);
      } else {
        const ch = document.createElement("div"); ch.className = "ava-ch";
        r.sw.forEach((c, i) => {
          const b = document.createElement("button"); b.type = "button";
          const on = o[r.k] === i, label = r.names ? r.names[i] : r.lab + " " + (i + 1);
          b.className = "ava-opt sw" + (on ? " on" : "") + (c ? "" : " orig"); b.dataset.f = r.k + "s" + i;
          b.setAttribute("aria-pressed", on ? "true" : "false"); b.title = label; b.setAttribute("aria-label", r.lab + " : " + label);
          if (c) b.style.background = c;
          b.onclick = () => { o[r.k] = i; setAvatar(AV.format(o)); };
          ch.append(b);
        });
        line.append(ch);
      }
      box.append(line);
    }
    // la page est reconstruite à chaque choix : on garde le focus sur la même commande (clavier)
    if (focused) { const el = box.querySelector('[data-f="' + focused + '"]'); if (el) el.focus(); }
  }
  function openAvatarEditor(open) {
    $("avaOpts").classList.toggle("hidden", !open);
    $("avaPrev").closest(".ava-me").classList.toggle("editing", open);
    $("bAvaEdit").classList.toggle("on", open); $("bAvaEdit").setAttribute("aria-expanded", open ? "true" : "false");
    if (open) A.avaBefore = A.avatar;
    renderAvatar();
  }
  function ensureName() {
    let n = $("pseudo").value.trim().replace(/\s+/g, " ").slice(0, 16);
    if (!n) n = "Joueur " + (10 + ((Math.random() * 89) | 0));
    A.name = n; LS.set("name", n); $("pseudo").value = n;
  }
  function genCode() { let s = ""; for (let i = 0; i < 5; i++) s += CODE_ABC[(Math.random() * CODE_ABC.length) | 0]; return s; }

  async function startSolo() {
    ensureName(); SS.clear(); A.resume = null; await leaveRoom();
    A.mode = "solo"; A.gen = rid(8); A.res = [];
    A.st = { gen: A.gen, ph: "lobby", cfg: Object.assign({}, A.cfg), seq: [], i: -1, dl: 0 };
    route();
  }
  async function startHost() {
    ensureName(); await leaveRoom();
    const code = genCode();
    try { await joinRoom(code); } catch (e) { toast("Impossible de créer la partie : " + (e.code || e.message), 5000); return; }
    A.mode = "host"; A.gen = rid(8); A.res = []; A.ready = false;
    A.st = { gen: A.gen, ph: "lobby", cfg: Object.assign({}, A.cfg), seq: [], i: -1, dl: 0 };
    setLink(code);
    publish(); route();
  }
  // rejoindre : on se connecte à la salle sans s'y montrer, on vérifie qu'un hôte y tient une partie, et
  // seulement alors on y entre ; sinon on repart et on le dit. Le bouton montre le chargement entre-temps.
  function joinError(msg) { $("joinErr").textContent = msg || ""; $("joinErr").classList.toggle("hidden", !msg); }
  function joinBusy(on) {
    $("bJoin").disabled = $("joinCode").disabled = $("bHost").disabled = on;
    // roue seule, à largeur constante (le champ du code ne bouge pas) ; « Connexion… » pour les lecteurs d'écran
    const bj = $("bJoin");
    bj.style.minWidth = on ? bj.offsetWidth + "px" : "";
    bj.innerHTML = on ? '<span class="spin"></span><span class="sr">Connexion…</span>' : "Rejoindre";
    $("bJoin").setAttribute("aria-busy", on ? "true" : "false");
  }
  const hostIn = (peers) => peers.some((p) => !p.sameTab && p.presence && p.presence.h === 1 && p.presence.st);
  async function waitHost() {
    // salle vide : inutile d'attendre longtemps ; salle occupée : on laisse à l'hôte le temps d'apparaître
    const t0 = Date.now();
    while (A.nroom) {
      const ps = A.nroom.peers();
      if (hostIn(ps)) return true;
      if (Date.now() - t0 > (ps.some((p) => !p.sameTab) ? 5000 : 1500)) return false;
      await new Promise((r) => setTimeout(r, 150));
    }
    return false;
  }
  let joining = false;
  async function startJoin(resume) {
    if (joining) return;
    ensureName(); joinError("");
    const code = $("joinCode").value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length !== 5) { joinError("Le code fait 5 caractères."); return; }
    joining = true; joinBusy(true);
    let ok = false, err = null;
    try {
      await leaveRoom();
      A.mode = null; A.st = null;
      await joinRoom(code);
      ok = await waitHost();
    } catch (e) { err = e; }
    joining = false; joinBusy(false);
    if (!ok) {
      await leaveRoom();
      if (resume === true) { SS.clear(); A.resume = null; }
      joinError(err ? "Impossible de rejoindre : " + (err.code || err.message)
        : resume === true ? "La partie " + code + " n'existe plus." : "Aucune partie en cours avec le code " + code + ". Vérifie le code auprès de l'hôte.");
      return;
    }
    A.mode = "guest"; A.st = null; A.gen = null; A.res = []; A.sawHost = false; A._stjs = null; A.ready = false;
    setLink(code);
    publish();
    showLobby();
    onPeers();
  }
  async function leaveRoom() {
    if (A.unPeers) { try { A.unPeers(); } catch (e) { /* ignore */ } A.unPeers = null; }
    if (A.nroom) { const r = A.nroom; A.nroom = null; try { await r.leave(); } catch (e) { /* ignore */ } }
    A.peers = []; A.code = null;
  }
  async function goHome() {
    SS.clear(); A.resume = null; stopCountdown();
    await leaveRoom();
    A.mode = null; A.st = null; A.R = null; A._stjs = null;
    setLink(null);
    renderHome(); show("home");
  }

  // ------------------------------------------------------------------ salon / réglages
  function curCfg() { return A.mode === "guest" ? (A.st && A.st.cfg) || A.cfg : A.cfg; }
  // pseudo modifiable depuis le salon : crayon à côté de son nom → zone de texte et bouton Valider
  const ICON_PEN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20 l1.2-4.6 L15.6 5 a2.1 2.1 0 0 1 3 0 l.4.4 a2.1 2.1 0 0 1 0 3 L8.6 18.8 Z M13.8 6.8 l3.4 3.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  const ICON_OK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 l4.5 4.5 L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  function editName(on) {
    A.editName = on;
    renderPlayers();
    if (on) { const i = $("plName"); i.focus(); i.select(); }
  }
  function saveName() {
    const n = $("plName").value.trim().replace(/\s+/g, " ").slice(0, 16);
    if (n && n !== A.name) { A.name = n; LS.set("name", n); $("pseudo").value = n; publish(); }
    editName(false);
  }
  function showLobby() {
    show("lobby");
    A.editName = false;
    const multi = A.mode === "host" || A.mode === "guest";
    $("codeCard").classList.toggle("hidden", !multi);
    $("playersCard").querySelector("h2").firstChild.textContent = multi ? "Joueurs " : "Joueur ";
    $("nPlayers").classList.toggle("hidden", !multi);
    $("playersCard").classList.remove("hidden");
    $("codeBox").textContent = A.code || "-----";
    $("bStart").classList.toggle("hidden", A.mode === "guest");
    $("waitHost").classList.toggle("hidden", A.mode !== "guest");
    renderReady();
    $("waitHostTxt").textContent = A.st && A.st.ph === "end" ? "Partie terminée : en attente que l'hôte relance une partie…" : "En attente du lancement par l'hôte…";
    $("settings").classList.toggle("locked", A.mode === "guest");
    renderSettings(); renderPlayers();
  }
  function renderSettings() {
    const cfg = curCfg();
    const avail = { demo: true, lib: pool("lib").length > 0, real: pool("real").length > 0 };
    avail.mix = avail.lib || avail.real;
    if (A.mode !== "guest" && !avail[cfg.pack]) { cfg.pack = "demo"; }
    $("packSetting").classList.toggle("hidden", !!SERVER);
    const max = Math.max(1, Math.min(15, pool(cfg.pack).length));
    if (A.mode !== "guest" && cfg.rounds > max) cfg.rounds = max;
    $("sRounds").textContent = cfg.rounds;
    $("poolInfo").textContent = pool(cfg.pack).length + " vues disponibles";
    for (const seg of document.querySelectorAll("#settings .seg")) {
      const k = seg.dataset.k;
      for (const b of seg.children) {
        b.classList.toggle("on", String(cfg[k]) === b.dataset.v);
        if (k === "pack") b.disabled = !avail[b.dataset.v];
      }
    }
  }
  function setCfg(k, v) {
    if (A.mode === "guest") return;
    if (k === "pack" && SERVER) return; // imposé par le .env du serveur
    A.cfg[k] = v; LS.set("cfg", A.cfg);
    renderSettings();
    if (A.st && A.st.ph === "lobby") { A.st = Object.assign({}, A.st, { cfg: Object.assign({}, A.cfg) }); publish(); }
  }
  function renderPlayers() {
    const ps = players(false);
    if (A.screen === "lobby" && !(A.editName && $("plName"))) {
      $("nPlayers").textContent = "(" + ps.length + ")";
      $("playersList").innerHTML = ps.map((p) => {
        const tags = (p.alive === false ? '<span class="tag bad">Absent</span>' : "") + (p.ready && readyLobby() ? '<span class="tag good">Prêt</span>' : "") + (p.host && A.nroom ? '<span class="tag acc">Hôte</span>' : "") + (p.me ? '<span class="tag">Toi</span>' : "");
        if (p.me && A.editName) return '<form class="pl me" id="plNameForm">' + ava(p, 30) + '<input type="text" id="plName" class="grow" maxlength="16" value="' + esc(p.name) + '" autocomplete="off" enterkeyhint="done" aria-label="Ton pseudo">'
          + '<button class="btn icon sm on" type="submit" title="Valider" aria-label="Valider le pseudo">' + ICON_OK + "</button></form>";
        return '<div class="pl' + (p.me ? " me" : "") + '">' + ava(p, 30) + '<b class="grow">' + esc(p.name) + "</b>"
          + (p.me ? '<button class="btn icon sm" type="button" id="bNameEdit" title="Modifier mon pseudo" aria-label="Modifier mon pseudo">' + ICON_PEN + "</button>" : "") + tags + "</div>";
      }).join("");
      if ($("bNameEdit")) $("bNameEdit").onclick = () => editName(true);
      if ($("plNameForm")) {
        $("plNameForm").onsubmit = (e) => { e.preventDefault(); saveName(); };
        $("plName").onkeydown = (e) => { if (e.key === "Escape") editName(false); };
      }
    }
    if (A.screen === "lobby") renderReady();
    if (A.screen === "game") renderChips();
    // rôle changé pendant les résultats (relève) : « Manche suivante » chez le nouvel hôte seulement
    if (A.screen === "reveal") { $("bNext").classList.toggle("hidden", !isHost()); $("rvWait").classList.toggle("hidden", isHost()); }
  }
  // ---- salon à plusieurs : chacun clique sur « Je suis prêt » ; la partie démarre (décompte 3, 2, 1) quand
  // tous les joueurs présents sont prêts (un joueur absent, connexion coupée, ne bloque pas).
  // Prêt = présence rd égale à la génération du salon : un nouveau salon (Rejouer) remet tout le monde à zéro.
  const readyLobby = () => !!A.nroom && !!A.st && A.st.ph === "lobby" && (A.mode === "host" || A.mode === "guest");
  function readyCount() {
    const ps = players(false).filter((p) => p.alive !== false);
    return { n: ps.filter((p) => p.ready).length, all: ps.length };
  }
  function renderReady() {
    const on = readyLobby();
    const b = $("bReady"), info = $("readyInfo");
    b.classList.toggle("hidden", !on); info.classList.toggle("hidden", !on);
    // invité : bouton Prêt au-dessus des réglages (qu'il ne peut que consulter) ; hôte : en bas, près de « Lancer »
    const setCard = $("settings").closest(".card"), anchor = A.mode === "guest" ? setCard : $("waitHost");
    if (b.nextElementSibling !== anchor) { anchor.before(info); anchor.before(b); }
    // « Lancer la partie » : en solo seulement ; à plusieurs, on part quand tout le monde est prêt
    $("bStart").classList.toggle("hidden", on || A.mode === "guest");
    if (!on) return;
    const { n, all } = readyCount();
    b.textContent = A.ready ? "Prêt ! (annuler)" : "Je suis prêt";
    b.classList.toggle("pri", !A.ready); b.classList.toggle("sea", !!A.ready);
    b.setAttribute("aria-pressed", A.ready ? "true" : "false");
    info.innerHTML = "Prêts : <b>" + n + "/" + all + "</b> · la partie démarre quand tout le monde est prêt.";
    $("waitHost").classList.add("hidden");
  }
  function toggleReady() {
    if (!readyLobby()) return;
    A.ready = !A.ready;
    publish(); renderPlayers();
    hostReadyCheck();
  }
  function hostReadyCheck() {
    if (A.mode !== "host" || !readyLobby()) return;
    const { n, all } = readyCount();
    if (all > 0 && n === all) hostStart();
  }

  // ------------------------------------------------------------------ manche
  let pano = null, pick = null, rvMap = null;
  function startRound(i) {
    const st = A.st;
    const sid = st.seq[i];
    const info = sceneInfo(sid);
    show("game");
    hidePanels();
    if (!info) {
      if (!A.libReady) { A.pendingRound = i; $("panoLoad").classList.remove("hidden"); return; }
      // vue introuvable (supprimée ?) : on passe
      A.R = { i, sid, info: null, game: null, errors: 0, phase: "done" };
      A.res[i] = [3, 0, 0, 0, -1, -1]; publish();
      showWait("Vue indisponible", "Cette vue n'a pas pu être chargée. On attend la manche suivante.", "");
      return;
    }
    const g = A.matcher.byId[info.game] || { id: info.game, t: gameTitle(info.game), n: [], tok: [] };
    A.R = { i, sid, info, game: g, errors: 0, phase: "name", pin: null, namePts: 0 };
    if (!A.res[i] || A.res[i][0] < 2) A.res[i] = null;
    maybeCountdown(i);
    if (!pano) pano = new Pano($("pano"));
    if (pano.failed) toast("WebGL est désactivé sur cet appareil : la vue 360° ne peut pas s'afficher.", 6000);
    $("panoLoad").classList.remove("hidden");
    const done = () => $("panoLoad").classList.add("hidden");
    if (info.kind === "demo") {
      setTimeout(() => { if (A.R && A.R.sid === sid) { pano.setImage(DEMO.renderPano(info.sc)); done(); } }, 30);
    } else {
      const img = new Image();
      img.onload = () => { if (A.R && A.R.sid === sid) { pano.setImage(img, { flat: !!info.flat }); done(); } };
      img.onerror = () => { $("panoLoad").innerHTML = "Image introuvable — passe la manche."; };
      img.src = info.url;
    }
    // préchargement de la manche suivante
    const nx = sceneInfo(st.seq[i + 1]);
    if (nx && nx.url) { const im = new Image(); im.src = nx.url; }
    const nm = nx && mapInfo(nx.game);
    if (nm && nm.url && !nm.url.startsWith("data:")) { const im2 = new Image(); im2.src = nm.url; }
    // déjà terminé (rechargement) ?
    if (A.res[i] && A.res[i][0] >= 2) { A.R.phase = "done"; showWait("Manche terminée", "En attente des autres joueurs…", fmt(A.res[i][1] + A.res[i][2]) + " pts"); }
    else showNamePanel();
    renderHud(); renderChips();
  }
  function hidePanels() { for (const p of ["pName", "pMap", "pWait"]) $(p).classList.add("hidden"); $("pMap").classList.remove("big"); $("bBig").textContent = "Agrandir"; setMapMini(false); }
  // carte réduite (téléphone surtout) : on regarde l'image en entier, la carte et le repère restent tels quels
  function setMapMini(on) {
    $("pMap").classList.toggle("mini", on);
    const lbl = on ? "Afficher la carte" : "Réduire la carte pour voir l'image";
    $("bMini").title = lbl; $("bMini").setAttribute("aria-label", lbl); $("bMini").setAttribute("aria-expanded", on ? "false" : "true");
    if (on) { $("pMap").classList.remove("big"); $("bBig").textContent = "Agrandir"; }
  }
  function showNamePanel() {
    hidePanels(); $("pName").classList.remove("hidden");
    $("gInput").value = ""; setFb(); $("cands").innerHTML = ""; $("sugg").classList.add("hidden");
    renderTries();
  }
  function renderTries() {
    const t = A.st.cfg.tries, R = A.R;
    $("tries").innerHTML = t ? Array.from({ length: t }, (_, k) => "<i class='" + (k < R.errors ? "used" : "") + "'></i>").join("") : "<span class='mut small'>essais illimités" + (R.errors ? " · " + R.errors + " erreur" + (R.errors > 1 ? "s" : "") : "") + "</span>";
  }
  function setFb(kind, html) { const f = $("fb"); f.className = "fb" + (kind ? " show " + kind : ""); f.innerHTML = html || ""; }

  function submitGuess(text) {
    const R = A.R;
    if (!R || R.phase !== "name") return;
    $("sugg").classList.add("hidden");
    const ev = A.matcher.evaluate(text, R.game.id);
    $("cands").innerHTML = "";
    if (ev.k === "empty") return;
    if (ev.k === "vague") { setFb("warn", "Trop vague : tape le titre d'un jeu."); return; }
    if (ev.k === "precision") {
      setFb("warn", "<b>Précise !</b> " + (ev.series ? "Il existe plusieurs jeux <i>" + esc(ev.series) + "</i>." : "« " + esc(text.trim()) + " » ne suffit pas.") + " Donne le titre complet.");
      if (A.st.cfg.hints && ev.candidates) {
        $("cands").innerHTML = ev.candidates.map((c) => "<button type='button'>" + esc(c) + "</button>").join("");
        for (const b of $("cands").children) b.onclick = () => submitGuess(b.textContent);
      }
      $("gInput").focus();
      return;
    }
    if (ev.k === "wrong") {
      R.errors++;
      $("gInput").value = "";
      const left = A.st.cfg.tries ? A.st.cfg.tries - R.errors : null;
      setFb("bad", "Raté" + (ev.game ? " : ce n'est pas <b>" + esc(ev.game.t) + "</b>" : "") + "." + (left != null ? " " + (left > 0 ? left + " essai" + (left > 1 ? "s" : "") + " restant" + (left > 1 ? "s" : "") + "." : "") : ""));
      renderTries();
      if (left != null && left <= 0) failName("Plus d'essais !");
      return;
    }
    if (ev.k === "ok") nameFound(ev.typo);
  }
  function nameFound(typo) {
    const R = A.R;
    R.phase = "map"; R.namePts = namePoints(R.errors);
    A.res[R.i] = [1, R.namePts, 0, R.errors, -1, -1]; publish();
    hidePanels(); $("pMap").classList.remove("hidden");
    $("foundTxt").innerHTML = "✓ <b>" + esc(R.game.t) + "</b>" + (typo ? " <span class='mut'>(faute de frappe acceptée)</span>" : "") + " · +" + fmt(R.namePts) + " — où a été prise cette vue ?";
    $("bPin").disabled = true;
    const m = mapInfo(R.info.game);
    if (!pick) pick = new MapView($("mapPick"), { onTap: (x, y) => { if (!A.R || A.R.phase !== "map") return; A.R.pin = { x, y }; pick.setPins([{ x, y, color: A.color }]); $("bBig").blur(); $("bPin").disabled = false; } });
    if (!m) { toast("Carte introuvable pour ce jeu"); finishLoc(0); return; }
    requestAnimationFrame(() => { pick.setImage(m.url, m.w, m.h); pick.setPins([]); });
    renderChips(); renderHud();
  }
  function finishLoc(locPts) {
    const R = A.R, p = R.pin || { x: -1, y: -1 };
    A.res[R.i] = [2, R.namePts, locPts, R.errors, Math.round(p.x * 1e4) / 1e4, Math.round(p.y * 1e4) / 1e4];
    R.phase = "done"; publish();
    showWait(locPts >= 3500 ? "Dans le mille !" : locPts >= 1500 ? "Bien joué !" : "Jeu trouvé !", "Nom : " + fmt(R.namePts) + " · Position : " + fmt(locPts), "+" + fmt(R.namePts + locPts));
    hostCheck();
  }
  function validatePin() {
    const R = A.R;
    if (!R || R.phase !== "map" || !R.pin) return;
    const m = mapInfo(R.info.game);
    finishLoc(locPoints(mapDist(R.pin, R.info, m.w, m.h)));
  }
  function failName(title) {
    const R = A.R;
    if (!R || R.phase === "done") return;
    R.phase = "done"; A.res[R.i] = [3, 0, 0, R.errors, -1, -1]; publish();
    showWait(title || "Manche passée", "La réponse sera révélée à la fin de la manche.", "0");
    hostCheck();
  }
  function showWait(title, txt, pts) {
    hidePanels(); $("pWait").classList.remove("hidden");
    $("waitTitle").textContent = title; $("waitPts").textContent = pts ? pts + (/\d$/.test(pts) ? " pts" : "") : "";
    $("waitTxt").innerHTML = esc(txt); $("waitTxt").dataset.base = txt;
    renderChips(); renderHud();
  }
  function timeOut() {
    const R = A.R;
    if (!R || R.phase === "done") return;
    if (R.phase === "map") { if (R.pin) validatePin(); else finishLoc(0); $("waitTitle").textContent = "Temps écoulé !"; }
    else failName("Temps écoulé !");
  }

  function totalOf(r) { let t = 0; for (const x of r || []) if (x) t += (x[1] || 0) + (x[2] || 0); return t; }
  function renderHud() {
    if (!A.st) return;
    $("hRound").textContent = (A.st.i + 1) + "/" + A.st.seq.length;
    $("hScore").textContent = fmt(totalOf(A.res));
    tickTimer();
  }
  function tickTimer() {
    if (!A.st || A.st.ph !== "play" || A.screen !== "game") return;
    const dl = A.st.dl;
    if (!dl) { $("hTime").textContent = "∞"; $("hTimer").classList.remove("low"); $("hBar").classList.add("hidden"); $("hVig").classList.remove("on"); return; }
    const left = Math.max(0, Math.ceil((dl - Date.now()) / 1000));
    const shown = Math.min(left, A.st.cfg.time);
    $("hTime").textContent = Math.floor(shown / 60) + ":" + String(shown % 60).padStart(2, "0");
    $("hTimer").classList.toggle("low", shown <= 10);
    // barre de temps restant, et bords rouges qui pulsent dans les 10 dernières secondes (si la manche est en cours pour moi)
    const frac = Math.max(0, Math.min(1, (dl - Date.now()) / (A.st.cfg.time * 1000)));
    const bar = $("hBar"); bar.classList.remove("hidden"); bar.classList.toggle("low", shown <= 10);
    bar.firstElementChild.style.transform = "scaleX(" + frac.toFixed(4) + ")";
    $("hVig").classList.toggle("on", shown <= 10 && left > 0 && !!A.R && A.R.phase !== "done");
    if (left <= 0) timeOut();
  }
  function renderChips() {
    const multi = !!A.nroom;
    $("hChips").innerHTML = "";
    $("hChips").classList.toggle("hidden", !(multi && A.st));
    const ps = players(true);
    if (multi && A.st) {
      const i = A.st.i;
      // classement par score total ; état de la manche : … nom à trouver, 🗺 position à placer, ✓ fini, ✗ manche ratée
      const rows = ps.map((p) => ({ p, tot: totalOf(p.r) })).sort((a, b) => b.tot - a.tot);
      // l'hôte : un « H » à côté de son score (une couronne se confondait avec le meneur de la partie)
      const hc = "<span class='htag' title='Hôte' aria-label='Hôte'>H</span>";
      $("hChips").innerHTML = rows.map(({ p, tot }, k) => {
        const x = p.r[i];
        const s = !x ? "…" : x[0] === 1 ? "🗺" : x[0] === 2 ? "<span class='ok'>✓</span>" : "<span class='ko'>✗</span>";
        return "<div class='bl" + (p.me ? " me" : "") + "' title='" + esc(p.name) + "'><span class='rk'>" + (k + 1) + "</span>" + ava(p, 20) + "<span class='nm'>" + esc(p.name) + "</span><span class='pt'>" + (p.host && p.active !== false ? hc : "") + fmt(tot) + "</span><span class='st'>" + s + "</span></div>";
      }).join("");
      if (A.R && A.R.phase === "done") {
        const waiting = ps.filter((p) => !(p.r[i] && p.r[i][0] >= 2)).map((p) => p.name);
        const extra = waiting.length ? "En attente de : " + waiting.join(", ") + "." : "Tout le monde a fini !";
        const base = $("waitTxt").dataset.base || "";
        $("waitTxt").innerHTML = esc(base) + "<br>" + esc(extra);
      }
    }
    $("bForce").classList.toggle("hidden", !(A.mode === "host" && A.R && A.R.phase === "done" && canForceEnd()));
  }

  // ------------------------------------------------------------------ résultats de manche
  function showReveal(i) {
    A.shownReveal = i; show("reveal");
    const info = sceneInfo(A.st.seq[i]);
    $("rvRound").innerHTML = "<small>Manche</small>" + (i + 1) + "/" + A.st.seq.length;
    $("rvAnswer").innerHTML = "<small>C'était</small>" + esc(info ? gameTitle(info.game) : "Vue indisponible") +
      (info && info.place ? "<span class='place'>" + esc(info.place) + "</span>" : "");
    $("rvCredit").innerHTML = info && info.credit ? esc(info.credit) + (info.source ? " · <a href='" + esc(info.source) + "' target='_blank' rel='noopener'>source</a>" : "") : "";
    const last = i + 1 >= A.st.seq.length;
    $("bNext").textContent = last ? "Voir le classement" : "Manche suivante";
    $("bNext").classList.toggle("hidden", !isHost());
    $("rvWait").classList.toggle("hidden", isHost());
    // signaler une erreur : seulement pour les vrais jeux, sur le site auto-hébergé (le serveur garde les signalements)
    const rid = A.st.seq[i];
    $("bReport").classList.toggle("hidden", !(SERVER && rid && rid.startsWith("r-")));
    $("bReport").disabled = !!A.reported[rid];
    $("bReport").textContent = A.reported[rid] ? "Erreur signalée" : "Signaler une erreur";
    if (!rvMap) rvMap = new MapView($("rvMap"));
    const m = info && mapInfo(info.game);
    if (m) requestAnimationFrame(() => { rvMap.setImage(m.url, m.w, m.h); rvMap.pinKey = null; renderRevealPins(); });
    renderRevealTable();
  }
  function renderRevealPins() {
    const i = A.st.i, info = sceneInfo(A.st.seq[i]);
    if (!info || !rvMap) return;
    const goal = { x: info.x, y: info.y };
    const pins = [], lines = [];
    for (const p of players(true)) {
      const x = p.r[i];
      if (x && x[0] === 2 && x[4] >= 0) { const pt = { x: x[4], y: x[5] }; pins.push({ x: pt.x, y: pt.y, color: p.color, label: p.me ? "Toi" : p.name }); lines.push({ a: pt, b: goal, color: p.color }); }
    }
    pins.push({ x: goal.x, y: goal.y, goal: true, label: "Ici !" });
    rvMap.setPins(pins, lines);
    // recadrage sur les repères seulement quand il en arrive un nouveau, et jamais une fois la carte zoomée ou
    // déplacée par la personne (les mises à jour des joueurs, toutes les 1 à 2 s, annulaient son zoom)
    const key = pins.map((p) => p.x.toFixed(4) + "," + p.y.toFixed(4)).join("|");
    if (!rvMap.touched && key !== rvMap.pinKey) rvMap.focus(pins);
    rvMap.pinKey = key;
  }
  function renderRevealTable() {
    if (!A.st) return;
    const i = A.st.i;
    const ps = players(true).map((p) => ({ p, x: p.r[i], tot: totalOf(p.r) }));
    ps.sort((a, b) => ((b.x ? b.x[1] + b.x[2] : 0) - (a.x ? a.x[1] + a.x[2] : 0)) || b.tot - a.tot);
    const rows = ps.map(({ p, x, tot }) => {
      const nm = !x ? "—" : x[0] === 3 ? "<span style='color:var(--bad)'>✗</span>" : "✓ " + fmt(x[1]) + (x[3] ? " <span class='mut small'>(" + x[3] + " err.)</span>" : "");
      const loc = !x || x[0] !== 2 ? "—" : fmt(x[2]);
      return "<tr><td class='who'>" + ava(p, 24) + " " + esc(p.name) + (p.me ? " <span class='tag'>toi</span>" : "") + "</td><td>" + nm + "</td><td class='n'>" + loc + "</td><td class='n'><b>" + fmt(x ? x[1] + x[2] : 0) + "</b></td><td class='n mut'>" + fmt(tot) + "</td></tr>";
    }).join("");
    $("rvTable").innerHTML = "<tr><th>Joueur</th><th>Nom</th><th class='n'>Position</th><th class='n'>Manche</th><th class='n'>Total</th></tr>" + rows;
    if (A.screen === "reveal") renderRevealPins();
  }

  // ------------------------------------------------------------------ signalement d'une erreur
  let rpMap = null, rpPin = null, rpKind = null, rpSid = null;
  function openReport() {
    const sid = A.st && A.st.seq[A.shownReveal];
    const info = sceneInfo(sid);
    if (!info || !sid.startsWith("r-")) return;
    rpSid = sid; rpPin = null; rpKind = null;
    $("rpWhat").textContent = gameTitle(info.game) + (info.place ? " · " + info.place : "");
    for (const b of $("rpKind").children) b.classList.remove("on");
    $("rpText").value = ""; $("rpYes").disabled = true; $("rpMapBox").classList.add("hidden");
    $("report").classList.remove("hidden");
  }
  function setReportKind(k) {
    rpKind = k;
    for (const b of $("rpKind").children) b.classList.toggle("on", b.dataset.v === k);
    $("rpYes").disabled = false;
    const showMap = k === "position";
    $("rpMapBox").classList.toggle("hidden", !showMap);
    if (showMap) {
      const info = sceneInfo(rpSid), m = info && mapInfo(info.game);
      if (!rpMap) rpMap = new MapView($("rpMap"), { onTap: (x, y) => { rpPin = { x, y }; drawReportPins(); } });
      if (m) requestAnimationFrame(() => { rpMap.setImage(m.url, m.w, m.h); drawReportPins(); });
    }
  }
  function drawReportPins() {
    const info = sceneInfo(rpSid);
    if (!rpMap || !info) return;
    const pins = [{ x: info.x, y: info.y, goal: true, label: "Actuel" }];
    if (rpPin) pins.push({ x: rpPin.x, y: rpPin.y, color: A.color, label: "Ici" });
    rpMap.setPins(pins, rpPin ? [{ a: rpPin, b: { x: info.x, y: info.y }, color: A.color }] : []);
  }
  async function sendReport() {
    if (!rpKind || !rpSid) return;
    $("rpYes").disabled = true;
    const body = { sid: rpSid.slice(2), kind: rpKind, comment: $("rpText").value, name: A.name };
    if (rpKind === "position" && rpPin) body.pin = rpPin;
    try {
      const r = await fetch("api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "erreur " + r.status);
      A.reported[rpSid] = true;
      $("report").classList.add("hidden");
      $("bReport").disabled = true; $("bReport").textContent = "Erreur signalée";
      toast("Merci, c'est signalé !");
    } catch (e) {
      $("rpYes").disabled = false;
      toast("Envoi impossible : " + e.message, 4000);
    }
  }

  // ------------------------------------------------------------------ fin de partie
  // détail d'un joueur : jeu de chaque manche, points du nom (et erreurs), points de la position
  function playerDetail(p) {
    const rows = A.st.seq.map((sid, k) => {
      const info = sceneInfo(sid), x = (p.r || [])[k];
      const game = esc(info ? gameTitle(info.game) : "?") + (info && info.place ? "<span class='mut pl'> · " + esc(info.place) + "</span>" : "");
      let nm, loc, tot;
      if (!x) { nm = loc = tot = "<span class='mut'>—</span>"; }
      else if (x[0] === 3) { nm = "<span class='ko'>✗</span>"; loc = "<span class='mut'>—</span>"; tot = "0"; }
      else {
        nm = fmt(x[1]) + (x[3] > 0 ? "<br><span class='mut small'>" + x[3] + " erreur" + (x[3] > 1 ? "s" : "") + "</span>" : "");
        loc = x[0] === 2 ? fmt(x[2]) : "<span class='mut'>—</span>";
        tot = "<b>" + fmt(x[1] + (x[0] === 2 ? x[2] : 0)) + "</b>";
      }
      return "<tr><td class='mut'>" + (k + 1) + "</td><td>" + game + "</td><td class='n'>" + nm + "</td><td class='n'>" + loc + "</td><td class='n'>" + tot + "</td></tr>";
    }).join("");
    return "<table class='sc det'><tr><th>#</th><th>Jeu</th><th class='n'>Nom</th><th class='n'>Pos.</th><th class='n'>Total</th></tr>" + rows + "</table>";
  }
  function showFinal() { A.shownFinal = true; show("final"); renderFinal(); }
  // podium de fin de partie : les marches montent (3e, 2e puis 1re), les joueurs s'y posent, les scores
  // défilent, puis confettis pour le gagnant. Animé une seule fois par partie ; ensuite simple mise à jour.
  function renderPodium(ps) {
    const top = ps.slice(0, 3);
    const key = A.gen + "|" + top.map((x) => x.p.name + ":" + x.tot + ":" + x.p.avatar).join(",");
    if (key === A.podKey) return;
    const anim = A.podGen !== A.gen;
    A.podKey = key; A.podGen = A.gen;
    const order = [1, 0, 2].filter((k) => top[k]);
    const hgt = { 0: 120, 1: 86, 2: 64 }, col = { 0: "var(--acc)", 1: "#cfd9e2", 2: "#d9935a" }, delay = { 0: 0.95, 1: 0.55, 2: 0.15 };
    const crown = "<svg class='crown' viewBox='0 0 32 20' aria-hidden='true'><path d='M2 18 L4 5 L11 11 L16 2 L21 11 L28 5 L30 18 Z' fill='var(--acc)' stroke='#14181f' stroke-width='1.5' stroke-linejoin='round'/></svg>";
    const el = $("podium");
    el.classList.toggle("anim", anim);
    el.innerHTML = order.map((k) => "<div class='pod p" + (k + 1) + "' style='--d:" + delay[k] + "s'>"
      + "<div class='pod-ava'>" + (k === 0 ? crown : "") + (avaOK(top[k].p.avatar) ? window.avatarSVG(top[k].p.avatar) : "") + "</div>"
      + "<div class='nm'>" + esc(top[k].p.name) + "</div><div class='pt' data-to='" + top[k].tot + "' data-d='" + delay[k] + "'>" + fmt(anim ? 0 : top[k].tot) + "</div>"
      + "<div class='bar' style='height:" + hgt[k] + "px;background:" + col[k] + "'>" + (k + 1) + "</div></div>").join("") + "<div class='confetti' aria-hidden='true'></div>";
    const still = !anim || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (still) { for (const pt of el.querySelectorAll(".pt")) pt.textContent = fmt(+pt.dataset.to); return; }
    // défilement des scores, une fois le joueur posé sur sa marche
    const t0 = performance.now();
    const pts = [...el.querySelectorAll(".pt")];
    const tick = (now) => {
      let busy = false;
      for (const pt of pts) {
        const t = (now - t0) / 1000 - (+pt.dataset.d + 0.45), u = Math.max(0, Math.min(1, t / 0.9));
        pt.textContent = fmt(+pt.dataset.to * (1 - Math.pow(1 - u, 3)));
        if (u < 1) busy = true;
      }
      if (busy && el.isConnected) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    // confettis aux couleurs des avatars
    const cf = el.querySelector(".confetti"), cols = (AV && AV.COULEURS) || ["#f4b740", "#4cc9c0", "#ff7b72"];
    for (let i = 0; i < 46; i++) {
      const c = document.createElement("i");
      c.style.cssText = "left:" + (8 + Math.random() * 84) + "%;background:" + cols[i % cols.length] + ";--x:" + Math.round(Math.random() * 140 - 70) + "px;--r:" + Math.round(Math.random() * 720 - 360) + "deg;--t:" + (1.6 + Math.random()).toFixed(2) + "s;--dl:" + (1.55 + Math.random() * 0.5).toFixed(2) + "s";
      cf.append(c);
    }
    setTimeout(() => { if (cf.isConnected) cf.innerHTML = ""; }, 4800);
  }
  function renderFinal() {
    if (!A.st) return;
    const n = A.st.seq.length;
    // joueurs encore là + joueurs partis en cours de partie (notés par l'hôte dans st.gone)
    const goneList = A.st.gone || [], gonePeers = new Set(goneList.map((g) => g.peer));
    const here = players(true).filter((p) => !gonePeers.has(p.peer)), names = new Set(here.map((p) => p.name));
    const gone = goneList.filter((g) => !names.has(g.name)).map((g) => ({ me: false, name: g.name, color: g.color || "#8b9fb1", avatar: avaOK(g.avatar) ? g.avatar : null, r: g.r || [], j: g.j | 0, gone: true, left: g.left, peer: "g-" + g.peer }));
    const ps = here.concat(gone).map((p) => ({ p, tot: totalOf(p.r), found: (p.r || []).filter((x) => x && x[0] >= 1 && x[0] <= 2).length, played: (p.r || []).filter((x) => x).length })).sort((a, b) => b.tot - a.tot);
    const multi = ps.length > 1 || A.mode === "host" || A.mode === "guest";
    const mine = ps.find((x) => x.p.me) || ps[0];
    // récapitulatif du joueur : sur les manches qu'il a jouées (arrivé en cours de partie : pas sur toute la partie)
    const cnt = multi ? Math.max(mine.played, 1) : n, maxMine = cnt * (NAME_MAX + LOC_MAX);
    $("finSolo").innerHTML = "<div class='bigscore'>" + fmt(mine.tot) + "</div><p class='mut' style='text-align:center;margin:8px 0 0'>sur " + fmt(maxMine) + " points possibles · " + mine.found + "/" + cnt + " jeu" + (cnt > 1 ? "x" : "") + " trouvé" + (mine.found > 1 ? "s" : "") + "</p>";
    renderPodium(ps);
    if (multi) {
      // chaque joueur se déplie pour montrer le détail de sa partie, manche par manche
      A.finOpen = A.finOpen || {};
      // jeux trouvés sur les manches jouées : un joueur arrivé en cours de partie ou parti avant la fin
      // n'est compté que sur les manches auxquelles il a participé
      $("finTable").innerHTML = "<tr><th>#</th><th>Joueur</th><th class='n'>Jeux trouvés</th><th class='n'>Total</th></tr>" +
        ps.map((x, k) => {
          const id = String(x.p.peer), open = !!A.finOpen[id];
          return "<tr class='fin-pl" + (open ? " open" : "") + (x.p.gone ? " gone" : "") + "' data-pl='" + esc(id) + "'><td>" + (k + 1) + "</td><td class='who'><button type='button' class='fin-tog' aria-expanded='" + open + "' aria-label='Détail de la partie de " + esc(x.p.name) + "'>▸</button>" + ava(x.p, 24) + " " + esc(x.p.name) + (x.p.me ? " <span class='tag'>toi</span>" : "") + "</td><td class='n'>" + x.found + "/" + x.played + "</td><td class='n'><b>" + fmt(x.tot) + "</b></td></tr>"
            + "<tr class='fin-det" + (open ? "" : " hidden") + "'><td colspan='4'>" + playerDetail(x.p) + "</td></tr>";
        }).join("");
      for (const tr of $("finTable").querySelectorAll("tr.fin-pl")) tr.onclick = () => {
        const id = tr.dataset.pl, open = !A.finOpen[id];
        A.finOpen[id] = open;
        tr.classList.toggle("open", open); tr.querySelector(".fin-tog").setAttribute("aria-expanded", open);
        tr.nextElementSibling.classList.toggle("hidden", !open);
      };
    } else {
      $("finTable").innerHTML = "<tr><th>#</th><th>Jeu</th><th class='n'>Nom</th><th class='n'>Position</th></tr>" +
        A.st.seq.map((sid, k) => { const info = sceneInfo(sid), x = A.res[k]; return "<tr><td>" + (k + 1) + "</td><td>" + esc(info ? gameTitle(info.game) : "?") + "</td><td class='n'>" + (x && x[0] !== 3 ? fmt(x[1]) : "<span style='color:var(--bad)'>✗</span>") + "</td><td class='n'>" + (x && x[0] === 2 ? fmt(x[2]) : "—") + "</td></tr>"; }).join("");
    }
    $("bAgain").classList.toggle("hidden", !(isHost() || A.mode === "guest"));
  }
  // invité : « Rejouer » l'emmène dans le salon de la même partie (même code), où il attend que l'hôte relance
  function guestAgain() {
    if (!A.nroom) { goHome(); return; }
    showLobby();
  }

  // ------------------------------------------------------------------ bibliothèque (éditeur)
  const E = { panoImg: null, mapImg: null, pin: null, gameId: null, known: null };
  let ePano = null, eMap = null;
  function openLibrary() { show("library"); renderLibrary(); }
  function renderLibrary() {
    const canEdit = !!A.caps.assets && !!A.caps.db;
    $("libForm").classList.toggle("hidden", !canEdit);
    const ne = $("libNoEdit");
    ne.classList.toggle("hidden", canEdit);
    ne.textContent = !A.caps.db ? "La bibliothèque partagée n'est pas disponible dans cette vue : ouvre l'artefact sur claude.ai en étant connecté." : "Seuls le propriétaire et les éditeurs de l'artefact peuvent ajouter des vues. Les vues déjà enregistrées sont jouables par tout le monde (choisis « Ma bibliothèque » dans les réglages).";
    const ids = Object.keys(A.lib.scenes).sort((a, b) => (A.lib.scenes[b].at || 0) - (A.lib.scenes[a].at || 0));
    $("libCount").textContent = "(" + ids.length + ")";
    $("libScenes").innerHTML = ids.length ? ids.map((id) => { const s = A.lib.scenes[id]; const okMap = !!A.lib.maps[s.game]; return "<div class='sc-card'><div class='th' style=\"background-image:url('/_blob/" + esc(s.asset) + "')\"></div><div class='bd'><b title='" + esc(gameTitle(s.game)) + "'>" + esc(gameTitle(s.game)) + "</b>" + (okMap ? "" : "<span class='mut small'>⚠ carte manquante</span>") + (canEdit ? "<button class='btn sm danger' data-del='" + esc(id) + "'>Supprimer</button>" : "") + "</div></div>"; }).join("") : "<p class='mut small'>Aucune vue pour l'instant.</p>";
    for (const b of $("libScenes").querySelectorAll("[data-del]")) b.onclick = () => deleteScene(b.dataset.del);
    editorRefresh();
  }
  function editorGame() {
    const t = $("eGame").value.trim();
    if (!t) return null;
    const q = A.matcher.norm(t);
    const known = A.matcher.games.find((g) => !g.id.startsWith("demo-") && (A.matcher.norm(g.t) === q || g.n.includes(q)));
    return known ? { id: known.id, t: known.t, known: true, series: known.s ? A.matcher.seriesById[known.s].t : null, custom: !!A.lib.games[known.id] } : { id: A.matcher.slug(t), t, known: false };
  }
  function editorRefresh() {
    const g = editorGame();
    $("eNew").classList.toggle("hidden", !g || g.known);
    $("eGameInfo").innerHTML = !g ? "Choisis dans la liste ou tape un nouveau titre." : g.known ? "✓ Jeu reconnu : <b>" + esc(g.t) + "</b>" + (g.series ? " · série " + esc(g.series) : "") : "Nouveau jeu : <b>" + esc(g.t) + "</b> sera ajouté aux réponses possibles.";
    const existing = g && A.lib.maps[g.id];
    $("eMapLbl").textContent = existing ? "Remplacer la carte" : "Choisir la carte";
    $("eMapInfo").textContent = existing && !E.mapImg ? "✓ Carte déjà enregistrée pour ce jeu." : E.mapImg ? "Nouvelle carte : " + E.mapImg.naturalWidth + "×" + E.mapImg.naturalHeight : "Une seule carte par jeu, réutilisée pour toutes ses vues.";
    const showMap = !!(E.mapImg || existing);
    $("eMapBox").classList.toggle("hidden", !showMap);
    if (showMap) {
      if (!eMap) eMap = new MapView($("eMapView"), { onTap: (x, y) => { E.pin = { x, y }; eMap.setPins([{ x, y, color: "#f4b740", label: "Vue" }]); editorRefresh(); } });
      const src = E.mapImg ? { url: E.mapImg.src, w: E.mapImg.naturalWidth, h: E.mapImg.naturalHeight } : { url: "/_blob/" + existing.asset, w: existing.w, h: existing.h };
      if (eMap._src !== src.url) { eMap._src = src.url; requestAnimationFrame(() => { eMap.setImage(src.url, src.w, src.h); eMap.setPins(E.pin ? [{ x: E.pin.x, y: E.pin.y, color: "#f4b740", label: "Vue" }] : []); }); }
    }
    $("eSave").disabled = !(g && E.panoImg && showMap && E.pin) || E.busy;
  }
  function loadImageFile(file) {
    return new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = () => rej(new Error("Image illisible")); img.src = URL.createObjectURL(file); });
  }
  function toJpeg(img, max, q) {
    const w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
    const cv = document.createElement("canvas"); cv.width = Math.round(w * k); cv.height = Math.round(h * k);
    const c = cv.getContext("2d"); c.fillStyle = "#000"; c.fillRect(0, 0, cv.width, cv.height); c.drawImage(img, 0, 0, cv.width, cv.height);
    return new Promise((res, rej) => cv.toBlob((b) => (b ? res({ blob: b, w: cv.width, h: cv.height }) : rej(new Error("Compression impossible"))), "image/jpeg", q || 0.86));
  }
  async function saveScene() {
    const g = editorGame();
    if (!g || !E.panoImg || !E.pin) return;
    const db = A.caps.db, assets = A.caps.assets;
    E.busy = true; editorRefresh();
    const st = (t) => ($("eStatus").textContent = t);
    try {
      if (!g.known) {
        const alias = $("eAlias").value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 12);
        const series = $("eSeries").value.trim().slice(0, 80) || null;
        await db.doc("games/" + g.id).set({ t: g.t.slice(0, 120), a: alias, s: series });
      }
      if (E.mapImg) {
        st("Envoi de la carte…");
        const m = await toJpeg(E.mapImg, 2400, 0.9);
        const up = await assets.upload(m.blob, { type: "image/jpeg" });
        await db.doc("maps/" + g.id).set({ asset: up.id, w: m.w, h: m.h, game: g.id });
      }
      st("Envoi de la vue 360°…");
      const p = await toJpeg(E.panoImg, 4096, 0.86);
      const up = await assets.upload(p.blob, { type: "image/jpeg" });
      const id = rid(10);
      await db.doc("scenes/" + id).set({ game: g.id, asset: up.id, x: E.pin.x, y: E.pin.y, at: Date.now() });
      st("✓ Vue enregistrée ! Tu peux en ajouter une autre pour le même jeu.");
      E.panoImg = null; E.pin = null; E.mapImg = null; $("ePano").value = ""; $("eMap").value = "";
      $("ePanoBox").classList.add("hidden"); $("ePanoInfo").textContent = "JPG/PNG/WebP, idéalement 2:1 (ex. 4096×2048).";
      if (eMap) { eMap._src = null; eMap.setPins([]); }
    } catch (e) {
      console.error(e);
      st("Erreur : " + (e.code ? e.code + " — " : "") + (e.message || e));
    }
    E.busy = false; editorRefresh();
  }
  async function deleteScene(id) {
    const s = A.lib.scenes[id];
    if (!s) return;
    if (!(await confirmBox("Supprimer cette vue de <b>" + esc(gameTitle(s.game)) + "</b> ?<br><span class='mut small'>L'image sera effacée définitivement.</span>", "Supprimer"))) return;
    try { await A.caps.db.doc("scenes/" + id).delete(); } catch (e) { toast("Suppression impossible : " + (e.code || e.message)); return; }
    try { await A.caps.assets.delete(s.asset); } catch (e) { /* image déjà absente */ }
    toast("Vue supprimée");
  }

  // ------------------------------------------------------------------ autocomplétion
  function attachSuggest(input, box, onPick, filter) {
    let sel = -1, items = [];
    const render = () => {
      if (!items.length) { box.classList.add("hidden"); return; }
      box.innerHTML = items.map((t, k) => "<button type='button' class='" + (k === sel ? "on" : "") + "'>" + esc(t) + "</button>").join("");
      box.classList.remove("hidden");
      [...box.children].forEach((b, k) => b.addEventListener("pointerdown", (e) => { e.preventDefault(); onPick(items[k]); items = []; render(); }));
    };
    input.addEventListener("input", () => { sel = -1; items = filter() ? A.matcher.suggest(input.value, 6).filter(filter()) : []; render(); });
    input.addEventListener("keydown", (e) => {
      if (!items.length) return;
      if (e.key === "ArrowDown") { sel = (sel + 1) % items.length; render(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { sel = (sel - 1 + items.length) % items.length; render(); e.preventDefault(); }
      else if (e.key === "Enter" && sel >= 0) { e.preventDefault(); onPick(items[sel]); items = []; render(); }
      else if (e.key === "Escape") { items = []; render(); }
    });
    input.addEventListener("blur", () => setTimeout(() => { items = []; render(); }, 150));
  }

  // ------------------------------------------------------------------ branchements
  function wire() {
    renderHome();
    $("pseudo").addEventListener("change", ensureName);
    $("bSolo").onclick = startSolo;
    $("bHost").onclick = startHost;
    $("bJoin").onclick = startJoin;
    $("joinCode").addEventListener("keydown", (e) => { if (e.key === "Enter") startJoin(); });
    $("joinCode").addEventListener("input", (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); joinError(""); });
    $("bLib").onclick = openLibrary;
    $("bReport").onclick = openReport;
    for (const b of $("rpKind").children) b.onclick = () => setReportKind(b.dataset.v);
    $("rpNo").onclick = () => $("report").classList.add("hidden");
    $("rpYes").onclick = sendReport;
    $("bAvaRnd").onclick = () => AV && setAvatar(AV.random());
    $("bAvaEdit").onclick = () => openAvatarEditor($("avaOpts").classList.contains("hidden"));
    $("bAvaDone").onclick = () => openAvatarEditor(false);
    $("bAvaUndo").onclick = () => { if (A.avaBefore && avaOK(A.avaBefore)) setAvatar(A.avaBefore); openAvatarEditor(false); };
    $("bLibBack").onclick = () => show(A.mode ? "lobby" : "home");
    $("bLobbyBack").onclick = goHome;
    $("bCopy").onclick = () => { navigator.clipboard.writeText(A.code).then(() => toast("Code copié : " + A.code), () => toast("Code : " + A.code)); };
    $("bStart").onclick = () => { if (isHost()) hostStart(); };
    $("bReady").onclick = toggleReady;
    for (const b of document.querySelectorAll("#settings [data-step]")) b.onclick = () => { const c = curCfg(); const max = Math.max(1, Math.min(15, pool(c.pack).length)); setCfg("rounds", Math.max(1, Math.min(max, c.rounds + +b.dataset.step))); };
    for (const seg of document.querySelectorAll("#settings .seg")) seg.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b || b.disabled) return;
      const k = seg.dataset.k; const v = k === "pack" ? b.dataset.v : +b.dataset.v;
      setCfg(k, v);
    });

    $("fGuess").addEventListener("submit", (e) => { e.preventDefault(); submitGuess($("gInput").value); });
    attachSuggest($("gInput"), $("sugg"), (t) => { $("gInput").value = t; submitGuess(t); }, () => (A.st && A.st.cfg.hints ? (t) => true : null));
    $("bSkip").onclick = async () => { if (await confirmBox("Passer cette manche ?", "Passer")) failName("Manche passée"); };
    $("bPin").onclick = validatePin;
    $("bMini").onclick = () => setMapMini(!$("pMap").classList.contains("mini"));
    $("bBig").onclick = () => { const big = $("pMap").classList.toggle("big"); $("bBig").textContent = big ? "Réduire" : "Agrandir"; setTimeout(() => pick && pick.fit(), 280); };
    $("bForce").onclick = hostForceEnd;
    $("bQuit").onclick = async () => { if (await confirmBox("Quitter la partie ?", "Quitter")) goHome(); };
    $("bNext").onclick = hostNext;
    $("bAgain").onclick = () => (isHost() ? hostReplay() : guestAgain());
    $("bHome").onclick = goHome;

    // éditeur
    const demoTitles = new Set(DEMO.GAMES.map((g) => g.t));
    attachSuggest($("eGame"), $("eSugg"), (t) => { $("eGame").value = t; E.pin = null; if (eMap) eMap._src = null; editorRefresh(); }, () => (t) => !demoTitles.has(t));
    $("eGame").addEventListener("input", () => { E.pin = null; if (eMap) eMap._src = null; editorRefresh(); });
    $("ePano").addEventListener("change", async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const img = await loadImageFile(f); E.panoImg = img;
        const r = img.naturalWidth / img.naturalHeight;
        $("ePanoInfo").textContent = img.naturalWidth + "×" + img.naturalHeight + (Math.abs(r - 2) > 0.15 ? " — ⚠ pas au format 2:1 : la vue sera déformée." : " ✓");
        $("ePanoBox").classList.remove("hidden");
        if (!ePano) ePano = new Pano($("ePanoCv"));
        requestAnimationFrame(() => ePano.setImage(img));
      } catch (err) { toast(err.message); }
      editorRefresh();
    });
    $("eMap").addEventListener("change", async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { E.mapImg = await loadImageFile(f); E.pin = null; if (eMap) eMap._src = null; } catch (err) { toast(err.message); }
      editorRefresh();
    });
    $("eSave").onclick = saveScene;

    setInterval(() => { hostCheck(); tickTimer(); }, 250);
    setInterval(() => { if (A.nroom) { A.hb = ((A.hb || 0) + 1) % 1e6; publish(); } }, HB_MS);
    setInterval(() => { if (A.nroom) { checkHost(); if (A.mode === "host") hostRecordGone(); renderPlayers(); } }, 1000);
    // retour sur la page (téléphone) : signal de vie immédiat pour ne pas passer pour absent
    document.addEventListener("visibilitychange", () => { if (A.nroom) { A.hb = ((A.hb || 0) + 1) % 1e6; publish(); } });

    const linked = codeFromLink();
    if (linked) $("joinCode").value = linked;
    show("home");
    initCaps();
  }

  // accès pour les tests automatisés
  window.QJ = { A, namePoints, locPoints, mapDist, buildSeq, submitGuess: (t) => submitGuess(t), startSolo, hostStart, validatePin, get pano() { return pano; } };
  wire();
})();
