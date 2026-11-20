// Téléphone : taper « subn » ne montre qu'une suggestion (Subnautica) ; la toucher doit valider, même si le
// clavier valide le mot en cours (autocorrection) pendant le toucher : la saisie qui en résulte reconstruisait
// la liste sous le doigt et le tap était perdu.
// Depuis la racine du dépôt : node tests/e2e_suggone.js
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const PORT = 8849, URL = "http://localhost:" + PORT + "/";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, msg) => { console.log((ok ? "OK   " : "ÉCHEC") + " " + msg); if (!ok) process.exitCode = 1; };
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, "..", "server", "server.js")], { env: Object.assign({}, process.env, { PORT: String(PORT), QJ_JEUX: "subn" }), stdio: "ignore" });
  await wait(800);
  const b = await chromium.launch(); const errs = [];
  try {
    // [saisie, texte posé par le « clavier » pendant le toucher]
    for (const [typed, commit, what] of [["subn", null, "tap simple"], ["subn", "subn", "clavier qui valide le mot (même texte)"], ["subn", "sub", "autocorrection qui change le mot"]]) {
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
      const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(String(e)));
      await p.goto(URL); await p.fill("#pseudo", "Test"); await p.click("#bSolo"); await wait(300); await p.click("#bStart");
      await p.waitForFunction("QJ.A.R && QJ.A.R.phase === 'name'");
      await p.focus("#gInput"); await p.keyboard.type(typed); await wait(250);
      const items = await p.$$eval("#sugg button", (bs) => bs.map((x) => x.textContent));
      const r = await p.locator("#sugg button").first().boundingBox();
      const cdp = await ctx.newCDPSession(p);
      const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
      await touch("touchStart", r.x + r.width / 2, r.y + r.height / 2); await wait(40);
      if (commit !== null) await p.evaluate((v) => { const i = document.getElementById("gInput"); i.value = v; i.dispatchEvent(new Event("input", { bubbles: true })); }, commit);
      await wait(40); await touch("touchEnd"); await wait(500);
      check(items.length === 1 && (await p.evaluate("QJ.A.R.phase")) === "map", what + " : « " + items.join(", ") + " » validé");
      await ctx.close();
    }
    check(errs.length === 0, "erreurs JS : " + (errs.join(" | ") || "aucune"));
  } catch (e) { console.log("ÉCHEC", e); process.exitCode = 1; } finally { srv.kill(); await b.close(); process.exit(); }
})();
