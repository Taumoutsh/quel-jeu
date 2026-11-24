// Lien de partie : /CODE sur le site (page servie pour ce chemin), #CODE et ancien #partie-code acceptés ;
// ouvrir le lien mène directement dans le salon (sans passer par l'accueil ni cliquer sur « Rejoindre ») ;
// un lien vers une partie qui n'existe pas ramène à l'accueil avec un message.
// Depuis la racine du dépôt : node tests/e2e_link.js
const { chromium } = require("./pw");
const { spawn } = require("child_process");
const PORT = 8812, URL = "http://localhost:" + PORT + "/";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, msg) => { console.log((ok ? "OK   " : "ÉCHEC") + " " + msg); if (!ok) process.exitCode = 1; };
(async () => {
  const srv = spawn(process.execPath, [require("path").join(__dirname, "..", "server", "server.js")], { env: Object.assign({}, process.env, { PORT: String(PORT) }), stdio: "ignore" });
  await wait(800);
  const b = await chromium.launch(); const errs = [], bad = [];
  const page = async (n) => { const p = await (await b.newContext()).newPage(); p.on("pageerror", (e) => errs.push(n + ": " + e)); p.on("response", (r) => { if (r.status() >= 400 && !/dispo|\/api\/rooms/.test(r.url())) bad.push(r.status() + " " + r.url()); }); return p; };
  // page ouverte par un lien : on note si l'accueil a été visible (écran d'attente absent) pendant l'arrivée
  const openLink = async (n, u) => {
    const p = await page(n);
    await p.addInitScript(() => { window.__homeSeen = false; const t = setInterval(() => { const h = document.getElementById("home"), w = document.getElementById("linkWait"); if (h && w && !h.classList.contains("hidden") && w.classList.contains("hidden") && window.QJ && QJ.A.screen === "home" && !document.getElementById("joinErr").textContent) window.__homeSeen = true; if (window.QJ && QJ.A.screen === "lobby") clearInterval(t); }, 20); });
    await p.goto(u); return p;
  };
  const H = await page("Hôte"); await H.goto(URL); await H.fill("#pseudo", "Hôte");
  await H.click("#bHost"); await wait(1200);
  const code = (await H.innerText("#codeBox")).trim();
  check(new globalThis.URL(H.url()).pathname === "/" + code && !H.url().includes("#"), "lien de l'hôte : " + H.url());
  const C = await openLink("Client", URL + code);
  check(await C.evaluate("!!window.QJ && !!document.querySelector('meta[name=qj-server]')"), "page complète servie sous /" + code);
  await C.waitForFunction("QJ.A.screen === 'lobby' && QJ.A.mode === 'guest'", null, { timeout: 10000 });
  check(new globalThis.URL(C.url()).pathname === "/" + code, "lien ouvert : directement dans le salon, même lien");
  check(!(await C.evaluate("window.__homeSeen")) && (await C.evaluate("document.getElementById('linkWait').classList.contains('hidden')")), "l'accueil n'est pas passé à l'écran, attente refermée");
  const nm = await C.evaluate("QJ.A.name || ''");
  check(nm.length > 0, "sans pseudo : pseudo aléatoire (« " + nm + " »)");
  await H.waitForFunction("QJ.A.peers.length === 2", null, { timeout: 8000 }).catch(() => {});
  check((await H.evaluate("QJ.A.peers.length")) === 2, "l'hôte voit le joueur arrivé par le lien");
  await C.click("#bLobbyBack"); await wait(500);
  check(new globalThis.URL(C.url()).pathname === "/" && !C.url().includes("#"), "retour à l'accueil : lien nu (" + C.url() + ")");
  for (const [n, u] of [["ancien lien #partie-", URL + "#partie-" + code.toLowerCase()], ["lien #CODE", URL + "#" + code]]) {
    const p = await openLink(n, u);
    const ok = await p.waitForFunction("QJ.A.screen === 'lobby' && QJ.A.code === " + JSON.stringify(code), null, { timeout: 10000 }).then(() => true, () => false);
    check(ok, n + " : directement dans le salon");
  }
  // partie inexistante : retour à l'accueil, code prérempli, message
  const Z = await openLink("Inconnu", URL + "ZZZZ9");
  await Z.waitForFunction("document.getElementById('joinErr').textContent.length > 0", null, { timeout: 10000 }).catch(() => {});
  check((await Z.evaluate("QJ.A.screen")) === "home" && (await Z.inputValue("#joinCode")) === "ZZZZ9" && (await Z.evaluate("document.getElementById('linkWait').classList.contains('hidden')")),
    "partie inexistante : accueil, « " + (await Z.textContent("#joinErr")).trim() + " »");
  for (const pth of ["packs/vrais-jeux.js", "admin"]) { const r = await fetch(URL + pth); check(r.status === 200 && !(await r.text()).includes('id="joinCode"'), "/" + pth + " n'est pas pris pour un code"); }
  check(bad.length === 0, "aucune ressource en erreur : " + (bad.join(" | ") || "ok"));
  check(errs.length === 0, "erreurs JS : " + (errs.join(" | ") || "aucune"));
  srv.kill(); await b.close(); process.exit();
})();
