// Carte des résultats : un zoom ou un déplacement à la souris n'est plus annulé par les mises à jour des joueurs.
// Depuis la racine du dépôt : node tests/e2e_revealmap.js
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const PORT = 8817, URL = "http://localhost:" + PORT + "/";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, msg) => { console.log((ok ? "OK   " : "ÉCHEC") + " " + msg); if (!ok) process.exitCode = 1; };
async function until(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await fn()) return Date.now() - t0; } catch (e) { } await wait(150); } return -1; }
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, "..", "server", "server.js")], { env: Object.assign({}, process.env, { PORT: String(PORT) }), stdio: "ignore" });
  await wait(800);
  const b = await chromium.launch(); const errs = [];
  const open = async (n) => { const p = await (await b.newContext({ viewport: { width: 1280, height: 860 } })).newPage(); p.on("pageerror", (e) => errs.push(n + ": " + e)); await p.goto(URL); await p.fill("#pseudo", n); return p; };
  const answer = async (p, dx) => { await p.evaluate("QJ.submitGuess(QJ.A.R.game.t)"); await wait(150); await p.evaluate("(()=>{const R=QJ.A.R; R.pin={x:Math.min(1,R.info.x+" + dx + "),y:R.info.y}; QJ.validatePin();})()"); };
  try {
    const H = await open("Hôte"), A = await open("Alice"), B = await open("Bruno");
    await H.click("#bHost"); await wait(1200);
    const code = (await H.innerText("#codeBox")).trim();
    for (const p of [A, B]) { await p.fill("#joinCode", code); await p.click("#bJoin"); await wait(1200); }
    for (const p of [A, B, H]) { await p.click("#bReady"); await wait(300); }
    await wait(3800);
    // Hôte et Alice répondent ; Bruno pas encore → l'hôte termine la manche à la main
    await answer(H, 0.05); await answer(A, 0.1); await wait(500);
    await H.click("#bForce").catch(() => {}); await H.evaluate("QJ.A.st.ph === 'play' && document.getElementById('bForce').click()");
    check((await until(() => A.evaluate("QJ.A.screen === 'reveal'"), 6000)) >= 0, "résultats de la manche affichés");
    await wait(800);
    const tf = () => A.evaluate("document.querySelector('#rvMap .mv-inner').style.transform");
    // zoom à la molette au centre de la carte
    const box = await A.locator("#rvMap").boundingBox();
    await A.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (let k = 0; k < 4; k++) { await A.mouse.wheel(0, -200); await wait(60); }
    const zoomed = await tf();
    await wait(5000); // plusieurs signaux de vie des joueurs
    check((await tf()) === zoomed, "zoom à la molette conservé après 5 s de mises à jour");
    // déplacement à la souris
    await A.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await A.mouse.down(); await A.mouse.move(box.x + box.width / 2 - 120, box.y + box.height / 2 - 60, { steps: 6 }); await A.mouse.up();
    const moved = await tf();
    check(moved !== zoomed, "déplacement à la souris appliqué");
    await wait(4000);
    check((await tf()) === moved, "déplacement conservé après 4 s de mises à jour");
    // sans y toucher, la carte de l'hôte reste cadrée sur les repères
    check(await H.evaluate("!!document.querySelector('#rvMap .mv-inner').style.transform"), "carte de l'hôte cadrée");
    check(errs.length === 0, "erreurs JS : " + (errs.join(" | ") || "aucune"));
  } catch (e) { console.log("ÉCHEC", e); process.exitCode = 1; } finally { srv.kill(); await b.close(); process.exit(); }
})();
