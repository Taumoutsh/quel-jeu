// Points qui baissent avec le temps : coefficient de 100 % à 50 % en 90 s (ou en la durée de la manche si plus
// courte). Le jeu baisse tant qu'il n'est pas trouvé, la position à partir de là jusqu'à la validation du repère.
// Compteur en direct ; réglage « Non » : rien ne baisse.
// Depuis la racine du dépôt : node tests/e2e_decay.js
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const PORT = 8866, URL = "http://localhost:" + PORT + "/";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, msg) => { console.log((ok ? "OK   " : "ÉCHEC") + " " + msg); if (!ok) process.exitCode = 1; };
const near = (v, t, d) => Math.abs(v - t) <= (d || 8);
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, "..", "server", "server.js")], { env: Object.assign({}, process.env, { PORT: String(PORT), QJ_JEUX: "gtav,botw" }), stdio: "ignore" });
  await wait(800);
  const b = await chromium.launch(); const errs = [];
  try {
    const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); p.on("pageerror", (e) => errs.push(String(e)));
    await p.goto(URL);
    const calc = await p.evaluate(() => [0, 45, 90, 200].map((s) => QJ.decay(s, { time: 120 })).concat([QJ.decay(30, { time: 60 }), QJ.decay(45, { time: 0 })]));
    check(JSON.stringify(calc) === "[1,0.75,0.5,0.5,0.75,0.75]", "coefficient : 0 s → 100 %, 45 s → 75 %, 90 s et plus → 50 %, chrono 1 min (fin à 60 s), temps illimité (fin à 90 s) " + JSON.stringify(calc));
    check((await p.textContent("#home")).includes("baissent avec le temps"), "règle affichée dans « Comment jouer »");
    await p.fill("#pseudo", "Test"); await p.click("#bSolo"); await wait(300);
    check(await p.evaluate("QJ.A.cfg.speed === 1"), "réglage « Points qui baissent avec le temps » : Oui par défaut");
    await p.click("#bStart"); await p.waitForFunction("QJ.A.R && QJ.A.R.phase === 'name'"); await wait(800);
    check(await p.isVisible("#hSpeed") && (await p.textContent("#hSpeedL")) === "Jeu", "compteur pendant la recherche du jeu : « " + (await p.textContent("#hSpeed")).replace(/\s+/g, " ").trim() + " »");
    // jeu trouvé au bout de 45 s simulées → 750
    await p.evaluate("QJ.A.R.t0 = Date.now() - 45000"); await wait(400);
    const shown = +(await p.textContent("#hSpeedV")).replace(/\D/g, "");
    check(near(shown, 750), "le compteur baisse (" + shown + " après 45 s)");
    await p.evaluate("QJ.submitGuess(QJ.A.R.game.t)"); await wait(200);
    check((await p.textContent("#hSpeedL")) === "Position", "compteur pendant la pose du repère : « Position »");
    // repère parfait posé 45 s après le jeu → 750
    await p.evaluate("QJ.A.R.t1 = Date.now() - 45000");
    await p.evaluate("(()=>{const R=QJ.A.R; R.pin={x:R.info.x,y:R.info.y}; QJ.validatePin();})()");
    await p.waitForFunction("QJ.A.screen === 'reveal'"); await wait(400);
    const x = await p.evaluate("QJ.A.res[0]");
    check(near(x[1], 750) && near(x[2], 750) && x.length === 6, "points de la manche : jeu " + x[1] + ", position " + x[2]);
    const head = await p.evaluate(() => [...document.querySelectorAll("#rvTable th")].map((t) => t.innerText.trim().toLowerCase()));
    check(!head.some((h) => h.startsWith("vit")), "plus de colonne Vitesse (" + head.join(" | ") + ")");
    // réglage « Non »
    const q = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); q.on("pageerror", (e) => errs.push(String(e)));
    await q.goto(URL); await q.fill("#pseudo", "Test2"); await q.click("#bSolo"); await wait(300);
    await q.click("#settings .seg[data-k='speed'] button[data-v='0']"); await q.click("#bStart");
    await q.waitForFunction("QJ.A.R && QJ.A.R.phase === 'name'"); await wait(600);
    check(!(await q.isVisible("#hSpeed")), "réglage Non : pas de compteur");
    await q.evaluate("QJ.A.R.t0 = Date.now() - 80000"); await q.evaluate("QJ.submitGuess(QJ.A.R.game.t)"); await wait(150);
    await q.evaluate("QJ.A.R.t1 = Date.now() - 80000"); await q.evaluate("(()=>{const R=QJ.A.R; R.pin={x:R.info.x,y:R.info.y}; QJ.validatePin();})()");
    await q.waitForFunction("QJ.A.screen === 'reveal'"); await wait(300);
    const y = await q.evaluate("QJ.A.res[0]");
    check(y[1] === 1000 && y[2] === 1000, "réglage Non : points pleins malgré 80 s (" + y[1] + " + " + y[2] + ")");
    check(errs.length === 0, "erreurs JS : " + (errs.join(" | ") || "aucune"));
  } catch (e) { console.log("ÉCHEC", e); process.exitCode = 1; } finally { srv.kill(); await b.close(); process.exit(); }
})();
