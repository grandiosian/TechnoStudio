#!/usr/bin/env node
/* TechnoStudio — serveur de compilation (Node.js 18+, sans dépendance).

   Les élèves programment leur carte dans TechnoStudio (navigateur). Le code C++ généré
   est envoyé ici, compilé avec arduino-cli, et le binaire revient au navigateur, qui le
   téléverse lui-même sur la carte branchée en USB (Web Serial). Aucun logiciel n'est
   donc à installer sur les postes élèves.

     GET  /etat       → { ok, version, cartes, auth, file }
     POST /compiler   { carte: "uno"|"nano"|"esp32", code } (+ en-tête X-Jeton de la Centrale)
                      → { ok, journal, format: "hex", hex }               (Arduino AVR)
                      → { ok, journal, format: "bin", images: [{ adresse, donnees(base64) }] } (ESP32)

   Accès : par défaut, seul un élève connecté à la Centrale peut compiler (le jeton est
   vérifié auprès de la Centrale, puis gardé 20 min). Voir README.md de ce dossier.

   Réglages (variables d'environnement) :
     PORT, IP            adresse d'écoute (alwaysdata les fournit)          défaut 8790, 0.0.0.0
     CENTRALE            API de la Centrale              défaut https://technoversailles.alwaysdata.net/api/
     ORIGINES            sites autorisés, séparés par des virgules (* = tous)
     CLES                clés enseignant acceptées dans l'en-tête X-Cle (séparées par des virgules)
     OUVERT=1            pas de contrôle d'accès (réseau local uniquement !)
     ARDUINO_CLI         chemin d'arduino-cli                                défaut : ~/bin, puis PATH
     PARALLELE           compilations simultanées                            défaut 1
     FILE_MAX            demandes en attente au maximum                      défaut 40
     DOSSIER             dossier de travail                                  défaut ~/.technostudio-compilation */
'use strict';
const http = require('http');
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const VERSION = '1.0.0';
const env = process.env;
const PORT = +(env.PORT || 8790);
const IP = env.IP || env.HOST || '0.0.0.0';
const CENTRALE = (env.CENTRALE || 'https://technoversailles.alwaysdata.net/api/').replace(/\/?$/, '/');
const ORIGINES = (env.ORIGINES || 'https://grandiosian.github.io,https://technoversailles.alwaysdata.net,http://localhost:8000,http://127.0.0.1:8000,null')
  .split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);
const CLES = (env.CLES || '').split(',').map((s) => s.trim()).filter((s) => s.length >= 12);
const OUVERT = env.OUVERT === '1';
const PARALLELE = Math.max(1, +(env.PARALLELE || 1));
const FILE_MAX = Math.max(1, +(env.FILE_MAX || 40));
const DOSSIER = env.DOSSIER || path.join(os.homedir(), '.technostudio-compilation');
const MAX_CODE = 100 * 1024;

const CARTES = {
  uno: { nom: 'Arduino Uno', fqbn: 'arduino:avr:uno', coeur: 'arduino:avr', format: 'hex' },
  nano: { nom: 'Arduino Nano', fqbn: 'arduino:avr:nano', coeur: 'arduino:avr', format: 'hex' },
  esp32: { nom: 'ESP32', fqbn: 'esp32:esp32:esp32', coeur: 'esp32:esp32', format: 'bin' },
};

/* ---------- arduino-cli ---------- */
function trouverCli() {
  const cands = [env.ARDUINO_CLI, path.join(os.homedir(), 'bin', 'arduino-cli'), path.join(os.homedir(), '.local', 'bin', 'arduino-cli')].filter(Boolean);
  for (const c of cands) if (fs.existsSync(c)) return c;
  for (const d of (env.PATH || '').split(path.delimiter)) { const c = path.join(d, process.platform === 'win32' ? 'arduino-cli.exe' : 'arduino-cli'); if (fs.existsSync(c)) return c; }
  return null;
}
const CLI = trouverCli();

