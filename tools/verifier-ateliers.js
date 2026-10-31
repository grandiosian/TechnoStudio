#!/usr/bin/env node
/* Vérifie que les ateliers intégrés (et les fichiers .json donnés en argument) respectent le descripteur.
   node tools/verifier-ateliers.js [atelier.technostudio.json …] */
'use strict';
const fs = require('fs');
const D = require('../js/descriptor.js');
const { ateliers: integres } = require('./charger-ateliers.js')();
const ateliers = integres.map((w) => [w.title, w]);
for (const f of process.argv.slice(2)) { const d = JSON.parse(fs.readFileSync(f, 'utf8')); (Array.isArray(d) ? d : d.workshops || [d]).forEach((w) => ateliers.push([f + ' · ' + w.title, w])); }
let ko = 0;
for (const [nom, w] of ateliers) { const r = D.validate('Workshop', w); if (!r.ok) ko++; console.log((r.ok ? '✓ ' : '✗ ') + nom + (r.ok ? '' : ' : ' + r.errors.slice(0, 3).join(' ; ')) + (r.warnings.length ? ' (' + r.warnings.length + ' avertissement(s))' : '')); }
if (!ateliers.length) { console.log('✗ aucun atelier trouvé'); ko++; }
process.exit(ko ? 1 : 0);
