// Doigt fantôme : un « doigt levé » perdu (page qui change sous le doigt) ne doit pas transformer le geste suivant
// à un seul doigt en pincement (zoom au lieu de glisser), ni empêcher de poser le repère sur la carte. Depuis la racine du dépôt : node tests/e2e_ghostfinger.js
const { chromium } = require("./pw");
const { spawn } = require("child_process");
const path = require("path");
const PORT = 8836, URL = "http://localhost:" + PORT + "/";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, msg) => { console.log((ok ? "OK   " : "ÉCHEC") + " " + msg); if (!ok) process.exitCode = 1; };
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, "..", "server", "server.js")], { env: Object.assign({}, process.env, { PORT: String(PORT), QJ_JEUX: "gtav" }), stdio: "ignore" });
  await wait(800);
  const b = await chromium.launch(); const errs = [];
  try {
    const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    p.on("pageerror", (e) => errs.push(String(e)));
    await p.goto(URL); await p.fill("#pseudo", "Test"); await p.click("#bSolo"); await wait(300); await p.click("#bStart");
    await p.waitForFunction("QJ.A.R && QJ.A.R.info && QJ.pano && document.getElementById('panoLoad').classList.contains('hidden')", null, { timeout: 20000 });
    check(await p.evaluate("QJ.pano.flat"), "capture plate en jeu");
    // gestes envoyés directement à la vue (événements pointer de type touch)
    await p.evaluate(`window.ev = (type, id, x, y, primary) => document.getElementById('pano').dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: primary, clientX: x, clientY: y, bubbles: true }))`);
    const fov0 = await p.evaluate("QJ.pano.fov");
    // pincement à deux doigts dont le premier « doigt levé » se perd
    await p.evaluate("ev('pointerdown', 1, 150, 400, true); ev('pointerdown', 2, 250, 400, false); ev('pointermove', 2, 260, 400, false); ev('pointerup', 2, 260, 400, false)");
    const fov1 = await p.evaluate("QJ.pano.fov");
    // nouveau geste à un seul doigt : il doit déplacer l'image, pas zoomer
    await p.evaluate("ev('pointerdown', 3, 200, 300, true); for (let i = 1; i <= 10; i++) ev('pointermove', 3, 200 + i * 10, 300, true); ev('pointerup', 3, 300, 300, true)");
    const fov2 = await p.evaluate("QJ.pano.fov");
    check(Math.abs(fov2 - fov1) < 1e-6, "un seul doigt après un « doigt levé » perdu : pas de zoom (fov " + fov1.toFixed(3) + " → " + fov2.toFixed(3) + ")");
    // un vrai pincement à deux doigts zoome toujours
    await p.evaluate("ev('pointerdown', 4, 150, 400, true); ev('pointerdown', 5, 250, 400, false); for (let i = 1; i <= 5; i++) ev('pointermove', 5, 250 + i * 20, 400, false); ev('pointerup', 5, 350, 400, false); ev('pointerup', 4, 150, 400, true)");
    const fov3 = await p.evaluate("QJ.pano.fov");
    check(fov3 < fov2 - 0.01, "pincement à deux doigts : zoom (fov " + fov2.toFixed(3) + " → " + fov3.toFixed(3) + ")");
    // carte : même doigt fantôme, puis un simple toucher doit toujours poser le repère
    await p.evaluate("QJ.submitGuess(QJ.A.R.game.t)"); await wait(500);
    await p.evaluate(`window.mv = (type, id, x, y, primary) => document.getElementById('mapPick').dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: primary, clientX: x, clientY: y, bubbles: true }))`);
    const r = await p.locator("#mapPick").boundingBox(), cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    await p.evaluate(`mv('pointerdown', 11, ${cx - 40}, ${cy}, true); mv('pointerdown', 12, ${cx + 40}, ${cy}, false); mv('pointerup', 12, ${cx + 40}, ${cy}, false)`);
    await p.evaluate(`mv('pointerdown', 13, ${cx}, ${cy}, true); mv('pointerup', 13, ${cx}, ${cy}, true)`); await wait(200);
    check(!!(await p.evaluate("QJ.A.R.pin")), "carte : après un « doigt levé » perdu, un toucher pose bien le repère");
    check(errs.length === 0, "erreurs JS : " + (errs.join(" | ") || "aucune"));
  } catch (e) { console.log("ÉCHEC", e); process.exitCode = 1; } finally { srv.kill(); await b.close(); process.exit(); }
})();