function lancer(cmd, args, opts) {
  return new Promise((resolve) => {
    let out = '';
    const p = spawn(cmd, args, Object.assign({ env }, opts));
    const t = setTimeout(() => { out += '\n[délai dépassé]'; p.kill('SIGKILL'); }, (opts && opts.timeout) || 240000);
    p.stdout.on('data', (d) => { if (out.length < 400000) out += d; });
    p.stderr.on('data', (d) => { if (out.length < 400000) out += d; });
    p.on('error', (e) => { clearTimeout(t); resolve({ code: -1, out: out + e.message }); });
    p.on('close', (code) => { clearTimeout(t); resolve({ code, out }); });
  });
}

let coeursInstalles = [];
async function lireCoeurs() {
  if (!CLI) return [];
  const r = await lancer(CLI, ['core', 'list', '--format', 'json'], { timeout: 30000 });
  try {
    const j = JSON.parse(r.out);
    const liste = Array.isArray(j) ? j : j.platforms || [];
    coeursInstalles = liste.map((p) => p.id || (p.metadata && p.metadata.id)).filter(Boolean);
  } catch (e) { coeursInstalles = []; }
  return coeursInstalles;
}

/* ---------- Contrôle du code envoyé ----------
   Le code est compilé, jamais exécuté sur le serveur. Mais le préprocesseur peut lire des
   fichiers du serveur (#include "/chemin", .incbin, #embed…) et les renvoyer dans le journal
   ou le binaire. On n'accepte donc que les directives utiles aux programmes des élèves. */
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
    const dir = m[1];
    if (dir === 'include') {
      const f = m[2].match(/^<([A-Za-z0-9_]+\.h)>\s*(\/\/.*)?$/);
      if (!f || !ENTETES.has(f[1])) return 'Ligne ' + (i + 1) + ' : seules les bibliothèques connues peuvent être incluses (' + [...ENTETES].slice(0, 6).join(', ') + '…).';
    } else if (!['define', 'undef', 'if', 'ifdef', 'ifndef', 'elif', 'else', 'endif'].includes(dir)) {
      return 'Ligne ' + (i + 1) + ' : directive #' + dir + ' non autorisée.';
    }
  }
  return null;
}

/* ---------- Accès ---------- */
const jetonsValides = new Map(); // empreinte → expiration
const empreinte = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
function verifierJeton(jeton) {
  const k = empreinte(jeton);
  const exp = jetonsValides.get(k);
  if (exp && exp > Date.now()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const u = new URL(CENTRALE + 'progression.php');
    u.searchParams.set('app', 'technostudio');
    const lib = u.protocol === 'http:' ? http : https;
    const rq = lib.get(u, { headers: { 'X-Jeton': jeton, 'User-Agent': 'technostudio-compilation/' + VERSION }, timeout: 8000 }, (r) => {
      r.resume();
      const ok = r.statusCode === 200;
      if (ok) { jetonsValides.set(k, Date.now() + 20 * 60000); if (jetonsValides.size > 5000) jetonsValides.delete(jetonsValides.keys().next().value); }
      resolve(ok);
    });
    rq.on('timeout', () => rq.destroy());
    rq.on('error', () => resolve(false));
  });
}
async function identifier(req) {
  if (OUVERT) return { id: 'ouvert:' + (req.socket.remoteAddress || '') };
  const cle = req.headers['x-cle'];
  if (cle && CLES.some((c) => c.length === String(cle).length && crypto.timingSafeEqual(Buffer.from(c), Buffer.from(String(cle))))) return { id: 'cle:' + empreinte(cle).slice(0, 8) };
  const jeton = req.headers['x-jeton'];
  if (jeton && /^[a-f0-9]{16,128}$/i.test(jeton) && (await verifierJeton(jeton))) return { id: 'eleve:' + empreinte(jeton).slice(0, 12) };
  return null;
}
const essais = new Map(); // id → [horodatages]
function tropDeDemandes(id) {
  const t = Date.now();
  const l = (essais.get(id) || []).filter((x) => t - x < 60000);
  l.push(t); essais.set(id, l);
  if (essais.size > 10000) essais.delete(essais.keys().next().value);
  return l.length > 12;
}

