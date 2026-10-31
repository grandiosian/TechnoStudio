/* Essai du serveur de compilation avec un faux arduino-cli et une Centrale locale.
   node tests/compilation.test.js <url centrale> <code élève> */
'use strict';
const fs = require('fs'); const os = require('os'); const path = require('path'); const { spawn } = require('child_process');
const [CEN, CODE] = process.argv.slice(2);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'compil-'));
const faux = path.join(dir, 'arduino-cli');
fs.writeFileSync(faux, `#!/usr/bin/env node
const a = process.argv.slice(2), fs = require('fs'), path = require('path');
if (a[0] === 'core') { console.log(JSON.stringify({ platforms: [{ id: 'arduino:avr' }, { id: 'esp32:esp32' }] })); process.exit(0); }
const fqbn = a[a.indexOf('--fqbn') + 1], out = a[a.indexOf('--output-dir') + 1], sk = a[a.length - 1];
const code = fs.readFileSync(path.join(sk, 'sketch.ino'), 'utf8');
if (/ERREUR/.test(code)) { console.error(sk + '/sketch.ino:2:1: error: ERREUR was not declared in this scope'); process.exit(1); }
if (fqbn.startsWith('esp32')) fs.writeFileSync(path.join(out, 'sketch.ino.merged.bin'), Buffer.from([0xe9, 1, 2, 3]));
else fs.writeFileSync(path.join(out, 'sketch.ino.hex'), ':0400000001020304F2\\n:00000001FF\\n');
console.log('Sketch uses 4 bytes');
`);
fs.chmodSync(faux, 0o755);
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) process.exitCode = 1; };
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'serveur-compilation', 'serveur.js')], { env: Object.assign({}, process.env, { PORT: '8790', IP: '127.0.0.1', ARDUINO_CLI: faux, CENTRALE: CEN + 'api/', DOSSIER: path.join(dir, 'travail'), CLES: 'cle-enseignant-123456' }), stdio: ['ignore', 'pipe', 'inherit'] });
srv.stdout.on('data', (d) => process.env.VERBOSE && process.stdout.write(d));
const U = 'http://127.0.0.1:8790/';
const post = (corps, h) => fetch(U + 'compiler', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, h || {}), body: JSON.stringify(corps) }).then(async (r) => ({ statut: r.status, j: await r.json() }));
(async () => {
  await new Promise((r) => setTimeout(r, 900));
  const e = await fetch(U + 'etat').then((r) => r.json());
  ok(e.ok && e.cartes.uno.installee && e.cartes.esp32.installee, 'état : ' + JSON.stringify(e.cartes));
  const prog = 'void setup(){pinMode(13,OUTPUT);}\nvoid loop(){digitalWrite(13,HIGH);delay(500);}';
  let r = await post({ carte: 'uno', code: prog });
  ok(r.statut === 401, 'sans connexion : refusé (' + r.statut + ')');
  const login = await fetch(CEN + 'api/login.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: CODE, app: 'technostudio' }) }).then((x) => x.json());
  r = await post({ carte: 'uno', code: prog }, { 'X-Jeton': 'f'.repeat(64) });
  ok(r.statut === 401, 'jeton inventé : refusé');
  r = await post({ carte: 'uno', code: prog }, { 'X-Jeton': login.jeton });
  ok(r.j.ok && r.j.format === 'hex' && r.j.hex.startsWith(':04'), 'Uno avec le jeton de la Centrale : .hex reçu');
  r = await post({ carte: 'uno', code: prog }, { 'X-Jeton': login.jeton });
  ok(r.j.cache === true, 'deuxième demande identique servie par le cache');
  r = await post({ carte: 'esp32', code: '#include <ESP32Servo.h>\n' + prog }, { 'X-Cle': 'cle-enseignant-123456' });
  ok(r.j.ok && r.j.images && r.j.images[0].adresse === 0, 'ESP32 avec la clé enseignant : image fusionnée à 0x0');
  r = await post({ carte: 'uno', code: 'ERREUR;\n' + prog }, { 'X-Jeton': login.jeton });
  ok(!r.j.ok && /error/.test(r.j.journal) && !r.j.journal.includes(dir), 'erreur de compilation : journal renvoyé sans chemin du serveur');
  for (const [nom, mal] of [['#include "chemin"', '#include "/etc/passwd"\n'], ['digraphe %:include', '%:include </etc/passwd>\n'], ['ligne coupée', '#inc\\\nlude "/etc/passwd"\n'], ['asm .incbin', 'asm(".incbin \\"/etc/passwd\\"");\n'], ['_Pragma', '_Pragma("GCC poison x")\n'], ['bibliothèque inconnue', '#include <secret.h>\n'], ['#line', '#line 1 "/etc/passwd"\n']]) {
    r = await post({ carte: 'uno', code: mal + prog }, { 'X-Jeton': login.jeton });
    ok(r.statut === 400 && !r.j.ok, 'refusé : ' + nom + ' → ' + r.j.erreur);
  }
  const cors = await fetch(U + 'etat', { headers: { Origin: 'https://site-pirate.example' } });
  ok(cors.status === 403, 'site non autorisé : 403');
  const cors2 = await fetch(U + 'etat', { headers: { Origin: 'https://grandiosian.github.io' } });
  ok(cors2.headers.get('access-control-allow-origin') === 'https://grandiosian.github.io', 'GitHub Pages autorisé (CORS)');
  srv.kill();
})().catch((e) => { console.error(e); srv.kill(); process.exit(1); });
