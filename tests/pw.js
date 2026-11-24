// Playwright pour les tests du jeu : même module, mais chaque contexte ignore la Content-Security-Policy du serveur
// (bypassCSP). Les tests attendent des conditions écrites en texte (waitForFunction("…")), que Playwright évalue
// dans la page : la CSP du site (script-src 'self', pas d'eval) les bloquerait. Rien ne change pour le site ;
// tests/e2e_security.js, lui, charge "playwright" directement pour vérifier la CSP telle qu'un joueur la reçoit.
const pw = require("playwright");
const withBypass = (o) => Object.assign({ bypassCSP: true }, o || {});
const launch = pw.chromium.launch.bind(pw.chromium);
const chromium = Object.create(pw.chromium);
chromium.launch = async (...args) => {
  const b = await launch(...args);
  const newContext = b.newContext.bind(b), newPage = b.newPage.bind(b);
  b.newContext = (o) => newContext(withBypass(o));
  b.newPage = (o) => newPage(withBypass(o));
  return b;
};
module.exports = Object.assign({}, pw, { chromium });