/* ---------- File d'attente et cache ---------- */
let enCours = 0;
const attente = [];
function dansLaFile(tache) {
  return new Promise((resolve, reject) => {
    if (attente.length >= FILE_MAX) return reject(Object.assign(new Error('Serveur occupé : réessaie dans une minute.'), { statut: 503 }));
    attente.push({ tache, resolve, reject });
    suivant();
  });
}
function suivant() {
  while (enCours < PARALLELE && attente.length) {
    const { tache, resolve, reject } = attente.shift();
    enCours++;
    tache().then(resolve, reject).finally(() => { enCours--; suivant(); });
  }
}
const CACHE = path.join(DOSSIER, 'cache');
fs.mkdirSync(CACHE, { recursive: true });
function lireCache(cle) {
  const f = path.join(CACHE, cle + '.json');
  try { const r = JSON.parse(fs.readFileSync(f, 'utf8')); fs.utimesSync(f, new Date(), new Date()); return r; } catch (e) { return null; }
}
function ecrireCache(cle, r) {
  try {
    fs.writeFileSync(path.join(CACHE, cle + '.json'), JSON.stringify(r));
    const fichiers = fs.readdirSync(CACHE).map((f) => ({ f, t: fs.statSync(path.join(CACHE, f)).mtimeMs })).sort((a, b) => b.t - a.t);
    fichiers.slice(300).forEach((x) => fs.unlinkSync(path.join(CACHE, x.f)));
  } catch (e) { /* cache facultatif */ }
}

/* ---------- Compilation ---------- */
function trouver(dir, test) {
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { const r = trouver(p, test); if (r) return r; } else if (test(p)) return p;
    }
  } catch (e) { /* dossier absent */ }
  return null;
}
async function compiler(carte, code) {
  const c = CARTES[carte];
  const id = crypto.randomBytes(6).toString('hex');
  const racine = path.join(DOSSIER, 'travail', id);
  const croquis = path.join(racine, 'sketch');
  const sortie = path.join(racine, 'out');
  fs.mkdirSync(croquis, { recursive: true });
  fs.mkdirSync(sortie, { recursive: true });
  fs.writeFileSync(path.join(croquis, 'sketch.ino'), code);
  try {
    const args = ['compile', '--fqbn', c.fqbn, '--output-dir', sortie, '--build-cache-path', path.join(DOSSIER, 'build-cache', carte), '--warnings', 'default', croquis];
    const r = await lancer(CLI, args, { timeout: 300000 });
    const journal = r.out.split(racine).join('').split(DOSSIER).join('').split(os.homedir()).join('~').slice(-12000);
    if (r.code !== 0) return { ok: false, journal };
    if (c.format === 'hex') {
      const f = path.join(sortie, 'sketch.ino.hex');
      if (!fs.existsSync(f)) return { ok: false, journal: journal + '\nFichier .hex introuvable après compilation.' };
      return { ok: true, journal, format: 'hex', hex: fs.readFileSync(f, 'utf8') };
    }
    const b64 = (f) => fs.readFileSync(f).toString('base64');
    const fusion = path.join(sortie, 'sketch.ino.merged.bin');
    if (fs.existsSync(fusion)) return { ok: true, journal, format: 'bin', images: [{ adresse: 0, donnees: b64(fusion) }] };
    const boot = path.join(sortie, 'sketch.ino.bootloader.bin');
    const part = path.join(sortie, 'sketch.ino.partitions.bin');
    const appli = path.join(sortie, 'sketch.ino.bin');
    const bootApp0 = trouver(path.join(os.homedir(), '.arduino15', 'packages', 'esp32', 'hardware'), (p) => p.endsWith(path.join('partitions', 'boot_app0.bin')));
    if (![boot, part, appli].every((f) => fs.existsSync(f))) return { ok: false, journal: journal + '\nImages ESP32 introuvables après compilation.' };
    const images = [{ adresse: 0x1000, donnees: b64(boot) }, { adresse: 0x8000, donnees: b64(part) }];
    if (bootApp0) images.push({ adresse: 0xe000, donnees: b64(bootApp0) });
    images.push({ adresse: 0x10000, donnees: b64(appli) });
    return { ok: true, journal, format: 'bin', images };
  } finally {
    fs.rm(racine, { recursive: true, force: true }, () => {});
  }
}

