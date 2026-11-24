// Nom raté : pas de message écrit, le champ rougit en tremblant puis redevient jaune ; « Raté » reste lu
// par les lecteurs d'écran. Depuis la racine du dépôt : node tests/e2e_wrongflash.js [dossier_captures]
const { chromium } = require("./pw");
const { spawn } = require("child_process");
const path = require("path");
const PORT = 8833, URL = "http://localhost:" + PORT + "/";
const OUT = process.argv[2] || "/tmp";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, msg) => { console.log((ok ? "OK   " : "ÉCHEC") + " " + msg); if (!ok) process.exitCode = 1; };
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, "..", "server", "server.js")], { env: Object.assign({}, process.env, { PORT: String(PORT), QJ_JEUX: "ets2" }), stdio: "ignore" });
  await wait(800);
  const b = await chromium.launch(); const errs = [];
  try {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    p.on("pageerror", (e) => errs.push(String(e)));
    await p.goto(URL); await p.fill("#pseudo", "Test"); await p.click("#bSolo"); await wait(300); await p.click("#bStart");
    await p.waitForFunction("QJ.A.R && QJ.A.R.phase === 'name'");
    const border = () => p.evaluate("getComputedStyle(document.getElementById('gInput')).borderColor");
    const shift = () => p.evaluate("getComputedStyle(document.getElementById('gInput')).transform");
    await p.focus("#gInput"); await wait(400);
    const normal = await border();
    await p.fill("#gInput", "Euro Truck Simulator 3"); await p.press("#gInput", "Enter"); await wait(90);
    const shaking = await shift();
    await p.locator(".panel#pName").screenshot({ path: path.join(OUT, "rate-anim.png") });
    await wait(250);
    const red = await border();
    check(await p.evaluate("document.getElementById('gInput').classList.contains('ko')"), "champ marqué raté");
    check(shaking !== "none", "le champ tremble (" + shaking + ")");
    check(red !== normal && /rgb\((2[0-9]{2}|1[5-9][0-9]),/.test(red), "bordure rouge (" + red + ", normale " + normal + ")");
    const fb = await p.locator("#fb").boundingBox();
    check(!fb || fb.width <= 1, "aucun message écrit visible");
    check((await p.textContent("#fb")) === "Raté", "« Raté » lu par les lecteurs d'écran");
    check((await p.inputValue("#gInput")) === "", "champ vidé pour un nouvel essai");
    await wait(1100);
    check(!(await p.evaluate("document.getElementById('gInput').classList.contains('ko')")) && (await border()) === normal, "redevenu jaune (" + (await border()) + ")");
    // deux ratés de suite : l'animation repart
    await p.fill("#gInput", "Minecraft Dungeons 7"); await p.press("#gInput", "Enter"); await wait(60);
    check((await shift()) !== "none", "second raté : le champ tremble à nouveau");
    await p.fill("#gInput", "Euro Truck Simulator 2"); await p.press("#gInput", "Enter"); await wait(300);
    check((await p.evaluate("QJ.A.R.phase")) === "map", "bonne réponse ensuite acceptée");
    check(errs.length === 0, "erreurs JS : " + (errs.join(" | ") || "aucune"));
  } catch (e) { console.log("ÉCHEC", e); process.exitCode = 1; } finally { srv.kill(); await b.close(); process.exit(); }
})();
