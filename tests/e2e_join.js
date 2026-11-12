// Rejoindre un code inexistant (chargement puis refus), « Rejouer » côté invité (attente dans le salon, même code).
// Depuis la racine du dépôt : node tests/e2e_join.js /tmp/qj
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const PORT = 8801, URL = "http://localhost:" + PORT + "/";
const OUT = process.argv[2] || "/tmp/qj"; require("fs").mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, msg) => { console.log((ok ? "OK   " : "ÉCHEC") + " " + msg); if (!ok) process.exitCode = 1; };
async function until(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await fn()) return Date.now() - t0; } catch (e) { } await wait(100); } return -1; }
(async () => {
  const srv = spawn(process.execPath, [require("path").join(__dirname, "..", "server", "server.js")], { env: Object.assign({}, process.env, { PORT: String(PORT) }), stdio: "ignore" });
  await wait(800);
  const b = await chromium.launch(); const errs = [];
  const open = async (n, w) => { const p = await (await b.newContext({ viewport: { width: w || 900, height: 800 } })).newPage(); p.on("pageerror", (e) => errs.push(n + ": " + e)); await p.goto(URL); await p.fill("#pseudo", n); return p; };
  const answer = async (p) => { await p.evaluate("QJ.submitGuess(QJ.A.R.game.t)"); await wait(150); await p.evaluate("(()=>{const R=QJ.A.R; R.pin={x:R.info.x,y:R.info.y}; QJ.validatePin();})()"); };
  const C = await open("Client", 400);
  await C.fill("#joinCode", "ZZZZZ"); const t0 = Date.now(); await C.click("#bJoin");
  await wait(300);
  check(await C.evaluate("document.getElementById('bJoin').disabled && /connexion/i.test(document.getElementById('bJoin').innerText)"), "chargement affiché pendant la vérification");
  await C.screenshot({ path: OUT + "/join-loading.png" });
  const t = await until(() => C.evaluate("!document.getElementById('joinErr').classList.contains('hidden')"), 8000);
  check(t >= 0, "code inexistant refusé en " + ((Date.now() - t0) / 1000).toFixed(1) + " s : « " + (await C.innerText("#joinErr")) + " »");
  check((await C.evaluate("QJ.A.screen")) === "home" && !(await C.evaluate("!!QJ.A.nroom")), "reste sur l'accueil, pas dans la salle");
  check(await C.evaluate("!document.getElementById('bJoin').disabled"), "bouton Rejoindre de nouveau utilisable");
  await C.screenshot({ path: OUT + "/join-error.png" });
  // une vraie partie
  const H = await open("Hôte");
  await H.click("#bHost"); await wait(1200);
  const code = (await H.innerText("#codeBox")).trim();
  for (let i = 0; i < 4; i++) await H.click("#settings [data-step='-1']"); // 1 manche
  await C.fill("#joinCode", code);
  check(await C.evaluate("document.getElementById('joinErr').classList.contains('hidden')"), "message effacé en retapant le code");
  const t1 = Date.now(); await C.click("#bJoin");
  check((await until(() => C.evaluate("QJ.A.screen === 'lobby'"), 6000)) >= 0, "partie existante rejointe en " + ((Date.now() - t1) / 1000).toFixed(1) + " s");
  check((await until(async () => (await H.innerText("#playersList")).includes("Client"), 4000)) >= 0, "le client apparaît chez l'hôte");
  await H.click("#bStart"); await wait(2000);
  await answer(H); await answer(C);
  await until(() => H.evaluate("QJ.A.screen === 'reveal'"), 6000); await H.click("#bNext");
  check((await until(() => C.evaluate("QJ.A.screen === 'final'"), 6000)) >= 0, "fin de partie chez le client");
  await wait(2500);
  check(await C.isVisible("#bAgain"), "bouton Rejouer proposé à l'invité");
  await C.click("#bAgain"); await wait(300);
  check((await C.evaluate("QJ.A.screen")) === "lobby" && (await C.innerText("#codeBox")).trim() === code, "invité dans le salon, même code (" + code + ")");
  check(/relance/.test(await C.innerText("#waitHost")), "message d'attente : « " + (await C.innerText("#waitHost")).trim() + " »");
  await C.screenshot({ path: OUT + "/guest-again.png" });
  await H.click("#bAgain"); await wait(300);
  check((await until(() => C.evaluate("QJ.A.st.ph === 'lobby' && QJ.A.screen === 'lobby'"), 4000)) >= 0, "l'hôte relance : l'invité est dans le nouveau salon");
  check(/lancement/.test(await C.innerText("#waitHost")), "message : « " + (await C.innerText("#waitHost")).trim() + " »");
  await H.click("#bStart");
  check((await until(() => C.evaluate("QJ.A.screen === 'game'"), 5000)) >= 0, "nouvelle partie lancée chez l'invité");
  // 2e fin : l'invité attend dans le salon, l'hôte part au lieu de relancer → l'invité prépare la suite
  await answer(H); await answer(C);
  await until(() => H.evaluate("QJ.A.screen === 'reveal'"), 6000); await H.click("#bNext");
  await until(() => C.evaluate("QJ.A.screen === 'final'"), 6000); await wait(2500);
  await C.click("#bAgain"); await wait(300);
  await H.click("#bHome");
  check((await until(() => C.evaluate("QJ.A.mode === 'host' && QJ.A.screen === 'lobby' && QJ.A.st.ph === 'lobby'"), 8000)) >= 0, "hôte parti : l'invité qui attendait devient hôte d'un nouveau salon, même code");
  check((await C.innerText("#codeBox")).trim() === code, "code inchangé");
  check(errs.length === 0, "erreurs JS : " + (errs.join(" | ") || "aucune"));
  srv.kill(); await b.close(); process.exit();
})();
