#!/usr/bin/env node
/* TechnoStudio — compilation en ligne de commande, appelée par la Centrale (public/api/compilation.php).
     node compiler-cli.js etat                       → état JSON (cartes installées)
     node compiler-cli.js travail <id> --dossier D   → lit D/travaux/<id>.demande.json { carte, code },
                                                       écrit D/travaux/<id>.json { fini, resultat }
     node compiler-cli.js essai <carte>              → compile un programme d'essai (vérification d'installation)
     node compiler-cli.js fichier <carte> <chemin>   → compile un fichier
   Le PHP lance « travail » en arrière-plan puis lit le fichier résultat : une compilation longue
   (premier ESP32) ne bloque donc pas la requête web. */
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('./compilation.js');

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : undefined; };
const o = { dossier: opt('dossier'), cli: opt('arduino-cli'), microbit: opt('microbit') };
const R = C.reglages(o);

const ESSAIS = {
  cpp: '#include <Servo.h>\nServo s;\nvoid setup() {\n  pinMode(13, OUTPUT);\n  s.attach(9);\n}\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(500);\n  digitalWrite(13, LOW);\n  delay(500);\n}\n',
  esp32: '#include <ESP32Servo.h>\nServo s;\nvoid setup() {\n  pinMode(2, OUTPUT);\n  s.attach(13);\n}\nvoid loop() {\n  digitalWrite(2, !digitalRead(2));\n  delay(500);\n}\n',
  python: 'from microbit import *\nwhile True:\n    display.scroll("OK")\n',
};

function ecrireAtomique(f, data) { const t = f + '.' + process.pid + '.tmp'; fs.writeFileSync(t, JSON.stringify(data)); fs.renameSync(t, f); }

(async () => {
  const cmd = args[0];
  if (cmd === 'etat') { process.stdout.write(JSON.stringify(await C.etat(o))); return; }
  if (cmd === 'essai') {
    const carte = args[1] || 'uno';
    const code = carte === 'esp32' ? ESSAIS.esp32 : C.CARTES[carte] && C.CARTES[carte].langage === 'python' ? ESSAIS.python : ESSAIS.cpp;
    const r = await C.compiler(carte, code + '// essai ' + Date.now() + '\n', o);
    const taille = r.hex ? r.hex.length : r.images ? r.images.reduce((s, x) => s + x.donnees.length * 0.75, 0) : 0;
    console.log((r.ok ? 'OK ' : 'ÉCHEC ') + carte + ' · ' + (r.format || '-') + ' · ' + Math.round(taille / 1024) + ' Ko · ' + r.duree + ' ms' + (r.ok ? '' : '\n' + (r.erreur || '') + '\n' + String(r.journal || '').slice(-3000)));
    process.exitCode = r.ok ? 0 : 1;
    return;
  }
  if (cmd === 'fichier') { // node compiler-cli.js fichier <carte> <chemin> : compile un fichier (essais)
    const r = await C.compiler(args[1], fs.readFileSync(args[2], 'utf8'), o);
    console.log((r.ok ? 'OK ' : 'ÉCHEC ') + args[1] + ' · ' + path.basename(args[2]) + ' · ' + (r.duree || 0) + ' ms' + (r.ok ? '' : '\n' + (r.erreur || '') + '\n' + String(r.journal || '').slice(-3000)));
    process.exitCode = r.ok ? 0 : 1;
    return;
  }
  if (cmd === 'travail') {
    const id = String(args[1] || '');
    if (!/^[a-f0-9]{16,64}$/.test(id)) throw new Error('identifiant de travail invalide');
    const d = path.join(R.dossier, 'travaux');
    const sortie = path.join(d, id + '.json');
    let demande;
    try { demande = JSON.parse(fs.readFileSync(path.join(d, id + '.demande.json'), 'utf8')); } catch (e) { ecrireAtomique(sortie, { fini: true, resultat: { ok: false, erreur: 'Demande illisible.' } }); return; }
    ecrireAtomique(sortie, { fini: false, statut: 'compilation', debut: Date.now() });
    let r;
    try { r = await C.compiler(String(demande.carte || ''), demande.code, o); } catch (e) { r = { ok: false, erreur: e.message }; }
    ecrireAtomique(sortie, { fini: true, resultat: r });
    try { fs.unlinkSync(path.join(d, id + '.demande.json')); } catch (e) { /* déjà retiré */ }
    // ménage : travaux de plus d'une heure
    for (const f of fs.readdirSync(d)) { try { if (Date.now() - fs.statSync(path.join(d, f)).mtimeMs > 3600000) fs.unlinkSync(path.join(d, f)); } catch (e) { /* rien */ } }
    return;
  }
  console.log('Utilisation : node compiler-cli.js etat | travail <id> --dossier D | essai <uno|nano|esp32|microbit>');
  process.exitCode = 2;
})().catch((e) => { console.error(e.message); process.exit(1); });
