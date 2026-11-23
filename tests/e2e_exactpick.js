// Choisir un titre dans une liste (proposition d'une licence ou suggestion) compte tel quel : choisir
// « Grand Theft Auto: Vice City » quand la réponse est Vice City Stories redemandait de préciser et
// réaffichait les mêmes propositions, rien ne semblait se passer. Maintenant : un raté.
// Depuis la racine du dépôt : node tests/e2e_exactpick.js
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const PORT = 8863, URL = "http://localhost:" + PORT + "/";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, msg) => { console.log((ok ? "OK   " : "ÉCHEC") + " " + msg); if (!ok) process.exitCode = 1; };
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, "..", "server", "server.js")], { env: Object.assign({}, process.env, { PORT: String(PORT), QJ_JEUX: "gtavcs" }), stdio: "ignore" });
  await wait(800);
  const b = await chromium.launch(); const errs = [];
  try {
    for (const touch of [false, true]) {
      const ctx = await b.newContext(touch ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } : { viewport: { width: 1280, height: 800 } });
      const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(String(e)));
      await p.goto(URL); await p.fill("#pseudo", "Test"); await p.click("#bSolo"); await wait(300); await p.click("#bStart");
      await p.waitForFunction("QJ.A.R && QJ.A.R.phase === 'name'");
      const how = touch ? "doigt" : "souris";
      // 1. propositions de la licence : « gta » puis la pastille Vice City
      await p.fill("#gInput", "gta"); await p.press("#gInput", "Enter"); await wait(300);
      const pill = p.locator("#cands button", { hasText: /^Grand Theft Auto: Vice City$/ });
      check((await pill.count()) === 1, how + " : pastille « Grand Theft Auto: Vice City » proposée");
      if (touch) await pill.tap(); else await pill.click();
      await wait(300);
      check((await p.evaluate("QJ.A.R.errors")) === 1 && (await p.evaluate("QJ.A.R.phase")) === "name", how + " : pastille choisie → raté compté (1 erreur)");
      // 2. suggestion : « vice city » puis la suggestion Vice City
      await p.fill("#gInput", ""); await p.focus("#gInput"); await p.keyboard.type("vice city"); await wait(300);
      const sg = p.locator("#sugg button", { hasText: /^Grand Theft Auto: Vice City$/ });
      check((await sg.count()) === 1, how + " : suggestion « Grand Theft Auto: Vice City » affichée");
      if (touch) await sg.tap(); else await sg.click();
      await wait(300);
      check((await p.evaluate("QJ.A.R.errors")) === 2, how + " : suggestion choisie → raté compté (2 erreurs)");
      // 3. la bonne pastille est acceptée
      await p.fill("#gInput", "gta"); await p.press("#gInput", "Enter"); await wait(300);
      const good = p.locator("#cands button", { hasText: /^Grand Theft Auto: Vice City Stories$/ });
      if (touch) await good.tap(); else await good.click();
      await wait(300);
      check((await p.evaluate("QJ.A.R.phase")) === "map", how + " : « Vice City Stories » choisi → bonne réponse");
      await ctx.close();
    }
    check(errs.length === 0, "erreurs JS : " + (errs.join(" | ") || "aucune"));
  } catch (e) { console.log("ÉCHEC", e); process.exitCode = 1; } finally { srv.kill(); await b.close(); process.exit(); }
})();
