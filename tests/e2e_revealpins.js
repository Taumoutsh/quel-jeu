// Carte des résultats : chaque repère (joueur et « Ici ! ») tombe à sa position sur la carte, à chaque manche,
// même quand la carte change d'une manche à l'autre (les repères restaient au coin haut gauche ou calés sur
// la carte précédente), et la carte est cadrée sur les repères.
// Depuis la racine du dépôt : node tests/e2e_revealpins.js
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const PORT = 8839, URL = "http://localhost:" + PORT + "/";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, msg) => { console.log((ok ? "OK   " : "ÉCHEC") + " " + msg); if (!ok) process.exitCode = 1; };
(async () => {
  // plusieurs jeux aux cartes de tailles différentes
  const srv = spawn(process.execPath, [path.join(__dirname, "..", "server", "server.js")], { env: Object.assign({}, process.env, { PORT: String(PORT), QJ_JEUX: "gtav,botw,mafia1,lcu,ow" }), stdio: "ignore" });
  await wait(800);
  const b = await chromium.launch(); const errs = [];
  try {
    for (const [vw, vh] of [[390, 844], [1280, 800]]) {
      const p = await (await b.newContext({ viewport: { width: vw, height: vh } })).newPage(); p.on("pageerror", (e) => errs.push(String(e)));
      await p.goto(URL); await p.fill("#pseudo", "Pseudo Très Long"); await p.click("#bSolo"); await wait(300); await p.click("#bStart");
      const maps = new Set();
      for (let r = 0; r < 4; r++) {
        await p.waitForFunction("QJ.A.R && QJ.A.R.phase === 'name'", null, { timeout: 15000 });
        await p.evaluate("QJ.submitGuess(QJ.A.R.game.t)"); await wait(200);
        const want = await p.evaluate("(()=>{const R=QJ.A.R; const pin={x:R.info.x>.5?R.info.x-.08:R.info.x+.08,y:R.info.y>.5?R.info.y-.06:R.info.y+.06}; R.pin=pin; QJ.validatePin(); return {pin, goal:{x:R.info.x,y:R.info.y}, g:R.game.t};})()");
        await p.waitForFunction("QJ.A.screen === 'reveal'"); await wait(900);
        const got = await p.evaluate(() => {
          const el = document.getElementById("rvMap"), inner = el.querySelector(".mv-inner"), img = inner.querySelector("img");
          const ir = img.getBoundingClientRect(), out = { iw: ir.width, ih: ir.height, src: img.getAttribute("src"), pins: [] };
          for (const d of el.querySelectorAll(".pin")) { const a = d.getBoundingClientRect(); out.pins.push({ goal: d.classList.contains("goal"), fx: (a.left - ir.left) / ir.width, fy: (a.top - ir.top) / ir.height }); }
          const er = el.getBoundingClientRect(); out.zoom = ir.width > er.width + 1 || ir.height > er.height + 1;
          return out;
        });
        maps.add(got.src);
        const me = got.pins.find((q) => !q.goal), goal = got.pins.find((q) => q.goal);
        const err = (a, w) => Math.hypot(a.fx - w.x, a.fy - w.y);
        check(me && goal && err(me, want.pin) < 0.005 && err(goal, want.goal) < 0.005,
          vw + " px, manche " + (r + 1) + " (" + want.g + ") : repères à leur place (écarts " + (me ? err(me, want.pin).toFixed(4) : "?") + ", " + (goal ? err(goal, want.goal).toFixed(4) : "?") + ")");
        check(got.zoom, vw + " px, manche " + (r + 1) + " : carte cadrée sur les repères");
        await p.click("#bNext");
      }
      check(maps.size > 1, vw + " px : la carte a changé entre les manches (" + maps.size + " cartes)");
    }
    check(errs.length === 0, "erreurs JS : " + (errs.join(" | ") || "aucune"));
  } catch (e) { console.log("ÉCHEC", e); process.exitCode = 1; } finally { srv.kill(); await b.close(); process.exit(); }
})();
