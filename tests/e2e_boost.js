// Boost de rapidité : jusqu'à +500, en baisse dès le début de la manche, nul à 90 s (ou à la fin de la manche si plus courte),
// multiplié par la justesse du repère. Gélule « Boost » (éclair en SVG) sans chiffre pendant la manche, contour doré qui se retire par la droite ; « Boost +n » à la
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
    const calc = await p.evaluate(() => [[0, 1000, 120], [9, 1000, 120], [45, 1000, 120], [90, 1000, 120], [45, 500, 120], [30, 1000, 60], [45, 1000, 0]].map(([s, l, t]) => QJ.speedPoints(s, l, { time: t })));
    check(JSON.stringify(calc) === "[500,450,250,0,125,250,250]", "calcul (baisse dès le début) : 0 s → 500, 9 s → 450, 45 s → 250, 90 s → 0, repère à moitié juste à 45 s → 125, chrono 1 min (fin à 60 s), illimité (fin à 90 s) " + JSON.stringify(calc));
    check((await p.textContent("#home")).includes("boost jusqu'à +500"), "règle affichée dans « Comment jouer »");
    await p.fill("#pseudo", "Test"); await p.click("#bSolo"); await wait(300);
    check(await p.evaluate("QJ.A.cfg.speed === 1"), "réglage « Boost de rapidité » : Oui par défaut");
    await p.click("#bStart"); await p.waitForFunction("QJ.A.R && QJ.A.R.phase === 'name'"); await wait(800);
    const gel = () => p.evaluate(() => { const el = document.getElementById("hBoost"), r = el.getBoundingClientRect(); const pills = [...document.querySelectorAll(".hud .pill")].map((x) => getComputedStyle(x).borderRadius); return { vis: !el.classList.contains("hidden") && r.width > 0, txt: el.innerText.trim(), clip: [...el.querySelectorAll(".bring path")].map((x) => x.getAttribute("stroke-dasharray")).join(","), d: !!el.querySelector(".bring path").getAttribute("d"), fill: getComputedStyle(el).backgroundColor === getComputedStyle(document.querySelector(".hud .pill")).backgroundColor, pill: el.classList.contains("pill"), rad: getComputedStyle(el).borderRadius === pills[0], full: el.classList.contains("full") }; });
    const g1 = await gel();
    check(g1.vis && g1.pill && g1.rad && g1.fill && g1.d && g1.full && parseFloat(g1.clip) > 0.97 && parseFloat(g1.clip) < 1, "gélule Boost au contour doré presque complet au début, qui baisse déjà, même forme et même fond que les autres (" + JSON.stringify(g1) + ")");
    check(!/\d/.test(g1.txt), "aucun chiffre dans la gélule (« " + g1.txt + " »)");
    check(!(await p.$(".boost")), "plus de barre de progression dans les panneaux");
    check(!(await p.$("#hSpeed")), "plus de compteur chiffré");
    await p.evaluate("QJ.A.R.t0 = Date.now() - 45000"); await wait(400);
    const g2 = await gel(), len = parseFloat(g2.clip);
    check(near(len * 100, 50, 2) && !g2.full, "le contour se retire peu à peu (" + g2.clip + " après 45 s)");
    await p.evaluate("QJ.submitGuess(QJ.A.R.game.t)"); await wait(300);
    const x0 = await p.evaluate("QJ.A.res[0]");
    check(x0[1] === 1000, "points du nom pleins, sans baisse (" + x0[1] + ")");
    check((await gel()).vis, "gélule toujours là pendant la pose du repère");
    await p.evaluate("(()=>{const R=QJ.A.R; R.pin={x:R.info.x,y:R.info.y}; QJ.validatePin();})()");
    const wb = await p.textContent("#waitBoost"); const g3 = await gel();
    const bf = await p.evaluate("QJ.A.R.boostF");
    check(near(bf * 100, 49, 2) && (!g3.vis || near(parseFloat(g3.clip) * 100, bf * 100, 2)), "gélule figée à la validation (niveau " + bf.toFixed(2) + ")");
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
    // classement final en solo (partie d'une manche) : boost sous le total de la manche et dans le récapitulatif
    const f = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); f.on("pageerror", (e) => errs.push(String(e)));
    await f.goto(URL); await f.fill("#pseudo", "Test3"); await f.click("#bSolo"); await wait(300);
    await f.evaluate("QJ.A.cfg.rounds = 1"); await f.click("#bStart"); await f.waitForFunction("QJ.A.R && QJ.A.R.phase === 'name'"); await wait(300);
    await f.evaluate("QJ.A.R.t0 = Date.now() - 45000; QJ.A.R.errors = 1"); await f.evaluate("QJ.submitGuess(QJ.A.R.game.t)"); await wait(150);
    await f.evaluate("(()=>{const R=QJ.A.R; R.pin={x:R.info.x,y:R.info.y}; QJ.validatePin();})()");
    await f.waitForFunction("QJ.A.screen === 'reveal'"); await wait(300); await f.click("#bNext");
    await f.waitForFunction("QJ.A.screen === 'final'"); await wait(400);
    const fx = await f.evaluate("QJ.A.res[0][6]"), fin = await f.evaluate(() => ({ sum: document.getElementById("finSolo").innerText.replace(/\s+/g, " "), tab: document.getElementById("finTable").innerText.replace(/\s+/g, " "), bolt: !!document.querySelector("#finTable .bst svg.bolt") }));
    check(fx > 0 && fin.bolt && fin.tab.includes(String(fx)) && fin.sum.includes("dont " + fx + " de boost"), "classement final solo : boost affiché (" + fin.sum + " | " + fin.tab + ")");
    check(!/erreur/i.test(fin.tab) && fin.tab.includes("800"), "bilan sans le nombre d'erreurs (nom à 800 après 1 erreur)");
    // réglage « Non »
    const q = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); q.on("pageerror", (e) => errs.push(String(e)));
    await q.goto(URL); await q.fill("#pseudo", "Test2"); await q.click("#bSolo"); await wait(300);
    await q.click("#settings .seg[data-k='speed'] button[data-v='0']"); await q.click("#bStart");
    await q.waitForFunction("QJ.A.R && QJ.A.R.phase === 'name'"); await wait(600);
    check(await q.evaluate("document.getElementById('hBoost').classList.contains('hidden')"), "réglage Non : pas de gélule");
    await q.evaluate("QJ.submitGuess(QJ.A.R.game.t)"); await wait(150);
    await q.evaluate("(()=>{const R=QJ.A.R; R.pin={x:R.info.x,y:R.info.y}; QJ.validatePin();})()");
    check(!(await q.isVisible("#waitBoost")), "réglage Non : pas de boost à l'écran d'attente");
    await q.waitForFunction("QJ.A.screen === 'reveal'"); await wait(300);
    const y = await q.evaluate("QJ.A.res[0]");
    check(y[1] === 1000 && y[2] === 1000 && !y[6], "réglage Non : 1 000 + 1 000, sans boost (" + JSON.stringify(y) + ")");
    check(errs.length === 0, "erreurs JS : " + (errs.join(" | ") || "aucune"));
  } catch (e) { console.log("ÉCHEC", e); process.exitCode = 1; } finally { srv.kill(); await b.close(); process.exit(); }
})();
