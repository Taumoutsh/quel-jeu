// Tests de la reconnaissance des noms : node tests/matcher.test.js
const { GAME_SERIES } = require("../js/games.js");
const { createMatcher, slug } = require("../js/matcher.js");
const M = createMatcher(GAME_SERIES, [
  { t: "Chroniques d'Astral II", s: "Chroniques d'Astral", sa: ["astral"] },
  { t: "Chroniques d'Astral : Origines", s: "Chroniques d'Astral" },
]);

const cases = [
  // [réponse, saisie, attendu]
  ["The Legend of Zelda: Breath of the Wild", "zelda", "precision"],
  ["The Legend of Zelda: Breath of the Wild", "Zelda BOTW", "ok"],
  ["The Legend of Zelda: Breath of the Wild", "breath of the wild", "ok"],
  ["The Legend of Zelda: Breath of the Wild", "the legend of zelda", "precision"],
  ["The Legend of Zelda: Breath of the Wild", "tears of the kingdom", "wrong"],
  ["The Legend of Zelda: Breath of the Wild", "brath of the wild", "ok"],
  ["Grand Theft Auto V", "GTA", "precision"],
  ["Grand Theft Auto V", "GTA 5", "ok"],
  ["Grand Theft Auto V", "gta v", "ok"],
  ["Grand Theft Auto V", "grand theft auto", "precision"],
  ["Grand Theft Auto V", "GTA 4", "wrong"],
  ["Grand Theft Auto V", "san andreas", "wrong"],
  ["Red Dead Redemption 2", "Red Dead Redemption", "precision"],
  ["Red Dead Redemption 2", "rdr2", "ok"],
  ["Red Dead Redemption", "Red Dead Redemption", "ok"],
  ["Dark Souls III", "dark souls", "precision"],
  ["Dark Souls III", "Dark Souls 3", "ok"],
  ["Dark Souls III", "dark souls 2", "wrong"],
  ["Dark Souls", "dark souls", "ok"],
  ["The Elder Scrolls V: Skyrim", "skyrim", "ok"],
  ["The Elder Scrolls V: Skyrim", "skirim", "ok"],
  ["The Elder Scrolls V: Skyrim", "elder scrolls", "precision"],
  ["The Elder Scrolls V: Skyrim", "oblivion", "wrong"],
  ["Super Mario Odyssey", "mario", "precision"],
  ["Super Mario Odyssey", "odyssey", "precision"],
  ["Super Mario Galaxy 2", "super mario galaxy", "precision"],
  ["Halo 3", "halo", "precision"],
  ["Minecraft", "minecraft", "ok"],
  ["Minecraft", "minecarft", "ok"],
  ["Minecraft", "fortnite", "wrong"],
  ["Minecraft", "the", "vague"],
  ["Pokémon Épée et Bouclier", "pokemon", "precision"],
  ["Pokémon Épée et Bouclier", "pokémon épée", "ok"],
  ["Cyberpunk 2077", "cyberpunk", "ok"],
  ["Chroniques d'Astral II", "chroniques d astral", "precision"],
  ["Chroniques d'Astral II", "astral", "precision"],
  ["Chroniques d'Astral II", "Chroniques d'Astral 2", "ok"],
  ["Chroniques d'Astral II", "chroniques d'astral origines", "wrong"],
  ["Final Fantasy VII Remake", "final fantasy 7", "precision"],
  ["Final Fantasy VII Remake", "ff7 remake", "ok"],
  ["Assassin's Creed IV: Black Flag", "assassin's creed", "precision"],
  ["Assassin's Creed IV: Black Flag", "black flag", "ok"],
  ["God of War (2018)", "god of war", "precision"],
  ["Euro Truck Simulator 2", "Euro Truck Simulator 3", "wrong"],
  ["Euro Truck Simulator 2", "euro truck simulatr 2", "ok"],
];
let fail = 0;
for (const [ans, input, exp] of cases) {
  const id = slug(ans);
  if (!M.byId[id]) { console.log("ABSENT", ans); fail++; continue; }
  const r = M.evaluate(input, id);
  const ok = r.k === exp;
  if (!ok) fail++;
  console.log(ok ? "ok  " : "FAIL", JSON.stringify(input).padEnd(36), "→", r.k.padEnd(9), ok ? "" : "(attendu " + exp + ")", r.candidates ? "[" + r.candidates.length + " choix]" : "");
}
// nom d'une série qui est aussi le titre d'un jeu : liste des propositions de toute la série (13 jeux AC),
// sauf si la réponse est justement ce jeu-là
{
  const r = M.evaluate("Assassin's Creed", slug("Assassin's Creed Unity"));
  const ok = r.k === "precision" && !!r.candidates && r.candidates.includes("Assassin's Creed Unity") && r.candidates.includes("Assassin's Creed");
  if (!ok) fail++;
  console.log(ok ? "ok  " : "FAIL", JSON.stringify("Assassin's Creed").padEnd(36), "→", r.k, r.candidates ? "[" + r.candidates.length + " propositions]" : "(pas de liste)");
  const r2 = M.evaluate("Assassin's Creed", slug("Assassin's Creed"));
  if (r2.k !== "ok") fail++;
  console.log(r2.k === "ok" ? "ok  " : "FAIL", "réponse = Assassin's Creed".padEnd(36), "→", r2.k);
}
// un refus ne doit jamais nommer la bonne réponse (« ce n'est pas Euro Truck Simulator 2 » quand c'était lui)
for (const [ans, input] of [["Euro Truck Simulator 2", "Euro Truck Simulator 3"], ["Grand Theft Auto V", "grand theft auto 6"], ["Dark Souls III", "dark souls 4"]]) {
  const r = M.evaluate(input, slug(ans));
  const ok = r.k === "wrong" && (!r.game || r.game.t !== ans);
  if (!ok) fail++;
  console.log(ok ? "ok  " : "FAIL", JSON.stringify(input).padEnd(36), "→", r.k, r.game ? "« " + r.game.t + " »" : "(aucun titre cité)");
}
// titre choisi dans une liste (suggestion ou proposition) : compté tel quel, sans redemander de préciser
// (« Grand Theft Auto: Vice City » choisi quand la réponse est Vice City Stories ne faisait rien)
for (const [ans, input, exp] of [["Grand Theft Auto: Vice City Stories", "Grand Theft Auto: Vice City", "wrong"], ["Red Dead Redemption 2", "Red Dead Redemption", "wrong"],
  ["Grand Theft Auto: Vice City", "Grand Theft Auto: Vice City", "ok"], ["Grand Theft Auto: Vice City Stories", "Grand Theft Auto: Vice City Stories", "ok"], ["Assassin's Creed", "Assassin's Creed", "ok"], ["Assassin's Creed Unity", "Assassin's Creed", "wrong"]]) {
  const r = M.evaluate(input, slug(ans), { exact: true });
  const ok = r.k === exp;
  if (!ok) fail++;
  console.log(ok ? "ok  " : "FAIL", ("choix « " + input + " »").padEnd(36), "→", r.k, "(réponse : " + ans + ")");
}
// au clavier, le même texte demande toujours de préciser
{ const r = M.evaluate("Grand Theft Auto: Vice City", slug("Grand Theft Auto: Vice City Stories")); const ok = r.k === "precision"; if (!ok) fail++; console.log(ok ? "ok  " : "FAIL", "tapé « Grand Theft Auto: Vice City »".padEnd(36), "→", r.k); }
console.log("suggest('zel'):", M.suggest("zel"));
console.log("suggest('gta s'):", M.suggest("gta s"));
console.log("jeux:", M.games.length, "séries:", M.series.length);
console.log(fail ? fail + " échec(s)" : "Tous les tests passent");
process.exit(fail ? 1 : 0);
