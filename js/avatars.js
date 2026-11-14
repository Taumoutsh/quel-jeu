/* Avatars des joueurs : petites figurines originales façon « figurine pop » (grosse tête carrée, yeux ronds),
 * chacune sur un archétype du jeu vidéo, sans reprendre de personnage existant.
 * Un avatar se compose de : tenue (archétype), couleur (celle du joueur : repères et traits sur la carte), peau, yeux,
 * puis bouche, sourcils, accessoire, cheveux et fond.
 * Il s'écrit "tenue.couleur.peau.yeux" ou "tenue.couleur.peau.yeux.bouche.sourcils.accessoire.cheveux.fond"
 * (indices dans les listes ci-dessous), ex. "ninja.2.1.0" ou "viking.4.2.1.2.1.5.4.3".
 * Sans les cinq derniers champs (anciens avatars), ils valent 0 : pas de bouche, de sourcils ni d'accessoire,
 * cheveux d'origine, pas de fond. Les anciens identifiants seuls ("ninja"…) restent acceptés.
 * window.AVATAR = { TENUES, COULEURS, PEAUX, YEUX, BOUCHES, SOURCILS, ACCESSOIRES, CHEVEUX, FONDS, parse, format, random, svg, color, ok, uses } ;
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
    { id: "chevaliere", nom: "Chevalière" },
    { id: "gameuse", nom: "Gameuse" },
    { id: "viking", nom: "Viking" },
    { id: "chat", nom: "Capuche de chat" },
    { id: "samourai", nom: "Samouraï" },
    { id: "chef", nom: "Cheffe cuisinière" },
  ];
  const COULEURS = ["#f4b740", "#ff7b72", "#4cc9c0", "#9d8cff", "#6fd69b", "#ff9f5a", "#f07ac0", "#e3ecf2", "#5aa9ff", "#c9e265"];
  // peaux humaines, puis fantaisie (orque, elfe des glaces, fée)
  const PEAUX = ["#f6d7bd", "#f0c9a4", "#e2b08a", "#c98d66", "#a8714e", "#7a4e33", "#9fd49a", "#a9c9f5", "#cdb8f0"];
  const YEUX = [
    { id: "ronds", nom: "Ronds" }, { id: "rieurs", nom: "Rieurs" }, { id: "clin", nom: "Clin d'œil" }, { id: "lunettes", nom: "Lunettes" },
    { id: "grands", nom: "Grands yeux" }, { id: "endormis", nom: "Endormis" }, { id: "etoiles", nom: "Étoiles" }, { id: "coeurs", nom: "Cœurs" },
    { id: "soleil", nom: "Lunettes de soleil" }, { id: "points", nom: "Petits points" },
  ];
  const BOUCHES = [
    { id: "aucune", nom: "Aucune" }, { id: "sourire", nom: "Sourire" }, { id: "rire", nom: "Grand sourire" }, { id: "coin", nom: "Sourire en coin" },
    { id: "o", nom: "Étonnée" }, { id: "langue", nom: "Langue tirée" }, { id: "neutre", nom: "Neutre" }, { id: "triste", nom: "Triste" },
    { id: "crocs", nom: "Crocs" }, { id: "chat", nom: "Bouche de chat" },
  ];
  const SOURCILS = [
    { id: "aucun", nom: "Aucun" }, { id: "doux", nom: "Doux" }, { id: "froncés", nom: "Froncés" }, { id: "hausses", nom: "Haussés" },
    { id: "tristes", nom: "Inquiets" }, { id: "epais", nom: "Épais" },
  ];
  const ACCESSOIRES = [
    { id: "aucun", nom: "Aucun" }, { id: "rousseur", nom: "Taches de rousseur" }, { id: "pansement", nom: "Pansement" }, { id: "cicatrice", nom: "Cicatrice" },
    { id: "moustache", nom: "Moustache" }, { id: "barbe", nom: "Barbe" }, { id: "boucles", nom: "Boucles d'oreilles" }, { id: "etoile", nom: "Étoile sur la joue" },
    { id: "noeud", nom: "Nœud papillon" }, { id: "echarpe", nom: "Écharpe" }, { id: "peinture", nom: "Peinture de guerre" },
  ];
  // 0 = cheveux d'origine de la tenue ; sert aussi aux sourcils, à la moustache et à la barbe
  const CHEVEUX = [
    { c: null, nom: "D'origine" }, { c: "#2b2622", nom: "Noirs" }, { c: "#5a3a22", nom: "Bruns" }, { c: "#8a5a35", nom: "Châtains" },
    { c: "#c4622d", nom: "Roux" }, { c: "#e8c46a", nom: "Blonds" }, { c: "#e9edf2", nom: "Blancs" }, { c: "#f07ac0", nom: "Roses" },
    { c: "#5aa9ff", nom: "Bleus" }, { c: "#6fd69b", nom: "Verts" }, { c: "#9d6cff", nom: "Violets" },
  ];
  const FONDS = [
    { id: "aucun", nom: "Aucun" }, { id: "uni", nom: "Uni" }, { id: "degrade", nom: "Dégradé" }, { id: "pois", nom: "Pois" },
    { id: "rayures", nom: "Rayures" }, { id: "etoiles", nom: "Étoiles" }, { id: "rayons", nom: "Rayons" },
  ];
  // anciens avatars (une figurine = une couleur et une peau fixes)
  const ANCIENS = { aventuriere: [0, 2], pilote: [1, 2], ninja: [2, 2], sorcier: [3, 1], elfe: [4, 0], pirate: [5, 3], robot: [6, 0], astronaute: [7, 4] };

  // ---- visage
  const star = (x, y, r, fill, extra) => {
    let d = "";
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
      d += (i ? "L" : "M") + (x + rr * Math.cos(a)).toFixed(2) + " " + (y + rr * Math.sin(a)).toFixed(2);
    }
    return `<path d="${d}Z" fill="${fill}"${extra || ""}/>`;
  };
  const heart = (x, y, s, fill, extra) =>
    `<path d="M${x} ${y + 3.6 * s} C${x - 6 * s} ${y - 0.6 * s} ${x - 3.6 * s} ${y - 4.6 * s} ${x} ${y - 1.8 * s} C${x + 3.6 * s} ${y - 4.6 * s} ${x + 6 * s} ${y - 0.6 * s} ${x} ${y + 3.6 * s} Z" fill="${fill}"${extra || ""}/>`;

  // un œil : rond (avec reflet), rieur, fermé, verre de lunettes, grand, étoile, cœur, point
  function eye1(x, y, k) {
    if (k === "rieur") return `<path d="M${x - 3.4} ${y + 1.4} q3.4 -5.6 6.8 0" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
    if (k === "ferme") return `<path d="M${x - 3.4} ${y - 0.4} q3.4 3.6 6.8 0" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
    if (k === "verre") return `<rect x="${x - 5.6}" y="${y - 4.2}" width="11.2" height="8.4" rx="3.4" fill="${INK}"/><path d="M${x - 3.4} ${y - 1.8} l2.6 -1" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity=".75"/>`;
    if (k === "grand") return `<ellipse cx="${x}" cy="${y}" rx="4" ry="4.8" fill="${INK}"/><circle cx="${x + 1.3}" cy="${y - 1.7}" r="1.5" fill="#fff"/><circle cx="${x - 1.4}" cy="${y + 1.8}" r=".7" fill="#fff"/>`;
    if (k === "etoile") return star(x, y, 4.6, "#ffd36b", ` stroke="${INK}" stroke-width="1" stroke-linejoin="round"`);
    if (k === "coeur") return heart(x, y, 1.05, "#ff5d7a", ` stroke="${INK}" stroke-width="1"`);
    if (k === "point") return `<circle cx="${x}" cy="${y}" r="1.9" fill="${INK}"/>`;
    return `<ellipse cx="${x}" cy="${y}" rx="3.2" ry="3.9" fill="${INK}"/><circle cx="${x + 1}" cy="${y - 1.4}" r="1" fill="#fff"/>`;
  }
  const EYE_KIND = ["rond", "rieur", "rond", "verre", "grand", "ferme", "etoile", "coeur", "verre", "point"];
  function eyes(y, dx, e) {
    dx = dx || 8;
    const l = 32 - dx, r = 32 + dx;
    if (e === 2) return eye1(l, y, "rond") + eye1(r, y, "ferme");
    if (e === 3) return eye1(l, y, "verre") + eye1(r, y, "verre") + `<path d="M${l + 5.6} ${y - 1.5} H${r - 5.6}" stroke="${INK}" stroke-width="2"/>`;
    if (e === 8) // lunettes de soleil : une seule barre sombre, verres en amande, reflet
      return `<path d="M${l - 7} ${y - 4} H${r + 7} v1.6 q-1 6.2 -6.6 6.2 q-4.6 0 -5.6 -4.4 q-.8 -1.6 -2.8 -1.6 q-2 0 -2.8 1.6 q-1 4.4 -5.6 4.4 q-5.6 0 -6.6 -6.2 Z" fill="#11161d"/>`
        + `<path d="M${l - 3.6} ${y - 1.6} l3 -.9 M${r - 1.6} ${y - 1.6} l3 -.9" stroke="#7fd0ff" stroke-width="1.4" stroke-linecap="round" opacity=".7"/>`;
    const k = EYE_KIND[e] || "rond";
    return eye1(l, y, k) + eye1(r, y, k);
  }
  // sourcils, au-dessus des deux yeux
  function brows(y, dx, br, col, w) {
    if (!br) return "";
    dx = dx || 8;
    const l = 32 - dx, r = 32 + dx, b = y - 6.8, sw = (w || 1) * (br === 5 ? 3.2 : 2), st = `stroke="${col}" stroke-width="${sw}" fill="none" stroke-linecap="round"`;
    if (br === 1) return `<path d="M${l - 3.6} ${b + 0.8} q3.6 -2.4 7.2 0 M${r - 3.6} ${b + 0.8} q3.6 -2.4 7.2 0" ${st}/>`;
    if (br === 2) return `<path d="M${l - 3.8} ${b - 1} L${l + 3.4} ${b + 1.8} M${r + 3.8} ${b - 1} L${r - 3.4} ${b + 1.8}" ${st}/>`;
    if (br === 3) return `<path d="M${l - 3.6} ${b - 0.6} q3.6 -3.6 7.2 0 M${r - 3.6} ${b - 0.6} q3.6 -3.6 7.2 0" ${st}/>`;
    if (br === 4) return `<path d="M${l - 3.8} ${b + 1.6} L${l + 3.4} ${b - 1} M${r + 3.8} ${b + 1.6} L${r - 3.4} ${b - 1}" ${st}/>`;
    return `<path d="M${l - 3.8} ${b} h7.2 M${r - 3.6} ${b} h7.2" ${st}/>`;
  }
  // bouche, centrée en (32, y) ; ink : couleur du trait (voyants du robot)
  function mouth(y, b, ink) {
    ink = ink || INK;
    const st = `stroke="${ink}" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
    switch (b) {
      case 1: return `<path d="M28 ${y} q4 3.8 8 0" ${st}/>`;
      case 2: return `<path d="M27 ${y - 1} h10 q0 6.4 -5 6.4 q-5 0 -5 -6.4 Z" fill="${ink}"/><path d="M28.2 ${y - 0.6} h7.6 v1.5 h-7.6 Z" fill="#fff"/><ellipse cx="32" cy="${y + 3.6}" rx="2.4" ry="1.3" fill="#ff7d8f"/>`;
      case 3: return `<path d="M28.6 ${y + 0.8} q4 1.8 7.4 -2.2" ${st}/>`;
      case 4: return `<ellipse cx="32" cy="${y + 0.8}" rx="2.3" ry="2.9" fill="${ink}"/>`;
      case 5: return `<path d="M28 ${y} q4 3.4 8 0" ${st}/><path d="M31.4 ${y + 1.6} h4.2 v2.4 q0 2.4 -2.1 2.4 q-2.1 0 -2.1 -2.4 Z" fill="#ff7d8f" stroke="${ink}" stroke-width="1.1"/>`;
      case 6: return `<path d="M29 ${y + 1} h6" ${st}/>`;
      case 7: return `<path d="M28.6 ${y + 2.4} q3.4 -3.2 6.8 0" ${st}/>`;
      case 8: return `<path d="M27.6 ${y} q4.4 3.8 8.8 0" ${st}/><path d="M29.2 ${y + 1.5} l1 2.8 l1.1 -2.4 Z M34.8 ${y + 1.5} l-1 2.8 l-1.1 -2.4 Z" fill="#fff" stroke="${ink}" stroke-width=".7" stroke-linejoin="round"/>`;
      case 9: return `<path d="M28 ${y} q2 2.6 4 0 q2 2.6 4 0" ${st}/>`;
      default: return "";
    }
  }
  // accessoires du visage et du cou ; under : barbe (avant la bouche) ; over : le reste
  function accessory(a, y, my, c, hair, skipChin) {
    const r = { under: "", over: "" };
    switch (a) {
      case 1: r.over = [[19, 36], [22.4, 37.6], [20.2, 39.4], [45, 36], [41.6, 37.6], [43.8, 39.4]].map(([x, yy]) => `<circle cx="${x}" cy="${yy + y - 31}" r=".95" fill="#a8603d" opacity=".75"/>`).join(""); break;
      case 2: r.over = `<g transform="rotate(-24 44 ${y + 7})"><rect x="39" y="${y + 5.2}" width="10" height="4" rx="1.6" fill="#f2d2a2" stroke="${INK}" stroke-width=".7"/><circle cx="42.6" cy="${y + 7.2}" r=".55" fill="#c79c66"/><circle cx="45.4" cy="${y + 7.2}" r=".55" fill="#c79c66"/></g>`; break;
      case 3: r.over = `<path d="M20.5 ${y - 8} L25.5 ${y + 6}" stroke="#b14d4d" stroke-width="1.6" stroke-linecap="round"/><path d="M20.4 ${y - 4.2} l3.6 -1.2 M21.6 ${y - 0.6} l3.6 -1.2 M22.8 ${y + 3} l3.6 -1.2" stroke="#b14d4d" stroke-width="1.1" stroke-linecap="round"/>`; break;
      case 4: if (!skipChin) r.over = `<path d="M32 ${my - 2.6} q-3 -2 -7.6 0.4 q-1.6 1 -2.8 0 q1.4 3.4 5.4 2.6 q3.4 -0.6 5 -2 q1.6 1.4 5 2 q4 0.8 5.4 -2.6 q-1.2 1 -2.8 0 q-4.6 -2.4 -7.6 -0.4 Z" fill="${hair}"/>`; break;
      case 5: if (!skipChin) r.under = `<path d="M13 ${my - 4} q1.6 14.6 19 14.6 q17.4 0 19 -14.6 q-3 4.8 -8 4.8 q-3.6 -3.4 -11 -3.4 q-7.4 0 -11 3.4 q-5 0 -8 -4.8 Z" fill="${hair}"/>`; break;
      case 6: r.over = `<circle cx="11.6" cy="${y + 10}" r="2.3" fill="none" stroke="#ffd36b" stroke-width="1.6"/><circle cx="52.4" cy="${y + 10}" r="2.3" fill="none" stroke="#ffd36b" stroke-width="1.6"/>`; break;
      case 7: r.over = star(44.6, y + 6.6, 3, c, ` stroke="${INK}" stroke-width=".7" stroke-linejoin="round"`); break;
      case 8: r.over = `<path d="M32 51.5 l-6.4 -3.6 v7.2 Z M32 51.5 l6.4 -3.6 v7.2 Z" fill="${c}" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/><circle cx="32" cy="51.5" r="1.8" fill="${c}" stroke="${INK}" stroke-width="1"/>`; break;
      case 9: r.over = `<path d="M17 47 q15 6 30 0 v5 q-15 6 -30 0 Z" fill="${c}" stroke="${INK}" stroke-width=".8"/><path d="M40 51 l2 12 h5 l-2.6 -12 Z" fill="${c}" stroke="${INK}" stroke-width=".8"/><path d="M42.4 60 h4.6" stroke="${INK}" stroke-width=".8"/>`; break;
      case 10: r.over = `<path d="M17 ${y + 4.5} l7 1 M17.6 ${y + 7.4} l6.4 .9 M47 ${y + 4.5} l-7 1 M46.4 ${y + 7.4} l-6.4 .9" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/>`; break;
    }
    return r;
  }
  const body = (fill, extra) => `<path d="M19 64 V54 q0-7 7-7 h12 q7 0 7 7 V64 Z" fill="${fill}"/>${extra || ""}`;
  const head = (skin) => `<rect x="11" y="10" width="42" height="38" rx="13" fill="${skin}"/>`;
  // cils, au coin extérieur des yeux (pas sur les lunettes)
  const lashes = (y, dx, e) => e === 3 || e === 8 ? "" : `<path d="M${32 - (dx || 8) - 3} ${y - 1} l-2.6 -0.7 M${32 - (dx || 8) - 2.4} ${y - 2.6} l-2 -1.4 M${32 + (dx || 8) + 3} ${y - 1} l2.6 -0.7 M${32 + (dx || 8) + 2.4} ${y - 2.6} l2 -1.4" stroke="${INK}" stroke-width="1.3" stroke-linecap="round"/>`;
  const blush = `<ellipse cx="20" cy="37" rx="3" ry="1.6" fill="#ff8f8f" opacity=".35"/><ellipse cx="44" cy="37" rx="3" ry="1.6" fill="#ff8f8f" opacity=".35"/>`;

  // visage complet : yeux, sourcils, barbe, bouche, accessoire ; f = { y, dx, my, noMouth, noChin, browCol }
  function face(o, f, c, hair) {
    const acc = accessory(o.a, f.y, f.my, c, hair, f.noChin);
    return acc.under + eyes(f.y, f.dx, o.e) + brows(f.y, f.dx, o.br, f.browCol || hair)
      + (f.noMouth ? "" : mouth(f.my, o.b)) + acc.over;
  }
  // couleur de cheveux : choisie, sinon celle de la tenue
  const hairOf = (o, def) => (o.h && CHEVEUX[o.h] && CHEVEUX[o.h].c) || def;

  // DRAW[tenue](couleur, peau, avatar)
  const DRAW = {
    // aventurière au chapeau à larges bords
    aventuriere: (c, s, o) => { const h = hairOf(o, "#5a3a22");
      return body("#6b4a2f", `<path d="M26 47 l6 8 l6-8 Z" fill="${c}"/>`) + `<path d="M12 22 q-2 18 4 24 h4 V22 Z M52 22 q2 18 -4 24 h-4 V22 Z" fill="${h}"/>`
        + head(s) + `<path d="M11 24 q21 -8 42 0 v-4 H11 Z" fill="${h}"/>`
        + `<ellipse cx="32" cy="17" rx="29" ry="5.5" fill="#7a5233"/><path d="M18 17 q1-13 14-13 q13 0 14 13 Z" fill="#8d6040"/><rect x="18" y="12.5" width="28" height="4" fill="${c}"/>`
        + face(o, { y: 31, dx: 8, my: 40 }, c, h) + blush; },
    // pilote de course, casque intégral visière relevée
    pilote: (c, s, o) => { const h = hairOf(o, "#3a2a20");
      return body("#2a3442", `<rect x="29" y="49" width="6" height="15" fill="${c}"/>`) + `<rect x="7" y="6" width="50" height="44" rx="17" fill="${c}"/>`
        + `<rect x="30" y="6" width="4" height="12" fill="#fff" opacity=".85"/><rect x="14" y="20" width="36" height="24" rx="9" fill="${s}"/>`
        + `<rect x="12" y="14" width="40" height="7" rx="3.5" fill="#1f2a36"/><rect x="15" y="15.5" width="20" height="2" rx="1" fill="#7fd0ff" opacity=".7"/>`
        + face(Object.assign({}, o, { a: [6, 9].includes(o.a) ? 0 : o.a }), { y: 31, dx: 7, my: 39.5 }, c, h); },
    // ninja, masque et bandeau (bouche et menton cachés)
    ninja: (c, s, o) => { const h = hairOf(o, "#232d3a");
      return body("#1f2833", `<rect x="19" y="54" width="26" height="3" fill="${c}"/>`) + `<rect x="11" y="10" width="42" height="38" rx="13" fill="#232d3a"/>`
        + `<rect x="13" y="24" width="38" height="13" rx="6" fill="${s}"/><rect x="11" y="17" width="42" height="5" fill="${c}"/>`
        + `<path d="M52 19 l9 -4 l-2 6 l3 4 l-10 -2 Z" fill="${c}"/>` + face(o, { y: 30.5, dx: 8, my: 41, noMouth: true, noChin: true, browCol: o.h ? h : INK }, c, h); },
    // sorcier, chapeau pointu et barbe (blanche d'origine, ou de la couleur choisie)
    sorcier: (c, s, o) => { const h = hairOf(o, "#eef1f5");
      return body(c) + head(s) + `<path d="M14 34 q2 16 18 18 q16 -2 18 -18 q-6 6 -18 6 q-12 0 -18 -6 Z" fill="${h}"/>`
        + `<ellipse cx="32" cy="16" rx="27" ry="5" fill="${c}"/><path d="M15 16 L33 -6 L49 16 Z" fill="${c}"/>` + star(37, 8.4, 4.4, "#ffd36b")
        + face(Object.assign({}, o, { a: o.a === 5 ? 0 : o.a }), { y: 28, dx: 8, my: 36 }, c, h)
        + (o.br || o.e === 3 || o.e === 8 ? "" : `<path d="M23 23 h6 M35 23 h6" stroke="${h}" stroke-width="2.5" stroke-linecap="round"/>`); },
    // archère elfe, capuche et oreilles pointues
    elfe: (c, s, o) => { const h = hairOf(o, "#f2d16b");
      return body(c, `<path d="M19 56 L45 50" stroke="#7a5233" stroke-width="2"/>`) + `<path d="M8 30 l6 -6 l1 12 Z M56 30 l-6 -6 l-1 12 Z" fill="${s}"/>`
        + head(s) + `<path d="M13 22 q19 -10 38 0 l-4 6 q-15 -6 -30 0 Z" fill="${h}"/>`
        + `<path d="M8 28 q0 -24 24 -24 q24 0 24 24 l-5 -4 q-1 -14 -19 -14 q-18 0 -19 14 Z" fill="${c}"/>` + face(o, { y: 32, dx: 8, my: 40.5 }, c, h) + blush; },
    // pirate, bandana, cache-œil et anneau (l'œil visible suit le style choisi)
    pirate: (c, s, o) => { const h = hairOf(o, "#3a2a20"), e = o.e, acc = accessory(o.a === 6 ? 0 : o.a, 31, 40, c, h);
      return body("#f2efe9", `<path d="M19 56 h26 M19 61 h26" stroke="#c94b4b" stroke-width="2.5"/>`) + head(s)
        + `<path d="M10 22 q22 -18 44 0 l0 2 H10 Z" fill="${c}"/><circle cx="18" cy="15" r="1.5" fill="#fff"/><circle cx="27" cy="12" r="1.5" fill="#fff"/><circle cx="40" cy="13" r="1.5" fill="#fff"/>`
        + `<path d="M53 20 l7 3 l-5 4 Z" fill="${c}"/>` + acc.under + `<path d="M12 25 L52 36" stroke="${INK}" stroke-width="1.6"/>`
        + eye1(24, 31, EYE_KIND[e] || "rond") + `<rect x="34" y="26" width="10" height="9" rx="4" fill="${INK}"/>`
        + brows(31, 8, o.br, h) + mouth(40, o.b) + acc.over
        + `<circle cx="12" cy="40" r="2.6" fill="none" stroke="#ffd36b" stroke-width="1.6"/>`; },
    // robot, tête métallique et antenne (pas de peau ni de cheveux ; yeux et bouche sont des voyants)
    robot: (c, s, o) => {
      const e = o.e;
      const led = (x, k) => k === "arc" ? `<path d="M${x} 31 q4 -6 8 0" stroke="${c}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`
        : k === "trait" ? `<rect x="${x}" y="28.5" width="8" height="2.6" rx="1.3" fill="${c}"/>`
        : k === "grand" ? `<rect x="${x - 1}" y="24.5" width="10" height="9" rx="2.4" fill="${c}"/>`
        : k === "point" ? `<rect x="${x + 2}" y="27.5" width="4" height="4" rx="1" fill="${c}"/>`
        : k === "etoile" ? star(x + 4, 29, 4.6, c) : k === "coeur" ? heart(x + 4, 29, 1.05, c) : `<rect x="${x}" y="26" width="8" height="6" rx="2" fill="${c}"/>`;
      const K = ["carre", "arc", null, null, "grand", "trait", "etoile", "coeur", null, "point"][e];
      const ey = e === 2 ? led(20, "carre") + led(36, "trait") : e === 3 || e === 8 ? `<rect x="18" y="25" width="28" height="8" rx="3" fill="${c}"/>` : led(20, K || "carre") + led(36, K || "carre");
      const acc = [7, 8, 9, 10].includes(o.a) ? accessory(o.a, 31, 42, c, c) : { over: "" };
      return body("#9aa7b6", `<rect x="26" y="52" width="12" height="7" rx="2" fill="${c}"/><circle cx="29" cy="55.5" r="1.2" fill="#fff"/><circle cx="35" cy="55.5" r="1.2" fill="#fff"/>`)
        + `<path d="M32 10 V3" stroke="#9aa7b6" stroke-width="2.5"/><circle cx="32" cy="3" r="3.2" fill="${c}"/>`
        + `<rect x="11" y="10" width="42" height="38" rx="9" fill="#cdd6e1"/><rect x="15" y="20" width="34" height="18" rx="6" fill="#2a3442"/>` + ey
        + `<rect x="6" y="24" width="5" height="10" rx="2" fill="#9aa7b6"/><rect x="53" y="24" width="5" height="10" rx="2" fill="#9aa7b6"/>`
        + (o.b ? `<rect x="23" y="39.5" width="18" height="7" rx="3" fill="#2a3442"/>` + mouth(42, o.b, c) : `<path d="M22 43 h20" stroke="#9aa7b6" stroke-width="2" stroke-dasharray="2 2"/>`) + acc.over;
    },
    // astronaute, casque bulle
    astronaute: (c, s, o) => { const h = hairOf(o, "#2b1d16");
      return body("#eef2f6", `<rect x="27" y="51" width="10" height="7" rx="2" fill="${c}" opacity=".9"/>`) + head(s)
        + `<path d="M13 22 q19 -12 38 0 v-4 q-19 -10 -38 0 Z" fill="${h}"/>` + face(o, { y: 31, dx: 8, my: 40 }, c, h) + blush
        + `<circle cx="32" cy="29" r="27" fill="${c}" opacity=".16" stroke="#eef2f6" stroke-width="3"/><path d="M14 18 q6 -9 16 -11" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".8"/>`; },
    // chevalière : casque ouvert à plumet, nasal, longue tresse dans le dos
    chevaliere: (c, s, o) => {
      const hair = hairOf(o, "#8a4b2a"), steel = "#c9d2dc";
      return `<path d="M47 30 q11 9 7 27 q-1 5 -5 3 q2 -13 -6 -23 Z" fill="${hair}"/><circle cx="51.5" cy="57.5" r="2.2" fill="${c}"/>`
        + body("#b9c3cf", `<path d="M26 47 h12 v17 h-12 Z" fill="${c}"/><path d="M32 49 l3 3.5 l-3 3.5 l-3 -3.5 Z" fill="#eef1f5"/>`)
        + head(s) + `<path d="M13 27 q6 -6 12 -2 q7 -5 14 0 q6 -4 12 2 v-4 H13 Z" fill="${hair}"/>`
        + `<path d="M9 29 q0 -24 23 -24 q23 0 23 24 h-5 q-2 -13 -18 -13 q-16 0 -18 13 Z" fill="${steel}"/><path d="M9 29 h5 M50 29 h5" stroke="#9aa7b6" stroke-width="2"/>`
        + `<rect x="30.6" y="14" width="2.8" height="13" rx="1.2" fill="${steel}"/><path d="M33 6 q3 -7 13 -6 q-7 2 -9 9 Z" fill="${c}"/>`
        + face(o, { y: 31, dx: 8, my: 40 }, c, hair) + lashes(31, 8, o.e) + blush;
    },
    // gameuse : couettes, casque audio avec micro, sweat à capuche
    gameuse: (c, s, o) => {
      const hair = hairOf(o, "#5b3a8c"), gear = "#1f2a36";
      return `<circle cx="8" cy="42" r="6.5" fill="${hair}"/><circle cx="56" cy="42" r="6.5" fill="${hair}"/><circle cx="11" cy="37" r="2.2" fill="${c}"/><circle cx="53" cy="37" r="2.2" fill="${c}"/>`
        + body(c, `<path d="M29 48 v8 M35 48 v8" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/><path d="M24 47 q8 6 16 0" stroke="rgba(0,0,0,.25)" stroke-width="2" fill="none"/>`)
        + head(s) + `<path d="M11 27 q0 -19 21 -19 q21 0 21 19 q-6 -7 -12 -5 q-4 -6 -9 -1 q-5 -5 -9 1 q-6 -2 -12 5 Z" fill="${hair}"/>`
        + face(Object.assign({}, o, { a: o.a === 6 ? 0 : o.a }), { y: 31, dx: 8, my: 40 }, c, hair) + lashes(31, 8, o.e) + blush
        + `<path d="M9 30 q0 -27 23 -27 q23 0 23 27" stroke="${gear}" stroke-width="3.5" fill="none"/>`
        + `<rect x="4.5" y="25" width="8.5" height="14" rx="4" fill="${gear}"/><rect x="51" y="25" width="8.5" height="14" rx="4" fill="${gear}"/><circle cx="8.7" cy="32" r="2" fill="${c}"/><circle cx="55.3" cy="32" r="2" fill="${c}"/>`
        + `<path d="M10 38 q2 8 11 7" stroke="${gear}" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="21.5" cy="45" r="2.2" fill="${gear}"/>`;
    },
    // viking : casque à cornes, grande barbe tressée (rousse d'origine)
    viking: (c, s, o) => {
      const hair = hairOf(o, "#c4622d"), steel = "#aab6c3";
      return body("#6b4a2f", `<path d="M19 55 h26" stroke="${c}" stroke-width="3"/><circle cx="32" cy="55" r="2.6" fill="#ffd36b"/>`) + head(s)
        + `<path d="M12 34 q0 16 20 17 q20 -1 20 -17 q-4 5 -9 5 q-3.6 -3 -11 -3 q-7.4 0 -11 3 q-5 0 -9 -5 Z" fill="${hair}"/>`
        + `<path d="M24 50 v8 M40 50 v8" stroke="${hair}" stroke-width="3.4" stroke-linecap="round"/><circle cx="24" cy="58.5" r="1.8" fill="${c}"/><circle cx="40" cy="58.5" r="1.8" fill="${c}"/>`
        + `<path d="M12 18 q-9 -2 -9 -14 q4 7 12 8 Z M52 18 q9 -2 9 -14 q-4 7 -12 8 Z" fill="#f2ead8" stroke="${INK}" stroke-width=".8"/>`
        + `<path d="M10 24 q0 -18 22 -18 q22 0 22 18 Z" fill="${steel}"/><rect x="10" y="20" width="44" height="5" fill="${c}"/><circle cx="17" cy="22.5" r="1" fill="#fff"/><circle cx="47" cy="22.5" r="1" fill="#fff"/>`
        + face(Object.assign({}, o, { a: o.a === 5 ? 0 : o.a }), { y: 31, dx: 8, my: 38.4 }, c, hair);
    },
    // capuche de chat : capuche à oreilles, moustaches de chat sur les joues
    chat: (c, s, o) => { const h = hairOf(o, "#5a3a22");
      return body(c, `<path d="M29 50 v9 M35 50 v9" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>`)
        + `<path d="M7 34 q0 -30 25 -30 q25 0 25 30 v8 q-6 6 -11 6 h-28 q-5 0 -11 -6 Z" fill="${c}"/>`
        + `<path d="M10 16 L9 1 L22 9 Z M54 16 L55 1 L42 9 Z" fill="${c}"/><path d="M12 12 L11.5 5 L18 9 Z M52 12 L52.5 5 L46 9 Z" fill="#ffc4d6"/>`
        + head(s) + `<path d="M12 22 q20 -14 40 0 q-6 -3 -10 -1 q-5 -5 -10 -1 q-5 -4 -10 1 q-4 -2 -10 1 Z" fill="${h}"/>`
        + face(o, { y: 31, dx: 8, my: 39.5 }, c, h) + blush
        + `<path d="M14 37 l-6 -1 M14 39.5 l-6 1 M50 37 l6 -1 M50 39.5 l6 1" stroke="${INK}" stroke-width="1" stroke-linecap="round" opacity=".6"/>`; },
    // samouraï : casque kabuto à croissant doré, protège-nuque, armure à plaques
    samourai: (c, s, o) => { const h = hairOf(o, "#2b2622"), dark = "#2a2f3a";
      return body(dark, `<path d="M20 52 h24 M20 56.5 h24 M20 61 h24" stroke="${c}" stroke-width="2.4"/>`)
        + `<path d="M6 26 q2 14 9 20 h4 V24 Z M58 26 q-2 14 -9 20 h-4 V24 Z" fill="${dark}"/>` + head(s)
        + `<path d="M8 27 q0 -22 24 -22 q24 0 24 22 q-4 -4 -9 -4 H17 q-5 0 -9 4 Z" fill="${dark}"/><rect x="10" y="22" width="44" height="3.4" rx="1.7" fill="${c}"/>`
        + `<path d="M22 12 q-6 -12 -14 -12 q8 6 10 14 Z M42 12 q6 -12 14 -12 q-8 6 -10 14 Z" fill="#ffd36b"/><circle cx="32" cy="12" r="3.4" fill="#ffd36b"/>`
        + face(o, { y: 32, dx: 8, my: 40.5 }, c, h); },
    // cheffe cuisinière : grande toque, foulard
    chef: (c, s, o) => { const h = hairOf(o, "#8a5a35");
      return body("#f4f6f8", `<path d="M26 47 l6 6 l6 -6 Z" fill="${c}"/><circle cx="28" cy="57" r="1.3" fill="#c2cad3"/><circle cx="36" cy="57" r="1.3" fill="#c2cad3"/>`) + head(s)
        + `<path d="M11 25 q3 -8 9 -8 h24 q6 0 9 8 v-6 H11 Z" fill="${h}"/>`
        + `<path d="M15 19 q-7 -2 -7 -8 q0 -7 8 -7 q2 -4 8 -4 q4 0 8 3 q4 -3 8 -3 q6 0 8 4 q8 0 8 7 q0 6 -7 8 Z" fill="#f4f6f8" stroke="#d5dbe2" stroke-width=".8"/>`
        + `<rect x="14" y="16" width="36" height="5" rx="1.5" fill="#e8ecf0"/><rect x="14" y="16" width="36" height="1.6" fill="${c}"/>`
        + face(o, { y: 31, dx: 8, my: 40 }, c, h) + blush; },
  };

  // fond : dessiné en premier, sur tout le carré (le cadre arrondi vient de la page) ; id unique pour les dégradés
  let gid = 0;
  function background(f, c) {
    if (!f) return "";
    const id = "avg" + ++gid;
    if (f === 1) return `<rect width="64" height="64" fill="${c}" opacity=".28"/>`;
    if (f === 2) return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".75"/><stop offset="1" stop-color="${c}" stop-opacity=".08"/></linearGradient></defs><rect width="64" height="64" fill="url(#${id})"/>`;
    if (f === 3) { let d = `<rect width="64" height="64" fill="${c}" opacity=".16"/>`; for (let y = 4; y < 64; y += 10) for (let x = (y / 10) % 2 ? 9 : 4; x < 64; x += 10) d += `<circle cx="${x}" cy="${y}" r="2" fill="${c}" opacity=".45"/>`; return d; }
    if (f === 4) { let d = `<rect width="64" height="64" fill="${c}" opacity=".14"/>`; for (let x = -64; x < 64; x += 10) d += `<path d="M${x} 64 L${x + 64} 0" stroke="${c}" stroke-width="4" opacity=".35"/>`; return d; }
    if (f === 5) return `<rect width="64" height="64" fill="${c}" opacity=".14"/>` + [[8, 9, 3], [55, 12, 2.4], [6, 40, 2.2], [57, 44, 3.2], [16, 58, 2], [50, 60, 2.2], [30, 3, 1.8]].map(([x, y, r]) => star(x, y, r, c, ' opacity=".7"')).join("");
    if (f === 6) { let d = `<rect width="64" height="64" fill="${c}" opacity=".12"/>`; for (let i = 0; i < 12; i++) { const a = (i * Math.PI) / 6, b = a + Math.PI / 12; d += `<path d="M32 30 L${(32 + 60 * Math.cos(a)).toFixed(1)} ${(30 + 60 * Math.sin(a)).toFixed(1)} L${(32 + 60 * Math.cos(b)).toFixed(1)} ${(30 + 60 * Math.sin(b)).toFixed(1)} Z" fill="${c}" opacity=".22"/>`; } return d; }
    return "";
  }

  const TIDX = {};
  TENUES.forEach((t, i) => (TIDX[t.id] = i));
  const inRange = (n, arr) => Number.isInteger(n) && n >= 0 && n < arr.length;
  const EXTRA = [["b", BOUCHES], ["br", SOURCILS], ["a", ACCESSOIRES], ["h", CHEVEUX], ["f", FONDS]];

  // "ninja.2.1.0" ou "ninja.2.1.0.1.2.0.0.3" (ou ancien "ninja") → { t, c, s, e, b, br, a, h, f } ; null si invalide
  function parse(spec) {
    if (typeof spec !== "string" || spec.length > 40) return null;
    if (ANCIENS[spec]) return { t: spec, c: ANCIENS[spec][0], s: ANCIENS[spec][1], e: 0, b: 0, br: 0, a: 0, h: 0, f: 0 };
    const m = /^([a-z]+)((?:\.\d{1,2}){3}|(?:\.\d{1,2}){8})$/.exec(spec);
    if (!m || !(m[1] in TIDX)) return null;
    const n = m[2].slice(1).split(".").map(Number);
    const o = { t: m[1], c: n[0], s: n[1], e: n[2], b: n[3] | 0, br: n[4] | 0, a: n[5] | 0, h: n[6] | 0, f: n[7] | 0 };
    if (!(inRange(o.c, COULEURS) && inRange(o.s, PEAUX) && inRange(o.e, YEUX))) return null;
    return EXTRA.every(([k, arr]) => inRange(o[k], arr)) ? o : null;
  }
  // forme courte quand les cinq derniers champs valent 0 (lisible par les anciennes versions de la page)
  const format = (o) => {
    const base = o.t + "." + o.c + "." + o.s + "." + o.e;
    return EXTRA.some(([k]) => o[k]) ? base + "." + EXTRA.map(([k]) => o[k] | 0).join(".") : base;
  };
  const pick = (n) => (Math.random() * n) | 0;
  const maybe = (p, n) => (Math.random() < p ? 1 + pick(n - 1) : 0);
  function random() {
    return format({
      t: TENUES[pick(TENUES.length)].id, c: pick(COULEURS.length), s: Math.random() < 0.85 ? pick(6) : 6 + pick(PEAUX.length - 6),
      e: Math.random() < 0.45 ? 0 : 1 + pick(YEUX.length - 1), b: maybe(0.75, BOUCHES.length), br: maybe(0.5, SOURCILS.length),
      a: maybe(0.45, ACCESSOIRES.length), h: maybe(0.35, CHEVEUX.length), f: maybe(0.6, FONDS.length),
    });
  }
  const ok = (spec) => !!parse(spec);
  const color = (spec) => { const o = parse(spec); return o ? COULEURS[o.c] : null; };
  // réglages qui changent quelque chose pour une tenue (l'éditeur masque les autres)
  function uses(t) {
    if (t === "robot") return { s: false, br: false, h: false, b: true, a: true };
    if (t === "ninja") return { s: true, br: true, h: true, b: false, a: true };
    return { s: true, br: true, h: true, b: true, a: true };
  }

  function svg(spec) {
    const o = parse(spec);
    if (!o) return "";
    const c = COULEURS[o.c];
    return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${background(o.f, c)}${DRAW[o.t](c, PEAUX[o.s], o)}</svg>`;
  }

  root.AVATAR = { TENUES, COULEURS, PEAUX, YEUX, BOUCHES, SOURCILS, ACCESSOIRES, CHEVEUX, FONDS, parse, format, random, svg, color, ok, uses };
  root.avatarSVG = svg;
})(typeof window !== "undefined" ? window : globalThis);
