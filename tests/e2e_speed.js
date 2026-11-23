// Bonus de rapidité : jusqu'à +500 pour une manche finie en moins de 15 s, puis il baisse jusqu'à 0 à 90 s
// (ou à la durée de la manche si elle est plus courte), proportionnel aux points de position.
// Badge « Bonus » pendant la manche, colonne « Vitesse » aux résultats ; réglage « Non » : rien de tout ça.
// Depuis la racine du dépôt : node tests/e2e_speed.js
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const PORT = 8866, URL = "http://localhost:" + PORT + "/";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, msg) => { console.log((ok ? "OK   " : "ÉCHEC") + " " + msg); if (!ok) process.exitCode = 1; };
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, "..", "server", "server.js")], { env: Object.assign({}, process.env, { PORT: String(PORT), QJ_JEUX: "gtav,botw" }), stdio: "ignore" });
  await wait(800);
  const b = await chromium.launch(); const errs = [];
  try {
    const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); p.on("pageerror", (e) => errs.push(String(e)));
    await p.goto(URL);
    // calcul
    const calc = await p.evaluate(() => [QJ.speedPoints(10, 1000, { time: 120 }), QJ.speedPoints(52.5, 1000, { time: 120 }), QJ.speedPoints(100, 1000, { time: 120 }), QJ.speedPoints(10, 500, { time: 120 }), QJ.speedPoints(37.5, 1000, { time: 60 }), QJ.speedPoints(52.5, 1000, { time: 0 })]);
    check(JSON.stringify(calc) === "[500,250,0,250,250,250]", "calcul : 10 s → 500, 52,5 s → 250, 100 s → 0, position à moitié → moitié, chrono 1 min (fin à 60 s), temps illimité (fin à 90 s) " + JSON.stringify(calc));
    await p.fill("#pseudo", "Test"); await p.click("#bSolo"); await wait(300);
    check(await p.evaluate("QJ.A.cfg.speed === 1 && document.querySelector(\"#settings .seg[data-k='speed'] button.on\").dataset.v === '1'"), "réglage « Bonus de rapidité » : Oui par défaut");
    await p.click("#bStart"); await p.waitForFunction("QJ.A.R && QJ.A.R.phase === 'name'"); await wait(1200);
    check(await p.isVisible("#hSpeed") && (await p.textContent("#hSpeedV")) === "+500", "badge pendant la manche : « " + (await p.textContent("#hSpeed")).trim() + " »");
    // manche 1 : réponse en ~52 s simulées → environ 250
    await p.evaluate("QJ.A.R.t0 = Date.now() - 52500"); await wait(400);
    const shown = +(await p.textContent("#hSpeedV")).replace("+", "");
    check(shown >= 240 && shown <= 255, "le badge fond avec le temps (" + shown + " après 52 s)");
    await p.evaluate("QJ.submitGuess(QJ.A.R.game.t)"); await wait(150);
    await p.evaluate("(()=>{const R=QJ.A.R; R.pin={x:R.info.x,y:R.info.y}; QJ.validatePin();})()");
    await p.waitForFunction("QJ.A.screen === 'reveal'"); await wait(500);
    const x = await p.evaluate("QJ.A.res[0]");
    check(x[6] >= 240 && x[6] <= 255, "points de la manche : nom " + x[1] + ", position " + x[2] + ", vitesse " + x[6]);
    const head = await p.evaluate(() => [...document.querySelectorAll("#rvTable th")].map((t) => t.innerText.trim().toLowerCase()).filter(Boolean));
    check(head.includes("vit.") || head.includes("vitesse"), "colonne Vitesse aux résultats (" + head.join(" | ") + ")");
    check((await p.evaluate("QJ.A.res.reduce((t, x) => t + (x ? x[1] + x[2] + (x[6] || 0) : 0), 0)")) === 2000 + x[6], "le total compte le bonus");
    // réglage « Non »
    const q = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); q.on("pageerror", (e) => errs.push(String(e)));
    await q.goto(URL); await q.fill("#pseudo", "Test2"); await q.click("#bSolo"); await wait(300);
    await q.click("#settings .seg[data-k='speed'] button[data-v='0']"); await q.click("#bStart");
    await q.waitForFunction("QJ.A.R && QJ.A.R.phase === 'name'"); await wait(800);
    check(!(await q.isVisible("#hSpeed")), "réglage Non : pas de badge");
    await q.evaluate("QJ.submitGuess(QJ.A.R.game.t)"); await wait(150);
    await q.evaluate("(()=>{const R=QJ.A.R; R.pin={x:R.info.x,y:R.info.y}; QJ.validatePin();})()");
    await q.waitForFunction("QJ.A.screen === 'reveal'"); await wait(500);
    const y = await q.evaluate("QJ.A.res[0]");
    const head2 = await q.evaluate(() => [...document.querySelectorAll("#rvTable th")].map((t) => t.innerText.trim().toLowerCase()));
    check(!y[6] && !head2.includes("vit.") && !head2.includes("vitesse"), "réglage Non : pas de bonus ni de colonne (" + JSON.stringify(y) + ")");
    check(errs.length === 0, "erreurs JS : " + (errs.join(" | ") || "aucune"));
  } catch (e) { console.log("ÉCHEC", e); process.exitCode = 1; } finally { srv.kill(); await b.close(); process.exit(); }
})();
