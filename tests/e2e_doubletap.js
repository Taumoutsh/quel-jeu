// Téléphone : un double tap ne déclenche pas le zoom de la page (second appui neutralisé), mais un bouton tapé
// deux fois réagit bien deux fois, et la vue garde ses gestes. Depuis la racine du dépôt : node tests/e2e_doubletap.js
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const PORT = 8827, URL = "http://localhost:" + PORT + "/";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, msg) => { console.log((ok ? "OK   " : "ÉCHEC") + " " + msg); if (!ok) process.exitCode = 1; };
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, "..", "server", "server.js")], { env: Object.assign({}, process.env, { PORT: String(PORT) }), stdio: "ignore" });
  await wait(800);
  const b = await chromium.launch(); const errs = [];
  try {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(String(e)));
    await p.goto(URL); await p.evaluate("localStorage.setItem('qj.avatar', JSON.stringify('aventuriere.2.1.0'))"); await p.reload(); await wait(600);
    // on note si le navigateur aurait pu traiter le second tap (événement non annulé)
    await p.evaluate("window.__ends = []; document.addEventListener('touchend', (e) => setTimeout(() => window.__ends.push(e.defaultPrevented)), true)");
    const cdp = await ctx.newCDPSession(p);
    const tap = async (x, y) => { await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] }); await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); };
    // double tap sur une zone sans bouton (le titre)
    const h = await p.locator("#home .brand").boundingBox();
    await tap(h.x + 40, h.y + 20); await wait(120); await tap(h.x + 42, h.y + 21); await wait(100);
    check(JSON.stringify(await p.evaluate("window.__ends")) === "[false,true]", "double tap sur le titre : second appui neutralisé (pas de zoom)");
    // double tap sur la flèche « tenue suivante » : deux pas
    await p.tap("#bAvaEdit"); await wait(500);
    const a = await p.locator('[data-f="t1"]').boundingBox();
    await tap(a.x + a.width / 2, a.y + a.height / 2); await wait(120);
    const a2 = await p.locator('[data-f="t1"]').boundingBox();
    await tap(a2.x + a2.width / 2, a2.y + a2.height / 2); await wait(150);
    check((await p.evaluate("QJ.A.avatar")).startsWith("ninja."), "double tap sur la flèche : deux tenues plus loin (" + (await p.evaluate("QJ.A.avatar")) + ")");
    // un tap isolé reste normal
    await wait(500); await tap(a2.x + a2.width / 2, a2.y + a2.height / 2); await wait(150);
    check((await p.evaluate("QJ.A.avatar")).startsWith("sorcier."), "tap simple : une tenue plus loin");
    check(errs.length === 0, "erreurs JS : " + (errs.join(" | ") || "aucune"));
  } catch (e) { console.log("ÉCHEC", e); process.exitCode = 1; } finally { srv.kill(); await b.close(); process.exit(); }
})();
