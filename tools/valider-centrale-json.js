#!/usr/bin/env node
/* Valide des descripteurs centrale.json avec le schéma commun passerelle.atelier v1.
   Prérequis : npm i --no-save ajv@8   ·   node tools/valider-centrale-json.js [fichiers…] (défaut : centrale.json) */
'use strict';
const fs = require('fs'); const path = require('path');
let Ajv; try { Ajv = require('ajv/dist/2020'); } catch (e) { console.error('Installer d’abord ajv : npm i --no-save ajv@8'); process.exit(2); }
const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'docs', 'passerelle-atelier', 'passerelle-atelier.schema.json'), 'utf8'));
const valider = new Ajv({ strict: false, allErrors: true }).compile(schema);
const fichiers = process.argv.slice(2).length ? process.argv.slice(2) : [path.join(__dirname, '..', 'centrale.json')];
let ko = 0;
for (const f of fichiers) {
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  let ok = valider(d);
  const erreurs = ok ? [] : valider.errors.map((e) => e.instancePath + ' ' + e.message);
  // Règles que le schéma ne peut pas exprimer seul
  for (const [cle, e] of Object.entries(d.donnees || {})) if (/[{}]/.test(cle) && !e.motif) { ok = false; erreurs.push('/donnees/' + cle + ' : clé à paramètre sans « motif »'); }
  const ids = (d.activites && d.activites.liste || []).map((a) => a.id);
  const doublons = ids.filter((x, i) => ids.indexOf(x) !== i);
  if (doublons.length) { ok = false; erreurs.push('/activites/liste : id en double ' + doublons.join(', ')); }
  if (d.activites && d.activites.dynamiques) { const re = new RegExp(d.activites.dynamiques.motif); const hors = ids.filter((x) => !re.test(x)); if (hors.length && !d.activites.dynamiques.liste_hors_motif) erreurs.push('(info) activités hors motif dynamique : ' + hors.length); }
  console.log((ok ? '✓ ' : '✗ ') + f + (erreurs.length ? '\n  ' + erreurs.slice(0, 15).join('\n  ') : ''));
  if (!ok) ko++;
}
process.exit(ko ? 1 : 0);
