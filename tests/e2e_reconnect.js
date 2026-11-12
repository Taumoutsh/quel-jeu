// Téléphone : page mise de côté puis rouverte, coupure réseau prolongée ; la connexion doit revenir seule.
// Depuis la racine du dépôt : node tests/e2e_reconnect.js /tmp/qj
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const OUT = process.argv[2] || "/tmp/qj";
const PORT = 8794, URL = "http://localhost:" + PORT + "/";
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, msg) => { console.log((ok ? "OK   " : "ÉCHEC") + " " + msg); if (!ok) process.exitCode = 1; };
async function until(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await fn()) return Date.now() - t0; } catch (e) { /* transition */ } await wait(250); } return -1; }
const roomState = async (code) => (await (await fetch(URL + "api/rooms/qj-" + code.toLowerCase() + "/state?peer=testeur00")).json());

(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, "..", "server", "server.js")], { env: Object.assign({}, process.env, { PORT: String(PORT) }), stdio: "ignore" });
  await wait(800);
  const errs = [];
  const open = async (name) => {
    const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(name + ": " + e)); await p.goto(URL); await p.fill("#pseudo", name);
    return { b, ctx, p };
  };
  const names = (x) => x.p.evaluate("QJ.A.peers.filter(p => p.presence && p.presence.n).map(p => p.presence.n).sort().join(',')");
  try {
    const H = await open("Hôte"), G = await open("Invité");
    await wait(400);
    await H.p.click("#bHost"); await wait(1200);
    const code = (await H.p.innerText("#codeBox")).trim();
    await G.p.fill("#joinCode", code); await G.p.click("#bJoin"); await wait(1500);
    check((await names(G)) === "Hôte,Invité" && (await names(H)) === "Hôte,Invité", "les deux joueurs se voient");

    // 1. page mise de côté par le navigateur (pagehide persisted) : pas d'annonce de départ
    await G.p.evaluate("window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }))"); await wait(800);
    check(Object.keys((await roomState(code)).peers).length === 2, "page mise de côté : l'invité n'est pas annoncé parti");

    // 2. coupure prolongée : le serveur a oublié l'invité (délai de grâce écoulé, simulé par un départ côté
    //    serveur, ce qui ferme aussi son flux), puis retour sur la page
    const gPeer = await G.p.evaluate("QJ.A.myPeer");
    await G.ctx.setOffline(true);
    await fetch(URL + "api/rooms/qj-" + code.toLowerCase() + "/leave?peer=" + gPeer, { method: "POST", body: "{}" });
    check(Object.keys((await roomState(code)).peers).length === 1, "coupure : le serveur a oublié l'invité");
    await wait(4000);
    await G.ctx.setOffline(false);
    await G.p.evaluate("document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))");
    const t1 = await until(async () => (await names(G)) === "Hôte,Invité" && (await names(H)) === "Hôte,Invité", 10000);
    check(t1 >= 0, "retour sur la page : connexion revenue seule, chacun revoit l'autre (" + (t1 / 1000).toFixed(1) + " s)");
    check(Object.keys((await roomState(code)).peers).length === 2, "l'invité est de nouveau dans la salle côté serveur");

    // 3. la partie se lance toujours chez l'invité après le retour
    await H.p.click("#bStart");
    check((await until(() => G.p.evaluate("QJ.A.screen === 'game'"), 6000)) >= 0, "la partie démarre chez l'invité revenu");

    // 3 bis. le téléphone a déchargé la page en arrière-plan : au retour elle se recharge, se reconnecte seule
    //        à la partie et retrouve ses réponses
    await G.p.evaluate("QJ.submitGuess(QJ.A.R.game.t)"); await wait(150);
    await G.p.evaluate("(()=>{const R=QJ.A.R; R.pin={x:R.info.x,y:R.info.y}; QJ.validatePin();})()"); await wait(600);
    const before = await G.p.evaluate("JSON.stringify(QJ.A.res[0])");
    await G.p.reload(); await wait(500);
    const t2 = await until(async () => (await G.p.evaluate("QJ.A.mode")) === "guest" && (await names(H)) === "Hôte,Invité", 10000);
    check(t2 >= 0, "page rechargée : reconnexion automatique à la partie (" + (t2 / 1000).toFixed(1) + " s)");
    check((await until(async () => (await G.p.evaluate("JSON.stringify(QJ.A.res[0])")) === before, 6000)) >= 0, "réponses de la manche retrouvées après rechargement");
    check((await until(() => G.p.evaluate("QJ.A.screen === 'game' || QJ.A.screen === 'reveal'"), 6000)) >= 0, "de retour dans la partie en cours");

    // 4. page vraiment fermée : départ annoncé
    await G.p.evaluate("window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }))");
    check((await until(async () => Object.keys((await roomState(code)).peers).length === 1, 3000)) >= 0, "page fermée : départ annoncé au serveur");
    check(errs.length === 0, "erreurs JS : " + (errs.length ? errs.join(" | ") : "aucune"));
    await H.b.close(); await G.b.close();
  } catch (e) { console.log("ÉCHEC", e); process.exitCode = 1; } finally { srv.kill(); process.exit(); }
})();
