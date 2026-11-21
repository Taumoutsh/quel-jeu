// Pied de page : « GameSpotter · année · vVERSION » en bas de l'accueil et du salon, jamais pendant une manche.
// Depuis la racine du dépôt : node tests/e2e_footer.js
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const PORT = 8847, URL = "http://localhost:" + PORT + "/";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, msg) => { console.log((ok ? "OK   " : "ÉCHEC") + " " + msg); if (!ok) process.exitCode = 1; };
(async () => {
  const vtxt = fs.readFileSync(path.join(__dirname, "..", "js", "version.js"), "utf8");
  const ver = /GS_VERSION = "([^"]+)"/.exec(vtxt)[1], upd = /GS_UPDATED = "(\d{4})-(\d{2})-(\d{2})"/.exec(vtxt);
  const updFr = new Date(+upd[1], +upd[2] - 1, +upd[3]).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const srv = spawn(process.execPath, [path.join(__dirname, "..", "server", "server.js")], { env: Object.assign({}, process.env, { PORT: String(PORT), QJ_JEUX: "gtav" }), stdio: "ignore" });
  await wait(800);
  const b = await chromium.launch(); const errs = [];
  try {
    const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); p.on("pageerror", (e) => errs.push(String(e)));
    await p.goto(URL); await wait(400);
    const foot = () => p.evaluate(() => { const f = document.getElementById("siteFoot"), d = document.getElementById("footDate"); return { txt: f.textContent.replace(d.textContent, "").trim(), date: d.textContent, on: f.offsetParent !== null, in: f.parentNode.id }; });
    let f = await foot();
    check(f.on && f.in === "home" && f.txt === "GameSpotter · " + new Date().getFullYear() + " · v" + ver && f.date === "Mis à jour le " + updFr, "accueil : « " + f.txt + " » / « " + f.date + " »");
    await p.click("#bSolo"); await wait(300); f = await foot();
    check(f.on && f.in === "lobby", "salon : pied de page en bas de l'écran");
    await p.click("#bStart"); await p.waitForFunction("QJ.A.R && QJ.A.R.phase === 'name'"); f = await foot();
    check(!f.on, "en jeu : pas de pied de page");
    check(errs.length === 0, "erreurs JS : " + (errs.join(" | ") || "aucune"));
  } catch (e) { console.log("ÉCHEC", e); process.exitCode = 1; } finally { srv.kill(); await b.close(); process.exit(); }
})();
