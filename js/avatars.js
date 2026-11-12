/* Avatars des joueurs : petites figurines originales façon « figurine pop » (grosse tête carrée, yeux ronds,
 * pas de bouche), chacune sur un archétype du jeu vidéo, sans reprendre de personnage existant.
 * Chaque avatar porte la couleur du joueur (repères et traits sur la carte).
 * AVATARS[id] = { nom, couleur } ; avatarSVG(id) renvoie le dessin (viewBox 0 0 64 64).
 */
(function (root) {
  "use strict";
  const INK = "#14181f";
  const eyes = (y, dx) => `<ellipse cx="${32 - (dx || 8)}" cy="${y}" rx="3.2" ry="3.9" fill="${INK}"/><ellipse cx="${32 + (dx || 8)}" cy="${y}" rx="3.2" ry="3.9" fill="${INK}"/>`
    + `<circle cx="${32 - (dx || 8) + 1}" cy="${y - 1.4}" r="1" fill="#fff"/><circle cx="${32 + (dx || 8) + 1}" cy="${y - 1.4}" r="1" fill="#fff"/>`;
  const body = (fill, extra) => `<path d="M19 64 V54 q0-7 7-7 h12 q7 0 7 7 V64 Z" fill="${fill}"/>${extra || ""}`;
  const head = (skin) => `<rect x="11" y="10" width="42" height="38" rx="13" fill="${skin}"/>`;
  const blush = `<ellipse cx="20" cy="37" rx="3" ry="1.6" fill="#ff8f8f" opacity=".35"/><ellipse cx="44" cy="37" rx="3" ry="1.6" fill="#ff8f8f" opacity=".35"/>`;

  const DRAW = {
    // aventurière au chapeau à larges bords
    aventuriere: (c) => body("#6b4a2f", `<path d="M26 47 l6 8 l6-8 Z" fill="${c}"/>`) + `<path d="M12 22 q-2 18 4 24 h4 V22 Z M52 22 q2 18 -4 24 h-4 V22 Z" fill="#5a3a22"/>`
      + head("#e8b48a") + `<path d="M11 24 q21 -8 42 0 v-4 H11 Z" fill="#5a3a22"/>`
      + `<ellipse cx="32" cy="17" rx="29" ry="5.5" fill="#7a5233"/><path d="M18 17 q1-13 14-13 q13 0 14 13 Z" fill="#8d6040"/><rect x="18" y="12.5" width="28" height="4" fill="${c}"/>`
      + eyes(31) + blush,
    // pilote de course, casque intégral visière relevée
    pilote: (c) => body("#2a3442", `<rect x="29" y="49" width="6" height="15" fill="${c}"/>`) + `<rect x="7" y="6" width="50" height="44" rx="17" fill="${c}"/>`
      + `<rect x="30" y="6" width="4" height="12" fill="#fff" opacity=".85"/><rect x="14" y="20" width="36" height="24" rx="9" fill="#d9a07a"/>`
      + `<rect x="12" y="14" width="40" height="7" rx="3.5" fill="#1f2a36"/><rect x="15" y="15.5" width="20" height="2" rx="1" fill="#7fd0ff" opacity=".7"/>` + eyes(31, 7),
    // ninja, masque et bandeau
    ninja: (c) => body("#1f2833", `<rect x="19" y="54" width="26" height="3" fill="${c}"/>`) + `<rect x="11" y="10" width="42" height="38" rx="13" fill="#232d3a"/>`
      + `<rect x="13" y="24" width="38" height="13" rx="6" fill="#e2b08a"/><rect x="11" y="17" width="42" height="5" fill="${c}"/>`
      + `<path d="M52 19 l9 -4 l-2 6 l3 4 l-10 -2 Z" fill="${c}"/>` + eyes(30.5),
    // sorcier, chapeau pointu et barbe
    sorcier: (c) => body(c) + head("#f0c9a4") + `<path d="M14 34 q2 16 18 18 q16 -2 18 -18 q-6 6 -18 6 q-12 0 -18 -6 Z" fill="#eef1f5"/>`
      + `<ellipse cx="32" cy="16" rx="27" ry="5" fill="${c}"/><path d="M15 16 L33 -6 L49 16 Z" fill="${c}"/><path d="M37 4 l1.4 2.9 l3.2 .4 l-2.3 2.2 l.6 3.1 l-2.9 -1.5 l-2.9 1.5 l.6 -3.1 l-2.3 -2.2 l3.2 -.4 Z" fill="#ffd36b"/>`
      + eyes(28) + `<path d="M23 23 h6 M35 23 h6" stroke="#eef1f5" stroke-width="2.5" stroke-linecap="round"/>`,
    // archère elfe, capuche et oreilles pointues
    elfe: (c) => body(c, `<path d="M19 56 L45 50" stroke="#7a5233" stroke-width="2"/>`) + `<path d="M8 30 l6 -6 l1 12 Z M56 30 l-6 -6 l-1 12 Z" fill="#f3d2b3"/>`
      + head("#f3d2b3") + `<path d="M13 22 q19 -10 38 0 l-4 6 q-15 -6 -30 0 Z" fill="#f2d16b"/>`
      + `<path d="M8 28 q0 -24 24 -24 q24 0 24 24 l-5 -4 q-1 -14 -19 -14 q-18 0 -19 14 Z" fill="${c}"/>` + eyes(32) + blush,
    // pirate, bandana, cache-œil et anneau
    pirate: (c) => body("#f2efe9", `<path d="M19 56 h26 M19 61 h26" stroke="#c94b4b" stroke-width="2.5"/>`) + head("#c98d66")
      + `<path d="M10 22 q22 -18 44 0 l0 2 H10 Z" fill="${c}"/><circle cx="18" cy="15" r="1.5" fill="#fff"/><circle cx="27" cy="12" r="1.5" fill="#fff"/><circle cx="40" cy="13" r="1.5" fill="#fff"/>`
      + `<path d="M53 20 l7 3 l-5 4 Z" fill="${c}"/><path d="M12 25 L52 36" stroke="${INK}" stroke-width="1.6"/>`
      + `<ellipse cx="24" cy="31" rx="3.2" ry="3.9" fill="${INK}"/><circle cx="25" cy="29.6" r="1" fill="#fff"/><rect x="34" y="26" width="10" height="9" rx="4" fill="${INK}"/>`
      + `<circle cx="12" cy="40" r="2.6" fill="none" stroke="#ffd36b" stroke-width="1.6"/>`,
    // robot, tête métallique et antenne
    robot: (c) => body("#9aa7b6", `<rect x="26" y="52" width="12" height="7" rx="2" fill="${c}"/><circle cx="29" cy="55.5" r="1.2" fill="#fff"/><circle cx="35" cy="55.5" r="1.2" fill="#fff"/>`)
      + `<path d="M32 10 V3" stroke="#9aa7b6" stroke-width="2.5"/><circle cx="32" cy="3" r="3.2" fill="${c}"/>`
      + `<rect x="11" y="10" width="42" height="38" rx="9" fill="#cdd6e1"/><rect x="15" y="20" width="34" height="18" rx="6" fill="#2a3442"/>`
      + `<rect x="20" y="26" width="8" height="6" rx="2" fill="${c}"/><rect x="36" y="26" width="8" height="6" rx="2" fill="${c}"/>`
      + `<rect x="6" y="24" width="5" height="10" rx="2" fill="#9aa7b6"/><rect x="53" y="24" width="5" height="10" rx="2" fill="#9aa7b6"/><path d="M22 43 h20" stroke="#9aa7b6" stroke-width="2" stroke-dasharray="2 2"/>`,
    // astronaute, casque bulle
    astronaute: (c) => body("#eef2f6", `<rect x="27" y="51" width="10" height="7" rx="2" fill="${c}" opacity=".9"/>`) + head("#a8714e")
      + `<path d="M13 22 q19 -12 38 0 v-4 q-19 -10 -38 0 Z" fill="#2b1d16"/>` + eyes(31) + blush
      + `<circle cx="32" cy="29" r="27" fill="#bfe7ff" opacity=".22" stroke="#eef2f6" stroke-width="3"/><path d="M14 18 q6 -9 16 -11" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".8"/>`,
  };

  const AVATARS = {
    aventuriere: { nom: "L'aventurière", couleur: "#f4b740" },
    pilote: { nom: "La pilote", couleur: "#ff7b72" },
    ninja: { nom: "Le ninja", couleur: "#4cc9c0" },
    sorcier: { nom: "Le sorcier", couleur: "#9d8cff" },
    elfe: { nom: "L'archère elfe", couleur: "#6fd69b" },
    pirate: { nom: "La pirate", couleur: "#ff9f5a" },
    robot: { nom: "Le robot", couleur: "#f07ac0" },
    astronaute: { nom: "L'astronaute", couleur: "#e3ecf2" },
  };

  function avatarSVG(id) {
    const a = AVATARS[id];
    if (!a) return "";
    return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${DRAW[id](a.couleur)}</svg>`;
  }

  root.AVATARS = AVATARS;
  root.avatarSVG = avatarSVG;
})(typeof window !== "undefined" ? window : globalThis);
