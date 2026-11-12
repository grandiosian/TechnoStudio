#!/usr/bin/env node
/* Simulateur « façon mBlock » (js/mblock.js), sans navigateur : mur, variables, « dire », opérations,
   et les tests automatiques des activités (attentes say / var), sur le programme du radar de recul (4e).
   Vérifie aussi que les tests des ateliers publiés (dossier ateliers/) passent avec leur solution
   quand l'activité en fournit une (champ solution, facultatif) et échouent avec le programme de départ.
   Utilisation : node tests/mblock.test.js */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const ROOT = path.join(__dirname, '..');

const ctx = { console, setTimeout, clearTimeout };
ctx.window = ctx;
ctx.TL = { h: () => ({}), activities: {}, code: { load: () => Promise.resolve() }, clone: (o) => JSON.parse(JSON.stringify(o)) };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/mblock.js'), 'utf8'), ctx, { filename: 'js/mblock.js' });
const M = ctx.TL.mblock;

const n = (v) => ({ shadow: { type: 'math_number', fields: { NUM: v } } });
const vget = { block: { type: 'variables_get', fields: { VAR: { id: 'v-d' } } } };
const chain = (...bs) => { for (let i = bs.length - 2; i >= 0; i--) bs[i].next = { block: bs[i + 1] }; return bs[0]; };
const say = (t) => ({ type: 'mb_say', inputs: { V: { shadow: { type: 'text', fields: { TEXT: t } } } } });
// Radar : flèche gauche → recule de 10, distance = position x − (−200), puis dit la zone
const radar = (seuilProche) => ({ variables: [{ name: 'distance', id: 'v-d' }], blocks: { languageVersion: 0, blocks: [
  { type: 'mb_flag', next: { block: chain({ type: 'mb_setx', fields: { N: 0 } }, { type: 'mb_point', fields: { N: 90 } }) } },
  { type: 'mb_key', fields: { KEY: 'left' }, next: { block: chain(
    { type: 'mb_move', fields: { N: -10 } },
    { type: 'variables_set', fields: { VAR: { id: 'v-d' } }, inputs: { VALUE: { block: { type: 'mb_arith', fields: { OP: '-' }, inputs: { A: { block: { type: 'mb_x' } }, B: n(-200) } } } } },
    sinon(moins(seuilProche), say('bip continu'), sinon(moins(50), say('bip rapide'), sinon(moins(100), say('bip lent'), say('silence'))))) } },
] } });
function moins(v) { return { type: 'mb_lt', inputs: { A: vget, B: n(v) } }; }
function sinon(cond, alors, autrement) { return { type: 'mb_ifelse', inputs: { COND: { block: cond }, DO: { block: alors }, ELSE: { block: autrement } } }; }
const cfg = { mode: 'sprite', decor: 'murGauche', tests: [
  { name: 'loin du mur : silence', steps: [{ flag: true }, { set: { x: 0 } }, { key: 'left' }], expect: [{ v: 'say', eq: 'silence' }, { var: 'distance', eq: 190 }] },
  { name: 'à 70 cm : bip lent', steps: [{ flag: true }, { set: { x: -120 } }, { key: 'left' }], expect: [{ v: 'say', eq: 'bip lent' }, { var: 'distance', eq: 70 }] },
  { name: 'à 35 cm : bip rapide', steps: [{ flag: true }, { set: { x: -155 } }, { key: 'left' }], expect: [{ v: 'say', eq: 'Bip rapide' }] },
  { name: 'à 10 cm : bip continu', steps: [{ flag: true }, { set: { x: -180 } }, { key: 'left' }], expect: [{ v: 'say', eq: 'bip continu' }] },
  { name: 'le mur arrête le robot', steps: [{ flag: true }, { set: { x: -195 } }, { key: 'left', n: 3 }], expect: [{ v: 'x', reachMin: -200 }, { v: 'x', min: -200 }, { var: 'distance', eq: 0 }] },
] };
const res = M.runTests(cfg, radar(20));
res.forEach((r) => assert.ok(r.ok, r.name + ' : ' + r.why));
const faux = M.runTests(cfg, radar(5));   // seuil faux : « bip continu » jamais dit à 10 cm
assert.ok(!faux[3].ok && /bip continu/.test(faux[3].why), 'un mauvais programme échoue avec un message clair : ' + faux[3].why);
const sansVar = M.runTests({ mode: 'sprite', tests: [{ name: 'v', steps: [{ flag: true }], expect: [{ var: 'appuis', eq: 0 }] }] }, radar(20));
assert.ok(!sansVar[0].ok && /appuis/.test(sansVar[0].why), 'variable absente signalée');

// mb_say_t, mb_arith (×, ÷), ajouter à, comparaison de textes
const prog2 = { variables: [{ name: 'appuis', id: 'a' }], blocks: { languageVersion: 0, blocks: [{ type: 'mb_key', fields: { KEY: 'right' }, next: { block: chain(
  { type: 'math_change', fields: { VAR: { id: 'a' } }, inputs: { DELTA: n(1) } },
  { type: 'mb_say_t', inputs: { V: { block: { type: 'mb_arith', fields: { OP: '/' }, inputs: { A: { block: { type: 'variables_get', fields: { VAR: { id: 'a' } } } }, B: n(2) } } }, S: n(0.1) } }) } }] } };
const r2 = M.runTests({ mode: 'sprite', tests: [{ name: '7 appuis', steps: [{ key: 'right', n: 7 }], expect: [{ var: 'appuis', eq: 7 }, { v: 'say', eq: '3,5' }] }] }, prog2);
assert.ok(r2[0].ok, r2[0].why);

// Les activités mblock des ateliers publiés : leurs tests tournent sans erreur sur le programme de départ
let nAct = 0;
for (const f of fs.readdirSync(path.join(ROOT, 'ateliers')).filter((x) => /\.json$/.test(x))) {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'ateliers', f), 'utf8'));
  for (const w of Array.isArray(d) ? d : d.workshops || [d]) for (const s of w.steps) for (const b of s.blocks) {
    if (b.type !== 'mblock' || !b.tests) continue;
    nAct++;
    const r = M.runTests(b, b.start || { blocks: { languageVersion: 0, blocks: [] } });
    r.forEach((x) => assert.ok(!/^Erreur/.test(x.why || ''), f + ' ' + b.id + ' : ' + x.why));
    if (b.solution) M.runTests(b, b.solution).forEach((x) => assert.ok(x.ok, f + ' ' + b.id + ' (solution) : ' + x.name + ' — ' + x.why));
  }
}
console.log('✓ Simulateur mBlock : mur, variables, « dire », opérations et tests say/var conformes ; ' + nAct + ' activités des ateliers publiés exécutées.');
