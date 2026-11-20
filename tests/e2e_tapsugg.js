// Téléphone : glisser sur la liste de suggestions (pour replier le clavier) ne valide rien, un tap valide ;
// « Manche suivante » montre une roue et un double appui ne saute pas de manche.
// Depuis la racine du dépôt : node tests/e2e_tapsugg.js
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const PORT = 8837, URL = "http://localhost:" + PORT + "/";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, msg) => { console.log((ok ? "OK   " : "ÉCHEC") + " " + msg); if (!ok) process.exitCode = 1; };
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, "..", "server", "server.js")], { env: Object.assign({}, process.env, { PORT: String(PORT), QJ_JEUX: "gtav,rdr2" }), stdio: "ignore" });
  await wait(800);
  const b = await chromium.launch(); const errs = [];
  try {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(String(e)));
    await p.goto(URL); await p.fill("#pseudo", "Test"); await p.click("#bSolo"); await wait(300); await p.click("#bStart");
    await p.waitForFunction("QJ.A.R && QJ.A.R.phase === 'name'");
    const cdp = await ctx.newCDPSession(p);
    const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
    await p.fill("#gInput", ""); await p.type("#gInput", "grand theft"); await wait(300);
    check(await p.isVisible("#sugg"), "suggestions affichées (" + (await p.$$eval("#sugg button", (bs) => bs.length)) + ")");
    const r = await p.locator("#sugg button").first().boundingBox();
    // glisser sur la liste (vers le bas, comme pour replier le clavier)
    await touch("touchStart", r.x + r.width / 2, r.y + r.height / 2);
    for (let k = 1; k <= 6; k++) { await touch("touchMove", r.x + r.width / 2, r.y + r.height / 2 + k * 12); await wait(16); }
    await touch("touchEnd"); await wait(400);
    check((await p.evaluate("QJ.A.R.phase")) === "name" && (await p.evaluate("QJ.A.R.errors")) === 0, "glissement sur une suggestion : rien n'est validé");
    // tap sur une suggestion : validé
    await p.fill("#gInput", ""); await p.type("#gInput", "grand theft"); await wait(300);
    const r2 = await p.locator("#sugg button").first().boundingBox(), t2 = await p.locator("#sugg button").first().innerText();
    await touch("touchStart", r2.x + r2.width / 2, r2.y + r2.height / 2); await wait(60); await touch("touchEnd"); await wait(500);
    const ph = await p.evaluate("QJ.A.R.phase"), errsN = await p.evaluate("QJ.A.R.errors");
    check(ph === "map" || errsN === 1, "tap sur « " + t2 + " » : proposition envoyée (" + (ph === "map" ? "bon jeu" : "raté") + ")");
    // passer la manche, puis « Manche suivante » : roue, et un double appui ne saute pas de manche
    if (ph !== "map") { await p.evaluate("QJ.submitGuess(QJ.A.R.game.t)"); await wait(300); }
    await p.evaluate("(()=>{const R=QJ.A.R; R.pin={x:R.info.x,y:R.info.y}; QJ.validatePin();})()");
    await p.waitForFunction("QJ.A.screen === 'reveal'");
    await wait(300);
    const i0 = await p.evaluate("QJ.A.st.i");
    await p.evaluate("const b = document.getElementById('bNext'); b.click(); window.__busy = b.classList.contains('busy') && !!b.querySelector('.spin'); b.click();");
    check(await p.evaluate("window.__busy"), "« Manche suivante » : roue de chargement dès le premier appui");
    await p.waitForFunction("QJ.A.screen === 'game'", null, { timeout: 5000 }); await wait(500);
    check((await p.evaluate("QJ.A.st.i")) === i0 + 1, "double appui : une seule manche plus loin (" + i0 + " → " + (await p.evaluate("QJ.A.st.i")) + ")");
    check(!(await p.evaluate("document.getElementById('bNext').classList.contains('busy')")) && (await p.evaluate("document.getElementById('bNext').textContent")).length > 0, "bouton remis en état après le changement d'écran");
    check(errs.length === 0, "erreurs JS : " + (errs.join(" | ") || "aucune"));
  } catch (e) { console.log("ÉCHEC", e); process.exitCode = 1; } finally { srv.kill(); await b.close(); process.exit(); }
})();
