// Hôte qui passe sur une autre application (page cachée mais toujours active), joueur parti avant d'avoir
// répondu, une seule joueuse restante : relève en pleine manche et classement complet.
// Depuis la racine du dépôt : node tests/e2e_host2.js /tmp/qj
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const OUT = process.argv[2] || "/tmp/qj";
const PORT = 8796, URL = "http://localhost:" + PORT + "/";
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, msg) => { console.log((ok ? "OK   " : "ÉCHEC") + " " + msg); if (!ok) process.exitCode = 1; };
async function until(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await fn()) return Date.now() - t0; } catch (e) { /* transition */ } await wait(250); } return -1; }

(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, "..", "server", "server.js")], { env: Object.assign({}, process.env, { PORT: String(PORT) }), stdio: "ignore" });
  await wait(800);
  const b = await chromium.launch();
  const errs = [];
  const open = async (n) => { const p = await (await b.newContext({ viewport: { width: 900, height: 800 } })).newPage(); p.on("pageerror", (e) => errs.push(n + ": " + e)); await p.goto(URL); await p.fill("#pseudo", n); return p; };
  const answer = async (p) => { await p.evaluate("QJ.submitGuess(QJ.A.R.game.t)"); await wait(150); await p.evaluate("(()=>{const R=QJ.A.R; R.pin={x:R.info.x,y:R.info.y}; QJ.validatePin();})()"); };
  try {
    const H = await open("Hôte"), A = await open("Alice"), B = await open("Bruno");
    await H.click("#bHost"); await wait(1200);
    const code = (await H.innerText("#codeBox")).trim();
    for (let i = 0; i < 3; i++) await H.click("#settings [data-step='-1']"); // 2 manches
    await H.click("#settings .seg[data-k='time'] button[data-v='0']"); // temps illimité : rien ne se débloque seul
    for (const p of [A, B]) { await p.fill("#joinCode", code); await p.click("#bJoin"); await wait(1200); }
    await H.click("#bStart"); await wait(2500);

    // Bruno quitte pendant la manche 1 sans avoir répondu ; Alice répond
    await B.click("#bQuit"); await wait(200); await B.click("#cfYes"); await wait(500);
    await answer(A); await wait(500);
    // l'hôte passe sur une autre application : page cachée, mais toujours active (son signal continue)
    await H.evaluate("Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange'))");
    const t = await until(() => A.evaluate("QJ.A.mode === 'host'"), 20000);
    check(t >= 0 && t < 10000, "hôte passé sur une autre application : relève en pleine manche (" + (t / 1000).toFixed(1) + " s)");
    check((await A.evaluate("QJ.A.st.i")) === 0, "relève pendant la manche 1, sans attendre sa fin");
    // Alice a fini : la manche se termine sans attendre l'hôte caché
    check((await until(() => A.evaluate("QJ.A.screen === 'reveal'"), 6000)) >= 0, "manche terminée sans attendre l'hôte absent");
    await A.click("#bNext"); await wait(1500);
    await answer(A);
    await until(() => A.evaluate("QJ.A.screen === 'reveal'"), 6000); await A.click("#bNext");
    check((await until(() => A.evaluate("QJ.A.screen === 'final'"), 6000)) >= 0, "fin de partie");
    await wait(2500);
    const rows = await A.$$eval("#finTable tr.fin-pl", (trs) => trs.map((tr) => tr.innerText.replace(/\s+/g, " ")));
    console.log("     " + rows.join("\n     "));
    check(rows.some((r) => r.includes("Alice")), "classement multijoueur affiché même avec une seule joueuse restante");
    check(rows.some((r) => r.includes("Bruno")), "Bruno, parti avant d'avoir répondu, apparaît au classement");
    check(rows.some((r) => r.includes("Hôte")), "l'ancien hôte apparaît au classement");

    // 2e partie : l'hôte quitte avec le bouton de fermeture du site en pleine manche, personne n'a répondu
    const H2 = await open("Hôte2"), C = await open("Chloé"), D = await open("David");
    await H2.click("#bHost"); await wait(1200);
    const code2 = (await H2.innerText("#codeBox")).trim();
    await H2.click("#settings .seg[data-k='time'] button[data-v='0']");
    for (const p of [C, D]) { await p.fill("#joinCode", code2); await p.click("#bJoin"); await wait(1200); }
    await H2.click("#bStart"); await wait(2500);
    check((await D.innerHTML("#hChips")).includes("class=\"hc\""), "couronne de l'hôte dans le classement de la manche");
    await H2.click("#bQuit"); await wait(200); await H2.click("#cfYes");
    const t2 = await until(() => C.evaluate("QJ.A.mode === 'host'"), 15000);
    check(t2 >= 0 && t2 < 5000, "hôte parti par le bouton de fermeture : relève en pleine manche (" + (t2 / 1000).toFixed(1) + " s)");
    check((await until(async () => /Chloé est maintenant l'hôte/.test(await D.innerText("#toast")) && (await D.innerHTML("#hChips")).includes("hc"), 4000)) >= 0, "David est prévenu tout de suite (message et couronne de Chloé)");
    check((await C.evaluate("QJ.A.screen")) === "game" && (await C.evaluate("QJ.A.R.i")) === 0, "toujours en manche 1");
    await answer(C); await answer(D);
    check((await until(() => D.evaluate("QJ.A.screen === 'reveal'"), 6000)) >= 0, "manche terminée par le nouvel hôte");
    check(errs.length === 0, "erreurs JS : " + (errs.length ? errs.join(" | ") : "aucune"));
  } catch (e) { console.log("ÉCHEC", e); process.exitCode = 1; } finally { await b.close(); srv.kill(); process.exit(); }
})();
