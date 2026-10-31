/* TechnoStudio — cœur de la compilation des cartes (Node.js 18+).
   Utilisé par :
     • compiler-cli.js : appelé par la Centrale (public/api/compilation.php) sur alwaysdata ;
     • serveur.js      : petit serveur HTTP autonome (réseau local, autre hébergement).

   Cartes :
     uno, nano  → arduino-cli (arduino:avr)   → .hex   (écrit par le navigateur : STK500)
     esp32      → arduino-cli (esp32:esp32)   → .bin   (écrit par le navigateur : esptool-js)
     microbit   → MicroPython + main.py       → .hex universel V1/V2 (glissé sur le lecteur MICROBIT)

   Le code reçu est compilé, jamais exécuté. Le préprocesseur pouvant lire des fichiers du
   serveur, seules les directives utiles aux élèves sont acceptées (voir controlerCode). */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const VERSION = '1.1.0';
const MAX_CODE = 100 * 1024;

const CARTES = {
  uno: { nom: 'Arduino Uno', fqbn: 'arduino:avr:uno', coeur: 'arduino:avr', format: 'hex', langage: 'cpp' },
  nano: { nom: 'Arduino Nano', fqbn: 'arduino:avr:nano', coeur: 'arduino:avr', format: 'hex', langage: 'cpp' },
  esp32: { nom: 'ESP32', fqbn: 'esp32:esp32:esp32', coeur: 'esp32:esp32', format: 'bin', langage: 'cpp' },
  microbit: { nom: 'micro:bit (MicroPython)', format: 'hex-microbit', langage: 'python' },
};

function reglages(o) {
  o = o || {};
  const env = process.env;
  const dossier = o.dossier || env.DOSSIER || path.join(os.homedir(), 'technostudio-compilation', 'travail');
  return {
    dossier,
    cli: o.cli || env.ARDUINO_CLI || trouverCli(),
    microbit: o.microbit || env.MICROBIT_HEX || path.join(__dirname, 'microbit'),
  };
}

function trouverCli() {
  const env = process.env;
  const cands = [path.join(os.homedir(), 'bin', 'arduino-cli'), path.join(os.homedir(), '.local', 'bin', 'arduino-cli')];
  for (const c of cands) if (fs.existsSync(c)) return c;
  for (const d of (env.PATH || '').split(path.delimiter)) { const c = path.join(d, process.platform === 'win32' ? 'arduino-cli.exe' : 'arduino-cli'); if (fs.existsSync(c)) return c; }
  return null;
}

function lancer(cmd, args, opts) {
  return new Promise((resolve) => {
    let out = '';
    const p = spawn(cmd, args, Object.assign({ env: process.env }, opts));
    const t = setTimeout(() => { out += '\n[délai dépassé]'; p.kill('SIGKILL'); }, (opts && opts.timeout) || 300000);
    p.stdout.on('data', (d) => { if (out.length < 400000) out += d; });
    p.stderr.on('data', (d) => { if (out.length < 400000) out += d; });
    p.on('error', (e) => { clearTimeout(t); resolve({ code: -1, out: out + e.message }); });
    p.on('close', (code) => { clearTimeout(t); resolve({ code, out }); });
  });
}

/* ---------- État ---------- */
async function coeurs(R) {
  if (!R.cli) return [];
  const r = await lancer(R.cli, ['core', 'list', '--format', 'json'], { timeout: 30000 });
  try { const j = JSON.parse(r.out); return (Array.isArray(j) ? j : j.platforms || []).map((p) => p.id || (p.metadata && p.metadata.id)).filter(Boolean); } catch (e) { return []; }
}
function firmwaresMicrobit(R) {
  try {
    const f = fs.readdirSync(R.microbit);
    const v1 = f.find((x) => /micropython-microbit-v1.*\.hex$/.test(x));
    const v2 = f.find((x) => /micropython-microbit-v2.*\.hex$/.test(x));
    return v1 && v2 ? { v1: path.join(R.microbit, v1), v2: path.join(R.microbit, v2), versions: [v1, v2].map((x) => x.replace(/^micropython-microbit-|\.hex$/g, '')) } : null;
  } catch (e) { return null; }
}
function microbitFs() { try { return require('@microbit/microbit-fs'); } catch (e) { return null; } }
async function etat(o) {
  const R = reglages(o);
  const c = await coeurs(R);
  const mb = firmwaresMicrobit(R);
  const cartes = {};
  for (const [k, v] of Object.entries(CARTES)) cartes[k] = { nom: v.nom, format: v.format, langage: v.langage, installee: v.coeur ? c.includes(v.coeur) : !!(mb && microbitFs()) };
  return { ok: true, nom: 'technostudio-compilation', version: VERSION, arduinoCli: !!R.cli, cartes, microbit: mb ? mb.versions : null };
}

