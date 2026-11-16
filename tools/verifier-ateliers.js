#!/usr/bin/env node
/* Vérifie que les ateliers intégrés, les ateliers transférés par la Centrale (si son dépôt est à côté :
   ../centrale/ateliers/technostudio/) et les fichiers .json donnés en argument respectent le descripteur.
   Un fichier de la Centrale doit aussi porter son identifiant comme nom (<id>.json), un format et une version,
   et aucun ne doit reprendre l'identifiant d'un atelier intégré.
   node tools/verifier-ateliers.js [atelier.technostudio.json …] */
'use strict';
const fs = require('fs');
const path = require('path');
const D = require('../js/descriptor.js');
const P = require('../js/passerelle.js');
const charger = require('./charger-ateliers.js');
const { ateliers: integres } = charger();
const ateliers = integres.map((w) => [w.title, w]);
let ko = 0;
const centrale = charger.lireCentrale();
for (const { fichier, atelier: w } of centrale) {
  const nom = 'Centrale ' + path.basename(fichier) + ' · ' + (w.title || '?');
  const err = [];
  if (path.basename(fichier, '.json') !== w.id) err.push('le nom du fichier doit être son id (« ' + w.id + ' »)');
  if (!Number.isInteger(w.format) || !Number.isInteger(w.version)) err.push('format ou version manquant');
  if (P.INTEGRES.includes(w.id)) err.push('atelier intégré : il reste dans le code de TechnoStudio');
  if (err.length) { ko++; console.log('✗ ' + nom + ' : ' + err.join(' ; ')); continue; }
  ateliers.push([nom, w]);
}
if (!centrale.length) console.log('(pas de dépôt de la Centrale à côté : ses ateliers ne sont pas vérifiés ici)');
for (const f of process.argv.slice(2)) { const d = JSON.parse(fs.readFileSync(f, 'utf8')); (Array.isArray(d) ? d : d.workshops || [d]).forEach((w) => ateliers.push([f + ' · ' + w.title, w])); }
for (const [nom, w] of ateliers) { const r = D.validate('Workshop', w); if (!r.ok) ko++; console.log((r.ok ? '✓ ' : '✗ ') + nom + (r.ok ? '' : ' : ' + r.errors.slice(0, 3).join(' ; ')) + (r.warnings.length ? ' (' + r.warnings.length + ' avertissement(s))' : '')); }
if (!ateliers.length) { console.log('✗ aucun atelier trouvé'); ko++; }
process.exit(ko ? 1 : 0);
