// Pincement sur la capture puis relâche d'un doigt : le doigt restant ne doit pas faire sauter l'image.
// Depuis la racine du dépôt : node tests/e2e_pinch.js
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const PORT = 8820, URL = "http://localhost:" + PORT + "/";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, msg) => { console.log((ok ? "OK   " : "ÉCHEC") + " " + msg); if (!ok) process.exitCode = 1; };
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, "..", "server", "server.js")], { env: Object.assign({}, process.env, { PORT: String(PORT), QJ_IMAGES: "demo" }), stdio: "ignore" });
  await wait(800);
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const p = await ctx.newPage();
    await p.goto(URL); await p.fill("#pseudo", "Solo"); await p.click("#bSolo"); await wait(300); await p.click("#bStart"); await wait(2000);
    // capture plate de test (les vues de démo sont des 360°)
    await p.evaluate("(() => { const c = document.createElement('canvas'); c.width = 1600; c.height = 900; const g = c.getContext('2d'); g.fillStyle = '#486'; g.fillRect(0, 0, 1600, 900); QJ.pano.setImage(c, { flat: true }); })()");
    await wait(300);
    const cdp = await ctx.newCDPSession(p);
    const box = await p.locator("#pano").boundingBox(); const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    const T = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id })) });
    const view = () => p.evaluate("({ cx: QJ.pano.cx, fov: QJ.pano.fov })");
    await T("touchStart", [[cx - 40, cy, 0], [cx + 40, cy, 1]]);
    for (let k = 1; k <= 8; k++) { await T("touchMove", [[cx - 40 - k * 15, cy, 0], [cx + 40 + k * 15, cy, 1]]); await wait(20); }
    const z = await view();
    check(z.fov < 1, "pincement : zoom (" + z.fov.toFixed(2) + ")");
    await T("touchEnd", [[cx + 160, cy, 1]]); await wait(50); // un doigt relâché
    await T("touchMove", [[cx - 150, cy, 0]]); await wait(50); // l'autre bouge de 10 px vers la droite
    const a = await view();
    const d = a.cx - z.cx;
    check(d < 0 && d > -0.03, "doigt restant : l'image suit le doigt sans saut (Δ " + d.toFixed(4) + ")");
    await T("touchEnd", [[cx - 150, cy, 0]]); await wait(400);
    check(Math.abs((await view()).cx - a.cx) < 1e-6, "pas d'élan après le relâchement");
  } catch (e) { console.log("ÉCHEC", e); process.exitCode = 1; } finally { srv.kill(); await b.close(); process.exit(); }
})();
