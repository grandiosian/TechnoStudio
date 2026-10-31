#!/usr/bin/env node
/* Réduit les index de cartes d'arduino-cli aux seules plateformes et outils installés.
   arduino-cli lit ces fichiers à chaque commande : l'index officiel complet (plusieurs dizaines
   de Mo de JSON) suffit à dépasser la mémoire permise sur un hébergement mutualisé.
   node filtrer-index.js <dossier arduino15> */
'use strict';
const fs = require('fs');
const path = require('path');
const dir = process.argv[2];
const installe = {};
const pk = path.join(dir, 'packages');
for (const p of fs.readdirSync(pk)) {
  const hw = path.join(pk, p, 'hardware');
  if (!fs.existsSync(hw)) continue;
  for (const arch of fs.readdirSync(hw)) for (const v of fs.readdirSync(path.join(hw, arch))) (installe[p] = installe[p] || []).push(arch + '@' + v);
}
// Dépendances d'outils retirés (autres puces) : supprimées des index et des installed.json
const present = (t) => fs.existsSync(path.join(pk, t.packager, 'tools', t.name, t.version));
const nettoyer = (pl) => { if (pl && pl.toolsDependencies) pl.toolsDependencies = pl.toolsDependencies.filter(present); return pl; };
for (const p of Object.keys(installe)) for (const av of installe[p]) {
  const [arch, v] = av.split('@');
  const f = path.join(pk, p, 'hardware', arch, v, 'installed.json');
  if (!fs.existsSync(f)) continue;
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  (j.packages || []).forEach((q) => (q.platforms || []).forEach(nettoyer));
  fs.writeFileSync(f, JSON.stringify(j));
}
for (const f of fs.readdirSync(dir).filter((x) => /^package_.*index\.json$/.test(x))) {
  const fichier = path.join(dir, f);
  const idx = JSON.parse(fs.readFileSync(fichier, 'utf8'));
  const avant = fs.statSync(fichier).size;
  const outils = new Set();
  // « builtin » : outils internes d'arduino-cli (ctags, détection des ports…), gardés s'ils sont installés
  idx.packages = (idx.packages || []).filter((p) => installe[p.name] || p.name === 'builtin').map((p) => {
    if (p.name === 'builtin') { p.platforms = []; p.tools = (p.tools || []).filter((t) => present(Object.assign({ packager: 'builtin' }, t))); return p; }
    p.platforms = (p.platforms || []).filter((pl) => installe[p.name].includes(pl.architecture + '@' + pl.version)).map(nettoyer);
    p.platforms.forEach((pl) => (pl.toolsDependencies || []).forEach((t) => outils.add(t.packager + ':' + t.name + '@' + t.version)));
    return p;
  });
  for (const p of idx.packages) if (p.name !== 'builtin') p.tools = (p.tools || []).filter((t) => outils.has(p.name + ':' + t.name + '@' + t.version));
  fs.writeFileSync(fichier, JSON.stringify(idx));
  console.log(f + ' : ' + Math.round(avant / 1024) + ' Ko → ' + Math.round(fs.statSync(fichier).size / 1024) + ' Ko');
}
