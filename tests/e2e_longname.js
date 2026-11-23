// Pseudos longs (16 lettres larges) : le tableau des résultats tient dans sa carte (un nom long poussait les
// colonnes hors de l'écran), et dans le salon le nom s'arrête avant le crayon et les étiquettes.
// Depuis la racine du dépôt : node tests/e2e_longname.js
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const PORT = 8845, URL = "http://localhost:" + PORT + "/";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, msg) => { console.log((ok ? "OK   " : "ÉCHEC") + " " + msg); if (!ok) process.exitCode = 1; };
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, "..", "server", "server.js")], { env: Object.assign({}, process.env, { PORT: String(PORT), QJ_JEUX: "gtav" }), stdio: "ignore" });
  await wait(800);
  const b = await chromium.launch(); const errs = [];
  try {
    const open = async (n) => { const p = await (await b.newContext({ viewport: { width: 360, height: 760 } })).newPage(); p.on("pageerror", (e) => errs.push(n + ": " + e)); await p.goto(URL); await p.fill("#pseudo", n); return p; };
    const H = await open("WWWWWWWWWWWWWWWW"), G = await open("MMMMMMMMMMMMMMMM");
    await H.click("#bHost"); await wait(1200);
    const code = (await H.innerText("#codeBox")).trim();
    await G.fill("#joinCode", code); await G.click("#bJoin"); await wait(1500);
    // salon : le nom ne passe sous aucun bouton ni étiquette
    const lob = await G.evaluate(() => [...document.querySelectorAll(".pl")].map((row) => {
      const nm = row.querySelector("b.grow"), r = nm.getBoundingClientRect();
      const next = nm.nextElementSibling; const nx = next ? next.getBoundingClientRect().left : row.getBoundingClientRect().right;
      return { over: r.right > nx + 0.5, row: row.getBoundingClientRect().right, right: Math.max(...[...row.children].map((c) => c.getBoundingClientRect().right)) };
    }));
    check(lob.length === 2 && lob.every((l) => !l.over && l.right <= l.row + 0.5), "salon : noms raccourcis, rien ne déborde (" + JSON.stringify(lob) + ")");
    for (const p of [G, H]) { await p.click("#bReady"); await wait(300); }
    await wait(4000);
    for (const p of [H, G]) { await p.evaluate("QJ.submitGuess(QJ.A.R.game.t)"); await wait(150); await p.evaluate("(()=>{const R=QJ.A.R; R.pin={x:R.info.x+.05,y:R.info.y}; QJ.validatePin();})()"); }
    await G.waitForFunction("QJ.A.screen === 'reveal'", null, { timeout: 15000 }); await wait(800);
    const rv = await G.evaluate(() => { const t = document.getElementById("rvTable"), c = t.parentElement; const me = t.querySelector(".wn.me"); return { tw: t.scrollWidth, cw: c.clientWidth, doc: document.documentElement.scrollWidth, vw: innerWidth, meW: me ? me.getBoundingClientRect().width : 0, cut: me ? me.scrollWidth > me.clientWidth + 1 : true }; });
    check(rv.tw <= rv.cw && rv.doc <= rv.vw, "résultats : le tableau tient dans sa carte (" + rv.tw + " ≤ " + rv.cw + " px), pas de défilement de côté");
    check(!rv.cut && rv.meW > 100, "résultats : son propre nom en entier, sans « … » (" + Math.round(rv.meW) + " px)");
    const cells = await G.evaluate(() => [...document.querySelectorAll("#rvTable td.n")].map((td) => { const c = td.cloneNode(true); c.querySelectorAll(".bst").forEach((e) => e.remove()); return c.textContent.trim(); }));
    check(cells.length > 0 && cells.every((c) => /^(\d[\d\s\u202f]*|—)$/.test(c)), "colonne Nom : seulement les points, sans détail des erreurs (" + cells.slice(0, 4).join(" | ") + ")");
    // titres et scores en face, même sur un écran étroit (320 px : le titre « POSITION » décalait sa colonne)
    for (const w of [320, 360, 430]) {
      await G.setViewportSize({ width: w, height: 760 }); await wait(250);
      const al = await G.evaluate(() => { const th = [...document.querySelectorAll("#rvTable th")].filter((x) => x.offsetParent).map((x) => Math.round(x.getBoundingClientRect().right)); const rows = [...document.querySelectorAll("#rvTable tr")].slice(1).map((tr) => [...tr.querySelectorAll("td.n")].map((x) => Math.round(x.getBoundingClientRect().right))); return { th, rows }; });
      check(al.th.length >= 4 && al.rows.every((r) => r.length === al.th.length && r.every((x, i) => Math.abs(x - al.th[i]) <= 1)), w + " px : titres en face des scores (" + al.th.join(",") + " / " + al.rows.map((r) => r.join(",")).join(" ; ") + ")");
    }
    check(errs.length === 0, "erreurs JS : " + (errs.join(" | ") || "aucune"));
  } catch (e) { console.log("ÉCHEC", e); process.exitCode = 1; } finally { srv.kill(); await b.close(); process.exit(); }
})();
