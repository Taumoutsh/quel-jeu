// Temps restant : la gélule du temps garde la même largeur quand les secondes défilent (la police d'affichage n'a
// pas de chiffres à chasse fixe : « 1:11 » était bien plus étroit que « 0:08 », la gélule changeait de taille à
// chaque seconde et faisait bouger Boost et Score). Sur PC et sur téléphone.
// Depuis la racine du dépôt : node tests/e2e_clock.js
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const PORT = 8874, URL = "http://localhost:" + PORT + "/";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, msg) => { console.log((ok ? "OK   " : "ÉCHEC") + " " + msg); if (!ok) process.exitCode = 1; };
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, "..", "server", "server.js")], { env: Object.assign({}, process.env, { PORT: String(PORT), QJ_JEUX: "gtav,botw" }), stdio: "ignore" });
  await wait(800);
  const b = await chromium.launch(); const errs = [];
  try {
    for (const [nm, opt] of [["PC", { viewport: { width: 1280, height: 800 } }], ["téléphone 390", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }], ["téléphone 360", { viewport: { width: 360, height: 760 }, isMobile: true, hasTouch: true }]]) {
      const p = await (await b.newContext(opt)).newPage(); p.on("pageerror", (e) => errs.push(String(e)));
      await p.goto(URL); await p.fill("#pseudo", "Test"); await p.click("#bSolo"); await wait(300); await p.click("#bStart");
      await p.waitForFunction("QJ.A.R && QJ.A.R.phase === 'name'"); await p.evaluate(() => document.fonts.ready); await wait(400);
      const seen = [];
      for (const s of [120, 111, 71, 59, 44, 8, 1]) {
        await p.evaluate((s) => { QJ.A.st.dl = Date.now() + s * 1000 - 500; }, s); await wait(350);
        seen.push(await p.evaluate(() => ({ t: document.getElementById("hTime").textContent.trim(), w: +document.getElementById("hTimer").getBoundingClientRect().width.toFixed(2), x: +document.getElementById("hBoost").getBoundingClientRect().left.toFixed(2) })));
      }
      const ws = new Set(seen.map((v) => v.w)), xs = new Set(seen.map((v) => v.x));
      check(seen.every((v, k) => /^\d:\d\d$/.test(v.t)) && ws.size === 1 && xs.size === 1, nm + " : largeur du temps constante, Boost immobile (" + seen.map((v) => v.t + " " + v.w).join(", ") + ")");
      await p.context().close();
    }
    check(errs.length === 0, "erreurs JS : " + (errs.join(" | ") || "aucune"));
  } catch (e) { console.log("ÉCHEC", e); process.exitCode = 1; } finally { srv.kill(); await b.close(); process.exit(); }
})();