/* ---------- Contrôle du code ---------- */
const ENTETES = new Set(['Arduino.h', 'Servo.h', 'ESP32Servo.h', 'Wire.h', 'SPI.h', 'WiFi.h', 'WebServer.h', 'EEPROM.h', 'math.h', 'stdlib.h', 'string.h', 'stdint.h', 'SoftwareSerial.h', 'LiquidCrystal.h', 'LiquidCrystal_I2C.h', 'Adafruit_NeoPixel.h', 'DHT.h', 'Stepper.h']);
function controlerCode(code) {
  if (typeof code !== 'string' || !code.trim()) return 'Programme vide.';
  if (code.length > MAX_CODE) return 'Programme trop long (100 Ko au plus).';
  if (/[\0]/.test(code)) return 'Caractère interdit dans le programme.';
  const net = code.replace(/\\\r?\n/g, '').replace(/\?\?=/g, '#').replace(/%:/g, '#');
  if (/\b(asm|__asm__|__asm|_Pragma|__has_include|__has_include_next|incbin|__FILE__|__BASE_FILE__)\b/.test(net)) return 'Instruction non autorisée (assembleur, pragma ou inclusion de fichier).';
  const lignes = net.split(/\r?\n/);
  for (let i = 0; i < lignes.length; i++) {
    const l = lignes[i].replace(/\/\*.*?\*\//g, '').trim();
    if (!l.startsWith('#')) continue;
    const m = l.match(/^#\s*([a-z_]+)\s*(.*)$/);
    if (!m) continue;
    if (m[1] === 'include') {
      const f = m[2].match(/^<([A-Za-z0-9_]+\.h)>\s*(\/\/.*)?$/);
      if (!f || !ENTETES.has(f[1])) return 'Ligne ' + (i + 1) + ' : seules les bibliothèques connues peuvent être incluses (' + [...ENTETES].slice(0, 6).join(', ') + '…).';
    } else if (!['define', 'undef', 'if', 'ifdef', 'ifndef', 'elif', 'else', 'endif'].includes(m[1])) {
      return 'Ligne ' + (i + 1) + ' : directive #' + m[1] + ' non autorisée.';
    }
  }
  return null;
}
function controlerPython(code) {
  if (typeof code !== 'string' || !code.trim()) return 'Programme vide.';
  if (code.length > 30 * 1024) return 'Programme trop long pour la micro:bit (30 Ko au plus).';
  if (/[\0]/.test(code)) return 'Caractère interdit dans le programme.';
  return null;
}
function controler(carte, code) {
  const c = CARTES[carte];
  if (!c) return 'Carte inconnue (' + Object.keys(CARTES).join(', ') + ').';
  return c.langage === 'python' ? controlerPython(code) : controlerCode(code);
}

/* ---------- Cache (une classe qui compile le même exemple ne coûte qu'une compilation) ---------- */
const empreinte = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
function lireCache(R, cle) {
  const f = path.join(R.dossier, 'cache', cle + '.json');
  try { const r = JSON.parse(fs.readFileSync(f, 'utf8')); fs.utimesSync(f, new Date(), new Date()); return r; } catch (e) { return null; }
}
function ecrireCache(R, cle, r) {
  try {
    const d = path.join(R.dossier, 'cache');
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, cle + '.json'), JSON.stringify(r));
    const l = fs.readdirSync(d).map((f) => ({ f, t: fs.statSync(path.join(d, f)).mtimeMs })).sort((a, b) => b.t - a.t);
    l.slice(300).forEach((x) => fs.unlinkSync(path.join(d, x.f)));
  } catch (e) { /* facultatif */ }
}

/* ---------- Verrou entre processus : une compilation arduino-cli à la fois ---------- */
async function avecVerrou(R, nom, tache, maxAttente) {
  const v = path.join(R.dossier, 'verrou-' + nom);
  fs.mkdirSync(R.dossier, { recursive: true });
  const fin = Date.now() + (maxAttente || 240000);
  for (;;) {
    try { fs.mkdirSync(v); break; } catch (e) {
      try { if (Date.now() - fs.statSync(v).mtimeMs > 600000) { fs.rmSync(v, { recursive: true, force: true }); continue; } } catch (x) { continue; }
      if (Date.now() > fin) throw new Error('Serveur occupé : réessaie dans une minute.');
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  try { return await tache(); } finally { fs.rmSync(v, { recursive: true, force: true }); }
}

function trouver(dir, test) {
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { const r = trouver(p, test); if (r) return r; } else if (test(p)) return p;
    }
  } catch (e) { /* absent */ }
  return null;
}

