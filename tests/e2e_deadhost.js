// Salon dont l'hôte a disparu sans prévenir (onglet fermé depuis le sélecteur du téléphone, page gelée, Cloudflare
// qui garde la connexion en direct ouverte) : le serveur se fie au signal de vie (présence envoyée toutes les 2 s).
// Hôte silencieux : retiré de la liste des salons publics, puis de la salle, qui disparaît ; son joueur peut
// recréer un salon sans « tu as déjà un salon ouvert ». Délais raccourcis pour le test (QJ_LIVE_MS, QJ_REAP_MS).
// Depuis la racine du dépôt : node tests/e2e_deadhost.js
const http = require("http");
const { spawn } = require("child_process");
const path = require("path");
const PORT = 8879, BASE = "http://localhost:" + PORT + "/";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, msg) => { console.log((ok ? "OK   " : "ÉCHEC") + " " + msg); if (!ok) process.exitCode = 1; };
const U = "deadhost0001", st = { gen: "g1", ph: "lobby", cfg: { pub: 1, rounds: 5, time: 120 }, seq: [], i: -1, dl: 0, term: 0 };
const post = (p, body) => fetch(BASE + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const list = async () => (await (await fetch(BASE + "api/public")).json()).rooms.map((r) => r.code);
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, "..", "server", "server.js")], { env: Object.assign({}, process.env, { PORT: String(PORT), QJ_JEUX: "gtav", QJ_LIVE_MS: "3000", QJ_REAP_MS: "6000" }), stdio: "ignore" });
  await wait(800);
  let sse = null;
  try {
    // faux hôte : crée la salle, ouvre son flux en direct (qu'il garde ouvert), publie un salon public… puis se tait
    check((await post("api/rooms/qj-dead1/presence?peer=hostpeer01&s=1&create=1", { u: U })).ok, "salon créé");
    sse = http.get(BASE + "api/rooms/qj-dead1/events?peer=hostpeer01&create=1", (res) => res.on("data", () => {}));
    await wait(300);
    await post("api/rooms/qj-dead1/presence?peer=hostpeer01&s=2", { u: U, n: "Fantôme", h: 1, st });
    check((await list()).includes("DEAD1"), "salon public listé tant que l'hôte donne signe de vie");
    const again = await post("api/rooms/qj-othr1/presence?peer=hostpeer02&s=1&create=1", { u: U });
    check(again.status === 409, "hôte vivant : un 2e salon est refusé (" + again.status + ")");
    await wait(3600);
    check(!(await list()).includes("DEAD1"), "hôte silencieux depuis 3 s : salon retiré de la liste");
    const st1 = await (await fetch(BASE + "api/rooms/qj-dead1/state?peer=probe00001")).json();
    check(st1.peers && st1.peers.hostpeer01, "… mais la salle existe encore (connexion en direct toujours ouverte)");
    await wait(4000);
    const st2 = await (await fetch(BASE + "api/rooms/qj-dead1/state?peer=probe00001")).json();
    check(st2.rid === "vide", "silencieux depuis plus de 6 s : connexion retirée, salle disparue");
    // un autre cas : l'hôte silencieux mais pas encore retiré ; son joueur recrée un salon : accepté, l'ancien fermé
    await post("api/rooms/qj-dead2/presence?peer=hostpeer03&s=1&create=1", { u: U });
    await post("api/rooms/qj-dead2/presence?peer=hostpeer03&s=2", { u: U, n: "Fantôme", h: 1, st });
    await wait(3600);
    const re = await post("api/rooms/qj-new01/presence?peer=hostpeer04&s=1&create=1", { u: U });
    const st3 = await (await fetch(BASE + "api/rooms/qj-dead2/state?peer=probe00001")).json();
    check(re.ok && st3.rid === "vide", "hôte silencieux : nouveau salon accepté et ancien salon fermé (" + re.status + ")");
  } catch (e) { console.log("ÉCHEC", e); process.exitCode = 1; } finally { if (sse) sse.destroy(); srv.kill(); process.exit(); }
})();
