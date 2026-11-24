// Salons publics (site Docker) : réglage « Visibilité du salon » (privé par défaut), liste de l'accueil tenue à jour,
// entrée sans code, étiquette Public / Privé sur la carte du code, un seul salon à la fois par joueur
// (« Y retourner », « Le fermer et recréer » : l'ancienne connexion ne revient pas).
// Depuis la racine du dépôt : node tests/e2e_public.js
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const PORT = 8876, URL = "http://localhost:" + PORT + "/";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, msg) => { console.log((ok ? "OK   " : "ÉCHEC") + " " + msg); if (!ok) process.exitCode = 1; };
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, "..", "server", "server.js")], { env: Object.assign({}, process.env, { PORT: String(PORT), QJ_JEUX: "gtav,botw" }), stdio: "ignore" });
  await wait(800);
  const b = await chromium.launch(); const errs = [];
  const ctx = async () => b.newContext({ viewport: { width: 390, height: 844 } });
  const open = async (c, name) => { const p = await c.newPage(); p.on("pageerror", (e) => errs.push(name + ": " + e)); await p.goto(URL); await p.fill("#pseudo", name); await wait(700); return p; };
  const txt = (p, sel) => p.evaluate((s) => (document.querySelector(s) || {}).innerText || "", sel);
  try {
    const cH = await ctx(), cV = await ctx(), cW = await ctx();
    const V = await open(cV, "Visiteur");
    check(await V.isVisible("#pubCard"), "accueil : carte « Salons publics » visible sur le site");
    await wait(3500);
    const empty = await txt(V, "#pubList");
    check(/Aucun salon public pour l'instant\.$/.test(empty.trim()) && !/Crée/.test(empty), "liste vide : « " + empty.trim() + " » (sans « Crée le tien »)");

    const H = await open(cH, "Hôtesse");
    await H.click("#bHost"); await H.waitForFunction("QJ.A.mode === 'host'"); await wait(500);
    const code = (await txt(H, "#codeBox")).trim();
    check(await H.isVisible("#pubSetting") && (await txt(H, "#pubBadge")).includes("Privé"), "salon créé : réglage visible, privé par défaut (« " + (await txt(H, "#pubBadge")).trim() + " »)");
    check(await H.evaluate(() => !!document.querySelector("#pubSetting svg.lock") && !/[\u{1F512}\u{1F513}]/u.test(document.body.innerText)), "cadenas en SVG, pas d'emoji");
    await wait(3500);
    check(!(await txt(V, "#pubList")).includes("Hôtesse"), "salon privé : absent de la liste");

    await H.click("#settings .seg[data-k='pub'] button[data-v='1']"); await wait(300);
    check((await txt(H, "#pubBadge")).includes("Public"), "l'hôte le rend public : étiquette « Public »");
    await V.waitForFunction(() => document.getElementById("pubList").innerText.includes("Hôtesse"), null, { timeout: 8000 });
    const row = await txt(V, "#pubList");
    check(/5 manches · 2 min/.test(row) && /1 joueur/.test(row) && /En attente/i.test(row) && /Rejoindre/i.test(row), "liste de l'accueil à jour toute seule : « " + row.replace(/\s+/g, " ").trim() + " »");
    const bj = await V.evaluate(() => { const b = document.querySelector("#pubList .pjoin"); return { ico: !!b.querySelector("svg.pji") && getComputedStyle(b.querySelector("svg.pji")).display !== "none", w: Math.round(b.getBoundingClientRect().width), label: b.textContent.trim(), emoji: /\p{Extended_Pictographic}/u.test(b.textContent) }; });
    check(bj.ico && bj.w <= 50 && bj.label === "Rejoindre" && !bj.emoji, "téléphone : bouton « Rejoindre » réduit au picto SVG, mot gardé pour les lecteurs d'écran (" + JSON.stringify(bj) + ")");
    const D = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage(); await D.goto(URL); await wait(4000);
    const bd = await D.evaluate(() => { const b = document.querySelector("#pubList .pjoin"); return b ? { ico: getComputedStyle(b.querySelector("svg.pji")).display, txt: b.innerText.trim() } : null; });
    check(bd && bd.ico === "none" && /rejoindre/i.test(bd.txt), "PC : bouton avec le mot « Rejoindre » (" + JSON.stringify(bd) + ")");
    await D.context().close();
    const dot = await V.evaluate(() => ({ anim: getComputedStyle(document.querySelector("#pubCount i")).animationName, label: /Rejoins une partie/.test(document.getElementById("pubCard").innerText) }));
    check(dot.anim === "liveDot" && !dot.label, "diode verte animée, sans la phrase « Rejoins une partie… » (" + JSON.stringify(dot) + ")");
    check(/1 ouvert/.test(await txt(V, "#pubCount")), "compteur : « " + (await txt(V, "#pubCount")).trim() + " »");

    await V.click("#pubList button[data-code='" + code + "']");
    await V.waitForFunction("QJ.A.mode === 'guest' && QJ.A.screen === 'lobby'", null, { timeout: 8000 });
    check((await txt(V, "#codeBox")).trim() === code && (await txt(V, "#pubBadge")).includes("Public"), "« Rejoindre » : dans le salon " + code + " sans code, étiquette Public vue par l'invité");
    await H.waitForFunction(() => QJ.players(false).length === 2, null, { timeout: 8000 });
    check(true, "l'hôte voit 2 joueurs");

    // un seul salon à la fois : un 2e onglet du même joueur ne peut pas créer de salon
    const H2 = await open(cH, "Hôtesse");
    await H2.click("#bHost"); await wait(1200);
    check(await H2.isVisible("#hostDup") && (await txt(H2, "#dupCode")).trim() === code && (await H2.evaluate("QJ.A.mode")) !== "host", "2e salon refusé : « " + (await txt(H2, "#hostDup")).replace(/\s+/g, " ").trim().slice(0, 70) + "… »");
    // « Y retourner » : entre dans son salon
    await H2.click("#bDupBack");
    await H2.waitForFunction("QJ.A.screen === 'lobby'", null, { timeout: 8000 });
    check((await txt(H2, "#codeBox")).trim() === code, "« Y retourner » : de retour dans le salon " + code);
    await H2.close();

    // « Le fermer et recréer » : l'ancien salon perd ses connexions de ce joueur, un nouveau salon est créé
    const H3 = await open(cH, "Hôtesse");
    await H3.click("#bHost"); await wait(1200);
    check(await H3.isVisible("#hostDup"), "nouvel essai : de nouveau refusé");
    await H3.click("#bDupClose");
    await H3.waitForFunction("QJ.A.mode === 'host' && QJ.A.screen === 'lobby'", null, { timeout: 8000 });
    const code2 = (await txt(H3, "#codeBox")).trim();
    check(code2 && code2 !== code, "« Le fermer et recréer » : nouveau salon " + code2);
    await V.waitForFunction("QJ.A.mode === 'host'", null, { timeout: 15000 }).catch(() => {});
    await wait(3000);
    check((await V.evaluate("QJ.A.mode")) === "host" && (await V.evaluate(() => QJ.players(false).length)) === 1, "l'ancien salon reste à l'invité, devenu hôte ; l'ancien onglet de l'hôte n'y revient pas");

    // salon redevenu privé : il disparaît de la liste
    const W = await open(cW, "Témoin");
    await W.waitForFunction((c) => document.getElementById("pubList").innerText.length > 0, null, { timeout: 8000 });
    await V.click("#settings .seg[data-k='pub'] button[data-v='0']").catch(() => {});
    await wait(4000);
    check(!(await txt(W, "#pubList")).includes(code), "salon repassé en privé : retiré de la liste");
    check(errs.length === 0, "erreurs JS : " + (errs.join(" | ") || "aucune"));
  } catch (e) { console.log("ÉCHEC", e); process.exitCode = 1; } finally { srv.kill(); await b.close(); process.exit(); }
})();
