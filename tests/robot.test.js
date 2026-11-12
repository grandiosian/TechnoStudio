#!/usr/bin/env node
/* Environnement Robots (js/robot.js), sans navigateur : Blockly en mode sans affichage.
   - un programme qui utilise tous les blocs est généré pour le mBot (C++) et le Maqueen (MicroPython) ;
   - le même espace de travail sert aux deux robots (changement de robot sans perte) ;
   - les blocs propres à un robot sont signalés sur l'autre ;
   - le code passe les règles du serveur de compilation (controler) ;
   - les deux programmes sont écrits dans tests/croquis/ : la vérification GitHub les compile
     vraiment (uno → arduino-cli, microbit → .hex), comme les autres croquis.
   Utilisation : node tests/robot.test.js [--ecrire] */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const ROOT = path.join(__dirname, '..');

const Blockly = require(path.join(ROOT, 'vendor/blockly/blockly_compressed.js'));
require(path.join(ROOT, 'vendor/blockly/blocks_compressed.js'));
Blockly.setLocale(require(path.join(ROOT, 'vendor/blockly/fr.js')));
// Blockly garde les ombres (shadow) en XML : un document minimal suffit, sans jsdom
class Noeud {
  constructor(nom, texte) { this.nodeName = this.tagName = nom; this.nodeType = nom === '#text' ? 3 : 1; this.data = this.textContent = texte || ''; this.attrs = {}; this.childNodes = []; this.children = []; }
  setAttribute(k, v) { this.attrs[k] = String(v); } getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; } removeAttribute(k) { delete this.attrs[k]; }
  appendChild(c) { this.childNodes.push(c); if (c.nodeType === 1) this.children.push(c); c.parentNode = this; return c; }
  insertBefore(c) { return this.appendChild(c); }
  get firstChild() { return this.childNodes[0] || null; }
  cloneNode() { return this; }
}
Blockly.utils.xml.injectDependencies({ document: { createElementNS: (ns, nom) => new Noeud(nom), createTextNode: (t) => new Noeud('#text', t) }, DOMParser: class {}, XMLSerializer: class {} });
const ctx = { console, setTimeout, clearTimeout, setInterval, clearInterval, TextEncoder, TextDecoder };
ctx.window = ctx;
ctx.Blockly = Blockly;
ctx.TL = { h: () => ({}), activities: {}, code: { load: () => Promise.resolve() } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/robot.js'), 'utf8'), ctx, { filename: 'js/robot.js' });
const R = ctx.TL.robot;

// Syntaxe Python (si python3 est là) : compile() sans exécuter
function syntaxePython(code, nom) {
  const r = require('child_process').spawnSync('python3', ['-c', 'import sys; compile(sys.stdin.read(), "main.py", "exec")'], { input: code });
  if (r.error == null && r.status !== null) assert.strictEqual(r.status, 0, nom + ' : syntaxe Python\n' + r.stderr);
}

(async () => {
  await R.load();
  const n = (v) => ({ shadow: { type: 'math_number', fields: { NUM: v } } });
  const chain = (...bs) => { for (let i = bs.length - 2; i >= 0; i--) bs[i].next = { block: bs[i + 1] }; return bs[0]; };
  const v = (id) => ({ block: { type: 'variables_get', fields: { VAR: { id } } } });
  const prog = { variables: [{ name: 'compteur', id: 'v1' }, { name: 'vitesse', id: 'v2' }], blocks: { languageVersion: 0, blocks: [{ type: 'rb_start', x: 0, y: 0, next: { block: chain(
    { type: 'variables_set', fields: { VAR: { id: 'v2' } }, inputs: { VALUE: { block: { type: 'rb_random', inputs: { A: n(40), B: n(80) } } } } },
    { type: 'rb_timer_reset' },
    { type: 'rb_led', fields: { SIDE: 'all', COLOR: 'vert' } },
    { type: 'rb_fwd_t', inputs: { P: n(60), S: n(1.5) } },
    { type: 'rb_repeat', inputs: { N: n(3), DO: { block: chain({ type: 'rb_tone', inputs: { F: n(523), S: n(0.1) } }, { type: 'math_change', fields: { VAR: { id: 'v1' } }, inputs: { DELTA: n(1) } }) } } },
    { type: 'rb_wait_until', inputs: { COND: { block: { type: 'rb_button', fields: { BTN: 'a' } } } } },
    { type: 'rb_forever', inputs: { DO: { block: chain(
      { type: 'rb_ifelse', inputs: {
        COND: { block: { type: 'rb_lt', inputs: { A: { block: { type: 'rb_distance' } }, B: n(15) } } },
        DO: { block: chain({ type: 'rb_led', fields: { SIDE: 'left', COLOR: 'rouge' } }, { type: 'rb_back_t', inputs: { P: n(50), S: n(0.5) } }, { type: 'rb_turn_t', fields: { DIR: 'left' }, inputs: { P: n(50), S: n(0.4) } }) },
        ELSE: { block: { type: 'rb_ifelse', inputs: {
          COND: { block: { type: 'rb_and', inputs: { A: { block: { type: 'rb_line', fields: { SIDE: 'left' } } }, B: { block: { type: 'rb_not', inputs: { A: { block: { type: 'rb_line', fields: { SIDE: 'right' } } } } } } } } },
          DO: { block: { type: 'rb_motors', inputs: { L: n(20), R: v('v2') } } },
          ELSE: { block: { type: 'rb_fwd', inputs: { P: { block: { type: 'rb_arith', fields: { OP: '/' }, inputs: { A: v('v2'), B: n(2) } } } } } } } } } } },
      { type: 'rb_if', inputs: {
        COND: { block: { type: 'rb_or', inputs: { A: { block: { type: 'rb_gt', inputs: { A: { block: { type: 'rb_timer' } }, B: n(30) } } }, B: { block: { type: 'rb_eq', inputs: { A: { block: { type: 'rb_light' } }, B: n(0) } } } } } },
        DO: { block: chain(
          { type: 'rb_say', inputs: { V: { block: { type: 'rb_arith', fields: { OP: '*' }, inputs: { A: { block: { type: 'rb_light' } }, B: n(2) } } } } },
          { type: 'rb_stop' },
          { type: 'rb_repeat_until', inputs: { COND: { block: { type: 'rb_eq', inputs: { A: v('v1'), B: n(0) } } }, DO: { block: { type: 'math_change', fields: { VAR: { id: 'v1' } }, inputs: { DELTA: n(-1) } } } } },
          { type: 'rb_leds_off' }, { type: 'rb_wait', inputs: { S: n(0.2) } },
          { type: 'rb_turn', fields: { DIR: 'right' }, inputs: { P: n(30) } }, { type: 'rb_back', inputs: { P: n(40) } },
          { type: 'rb_motors', inputs: { L: n(-30), R: { block: { type: 'rb_arith', fields: { OP: '-' }, inputs: { A: n(0), B: n(30) } } } } },
          { type: 'rb_say', inputs: { V: { shadow: { type: 'text', fields: { TEXT: 'fin' } } } } }) } } }) } } }) } }] } };

  const ws = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(prog, ws);
  const types = new Set(ws.getAllBlocks(false).map((b) => b.type));
  const manquants = Object.keys(R.DEFS).filter((t) => !types.has(t) && t !== 'rb_icon');
  assert.deepStrictEqual(manquants, [], 'blocs non essayés : ' + manquants.join(', '));

  const C = require(path.join(ROOT, 'serveur-compilation/compilation.js'));
  const out = {};
  for (const robot of R.LIST) {
    const g = R.generate(ws, robot);
    assert.ok(g.start, robot + ' : départ trouvé');
    assert.strictEqual(g.warnings.size, 0, robot + ' : aucun avertissement attendu (' + [...g.warnings.values()].join(' / ') + ')');
    const err = C.controler(R.ROBOTS[robot].carte, g.code);
    assert.strictEqual(err, null, robot + ' : refusé par le serveur : ' + err);
    out[robot] = g.code;
  }
  assert.ok(/void setup\(\)/.test(out.mbot) && /while \(true\)/.test(out.mbot) && /moteurs\(-50, -50\)/.test(out.mbot), 'mBot : structure C++');
  assert.ok(!/#include/.test(out.mbot), 'mBot : aucune bibliothèque nécessaire');
  assert.ok(/^from microbit import \*/m.test(out.maqueen) && /^while True:/m.test(out.maqueen) && /i2c\.write\(0x10/.test(out.maqueen), 'Maqueen : structure MicroPython');

  // Changement de robot : le même espace de travail, un bloc propre au Maqueen signalé sur le mBot
  const ic = ws.newBlock('rb_icon');
  const dernier = ws.getAllBlocks(false).find((b) => b.type === 'rb_led' && b.getFieldValue('COLOR') === 'vert');
  const suite = dernier.getNextBlock();
  dernier.nextConnection.disconnect(); dernier.nextConnection.connect(ic.previousConnection); ic.nextConnection.connect(suite.previousConnection);
  const gm = R.generate(ws, 'mbot'), gq = R.generate(ws, 'maqueen');
  assert.ok(gm.warnings.has(ic.id), 'mBot : icône signalée');
  assert.ok(!gq.warnings.has(ic.id) && /display\.show\(Image\.HEART\)/.test(gq.code), 'Maqueen : icône générée');
  const isole = ws.newBlock('rb_stop');
  assert.ok(R.generate(ws, 'maqueen').warnings.has(isole.id), 'bloc isolé signalé');
  const bB = ws.newBlock('rb_button'); bB.setFieldValue('b', 'BTN');
  assert.ok(R.generate(ws, 'mbot').warnings.has(bB.id), 'bouton B signalé sur le mBot');

  syntaxePython(out.maqueen, 'Maqueen');

  /* ---------- Mode direct : programmes installés dans les robots ---------- */
  const fw = { mbot: R.firmware('mbot'), maqueen: R.firmware('maqueen') };
  for (const robot of R.LIST) assert.strictEqual(C.controler(R.ROBOTS[robot].carte, fw[robot]), null, robot + ' : mode direct refusé par le serveur');
  assert.ok(/OK TS-ROBOT mbot 1/.test(fw.mbot) && /strtod/.test(fw.mbot) && !/#include/.test(fw.mbot), 'mBot : programme du mode direct');
  assert.ok(/uart\.init\(115200\)/.test(fw.maqueen) && /OK TS-ROBOT maqueen 1/.test(fw.maqueen), 'Maqueen : programme du mode direct');
  syntaxePython(fw.maqueen, 'Maqueen mode direct');

  /* ---------- Mode direct : interpréteur (horloge et capteurs simulés) ---------- */
  const anti = { blocks: { languageVersion: 0, blocks: [{ type: 'rb_start', next: { block: chain(
    { type: 'rb_led', id: 'led', fields: { SIDE: 'all', COLOR: 'bleu' } },
    { type: 'rb_forever', inputs: { DO: { block: { type: 'rb_ifelse', id: 'si', inputs: {
      COND: { block: { type: 'rb_lt', inputs: { A: { block: { type: 'rb_distance' } }, B: n(15) } } },
      DO: { block: chain({ type: 'rb_back_t', id: 'recule', inputs: { P: n(50), S: n(0.5) } }, { type: 'rb_turn_t', fields: { DIR: 'right' }, inputs: { P: n(40), S: n(0.3) } }) },
      ELSE: { block: { type: 'rb_fwd', id: 'avance', inputs: { P: n(60) } } } } } } } }) } }] } };
  let t = 0, dist = 100; const envois = [], vus = [];
  const io = { send: (l) => envois.push(l), capteurs: () => ({ distance: dist, ligneG: false, ligneD: false, lumiere: 50, boutonA: false, boutonB: false }), now: () => t, log: () => {}, highlight: (id) => vus.push(id) };
  const run = new R.Direct(anti, 'mbot', io);
  const tourne = (ms) => { for (let k = 0; k < ms / 20; k++) { t += 20; run.step(); } };
  tourne(100);
  assert.deepStrictEqual(envois.slice(0, 2), ['L 0 0 0 150', 'M 60 60'], 'départ : LED puis avance ' + envois.slice(0, 3));
  dist = 10; envois.length = 0; tourne(40);
  assert.strictEqual(envois[0], 'M -50 -50', 'obstacle : recule');
  tourne(500); assert.ok(envois.includes('M 40 -40'), 'puis tourne à droite : ' + envois);
  dist = 100; envois.length = 0; tourne(600); assert.ok(envois.includes('M 60 60') && !run.done && !run.error, 'repart tout droit');
  assert.ok(vus.includes('recule') && vus.includes('avance'), 'blocs en cours surlignés');
  // variables, répétition, son, affichage, chronomètre
  const prog2 = { variables: [{ name: 'n', id: 'n' }], blocks: { languageVersion: 0, blocks: [{ type: 'rb_start', next: { block: chain(
    { type: 'rb_repeat', inputs: { N: n(3), DO: { block: { type: 'math_change', fields: { VAR: { id: 'n' } }, inputs: { DELTA: n(2) } } } } },
    { type: 'rb_tone', inputs: { F: n(440), S: n(0.2) } },
    { type: 'rb_say', inputs: { V: { block: { type: 'variables_get', fields: { VAR: { id: 'n' } } } } } },
    { type: 'rb_icon', fields: { ICON: 'HEART' } }) } }] } };
  envois.length = 0; t = 0; const logs = [];
  const r2 = new R.Direct(prog2, 'maqueen', Object.assign({}, io, { log: (m) => logs.push(m) }));
  for (let k = 0; k < 40 && !r2.done; k++) { t += 20; r2.step(); }
  assert.ok(r2.done && !r2.error, 'programme 2 terminé');
  assert.deepStrictEqual(envois, ['T 440', 'T 0', 'A 6', 'I HEART'], 'son, affichage, icône (Maqueen) : ' + envois);
  assert.deepStrictEqual(logs, ['💬 6']);

  /* ---------- Mode direct : liaison USB contre un faux robot qui parle le protocole ---------- */
  const faux = () => {
    let sortie; const recu = []; let tampon = '';
    const enc = new TextEncoder(), dec = new TextDecoder();
    const port = {
      ouvert: false,
      async open() { this.ouvert = true; this.readable = new ReadableStream({ start(c) { sortie = c; } }); this.writable = new WritableStream({ write(o) {
        tampon += dec.decode(o); let i;
        while ((i = tampon.indexOf('\n')) >= 0) { const l = tampon.slice(0, i); tampon = tampon.slice(i + 1); recu.push(l);
          if (l === 'H') sortie.enqueue(enc.encode('OK TS-ROBOT mbot 1\r\n'));
          if (l === 'C') sortie.enqueue(enc.encode('C 23.5 1 0 42 1 0\r\n')); }
      } }); },
      async close() { this.ouvert = false; try { sortie.close(); } catch (e) { /* déjà fermé */ } },
      getInfo: () => ({ usbVendorId: 0x1a86 }),
    };
    return { port, recu };
  };
  const { port, recu } = faux();
  const L = new R.Liaison('mbot', port);
  assert.strictEqual(await L.ouvrir(), true, 'le faux mBot se présente');
  await new Promise((r) => setTimeout(r, 250));
  assert.deepStrictEqual(JSON.parse(JSON.stringify(L.capteurs)), { distance: 23.5, ligneG: true, ligneD: false, lumiere: 42, boutonA: true, boutonB: false }, 'capteurs lus en continu');
  L.ecrire('M 50 50'); L.ecrire('M 50 50'); L.ecrire('M 0 0');
  await L.fermer();
  const ordres = recu.filter((l) => l !== 'C' && l !== 'H');
  assert.deepStrictEqual(ordres, ['M 50 50', 'M 0 0', 'S'], 'ordres envoyés (moteurs non répétés, arrêt à la fermeture) : ' + ordres);
  assert.ok(!port.ouvert, 'port refermé');
  const muet = { open: async () => { muet.readable = new ReadableStream({}); muet.writable = new WritableStream({}); }, close: async () => {} };
  const L2 = new R.Liaison('maqueen', muet);
  assert.strictEqual(await L2.ouvrir(), false, 'robot sans le mode direct : détecté');
  assert.strictEqual(L2.etat, 'sans-programme');
  await L2.fermer();

  if (process.argv.includes('--ecrire')) {
    fs.writeFileSync(path.join(ROOT, 'tests/croquis/uno-robot-mbot.ino'), out.mbot);
    fs.writeFileSync(path.join(ROOT, 'tests/croquis/microbit-robot-maqueen.py'), out.maqueen);
    fs.writeFileSync(path.join(ROOT, 'tests/croquis/uno-robot-mbot-direct.ino'), fw.mbot);
    fs.writeFileSync(path.join(ROOT, 'tests/croquis/microbit-robot-maqueen-direct.py'), fw.maqueen);
    console.log('tests/croquis/ : programmes des robots et du mode direct écrits.');
  }
  console.log('✓ Robots : ' + types.size + ' types de blocs, code mBot (' + out.mbot.length + ' car.) et Maqueen (' + out.maqueen.length + ' car.) conformes ; mode direct : programmes, interpréteur et liaison USB conformes.');
  process.exit(0);
})().catch((e) => { console.error('✗ ' + (e.stack || e.message)); process.exit(1); });
