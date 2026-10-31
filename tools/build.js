#!/usr/bin/env node
/* Construit les versions « fichier unique » de TechnoStudio à partir de l'appli (racine du dépôt) :
   - dist/technostudio-autonome.html : un seul fichier à ouvrir en double-clic, sans serveur ;
   - dist/artifact.html : variante sans en-tête HTML, pour une page hébergée (non versionnée).
   Utilisation : node tools/build.js */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const APP = ROOT;
const DIST = path.join(ROOT, 'dist');
fs.mkdirSync(DIST, { recursive: true });

const html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(APP, 'css', 'app.css'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
const vendor = ['vendor/blockly/blockly_compressed.js', 'vendor/blockly/blocks_compressed.js', 'vendor/blockly/python_compressed.js', 'vendor/blockly/fr.js', 'vendor/esptool/esptool.js'];
const js = vendor.concat(scripts).map((s) => `/* ---- ${s} ---- */\n` + fs.readFileSync(path.join(APP, s), 'utf8')).join('\n;\n').replace(/<\/script/gi, '<\\/script');
const body = html.slice(html.indexOf('<!--APP-->') + 10, html.indexOf('<!--/APP-->'));
const fonts = (html.match(/<link rel="stylesheet" href="https:\/\/fonts[^>]+>/) || [''])[0];
const icon = 'data:image/svg+xml;base64,' + fs.readFileSync(path.join(APP, 'icons', 'icon.svg')).toString('base64');

const single = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>TechnoStudio</title>
<meta name="theme-color" content="#2340b8">
<link rel="icon" href="${icon}">
${fonts}
<style>
${css}
</style>
</head>
<body>
${body}
<script>window.TL_NO_SW = true;</script>
<script>
${js}
</script>
<script>TL.app.start();</script>
</body>
</html>
`;
fs.writeFileSync(path.join(DIST, 'technostudio-autonome.html'), single);

const artifact = `<title>TechnoStudio</title>
<meta name="claude:viewport-fit-sides" content="cover">
${fonts}
<style>
${css}
</style>
${body}
<script>window.TL_NO_SW = true; window.TL_DEFAULT_PROFILE = { name: 'Lionel', role: 'prof', classe: '' };</script>
<script>
${js}
</script>
<script>TL.app.start();</script>
`;
fs.writeFileSync(path.join(DIST, 'artifact.html'), artifact);
const kb = (f) => (fs.statSync(path.join(DIST, f)).size / 1024).toFixed(0) + ' Ko';
console.log('dist/technostudio-autonome.html', kb('technostudio-autonome.html'));
console.log('dist/artifact.html', kb('artifact.html'));
