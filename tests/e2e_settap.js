// Boutons de réglage du salon (Public / Privé et les autres) : un toucher change le réglage même si le navigateur
// n'envoie pas de clic derrière (Safari sur iPhone, premier toucher d'un bouton avec un style de survol : le bouton
// restait « survolé » sans rien changer). Pas de double prise en compte (toucher + clic), souris toujours prise en
// compte, glissement ignoré, réglages verrouillés pour un invité. Pas de style de survol sans vraie souris.
// Depuis la racine du dépôt : node tests/e2e_settap.js
const { chromium } = require("./pw");
const { spawn } = require("child_process");
const path = require("path");
const PORT = 8883, URL = "http://localhost:" + PORT + "/";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, msg) => { console.log((ok ? "OK   " : "ÉCHEC") + " " + msg); if (!ok) process.exitCode = 1; };
// toucher tel que Safari peut l'envoyer : doigt posé puis levé, sans clic (dx : glissement entre les deux)
const touchNoClick = (p, sel, dx) => p.evaluate(([sel, dx]) => {
  const b = document.querySelector(sel), r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  const mk = (cx) => new Touch({ identifier: 3, target: b, clientX: cx, clientY: y, screenX: cx, screenY: y });
  const t0 = mk(x), t1 = mk(x + (dx || 0));
  b.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true, touches: [t0], targetTouches: [t0], changedTouches: [t0] }));
  if (dx) b.dispatchEvent(new TouchEvent("touchmove", { bubbles: true, cancelable: true, touches: [t1], targetTouches: [t1], changedTouches: [t1] }));
  b.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true, touches: [], targetTouches: [], changedTouches: [t1] }));
}, [sel, dx]);
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, "..", "server", "server.js")], { env: Object.assign({}, process.env, { PORT: String(PORT), QJ_JEUX: "gtav" }), stdio: "ignore" });
  await wait(800);
  const b = await chromium.launch(); const errs = [];
  try {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const H = await ctx.newPage(); H.on("pageerror", (e) => errs.push(String(e)));
    await H.goto(URL); await H.fill("#pseudo", "Hôte"); await wait(400); await H.click("#bHost"); await wait(1000);
    const pub = (v) => "#settings .seg[data-k='pub'] button[data-v='" + v + "']";
    const val = () => H.evaluate("QJ.A.cfg.pub");
    check((await val()) === 0, "salon privé au départ");
    await touchNoClick(H, pub(1)); await wait(100);
    check((await val()) === 1 && (await H.evaluate((s) => document.querySelector(s).classList.contains("on"), pub(1))), "toucher sans clic (Safari) : passe en Public");
    await touchNoClick(H, pub(0)); await wait(100);
    check((await val()) === 0, "toucher sans clic : repasse en Privé");
    await touchNoClick(H, pub(1), 30); await wait(100);
    check((await val()) === 0, "glissement de 30 px : rien ne change");
    await touchNoClick(H, "#settings .seg[data-k='time'] button[data-v='60']"); await wait(100);
    check((await H.evaluate("QJ.A.cfg.time")) === 60, "même chose pour les autres réglages (temps : 1 min)");
    // vrai toucher (avec le clic du navigateur)
    const cdp = await ctx.newCDPSession(H);
    const r = await H.locator(pub(1)).boundingBox();
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: r.x + r.width / 2, y: r.y + r.height / 2 }] }); await wait(50);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await wait(400);
    check((await val()) === 1, "vrai toucher (avec le clic du navigateur) : Public");
    // pas de style de survol sur téléphone : le bouton non choisi garde l'aspect normal après un toucher
    const look = await H.evaluate((s) => { const b = document.querySelector(s); return getComputedStyle(b).backgroundColor; }, pub(0));
    check(/rgba?\(0, 0, 0, 0\)|transparent/.test(look), "pas d'état « survolé » collant sur téléphone (" + look + ")");
    // invité : réglages verrouillés
    const G = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage(); G.on("pageerror", (e) => errs.push(String(e)));
    await G.goto(URL); await G.fill("#pseudo", "Invité"); await wait(400);
    await G.fill("#joinCode", (await H.innerText("#codeBox")).trim()); await G.click("#bJoin"); await G.waitForFunction("QJ.A.mode === 'guest' && QJ.A.screen === 'lobby'");
    await touchNoClick(G, pub(0)); await wait(300);
    check((await G.evaluate(() => document.getElementById("settings").classList.contains("locked"))) && (await val()) === 1, "invité : réglages verrouillés, son toucher ne change rien");
    // souris (PC) : le clic marche toujours
    const P = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage(); P.on("pageerror", (e) => errs.push(String(e)));
    await P.goto(URL); await P.fill("#pseudo", "Souris"); await wait(400); await P.click("#bHost"); await wait(1000);
    await P.click(pub(1)); await wait(100);
    check((await P.evaluate("QJ.A.cfg.pub")) === 1, "souris : clic sur Public pris en compte");
    check(errs.length === 0, "erreurs JS : " + (errs.join(" | ") || "aucune"));
  } catch (e) { console.log("ÉCHEC", e); process.exitCode = 1; } finally { srv.kill(); await b.close(); process.exit(); }
})();
