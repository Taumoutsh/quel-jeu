// Partie solo avec le pack « Vrais jeux » (images téléchargées par tools/fetch_packs.py).
// Depuis la racine : python3 -m http.server 8765 & node tests/e2e_real.js /tmp/qj
const { chromium } = require("playwright");
const fs = require("fs");
const OUT = process.argv[2] || "/tmp/qj";
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const pg = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  pg.on("pageerror", (e) => errs.push(String(e)));
  pg.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await pg.goto("http://localhost:8765/index.html");
  await pg.waitForTimeout(800);
  console.log("info :", await pg.innerText("#libInfo"));
  await pg.fill("#pseudo", "Testeur");
  await pg.click("#bSolo");
  await pg.waitForTimeout(300);
  const btn = pg.locator('#settings [data-k="pack"] [data-v="real"]');
  if (await btn.isDisabled()) throw new Error("pack Vrais jeux indisponible : lancer tools/fetch_packs.py");
  await btn.click();
  await pg.click('#settings [data-k="time"] [data-v="0"]');
  console.log("vues :", await pg.innerText("#poolInfo"));
  await pg.screenshot({ path: OUT + "/r1-lobby.png" });
  await pg.click("#bStart");
  const seen = new Set();
  for (let k = 0; k < 5; k++) {
    await pg.waitForFunction("QJ.A.R && QJ.A.R.phase === 'name' && document.getElementById('panoLoad').classList.contains('hidden')", null, { timeout: 30000 });
    await pg.waitForTimeout(400);
    const info = await pg.evaluate("({sid: QJ.A.R.sid, t: QJ.A.R.game.t, x: QJ.A.R.info.x, y: QJ.A.R.info.y, place: QJ.A.R.info.place})");
    if (!info.sid.startsWith("r-")) throw new Error("vue hors pack : " + info.sid);
    seen.add(info.t);
    console.log("manche", k + 1, JSON.stringify(info));
    await pg.screenshot({ path: OUT + "/r" + (k + 2) + "-pano.png" });
    await pg.fill("#gInput", info.t); await pg.press("#gInput", "Enter");
    await pg.waitForTimeout(800);
    const box = await pg.locator("#mapPick").boundingBox();
    await pg.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await pg.waitForTimeout(200);
    await pg.click("#bPin");
    await pg.waitForTimeout(900);
    if (k < 2) await pg.screenshot({ path: OUT + "/r" + (k + 2) + "-reveal.png" });
    console.log("   révélation :", (await pg.innerText("#rvAnswer")).replace(/\n/g, " | "), "|", await pg.innerText("#rvCredit"));
    await pg.click("#bNext"); await pg.waitForTimeout(600);
  }
  await pg.screenshot({ path: OUT + "/r9-final.png" });
  console.log("jeux vus :", [...seen].join(", "));
  console.log("erreurs :", errs.length ? errs : "aucune");
  await b.close();
  if (errs.length) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
