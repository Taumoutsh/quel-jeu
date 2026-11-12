/* Page d'administration (/admin) : signalements des joueurs et corrections des vues du pack « Vrais jeux ».
 * Connexion par le mot de passe QJ_ADMIN_PASSWORD du .env (le serveur rend un jeton gardé pour l'onglet).
 * Une correction (position, jeu, nom du lieu) ou une suppression est gardée par le serveur dans data/overrides.json
 * et appliquée au pack servi aux joueurs ; « Exporter » télécharge ces corrections pour les reporter dans le dépôt.
 */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const KIND = { position: "Position fausse", jeu: "Mauvais jeu", image: "Image inadaptée", autre: "Autre" };
  const STATUS = { open: "En attente", resolved: "Résolu", ignored: "Ignoré" };
  const DISPO = window.REAL_PACK_DISPO || { maps: {}, scenes: {} };
  const S = { token: null, pack: null, games: {}, reports: [], overrides: { scenes: {} }, tab: "reports", sel: null, draft: null, map: null };
  let toastT = null;
  function toast(msg, ms) { const t = $("toast"); t.textContent = msg; t.classList.remove("hidden"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add("hidden"), ms || 2600); }
  try { S.token = sessionStorage.getItem("qj.admin"); } catch (e) { /* stockage indisponible */ }

  async function call(route, body) {
    const r = await fetch("api/admin/" + route, {
      method: body ? "POST" : "GET",
      headers: Object.assign({ "Content-Type": "application/json" }, S.token ? { Authorization: "Bearer " + S.token } : {}),
      body: body ? JSON.stringify(body) : undefined,
    });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401 && route !== "login") { logout(); throw new Error("session expirée"); }
    if (!r.ok) throw new Error(d.error || "erreur " + r.status);
    return d;
  }

  // ------------------------------------------------------------------ connexion
  function showLogin(msg) {
    $("login").classList.remove("hidden"); $("main").classList.add("hidden");
    $("bExport").classList.add("hidden"); $("bLogout").classList.add("hidden");
    $("loginMsg").textContent = msg || ""; $("pwd").focus();
  }
  function logout() {
    S.token = null; try { sessionStorage.removeItem("qj.admin"); } catch (e) { /* rien */ }
    showLogin();
  }
  $("login").onsubmit = async (e) => {
    e.preventDefault();
    try {
      const d = await call("login", { password: $("pwd").value });
      S.token = d.token; try { sessionStorage.setItem("qj.admin", d.token); } catch (e2) { /* rien */ }
      $("pwd").value = ""; start();
    } catch (err) { $("loginMsg").textContent = err.message; }
  };
  $("bLogout").onclick = logout;

  async function start() {
    try {
      const [pack, data] = await Promise.all([call("pack"), call("data")]);
      S.pack = pack; S.games = {}; for (const g of pack.games) S.games[g.key] = g;
      S.reports = data.reports; S.overrides = data.overrides;
    } catch (e) { return showLogin(e.message); }
    $("login").classList.add("hidden"); $("main").classList.remove("hidden");
    $("bExport").classList.remove("hidden"); $("bLogout").classList.remove("hidden");
    renderList();
    if (S.sel) renderEdit();
  }
  async function refresh() {
    const data = await call("data");
    S.reports = data.reports; S.overrides = data.overrides;
    renderList(); renderEdit();
  }

  // ------------------------------------------------------------------ liste
  const scene = (id) => S.pack.scenes.find((s) => s.id === id);
  const current = (sc) => {
    const o = S.overrides.scenes[sc.id] || {};
    return { id: sc.id, game: o.game || sc.game, place: o.place || sc.place, x: o.x != null ? o.x : sc.x, y: o.y != null ? o.y : sc.y, deleted: !!o.deleted, changed: !!S.overrides.scenes[sc.id] };
  };
  const title = (key) => (S.games[key] ? S.games[key].t : key);
  function renderList() {
    const q = $("search").value.trim().toLowerCase();
    const open = S.reports.filter((r) => r.status === "open");
    $("nOpen").textContent = open.length ? "(" + open.length + ")" : "";
    $("openOnlyBox").classList.toggle("hidden", S.tab !== "reports");
    let rows = [];
    if (S.tab === "reports") {
      const by = new Map();
      for (const r of S.reports) {
        if ($("openOnly").checked && r.status !== "open") continue;
        if (!by.has(r.sid)) by.set(r.sid, []);
        by.get(r.sid).push(r);
      }
      rows = [...by.entries()].map(([sid, rs]) => ({ sid, rs, last: rs.reduce((m, r) => (r.at > m ? r.at : m), "") })).sort((a, b) => (b.last > a.last ? 1 : -1));
    } else {
      rows = S.pack.scenes.map((sc) => ({ sid: sc.id, rs: S.reports.filter((r) => r.sid === sc.id && r.status === "open") }));
    }
    rows = rows.filter(({ sid }) => {
      const sc = scene(sid); if (!sc) return !q || sid.includes(q);
      const c = current(sc);
      return !q || (sid + " " + title(c.game) + " " + c.place).toLowerCase().includes(q);
    });
    $("items").innerHTML = rows.length ? rows.map(({ sid, rs }) => {
      const sc = scene(sid), c = sc && current(sc);
      const kinds = [...new Set(rs.map((r) => r.kind))].map((k) => "<span class='tag'>" + esc(KIND[k] || k) + "</span>").join(" ");
      return "<button type='button' class='adm-item" + (S.sel === sid ? " on" : "") + "' data-sid='" + esc(sid) + "'>"
        + "<b>" + esc(c ? title(c.game) : "Vue inconnue") + "</b><span class='mut'>" + esc(c ? c.place : sid) + "</span>"
        + "<span class='adm-tags'>" + (rs.length ? "<span class='tag acc'>" + rs.length + "</span> " : "") + kinds
        + (c && c.deleted ? " <span class='tag bad'>supprimée</span>" : c && c.changed ? " <span class='tag good'>corrigée</span>" : "") + "</span></button>";
    }).join("") : "<p class='mut small'>" + (S.tab === "reports" ? "Aucun signalement." : "Aucune vue.") + "</p>";
    for (const b of $("items").querySelectorAll(".adm-item")) b.onclick = () => select(S.sel === b.dataset.sid ? null : b.dataset.sid);
  }
  // sélection d'une vue (null = aucune) ; sur téléphone la fiche remplace la liste
  function select(sid) {
    const y = window.scrollY;
    S.sel = sid; S.draft = null;
    $("main").classList.toggle("has-sel", !!sid);
    renderList(); renderEdit();
    if (sid && matchMedia("(max-width: 860px)").matches) window.scrollTo(0, 0);
    else if (!sid) window.scrollTo(0, S.listY || 0);
    if (sid) S.listY = y;
  }
  for (const b of $("tabs").children) b.onclick = () => { S.tab = b.dataset.t; for (const x of $("tabs").children) x.classList.toggle("on", x === b); renderList(); };
  $("search").oninput = renderList;
  $("openOnly").onchange = renderList;

  // ------------------------------------------------------------------ édition d'une vue
  function mapOf(key) { const m = DISPO.maps[key]; return m ? { url: "packs/img/map-" + key + ".jpg", w: m[0], h: m[1] } : null; }
  function renderEdit() {
    const box = $("edit"), sc = S.sel && scene(S.sel);
    if (!sc) { box.innerHTML = "<p class='mut'>" + (S.sel ? "Vue inconnue : " + esc(S.sel) + " (retirée du pack ?)" : "Choisis une vue dans la liste.") + "</p>"; return; }
    const c = current(sc);
    if (!S.draft) S.draft = { game: c.game, place: c.place, x: c.x, y: c.y };
    const d = S.draft, rs = S.reports.filter((r) => r.sid === sc.id).sort((a, b) => (b.at > a.at ? 1 : -1));
    const opts = Object.values(S.games).sort((a, b) => a.t.localeCompare(b.t)).map((g) => "<option value='" + esc(g.key) + "'" + (g.key === d.game ? " selected" : "") + ">" + esc(g.t) + "</option>").join("");
    box.innerHTML = "<div class='row adm-edit-head'><button class='btn sm ghost adm-back' id='eBack' type='button'>← Liste</button><h2 class='grow' style='margin:0'>" + esc(title(c.game)) + "</h2>"
      + "<button class='btn icon adm-close' id='eClose' type='button' title='Fermer' aria-label='Fermer la vue'><svg viewBox='0 0 24 24' aria-hidden='true'><path d='M6 6 L18 18 M18 6 L6 18' stroke='currentColor' stroke-width='2.2' stroke-linecap='round'/></svg></button></div>"
      + "<div class='mut small'>" + esc(sc.id) + "</div>"
      + (c.deleted ? "<div class='notice small'>Cette vue est supprimée : les joueurs ne la voient plus.</div>" : c.changed ? "<div class='notice small'>Vue corrigée (original : " + esc(title(sc.game)) + " · " + esc(sc.place) + ").</div>" : "")
      + "<div class='adm-shot'><img src='packs/img/" + esc(sc.id) + ".jpg' alt='Capture'></div>"
      + "<div class='adm-fields'><label class='f'>Jeu<select id='eGameSel'>" + opts + "</select></label>"
      + "<label class='f'>Lieu<input type='text' id='ePlace' maxlength='80' value='" + esc(d.place) + "'></label></div>"
      + "<div class='mut small'>Touche la carte pour déplacer le repère.</div>"
      + "<div class='adm-map'><div id='eMap' class='mapview'></div></div>"
      + "<div class='row wrap-ok'><button class='btn pri grow' id='eSaveBtn' type='button'>Enregistrer</button>"
      + (c.changed ? "<button class='btn' id='eReset' type='button'>Rétablir l'original</button>" : "")
      + "<button class='btn danger' id='eDel' type='button'>Supprimer la vue</button></div>"
      + "<h3 style='margin:14px 0 6px'>Signalements (" + rs.length + ")</h3>"
      + (rs.length ? rs.map((r) => "<div class='adm-rep st-" + r.status + "'><div class='row wrap-ok'><b>" + esc(KIND[r.kind] || r.kind) + "</b><span class='mut small'>" + esc(new Date(r.at).toLocaleString("fr-FR")) + (r.name ? " · " + esc(r.name) : "") + "</span><div class='grow'></div><span class='tag'>" + esc(STATUS[r.status] || r.status) + "</span></div>"
        + (r.comment ? "<div class='adm-com'>" + esc(r.comment) + "</div>" : "")
        + "<div class='row wrap-ok'>" + (r.pin ? "<button class='btn sm' data-use='" + r.id + "' type='button'>Utiliser sa position</button>" : "")
        + (r.status !== "resolved" ? "<button class='btn sm' data-st='resolved' data-id='" + r.id + "' type='button'>Résolu</button>" : "")
        + (r.status !== "ignored" ? "<button class='btn sm ghost' data-st='ignored' data-id='" + r.id + "' type='button'>Ignorer</button>" : "")
        + (r.status !== "open" ? "<button class='btn sm ghost' data-st='open' data-id='" + r.id + "' type='button'>Rouvrir</button>" : "")
        + "<button class='btn sm ghost danger' data-rm='" + r.id + "' type='button'>Effacer</button></div></div>").join("") : "<p class='mut small'>Aucun.</p>");
    $("eBack").onclick = $("eClose").onclick = () => select(null);
    S.map = new MapView($("eMap"), { pageWheel: true, onTap: (x, y) => { d.x = x; d.y = y; drawPins(); } });
    const m = mapOf(d.game);
    if (m) requestAnimationFrame(() => { S.map.setImage(m.url, m.w, m.h); drawPins(true); });
    $("eGameSel").onchange = () => {
      d.game = $("eGameSel").value; d.x = null; d.y = null;
      const m2 = mapOf(d.game); if (m2) { S.map.setImage(m2.url, m2.w, m2.h); drawPins(); }
      toast("Autre jeu : touche sa carte pour placer le lieu.");
    };
    $("ePlace").oninput = () => (d.place = $("ePlace").value);
    $("eSaveBtn").onclick = save;
    $("eDel").onclick = async () => { if (!confirm("Supprimer cette vue ? Les joueurs ne la verront plus (réversible ici).")) return; await act({ id: sc.id, deleted: true }, "Vue supprimée"); };
    if ($("eReset")) $("eReset").onclick = () => act({ id: sc.id, reset: true }, "Vue rétablie");
    for (const b of box.querySelectorAll("[data-use]")) b.onclick = () => { const r = rs.find((x) => x.id === b.dataset.use); d.x = r.pin.x; d.y = r.pin.y; drawPins(); };
    for (const b of box.querySelectorAll("[data-st]")) b.onclick = () => repAct({ id: b.dataset.id, status: b.dataset.st });
    for (const b of box.querySelectorAll("[data-rm]")) b.onclick = () => repAct({ id: b.dataset.rm, remove: true });
  }
  function drawPins(focus) {
    const sc = scene(S.sel), d = S.draft;
    if (!sc || !S.map) return;
    const pins = [], lines = [];
    if (sc.game === d.game && (sc.x !== d.x || sc.y !== d.y)) pins.push({ x: sc.x, y: sc.y, color: "#8b9fb1", label: "Origine" });
    for (const r of S.reports) if (r.sid === sc.id && r.pin && d.game === sc.game) pins.push({ x: r.pin.x, y: r.pin.y, color: "#4cc9c0", label: r.name || "Proposé" });
    if (d.x != null) pins.push({ x: d.x, y: d.y, goal: true, label: "Lieu" });
    S.map.setPins(pins, lines);
    if (focus && pins.length) S.map.focus(pins);
  }
  async function save() {
    const sc = scene(S.sel), d = S.draft;
    if (d.x == null) return toast("Place le lieu sur la carte avant d'enregistrer.");
    const body = { id: sc.id, place: d.place };
    if (d.game !== sc.game) body.game = d.game;
    if (d.game !== sc.game || d.x !== sc.x || d.y !== sc.y) { body.x = d.x; body.y = d.y; }
    const same = d.game === sc.game && d.x === sc.x && d.y === sc.y && d.place === sc.place;
    await act(same ? { id: sc.id, reset: true } : body, "Correction enregistrée");
  }
  async function act(body, msg) {
    try { await call("scene", body); S.draft = null; await refresh(); toast(msg); } catch (e) { toast("Échec : " + e.message, 4000); }
  }
  async function repAct(body) {
    try { await call("report", body); await refresh(); } catch (e) { toast("Échec : " + e.message, 4000); }
  }

  // ------------------------------------------------------------------ export
  $("bExport").onclick = () => {
    const blob = new Blob([JSON.stringify({ exported: new Date().toISOString(), overrides: S.overrides, reports: S.reports }, null, 1)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "gamespotter-corrections.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  if (S.token) start(); else showLogin();
})();
