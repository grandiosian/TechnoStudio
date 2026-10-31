#!/usr/bin/env node
/* Vérifie que les ateliers intégrés (et les fichiers .json donnés en argument) respectent le descripteur.
   node tools/verifier-ateliers.js [atelier.technostudio.json …] */
'use strict';
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const D = require('../js/descriptor.js');
// Contexte minimal de navigateur : le noyau (core.js) normalise les ateliers comme dans l'appli
function El() {} El.prototype.append = function () {}; El.prototype.prepend = function () {};
const ctx = { console, Element: El, Node: El, document: { addEventListener() {}, documentElement: {} }, navigator: {}, location: { hash: '', search: '' }, setTimeout, clearTimeout };
ctx.window = ctx; ctx.self = ctx; ctx.window.TL = { descriptor: D };
vm.createContext(ctx);
for (const f of ['core.js', 'demos.js', 'demos2.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx);
const ateliers = (ctx.window.TL.DEMOS || []).map((w) => [w.title, w]);
for (const f of process.argv.slice(2)) { const d = JSON.parse(fs.readFileSync(f, 'utf8')); (Array.isArray(d) ? d : d.workshops || [d]).forEach((w) => ateliers.push([f + ' · ' + w.title, w])); }
let ko = 0;
for (const [nom, w] of ateliers) { const r = D.validate('Workshop', w); if (!r.ok) ko++; console.log((r.ok ? '✓ ' : '✗ ') + nom + (r.ok ? '' : ' : ' + r.errors.slice(0, 3).join(' ; ')) + (r.warnings.length ? ' (' + r.warnings.length + ' avertissement(s))' : '')); }
if (!ateliers.length) { console.log('✗ aucun atelier trouvé'); ko++; }
process.exit(ko ? 1 : 0);
