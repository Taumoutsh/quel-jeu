/* Pack de démonstration : jeux fictifs, cartes et panoramas 360° générés par le code.
 * Aucune image externe : tout est dessiné dans des <canvas>, à partir d'une graine.
 */
(function (root) {
  const W = 2048, H = 1024, HZ = H / 2;
  const TAU = Math.PI * 2;

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
  const lerp = (a, b, t) => a + (b - a) * t;
  function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(c1, c2, t) { const a = hex(c1), b = hex(c2); return "rgb(" + a.map((v, i) => Math.round(lerp(v, b[i], t))).join(",") + ")"; }
  function mixHex(c1, c2, t) { const a = hex(c1), b = hex(c2); return "#" + a.map((v, i) => Math.round(lerp(v, b[i], t)).toString(16).padStart(2, "0")).join(""); }

  // Crête périodique (se raccorde parfaitement à 360°)
  function ridge(r, rough) {
    const terms = [];
    let norm = 0;
    for (let k = 1; k <= 10; k++) { const a = Math.pow(k, -(rough || 1)) * (0.5 + r()); terms.push([k, a, r() * TAU]); norm += a; }
    return (u) => { let s = 0; for (const [k, a, p] of terms) s += a * Math.sin(TAU * k * u + p); return s / norm; };
  }

  // ------------------------------------------------------------------ jeux fictifs
  const GAMES = [
    { id: "demo-astral-2", t: "Chroniques d'Astral II", s: "Chroniques d'Astral", sa: ["astral"], a: ["astral 2"], style: "astral",
      map: { name: "Royaume d'Éther", bg: "#bfe3f2", sea: "#9fd0ea" },
      regions: [
        { n: "Plaines d'Azur", x: 0.28, y: 0.62, b: "prairie" },
        { n: "Gouffre de Cristal", x: 0.72, y: 0.66, b: "cristal" },
        { n: "Cimes Blanches", x: 0.32, y: 0.24, b: "neige" },
        { n: "Ruines d'Orée", x: 0.74, y: 0.28, b: "ruines" },
      ] },
    { id: "demo-astral-origines", t: "Chroniques d'Astral : Origines", s: "Chroniques d'Astral", a: ["astral origines"], style: "astralnuit",
      map: { name: "Terres d'Avant", bg: "#1c2448", sea: "#141a38" },
      regions: [
        { n: "Bois Murmurant", x: 0.22, y: 0.4, b: "foret" },
        { n: "Lac Miroir", x: 0.5, y: 0.7, b: "lac" },
        { n: "Veines d'Améthyste", x: 0.8, y: 0.62, b: "cristal" },
        { n: "Citadelle Première", x: 0.62, y: 0.22, b: "citadelle" },
      ] },
    { id: "demo-ferro-3", t: "Ferro Nexus III", s: "Ferro Nexus", a: ["ferro 3"], style: "ferro",
      map: { name: "Secteur Nexus", bg: "#3b3530", sea: "#2a3036" },
      regions: [
        { n: "Fonderie Delta", x: 0.3, y: 0.3, b: "usine" },
        { n: "Désert de Rouille", x: 0.7, y: 0.36, b: "desert" },
        { n: "Port Charbon", x: 0.24, y: 0.74, b: "port" },
        { n: "Puits 9", x: 0.74, y: 0.76, b: "mine" },
      ] },
    { id: "demo-ferro-1", t: "Ferro Nexus", s: "Ferro Nexus", a: ["ferro nexus 1"], noScenes: true },
    { id: "demo-lune-pale", t: "Lune Pâle", a: [], style: "lune",
      map: { name: "Comté de Vesper", bg: "#c9c2b0", sea: "#8a948f" },
      regions: [
        { n: "Cimetière des Saules", x: 0.7, y: 0.7, b: "cimetiere" },
        { n: "Marais de Brume", x: 0.26, y: 0.72, b: "marais" },
        { n: "Château Noctis", x: 0.66, y: 0.24, b: "chateau" },
        { n: "Hameau de Ver", x: 0.3, y: 0.3, b: "village" },
      ] },
    { id: "demo-recif", t: "Le Récif Perdu", a: ["recif perdu"], style: "recif",
      map: { name: "Archipel d'Ondine", bg: "#3fb4c9", sea: "#2a9bb8" },
      regions: [
        { n: "Plage des Naufragés", x: 0.24, y: 0.66, b: "plage" },
        { n: "Jungle Émeraude", x: 0.42, y: 0.3, b: "jungle" },
        { n: "Mont Braise", x: 0.78, y: 0.3, b: "volcan" },
        { n: "Lagon Turquoise", x: 0.72, y: 0.74, b: "lagon" },
      ] },
    { id: "demo-neon", t: "Néon Velours", a: ["neon velours"], style: "neon",
      map: { name: "Mégapole Velours", bg: "#120a1f", sea: "#0b1430" },
      regions: [
        { n: "Hyper-Centre", x: 0.5, y: 0.45, b: "centre" },
        { n: "Docks Cyan", x: 0.2, y: 0.78, b: "docks" },
        { n: "Marché Lotus", x: 0.8, y: 0.72, b: "marche" },
        { n: "Toits du Nord", x: 0.26, y: 0.22, b: "toits" },
      ] },
  ];
  const byId = Object.fromEntries(GAMES.map((g) => [g.id, g]));

  // 2 scènes par région (positions différentes)
  const SCENES = [];
  for (const g of GAMES) {
    if (g.noScenes) continue;
    g.regions.forEach((rg, ri) => {
      for (let k = 0; k < 2; k++) {
        const r = rng(hashStr(g.id + ri + "-" + k));
        const ang = r() * TAU, d = 0.03 + r() * 0.06;
        SCENES.push({
          id: "d-" + g.id.slice(5) + "-" + ri + k, game: g.id, region: ri, biome: rg.b,
          x: Math.min(0.95, Math.max(0.05, rg.x + Math.cos(ang) * d)),
          y: Math.min(0.93, Math.max(0.07, rg.y + Math.sin(ang) * d * 1.3)),
          seed: hashStr(g.id + "scene" + ri + k),
        });
      }
    });
  }

  // ------------------------------------------------------------------ palettes
  const STYLES = {
    astral: { skyTop: "#6cb8ff", skyBot: "#ffe6f0", fog: "#f3e9ff", ground: "#8fd17a", ground2: "#4f9a5c", sun: "#fff6c8", night: false, mtn: ["#9db9e8", "#7ea0d6", "#5d82be"], islands: true },
    astralnuit: { skyTop: "#070b24", skyBot: "#2b3d7a", fog: "#33477f", ground: "#203d4a", ground2: "#0f2230", moon: ["#cfe8ff", "#ffd6f2"], night: true, aurora: true, mtn: ["#2a3a6e", "#1e2b57", "#131c3d"] },
    ferro: { skyTop: "#5a3a26", skyBot: "#e08a3c", fog: "#c9773a", ground: "#5a4636", ground2: "#2e241d", sun: "#ffd28a", haze: true, night: false, mtn: ["#8a5a3c", "#6b4430", "#4a2f22"] },
    lune: { skyTop: "#1b1d22", skyBot: "#6f7a7f", fog: "#a8b0ae", ground: "#3b4038", ground2: "#1f231e", moon: ["#f2f0e1"], night: true, mtn: ["#555c5e", "#3f4547", "#2b3032"] },
    recif: { skyTop: "#2f9bff", skyBot: "#c8f3ff", fog: "#e2fbff", ground: "#f1dca0", ground2: "#d6b56c", sun: "#fffbe0", sea: "#1fb5c9", night: false, mtn: ["#7fc7a8", "#4f9e7a", "#2f7a57"] },
    neon: { skyTop: "#05030e", skyBot: "#3a0f4f", fog: "#521a6b", ground: "#160c22", ground2: "#07040d", night: true, mtn: ["#1a0f2e", "#140a24", "#0d0618"] },
  };

  // ------------------------------------------------------------------ éléments
  function wrap(x, halfW, fn) {
    fn(x);
    if (x - halfW < 0) fn(x + W);
    if (x + halfW > W) fn(x - W);
  }
  function conifer(c, x, y, s, col, snow) {
    c.fillStyle = "#3a2a1e"; c.fillRect(x - 3 * s, y - 14 * s, 6 * s, 14 * s);
    for (let i = 0; i < 3; i++) {
      const w = (34 - i * 8) * s, top = y - (30 + i * 22) * s - 18 * s, bot = y - (10 + i * 20) * s;
      c.fillStyle = col; c.beginPath(); c.moveTo(x, top); c.lineTo(x + w, bot); c.lineTo(x - w, bot); c.fill();
      if (snow) { c.fillStyle = "rgba(255,255,255,.85)"; c.beginPath(); c.moveTo(x, top); c.lineTo(x + w * 0.45, top + (bot - top) * 0.45); c.lineTo(x - w * 0.45, top + (bot - top) * 0.45); c.fill(); }
    }
  }
  function roundTree(c, x, y, s, col, col2) {
    c.fillStyle = "#5a3d2a"; c.fillRect(x - 4 * s, y - 40 * s, 8 * s, 40 * s);
    c.fillStyle = col2; c.beginPath(); c.arc(x + 10 * s, y - 52 * s, 26 * s, 0, TAU); c.fill();
    c.fillStyle = col; c.beginPath(); c.arc(x - 6 * s, y - 60 * s, 30 * s, 0, TAU); c.fill();
  }
  function palm(c, x, y, s, r) {
    c.strokeStyle = "#8a6a3f"; c.lineWidth = 7 * s; c.lineCap = "round";
    const lean = (r() - 0.5) * 60 * s;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + lean * 0.3, y - 60 * s, x + lean, y - 120 * s); c.stroke();
    const tx = x + lean, ty = y - 120 * s;
    c.strokeStyle = "#2f8a4a"; c.lineWidth = 6 * s;
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.55;
      c.beginPath(); c.moveTo(tx, ty);
      c.quadraticCurveTo(tx + Math.cos(a) * 50 * s, ty + Math.sin(a) * 30 * s - 10 * s, tx + Math.cos(a) * 80 * s, ty + Math.sin(a) * 20 * s + 30 * s);
      c.stroke();
    }
  }
  function deadTree(c, x, y, s, col, r) {
    c.strokeStyle = col; c.lineCap = "round";
    function br(x0, y0, len, ang, w, d) {
      const x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len;
      c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
      if (d > 0) { br(x1, y1, len * 0.7, ang - 0.4 - r() * 0.3, w * 0.65, d - 1); br(x1, y1, len * 0.65, ang + 0.35 + r() * 0.3, w * 0.65, d - 1); }
    }
    br(x, y, 50 * s, -Math.PI / 2 + (r() - 0.5) * 0.2, 9 * s, 4);
  }
  function house(c, x, y, s, wall, roof, lit) {
    const w = 60 * s, h = 44 * s;
    c.fillStyle = wall; c.fillRect(x - w / 2, y - h, w, h);
    c.fillStyle = roof; c.beginPath(); c.moveTo(x - w / 2 - 6 * s, y - h); c.lineTo(x, y - h - 34 * s); c.lineTo(x + w / 2 + 6 * s, y - h); c.fill();
    c.fillStyle = lit ? "#ffd36b" : "#2a2a2a";
    c.fillRect(x - 18 * s, y - 30 * s, 10 * s, 12 * s); c.fillRect(x + 8 * s, y - 30 * s, 10 * s, 12 * s);
  }
  function spireTower(c, x, y, s, col, roof, lit) {
    const w = 34 * s, h = 150 * s;
    c.fillStyle = col; c.fillRect(x - w / 2, y - h, w, h);
    c.fillStyle = roof; c.beginPath(); c.moveTo(x - w / 2 - 6 * s, y - h); c.lineTo(x, y - h - 80 * s); c.lineTo(x + w / 2 + 6 * s, y - h); c.fill();
    if (lit) { c.fillStyle = "#ffcf66"; for (let i = 0; i < 3; i++) c.fillRect(x - 4 * s, y - h + 20 * s + i * 38 * s, 8 * s, 14 * s); }
  }
  function castle(c, x, y, s, col, roof, lit) {
    c.fillStyle = col; c.fillRect(x - 120 * s, y - 90 * s, 240 * s, 90 * s);
    for (let i = -120; i < 120; i += 24) c.fillRect(x + i * s, y - 104 * s, 12 * s, 14 * s);
    spireTower(c, x - 120 * s, y, s * 1.2, col, roof, lit);
    spireTower(c, x + 120 * s, y, s * 1.2, col, roof, lit);
    spireTower(c, x, y - 60 * s, s * 1.5, col, roof, lit);
  }
  function crystal(c, x, y, s, col, glow) {
    c.save(); c.shadowColor = glow; c.shadowBlur = 30 * s;
    for (let i = -1; i <= 1; i++) {
      const h = (90 - Math.abs(i) * 30) * s, w = 18 * s, ox = i * 22 * s;
      c.fillStyle = col; c.beginPath();
      c.moveTo(x + ox - w, y); c.lineTo(x + ox - w * 0.8, y - h * 0.75); c.lineTo(x + ox + i * 8 * s, y - h); c.lineTo(x + ox + w * 0.8, y - h * 0.75); c.lineTo(x + ox + w, y); c.fill();
      c.fillStyle = "rgba(255,255,255,.35)"; c.beginPath(); c.moveTo(x + ox - w * 0.2, y); c.lineTo(x + ox + i * 8 * s, y - h); c.lineTo(x + ox - w * 0.8, y - h * 0.75); c.fill();
    }
    c.restore();
  }
  function column(c, x, y, s, col, broken) {
    const h = (broken ? 70 : 120) * s;
    c.fillStyle = col; c.fillRect(x - 12 * s, y - h, 24 * s, h);
    c.fillRect(x - 18 * s, y - 10 * s, 36 * s, 10 * s);
    if (!broken) c.fillRect(x - 18 * s, y - h - 10 * s, 36 * s, 10 * s);
    c.fillStyle = "rgba(0,0,0,.15)"; for (let i = -8; i < 12; i += 8) c.fillRect(x + i * s, y - h, 2 * s, h);
  }
  function smokestack(c, x, y, s, col, r) {
    c.fillStyle = col; c.beginPath(); c.moveTo(x - 20 * s, y); c.lineTo(x - 13 * s, y - 220 * s); c.lineTo(x + 13 * s, y - 220 * s); c.lineTo(x + 20 * s, y); c.fill();
    c.fillStyle = "#c9502a"; c.fillRect(x - 14 * s, y - 200 * s, 28 * s, 10 * s);
    for (let i = 0; i < 6; i++) {
      c.fillStyle = "rgba(70,60,55," + (0.5 - i * 0.07) + ")";
      c.beginPath(); c.arc(x + i * 22 * s + r() * 10 * s, y - 240 * s - i * 26 * s, (18 + i * 9) * s, 0, TAU); c.fill();
    }
  }
  function pylon(c, x, y, s, col) {
    c.strokeStyle = col; c.lineWidth = 3 * s;
    c.beginPath(); c.moveTo(x - 24 * s, y); c.lineTo(x, y - 180 * s); c.lineTo(x + 24 * s, y);
    for (let i = 1; i < 6; i++) { const yy = y - i * 30 * s, ww = 24 * s * (1 - i / 6); c.moveTo(x - ww, yy); c.lineTo(x + ww, yy + 30 * s); }
    c.moveTo(x - 50 * s, y - 150 * s); c.lineTo(x + 50 * s, y - 150 * s); c.stroke();
  }
  function crane(c, x, y, s, col) {
    c.strokeStyle = col; c.lineWidth = 6 * s;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 200 * s); c.lineTo(x + 160 * s, y - 200 * s); c.moveTo(x - 50 * s, y - 200 * s); c.lineTo(x, y - 200 * s);
    c.moveTo(x, y - 240 * s); c.lineTo(x + 160 * s, y - 200 * s); c.moveTo(x, y - 240 * s); c.lineTo(x - 50 * s, y - 200 * s); c.moveTo(x, y - 200 * s); c.lineTo(x, y - 240 * s);
    c.moveTo(x + 120 * s, y - 200 * s); c.lineTo(x + 120 * s, y - 120 * s); c.stroke();
    c.fillStyle = col; c.fillRect(x + 108 * s, y - 120 * s, 24 * s, 18 * s);
  }
  function skyscraper(c, x, y, s, col, r, neon) {
    const w = (50 + r() * 50) * s, h = (180 + r() * 320) * s;
    c.fillStyle = col; c.fillRect(x - w / 2, y - h, w, h);
    const winCols = ["#ffd86b", "#7df9ff", "#ff5fd2", "#b48bff"];
    for (let yy = y - h + 10 * s; yy < y - 10 * s; yy += 14 * s)
      for (let xx = x - w / 2 + 6 * s; xx < x + w / 2 - 6 * s; xx += 12 * s)
        if (r() < (neon ? 0.35 : 0.2)) { c.fillStyle = neon ? winCols[(r() * 4) | 0] : "#ffd86b"; c.fillRect(xx, yy, 6 * s, 7 * s); }
    if (neon && r() < 0.6) {
      const ncol = winCols[1 + ((r() * 3) | 0)];
      c.save(); c.shadowColor = ncol; c.shadowBlur = 20 * s; c.fillStyle = ncol;
      c.fillRect(x - w / 2 - 4 * s, y - h * (0.4 + r() * 0.4), 8 * s, 60 * s); c.restore();
    }
    if (r() < 0.5) { c.fillStyle = col; c.fillRect(x - 2 * s, y - h - 50 * s, 4 * s, 50 * s); c.fillStyle = "#ff3355"; c.beginPath(); c.arc(x, y - h - 50 * s, 4 * s, 0, TAU); c.fill(); }
  }
  function neonSign(c, x, y, s, r) {
    const cols = ["#ff2bd6", "#22f3ff", "#ffe14d", "#7cff6b"]; const col = cols[(r() * 4) | 0];
    c.save(); c.shadowColor = col; c.shadowBlur = 25 * s; c.strokeStyle = col; c.lineWidth = 5 * s;
    c.strokeRect(x - 40 * s, y - 100 * s, 80 * s, 36 * s);
    c.beginPath(); c.moveTo(x - 25 * s, y - 82 * s); c.lineTo(x + 25 * s, y - 82 * s); c.stroke(); c.restore();
    c.fillStyle = "#1b1028"; c.fillRect(x - 3 * s, y - 64 * s, 6 * s, 64 * s);
  }
  function stall(c, x, y, s, r) {
    const cols = ["#ff2bd6", "#22f3ff", "#ffb84d"];
    c.fillStyle = "#24152f"; c.fillRect(x - 50 * s, y - 50 * s, 100 * s, 50 * s);
    c.fillStyle = cols[(r() * 3) | 0]; c.beginPath(); c.moveTo(x - 60 * s, y - 50 * s); c.lineTo(x + 60 * s, y - 50 * s); c.lineTo(x + 50 * s, y - 70 * s); c.lineTo(x - 50 * s, y - 70 * s); c.fill();
    for (let i = -40; i <= 40; i += 20) { c.fillStyle = "#ffcf6b"; c.beginPath(); c.arc(x + i * s, y - 76 * s, 5 * s, 0, TAU); c.fill(); }
  }
  function cross(c, x, y, s, col) {
    c.fillStyle = col; c.fillRect(x - 4 * s, y - 50 * s, 8 * s, 50 * s); c.fillRect(x - 16 * s, y - 40 * s, 32 * s, 7 * s);
  }
  function tomb(c, x, y, s, col) {
    c.fillStyle = col; c.beginPath(); c.moveTo(x - 14 * s, y); c.lineTo(x - 14 * s, y - 26 * s); c.arc(x, y - 26 * s, 14 * s, Math.PI, 0); c.lineTo(x + 14 * s, y); c.fill();
  }
  function rock(c, x, y, s, col) {
    c.fillStyle = col; c.beginPath(); c.moveTo(x - 40 * s, y); c.lineTo(x - 26 * s, y - 30 * s); c.lineTo(x, y - 40 * s); c.lineTo(x + 30 * s, y - 22 * s); c.lineTo(x + 42 * s, y); c.fill();
    c.fillStyle = "rgba(255,255,255,.12)"; c.beginPath(); c.moveTo(x - 26 * s, y - 30 * s); c.lineTo(x, y - 40 * s); c.lineTo(x - 4 * s, y - 10 * s); c.fill();
  }
  function lamp(c, x, y, s, col) {
    c.fillStyle = "#2a2a2a"; c.fillRect(x - 3 * s, y - 90 * s, 6 * s, 90 * s);
    c.save(); c.shadowColor = col; c.shadowBlur = 40 * s; c.fillStyle = col; c.beginPath(); c.arc(x, y - 95 * s, 9 * s, 0, TAU); c.fill(); c.restore();
  }
  function floatingIsland(c, x, y, s, top, rockCol) {
    c.fillStyle = rockCol; c.beginPath(); c.moveTo(x - 90 * s, y); c.quadraticCurveTo(x - 30 * s, y + 90 * s, x, y + 130 * s); c.quadraticCurveTo(x + 30 * s, y + 90 * s, x + 90 * s, y); c.fill();
    c.fillStyle = top; c.beginPath(); c.ellipse(x, y, 92 * s, 18 * s, 0, 0, TAU); c.fill();
    roundTree(c, x - 30 * s, y, s * 0.5, "#6fcf7f", "#4fae6a");
    roundTree(c, x + 25 * s, y, s * 0.4, "#6fcf7f", "#4fae6a");
  }

  // ------------------------------------------------------------------ panorama
  function renderPano(scene, size) {
    const cvs = document.createElement("canvas");
    cvs.width = W; cvs.height = H;
    const c = cvs.getContext("2d");
    const g = byId[scene.game], st = STYLES[g.style], b = scene.biome;
    const r = rng(scene.seed);

    // Ciel
    let skyTop = st.skyTop, skyBot = st.skyBot;
    if (b === "cristal" && !st.night) { skyTop = "#9c7cff"; skyBot = "#ffd1f1"; }
    if (b === "ruines") { skyBot = "#ffd99a"; }
    if (b === "neige") { skyTop = "#7fb6ff"; skyBot = "#f2f7ff"; }
    if (b === "volcan") { skyTop = "#4a2b2b"; skyBot = "#ff9a5c"; }
    if (b === "mine") { skyTop = "#1d1714"; skyBot = "#6b4a33"; }
    const sky = c.createLinearGradient(0, 0, 0, HZ);
    sky.addColorStop(0, skyTop); sky.addColorStop(1, skyBot);
    c.fillStyle = sky; c.fillRect(0, 0, W, HZ + 2);

    if (st.night) {
      for (let i = 0; i < 700; i++) {
        c.fillStyle = "rgba(255,255,255," + (0.3 + r() * 0.7) + ")";
        const y = Math.pow(r(), 1.6) * HZ * 0.9;
        c.fillRect(r() * W, y, r() < 0.1 ? 2 : 1, r() < 0.1 ? 2 : 1);
      }
    }
    if (st.aurora) {
      for (let k = 0; k < 3; k++) {
        const f = ridge(r, 1.2), col = ["rgba(90,255,190,", "rgba(150,120,255,", "rgba(90,200,255,"][k];
        for (let x = 0; x < W; x += 3) {
          const yy = HZ * 0.25 + f(x / W) * 80 + k * 30;
          const gr = c.createLinearGradient(0, yy - 90, 0, yy + 10);
          gr.addColorStop(0, col + "0)"); gr.addColorStop(1, col + "0.18)");
          c.fillStyle = gr; c.fillRect(x, yy - 90, 3, 100);
        }
      }
    }
    if (st.haze || b === "volcan") {
      c.fillStyle = "rgba(255,150,80,.08)";
      for (let i = 0; i < 40; i++) { c.beginPath(); c.ellipse(r() * W, HZ * (0.3 + r() * 0.6), 200 + r() * 300, 20 + r() * 40, 0, 0, TAU); c.fill(); }
    }
    // Astres
    const sunX = r() * W, sunY = HZ * (0.25 + r() * 0.35);
    if (st.sun) {
      wrap(sunX, 300, (x) => {
        const gl = c.createRadialGradient(x, sunY, 10, x, sunY, 280);
        gl.addColorStop(0, "rgba(255,250,220,.9)"); gl.addColorStop(1, "rgba(255,250,220,0)");
        c.fillStyle = gl; c.fillRect(x - 280, sunY - 280, 560, 560);
        c.fillStyle = st.sun; c.beginPath(); c.arc(x, sunY, 38, 0, TAU); c.fill();
      });
    }
    if (st.moon) {
      st.moon.forEach((mc, i) => {
        const mx = (sunX + i * 260) % W, my = sunY - i * 60, rad = i ? 22 : 44;
        wrap(mx, 200, (x) => {
          const gl = c.createRadialGradient(x, my, rad, x, my, rad * 4);
          gl.addColorStop(0, "rgba(255,255,255,.25)"); gl.addColorStop(1, "rgba(255,255,255,0)");
          c.fillStyle = gl; c.fillRect(x - rad * 4, my - rad * 4, rad * 8, rad * 8);
          c.fillStyle = mc; c.beginPath(); c.arc(x, my, rad, 0, TAU); c.fill();
          c.fillStyle = "rgba(0,0,0,.08)"; c.beginPath(); c.arc(x - rad * 0.3, my - rad * 0.2, rad * 0.25, 0, TAU); c.arc(x + rad * 0.35, my + rad * 0.3, rad * 0.18, 0, TAU); c.fill();
        });
      });
    }
    if (g.style === "neon") {
      // halo de pollution lumineuse
      const gl = c.createLinearGradient(0, HZ - 200, 0, HZ);
      gl.addColorStop(0, "rgba(255,40,200,0)"); gl.addColorStop(1, "rgba(255,40,200,.35)");
      c.fillStyle = gl; c.fillRect(0, HZ - 200, W, 200);
    }
    // Nuages
    if (!st.night && g.style !== "ferro") {
      c.fillStyle = "rgba(255,255,255,.7)";
      for (let i = 0; i < 14; i++) {
        const cx = r() * W, cy = HZ * (0.15 + r() * 0.5), sc = 0.5 + r();
        wrap(cx, 200, (x) => { for (let j = 0; j < 5; j++) { c.beginPath(); c.ellipse(x + (j - 2) * 40 * sc, cy + Math.sin(j) * 8, 60 * sc, 26 * sc, 0, 0, TAU); c.fill(); } });
      }
    }
    if (st.islands && b !== "neige") {
      for (let i = 0; i < 4; i++) { const x = r() * W, y = HZ * (0.3 + r() * 0.45), s = 0.4 + r() * 0.6; wrap(x, 100 * s, (xx) => floatingIsland(c, xx, y, s, "#8fe08a", "#9a8fb8")); }
    }

    // Montagnes (3 couches)
    const amp = { neige: 260, chateau: 220, volcan: 160, mine: 280, desert: 70, plage: 60, lagon: 50, lac: 120, port: 50, docks: 30, centre: 20, marche: 20, toits: 20 }[b] || 150;
    const water = ["plage", "lagon", "lac", "port", "docks", "marais"].includes(b);
    for (let L = 0; L < 3; L++) {
      const f = ridge(r, b === "desert" ? 1.8 : 1.0);
      const col = mix(st.mtn[L], st.fog, (2 - L) * 0.25);
      const base = (water ? 0 : 10) + (2 - L) * 10, a = amp * (1 - L * 0.28);
      c.fillStyle = col; c.beginPath(); c.moveTo(0, HZ + 4);
      for (let x = 0; x <= W; x += 4) c.lineTo(x, HZ - base - a * (f(x / W) + 1) / 2 * (water && L === 2 ? 0.2 : 1));
      c.lineTo(W, HZ + 4); c.fill();
      if ((b === "neige" || b === "chateau") && L === 0) {
        c.fillStyle = "rgba(255,255,255,.85)"; c.beginPath();
        for (let x = 0; x <= W; x += 4) { const y = HZ - base - a * (f(x / W) + 1) / 2; const ys = Math.min(y + 30, HZ - base - a * 0.62); x === 0 ? c.moveTo(x, y) : c.lineTo(x, Math.max(y, Math.min(y + 40, ys))); }
        for (let x = W; x >= 0; x -= 4) { const y = HZ - base - a * (f(x / W) + 1) / 2; c.lineTo(x, Math.max(y, Math.min(y + 40, HZ - base - a * 0.62))); }
        c.fill();
      }
    }
    if (b === "volcan") {
      const vx = r() * W;
      wrap(vx, 420, (x) => {
        c.fillStyle = "#3a2622"; c.beginPath(); c.moveTo(x - 420, HZ); c.lineTo(x - 70, HZ - 300); c.lineTo(x + 70, HZ - 300); c.lineTo(x + 420, HZ); c.fill();
        c.save(); c.shadowColor = "#ff5a1f"; c.shadowBlur = 40; c.strokeStyle = "#ff7a2f"; c.lineWidth = 8;
        c.beginPath(); c.moveTo(x - 20, HZ - 300); c.quadraticCurveTo(x - 60, HZ - 180, x - 120, HZ - 40); c.moveTo(x + 30, HZ - 300); c.quadraticCurveTo(x + 80, HZ - 160, x + 60, HZ - 30); c.stroke(); c.restore();
        for (let i = 0; i < 8; i++) { c.fillStyle = "rgba(60,50,50," + (0.5 - i * 0.05) + ")"; c.beginPath(); c.arc(x + i * 30, HZ - 330 - i * 40, 40 + i * 14, 0, TAU); c.fill(); }
      });
    }

    // Sol / eau
    let gTop = st.ground, gBot = st.ground2;
    if (b === "neige") { gTop = "#f4f8ff"; gBot = "#b9c8e0"; }
    if (b === "desert") { gTop = "#b8743f"; gBot = "#6e3f22"; }
    if (b === "cristal") { gTop = st.night ? "#2a2050" : "#c9b3ff"; gBot = st.night ? "#140f2c" : "#7a5fc0"; }
    if (b === "ruines") { gTop = "#d9c38a"; gBot = "#9a8350"; }
    if (b === "jungle") { gTop = "#2f7a3a"; gBot = "#173f1f"; }
    if (b === "volcan") { gTop = "#3b2b28"; gBot = "#1a1110"; }
    const gr = c.createLinearGradient(0, HZ, 0, H);
    gr.addColorStop(0, gTop); gr.addColorStop(1, gBot);
    c.fillStyle = gr; c.fillRect(0, HZ, W, HZ);
    if (water) {
      const wcol = { plage: "#22b8cf", lagon: "#3fe0d0", lac: "#1d3566", port: "#2c3a40", docks: "#0a1636", marais: "#2c3a2a" }[b];
      const shore = b === "plage" ? HZ + 120 : b === "lagon" ? HZ + 260 : HZ + 200;
      const wg = c.createLinearGradient(0, HZ, 0, shore);
      wg.addColorStop(0, mix(wcol.length === 7 ? wcol : "#336699", st.fog, 0.35)); wg.addColorStop(1, wcol);
      const half = r() < 0.5;
      c.fillStyle = wg;
      if (b === "plage" || b === "port" || b === "docks") {
        // l'eau sur la moitié de l'horizon, la terre sur l'autre
        const f = ridge(r, 1.3);
        c.beginPath(); c.moveTo(0, HZ);
        for (let x = 0; x <= W; x += 4) c.lineTo(x, HZ + Math.max(0, (f(x / W) + (half ? 0.3 : 0)) * (shore - HZ)));
        c.lineTo(W, HZ); c.fill();
      } else c.fillRect(0, HZ, W, shore - HZ);
      c.strokeStyle = st.night ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.35)"; c.lineWidth = 2;
      for (let i = 0; i < 160; i++) { const y = HZ + Math.pow(r(), 2) * (shore - HZ), x = r() * W, l = 10 + (y - HZ) * 0.4; c.beginPath(); c.moveTo(x, y); c.lineTo(x + l, y); c.stroke(); }
      if (g.style === "neon") for (let i = 0; i < 80; i++) { c.fillStyle = ["rgba(255,43,214,.4)", "rgba(34,243,255,.4)"][i % 2]; c.fillRect(r() * W, HZ + r() * 150, 30 + r() * 60, 2); }
    }

    // Éléments (du plus loin au plus proche)
    const items = [];
    const N = { centre: 60, toits: 45, marche: 30, docks: 25, jungle: 55, foret: 50, village: 22, usine: 26, cimetiere: 50, prairie: 30, neige: 34 }[b] || 28;
    for (let i = 0; i < N; i++) items.push({ x: r() * W, z: r() });
    items.sort((a, b2) => b2.z - a.z);
    for (const it of items) {
      const near = 1 - it.z;
      const y = HZ + 6 + Math.pow(near, 2) * H * 0.28;
      const s = 0.25 + near * 1.1;
      const fogT = it.z * 0.55;
      const rr = rng((it.x * 1000) | 0);
      const F = (col) => mix(col, st.fog, fogT);
      wrap(it.x, 300 * s, (x) => {
        switch (b) {
          case "prairie": rr() < 0.7 ? roundTree(c, x, y, s, F("#6fcf7f"), F("#4fae6a")) : rock(c, x, y, s, F("#a3a8c2")); break;
          case "cristal": rr() < 0.6 ? crystal(c, x, y, s, F(st.night ? "#a06bff" : "#c79bff"), st.night ? "#c38bff" : "#ffffff") : rock(c, x, y, s, F(st.night ? "#3a3060" : "#8f7ab8")); break;
          case "neige": conifer(c, x, y, s, F("#2f5a4a"), true); break;
          case "ruines": rr() < 0.7 ? column(c, x, y, s, F("#efe2c0"), rr() < 0.5) : rock(c, x, y, s, F("#bfae80")); break;
          case "foret": rr() < 0.85 ? conifer(c, x, y, s, F("#16363a"), false) : lamp(c, x, y, s * 0.6, "#9affd5"); break;
          case "lac": if (it.z > 0.55) conifer(c, x, HZ + 2, s * 0.6, F("#16363a"), false); break;
          case "citadelle": rr() < 0.5 ? spireTower(c, x, y, s, F("#3a4a80"), F("#6b5bd6"), true) : conifer(c, x, y, s * 0.8, F("#16363a"), false); break;
          case "usine": { const q = rr(); q < 0.35 ? smokestack(c, x, y, s, F("#4a3a32"), rr) : q < 0.7 ? pylon(c, x, y, s, F("#2a201a")) : rock(c, x, y, s, F("#6a4a36")); break; }
          case "desert": rr() < 0.6 ? rock(c, x, y, s, F("#8a4f2a")) : pylon(c, x, y, s, F("#3a2a20")); break;
          case "port": if (it.z > 0.4) crane(c, x, HZ + 4, s, F("#d0642a")); else rock(c, x, y, s, F("#4a4038")); break;
          case "mine": { const q = rr(); q < 0.4 ? lamp(c, x, y, s, "#ffb347") : q < 0.7 ? pylon(c, x, y, s * 0.8, F("#1e1712")) : rock(c, x, y, s, F("#3a2a22")); break; }
          case "cimetiere": { const q = rr(); q < 0.45 ? cross(c, x, y, s, F("#8a8f8a")) : q < 0.8 ? tomb(c, x, y, s, F("#7b807b")) : deadTree(c, x, y, s, F("#1e1f1c"), rr); break; }
          case "marais": rr() < 0.6 ? deadTree(c, x, y, s, F("#1c221a"), rr) : rock(c, x, y, s * 0.6, F("#2c3a2a")); break;
          case "chateau": if (it.z > 0.8 && rr() < 0.15) castle(c, x, HZ - 60, 0.9, "#2a2c30", "#3a2030", true); else deadTree(c, x, y, s, F("#1e1f1c"), rr); break;
          case "village": rr() < 0.6 ? house(c, x, y, s, F("#5a5248"), F("#3a2a2a"), true) : deadTree(c, x, y, s, F("#1e1f1c"), rr); break;
          case "plage": rr() < 0.55 ? palm(c, x, y, s, rr) : rock(c, x, y, s * 0.6, F("#c2a878")); break;
          case "jungle": rr() < 0.6 ? roundTree(c, x, y, s * 1.3, F("#2f8a4a"), F("#1f6a37")) : palm(c, x, y, s, rr); break;
          case "volcan": rr() < 0.7 ? rock(c, x, y, s, F("#2a1c1a")) : palm(c, x, y, s * 0.8, rr); break;
          case "lagon": if (it.z > 0.5) palm(c, x, HZ + 4, s * 0.7, rr); break;
          case "centre": case "toits": skyscraper(c, x, b === "toits" ? y + 40 * s : y, s * (b === "toits" ? 0.8 : 1), F("#140c22"), rr, true); break;
          case "docks": if (it.z > 0.45) crane(c, x, HZ + 2, s, F("#2a1f3a")); else lamp(c, x, y, s, "#22f3ff"); break;
          case "marche": { const q = rr(); q < 0.5 ? stall(c, x, y, s, rr) : q < 0.8 ? neonSign(c, x, y, s, rr) : skyscraper(c, x, HZ, 0.6, F("#140c22"), rr, true); break; }
        }
      });
    }
    // Brume à l'horizon
    const fg = c.createLinearGradient(0, HZ - 80, 0, HZ + 60);
    const fogA = st.night ? 0.25 : g.style === "lune" ? 0.55 : 0.35;
    fg.addColorStop(0, "rgba(255,255,255,0)"); fg.addColorStop(0.6, hexA(st.fog, fogA)); fg.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = fg; c.fillRect(0, HZ - 80, W, 140);
    if (g.style === "lune" || b === "marais") {
      c.fillStyle = hexA(st.fog, 0.18);
      for (let i = 0; i < 30; i++) { c.beginPath(); c.ellipse(r() * W, HZ + 40 + r() * 200, 250, 30, 0, 0, TAU); c.fill(); }
    }
    // Brins au sol
    c.strokeStyle = "rgba(0,0,0,.15)"; c.lineWidth = 2;
    for (let i = 0; i < 500; i++) { const x = r() * W, y = HZ + 100 + r() * (H - HZ - 100); c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * 6, y - 6 - r() * 10); c.stroke(); }

    if (size && size < W) {
      const small = document.createElement("canvas"); small.width = size; small.height = size / 2;
      small.getContext("2d").drawImage(cvs, 0, 0, size, size / 2); return small;
    }
    return cvs;
  }
  function hexA(h, a) { const [r, g, b] = hex(h); return "rgba(" + r + "," + g + "," + b + "," + a + ")"; }

  // ------------------------------------------------------------------ cartes
  const MW = 1200, MH = 800;
  const BIOME_COL = {
    prairie: "#8fd17a", cristal: "#c3a6ff", neige: "#f1f5ff", ruines: "#e2cf96",
    foret: "#24505a", lac: "#2a4c8f", citadelle: "#48508f",
    usine: "#6b5a4c", desert: "#b8743f", port: "#5a6670", mine: "#3d322a",
    cimetiere: "#8b8c7e", marais: "#56664c", chateau: "#5c5560", village: "#a39a7a",
    plage: "#f1dca0", jungle: "#3c8f4a", volcan: "#5a3a32", lagon: "#7fe8d8",
    centre: "#3a1a5a", docks: "#123a5a", marche: "#5a1a3a", toits: "#2a2050",
  };
  const mapCache = {};
  function renderMap(gameId) {
    if (mapCache[gameId]) return mapCache[gameId];
    const g = byId[gameId];
    const cvs = document.createElement("canvas"); cvs.width = MW; cvs.height = MH;
    const c = cvs.getContext("2d");
    const r = rng(hashStr(gameId + "map"));
    c.fillStyle = g.map.bg; c.fillRect(0, 0, MW, MH);
    // texture du fond
    c.strokeStyle = "rgba(255,255,255,.07)"; c.lineWidth = 2;
    for (let i = 0; i < 40; i++) { const y = r() * MH; c.beginPath(); for (let x = 0; x <= MW; x += 20) c.lineTo(x, y + Math.sin(x / 60 + i) * 6); c.stroke(); }

    if (g.style === "neon") {
      c.fillStyle = g.map.sea; c.fillRect(0, MH * 0.86, MW, MH * 0.14);
      for (const rg of g.regions) {
        c.fillStyle = BIOME_COL[rg.b]; const w = 380, h = 260;
        c.fillRect(rg.x * MW - w / 2, rg.y * MH - h / 2, w, h);
      }
      c.strokeStyle = "#ff2bd6"; c.lineWidth = 3; c.globalAlpha = 0.5;
      for (let x = 30; x < MW; x += 70) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, MH * 0.86); c.stroke(); }
      c.strokeStyle = "#22f3ff";
      for (let y = 30; y < MH * 0.86; y += 70) { c.beginPath(); c.moveTo(0, y); c.lineTo(MW, y); c.stroke(); }
      c.globalAlpha = 1;
      for (let i = 0; i < 160; i++) { c.fillStyle = "rgba(255,255,255," + (0.05 + r() * 0.15) + ")"; c.fillRect(r() * MW, r() * MH * 0.86, 20 + r() * 30, 20 + r() * 30); }
    } else {
      c.fillStyle = g.map.sea; c.fillRect(0, 0, MW, MH);
      c.fillStyle = "rgba(255,255,255,.06)";
      for (let i = 0; i < 300; i++) c.fillRect(r() * MW, r() * MH, 14, 2);
      // côte : contour clair puis terres colorées
      const blobs = g.regions.map((rg) => {
        const pts = [], rad = 200 + r() * 40, f = ridge(r, 1.1);
        for (let i = 0; i < 120; i++) { const a = (i / 120) * TAU; const rr = rad * (1 + 0.22 * f(i / 120)); pts.push([rg.x * MW + Math.cos(a) * rr * 1.1, rg.y * MH + Math.sin(a) * rr * 0.85]); }
        return { rg, pts };
      });
      const path = (pts) => { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); };
      c.fillStyle = "rgba(255,255,255,.25)";
      blobs.forEach((bl) => { c.save(); c.translate(bl.rg.x * MW, bl.rg.y * MH); c.scale(1.07, 1.07); c.translate(-bl.rg.x * MW, -bl.rg.y * MH); path(bl.pts); c.fill(); c.restore(); });
      blobs.forEach((bl) => { c.fillStyle = BIOME_COL[bl.rg.b]; path(bl.pts); c.fill(); });
      // détails par biome
      for (const bl of blobs) {
        const rg = bl.rg, cx = rg.x * MW, cy = rg.y * MH;
        for (let i = 0; i < 70; i++) {
          const a = r() * TAU, d = Math.sqrt(r()) * 170;
          const x = cx + Math.cos(a) * d * 1.1, y = cy + Math.sin(a) * d * 0.8;
          c.fillStyle = "rgba(0,0,0,.18)";
          switch (rg.b) {
            case "prairie": case "jungle": case "foret": c.beginPath(); c.arc(x, y, 6, 0, TAU); c.fill(); break;
            case "neige": case "chateau": case "mine": c.beginPath(); c.moveTo(x - 10, y + 6); c.lineTo(x, y - 10); c.lineTo(x + 10, y + 6); c.fill(); break;
            case "desert": c.fillRect(x - 8, y, 16, 2); break;
            case "cimetiere": c.fillRect(x - 1, y - 6, 2, 10); c.fillRect(x - 4, y - 3, 8, 2); break;
            case "village": case "usine": c.fillRect(x - 5, y - 5, 10, 10); break;
            default: c.beginPath(); c.arc(x, y, 3, 0, TAU); c.fill();
          }
        }
      }
      if (g.style === "recif") { c.fillStyle = "#ff5a1f"; c.beginPath(); c.arc(g.regions[2].x * MW, g.regions[2].y * MH, 18, 0, TAU); c.fill(); }
    }
    // noms des régions
    c.textAlign = "center"; c.font = "600 30px 'Chakra Petch', sans-serif";
    for (const rg of g.regions) {
      c.lineWidth = 6; c.strokeStyle = "rgba(0,0,0,.55)"; c.fillStyle = "#fff";
      c.strokeText(rg.n, rg.x * MW, rg.y * MH); c.fillText(rg.n, rg.x * MW, rg.y * MH);
    }
    // cartouche
    c.fillStyle = "rgba(0,0,0,.45)"; c.fillRect(24, MH - 74, 420, 50);
    c.fillStyle = "#fff"; c.textAlign = "left"; c.font = "700 28px 'Chakra Petch', sans-serif"; c.fillText(g.map.name, 40, MH - 39);
    // rose des vents
    c.save(); c.translate(MW - 70, 70); c.fillStyle = "rgba(255,255,255,.8)";
    c.beginPath(); c.moveTo(0, -40); c.lineTo(10, 0); c.lineTo(0, 40); c.lineTo(-10, 0); c.fill();
    c.font = "700 20px sans-serif"; c.textAlign = "center"; c.fillText("N", 0, -46); c.restore();
    mapCache[gameId] = cvs;
    return cvs;
  }

  const api = { GAMES, SCENES, byId, renderPano, renderMap, MAP_W: MW, MAP_H: MH };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.DEMO = api;
})(typeof window !== "undefined" ? window : globalThis);
