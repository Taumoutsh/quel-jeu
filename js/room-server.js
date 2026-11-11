/* Multijoueur hors de claude.ai : quand la page est servie par server/server.js (Docker),
 * celui-ci ajoute <meta name="qj-server">. On fournit alors une capacité « room » compatible
 * avec celle des artefacts Claude, adossée aux salles du serveur (/api/rooms, flux SSE).
 * Sur claude.ai ou avec un simple serveur de fichiers, ce script ne fait rien.
 */
(function () {
  "use strict";
  if (window.claude || !document.querySelector('meta[name="qj-server"]') || !window.EventSource) return;

  const rid = () => { let s = ""; const a = "abcdefghijklmnopqrstuvwxyz0123456789"; for (let i = 0; i < 16; i++) s += a[(Math.random() * a.length) | 0]; return s; };

  const room = {
    async join(name) {
      const me = rid();
      const base = "api/rooms/" + encodeURIComponent(name) + "/";
      let pres = {}, others = new Map(), closed = false;
      const hs = [], errs = [];
      const snap = () => [{ peer: me, sameTab: true, isMe: true, presence: pres },
        ...[...others].map(([peer, pr]) => ({ peer, sameTab: false, isMe: false, presence: pr }))];
      const fire = () => { const ps = snap(); for (const h of hs) { try { h({ peers: ps, joined: [], left: [], updated: [] }); } catch (e) { console.error(e); } } };
      const post = (what, body) => fetch(base + what + "?peer=" + me, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}), keepalive: what === "leave" });

      const es = new EventSource(base + "events?peer=" + me);
      let lostT = null;
      es.onmessage = (e) => {
        let d; try { d = JSON.parse(e.data); } catch (err) { return; }
        const next = new Map();
        for (const [peer, pr] of Object.entries(d.peers || {})) if (peer !== me) next.set(peer, pr || {});
        others = next; fire();
      };
      es.onopen = () => {
        clearTimeout(lostT); lostT = null;
        // après une reconnexion, le serveur a pu oublier notre présence : on la renvoie
        if (Object.keys(pres).length) post("presence", pres).catch(() => {});
      };
      es.onerror = () => {
        if (closed || lostT) return;
        lostT = setTimeout(() => { for (const h of errs) h({ code: "connexion" }); }, 8000);
      };
      const bye = () => { if (!closed) navigator.sendBeacon && navigator.sendBeacon(base + "leave?peer=" + me, new Blob(["{}"], { type: "application/json" })); };
      window.addEventListener("pagehide", bye);

      // attend le premier état de la salle (ou 3 s) pour que peers() soit à jour dès le départ
      await new Promise((ok) => { const t = setTimeout(ok, 3000); const once = es.onmessage; es.onmessage = (e) => { once(e); es.onmessage = once; clearTimeout(t); ok(); }; });

      return {
        name,
        peers: snap,
        onPeers(h, onErr) { hs.push(h); if (onErr) errs.push(onErr); setTimeout(fire, 0); return () => { const i = hs.indexOf(h); if (i >= 0) hs.splice(i, 1); }; },
        async presence(p) {
          pres = Object.assign({}, pres, p); fire();
          const r = await post("presence", pres);
          if (!r.ok) throw Object.assign(new Error("présence refusée"), { code: String(r.status) });
        },
        async leave() {
          closed = true; es.close(); window.removeEventListener("pagehide", bye);
          try { await post("leave"); } catch (e) { /* hors ligne */ }
        },
      };
    },
  };

  window.claude = { use: async (n) => { if (n === "room") return room; throw Object.assign(new Error("indisponible"), { code: "unavailable" }); } };
})();
