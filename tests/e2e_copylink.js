// Salon : « Copier le code » et « Copier le lien » côte à côte ; le lien copié ouvre la même partie.
// Depuis la racine du dépôt : node tests/e2e_copylink.js [dossier_captures]
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const PORT = 8829, URL = "http://localhost:" + PORT + "/";
const OUT = process.argv[2] || "/tmp";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, msg) => { console.log((ok ? "OK   " : "ÉCHEC") + " " + msg); if (!ok) process.exitCode = 1; };
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, "..", "server", "server.js")], { env: Object.assign({}, process.env, { PORT: String(PORT) }), stdio: "ignore" });
  await wait(800);
  const b = await chromium.launch(); const errs = [];
  try {
    const ctx = await b.newContext({ viewport: { width: 360, height: 760 }, hasTouch: true, isMobile: true });
    await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: URL.slice(0, -1) });
    const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(String(e)));
    await p.goto(URL); await p.evaluate("localStorage.setItem('qj.avatar', JSON.stringify('aventuriere.2.1.0'))"); await p.reload(); await wait(600);
    await p.click("#bHost"); await p.waitForSelector("#codeCard:not(.hidden)"); await wait(400);
    const code = await p.evaluate("QJ.A.code");
    const a = await p.locator("#bCopy").boundingBox(), l = await p.locator("#bCopyLink").boundingBox();
    check(Math.abs(a.y - l.y) < 2 && l.x > a.x + a.width - 1, "les deux boutons sont sur la même ligne");
    await p.locator("#codeCard").screenshot({ path: path.join(OUT, "copylink.png") });
    await p.click("#bCopy"); await wait(200);
    check((await p.evaluate("navigator.clipboard.readText()")) === code, "code copié : " + code);
    await p.click("#bCopyLink"); await wait(200);
    const link = await p.evaluate("navigator.clipboard.readText()");
    check(link === URL + code, "lien copié : " + link);
    check((await p.textContent("#toast")).includes(link), "message de confirmation avec le lien");
    // le lien ouvre bien la partie chez un ami
    const q = await b.newPage(); await q.goto(URL); await q.evaluate("localStorage.setItem('qj.avatar', JSON.stringify('pilote.1.1.0'))");
    await q.goto(link); await wait(600);
    check((await q.inputValue("#joinCode")) === code, "lien ouvert chez l'ami : code prérempli");
    await q.click("#bJoin"); await q.waitForFunction("QJ.A.code === " + JSON.stringify(code) + " && QJ.A.screen === 'lobby'", null, { timeout: 15000 });
    check(true, "l'ami entre dans la partie " + code);
    check(errs.length === 0, "erreurs JS : " + (errs.join(" | ") || "aucune"));
  } catch (e) { console.log("ÉCHEC", e); process.exitCode = 1; } finally { srv.kill(); await b.close(); process.exit(); }
})();
