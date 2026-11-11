// Simulation de la capacité « room » entre onglets (BroadcastChannel) pour les tests locaux.
(function () {
  const me = Math.random().toString(36).slice(2, 10);
  const room = {
    join: async (name) => {
      const bc = new BroadcastChannel("mock-" + name);
      let pres = {}; const others = new Map(); const hs = [];
      const snap = () => [{ peer: me, sameTab: true, isMe: true, presence: pres }, ...[...others].map(([peer, pr]) => ({ peer, sameTab: false, isMe: false, presence: pr }))];
      const fire = () => { const ps = snap(); hs.forEach((h) => h({ peers: ps, joined: [], left: [], updated: [] })); };
      bc.onmessage = (e) => { const m = e.data; if (m.t === "p") { others.set(m.peer, m.pr); fire(); } if (m.t === "hello") bc.postMessage({ t: "p", peer: me, pr: pres }); if (m.t === "bye") { others.delete(m.peer); fire(); } };
      bc.postMessage({ t: "hello" });
      return { name, peers: snap, onPeers(h) { hs.push(h); setTimeout(fire, 0); return () => {}; },
        presence: async (p) => { pres = Object.assign({}, pres, p); bc.postMessage({ t: "p", peer: me, pr: pres }); fire(); },
        leave: async () => { bc.postMessage({ t: "bye", peer: me }); bc.close(); } };
    },
  };
  window.claude = { use: async (n) => (n === "room" ? room : null) };
})();
