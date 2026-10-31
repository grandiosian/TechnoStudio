#!/usr/bin/env node
/* TechnoStudio — pont de téléversement (toolchain locale), Node.js 18+, sans dépendance.
   Tourne sur le poste où la carte est branchée (élève ou enseignant) et n'écoute
   que 127.0.0.1:8765. L'appli TechnoStudio l'appelle pour :
     - lister les ports série et les cartes reconnues ;
     - compiler et téléverser un programme Arduino / ESP32 (arduino-cli) ;
     - copier main.py sur une carte MicroPython (mpremote) ;
     - afficher le moniteur série ; installer les cœurs de cartes (/setup).
   Utilisation : node pont.js   |   node pont.js --port 8765 */
'use strict';
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

const VERSION = '1.0.0';
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : process.env['TECHLAB_PONT_' + n.toUpperCase()] || d; };
const PORT = +opt('port', 8765);
const ESP32_URL = 'https://espressif.github.io/arduino-esp32/package_esp32_index.json';
const WORK = path.join(os.tmpdir(), 'technostudio-pont');
fs.mkdirSync(WORK, { recursive: true });

/* ---------- Outils ---------- */
function which(cmd) {
  try { return execFileSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().split(/\r?\n/)[0].trim() || null; } catch (e) { return null; }
}
function findArduinoCli() {
  if (process.env.ARDUINO_CLI && fs.existsSync(process.env.ARDUINO_CLI)) return process.env.ARDUINO_CLI;
  const inPath = which('arduino-cli');
  if (inPath) return inPath;
  const home = os.homedir();
  const candidates = [
    path.join(home, '.local', 'bin', 'arduino-cli'), path.join(home, 'bin', 'arduino-cli'),
    '/opt/homebrew/bin/arduino-cli', '/usr/local/bin/arduino-cli',
    // arduino-cli fourni avec Arduino IDE 2
    '/Applications/Arduino IDE.app/Contents/Resources/app/lib/backend/resources/arduino-cli',
    path.join(home, 'Applications', 'Arduino IDE.app', 'Contents', 'Resources', 'app', 'lib', 'backend', 'resources', 'arduino-cli'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Arduino IDE', 'resources', 'app', 'lib', 'backend', 'resources', 'arduino-cli.exe'),
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Arduino IDE', 'resources', 'app', 'lib', 'backend', 'resources', 'arduino-cli.exe'),
    path.join(home, 'arduino-cli', 'arduino-cli.exe'),
  ];
  return candidates.find((p) => p && fs.existsSync(p)) || null;
}
function findMpremote() {
  const p = which('mpremote');
  if (p) return [p];
  for (const py of ['python3', 'python', 'py']) {
    const exe = which(py);
    if (!exe) continue;
    try { execFileSync(exe, ['-m', 'mpremote', '--version'], { stdio: 'ignore' }); return [exe, '-m', 'mpremote']; } catch (e) { /* absent */ }
  }
  return null;
}
let CLI = findArduinoCli();
let MPR = findMpremote();

function run(cmd, args, opts) {
  return new Promise((resolve) => {
    let out = '';
    const p = spawn(cmd, args, Object.assign({ env: process.env }, opts));
    p.stdout.on('data', (d) => { out += d; if (opts && opts.onData) opts.onData(String(d)); });
    p.stderr.on('data', (d) => { out += d; if (opts && opts.onData) opts.onData(String(d)); });
    p.on('error', (e) => resolve({ code: -1, out: out + '\n' + e.message }));
    p.on('close', (code) => resolve({ code, out }));
  });
}
const cli = (args, o) => (CLI ? run(CLI, args, o) : Promise.resolve({ code: -1, out: 'arduino-cli introuvable : lance l’installateur du dossier pont.' }));
const mpr = (args, o) => (MPR ? run(MPR[0], MPR.slice(1).concat(args), o) : Promise.resolve({ code: -1, out: 'mpremote introuvable : pip install mpremote' }));

// une seule opération à la fois (la carte et le compilateur ne se partagent pas)
let queue = Promise.resolve();
const exclusive = (fn) => { const p = queue.then(fn, fn); queue = p.catch(() => {}); return p; };

function writeSketch(code, lang) {
  const dir = path.join(WORK, lang === 'mpy' ? 'mpy' : 'technostudio_sketch');
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, lang === 'mpy' ? 'main.py' : 'technostudio_sketch.ino');
  fs.writeFileSync(f, code);
  return { dir, file: f };
}
const fqbnOf = (b) => b.fqbn || ({ uno: 'arduino:avr:uno', nano: 'arduino:avr:nano', esp32: 'esp32:esp32:esp32' }[b.board]);

async function listPorts() {
  if (CLI) {
    const r = await cli(['board', 'list', '--format', 'json']);
    try {
      const j = JSON.parse(r.out.slice(r.out.indexOf(r.out.trim()[0])));
      const arr = Array.isArray(j) ? j : j.detected_ports || [];
      return arr.map((d) => {
        const p = d.port || d;
        const mb = (d.matching_boards || d.boards || [])[0];
        return { address: p.address, label: p.label || p.address, protocol: p.protocol, board: mb && mb.name, fqbn: mb && mb.fqbn };
      }).filter((p) => p.address && (!p.protocol || p.protocol === 'serial'));
    } catch (e) { /* format inattendu : repli */ }
  }
  let names = [];
  try {
    if (process.platform === 'darwin') names = fs.readdirSync('/dev').filter((n) => /^cu\.(usb|wch|SLAB|usbserial|usbmodem)/i.test(n)).map((n) => '/dev/' + n);
    else if (process.platform === 'linux') names = fs.readdirSync('/dev').filter((n) => /^tty(USB|ACM)\d/.test(n)).map((n) => '/dev/' + n);
  } catch (e) { /* rien */ }
  return names.map((a) => ({ address: a, label: a }));
}

