// Résultats d'une manche, hôte passé sur un autre onglet : au bout de 20 s, les invités voient aussi
// « Manche suivante » ; leur appui fait passer la page de l'hôte (toujours en marche) à la manche suivante,
// sans changer d'hôte. Tant que l'hôte est sur la page, les invités attendent.
// Depuis la racine du dépôt : node tests/e2e_awaynext.js
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const PORT = 8859, URL = "http://localhost:" + PORT + "/";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, msg) => { console.log((ok ? "OK   " : "ÉCHEC") + " " + msg); if (!ok) process.exitCode = 1; };
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, "..", "server", "server.js")], { env: Object.assign({}, process.env, { PORT: String(PORT), QJ_JEUX: "gtav,rdr2" }), stdio: "ignore" });
  await wait(800);
  const b = await chromium.launch(); const errs = [];
  try {
    const open = async (n) => { const p = await (await b.newContext()).newPage(); p.on("pageerror", (e) => errs.push(n + ": " + e)); await p.goto(URL); await p.fill("#pseudo", n); return p; };
    const H = await open("Hôte"), G = await open("Invité");
    await H.click("#bHost"); await wait(1200);
    const code = (await H.innerText("#codeBox")).trim();
    await G.fill("#joinCode", code); await G.click("#bJoin"); await wait(1500);
    for (const p of [G, H]) { await p.click("#bReady"); await wait(300); }
    for (const p of [H, G]) await p.waitForFunction("QJ.A.R && QJ.A.R.phase === 'name'", null, { timeout: 15000 });
    for (const p of [H, G]) { await p.evaluate("QJ.submitGuess(QJ.A.R.game.t)"); await wait(150); await p.evaluate("(()=>{const R=QJ.A.R; R.pin={x:R.info.x,y:R.info.y}; QJ.validatePin();})()"); }
    await G.waitForFunction("QJ.A.screen === 'reveal'", null, { timeout: 10000 }); await wait(1500);
    const vis = (p) => p.evaluate("[!document.getElementById('bNext').classList.contains('hidden'), !document.getElementById('rvWait').classList.contains('hidden'), !document.getElementById('rvAway').classList.contains('hidden')]");
    let v = await vis(G);
    check(!v[0] && v[1], "hôte sur la page : l'invité attend (« L'hôte va lancer la suite… »)");
    // l'hôte passe sur un autre onglet
    await H.evaluate("Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange'))");
    await wait(10000);
    v = await vis(G);
    check(!v[0] && v[1], "hôte caché depuis 10 s : l'invité attend encore");
    await G.waitForFunction("!document.getElementById('bNext').classList.contains('hidden')", null, { timeout: 20000 });
    v = await vis(G);
    check(v[0] && !v[1] && v[2], "hôte caché depuis plus de 20 s : « Manche suivante » et explication chez l'invité");
    check((await H.evaluate("QJ.A.mode")) === "host", "l'hôte est toujours hôte");
    await G.click("#bNext");
    const ok = await G.waitForFunction("QJ.A.st.i === 1 && QJ.A.st.ph === 'play'", null, { timeout: 8000 }).then(() => true, () => false);
    check(ok, "appui de l'invité : manche 2 lancée par la page de l'hôte");
    check((await H.evaluate("QJ.A.mode")) === "host" && (await G.evaluate("QJ.A.mode")) === "guest", "rôles inchangés (hôte / invité)");
    check((await G.evaluate("QJ.A.screen")) === "game", "l'invité est dans la manche 2");
    check(errs.length === 0, "erreurs JS : " + (errs.join(" | ") || "aucune"));
  } catch (e) { console.log("ÉCHEC", e); process.exitCode = 1; } finally { srv.kill(); await b.close(); process.exit(); }
})();
