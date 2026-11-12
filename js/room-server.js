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
      let pres = {}, others = new Map(), meta = {}, closed = false, lastV = -1, lastRid = null, lastMsg = Date.now();
      const hs = [], errs = [];
      // online : connecté au serveur (sinon : coupé, en délai de grâce) ; since : arrivée dans la salle (ms)
      const info = (peer) => ({ online: !meta[peer] || meta[peer].on !== 0, since: meta[peer] ? meta[peer].t : 0 });
      const snap = () => [Object.assign({ peer: me, sameTab: true, isMe: true, presence: pres }, info(me)),
        ...[...others].map(([peer, pr]) => Object.assign({ peer, sameTab: false, isMe: false, presence: pr }, info(peer)))];
      const fire = () => { const ps = snap(); for (const h of hs) { try { h({ peers: ps, joined: [], left: [], updated: [] }); } catch (e) { console.error(e); } } };
      const post = (what, body) => fetch(base + what + "?peer=" + me, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}), keepalive: what === "leave" });

      let es = null, lostT = null, firstMsg = null;
      // lagging : la relecture a apporté du neuf que le flux n'avait pas livré (flux retenu par un antivirus,
      // un proxy d'opérateur…) : on relit alors chaque seconde, jusqu'à ce que le flux redevienne le plus rapide
      let lagging = false;
      const apply = (d, fromStream) => {
        lastMsg = Date.now();
        if (firstMsg) { firstMsg(); firstMsg = null; }
        if (!d || typeof d !== "object") return;
        // salle recréée (serveur redémarré, salle vidée puis rouverte) : on repart de zéro
        if (d.rid && d.rid !== lastRid) { lastRid = d.rid; lastV = -1; }
        // déjà reçu, ou plus ancien que ce qu'on a (le flux et la relecture peuvent se croiser)
        if (typeof d.v === "number" && d.v <= lastV) return;
        if (typeof d.v === "number") { if (lastV >= 0) lagging = !fromStream; lastV = d.v; }
        const next = new Map();
        for (const [peer, pr] of Object.entries(d.peers || {})) if (peer !== me) next.set(peer, pr || {});
        others = next; meta = d.meta || {}; fire();
      };
      const pollNow = () => fetch(base + "state?peer=" + me, { cache: "no-store" }).then((r) => r.json()).then(apply).catch(() => {});
      // flux en direct ; recréé quand le navigateur l'a fermé (page mise de côté sur téléphone, réseau coupé…)
      const connect = () => {
        if (es) { es.onmessage = es.onopen = es.onerror = null; es.close(); }
        es = new EventSource(base + "events?peer=" + me);
        es.onmessage = (e) => { let d; try { d = JSON.parse(e.data); } catch (err) { return; } apply(d, true); };
        es.onopen = () => {
          clearTimeout(lostT); lostT = null;
          // après une reconnexion, le serveur a pu oublier notre présence : on la renvoie
          if (Object.keys(pres).length) post("presence", pres).catch(() => {});
        };
        es.onerror = () => {
          if (closed) return;
          // fermé pour de bon (le navigateur ne réessaiera pas) : on rouvre nous-mêmes un peu plus tard
          if (es.readyState === 2) setTimeout(() => { if (!closed && es.readyState === 2) connect(); }, 1500);
          if (!lostT) lostT = setTimeout(() => { if (es.readyState !== 1) for (const h of errs) h({ code: "connexion" }); }, 10000);
        };
      };
      connect();
      pollNow(); // état de la salle tout de suite, même si un intermédiaire retient le début du flux
      // retour sur la page (application rouverte, onglet revenu au premier plan, page restaurée, réseau revenu) :
      // flux rouvert si besoin, présence renvoyée et état de la salle relu tout de suite, sans attendre
      const wake = () => {
        if (closed || document.visibilityState === "hidden") return;
        if (!es || es.readyState === 2 || Date.now() - lastMsg > 20000) connect();
        if (Object.keys(pres).length) post("presence", pres).catch(() => {});
        pollNow();
      };
      document.addEventListener("visibilitychange", wake);
      window.addEventListener("pageshow", wake);
      window.addEventListener("online", wake);
      window.addEventListener("focus", wake);
      // secours : si le flux en direct se tait (chaque joueur publie un signal toutes les 2 s, il ne devrait
      // jamais se taire 2,5 s) ou s'il est en retard sur la relecture, on relit l'état de la salle
      const poll = setInterval(() => {
        if (closed) return clearInterval(poll);
        if (document.visibilityState === "hidden") return;
        if (es && es.readyState === 2) connect();
        if (Date.now() - lastMsg < (lagging ? 900 : 2500)) return;
        pollNow();
      }, 1000);
      // page fermée pour de bon : on prévient le serveur ; page mise de côté (persisted, téléphone qui change
      // d'application, retour possible) : on ne dit rien, le délai de grâce et le signal de vie s'en chargent
      const bye = (e) => { if (closed || (e && e.persisted)) return; navigator.sendBeacon && navigator.sendBeacon(base + "leave?peer=" + me, new Blob(["{}"], { type: "application/json" })); };
      window.addEventListener("pagehide", bye);

      // attend le premier état de la salle (ou 3 s) pour que peers() soit à jour dès le départ
      await new Promise((ok) => { const t = setTimeout(ok, 3000); firstMsg = () => { clearTimeout(t); ok(); }; });

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
          closed = true; es.close(); clearInterval(poll); window.removeEventListener("pagehide", bye);
          document.removeEventListener("visibilitychange", wake); window.removeEventListener("pageshow", wake);
          window.removeEventListener("online", wake); window.removeEventListener("focus", wake);
          try { await post("leave"); } catch (e) { /* hors ligne */ }
        },
      };
    },
  };

  window.claude = { use: async (n) => { if (n === "room") return room; throw Object.assign(new Error("indisponible"), { code: "unavailable" }); } };
})();
