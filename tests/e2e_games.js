// Historique des parties (page /admin, data/games.json) : une partie solo et une partie à deux, terminées,
// apparaissent une seule fois chacune avec date, mode, nombre de joueurs, manches, pseudos et scores.
// Depuis la racine du dépôt : node tests/e2e_games.js
const { chromium } = require("./pw");
const { spawn } = require("child_process");
const fs = require("fs"), os = require("os"), path = require("path");
const PORT = 8880, URL = "http://localhost:" + PORT + "/";
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), "qj-games-"));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, msg) => { console.log((ok ? "OK   " : "ÉCHEC") + " " + msg); if (!ok) process.exitCode = 1; };
const playRound = async (p) => { await p.evaluate("QJ.submitGuess(QJ.A.R.game.t)"); await wait(150); await p.evaluate("(()=>{const R=QJ.A.R; R.pin={x:R.info.x,y:R.info.y}; QJ.validatePin();})()"); };
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, "..", "server", "server.js")], { env: Object.assign({}, process.env, { PORT: String(PORT), QJ_JEUX: "gtav,botw", QJ_ADMIN_PASSWORD: "mdp-test", QJ_DATA: DATA }), stdio: "ignore" });
  await wait(800);
  const b = await chromium.launch(); const errs = [];
  const open = async (n) => { const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); p.on("pageerror", (e) => errs.push(n + ": " + e)); await p.goto(URL); await p.fill("#pseudo", n); await wait(500); return p; };
  try {
    // solo, 1 manche
    const S = await open("Solitaire");
    await S.click("#bSolo"); await wait(300); await S.evaluate("QJ.A.cfg.rounds = 1"); await S.click("#bStart");
    await S.waitForFunction("QJ.A.R && QJ.A.R.phase === 'name'"); await playRound(S);
    await S.waitForFunction("QJ.A.screen === 'reveal'"); await wait(300); await S.click("#bNext");
    await S.waitForFunction("QJ.A.screen === 'final'"); await wait(800);
    const soloScore = await S.evaluate(() => QJ.A.res.reduce((t, x) => t + (x[1] + x[2] + (x[6] || 0)), 0));
    // à deux, 1 manche
    const H = await open("Hôtesse"), G = await open("Invité");
    await H.click("#bHost"); await wait(900);
    for (let k = 0; k < 4; k++) { await H.click("#settings [data-step='-1']"); await wait(80); }
    const code = (await H.innerText("#codeBox")).trim();
    await G.fill("#joinCode", code); await G.click("#bJoin"); await G.waitForFunction("QJ.A.screen === 'lobby'");
    await G.click("#bReady"); await wait(300); await H.click("#bReady");
    await H.waitForFunction("QJ.A.R && QJ.A.R.phase === 'name'", null, { timeout: 15000 }); await G.waitForFunction("QJ.A.R && QJ.A.R.phase === 'name'", null, { timeout: 15000 }); await wait(3500);
    await playRound(H); await G.evaluate("QJ.A.R.errors = 2"); await playRound(G);
    await H.waitForFunction("QJ.A.screen === 'reveal'", null, { timeout: 15000 }); await wait(500); await H.click("#bNext");
    await G.waitForFunction("QJ.A.screen === 'final'", null, { timeout: 15000 }); await wait(4500); // signaux de vie de l'écran final : pas de doublon
    const games = JSON.parse(fs.readFileSync(path.join(DATA, "games.json"), "utf8"));
    const solo = games.find((g) => g.mode === "solo"), grp = games.find((g) => g.mode === "groupe");
    check(games.length === 2, "2 parties enregistrées, sans doublon (" + games.length + ")");
    check(solo && solo.rounds === 1 && solo.players.length === 1 && solo.players[0].n === "Solitaire" && solo.players[0].s === soloScore, "solo : pseudo, 1 manche, score " + soloScore + " (" + JSON.stringify(solo && solo.players) + ")");
    check(grp && grp.code === code && grp.rounds === 1 && grp.players.length === 2 && grp.players[0].n === "Hôtesse" && grp.players[1].n === "Invité" && grp.players[0].s > grp.players[1].s && !!Date.parse(grp.at), "groupe : code " + code + ", 2 joueurs classés par score, 1 manche, date (" + JSON.stringify(grp && grp.players) + ")");
    // page d'administration
    const A = await (await b.newContext({ viewport: { width: 1100, height: 850 } })).newPage(); A.on("pageerror", (e) => errs.push("admin: " + e));
    await A.goto(URL + "admin"); await A.fill("#pwd", "mdp-test"); await A.click("#login button[type=submit]"); await A.waitForSelector("#secs:not(.hidden)");
    check((await A.innerText("#nGames")).includes("2"), "onglet « Parties jouées » avec le nombre de parties (« " + (await A.innerText("#secs")).replace(/\s+/g, " ") + " »)");
    await A.click("#secs button[data-s='games']"); await wait(500);
    const txt = (await A.innerText("#gamesCard")).replace(/\s+/g, " ");
    check(/2 parties · 1 en groupe · 1 en solo/.test(txt) && txt.includes(code) && /Hôtesse/.test(txt) && /Solitaire/.test(txt) && /1 manche/.test(txt) && /2 joueurs/.test(txt) && /\d{2}\/\d{2}\/\d{4}/.test(txt), "historique : « " + txt.slice(0, 220) + "… »");
    const first = await A.evaluate(() => document.querySelector(".adm-game").innerText);
    check(first.includes(code), "la plus récente en premier");
    await A.fill("#gSearch", "solit"); await wait(200);
    check((await A.$$(".adm-game")).length === 1, "filtre par pseudo");
    await A.fill("#gSearch", ""); await wait(200);
    if (process.argv[2]) await A.screenshot({ path: path.join(process.argv[2], "admin-games.png") });
    check(errs.length === 0, "erreurs JS : " + (errs.join(" | ") || "aucune"));
  } catch (e) { console.log("ÉCHEC", e); process.exitCode = 1; } finally { srv.kill(); await b.close(); process.exit(); }
})();