/* ---------- HTTP ---------- */
function cors(req, res) {
  const o = req.headers.origin;
  if (!o) return true;
  const ok = ORIGINES.includes('*') || ORIGINES.includes(o.replace(/\/$/, ''));
  if (!ok) return false;
  res.setHeader('Access-Control-Allow-Origin', o);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Jeton, X-Cle');
  res.setHeader('Access-Control-Max-Age', '86400');
  return true;
}
function json(res, statut, data) {
  res.writeHead(statut, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}
function lireCorps(req, max) {
  return new Promise((resolve, reject) => {
    let n = 0; const morceaux = [];
    req.on('data', (d) => { n += d.length; if (n > max) { reject(Object.assign(new Error('Envoi trop gros.'), { statut: 413 })); req.destroy(); } else morceaux.push(d); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(morceaux).toString('utf8') || '{}')); } catch (e) { reject(Object.assign(new Error('JSON invalide.'), { statut: 400 })); } });
    req.on('error', reject);
  });
}

const serveur = http.createServer(async (req, res) => {
  if (!cors(req, res)) return json(res, 403, { ok: false, erreur: 'Ce site n’est pas autorisé à utiliser le serveur de compilation.' });
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const fin = new URL(req.url, 'http://x').pathname.replace(/\/+$/, '').split('/').pop();
  try {
    if (req.method === 'GET' && (fin === 'etat' || fin === '')) {
      const cartes = {};
      for (const [k, c] of Object.entries(CARTES)) cartes[k] = { nom: c.nom, format: c.format, installee: coeursInstalles.includes(c.coeur) };
      return json(res, 200, { ok: true, nom: 'technostudio-compilation', version: VERSION, arduinoCli: !!CLI, cartes, auth: OUVERT ? 'ouvert' : 'centrale' + (CLES.length ? '+cle' : ''), file: attente.length, enCours });
    }
    if (req.method === 'POST' && fin === 'compiler') {
      const qui = await identifier(req);
      if (!qui) return json(res, 401, { ok: false, erreur: 'Connecte-toi avec ton code élève (Centrale) pour compiler sur le serveur.' });
      if (tropDeDemandes(qui.id)) return json(res, 429, { ok: false, erreur: 'Trop de compilations en une minute : attends un peu.' });
      const corps = await lireCorps(req, MAX_CODE * 2);
      const carte = String(corps.carte || '');
      if (!CARTES[carte]) return json(res, 400, { ok: false, erreur: 'Carte inconnue (uno, nano ou esp32).' });
      const refus = controlerCode(corps.code);
      if (refus) return json(res, 400, { ok: false, erreur: refus, journal: refus });
      if (!CLI) return json(res, 503, { ok: false, erreur: 'arduino-cli n’est pas installé sur le serveur.' });
      if (!coeursInstalles.includes(CARTES[carte].coeur)) await lireCoeurs();
      if (!coeursInstalles.includes(CARTES[carte].coeur)) return json(res, 503, { ok: false, erreur: 'Le cœur ' + CARTES[carte].coeur + ' n’est pas installé sur le serveur.' });
      const cle = empreinte(carte + '\n' + corps.code);
      const deja = lireCache(cle);
      if (deja) return json(res, 200, Object.assign({ cache: true }, deja));
      const debut = Date.now();
      const r = await dansLaFile(() => compiler(carte, corps.code));
      r.duree = Date.now() - debut;
      if (r.ok) ecrireCache(cle, r);
      console.log(new Date().toISOString(), qui.id, carte, r.ok ? 'ok' : 'erreur', r.duree + ' ms');
      return json(res, 200, r);
    }
    json(res, 404, { ok: false, erreur: 'Inconnu. Utilise GET /etat ou POST /compiler.' });
  } catch (e) {
    json(res, e.statut || 500, { ok: false, erreur: e.message });
  }
});

if (require.main === module) {
  fs.mkdirSync(path.join(DOSSIER, 'travail'), { recursive: true });
  lireCoeurs().then((c) => {
    serveur.listen(PORT, IP, () => {
      console.log(`Serveur de compilation TechnoStudio ${VERSION} sur http://${IP}:${PORT}`);
      console.log('arduino-cli : ' + (CLI || 'INTROUVABLE (voir installer-alwaysdata.sh)') + ' · cœurs : ' + (c.join(', ') || 'aucun'));
      console.log('Accès : ' + (OUVERT ? 'OUVERT (sans contrôle)' : 'élèves connectés à ' + CENTRALE + (CLES.length ? ' ou clé enseignant' : '')));
    });
  });
}
module.exports = { controlerCode, CARTES, serveur };
