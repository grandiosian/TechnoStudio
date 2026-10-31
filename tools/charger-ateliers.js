/* Charge, dans Node, les ateliers de l'appli exactement comme le navigateur :
   - les ateliers intégrés au code (core.js les normalise : identifiants des blocs, feuilles…) ;
   - les ateliers publiés avec l'appli, fichiers du dossier ateliers/ (un atelier, une liste ou un paquet { workshops }).
   Renvoie { ateliers, LEVELS, publies } ; publies : { id atelier → chemin du fichier (ateliers/…) }.
   Utilisé par les outils (centrale-json.js, verifier-ateliers.js, build.js). */
'use strict';
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const DOSSIER = path.join(__dirname, '..', 'ateliers');

/** Fichiers du dossier ateliers/ : [{ fichier: 'ateliers/x.technostudio.json', ateliers: [Workshop…] }]. */
function lirePublies() {
  if (!fs.existsSync(DOSSIER)) return [];
  return fs.readdirSync(DOSSIER).filter((f) => /\.json$/i.test(f)).sort().map((f) => {
    const d = JSON.parse(fs.readFileSync(path.join(DOSSIER, f), 'utf8'));
    return { fichier: 'ateliers/' + f, ateliers: Array.isArray(d) ? d : d.workshops || [d] };
  });
}

module.exports = function chargerAteliers() {
  const D = require('../js/descriptor.js');
  function El() {} El.prototype.append = function () {}; El.prototype.prepend = function () {};
  const ctx = { console, Element: El, Node: El, document: { addEventListener() {}, documentElement: {} }, navigator: {}, location: { hash: '', search: '' }, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.self = ctx; ctx.window.TL = { descriptor: D };
  vm.createContext(ctx);
  for (const f of ['core.js', 'demos.js', 'demos2.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx);
  const ateliers = JSON.parse(JSON.stringify(ctx.window.TL.DEMOS || []));
  const publies = {};
  for (const { fichier, ateliers: liste } of lirePublies()) {
    for (const w of liste) {
      const n = JSON.parse(JSON.stringify(ctx.window.TL.normalizeWorkshop(JSON.parse(JSON.stringify(w)))));
      const i = ateliers.findIndex((x) => x.id === n.id);
      if (i >= 0) ateliers[i] = n; else ateliers.push(n);   // même identifiant : la version publiée remplace
      publies[n.id] = fichier;
    }
  }
  return { ateliers, LEVELS: JSON.parse(JSON.stringify(ctx.window.TL.LEVELS || {})), publies };
};
module.exports.lirePublies = lirePublies;
