/* Reconnaissance des noms de jeux.
 * evaluate(saisie, idRéponse) renvoie :
 *   { k: "ok" }         bonne réponse
 *   { k: "precision" }  saisie incomplète (série, titre sans numéro/sous-titre…) : ne compte PAS comme un échec
 *   { k: "wrong" }      mauvais jeu : compte comme un échec
 *   { k: "vague" | "empty" } saisie trop vague : ignorée
 */
(function (root) {
  const ROMAN = { ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12, xiii: 13, xiv: 14, xv: 15, xvi: 16, xvii: 17, xviii: 18, xix: 19, xx: 20 };
  const STOP = new Set(["the", "of", "a", "an", "and", "le", "la", "les", "de", "des", "du", "l", "d", "un", "une", "et", "in", "to", "on", "jeu", "game", "edition"]);

  function norm(s) {
    s = String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    s = s.replace(/œ/g, "oe").replace(/æ/g, "ae").replace(/&/g, " and ");
    s = s.replace(/(^|[^a-z])(d|l|j|qu)['’`´]/g, "$1"); // élisions françaises : d'Astral → Astral
    s = s.replace(/['’`´]/g, "");                          // assassin's → assassins
    s = s.replace(/[^a-z0-9]+/g, " ").trim();
    if (!s) return "";
    return s.split(" ").filter((w) => w !== "d" && w !== "l").map((w) => (ROMAN[w] ? String(ROMAN[w]) : w)).join(" ");
  }
  function slug(s) { return (norm(s).replace(/ /g, "-") || "jeu").slice(0, 60); }
  const uniq = (a) => [...new Set(a)];

  function startsWithToks(t, q) {
    if (q.length > t.length) return false;
    for (let i = 0; i < q.length; i++) if (t[i] !== q[i]) return false;
    return true;
  }
  function containsToks(t, q) {
    for (let i = 0; i + q.length <= t.length; i++) {
      let ok = true;
      for (let j = 0; j < q.length; j++) if (t[i + j] !== q[j]) { ok = false; break; }
      if (ok) return true;
    }
    return false;
  }
  // Distance de Damerau-Levenshtein (une inversion de deux lettres = une seule faute).
  function lev(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    const d = [];
    for (let i = 0; i <= m; i++) { d[i] = [i]; }
    for (let j = 0; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
    return d[m][n];
  }
  const sim = (a, b) => 1 - lev(a, b) / Math.max(a.length, b.length, 1);
  const nums = (s) => s.split(" ").filter((w) => /^\d+$/.test(w)).sort().join(",");

  function createMatcher(seriesList, extraGames) {
    const games = [], series = [], byId = {}, seriesById = {};

    function addSeries(name, aliases) {
      if (!name) return null;
      const id = "s:" + slug(name);
      if (seriesById[id]) {
        seriesById[id].n = uniq(seriesById[id].n.concat((aliases || []).map(norm))).filter(Boolean);
        return id;
      }
      const s = { id, t: name, n: uniq([name, ...(aliases || [])].map(norm)).filter(Boolean) };
      series.push(s); seriesById[id] = s;
      return id;
    }
    function addGame(title, aliases, sid, extra) {
      const id = (extra && extra.id) || slug(title);
      if (byId[id]) {
        const g = byId[id];
        g.n = uniq(g.n.concat((aliases || []).map(norm))).filter(Boolean);
        g.tok = g.n.map((x) => x.split(" "));
        if (sid && !g.s) g.s = sid;
        return g;
      }
      const n = uniq([title, ...(aliases || [])].map(norm)).filter(Boolean);
      const g = Object.assign({ id, t: title, s: sid, n, tok: n.map((x) => x.split(" ")) }, extra || {});
      games.push(g); byId[id] = g;
      return g;
    }
    for (const se of seriesList || []) {
      const sid = addSeries(se.s, se.a);
      for (const row of se.g) addGame(row[0], row.slice(1), sid);
    }
    for (const eg of extraGames || []) {
      const sid = eg.s ? addSeries(eg.s, eg.sa || []) : null;
      addGame(eg.t, eg.a || [], sid, eg.id ? { id: eg.id, custom: true } : { custom: true });
    }

    function seriesOf(g) { return g && g.s ? seriesById[g.s] : null; }

    function precision(q, ans, extraCands) {
      let c = [];
      if (ans.s) c = games.filter((g) => g.s === ans.s);
      if (extraCands) c = c.concat(extraCands);
      const qt = q.split(" ");
      c = c.concat(games.filter((g) => g.tok.some((t) => startsWithToks(t, qt))));
      c = uniq(c);
      if (!c.includes(ans)) c.push(ans);
      c.sort((a, b) => a.t.localeCompare(b.t, "fr"));
      return { k: "precision", candidates: c.length <= 12 ? c.map((g) => g.t) : null, series: seriesOf(ans) ? seriesOf(ans).t : null };
    }

    function evaluate(input, answerId) {
      const q = norm(input);
      if (!q) return { k: "empty" };
      const ans = byId[answerId];
      if (!ans) return { k: "wrong" };
      if (ans.n.includes(q)) return { k: "ok", game: ans };
      const qt = q.split(" ");
      const meaningful = qt.filter((w) => !STOP.has(w));
      if (!meaningful.length) return { k: "vague" };
      const mlen = meaningful.join("").length;

      // Titre de la bonne réponse tapé sans son numéro / sous-titre → demander une précision.
      const isPrefix = ans.tok.some((t) => t.length > qt.length && startsWithToks(t, qt));
      if (isPrefix && mlen >= 2) return precision(q, ans);

      const exactOther = games.find((g) => g !== ans && g.n.includes(q));
      const seriesHit = series.find((s) => s.n.includes(q));
      if (seriesHit && seriesHit.id === ans.s) return precision(q, ans);
      if (exactOther) return { k: "wrong", game: exactOther };
      if (seriesHit) return { k: "wrong" };
      if (mlen < 3) return { k: "vague" };

      // Morceau de titre (ex. « skyrim », « breath of the wild »).
      const cands = games.filter((g) => g.tok.some((t) => containsToks(t, qt)));
      if (cands.length) {
        if (cands.includes(ans)) return cands.length === 1 ? { k: "ok", game: ans } : precision(q, ans, cands);
        return { k: "wrong", game: cands.length === 1 ? cands[0] : null };
      }

      // Faute de frappe : similarité de chaîne, les numéros doivent correspondre.
      let best = null, bestName = "", bs = 0;
      for (const g of games) for (const n of g.n) {
        const s = sim(q, n);
        if (s > bs) { bs = s; best = g; bestName = n; }
      }
      if (best === ans && bs >= 0.8 && nums(q) === nums(bestName)) return { k: "ok", game: ans, typo: true };
      return { k: "wrong", game: bs >= 0.85 ? best : null };
    }

    function suggest(input, limit) {
      const q = norm(input);
      if (q.length < 2) return [];
      const qt = q.split(" ");
      const last = qt[qt.length - 1], head = qt.slice(0, -1);
      const scored = [];
      for (const g of games) {
        let sc = 0;
        for (const t of g.tok) {
          const joined = t.join(" ");
          let s = 0;
          if (joined.startsWith(q)) s = 4;
          else {
            for (let i = 0; i < t.length; i++) {
              if (t[i].startsWith(last) && (head.length === 0 || containsToks(t.slice(0, i), head))) { s = 3; break; }
            }
            if (!s && joined.includes(q)) s = 1;
          }
          if (s > sc) sc = s;
        }
        if (sc) scored.push([sc, g]);
      }
      scored.sort((a, b) => b[0] - a[0] || a[1].t.length - b[1].t.length);
      return scored.slice(0, limit || 6).map((x) => x[1].t);
    }

    return { games, series, byId, seriesById, evaluate, suggest, addGame, addSeries, norm, slug };
  }

  const api = { createMatcher, norm, slug };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Matcher = api;
})(typeof window !== "undefined" ? window : globalThis);
