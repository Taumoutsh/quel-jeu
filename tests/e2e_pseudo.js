// Pseudo laissé vide : un pseudo aléatoire (« Renard Rusé »…) au lieu de « Joueur 42 », en solo comme à
// plusieurs, gardé pour la suite. Depuis la racine du dépôt : node tests/e2e_pseudo.js
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const PORT = 8835, URL = "http://localhost:" + PORT + "/";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, msg) => { console.log((ok ? "OK   " : "ÉCHEC") + " " + msg); if (!ok) process.exitCode = 1; };
const FORM = /^\p{Lu}[\p{L}ï]+ \p{Lu}[\p{L}]+$/u;
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, "..", "server", "server.js")], { env: Object.assign({}, process.env, { PORT: String(PORT) }), stdio: "ignore" });
  await wait(800);
  const b = await chromium.launch(); const errs = [];
  const open = async () => { const p = await (await b.newContext()).newPage(); p.on("pageerror", (e) => errs.push(String(e))); await p.goto(URL); await p.fill("#pseudo", ""); return p; };
  try {
    const names = new Set();
    for (let i = 0; i < 40; i++) names.add(await (await open()).evaluate("QJ.randomPseudo()"));
    const all = [...names];
    check(all.every((n) => n.length <= 16 && FORM.test(n) && !/Joueur/.test(n)), "pseudos aléatoires bien formés : " + all.slice(0, 5).join(", ") + "…");
    check(names.size >= 30, names.size + " pseudos différents sur 40 tirages");
    // solo sans pseudo
    const S = await open();
    await S.click("#bSolo"); await wait(400);
    const sn = await S.evaluate("QJ.A.name");
    check(FORM.test(sn) && (await S.inputValue("#pseudo")) === sn, "solo sans pseudo : « " + sn + " », repris dans le champ");
    await S.reload(); await wait(500);
    check((await S.inputValue("#pseudo")) === sn, "gardé après rechargement");
    // à plusieurs : hôte et invité sans pseudo
    const H = await open(), G = await open();
    await H.click("#bHost"); await wait(1200);
    const code = (await H.innerText("#codeBox")).trim();
    await G.fill("#joinCode", code); await G.click("#bJoin"); await wait(2000);
    const hn = await H.evaluate("QJ.A.name"), gn = await G.evaluate("QJ.A.name");
    const list = await H.innerText("#playersList");
    check(FORM.test(hn) && FORM.test(gn) && list.includes(hn) && list.includes(gn), "salon : « " + hn + " » et « " + gn + " » dans la liste des joueurs");
    check(errs.length === 0, "erreurs JS : " + (errs.join(" | ") || "aucune"));
  } catch (e) { console.log("ÉCHEC", e); process.exitCode = 1; } finally { srv.kill(); await b.close(); process.exit(); }
})();
