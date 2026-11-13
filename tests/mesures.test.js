#!/usr/bin/env node
/* Mesures pendant l'atelier (monitoring) : ce que js/passerelle.js envoie à la Centrale (champ « mesures »)
   à partir de pg.mesures rempli par js/mesures.js. Utilisation : node tests/mesures.test.js */
'use strict';
const assert = require('assert');
const P = require('../js/passerelle.js');

const w = { id: 'essai', title: 'Essai', steps: [{ id: 's1', title: 'Séance 1', kind: 'feuille', blocks: [
  { id: 'q1', type: 'qcm', num: '1.1', question: '**Choisis** la bonne réponse', options: [{ text: 'a', correct: true }, { text: 'b' }] },
  { id: 'q2', type: 'cloze', question: 'Complète', text: 'Le [[moteur]] tourne.' },
  { id: 'q3', type: 'numeric', question: 'Calcule', answer: 3 },
] }] };
const act = P.activitesAtelier(w)[0];
assert.ok(act && act.champs.length === 3, 'une activité de 3 champs notés');

// Sans mesures : rien de plus dans l'envoi
const pg = { answers: { q1: { done: true, correct: true, score: 1, attempts: 1, value: [0] } } };
assert.strictEqual(P.progression(w, pg, act).mesures, undefined, 'pas de mesures sans pg.mesures');

// Avec mesures
pg.answers.q2 = { done: true, correct: true, score: 1, attempts: 3, value: ['moteur'] };
pg.mesures = { v: 1, feuilles: { s1: { actif: 420 } }, q: {
  q1: { vu: 1000, premier: 31000, essais: 1, ok1: true, okA: 1, delai: 30 },
  q2: { vu: 2000, premier: 92000, essais: 3, ok1: false, okA: 3, delai: 90, revele: false },
  q3: { vu: 5000 },   // vue, pas encore essayée : ne compte pas
} };
const m = P.progression(w, pg, act).mesures;
assert.deepStrictEqual({ t: m.temps_actif, e: m.essais, q: m.questions, p: m.premier_coup, r: m.revelees, d: m.delai_median },
  { t: 420, e: 4, q: 2, p: 1, r: 0, d: 60 }, 'cumuls et médiane');
assert.strictEqual(m.detail.length, 2);
assert.strictEqual(m.detail[0].q, '1.1 Choisis la bonne réponse', 'libellé sans markdown, avec le numéro');
assert.deepStrictEqual(m.detail[1], { q: 'Complète', essais: 3, ok1: false, okA: 3, delai: 90 });

// Correction affichée sans essai : comptée
pg.mesures.q.q3 = { vu: 5000, revele: true };
assert.strictEqual(P.progression(w, pg, act).mesures.revelees, 1);

// Seulement du temps passé, sans réponse : la feuille n'est pas commencée, rien n'est envoyé
const vide = { answers: {}, mesures: { feuilles: { s1: { actif: 60 } }, q: {} } };
assert.strictEqual(P.progression(w, vide, act), null);

console.log('✓ Mesures : temps actif, essais, premier coup, délai médian et détail par question conformes.');
