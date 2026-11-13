// Relève de l'hôte, départs et arrivées en cours de partie (serveur réel, 4 navigateurs).
// Depuis la racine du dépôt : node tests/e2e_host.js /tmp/qj
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const OUT = process.argv[2] || "/tmp/qj";
const PORT = 8793, URL = "http://localhost:" + PORT + "/";
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, msg) => { console.log((ok ? "OK   " : "ÉCHEC") + " " + msg); if (!ok) process.exitCode = 1; };
async function until(fn, ms, step) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await fn()) return Date.now() - t0; } catch (e) { /* page en transition */ } await wait(step || 300); } return -1; }

(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, "..", "server", "server.js")], { env: Object.assign({}, process.env, { PORT: String(PORT) }), stdio: "ignore" });
  await wait(800);
  const args = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
  const errs = [];
  const open = async (name) => {
    const b = await chromium.launch({ args }); const ctx = await b.newContext({ viewport: { width: 1000, height: 800 } });
    const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(name + ": " + e)); await p.goto(URL); await p.fill("#pseudo", name);
    return { b, ctx, p };
  };
  const answer = async (p, dx) => { await p.evaluate("QJ.submitGuess(QJ.A.R.game.t)"); await wait(150); await p.evaluate("(()=>{const R=QJ.A.R; R.pin={x:R.info.x+" + dx + ",y:R.info.y}; QJ.validatePin();})()"); };
  const join = async (x, code) => { await x.p.fill("#joinCode", code); await x.p.click("#bJoin"); await wait(1200); };
  try {
    const H = await open("Hôte"), G1 = await open("Alice"), G2 = await open("Bruno");
    await wait(500);
    await H.p.click("#bHost"); await wait(1200);
    const code = (await H.p.innerText("#codeBox")).trim();
    for (let i = 0; i < 2; i++) await H.p.click("#settings [data-step='-1']"); // 3 manches
    await join(G1, code); await join(G2, code);
    for (const x of [G1, G2, H]) { await x.p.click("#bReady"); await wait(300); } // tout le monde prêt : départ
    await wait(2500);
    check((await G2.p.evaluate("QJ.A.screen")) === "game", "partie lancée chez les invités");

    // manche 1 : tout le monde répond, l'hôte passe à la suivante
    for (const [x, d] of [[H, 0], [G1, 0.02], [G2, 0.04]]) await answer(x.p, d);
    check((await until(() => G1.p.evaluate("QJ.A.screen === 'reveal'"), 6000)) >= 0, "manche 1 terminée chez tous");
    await until(() => H.p.evaluate("QJ.A.screen === 'reveal'"), 6000);
    // l'hôte du moment (sous forte charge, une page privée de processeur plus de 6 s peut être relevée)
    const curHost = (await H.p.evaluate("QJ.A.mode")) === "host" ? H : G1;
    if (curHost !== H) console.log("     (relève sous charge : Alice est hôte)");
    await curHost.p.click("#bNext");
    check((await until(() => G1.p.evaluate("QJ.A.screen === 'game' && QJ.A.R.i === 1"), 10000)) >= 0, "manche 2 reçue");

    // un invité part, un joueur arrive en cours de partie
    await G2.p.click("#bQuit").catch(() => {}); await wait(300);
    await G2.p.evaluate("document.getElementById('cfYes') && !document.getElementById('confirm').classList.contains('hidden') && document.getElementById('cfYes').click()");
    await G2.b.close();
    const L = await open("Léa"); await join(L, code);
    check((await until(() => L.p.evaluate("QJ.A.screen === 'game' && QJ.A.R.i === 1"), 6000)) >= 0, "joueur arrivé en cours de partie, à la manche 2");
    check((await L.p.evaluate("QJ.A.j")) === 1, "sa manche d'arrivée est notée (2)");

    // l'hôte ne répond plus (réseau coupé, comme un téléphone verrouillé) : Alice, arrivée la première, prend le relais
    await H.ctx.setOffline(true);
    const t = await until(() => G1.p.evaluate("QJ.A.mode === 'host'"), 30000, 500);
    check(t >= 0 && t < 12000, "nouvel hôte désigné automatiquement (Alice, en " + Math.round(t / 1000) + " s, moins de 12 s)");
    check((await L.p.evaluate("QJ.A.mode")) === "guest", "Léa reste invitée");
    check((await until(async () => (await L.p.evaluate("QJ.A.hostPeer")) && (await L.p.evaluate("QJ.A.peers.find(p => p.peer === QJ.A.hostPeer).presence.n")) === "Alice", 8000)) >= 0, "Léa suit le nouvel hôte");

    // la partie continue sans l'ancien hôte
    for (const [x, d] of [[G1, 0.01], [L, 0.03]]) await answer(x.p, d);
    check((await until(() => L.p.evaluate("QJ.A.screen === 'reveal'"), 8000)) >= 0, "manche 2 terminée sans l'ancien hôte");
    await G1.p.click("#bNext");
    check((await until(() => L.p.evaluate("QJ.A.screen === 'game' && QJ.A.R.i === 2"), 6000)) >= 0, "le nouvel hôte lance la manche 3");
    for (const [x, d] of [[G1, 0.01], [L, 0.02]]) await answer(x.p, d);
    await until(() => G1.p.evaluate("QJ.A.screen === 'reveal'"), 8000);
    await G1.p.click("#bNext");
    check((await until(() => L.p.evaluate("QJ.A.screen === 'final'"), 6000)) >= 0, "classement final atteint");
    await wait(3500);
    await L.p.screenshot({ path: OUT + "/host-final.png", fullPage: true });
    // une ligne du classement par joueur : nom, mention, manches jouées
    const rows = await L.p.$$eval("#finTable tr.fin-pl", (trs) => trs.map((tr) => tr.innerText.replace(/\s+/g, " ")));
    const row = (n) => rows.find((r) => r.includes(n)) || "";
    console.log("     " + rows.join("\n     "));
    check(/ 1\/1 /.test(row("Bruno")), "classement : Bruno (parti) 1/1 jeu trouvé sur ses manches jouées");
    check(/ 1\/1 /.test(row("Hôte")), "classement : l'ancien hôte (parti) 1/1");
    check(/ 2\/2 /.test(row("Léa")), "classement : Léa (arrivée à la manche 2) 2/2");
    check(/ 3\/3 /.test(row("Alice")), "classement : Alice 3/3");
    check(!rows.some((r) => /parti|arrivé/.test(r)), "pas de mention parti / arrivé");
    const recap = (await L.p.innerText("#finSolo")).replace(/\s+/g, " ");
    check(/sur 4\s?000 points possibles/.test(recap) && /2\/2 jeux trouvés/.test(recap), "récapitulatif de Léa (arrivée en cours) sur ses 2 manches : « " + recap + " »");

    // l'ancien hôte revient : il redevient simple joueur
    await H.ctx.setOffline(false);
    check((await until(() => H.p.evaluate("QJ.A.mode === 'guest'"), 15000, 500)) >= 0, "l'ancien hôte revenu redevient invité");
    check((await G1.p.evaluate("QJ.A.mode")) === "host", "Alice reste l'hôte");
    check(errs.length === 0, "erreurs JS : " + (errs.length ? errs.join(" | ") : "aucune"));
    for (const x of [H, G1, L]) await x.b.close();
  } catch (e) {
    console.log("ÉCHEC", e); process.exitCode = 1;
  } finally { srv.kill(); process.exit(); }
})();
