/* Charge, dans Node, les ateliers intégrés de l'appli exactement comme le navigateur (core.js les normalise :
   identifiants des blocs, feuilles…). Ce sont les premiers pas (TL.passerelle.INTEGRES) : les autres ateliers sont
   transférés par la Centrale (dossier ateliers/technostudio/ de son dépôt).
   Renvoie { ateliers, LEVELS }. Utilisé par les outils (centrale-json.js, verifier-ateliers.js) et les tests.
   lireCentrale() : fichiers de la Centrale voisine (../centrale/ateliers/technostudio/), s'il y en a une à côté du dépôt. */
'use strict';
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const DOSSIER_CENTRALE = path.join(__dirname, '..', '..', 'centrale', 'ateliers', 'technostudio');

/** Ateliers transférés par la Centrale, si son dépôt est à côté : [{ fichier, atelier }] (vide sinon, par exemple sur GitHub). */
function lireCentrale() {
  if (!fs.existsSync(DOSSIER_CENTRALE)) return [];
  return fs.readdirSync(DOSSIER_CENTRALE).filter((f) => /\.json$/i.test(f)).sort()
    .map((f) => ({ fichier: path.join(DOSSIER_CENTRALE, f), atelier: JSON.parse(fs.readFileSync(path.join(DOSSIER_CENTRALE, f), 'utf8')) }));
}

module.exports = function chargerAteliers() {
  const D = require('../js/descriptor.js');
  function El() {} El.prototype.append = function () {}; El.prototype.prepend = function () {};
  const ctx = { console, Element: El, Node: El, document: { addEventListener() {}, documentElement: {} }, navigator: {}, location: { hash: '', search: '' }, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.self = ctx; ctx.window.TL = { descriptor: D };
  vm.createContext(ctx);
  for (const f of ['core.js', 'demos.js', 'demos2.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx);
  const ateliers = JSON.parse(JSON.stringify(ctx.window.TL.DEMOS || []));
  return { ateliers, LEVELS: JSON.parse(JSON.stringify(ctx.window.TL.LEVELS || {})) };
};
module.exports.lireCentrale = lireCentrale;
module.exports.DOSSIER_CENTRALE = DOSSIER_CENTRALE;
