// Parties simultanées limitées (QJ_MAX_PARTIES, ici 2) : la 3e création est refusée avec un message ;
// tenter un code inconnu n'occupe pas de place ; une place libérée permet de créer à nouveau.
// Depuis la racine du dépôt : node tests/e2e_maxparties.js [dossier_captures]
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const PORT = 8831, URL = "http://localhost:" + PORT + "/";
const OUT = process.argv[2] || "/tmp";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, msg) => { console.log((ok ? "OK   " : "ÉCHEC") + " " + msg); if (!ok) process.exitCode = 1; };
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, "..", "server", "server.js")], { env: Object.assign({}, process.env, { PORT: String(PORT), QJ_MAX_PARTIES: "2" }), stdio: "ignore" });
  await wait(800);
  const b = await chromium.launch(); const errs = [];
  const open = async (n) => { const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); p.on("pageerror", (e) => errs.push(n + ": " + e)); await p.goto(URL); await p.fill("#pseudo", n); return p; };
  const host = async (p) => { await p.click("#bHost"); await wait(1200); return p.evaluate("QJ.A.screen === 'lobby' && QJ.A.mode === 'host' ? QJ.A.code : ''"); };
  try {
    const A = await open("Alice"), B = await open("Bruno"), C = await open("Chloé");
    const ca = await host(A), cb = await host(B);
    check(!!ca && !!cb, "deux parties créées (" + ca + ", " + cb + ")");
    // une tentative de rejoindre un code inconnu ne prend pas de place
    await C.fill("#joinCode", "ZZZZZ"); await C.click("#bJoin"); await wait(2500);
    check((await C.textContent("#joinErr")).includes("Aucune partie"), "code inconnu : « " + (await C.textContent("#joinErr")) + " »");
    // 3e création refusée
    check((await host(C)) === "", "3e partie refusée");
    const msg = await C.textContent("#hostErr");
    check(await C.isVisible("#hostErr") && msg.includes("Trop de parties") && msg.includes("2 au maximum"), "message : « " + msg + " »");
    check((await C.evaluate("QJ.A.screen")) === "home", "Chloé reste sur l'accueil");
    await C.screenshot({ path: path.join(OUT, "maxparties.png") });
    // un invité peut toujours rejoindre une partie existante
    await C.fill("#joinCode", ca); await C.click("#bJoin"); await wait(2500);
    check((await C.evaluate("QJ.A.mode")) === "guest" && (await C.evaluate("QJ.A.code")) === ca, "rejoindre une partie existante reste possible");
    check(!(await C.isVisible("#hostErr")), "message effacé après une autre action");
    // Bruno ferme sa partie : une place se libère
    await B.click("#bLobbyBack"); await wait(800);
    const D = await open("Dina");
    check(!!(await host(D)), "après un départ, une nouvelle partie peut être créée");
    check(errs.length === 0, "erreurs JS : " + (errs.join(" | ") || "aucune"));
  } catch (e) { console.log("ÉCHEC", e); process.exitCode = 1; } finally { srv.kill(); await b.close(); process.exit(); }
})();