/* ---------- Sécurité : origines autorisées ---------- */
// Sites de TechnoStudio autorisés d'office (GitHub Pages, Centrale et ses copies de secours)
const extra = ['https://grandiosian.github.io', 'https://technoversailles.alwaysdata.net'].concat((opt('origins', '') || '').split(',').map((s) => s.trim()).filter(Boolean));
function originOk(o) {
  if (!o || o === 'null') return true;
  try {
    const u = new URL(o);
    if (extra.includes(u.origin)) return true;
    const hst = u.hostname;
    return hst === 'localhost' || hst === '127.0.0.1' || hst === '[::1]' || /\.local$/.test(hst) ||
      /^10\./.test(hst) || /^192\.168\./.test(hst) || /^172\.(1[6-9]|2\d|3[01])\./.test(hst);
  } catch (e) { return false; }
}

function send(res, status, data, headers) {
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, headers || {}));
  res.end(JSON.stringify(data));
}
function body(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', (c) => { s += c; if (s.length > 2e6) { reject(new Error('trop gros')); req.destroy(); } });
    req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch (e) { reject(e); } });
  });
}

/* ---------- Serveur ---------- */
const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (!originOk(origin)) return send(res, 403, { ok: false, log: 'Origine non autorisée : ' + origin + ' (option --origins).' });
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const url = new URL(req.url, 'http://127.0.0.1');
  try {
    if (url.pathname === '/status') {
      CLI = CLI || findArduinoCli(); MPR = MPR || findMpremote();
      let cores = [], cliVersion = null;
      if (CLI) {
        const v = await cli(['version', '--format', 'json']);
        try { cliVersion = JSON.parse(v.out).VersionString; } catch (e) { cliVersion = v.out.trim().slice(0, 60); }
        const c = await cli(['core', 'list', '--format', 'json']);
        try { const j = JSON.parse(c.out); cores = (Array.isArray(j) ? j : j.platforms || []).map((p) => p.id + '@' + (p.installed_version || p.installed || '')); } catch (e) { /* rien */ }
      }
      return send(res, 200, { pont: VERSION, platform: process.platform, arduinoCli: CLI ? { path: CLI, version: cliVersion } : null, mpremote: MPR ? MPR.join(' ') : null, cores, busy: false });
    }
    if (url.pathname === '/ports') return send(res, 200, { ports: await listPorts() });
    if (url.pathname === '/compile' && req.method === 'POST') {
      const b = await body(req);
      const r = await exclusive(async () => { const s = writeSketch(b.code || '', 'cpp'); return cli(['compile', '--fqbn', fqbnOf(b), '--warnings', 'default', s.dir]); });
      return send(res, 200, { ok: r.code === 0, log: clean(r.out) });
    }
    if (url.pathname === '/upload' && req.method === 'POST') {
      const b = await body(req);
      if (!b.port) return send(res, 400, { ok: false, log: 'Port manquant.' });
      const r = await exclusive(async () => {
        if (b.lang === 'mpy') { const s = writeSketch(b.code || '', 'mpy'); return mpr(['connect', b.port, 'cp', s.file, ':main.py', '+', 'reset']); }
        const s = writeSketch(b.code || '', 'cpp');
        return cli(['compile', '--upload', '-p', b.port, '--fqbn', fqbnOf(b), s.dir]);
      });
      return send(res, 200, { ok: r.code === 0, log: clean(r.out) });
    }
    if (url.pathname === '/monitor') {
      const port = url.searchParams.get('port'), baud = url.searchParams.get('baud') || '115200';
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      if (!CLI) { res.write('data: ' + JSON.stringify('arduino-cli introuvable.') + '\n\n'); return res.end(); }
      const p = spawn(CLI, ['monitor', '-p', port, '--config', 'baudrate=' + baud, '--quiet']);
      const push = (d) => res.write('data: ' + JSON.stringify(String(d)) + '\n\n');
      p.stdout.on('data', push); p.stderr.on('data', push);
      p.on('close', () => res.end());
      req.on('close', () => p.kill());
      return;
    }
    if (url.pathname === '/setup') {
      // installation des cœurs et bibliothèques, journal en direct
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
      const push = (d) => res.write('data: ' + JSON.stringify(String(d)) + '\n\n');
      if (!CLI) { push('arduino-cli introuvable : lance d’abord l’installateur du dossier pont.\n'); return res.end(); }
      await exclusive(async () => {
        for (const args of [['config', 'init', '--overwrite'], ['config', 'add', 'board_manager.additional_urls', ESP32_URL], ['core', 'update-index'], ['core', 'install', 'arduino:avr'], ['core', 'install', 'esp32:esp32'], ['lib', 'install', 'Servo'], ['lib', 'install', 'ESP32Servo']]) {
          push('$ arduino-cli ' + args.join(' ') + '\n');
          const r = await cli(args, { onData: push });
          push(r.code === 0 ? '✓\n' : '✗ (code ' + r.code + ')\n');
        }
      });
      push('Terminé.\n');
      return res.end();
    }
    send(res, 404, { ok: false, log: 'Route inconnue.' });
  } catch (e) {
    send(res, 500, { ok: false, log: e.message });
  }
});
const clean = (s) => String(s || '').replace(new RegExp(WORK.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '…').slice(-20000);

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Pont TechnoStudio ${VERSION} prêt sur http://127.0.0.1:${PORT}`);
  console.log('  arduino-cli : ' + (CLI || 'introuvable (installateur du dossier pont)'));
  console.log('  mpremote    : ' + (MPR ? MPR.join(' ') : 'introuvable (pip install mpremote)'));
  console.log('Laisse cette fenêtre ouverte pendant la séance.');
});
