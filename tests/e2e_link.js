// Lien de partie : /CODE sur le site (page servie pour ce chemin), #CODE et ancien #partie-code acceptés.
// Depuis la racine du dépôt : node tests/e2e_link.js
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const PORT = 8812, URL = "http://localhost:" + PORT + "/";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, msg) => { console.log((ok ? "OK   " : "ÉCHEC") + " " + msg); if (!ok) process.exitCode = 1; };
(async () => {
  const srv = spawn(process.execPath, [require("path").join(__dirname, "..", "server", "server.js")], { env: Object.assign({}, process.env, { PORT: String(PORT) }), stdio: "ignore" });
  await wait(800);
  const b = await chromium.launch(); const errs = [], bad = [];
  const open = async (n, u) => { const p = await (await b.newContext()).newPage(); p.on("pageerror", (e) => errs.push(n + ": " + e)); p.on("response", (r) => { if (r.status() >= 400 && !/dispo/.test(r.url())) bad.push(r.status() + " " + r.url()); }); await p.goto(u || URL); await p.fill("#pseudo", n); return p; };
  const H = await open("Hôte");
  await H.click("#bHost"); await wait(1200);
  const code = (await H.innerText("#codeBox")).trim();
  check(new globalThis.URL(H.url()).pathname === "/" + code && !H.url().includes("#"), "lien de l'hôte : " + H.url());
  const C = await open("Client", URL + code);
  check((await C.inputValue("#joinCode")) === code, "lien ouvert : code prérempli (" + (await C.inputValue("#joinCode")) + ")");
  check(await C.evaluate("!!window.QJ && !!document.querySelector('meta[name=qj-server]')"), "page complète servie sous /" + code);
  await C.click("#bJoin"); await wait(1500);
  check((await C.evaluate("QJ.A.screen")) === "lobby" && new globalThis.URL(C.url()).pathname === "/" + code, "client dans le salon, même lien");
  await C.click("#bLobbyBack"); await wait(500);
  check(new globalThis.URL(C.url()).pathname === "/" && !C.url().includes("#"), "retour à l'accueil : lien nu (" + C.url() + ")");
  const O = await open("Ancien", URL + "#partie-" + code.toLowerCase());
  check((await O.inputValue("#joinCode")) === code, "ancien lien #partie- encore accepté");
  const P = await open("Hash", URL + "#" + code);
  check((await P.inputValue("#joinCode")) === code, "lien #CODE accepté");
  for (const pth of ["packs/vrais-jeux.js", "admin"]) { const r = await fetch(URL + pth); check(r.status === 200 && !(await r.text()).includes('id="joinCode"'), "/" + pth + " n'est pas pris pour un code"); }
  check(bad.length === 0, "aucune ressource en erreur : " + (bad.join(" | ") || "ok"));
  check(errs.length === 0, "erreurs JS : " + (errs.join(" | ") || "aucune"));
  srv.kill(); await b.close(); process.exit();
})();
