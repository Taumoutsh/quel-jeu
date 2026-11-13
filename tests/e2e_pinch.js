// Téléphone : pincement sur la capture et les cartes (zoom sous les doigts, glisser à deux doigts, relâche d'un doigt), carte réduite.
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

    // zoom autour du point entre les doigts : on revient à l'image entière, puis on pince sur le quart gauche
    await p.evaluate("(() => { QJ.pano.fov = 1.35; QJ.pano.cx = 0.5; QJ.pano.cy = 0.5; QJ.pano.dirty = true; })()");
    const W = box.width, H = box.height, px = box.x + W * 0.25, py = box.y + H * 0.5;
    const tex = (x, y) => p.evaluate(`(() => { const P = QJ.pano, c = P.c, r = c.getBoundingClientRect(), H = c.clientHeight, [sx, sy] = P._flatScale();
      return [P.cx + ((2 * (${x} - r.left) - c.clientWidth) / H) * sx, P.cy + ((2 * (${y} - r.top) - H) / H) * sy]; })()`);
    const t0 = await tex(px, py);
    await T("touchStart", [[px - 20, py, 0], [px + 20, py, 1]]);
    for (let k = 1; k <= 8; k++) { await T("touchMove", [[px - 20 - k * 8, py, 0], [px + 20 + k * 8, py, 1]]); await wait(20); }
    const t1 = await tex(px, py), z2 = await view();
    check(z2.fov < 1.35 && Math.hypot(t1[0] - t0[0], t1[1] - t0[1]) < 0.01, "zoom centré sous les doigts (point fixe : Δ " + Math.hypot(t1[0] - t0[0], t1[1] - t0[1]).toFixed(4) + ", centre " + z2.cx.toFixed(3) + ")");
    // les deux doigts glissent ensemble vers la droite et le bas : l'image suit (le point sous les doigts reste dessous)
    for (let k = 1; k <= 6; k++) { await T("touchMove", [[px - 84 + k * 10, py + k * 6, 0], [px + 84 + k * 10, py + k * 6, 1]]); await wait(20); }
    const t2 = await tex(px + 60, py + 36), v2 = await view();
    check(v2.cx < z2.cx && Math.hypot(t2[0] - t0[0], t2[1] - t0[1]) < 0.015, "glisser à deux doigts déplace l'image (centre " + z2.cx.toFixed(3) + " → " + v2.cx.toFixed(3) + ")");
    await T("touchEnd", [[px + 144, py + 36, 1]]); await T("touchEnd", [[px - 24, py + 36, 0]]); await wait(100);

    // carte : glisser à deux doigts déplace la carte
    await p.evaluate("QJ.submitGuess(QJ.A.R.game.t)"); await wait(800);
    const mb = await p.locator("#mapPick").boundingBox(), mx = mb.x + mb.width / 2, my = mb.y + mb.height / 2;
    const tr = () => p.evaluate("document.querySelector('#mapPick .mv-inner').style.transform");
    await T("touchStart", [[mx - 30, my, 0], [mx + 30, my, 1]]);
    for (let k = 1; k <= 6; k++) { await T("touchMove", [[mx - 30 - k * 12, my, 0], [mx + 30 + k * 12, my, 1]]); await wait(20); }
    const m1 = await tr();
    for (let k = 1; k <= 6; k++) { await T("touchMove", [[mx - 102 + k * 8, my + k * 5, 0], [mx + 102 + k * 8, my + k * 5, 1]]); await wait(20); }
    const m2 = await tr();
    const tx = (s) => +/translate\(([-\d.]+)px/.exec(s)[1];
    check(/scale/.test(m1) && tx(m2) > tx(m1) + 20, "carte : zoom puis glisser à deux doigts (" + tx(m1).toFixed(0) + " → " + tx(m2).toFixed(0) + " px)");
    await T("touchEnd", [[mx + 150, my + 30, 1]]); await T("touchEnd", [[mx - 54, my + 30, 0]]);
    // carte réduite pour regarder l'image, puis rouverte telle quelle
    await wait(100); const before = await tr();
    await p.tap("#bMini"); await wait(300);
    check(!(await p.isVisible("#mapPick")) && (await p.isVisible("#bPin")), "carte réduite : image visible, bouton Valider gardé");
    await p.tap("#bMini"); await wait(300);
    check((await p.isVisible("#mapPick")) && (await tr()) === before, "carte rouverte avec le même zoom");
  } catch (e) { console.log("ÉCHEC", e); process.exitCode = 1; } finally { srv.kill(); await b.close(); process.exit(); }
})();
