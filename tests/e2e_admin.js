// Signalement d'une erreur par un joueur, puis correction dans la page /admin (serveur réel).
// Depuis la racine du dépôt : node tests/e2e_admin.js /tmp/qj
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const OUT = process.argv[2] || "/tmp/qj";
const PORT = 8792, URL = "http://localhost:" + PORT + "/";
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), "qj-data-"));
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, msg) => { console.log((ok ? "OK   " : "ÉCHEC") + " " + msg); if (!ok) process.exitCode = 1; };
// pack servi aux joueurs : vues sous un code, détails brouillés (z) ; on les décode comme la page
const packOf = async (page) => page.evaluate(async () => {
  const t = await (await fetch("packs/vrais-jeux.js?x=" + Math.random())).text();
  const p = JSON.parse(t.slice(t.indexOf("/*JSON*/") + 8, t.indexOf("/*FIN*/")));
  const un = (code, z) => { const bin = atob(z), b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i) ^ code.charCodeAt(i % code.length); return JSON.parse(new TextDecoder().decode(b)); };
  p.raw = t; p.scenes = p.scenes.map((s) => (s.z ? Object.assign({ id: s.id }, un(s.id, s.z)) : s));
  return p;
});
const crypto = require("crypto");

(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, "..", "server", "server.js")], { env: Object.assign({}, process.env, { PORT: String(PORT), QJ_ADMIN_PASSWORD: "motdepasse-test", QJ_DATA: DATA }), stdio: "inherit" });
  await wait(800);
  const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const errs = [];
  const p = await (await b.newContext({ viewport: { width: 1100, height: 850 } })).newPage();
  p.on("pageerror", (e) => errs.push(String(e)));
  try {
    // 1. une partie solo d'une manche, puis signalement d'une position fausse
    await p.goto(URL); await wait(600);
    await p.fill("#pseudo", "Testeur"); await p.click("#bSolo"); await wait(400);
    for (let i = 0; i < 4; i++) await p.click("#settings [data-step='-1']");
    await p.click("#bStart"); await wait(2000);
    const sid = (await p.evaluate("QJ.A.R.sid")).slice(2);
    await p.evaluate("QJ.submitGuess(QJ.A.R.game.t)"); await wait(200);
    await p.evaluate("(()=>{const R=QJ.A.R; R.pin={x:R.info.x,y:R.info.y}; QJ.validatePin();})()"); await wait(1200);
    check(await p.isVisible("#bReport"), "bouton « Signaler une erreur » visible");
    await p.click("#bReport"); await wait(200);
    await p.click("#rpKind [data-v='position']"); await wait(600);
    const box = await p.$("#rpMap").then((e) => e.boundingBox());
    await p.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.4); await wait(200);
    await p.fill("#rpText", "Le lieu est plus à l'ouest.");
    await p.screenshot({ path: OUT + "/report.png" });
    await p.click("#rpYes"); await wait(600);
    check((await p.textContent("#bReport")).includes("signalée"), "signalement envoyé");
    const saved = JSON.parse(fs.readFileSync(path.join(DATA, "reports.json"), "utf8"));
    const secret = fs.readFileSync(path.join(DATA, "secret.txt"), "utf8").trim();
    const codeOf = (id) => crypto.createHmac("sha256", secret).update(id).digest("hex").slice(0, 12);
    check(saved.length === 1 && codeOf(saved[0].sid) === sid && saved[0].kind === "position" && saved[0].pin, "signalement gardé par le serveur sous le vrai nom de la vue (" + saved[0].sid + ")");

    // noms cachés : rien de lisible dans ce que reçoit le joueur
    const net = await p.evaluate(() => performance.getEntriesByType("resource").map((e) => e.name).filter((u) => /packs\/img\//.test(u)));
    check(net.length > 0 && net.every((u) => /packs\/img\/(x\/[0-9a-f]{12}\.jpg|dispo\.js)/.test(u)), "images chargées sous des codes neutres (" + net.length + ")");
    const pk0 = await packOf(p), real = saved[0].sid;
    check(!pk0.raw.includes(real) && /^[0-9a-f]{12}$/.test(pk0.scenes[0].id) && !("game" in JSON.parse(pk0.raw.slice(pk0.raw.indexOf("/*JSON*/") + 8, pk0.raw.indexOf("/*FIN*/"))).scenes[0]), "pack servi : ni nom de vue ni jeu en clair");
    const dispo = await p.evaluate(async () => (await fetch("packs/img/dispo.js")).text());
    check(!dispo.includes(real) && !/map-gtav/.test(dispo), "dispo.js servi : codes à la place des noms");
    check((await p.evaluate("JSON.stringify(QJ.A.st.seq)")).match(/r-[0-9a-f]{12}/) && !(await p.evaluate("JSON.stringify(QJ.A.st.seq)")).includes(real), "liste des manches : codes seulement");

    // 2. page d'administration
    const a = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    a.on("pageerror", (e) => errs.push(String(e)));
    await a.goto(URL + "admin"); await wait(500);
    await a.fill("#pwd", "faux"); await a.click("#login button[type=submit]"); await wait(300);
    check((await a.textContent("#loginMsg")).includes("incorrect"), "mauvais mot de passe refusé");
    await a.fill("#pwd", "motdepasse-test"); await a.click("#login button[type=submit]"); await wait(800);
    check(await a.isVisible("#main"), "connexion avec le mot de passe du .env");
    check((await a.textContent("#nOpen")).includes("1"), "1 signalement en attente");
    await a.click(".adm-item"); await wait(900);
    await a.screenshot({ path: OUT + "/admin.png", fullPage: true });
    await a.click("[data-use]"); await a.fill("#ePlace", "Lieu corrigé"); await a.click("#eSaveBtn"); await wait(600);
    let pk = await packOf(a), sc = pk.scenes.find((s) => s.id === sid);
    check(sc && sc.place === "Lieu corrigé" && Math.abs(sc.x - saved[0].pin.x) < 1e-3, "correction appliquée au pack servi aux joueurs");
    await a.click("[data-st='resolved']"); await wait(400);
    check(JSON.parse(fs.readFileSync(path.join(DATA, "reports.json"), "utf8"))[0].status === "resolved", "signalement marqué résolu");
    a.on("dialog", (d) => d.accept());
    await a.click("#eDel"); await wait(600);
    pk = await packOf(a);
    check(!pk.scenes.some((s) => s.id === sid), "vue supprimée du pack servi");
    await a.click("#eReset"); await wait(600);
    pk = await packOf(a); sc = pk.scenes.find((s) => s.id === sid);
    check(sc && sc.place !== "Lieu corrigé", "vue rétablie à l'original");
    const r = await p.evaluate(async () => (await fetch("api/admin/data")).status);
    check(r === 401, "données d'administration refusées sans connexion");
    const priv = await p.evaluate(async () => (await fetch("data/reports.json")).status);
    check(priv === 404, "fichiers de données non servis");
    check(errs.length === 0, "erreurs JS : " + (errs.length ? errs.join(" | ") : "aucune"));
  } catch (e) {
    console.log("ÉCHEC", e); process.exitCode = 1;
  } finally {
    await b.close(); srv.kill(); fs.rmSync(DATA, { recursive: true, force: true });
  }
})();
