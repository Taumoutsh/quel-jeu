// Éditeur d'avatar : rangées à flèches et pastilles, ancien avatar accepté, Annuler / Terminé, avatar complet vu des autres.
// Depuis la racine du dépôt : node tests/e2e_avatar.js
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const PORT = 8825, URL = "http://localhost:" + PORT + "/";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, msg) => { console.log((ok ? "OK   " : "ÉCHEC") + " " + msg); if (!ok) process.exitCode = 1; };
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, "..", "server", "server.js")], { env: Object.assign({}, process.env, { PORT: String(PORT) }), stdio: "ignore" });
  await wait(800);
  const b = await chromium.launch(); const errs = [];
  try {
    const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    p.on("pageerror", (e) => errs.push(String(e)));
    await p.goto(URL); await p.evaluate("localStorage.setItem('qj.avatar', JSON.stringify('ninja.2.1.0'))"); await p.reload(); await wait(600);
    check((await p.evaluate("QJ.A.avatar")) === "ninja.2.1.0", "ancien avatar (4 champs) conservé");
    await p.click("#bAvaEdit"); await wait(200);
    const val = (k) => p.evaluate(`(() => { const b = document.querySelector('[data-f="${k}1"]'); return b ? b.parentElement.querySelector('.ava-val').innerText.replace(/\\s+/g, ' ') : null; })()`);
    check(/Ninja 3 \/ 14/.test(await val("t")) && (await val("b")) === null, "ninja : rangée Tenue, pas de Bouche (masque)");
    await p.click('[data-f="t1"]'); await wait(80);
    check(/Sorcier/.test(await val("t")) && /Aucune 1 \/ 10/.test(await val("b")), "flèche droite : tenue suivante, rangée Bouche apparue");
    await p.click('[data-f="t-1"]'); await p.click('[data-f="t-1"]'); await p.click('[data-f="t-1"]'); await p.click('[data-f="t-1"]');
    check(/Chef|Cheffe/.test(await val("t")), "flèche gauche : défilement circulaire (dernière tenue)");
    await p.click('[data-f="b1"]'); await p.click('[data-f="b1"]'); await p.click('[data-f="a1"]'); await p.click('[data-f="f1"]'); await p.click('[data-f="br1"]'); await p.click('[data-f="hs4"]');
    const spec = await p.evaluate("QJ.A.avatar");
    check(spec === "chef.2.1.0.2.1.1.4.1", "bouche, sourcils, accessoire, cheveux et fond enregistrés (" + spec + ")");
    check(await p.evaluate("document.activeElement && document.activeElement.dataset.f === 'hs4'"), "le focus reste sur la commande utilisée");
    await p.click("#bAvaUndo"); await wait(100);
    check((await p.evaluate("QJ.A.avatar")) === "ninja.2.1.0" && await p.evaluate("document.getElementById('avaOpts').classList.contains('hidden')"), "Annuler : avatar d'avant, éditeur fermé");
    await p.click("#bAvaEdit"); await p.click('[data-f="t1"]'); await p.click('[data-f="b1"]'); await p.click("#bAvaDone"); await wait(100);
    check((await p.evaluate("localStorage.getItem('qj.avatar')")) === JSON.stringify("sorcier.2.1.0.1.0.0.0.0"), "Terminé : avatar enregistré");

    // un autre joueur voit l'avatar complet
    await p.fill("#pseudo", "Hôte"); await p.click("#bHost"); await wait(1200);
    const code = (await p.innerText("#codeBox")).trim();
    const g = await (await b.newContext()).newPage(); g.on("pageerror", (e) => errs.push(String(e)));
    await g.goto(URL); await g.fill("#pseudo", "Ami"); await g.fill("#joinCode", code); await g.click("#bJoin"); await wait(1500);
    const seen = await g.evaluate("(() => { const p = QJ.A.peers.find((x) => x.presence && x.presence.n === 'Hôte'); return p && p.presence.a; })()");
    check(seen === "sorcier.2.1.0.1.0.0.0.0" && (await g.evaluate("document.querySelectorAll('#playersList .ava svg').length")) >= 2, "l'ami voit l'avatar complet de l'hôte (" + seen + ")");
    check(errs.length === 0, "erreurs JS : " + (errs.join(" | ") || "aucune"));
  } catch (e) { console.log("ÉCHEC", e); process.exitCode = 1; } finally { srv.kill(); await b.close(); process.exit(); }
})();
