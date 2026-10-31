/* Charge, dans Node, les ateliers intégrés de l'appli exactement comme le navigateur
   (core.js les normalise : identifiants des blocs, feuilles…). Utilisé par les outils. */
'use strict';
const fs = require('fs'); const path = require('path'); const vm = require('vm');
module.exports = function chargerAteliers() {
  const D = require('../js/descriptor.js');
  function El() {} El.prototype.append = function () {}; El.prototype.prepend = function () {};
  const ctx = { console, Element: El, Node: El, document: { addEventListener() {}, documentElement: {} }, navigator: {}, location: { hash: '', search: '' }, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.self = ctx; ctx.window.TL = { descriptor: D };
  vm.createContext(ctx);
  for (const f of ['core.js', 'demos.js', 'demos2.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx);
  return { ateliers: JSON.parse(JSON.stringify(ctx.window.TL.DEMOS || [])), LEVELS: JSON.parse(JSON.stringify(ctx.window.TL.LEVELS || {})) };
};
