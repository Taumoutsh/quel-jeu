// Petit repère « 360° » : visible pendant une manche dont la vue fait le tour complet, caché sur une capture plate.
// Depuis la racine du dépôt (images téléchargées dans packs/img) : node tests/e2e_360.js [dossier_captures]
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const PORT = 8828, URL = "http://localhost:" + PORT + "/";
const OUT = process.argv[2] || "/tmp";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, msg) => { console.log((ok ? "OK   " : "ÉCHEC") + " " + msg); if (!ok) process.exitCode = 1; };
(async () => {
  // deux jeux seulement : Zelda BotW (vues 360°) et GTA V (captures plates)
  const srv = spawn(process.execPath, [path.join(__dirname, "..", "server", "server.js")], { env: Object.assign({}, process.env, { PORT: String(PORT), QJ_JEUX: "botw,gtav" }), stdio: "ignore" });
  await wait(800);
  const b = await chromium.launch(); const errs = [];
  try {
    const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    p.on("pageerror", (e) => errs.push(String(e)));
    await p.goto(URL); await p.evaluate("localStorage.setItem('qj.avatar', JSON.stringify('aventuriere.2.1.0'))"); await p.reload(); await wait(600);
    await p.click("#bSolo"); await wait(400); await p.click("#bStart"); await wait(400);
    const seen = { pano: 0, flat: 0 };
    for (let r = 0; r < 5 && !(seen.pano && seen.flat); r++) {
      await p.waitForFunction("QJ.A.R && QJ.A.R.info && document.getElementById('panoLoad').classList.contains('hidden')", null, { timeout: 15000 });
      const flat = await p.evaluate("QJ.A.R.info.flat");
      const shown = await p.isVisible("#h360");
      check(shown === !flat, "manche " + (r + 1) + " (" + (flat ? "capture plate" : "vue 360°") + ") : repère " + (shown ? "visible" : "caché"));
      if (!seen[flat ? "flat" : "pano"]++) await p.screenshot({ path: path.join(OUT, "v360-" + (flat ? "plate" : "360") + ".png") });
      await p.click("#bSkip"); await wait(300); if (await p.isVisible("#cfYes")) { await p.click("#cfYes"); await wait(400); }
      if (await p.isVisible("#bNext")) { await p.click("#bNext"); await wait(400); }
    }
    check(seen.pano > 0 && seen.flat > 0, "les deux sortes de vues ont été vues (" + seen.pano + " × 360°, " + seen.flat + " × plate)");
    check(errs.length === 0, "erreurs JS : " + (errs.join(" | ") || "aucune"));
  } catch (e) { console.log("ÉCHEC", e); process.exitCode = 1; } finally { srv.kill(); await b.close(); process.exit(); }
})();
