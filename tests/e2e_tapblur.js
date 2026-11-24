// Téléphone : toucher une suggestion doit la choisir même si, pendant le toucher, le champ perd le focus (le
// téléphone replie le clavier, la page bouge) : la liste se refermait 150 ms après la perte du focus, le doigt
// levé tombait sur autre chose et le tap était perdu (« le clic n'a aucun effet et la liste se referme »).
// Aussi : doigt levé après un petit roulement du pouce (< 10 px) avec geste annulé par le navigateur
// (pointercancel, page qui défile avec le clavier) ; un vrai glissement ne choisit toujours rien.
// Depuis la racine du dépôt : node tests/e2e_tapblur.js
const { chromium } = require("./pw");
const { spawn } = require("child_process");
const path = require("path");
const PORT = 8871, URL = "http://localhost:" + PORT + "/";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, msg) => { console.log((ok ? "OK   " : "ÉCHEC") + " " + msg); if (!ok) process.exitCode = 1; };
// ce qu'envoie Safari sur iPhone quand le clavier se replie pendant un tap : le doigt ne bouge pas (mêmes coordonnées
// d'écran), mais ses coordonnées dans la page sont décalées ; le clic part vers l'élément qui se trouve alors sous le doigt
function iosShiftTap() {
  const bt = document.querySelector("#sugg button"), r = bt.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, dy = 80;
  const po = (cy) => ({ bubbles: true, cancelable: true, pointerId: 9, pointerType: "touch", isPrimary: true, clientX: x, clientY: cy, screenX: x, screenY: y });
  const tch = (cy) => new Touch({ identifier: 9, target: bt, clientX: x, clientY: cy, screenX: x, screenY: y });
  const te = (type, cy, on) => { const t = tch(cy); return new TouchEvent(type, { bubbles: true, cancelable: true, touches: on ? [t] : [], targetTouches: on ? [t] : [], changedTouches: [t] }); };
  bt.dispatchEvent(new PointerEvent("pointerdown", po(y))); bt.dispatchEvent(te("touchstart", y, true));
  document.getElementById("gInput").blur();
  bt.dispatchEvent(new PointerEvent("pointerup", po(y + dy)));
  const end = te("touchend", y + dy, false); bt.dispatchEvent(end);
  if (!end.defaultPrevented) { const under = document.elementFromPoint(x, y + dy); if (under) under.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: x, clientY: y + dy })); }
}
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, "..", "server", "server.js")], { env: Object.assign({}, process.env, { PORT: String(PORT), QJ_JEUX: "subn" }), stdio: "ignore" });
  await wait(800);
  const b = await chromium.launch(); const errs = [];
  try {
    const cases = [
      ["perte du focus pendant le toucher (250 ms)", "map", async (p, x, y, t) => { await t("touchStart", x, y); await wait(30); await p.evaluate("document.getElementById('gInput').blur()"); await wait(250); await t("touchEnd"); }],
      ["perte du focus et page qui bouge de 60 px", "map", async (p, x, y, t) => { await t("touchStart", x, y); await wait(30); await p.evaluate("document.getElementById('gInput').blur(); document.querySelector('.dock').style.transform = 'translateY(60px)'"); await wait(250); await t("touchEnd"); }],
      ["geste annulé par le navigateur sans glissement", "map", async (p, x, y, t) => { await t("touchStart", x, y); await wait(30); await p.evaluate(() => { const bt = document.querySelector("#sugg button"); bt.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, pointerId: 1, pointerType: "touch", isPrimary: true })); }); await wait(30); await t("touchEnd"); }],
      ["petit roulement du pouce (6 px)", "map", async (p, x, y, t) => { await t("touchStart", x, y); await wait(30); await t("touchMove", x + 4, y + 4); await wait(30); await t("touchEnd"); }],
      ["iPhone : clavier replié pendant le toucher, page décalée de 80 px", "map", async (p) => { await p.evaluate(iosShiftTap); }],
      ["vrai glissement (40 px) : rien n'est choisi", "name", async (p, x, y, t) => { await t("touchStart", x, y); for (let k = 1; k <= 4; k++) { await wait(16); await t("touchMove", x, y + 10 * k); } await wait(30); await t("touchEnd"); }],
    ];
    for (const [what, want, gesture] of cases) {
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
      const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(String(e)));
      await p.goto(URL); await p.fill("#pseudo", "Test"); await p.click("#bSolo"); await wait(300); await p.click("#bStart");
      await p.waitForFunction("QJ.A.R && QJ.A.R.phase === 'name'");
      await p.focus("#gInput"); await p.keyboard.type("subn"); await wait(250);
      const r = await p.locator("#sugg button").first().boundingBox(); await p.evaluate("1"); // liste prête
      const cdp = await ctx.newCDPSession(p);
      const t = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
      await gesture(p, r.x + r.width / 2, r.y + r.height / 2, t); await wait(500);
      const ph = await p.evaluate("QJ.A.R.phase"), er = await p.evaluate("QJ.A.R.errors");
      check(ph === want && er === 0, what + " → " + (ph === "map" ? "Subnautica validé" : "rien de choisi") + (er ? " (" + er + " raté)" : ""));
      await ctx.close();
    }
    check(errs.length === 0, "erreurs JS : " + (errs.join(" | ") || "aucune"));
  } catch (e) { console.log("ÉCHEC", e); process.exitCode = 1; } finally { srv.kill(); await b.close(); process.exit(); }
})();
