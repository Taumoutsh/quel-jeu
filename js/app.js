/* GameSpotter — logique de l'application : écrans, manches, points, multijoueur, bibliothèque. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const COLORS = ["#f4b740", "#ff7b72", "#4cc9c0", "#9d8cff", "#6fd69b", "#ff9f5a", "#f07ac0", "#e3ecf2"]; // couleurs de joueur, accordées à la palette
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
  const locPoints = (d) => (d <= 0.008 ? LOC_MAX : Math.round(LOC_MAX * Math.exp(-11 * (d - 0.008))));

  // ------------------------------------------------------------------ état
  const A = {
    name: LS.get("name", ""),
    color: LS.get("color", COLORS[(Math.random() * COLORS.length) | 0]),
    cfg: Object.assign({ rounds: 5, time: 120, tries: 3, hints: 1, pack: "real" }, LS.get("cfg", {})),
    caps: { db: null, room: null, assets: null, user: null },
    lib: { scenes: {}, maps: {}, games: {} }, libReady: false,
    matcher: null,
    mode: null, nroom: null, code: null, st: null, gen: null, res: [], peers: [],
    R: null, shownReveal: -1, shownFinal: false, sawHost: false,
  };

  // couleur choisie avec l'ancienne palette : on prend sa remplaçante
  const OLD_COLORS = ["#c6ff3d", "#ff5d8f", "#3de0ff", "#ffc94d", "#b48bff", "#ff8a3d", "#5dffb0", "#f2f2f2"];
  if (!COLORS.includes(A.color)) { const k = OLD_COLORS.indexOf(String(A.color).toLowerCase()); A.color = COLORS[k >= 0 ? k : 0]; LS.set("color", A.color); }

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
  function show(id) { for (const s of SCREENS) $(s).classList.toggle("hidden", s !== id); A.screen = id; }
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
      out.maps[id] = { url: "packs/img/map-" + g.key + ".jpg" + (SERVER && m[2] ? "?v=" + m[2] : ""), w: m[0], h: m[1] };
    }
    for (const sc of P.scenes) {
      const g = out.games[sc.game];
      if (g && D.scenes[sc.id]) out.scenes[sc.id] = { game: g.id, x: sc.x, y: sc.y, place: sc.place, flat: !!sc.flat, credit: sc.credit || g.credit, source: sc.source || g.source, url: "packs/img/" + sc.id + ".jpg" + (SERVER && D.scenes[sc.id][2] ? "?v=" + D.scenes[sc.id][2] : "") };
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
    const me = { me: true, name: A.name, color: A.color, r: A.res, host: A.mode === "host" || A.mode === "solo", peer: "me" };
    if (!A.nroom) return [me];
    const out = []; let sawMe = false;
    for (const p of A.peers) {
      const pr = p.presence || {};
      if (!pr.n) continue;
      if (p.sameTab) { sawMe = true; out.push(me); continue; }
      if (forScore && pr.g !== A.gen) continue;
      out.push({ me: false, name: String(pr.n).slice(0, 16), color: /^#[0-9a-f]{6}$/i.test(pr.c) ? pr.c : "#ffffff", r: Array.isArray(pr.r) ? pr.r : [], host: pr.h === 1, peer: p.peer });
    }
    if (!sawMe) out.unshift(me);
    return out;
  }
  let pubT = null;
  function publish() {
    if (!A.nroom) return;
    clearTimeout(pubT);
    pubT = setTimeout(() => {
      const p = { v: 1, n: A.name, c: A.color, h: A.mode === "host" ? 1 : 0, g: A.gen, r: A.res.map((x) => x || null) };
      p.st = A.mode === "host" ? A.st : null;
      A.nroom.presence(p).catch((e) => console.warn("presence", e));
    }, 40);
  }
  async function joinRoom(code) {
    const room = A.caps.room;
    if (!room) throw new Error("Multijoueur indisponible");
    const nr = await room.join("qj-" + code.toLowerCase());
    A.nroom = nr; A.code = code; A.peers = nr.peers();
    A.unPeers = nr.onPeers((ch) => { A.peers = ch.peers; onPeers(); }, (e) => toast("Connexion à la partie perdue (" + e.code + ")", 5000));
  }
  function onPeers() {
    if (A.mode === "guest") {
      const host = A.peers.find((p) => !p.sameTab && p.presence && p.presence.h === 1 && p.presence.st);
      if (host) { A.sawHost = true; A.hostGoneShown = false; applyState(host.presence.st); }
      else if (A.sawHost && !A.hostGoneShown) {
        A.hostGoneShown = true;
        setTimeout(async () => {
          const still = !A.peers.find((p) => p.presence && p.presence.h === 1);
          if (still && A.mode === "guest" && A.st && (await confirmBox("<b>L'hôte a quitté la partie.</b><br><span class='mut'>Veux-tu reprendre le rôle d'hôte pour continuer ?</span>", "Devenir l'hôte"))) {
            A.mode = "host"; publish(); route(); toast("Tu es maintenant l'hôte");
          }
        }, 4000);
      }
    }
    if (A.mode === "host") hostCheck();
    renderPlayers();
    if (A.screen === "reveal") renderRevealTable();
    if (A.screen === "final") renderFinal();
  }
  function applyState(st) {
    if (!st || typeof st !== "object" || !Array.isArray(st.seq) || !st.cfg) return;
    const js = JSON.stringify(st);
    if (A._stjs === js) return;
    A._stjs = js;
    if (st.gen !== A.gen) { A.gen = st.gen; A.res = []; A.R = null; A.shownReveal = -1; A.shownFinal = false; publish(); }
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
    A.gen = rid(8); A.res = []; A.R = null; A.shownReveal = -1; A.shownFinal = false;
    A.st = { gen: A.gen, ph: "play", cfg, seq, i: 0, dl: newDeadline(cfg) };
    publish(); route();
  }
  function hostCheck() {
    if (!isHost() || !A.st || A.st.ph !== "play") return;
    const i = A.st.i, ps = players(true);
    const allDone = ps.length > 0 && ps.every((p) => p.r[i] && p.r[i][0] >= 2);
    const timeUp = A.st.dl && Date.now() > A.st.dl + 1200;
    if (allDone || timeUp) { A.st = Object.assign({}, A.st, { ph: "rev" }); publish(); route(); }
  }
  function hostForceEnd() { if (isHost() && A.st && A.st.ph === "play") { A.st = Object.assign({}, A.st, { ph: "rev" }); publish(); route(); } }
  function hostNext() {
    if (!isHost() || !A.st) return;
    if (A.st.i + 1 < A.st.seq.length) A.st = Object.assign({}, A.st, { ph: "play", i: A.st.i + 1, dl: newDeadline(A.st.cfg) });
    else A.st = Object.assign({}, A.st, { ph: "end" });
    publish(); route();
  }
  function hostReplay() {
    A.gen = rid(8); A.res = []; A.R = null; A.shownReveal = -1; A.shownFinal = false;
    A.st = { gen: A.gen, ph: "lobby", cfg: Object.assign({}, A.cfg), seq: [], i: -1, dl: 0 };
    publish(); route();
  }

  // ------------------------------------------------------------------ accueil
  function renderHome() {
    $("pseudo").value = A.name;
    const sw = $("swatches"); sw.innerHTML = "";
    for (const c of COLORS) {
      const b = document.createElement("button"); b.className = "swatch" + (c === A.color ? " on" : ""); b.style.background = c; b.type = "button"; b.title = "Couleur";
      b.onclick = () => { A.color = c; LS.set("color", c); renderHome(); };
      sw.append(b);
    }
  }
  function ensureName() {
    let n = $("pseudo").value.trim().replace(/\s+/g, " ").slice(0, 16);
    if (!n) n = "Joueur " + (10 + ((Math.random() * 89) | 0));
    A.name = n; LS.set("name", n); $("pseudo").value = n;
  }
  function genCode() { let s = ""; for (let i = 0; i < 5; i++) s += CODE_ABC[(Math.random() * CODE_ABC.length) | 0]; return s; }

  async function startSolo() {
    ensureName(); await leaveRoom();
    A.mode = "solo"; A.gen = rid(8); A.res = [];
    A.st = { gen: A.gen, ph: "lobby", cfg: Object.assign({}, A.cfg), seq: [], i: -1, dl: 0 };
    route();
  }
  async function startHost() {
    ensureName(); await leaveRoom();
    const code = genCode();
    try { await joinRoom(code); } catch (e) { toast("Impossible de créer la partie : " + (e.code || e.message), 5000); return; }
    A.mode = "host"; A.gen = rid(8); A.res = [];
    A.st = { gen: A.gen, ph: "lobby", cfg: Object.assign({}, A.cfg), seq: [], i: -1, dl: 0 };
    try { history.replaceState(null, "", "#partie-" + code.toLowerCase()); } catch (e) { /* ignore */ }
    publish(); route();
  }
  async function startJoin() {
    ensureName();
    const code = $("joinCode").value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length !== 5) { toast("Le code fait 5 caractères."); return; }
    await leaveRoom();
    try { await joinRoom(code); } catch (e) { toast("Impossible de rejoindre : " + (e.code || e.message), 5000); return; }
    A.mode = "guest"; A.st = null; A.gen = null; A.res = []; A.sawHost = false; A._stjs = null;
    publish();
    showLobby();
    setTimeout(() => { if (A.mode === "guest" && !A.sawHost && A.code === code) toast("Aucune partie trouvée pour l'instant avec le code " + code + ". Vérifie le code ou attends l'hôte.", 5000); }, 7000);
    onPeers();
  }
  async function leaveRoom() {
    if (A.unPeers) { try { A.unPeers(); } catch (e) { /* ignore */ } A.unPeers = null; }
    if (A.nroom) { const r = A.nroom; A.nroom = null; try { await r.leave(); } catch (e) { /* ignore */ } }
    A.peers = []; A.code = null;
  }
  async function goHome() {
    await leaveRoom();
    A.mode = null; A.st = null; A.R = null; A._stjs = null;
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* ignore */ }
    renderHome(); show("home");
  }

  // ------------------------------------------------------------------ salon / réglages
  function curCfg() { return A.mode === "guest" ? (A.st && A.st.cfg) || A.cfg : A.cfg; }
  function showLobby() {
    show("lobby");
    const multi = A.mode === "host" || A.mode === "guest";
    $("codeCard").classList.toggle("hidden", !multi);
    $("playersCard").classList.toggle("hidden", !multi);
    $("codeBox").textContent = A.code || "-----";
    $("bStart").classList.toggle("hidden", A.mode === "guest");
    $("waitHost").classList.toggle("hidden", A.mode !== "guest");
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
    if (A.screen === "lobby") {
      $("nPlayers").textContent = "(" + ps.length + ")";
      $("playersList").innerHTML = ps.map((p) => '<div class="pl"><span class="dot" style="background:' + p.color + '"></span><b class="grow">' + esc(p.name) + "</b>" + (p.host ? '<span class="tag acc">Hôte</span>' : "") + (p.me ? '<span class="tag">Toi</span>' : "") + "</div>").join("");
    }
    if (A.screen === "game") renderChips();
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
    // déjà terminé (rechargement) ?
    if (A.res[i] && A.res[i][0] >= 2) { A.R.phase = "done"; showWait("Manche terminée", "En attente des autres joueurs…", fmt(A.res[i][1] + A.res[i][2]) + " pts"); }
    else showNamePanel();
    renderHud(); renderChips();
  }
  function hidePanels() { for (const p of ["pName", "pMap", "pWait"]) $(p).classList.add("hidden"); $("pMap").classList.remove("big"); $("bBig").textContent = "Agrandir"; }
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
    if (!dl) { $("hTime").textContent = "∞"; $("hTimer").classList.remove("low"); return; }
    const left = Math.max(0, Math.ceil((dl - Date.now()) / 1000));
    const shown = Math.min(left, A.st.cfg.time);
    $("hTime").textContent = Math.floor(shown / 60) + ":" + String(shown % 60).padStart(2, "0");
    $("hTimer").classList.toggle("low", shown <= 10);
    if (left <= 0) timeOut();
  }
  function renderChips() {
    const multi = !!A.nroom;
    $("hChips").innerHTML = "";
    const ps = players(true);
    if (multi && A.st) {
      const i = A.st.i;
      $("hChips").innerHTML = ps.map((p) => { const x = p.r[i]; const s = !x ? "…" : x[0] === 1 ? "🗺" : x[0] === 2 ? "<span class='ok'>✓</span>" : "<span class='ko'>✗</span>"; return "<span class='chip'><span class='dot' style='background:" + p.color + "'></span>" + esc(p.name) + " " + s + "</span>"; }).join("");
      if (A.R && A.R.phase === "done") {
        const waiting = ps.filter((p) => !(p.r[i] && p.r[i][0] >= 2)).map((p) => p.name);
        const extra = waiting.length ? "En attente de : " + waiting.join(", ") + "." : "Tout le monde a fini !";
        const base = $("waitTxt").dataset.base || "";
        $("waitTxt").innerHTML = esc(base) + "<br>" + esc(extra);
      }
    }
    $("bForce").classList.toggle("hidden", !(A.mode === "host" && A.R && A.R.phase === "done"));
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
    if (!rvMap) rvMap = new MapView($("rvMap"));
    const m = info && mapInfo(info.game);
    if (m) requestAnimationFrame(() => { rvMap.setImage(m.url, m.w, m.h); renderRevealPins(); });
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
    rvMap.focus(pins);
  }
  function renderRevealTable() {
    if (!A.st) return;
    const i = A.st.i;
    const ps = players(true).map((p) => ({ p, x: p.r[i], tot: totalOf(p.r) }));
    ps.sort((a, b) => ((b.x ? b.x[1] + b.x[2] : 0) - (a.x ? a.x[1] + a.x[2] : 0)) || b.tot - a.tot);
    const rows = ps.map(({ p, x, tot }) => {
      const nm = !x ? "—" : x[0] === 3 ? "<span style='color:var(--bad)'>✗</span>" : "✓ " + fmt(x[1]) + (x[3] ? " <span class='mut small'>(" + x[3] + " err.)</span>" : "");
      const loc = !x || x[0] !== 2 ? "—" : fmt(x[2]);
      return "<tr><td><span class='dot' style='display:inline-block;vertical-align:middle;background:" + p.color + "'></span> " + esc(p.name) + (p.me ? " <span class='tag'>toi</span>" : "") + "</td><td>" + nm + "</td><td class='n'>" + loc + "</td><td class='n'><b>" + fmt(x ? x[1] + x[2] : 0) + "</b></td><td class='n mut'>" + fmt(tot) + "</td></tr>";
    }).join("");
    $("rvTable").innerHTML = "<tr><th>Joueur</th><th>Nom</th><th class='n'>Position</th><th class='n'>Manche</th><th class='n'>Total</th></tr>" + rows;
    if (A.screen === "reveal") renderRevealPins();
  }

  // ------------------------------------------------------------------ fin de partie
  function showFinal() { A.shownFinal = true; show("final"); renderFinal(); }
  function renderFinal() {
    if (!A.st) return;
    const n = A.st.seq.length, max = n * (NAME_MAX + LOC_MAX);
    const ps = players(true).map((p) => ({ p, tot: totalOf(p.r), found: (p.r || []).filter((x) => x && x[0] >= 1 && x[0] <= 2).length })).sort((a, b) => b.tot - a.tot);
    const multi = ps.length > 1;
    $("podium").classList.toggle("hidden", !multi);
    const mine = ps.find((x) => x.p.me) || ps[0];
    $("finSolo").innerHTML = "<div class='bigscore'>" + fmt(mine.tot) + "</div><p class='mut' style='text-align:center;margin:8px 0 0'>sur " + fmt(max) + " points possibles · " + mine.found + "/" + n + " jeu" + (n > 1 ? "x" : "") + " trouvé" + (mine.found > 1 ? "s" : "") + "</p>";
    if (multi) {
      const order = [1, 0, 2].filter((k) => ps[k]);
      const hgt = { 0: 120, 1: 86, 2: 64 }, col = { 0: "var(--acc)", 1: "#cfd9e2", 2: "#d9935a" };
      $("podium").innerHTML = order.map((k) => "<div class='pod'><div class='nm'>" + esc(ps[k].p.name) + "</div><div class='pt'>" + fmt(ps[k].tot) + "</div><div class='bar' style='height:" + hgt[k] + "px;background:" + col[k] + "'>" + (k + 1) + "</div></div>").join("");
    }
    if (multi) {
      $("finTable").innerHTML = "<tr><th>#</th><th>Joueur</th><th class='n'>Jeux trouvés</th><th class='n'>Total</th></tr>" +
        ps.map((x, k) => "<tr><td>" + (k + 1) + "</td><td><span class='dot' style='display:inline-block;background:" + x.p.color + "'></span> " + esc(x.p.name) + (x.p.me ? " <span class='tag'>toi</span>" : "") + "</td><td class='n'>" + x.found + "/" + n + "</td><td class='n'><b>" + fmt(x.tot) + "</b></td></tr>").join("");
    } else {
      $("finTable").innerHTML = "<tr><th>#</th><th>Jeu</th><th class='n'>Nom</th><th class='n'>Position</th></tr>" +
        A.st.seq.map((sid, k) => { const info = sceneInfo(sid), x = A.res[k]; return "<tr><td>" + (k + 1) + "</td><td>" + esc(info ? gameTitle(info.game) : "?") + "</td><td class='n'>" + (x && x[0] !== 3 ? fmt(x[1]) : "<span style='color:var(--bad)'>✗</span>") + "</td><td class='n'>" + (x && x[0] === 2 ? fmt(x[2]) : "—") + "</td></tr>"; }).join("");
    }
    $("bAgain").classList.toggle("hidden", !isHost());
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
    $("joinCode").addEventListener("input", (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); });
    $("bLib").onclick = openLibrary;
    $("bLibBack").onclick = () => show(A.mode ? "lobby" : "home");
    $("bLobbyBack").onclick = goHome;
    $("bCopy").onclick = () => { navigator.clipboard.writeText(A.code).then(() => toast("Code copié : " + A.code), () => toast("Code : " + A.code)); };
    $("bStart").onclick = () => { if (isHost()) hostStart(); };
    for (const b of document.querySelectorAll("#settings [data-step]")) b.onclick = () => { const c = curCfg(); const max = Math.max(1, Math.min(15, pool(c.pack).length)); setCfg("rounds", Math.max(1, Math.min(max, c.rounds + +b.dataset.step))); };
    for (const seg of document.querySelectorAll("#settings .seg")) seg.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b || b.disabled) return;
      const k = seg.dataset.k; const v = k === "pack" ? b.dataset.v : +b.dataset.v;
      setCfg(k, v);
    });

    $("fGuess").addEventListener("submit", (e) => { e.preventDefault(); submitGuess($("gInput").value); });
    attachSuggest($("gInput"), $("sugg"), (t) => { $("gInput").value = t; submitGuess(t); }, () => (A.st && A.st.cfg.hints ? (t) => true : null));
    $("bSkip").onclick = async () => { if (await confirmBox("Passer cette manche ?<br><span class='mut small'>Tu marques 0 point.</span>", "Passer")) failName("Manche passée"); };
    $("bPin").onclick = validatePin;
    $("bBig").onclick = () => { const big = $("pMap").classList.toggle("big"); $("bBig").textContent = big ? "Réduire" : "Agrandir"; setTimeout(() => pick && pick.fit(), 280); };
    $("bForce").onclick = hostForceEnd;
    $("bQuit").onclick = async () => { if (await confirmBox("Quitter la partie ?", "Quitter")) goHome(); };
    $("bNext").onclick = hostNext;
    $("bAgain").onclick = hostReplay;
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

    const m = /^#partie-([a-z0-9]{5})$/i.exec(location.hash);
    if (m) $("joinCode").value = m[1].toUpperCase();
    show("home");
    initCaps();
  }

  // accès pour les tests automatisés
  window.QJ = { A, namePoints, locPoints, mapDist, buildSeq, submitGuess: (t) => submitGuess(t), startSolo, hostStart, validatePin };
  wire();
})();
