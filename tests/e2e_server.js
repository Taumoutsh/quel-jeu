// Partie à deux joueurs contre le vrai serveur (server/server.js), dans deux navigateurs séparés.
// Depuis la racine du dépôt : node tests/e2e_server.js /tmp/qj
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const OUT = process.argv[2] || "/tmp/qj";
const PORT = 8791, URL = "http://localhost:" + PORT + "/";
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, msg) => { console.log((ok ? "OK   " : "ÉCHEC") + " " + msg); if (!ok) process.exitCode = 1; };

(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, "..", "server", "server.js")], { env: Object.assign({}, process.env, { PORT: String(PORT) }), stdio: "inherit" });
  await wait(700);
  const args = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
  const bh = await chromium.launch({ args }), bg = await chromium.launch({ args });
  const h = await (await bh.newContext({ viewport: { width: 1100, height: 800 } })).newPage();
  const g = await (await bg.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = [];
  for (const pg of [h, g]) pg.on("pageerror", (e) => errs.push(String(e)));
  try {
    await h.goto(URL); await g.goto(URL); await wait(800);
    check(await h.isEnabled("#bHost"), "bouton « Créer un serveur » actif");
    check((await h.inputValue("#pseudo")) !== null, "page chargée");
    await h.fill("#pseudo", "Hôte"); await h.click("#bHost"); await wait(1200);
    const code = (await h.innerText("#codeBox")).trim();
    check(/^[A-Z0-9]{5}$/.test(code), "code de partie : " + code);
    await h.click("#settings [data-step='-1']"); await h.click("#settings [data-step='-1']"); await h.click("#settings [data-step='-1']"); // 2 manches
    await g.fill("#pseudo", "Ami"); await g.fill("#joinCode", code); await g.click("#bJoin"); await wait(1500);
    const glist = await g.innerText("#playersList"), hlist = await h.innerText("#playersList");
    check(glist.includes("Hôte") && glist.includes("Ami"), "l'invité voit les deux joueurs");
    check(hlist.includes("Ami"), "l'hôte voit l'invité");
    check((await g.innerText("#sRounds")).trim() === "2", "réglages de l'hôte reçus (2 manches)");
    await g.fill("#lobbyName", "Ami renommé"); await g.press("#lobbyName", "Enter"); await wait(1200);
    check((await h.innerText("#playersList")).includes("Ami renommé"), "pseudo modifié dans le salon, vu par l'hôte");
    check((await g.evaluate("localStorage.getItem('qj.name')")) === JSON.stringify("Ami renommé"), "nouveau pseudo enregistré");
    await g.screenshot({ path: OUT + "/s1-guest-lobby.png" });
    await h.click("#bStart"); await wait(2000);
    check((await g.evaluate("QJ.A.screen")) === "game", "l'invité est passé en jeu");
    check((await h.evaluate("QJ.A.R.sid")) === (await g.evaluate("QJ.A.R.sid")), "même vue pour les deux : " + (await g.evaluate("QJ.A.R.sid")));
    await h.evaluate("QJ.submitGuess(QJ.A.R.game.t)"); await wait(300);
    await h.evaluate("(()=>{const R=QJ.A.R; R.pin={x:R.info.x,y:R.info.y}; QJ.validatePin();})()"); await wait(500);
    await g.evaluate("QJ.submitGuess(QJ.A.R.game.t)"); await wait(300);
    await g.evaluate("(()=>{const R=QJ.A.R; R.pin={x:R.info.x+0.1,y:R.info.y}; QJ.validatePin();})()"); await wait(1500);
    check((await h.evaluate("QJ.A.st.ph")) === "rev" && (await g.evaluate("QJ.A.screen")) === "reveal", "révélation chez les deux");
    await g.screenshot({ path: OUT + "/s2-guest-reveal.png", fullPage: true });
    const table = await g.innerText("#rvTable");
    check(table.includes("Hôte") && table.includes("Ami"), "scores des deux joueurs affichés");
    await h.click("#bNext"); await wait(1500);
    check((await g.evaluate("QJ.A.st.i")) === 1, "manche 2 reçue par l'invité");
    // déconnexion brutale de l'invité : l'hôte doit le voir partir (délai de grâce du serveur : 15 s)
    await bg.close();
    await wait(17000);
    check(!(await h.evaluate("QJ.A.peers.map(p=>p.presence&&p.presence.n).join()")).includes("Ami"), "l'invité parti disparaît de la salle");
  } catch (e) {
    console.error(e); process.exitCode = 1;
  } finally {
    check(!errs.length, "erreurs JS : " + (errs.join(" | ") || "aucune"));
    await bh.close().catch(() => {}); await bg.close().catch(() => {});
    srv.kill();
  }
})();
