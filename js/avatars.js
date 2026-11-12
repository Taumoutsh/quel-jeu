/* Avatars des joueurs : petites figurines originales façon « figurine pop » (grosse tête carrée, yeux ronds,
 * pas de bouche), chacune sur un archétype du jeu vidéo, sans reprendre de personnage existant.
 * Un avatar se compose : tenue (archétype), couleur (celle du joueur : repères et traits sur la carte),
 * peau et yeux. Il s'écrit "tenue.couleur.peau.yeux", ex. "ninja.2.1.0" (indices dans les listes ci-dessous).
 * Les anciens identifiants seuls ("ninja"…) restent acceptés.
 * window.AVATAR = { TENUES, COULEURS, PEAUX, YEUX, parse, format, random, svg, color, ok } ;
 * window.avatarSVG(spec) renvoie le dessin (viewBox 0 0 64 64).
 */
(function (root) {
  "use strict";
  const INK = "#14181f";

  const TENUES = [
    { id: "aventuriere", nom: "Aventurière" },
    { id: "pilote", nom: "Pilote" },
    { id: "ninja", nom: "Ninja" },
    { id: "sorcier", nom: "Sorcier" },
    { id: "elfe", nom: "Archère elfe" },
    { id: "pirate", nom: "Pirate" },
    { id: "robot", nom: "Robot" },
    { id: "astronaute", nom: "Astronaute" },
  ];
  const COULEURS = ["#f4b740", "#ff7b72", "#4cc9c0", "#9d8cff", "#6fd69b", "#ff9f5a", "#f07ac0", "#e3ecf2", "#5aa9ff", "#c9e265"];
  const PEAUX = ["#f6d7bd", "#f0c9a4", "#e2b08a", "#c98d66", "#a8714e", "#7a4e33"];
  const YEUX = [{ id: "ronds", nom: "Ronds" }, { id: "rieurs", nom: "Rieurs" }, { id: "clin", nom: "Clin d'œil" }, { id: "lunettes", nom: "Lunettes" }];
  // anciens avatars (une figurine = une couleur et une peau fixes)
  const ANCIENS = { aventuriere: [0, 2], pilote: [1, 2], ninja: [2, 2], sorcier: [3, 1], elfe: [4, 0], pirate: [5, 3], robot: [6, 0], astronaute: [7, 4] };

  // un œil : rond (avec reflet), rieur (arc vers le haut), fermé (arc vers le bas), verre de lunettes
  function eye1(x, y, k) {
    if (k === "rieur") return `<path d="M${x - 3.4} ${y + 1.4} q3.4 -5.6 6.8 0" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
    if (k === "ferme") return `<path d="M${x - 3.4} ${y - 0.4} q3.4 3.6 6.8 0" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
    if (k === "verre") return `<rect x="${x - 5.6}" y="${y - 4.2}" width="11.2" height="8.4" rx="3.4" fill="${INK}"/><path d="M${x - 3.4} ${y - 1.8} l2.6 -1" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity=".75"/>`;
    return `<ellipse cx="${x}" cy="${y}" rx="3.2" ry="3.9" fill="${INK}"/><circle cx="${x + 1}" cy="${y - 1.4}" r="1" fill="#fff"/>`;
  }
  function eyes(y, dx, e) {
    dx = dx || 8;
    const l = 32 - dx, r = 32 + dx;
    if (e === 1) return eye1(l, y, "rieur") + eye1(r, y, "rieur");
    if (e === 2) return eye1(l, y, "rond") + eye1(r, y, "ferme");
    if (e === 3) return eye1(l, y, "verre") + eye1(r, y, "verre") + `<path d="M${l + 5.6} ${y - 1.5} H${r - 5.6}" stroke="${INK}" stroke-width="2"/>`;
    return eye1(l, y, "rond") + eye1(r, y, "rond");
  }
  const body = (fill, extra) => `<path d="M19 64 V54 q0-7 7-7 h12 q7 0 7 7 V64 Z" fill="${fill}"/>${extra || ""}`;
  const head = (skin) => `<rect x="11" y="10" width="42" height="38" rx="13" fill="${skin}"/>`;
  const blush = `<ellipse cx="20" cy="37" rx="3" ry="1.6" fill="#ff8f8f" opacity=".35"/><ellipse cx="44" cy="37" rx="3" ry="1.6" fill="#ff8f8f" opacity=".35"/>`;

  // DRAW[tenue](couleur, peau, yeux)
  const DRAW = {
    // aventurière au chapeau à larges bords
    aventuriere: (c, s, e) => body("#6b4a2f", `<path d="M26 47 l6 8 l6-8 Z" fill="${c}"/>`) + `<path d="M12 22 q-2 18 4 24 h4 V22 Z M52 22 q2 18 -4 24 h-4 V22 Z" fill="#5a3a22"/>`
      + head(s) + `<path d="M11 24 q21 -8 42 0 v-4 H11 Z" fill="#5a3a22"/>`
      + `<ellipse cx="32" cy="17" rx="29" ry="5.5" fill="#7a5233"/><path d="M18 17 q1-13 14-13 q13 0 14 13 Z" fill="#8d6040"/><rect x="18" y="12.5" width="28" height="4" fill="${c}"/>`
      + eyes(31, 8, e) + blush,
    // pilote de course, casque intégral visière relevée
    pilote: (c, s, e) => body("#2a3442", `<rect x="29" y="49" width="6" height="15" fill="${c}"/>`) + `<rect x="7" y="6" width="50" height="44" rx="17" fill="${c}"/>`
      + `<rect x="30" y="6" width="4" height="12" fill="#fff" opacity=".85"/><rect x="14" y="20" width="36" height="24" rx="9" fill="${s}"/>`
      + `<rect x="12" y="14" width="40" height="7" rx="3.5" fill="#1f2a36"/><rect x="15" y="15.5" width="20" height="2" rx="1" fill="#7fd0ff" opacity=".7"/>` + eyes(31, 7, e),
    // ninja, masque et bandeau
    ninja: (c, s, e) => body("#1f2833", `<rect x="19" y="54" width="26" height="3" fill="${c}"/>`) + `<rect x="11" y="10" width="42" height="38" rx="13" fill="#232d3a"/>`
      + `<rect x="13" y="24" width="38" height="13" rx="6" fill="${s}"/><rect x="11" y="17" width="42" height="5" fill="${c}"/>`
      + `<path d="M52 19 l9 -4 l-2 6 l3 4 l-10 -2 Z" fill="${c}"/>` + eyes(30.5, 8, e),
    // sorcier, chapeau pointu et barbe
    sorcier: (c, s, e) => body(c) + head(s) + `<path d="M14 34 q2 16 18 18 q16 -2 18 -18 q-6 6 -18 6 q-12 0 -18 -6 Z" fill="#eef1f5"/>`
      + `<ellipse cx="32" cy="16" rx="27" ry="5" fill="${c}"/><path d="M15 16 L33 -6 L49 16 Z" fill="${c}"/><path d="M37 4 l1.4 2.9 l3.2 .4 l-2.3 2.2 l.6 3.1 l-2.9 -1.5 l-2.9 1.5 l.6 -3.1 l-2.3 -2.2 l3.2 -.4 Z" fill="#ffd36b"/>`
      + eyes(28, 8, e) + (e === 3 ? "" : `<path d="M23 23 h6 M35 23 h6" stroke="#eef1f5" stroke-width="2.5" stroke-linecap="round"/>`),
    // archère elfe, capuche et oreilles pointues
    elfe: (c, s, e) => body(c, `<path d="M19 56 L45 50" stroke="#7a5233" stroke-width="2"/>`) + `<path d="M8 30 l6 -6 l1 12 Z M56 30 l-6 -6 l-1 12 Z" fill="${s}"/>`
      + head(s) + `<path d="M13 22 q19 -10 38 0 l-4 6 q-15 -6 -30 0 Z" fill="#f2d16b"/>`
      + `<path d="M8 28 q0 -24 24 -24 q24 0 24 24 l-5 -4 q-1 -14 -19 -14 q-18 0 -19 14 Z" fill="${c}"/>` + eyes(32, 8, e) + blush,
    // pirate, bandana, cache-œil et anneau (l'œil visible suit le style choisi)
    pirate: (c, s, e) => body("#f2efe9", `<path d="M19 56 h26 M19 61 h26" stroke="#c94b4b" stroke-width="2.5"/>`) + head(s)
      + `<path d="M10 22 q22 -18 44 0 l0 2 H10 Z" fill="${c}"/><circle cx="18" cy="15" r="1.5" fill="#fff"/><circle cx="27" cy="12" r="1.5" fill="#fff"/><circle cx="40" cy="13" r="1.5" fill="#fff"/>`
      + `<path d="M53 20 l7 3 l-5 4 Z" fill="${c}"/><path d="M12 25 L52 36" stroke="${INK}" stroke-width="1.6"/>`
      + eye1(24, 31, ["rond", "rieur", "rond", "verre"][e] || "rond") + `<rect x="34" y="26" width="10" height="9" rx="4" fill="${INK}"/>`
      + `<circle cx="12" cy="40" r="2.6" fill="none" stroke="#ffd36b" stroke-width="1.6"/>`,
    // robot, tête métallique et antenne (pas de peau ; les yeux sont des voyants)
    robot: (c, s, e) => {
      const led = (x, k) => k === "arc" ? `<path d="M${x} 31 q4 -6 8 0" stroke="${c}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`
        : k === "trait" ? `<rect x="${x}" y="28.5" width="8" height="2.6" rx="1.3" fill="${c}"/>` : `<rect x="${x}" y="26" width="8" height="6" rx="2" fill="${c}"/>`;
      const ey = e === 1 ? led(20, "arc") + led(36, "arc") : e === 2 ? led(20, "carre") + led(36, "trait") : e === 3 ? `<rect x="18" y="25" width="28" height="8" rx="3" fill="${c}"/>` : led(20, "carre") + led(36, "carre");
      return body("#9aa7b6", `<rect x="26" y="52" width="12" height="7" rx="2" fill="${c}"/><circle cx="29" cy="55.5" r="1.2" fill="#fff"/><circle cx="35" cy="55.5" r="1.2" fill="#fff"/>`)
        + `<path d="M32 10 V3" stroke="#9aa7b6" stroke-width="2.5"/><circle cx="32" cy="3" r="3.2" fill="${c}"/>`
        + `<rect x="11" y="10" width="42" height="38" rx="9" fill="#cdd6e1"/><rect x="15" y="20" width="34" height="18" rx="6" fill="#2a3442"/>` + ey
        + `<rect x="6" y="24" width="5" height="10" rx="2" fill="#9aa7b6"/><rect x="53" y="24" width="5" height="10" rx="2" fill="#9aa7b6"/><path d="M22 43 h20" stroke="#9aa7b6" stroke-width="2" stroke-dasharray="2 2"/>`;
    },
    // astronaute, casque bulle
    astronaute: (c, s, e) => body("#eef2f6", `<rect x="27" y="51" width="10" height="7" rx="2" fill="${c}" opacity=".9"/>`) + head(s)
      + `<path d="M13 22 q19 -12 38 0 v-4 q-19 -10 -38 0 Z" fill="#2b1d16"/>` + eyes(31, 8, e) + blush
      + `<circle cx="32" cy="29" r="27" fill="${c}" opacity=".16" stroke="#eef2f6" stroke-width="3"/><path d="M14 18 q6 -9 16 -11" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".8"/>`,
  };

  const TIDX = {};
  TENUES.forEach((t, i) => (TIDX[t.id] = i));
  const inRange = (n, arr) => Number.isInteger(n) && n >= 0 && n < arr.length;

  // "ninja.2.1.0" (ou ancien "ninja") → { t, c, s, e } ; null si invalide
  function parse(spec) {
    if (typeof spec !== "string" || spec.length > 24) return null;
    if (ANCIENS[spec]) return { t: spec, c: ANCIENS[spec][0], s: ANCIENS[spec][1], e: 0 };
    const m = /^([a-z]+)\.(\d{1,2})\.(\d)\.(\d)$/.exec(spec);
    if (!m || !(m[1] in TIDX)) return null;
    const o = { t: m[1], c: +m[2], s: +m[3], e: +m[4] };
    return inRange(o.c, COULEURS) && inRange(o.s, PEAUX) && inRange(o.e, YEUX) ? o : null;
  }
  const format = (o) => o.t + "." + o.c + "." + o.s + "." + o.e;
  const pick = (n) => (Math.random() * n) | 0;
  const random = () => format({ t: TENUES[pick(TENUES.length)].id, c: pick(COULEURS.length), s: pick(PEAUX.length), e: Math.random() < 0.55 ? 0 : 1 + pick(YEUX.length - 1) });
  const ok = (spec) => !!parse(spec);
  const color = (spec) => { const o = parse(spec); return o ? COULEURS[o.c] : null; };

  function svg(spec) {
    const o = parse(spec);
    if (!o) return "";
    return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${DRAW[o.t](COULEURS[o.c], PEAUX[o.s], o.e)}</svg>`;
  }

  root.AVATAR = { TENUES, COULEURS, PEAUX, YEUX, parse, format, random, svg, color, ok };
  root.avatarSVG = svg;
})(typeof window !== "undefined" ? window : globalThis);