async function compilerArduino(R, carte, code) {
  const c = CARTES[carte];
  if (!R.cli) return { ok: false, erreur: 'arduino-cli n’est pas installé sur le serveur.' };
  const id = crypto.randomBytes(6).toString('hex');
  const racine = path.join(R.dossier, 'croquis', id);
  const croquis = path.join(racine, 'sketch');
  const sortie = path.join(racine, 'out');
  fs.mkdirSync(croquis, { recursive: true });
  fs.mkdirSync(sortie, { recursive: true });
  fs.writeFileSync(path.join(croquis, 'sketch.ino'), code);
  try {
    const r = await avecVerrou(R, 'arduino', () => lancer(R.cli, ['compile', '--fqbn', c.fqbn, '--output-dir', sortie, '--build-path', path.join(R.dossier, 'build', carte), croquis], { timeout: 300000 }));
    // eslint-disable-next-line no-control-regex
    const journal = r.out.replace(/\x1b\[[0-9;]*m/g, '').split(racine).join('').split(path.join(R.dossier, 'build', carte)).join('build').split(R.dossier).join('').split(os.homedir()).join('~').slice(-12000);
    if (r.code !== 0) return { ok: false, journal, erreur: /not installed|platform not/i.test(r.out) ? 'La carte ' + c.nom + ' n’est pas installée sur le serveur.' : 'Erreur de compilation.' };
    if (c.format === 'hex') {
      const f = path.join(sortie, 'sketch.ino.hex');
      if (!fs.existsSync(f)) return { ok: false, journal, erreur: 'Fichier .hex introuvable après compilation.' };
      return { ok: true, journal, format: 'hex', hex: fs.readFileSync(f, 'utf8') };
    }
    const b64 = (f) => fs.readFileSync(f).toString('base64');
    const fusion = path.join(sortie, 'sketch.ino.merged.bin');
    if (fs.existsSync(fusion)) return { ok: true, journal, format: 'bin', images: [{ adresse: 0, donnees: b64(fusion) }] };
    const boot = path.join(sortie, 'sketch.ino.bootloader.bin');
    const part = path.join(sortie, 'sketch.ino.partitions.bin');
    const appli = path.join(sortie, 'sketch.ino.bin');
    if (![boot, part, appli].every((f) => fs.existsSync(f))) return { ok: false, journal, erreur: 'Images ESP32 introuvables après compilation.' };
    const bootApp0 = trouver(path.join(os.homedir(), '.arduino15', 'packages', 'esp32', 'hardware'), (p) => p.endsWith(path.join('partitions', 'boot_app0.bin')));
    const images = [{ adresse: 0x1000, donnees: b64(boot) }, { adresse: 0x8000, donnees: b64(part) }];
    if (bootApp0) images.push({ adresse: 0xe000, donnees: b64(bootApp0) });
    images.push({ adresse: 0x10000, donnees: b64(appli) });
    return { ok: true, journal, format: 'bin', images };
  } finally {
    fs.rmSync(racine, { recursive: true, force: true });
  }
}

function compilerMicrobit(R, code) {
  const mb = firmwaresMicrobit(R);
  const lib = microbitFs();
  if (!mb || !lib) return { ok: false, erreur: 'MicroPython pour micro:bit n’est pas installé sur le serveur.' };
  const { MicropythonFsHex, microbitBoardId } = lib;
  const f = new MicropythonFsHex([{ hex: fs.readFileSync(mb.v1, 'utf8'), boardId: microbitBoardId.V1 }, { hex: fs.readFileSync(mb.v2, 'utf8'), boardId: microbitBoardId.V2 }]);
  try { f.write('main.py', code); } catch (e) { return { ok: false, erreur: 'Programme trop gros pour la micro:bit.', journal: e.message }; }
  return { ok: true, format: 'hex-microbit', hex: f.getUniversalHex(), nom: 'microbit-technostudio.hex', journal: 'MicroPython ' + mb.versions.join(' / ') + ' + main.py (' + code.length + ' caractères) : fichier universel V1 et V2.' };
}

/** Compile (ou reprend du cache). Renvoie toujours un objet { ok, … }, ne lève pas d'erreur pour le code de l'élève. */
async function compiler(carte, code, o) {
  const R = reglages(o);
  const refus = controler(carte, code);
  if (refus) return { ok: false, refuse: true, erreur: refus, journal: refus };
  const cle = empreinte(VERSION + '\n' + carte + '\n' + code);
  const deja = lireCache(R, cle);
  if (deja) return Object.assign({ cache: true }, deja);
  const debut = Date.now();
  const r = CARTES[carte].langage === 'python' ? compilerMicrobit(R, code) : await compilerArduino(R, carte, code);
  r.duree = Date.now() - debut;
  if (r.ok) ecrireCache(R, cle, r);
  return r;
}

module.exports = { VERSION, CARTES, ENTETES, controlerCode, controlerPython, controler, compiler, etat, reglages };
