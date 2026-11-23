// Boost de rapidité : jusqu'à +500, plein en moins de 15 s, nul à 90 s (ou à la fin de la manche si plus courte),
// multiplié par la justesse du repère. Jauge « Boost » (éclair en SVG) sans chiffre pendant la manche ; « Boost +n » à la
// validation ; « n » avec l’éclair à côté du score de la manche dans les résultats. Réglage « Non » : ni jauge ni boost.
// Depuis la racine du dépôt : node tests/e2e_boost.js
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
    const calc = await p.evaluate(() => [[10, 1000, 120], [15, 1000, 120], [52.5, 1000, 120], [90, 1000, 120], [10, 500, 120], [37.5, 1000, 60], [52.5, 1000, 0]].map(([s, l, t]) => QJ.speedPoints(s, l, { time: t })));
    check(JSON.stringify(calc) === "[500,500,250,0,250,250,250]", "calcul : 10 s → 500, 15 s → 500, 52,5 s → 250, 90 s → 0, repère à moitié juste → 250, chrono 1 min (fin à 60 s), illimité (fin à 90 s) " + JSON.stringify(calc));
    check((await p.textContent("#home")).includes("boost jusqu'à +500"), "règle affichée dans « Comment jouer »");
    await p.fill("#pseudo", "Test"); await p.click("#bSolo"); await wait(300);
    check(await p.evaluate("QJ.A.cfg.speed === 1"), "réglage « Boost de rapidité » : Oui par défaut");
    await p.click("#bStart"); await p.waitForFunction("QJ.A.R && QJ.A.R.phase === 'name'"); await wait(800);
    const g1 = await p.evaluate(() => { const el = document.querySelector("#pName .boost"); return { vis: !!el.offsetParent, txt: el.innerText.trim(), lvl: el.dataset.lvl, w: el.querySelector(".bfill").style.width }; });
    check(g1.vis && g1.lvl === "full" && g1.w === "100%", "jauge pleine au début de la manche (" + JSON.stringify(g1) + ")");
    check(!/\d/.test(g1.txt), "aucun chiffre dans la jauge (« " + g1.txt + " »)");
    check(!(await p.$("#hSpeed")), "plus de compteur chiffré");
    await p.evaluate("QJ.A.R.t0 = Date.now() - 52500"); await wait(400);
    const g2 = await p.evaluate(() => { const el = document.querySelector("#pName .boost"); return { lvl: el.dataset.lvl, w: parseFloat(el.querySelector(".bfill").style.width) }; });
    check(near(g2.w, 50, 2) && g2.lvl === "mid", "la jauge se vide (" + JSON.stringify(g2) + " après 52,5 s)");
    await p.evaluate("QJ.submitGuess(QJ.A.R.game.t)"); await wait(300);
    const x0 = await p.evaluate("QJ.A.res[0]");
    check(x0[1] === 1000, "points du nom pleins, sans baisse (" + x0[1] + ")");
    check(await p.evaluate("!!document.querySelector('#pMap .boost').offsetParent"), "jauge aussi sur la carte");
    await p.evaluate("(()=>{const R=QJ.A.R; R.pin={x:R.info.x,y:R.info.y}; QJ.validatePin();})()");
    const wb = await p.textContent("#waitBoost");
    const x = await p.evaluate("QJ.A.res[0]");
    check(x[2] === 1000 && near(x[6], 250, 5), "boost stocké : position " + x[2] + ", boost " + x[6]);
    check(wb.replace(/\s+/g, " ").includes("Boost +" + x[6]), "écran d'attente : « " + wb.replace(/\s+/g, " ").trim() + " »");
    await p.waitForFunction("QJ.A.screen === 'reveal'"); await wait(400);
    const row = await p.evaluate(() => { const tr = document.querySelectorAll("#rvTable tr")[1]; return [...tr.querySelectorAll("td")].map((t) => t.innerText.replace(/\s+/g, " ").trim()); });
    const bolt = await p.evaluate(() => !!document.querySelector("#rvTable .bst svg.bolt") && !document.body.innerText.includes("\u26a1"));
    check(bolt, "éclair en SVG, plus d'emoji");
    check(row[3].includes(String(x[6])) && row[3].replace(/\D/g, "").startsWith(String(2000 + x[6])), "résultats : score de la manche avec le boost (" + row[3] + ")");
    const head = await p.evaluate(() => document.querySelectorAll("#rvTable th").length);
    check(head === 5, "pas de colonne en plus (" + head + " colonnes)");
    check((await p.textContent("#hScore")).replace(/\D/g, "") === String(2000 + x[6]), "score total avec le boost");
    // réglage « Non »
    const q = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); q.on("pageerror", (e) => errs.push(String(e)));
    await q.goto(URL); await q.fill("#pseudo", "Test2"); await q.click("#bSolo"); await wait(300);
    await q.click("#settings .seg[data-k='speed'] button[data-v='0']"); await q.click("#bStart");
    await q.waitForFunction("QJ.A.R && QJ.A.R.phase === 'name'"); await wait(600);
    check(!(await q.evaluate("!!document.querySelector('#pName .boost').offsetParent")), "réglage Non : pas de jauge");
    await q.evaluate("QJ.submitGuess(QJ.A.R.game.t)"); await wait(150);
    await q.evaluate("(()=>{const R=QJ.A.R; R.pin={x:R.info.x,y:R.info.y}; QJ.validatePin();})()");
    check(!(await q.isVisible("#waitBoost")), "réglage Non : pas de boost à l'écran d'attente");
    await q.waitForFunction("QJ.A.screen === 'reveal'"); await wait(300);
    const y = await q.evaluate("QJ.A.res[0]");
    check(y[1] === 1000 && y[2] === 1000 && !y[6], "réglage Non : 1 000 + 1 000, sans boost (" + JSON.stringify(y) + ")");
    check(errs.length === 0, "erreurs JS : " + (errs.join(" | ") || "aucune"));
  } catch (e) { console.log("ÉCHEC", e); process.exitCode = 1; } finally { srv.kill(); await b.close(); process.exit(); }
})();
