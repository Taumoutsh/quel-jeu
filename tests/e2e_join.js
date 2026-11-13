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
  // salon : chacun clique sur « Je suis prêt » ; la partie démarre quand tout le monde est prêt
  const info = (p) => p.innerText("#readyInfo");
  check(/0\/2/.test(await info(H)) && /0\/2/.test(await info(C)), "salon : Prêts 0/2 chez les deux");
  check(!(await H.isVisible("#bStart")) && (await H.isVisible("#bReady")), "hôte : bouton Prêt, pas de « Lancer » à plusieurs");
  check(!(await C.isVisible("#bStart")) && (await C.isVisible("#bReady")), "l'invité a le bouton Prêt, pas Lancer");
  const above = (p) => p.evaluate("!!(document.getElementById('bReady').compareDocumentPosition(document.getElementById('settings')) & Node.DOCUMENT_POSITION_FOLLOWING)");
  check(await above(C), "invité : bouton Prêt au-dessus des réglages");
  check(!(await above(H)), "hôte : bouton Prêt en bas, sous les réglages");
  await C.screenshot({ path: OUT + "/ready-guest.png" });
  await C.click("#bReady");
  check((await until(async () => /1\/2/.test(await info(H)) && /PRÊT/i.test(await H.innerText("#playersList")), 3000)) >= 0, "l'hôte voit l'invité prêt (1/2) en moins de 3 s");
  check(/annuler/i.test(await C.innerText("#bReady")), "bouton de l'invité : Prêt ! (annuler)");
  await C.click("#bReady");
  check((await until(async () => /0\/2/.test(await info(H)), 3000)) >= 0, "l'invité annule : 0/2 chez l'hôte");
  // clics rapides : l'état final doit être « prêt » partout (présences dans l'ordre)
  for (let k = 0; k < 5; k++) { await C.click("#bReady"); await wait(30); }
  check((await until(async () => /1\/2/.test(await info(H)), 3000)) >= 0, "5 clics rapides : l'hôte voit bien l'état final (prêt)");
  await H.screenshot({ path: OUT + "/ready-host.png" });
  check((await H.evaluate("QJ.A.st.ph")) === "lobby", "pas de départ tant que l'hôte n'est pas prêt");
  await H.click("#bReady");
  check((await until(() => C.evaluate("!document.getElementById('cd').classList.contains('hidden')"), 2000)) >= 0, "tout le monde prêt : départ automatique, décompte affiché chez l'invité");
  check(await H.evaluate("QJ.A.cdGen === QJ.A.gen && QJ.A.st.t0 > 0"), "décompte lancé chez l'hôte aussi");
  await wait(400); await C.screenshot({ path: OUT + "/countdown.png" });
  check((await until(() => C.evaluate("document.getElementById('cd').classList.contains('hidden')"), 4500)) >= 0, "décompte terminé, la manche commence");
  check(/^(2:00|1:5\d)$/.test((await H.innerText("#hTime")).trim()), "chrono plein au début de la manche, décompte non compté (" + (await H.innerText("#hTime")).trim() + ")");
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
  check(/0\/2/.test(await info(C)) && /je suis prêt/i.test(await C.innerText("#bReady")), "nouveau salon : tout le monde redevient « pas prêt »");
  await C.click("#bReady"); await wait(300); await H.click("#bReady");
  check((await until(() => C.evaluate("QJ.A.screen === 'game'"), 5000)) >= 0, "nouvelle partie lancée chez l'invité");
  // 2e fin : l'invité attend dans le salon, l'hôte part au lieu de relancer → l'invité prépare la suite
  await answer(H); await answer(C);
  await until(() => H.evaluate("QJ.A.screen === 'reveal'"), 6000); await H.click("#bNext");
  await until(() => C.evaluate("QJ.A.screen === 'final'"), 6000); await wait(2500);
  await C.click("#bAgain"); await wait(300);
  await H.click("#bHome");
  check((await until(() => C.evaluate("QJ.A.mode === 'host' && QJ.A.screen === 'lobby' && QJ.A.st.ph === 'lobby'"), 8000)) >= 0, "hôte parti : l'invité qui attendait devient hôte d'un nouveau salon, même code");
  check((await C.innerText("#codeBox")).trim() === code, "code inchangé");
  // serveur : une présence plus ancienne (numéro d'ordre inférieur) arrivée en retard est ignorée
  const post = (s, body) => fetch(URL + "api/rooms/qj-ordre/presence?peer=testordre01&s=" + s, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  await post(2, { n: "Ordre", rd: "neuf" }); await post(1, { n: "Ordre", rd: "" });
  const stt = await (await fetch(URL + "api/rooms/qj-ordre/state?peer=testordre02")).json();
  check(stt.peers.testordre01 && stt.peers.testordre01.rd === "neuf", "serveur : présence périmée ignorée (ordre des envois respecté)");
  check(errs.length === 0, "erreurs JS : " + (errs.join(" | ") || "aucune"));
  srv.kill(); await b.close(); process.exit();
})();
