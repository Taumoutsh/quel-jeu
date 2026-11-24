// Reconnexion : un invité perd sa connexion, son onglet se ferme (téléphone), puis il rouvre le lien de la partie
// dans un nouvel onglet du même navigateur. Il ne doit apparaître qu'une fois (pas d'ancien « Absent » à côté),
// retrouver ses réponses, et n'être qu'une fois dans le classement final.
// Depuis la racine du dépôt : node tests/e2e_rejoin.js
const { chromium } = require("./pw");
const { spawn } = require("child_process");
const path = require("path");
const PORT = 8858, URL = "http://localhost:" + PORT + "/";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, msg) => { console.log((ok ? "OK   " : "ÉCHEC") + " " + msg); if (!ok) process.exitCode = 1; };
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, "..", "server", "server.js")], { env: Object.assign({}, process.env, { PORT: String(PORT), QJ_JEUX: "gtav,rdr2" }), stdio: "ignore" });
  await wait(800);
  const b = await chromium.launch(); const errs = [];
  try {
    const hctx = await b.newContext(), gctx = await b.newContext();
    const H = await hctx.newPage(); H.on("pageerror", (e) => errs.push("H: " + e));
    await H.goto(URL); await H.fill("#pseudo", "Hôte");
    await H.click("#settings .seg[data-k='time'] button[data-v='0']").catch(() => {});
    await H.click("#bHost"); await wait(1200);
    const code = (await H.innerText("#codeBox")).trim();
    await H.click("#settings .seg[data-k='time'] button[data-v='0']"); // temps illimité : l'hôte termine la manche à la main
    const G1 = await gctx.newPage(); G1.on("pageerror", (e) => errs.push("G1: " + e));
    await G1.goto(URL + code); await G1.waitForFunction("QJ.A.screen === 'lobby'", null, { timeout: 10000 });
    const uid = await G1.evaluate("QJ.A.uid");
    await G1.evaluate("document.getElementById('bReady').click()"); await H.click("#bReady");
    await G1.waitForFunction("QJ.A.R && QJ.A.R.phase === 'name'", null, { timeout: 15000 });
    await H.waitForFunction("QJ.A.R && QJ.A.R.phase === 'name'", null, { timeout: 15000 });
    // manche 1 : les deux répondent
    for (const p of [H, G1]) { await p.evaluate("QJ.submitGuess(QJ.A.R.game.t)"); await wait(150); await p.evaluate("(()=>{const R=QJ.A.R; R.pin={x:R.info.x,y:R.info.y}; QJ.validatePin();})()"); }
    await H.waitForFunction("QJ.A.st.ph === 'rev'", null, { timeout: 10000 });
    const score1 = await G1.evaluate("QJ.A.res[0] ? QJ.A.res[0][1] + QJ.A.res[0][2] : 0");
    // coupure : réseau perdu, puis onglet fermé sans prévenir (téléphone)
    await gctx.setOffline(true); await G1.close({ runBeforeUnload: false }); await wait(3000);
    await H.click("#bNext"); await wait(800);
    // retour : nouvel onglet du même navigateur, lien de la partie
    await gctx.setOffline(false);
    const G2 = await gctx.newPage(); G2.on("pageerror", (e) => errs.push("G2: " + e));
    await G2.goto(URL + code);
    await G2.waitForFunction("QJ.A.st && QJ.A.st.i === 1", null, { timeout: 15000 });
    check((await G2.evaluate("QJ.A.uid")) === uid, "même identifiant de joueur dans le nouvel onglet");
    await wait(2500);
    const plH = await H.evaluate("(() => { const ps = []; for (const p of QJ.A.peers) { const pr = p.presence || {}; if (pr.n) ps.push(pr.n + (p.sameTab ? '*' : '')); } return ps; })()");
    const shownH = await H.evaluate("QJ.players ? QJ.players().map(p => p.name) : null");
    check(shownH && shownH.length === 2, "chez l'hôte : 2 joueurs affichés (" + JSON.stringify(shownH) + ", connexions : " + JSON.stringify(plH) + ")");
    const res = await G2.evaluate("QJ.A.res[0] ? QJ.A.res[0][1] + QJ.A.res[0][2] : 0");
    check(res === score1 && score1 > 0, "réponses de la manche 1 retrouvées (" + res + " / " + score1 + ")");
    // fin de partie : manches suivantes jouées par les deux, puis classement
    for (let i = 1; i < 5; i++) {
      for (const p of [H, G2]) { await p.waitForFunction("QJ.A.R && QJ.A.R.phase === 'name' && QJ.A.st.i === " + i, null, { timeout: 15000 }); await p.evaluate("QJ.submitGuess(QJ.A.R.game.t)"); await wait(150); await p.evaluate("(()=>{const R=QJ.A.R; R.pin={x:R.info.x,y:R.info.y}; QJ.validatePin();})()"); }
      await H.waitForFunction("QJ.A.st.ph === 'rev' && QJ.A.st.i === " + i, null, { timeout: 15000 }); await wait(300); await H.click("#bNext");
    }
    await G2.waitForFunction("QJ.A.screen === 'final'", null, { timeout: 15000 }); await wait(1500);
    for (const [n, p] of [["hôte", H], ["invité", G2]]) {
      const rows = await p.evaluate(() => [...document.querySelectorAll("#finTable tr.fin-pl .wn")].map((x) => x.textContent));
      check(rows.length === 2 && new Set(rows).size === 2, "classement final chez l'" + n + " : " + JSON.stringify(rows));
    }
    check(errs.length === 0, "erreurs JS : " + (errs.join(" | ") || "aucune"));
  } catch (e) { console.log("ÉCHEC", e); process.exitCode = 1; } finally { srv.kill(); await b.close(); process.exit(); }
})();
