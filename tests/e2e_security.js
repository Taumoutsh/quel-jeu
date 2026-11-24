// Sécurité du serveur (v1.8.1, audit du propriétaire) :
// 1. limite de connexion admin : changer la première entrée de X-Forwarded-For à chaque essai ne la contourne plus
//    (le serveur lit CF-Connecting-IP ou la dernière entrée, posée par le relais) ;
// 2. en-têtes de sécurité (CSP, cadre interdit…) sur les pages, et aucune violation de la CSP en jouant ;
// 3. présences validées : un joueur ne s'empare pas du rôle d'hôte tant que l'hôte est là, scores bornés,
//    historique refusé pour une partie jamais vue en cours ou finie trop vite, création de salons limitée par IP.
// Depuis la racine du dépôt : node tests/e2e_security.js
const http = require("http");
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const fs = require("fs"), os = require("os"), path = require("path");
const PORT = 8881, BASE = "http://localhost:" + PORT + "/";
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), "qj-sec-"));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, msg) => { console.log((ok ? "OK   " : "ÉCHEC") + " " + msg); if (!ok) process.exitCode = 1; };
const post = (p, body, headers) => fetch(BASE + p, { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, headers || {}), body: JSON.stringify(body) });
const state = async (room) => (await (await fetch(BASE + "api/rooms/" + room + "/state?peer=probe00001")).json());
const games = () => { try { return JSON.parse(fs.readFileSync(path.join(DATA, "games.json"), "utf8")); } catch (e) { return []; } };
const stOf = (gen, ph, extra) => Object.assign({ gen, ph, cfg: { rounds: 1, time: 120, pub: 0 }, seq: ["aaaaaaaaaaaa"], i: 0, dl: 0, term: 0 }, extra || {});
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, "..", "server", "server.js")], { env: Object.assign({}, process.env, { PORT: String(PORT), QJ_JEUX: "gtav", QJ_ADMIN_PASSWORD: "mdp-secret-test", QJ_DATA: DATA }), stdio: "ignore" });
  await wait(800);
  const streams = [];
  const sse = (room, peer, create) => { const r = http.get(BASE + "api/rooms/" + room + "/events?peer=" + peer + (create ? "&create=1" : ""), (res) => res.on("data", () => {})); streams.push(r); return r; };
  try {
    // ---- 1. limite de connexion admin
    const codes = [];
    for (let i = 1; i <= 10; i++) codes.push((await post("api/admin/login", { password: "faux" }, { "X-Forwarded-For": "203.0.113." + i + ", 198.51.100.7" })).status);
    check(codes.filter((c) => c === 429).length >= 2 && codes.slice(0, 8).every((c) => c === 401), "X-Forwarded-For changé à chaque essai : bloqué après 8 échecs (" + codes.join(" ") + ")");
    const cf = (await post("api/admin/login", { password: "faux" }, { "CF-Connecting-IP": "192.0.2.50", "X-Forwarded-For": "198.51.100.7" })).status;
    check(cf === 401, "derrière Cloudflare, l'adresse vient de CF-Connecting-IP (autre client : pas bloqué, " + cf + ")");
    const ok = await post("api/admin/login", { password: "mdp-secret-test" }, { "CF-Connecting-IP": "192.0.2.51" });
    check(ok.status === 200, "le bon mot de passe passe toujours (" + ok.status + ")");

    // ---- 2. en-têtes
    for (const p of ["", "admin", "js/app.js"]) {
      const h = (await fetch(BASE + p)).headers;
      const csp = h.get("content-security-policy") || "";
      check(/frame-ancestors 'none'/.test(csp) && /script-src 'self'/.test(csp) && h.get("x-frame-options") === "DENY" && h.get("x-content-type-options") === "nosniff" && h.get("referrer-policy") === "same-origin",
        "en-têtes de sécurité sur /" + p + " (CSP, X-Frame-Options, nosniff, Referrer-Policy)");
    }
    const hs = (await fetch(BASE, { headers: { "X-Forwarded-Proto": "https" } })).headers.get("strict-transport-security");
    check(/max-age=\d+/.test(hs || ""), "HSTS quand la page est servie en HTTPS (" + hs + ")");
    // aucune violation de la CSP en jouant une manche et sur la page d'administration
    const b = await chromium.launch(); const viol = [];
    for (const [p, act] of [["", async (pg) => { await pg.fill("#pseudo", "Test"); await pg.click("#bSolo"); await wait(300); await pg.click("#bStart"); await pg.waitForFunction("QJ.A.R && QJ.A.R.phase === 'name'"); await wait(800); await pg.evaluate("QJ.submitGuess(QJ.A.R.game.t)"); await wait(800); }],
      ["admin", async (pg) => { await pg.fill("#pwd", "mdp-secret-test"); await pg.click("#login button[type=submit]"); await pg.waitForSelector("#secs:not(.hidden)"); await wait(800); }]]) {
      const pg = await (await b.newContext({ viewport: { width: 1100, height: 850 } })).newPage();
      pg.on("console", (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) viol.push(p + ": " + m.text()); });
      await pg.goto(BASE + p, { waitUntil: "networkidle" }); await act(pg);
    }
    await b.close();
    check(viol.length === 0, "aucune violation de la CSP (jeu et administration) : " + (viol.slice(0, 3).join(" | ") || "aucune"));

    // ---- 3. présences
    // hôte légitime : crée la salle, garde son flux ouvert, publie l'état
    await post("api/rooms/qj-sec01/presence?peer=hostpeer01&s=1&create=1", { u: "hostuser0001" });
    sse("qj-sec01", "hostpeer01", true); await wait(300);
    await post("api/rooms/qj-sec01/presence?peer=hostpeer01&s=2", { u: "hostuser0001", n: "Hôte", h: 1, g: "gen001", st: stOf("gen001", "lobby") });
    // intrus : rejoint et se déclare hôte avec un état inventé et des scores impossibles
    sse("qj-sec01", "intrus0001"); await wait(300);
    const r = await (await post("api/rooms/qj-sec01/presence?peer=intrus0001&s=1", { u: "intrus000001", n: "Intrus", h: 1, g: "gen001", st: stOf("gen001", "end", { term: 99 }), r: [[2, 99999, 99999, 0, 0.5, 0.5, 99999]], pirate: "<script>" })).json();
    const s1 = await state("qj-sec01"), pi = s1.peers.intrus0001;
    check(r.host === false && pi.h === 0 && pi.st === null, "un joueur ne peut pas se déclarer hôte tant que l'hôte est là (" + JSON.stringify({ h: pi.h, st: pi.st }) + ")");
    check(JSON.stringify(pi.r) === "[[2,1000,1000,0,0.5,0.5,500]]" && !("pirate" in pi), "scores bornés (1 000 / 1 000 / 500) et champs inconnus retirés (" + JSON.stringify(pi.r) + ")");
    check(games().length === 0, "pas d'entrée d'historique forgée par l'intrus");
    // l'hôte se tait (page fermée sans prévenir) : au-delà de 6 s, la relève est de nouveau possible
    streams[0].destroy(); await wait(6500);
    const r2 = await (await post("api/rooms/qj-sec01/presence?peer=intrus0001&s=2", { u: "intrus000001", n: "Intrus", h: 1, g: "gen001", st: stOf("gen001", "lobby", { term: 1 }) })).json();
    check(r2.host !== false && (await state("qj-sec01")).peers.intrus0001.h === 1, "hôte parti : la relève par un autre joueur reste possible");

    // partie annoncée finie sans avoir été vue en cours : refusée dans l'historique
    await post("api/rooms/qj-sec02/presence?peer=forgeur001&s=1&create=1", { u: "forgeur00001" });
    sse("qj-sec02", "forgeur001", true); await wait(300);
    await post("api/rooms/qj-sec02/presence?peer=forgeur001&s=2", { u: "forgeur00001", n: "Champion", h: 1, g: "gen002", r: [[2, 1000, 1000, 0, 0, 0, 500]], st: stOf("gen002", "end") });
    await wait(200);
    check(games().length === 0, "fin de partie sans partie vue en cours : refusée dans l'historique");
    // vue en cours mais finie trop vite (moins de 2 s par manche)
    await post("api/rooms/qj-sec02/presence?peer=forgeur001&s=3", { st: stOf("gen003", "play"), g: "gen003" });
    await post("api/rooms/qj-sec02/presence?peer=forgeur001&s=4", { st: stOf("gen003", "end"), g: "gen003", r: [[2, 1000, 1000, 0, 0, 0, 500]] });
    await wait(200);
    check(games().length === 0, "partie finie trop vite (1 manche en moins de 2 s) : refusée");
    // partie normale : jouée au moins 2 s par manche → enregistrée, score borné
    await post("api/rooms/qj-sec02/presence?peer=forgeur001&s=5", { st: stOf("gen004", "play"), g: "gen004" });
    await wait(2200);
    await post("api/rooms/qj-sec02/presence?peer=forgeur001&s=6", { st: stOf("gen004", "end"), g: "gen004", r: [[2, 5000, 1000, 0, 0, 0, 500]] });
    await wait(200);
    const g = games();
    check(g.length === 1 && g[0].players[0].s === 2500, "partie jouée normalement : enregistrée, score borné à 2 500 par manche (" + JSON.stringify(g.map((x) => x.players)) + ")");

    // création de salons : 15 au plus par adresse en 10 minutes
    const st = [];
    for (let i = 0; i < 16; i++) st.push((await post("api/rooms/qj-cr" + String(i).padStart(3, "0") + "/presence?peer=crpeer" + String(i).padStart(4, "0") + "&s=1&create=1", {}, { "X-Forwarded-For": "198.51.100.99" })).status);
    check(st.slice(0, 15).every((c) => c === 200) && st[15] === 429, "création de salons limitée par adresse (16e refusée : " + st[15] + ")");
  } catch (e) { console.log("ÉCHEC", e); process.exitCode = 1; } finally { for (const s of streams) s.destroy(); srv.kill(); process.exit(); }
})();
