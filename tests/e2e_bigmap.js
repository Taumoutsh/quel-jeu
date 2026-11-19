// « Agrandir » la carte : sur grand écran, elle s'élargit aussi (et pas seulement en hauteur) ; sur téléphone,
// toute la largeur est déjà prise. Puis « Assassin's Creed » (série ET jeu) affiche la liste des propositions
// de la série en mode aide. Depuis la racine du dépôt : node tests/e2e_bigmap.js [dossier_captures]
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const PORT = 8834, URL = "http://localhost:" + PORT + "/";
const OUT = process.argv[2] || "/tmp";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, msg) => { console.log((ok ? "OK   " : "ÉCHEC") + " " + msg); if (!ok) process.exitCode = 1; };
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, "..", "server", "server.js")], { env: Object.assign({}, process.env, { PORT: String(PORT), QJ_JEUX: "acu" }), stdio: "ignore" });
  await wait(800);
  const b = await chromium.launch(); const errs = [];
  const start = async (vp) => {
    const p = await b.newPage({ viewport: vp }); p.on("pageerror", (e) => errs.push(String(e)));
    await p.goto(URL); await p.fill("#pseudo", "Test"); await p.click("#bSolo"); await wait(300); await p.click("#bStart");
    await p.waitForFunction("QJ.A.R && QJ.A.R.phase === 'name'"); return p;
  };
  try {
    // série qui est aussi un jeu : liste des propositions (mode aide)
    const p = await start({ width: 1440, height: 900 });
    await p.fill("#gInput", "Assassin's Creed"); await p.press("#gInput", "Enter"); await wait(300);
    const cands = await p.$$eval("#cands button", (bs) => bs.map((x) => x.textContent));
    check(cands.length >= 10 && cands.includes("Assassin's Creed Unity") && cands.includes("Assassin's Creed"), "« Assassin's Creed » : " + cands.length + " propositions de la série");
    check((await p.evaluate("QJ.A.R.errors")) === 0, "demande de précision : pas compté comme une erreur");
    await p.click("#cands button >> text=\"Assassin's Creed Unity\""); await wait(400);
    check((await p.evaluate("QJ.A.R.phase")) === "map", "proposition choisie : jeu trouvé");
    // grand écran : la carte agrandie s'élargit
    const w0 = (await p.locator("#pMap").boundingBox()).width;
    await p.click("#bBig"); await wait(500);
    const w1 = (await p.locator("#pMap").boundingBox()).width, h1 = (await p.locator("#pMap .mapwrap").boundingBox()).height;
    check(w1 > w0 * 1.8, "grand écran : carte agrandie en largeur (" + Math.round(w0) + " → " + Math.round(w1) + " px)");
    check(h1 > 600, "et en hauteur (" + Math.round(h1) + " px)");
    await p.screenshot({ path: path.join(OUT, "bigmap-desktop.png") });
    await p.click("#bBig"); await wait(500);
    check(Math.abs((await p.locator("#pMap").boundingBox()).width - w0) < 2, "« Réduire » : largeur d'origine");
    // téléphone : inchangé (toute la largeur), seulement plus haute
    const m = await start({ width: 390, height: 844 });
    await m.evaluate("QJ.submitGuess(\"Assassin's Creed Unity\")"); await wait(400);
    const mw0 = (await m.locator("#pMap").boundingBox()).width;
    await m.click("#bBig"); await wait(500);
    check(Math.abs((await m.locator("#pMap").boundingBox()).width - mw0) < 2, "téléphone : largeur inchangée (" + Math.round(mw0) + " px)");
    check(errs.length === 0, "erreurs JS : " + (errs.join(" | ") || "aucune"));
  } catch (e) { console.log("ÉCHEC", e); process.exitCode = 1; } finally { srv.kill(); await b.close(); process.exit(); }
})();
