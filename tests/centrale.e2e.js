/* Essai de bout en bout avec une vraie Centrale (PHP) lancée en local.
   node tests/centrale.e2e.js <url appli> <url centrale> <fichier codes.json> <base sqlite> */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const [APP, CEN, CODES, DB] = process.argv.slice(2);
const codes = JSON.parse(fs.readFileSync(CODES, 'utf8')).codes;
const { execSync } = require('child_process');
const sql = (q) => { const f = require('os').tmpdir() + '/requete.php'; fs.writeFileSync(f, '<?php $p=new PDO(' + JSON.stringify('sqlite:' + DB) + ');echo json_encode($p->query(' + JSON.stringify(q).replace(/\$/g, '\\$') + ')->fetchAll(PDO::FETCH_ASSOC));'); return execSync('php ' + f).toString(); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch();
  const url = APP + '?centrale=' + encodeURIComponent(CEN);
  // 1. Premier poste : bienvenue → code élève
  const c1 = await b.newContext({ viewport: { width: 1300, height: 850 } });
  const p = await c1.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
  await p.goto(url); await p.waitForSelector('.onb-code input', { timeout: 15000 });
  await p.fill('.onb-code input', codes[0]); await p.click('.onb-code .btn.primary');
  await p.waitForFunction(() => TL.centrale.connecte() && TL.app.workshops.has('test-centrale'), null, { timeout: 15000 });
  ok(true, 'connexion par code et réception de l’atelier déposé dans la Centrale');
  const badge = await p.textContent('[data-sync]'); ok(/4C-/.test(badge), 'badge : ' + badge.trim());
  await wait(800);
  const covers = await p.$$eval('.cover', (l) => l.length); ok(covers >= 9, 'bibliothèque : ' + covers + ' ateliers affichés');
  await p.screenshot({ path: process.env.SHOTS + '/1-bibliotheque.png' });
  // 2. Répondre
  await p.evaluate(() => (location.hash = 'at-test-centrale')); await p.waitForSelector('.opt');
  const opts = await p.$$('.sheet .act'); 
  for (const act of opts) {
    const btns = await act.$$('.opt');
    for (const bt of btns) { const t = await bt.textContent(); if (/ultrasons|actionneur/.test(t)) { await bt.click(); break; } }
    const v = await act.$('button.btn.primary'); if (v) await v.click();
  }
  await wait(6000);
  const donnees = JSON.parse(sql("select cle, length(valeur) n from donnees"));
  ok(donnees.some((d) => d.cle === 'at/test-centrale'), 'travail enregistré sur la Centrale : ' + donnees.map((d) => d.cle).join(', '));
  const prog = JSON.parse(sql('select activite, statut, faites, total, score, score_max from progression'));
  ok(prog.some((r) => r.activite === 'test-centrale/P1' && r.statut === 'termine' && r.faites == 2), 'avancement : ' + JSON.stringify(prog));
  const acts = JSON.parse(sql("select activite, titre, groupe from activites where app='technostudio'"));
  ok(acts.length >= 1 && acts[0].activite === 'test-centrale/P1', 'colonnes du suivi déclarées : ' + acts.map((a) => a.activite).join(', '));
  await p.screenshot({ path: process.env.SHOTS + '/2-feuille.png' });
  // 3. Autre poste : même code, le travail revient
  const c2 = await b.newContext({ viewport: { width: 1300, height: 850 } });
  const p2 = await c2.newPage(); p2.on('pageerror', (e) => errs.push('p2: ' + e.message));
  await p2.goto(url); await p2.waitForSelector('.onb-code input');
  await p2.fill('.onb-code input', codes[0]); await p2.click('.onb-code .btn.primary');
  await p2.waitForFunction(() => TL.centrale.connecte(), null, { timeout: 15000 });
  await wait(1500);
  const rep = await p2.evaluate(async () => { const pg = await TL.db.get('pg:test-centrale'); return pg && Object.values(pg.answers).filter((a) => a.done).length; });
  ok(rep === 2, 'deuxième poste : réponses retrouvées (' + rep + ')');
  // 4. Arrivée depuis le portail : jeton dans l'adresse, activité demandée, sans écran de bienvenue
  const r = await fetch(CEN + 'api/login.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: codes[1], app: 'technostudio' }) }).then((x) => x.json());
  const c3 = await b.newContext({ viewport: { width: 1300, height: 850 } });
  const p3 = await c3.newPage(); p3.on('pageerror', (e) => errs.push('p3: ' + e.message));
  await p3.goto(url + '#centrale=' + r.jeton + '&retour=' + encodeURIComponent(CEN) + '&activite=' + encodeURIComponent('test-centrale/P1'));
  await p3.waitForFunction(() => TL.centrale.connecte() && location.hash === '#at-test-centrale', null, { timeout: 15000 }).catch(() => {});
  const st = await p3.evaluate(() => ({ h: location.hash, onb: !!document.querySelector('.onb-code'), retour: !!document.querySelector('.mb-retour'), user: TL.centrale.user && TL.centrale.user.name }));
  ok(st.h === '#at-test-centrale' && !st.onb && st.retour, 'portail : ' + JSON.stringify(st));
  await wait(2000);
  const panneaux = await p3.$$eval('.panel', (l) => l.map((x) => x.querySelector('.panel-title').textContent).join(','));
  ok(!/Filtres|FILTRES|bib-/.test(panneaux), 'panneaux de la vue atelier seulement : ' + panneaux);
  await p3.screenshot({ path: process.env.SHOTS + '/3-portail.png' });
  // 5. Conflit : modifié sur le poste 2 pendant que le poste 1 garde une ancienne base
  await p2.evaluate(async () => { const pg = await TL.app.getProgress('test-centrale'); pg.answers.q2 = Object.assign({}, pg.answers.q2, { at: Date.now() + 5, note: 'p2' }); TL.app.saveProgress(pg); });
  await wait(4500);
  await p.evaluate(async () => { const pg = await TL.app.getProgress('test-centrale'); pg.answers.q1 = Object.assign({}, pg.answers.q1, { at: Date.now() + 10, note: 'p1' }); TL.app.saveProgress(pg); });
  await wait(9000);
  const fin = JSON.parse(JSON.parse(sql("select valeur from donnees where cle='at/test-centrale'"))[0].valeur);
  ok(fin.answers.q1.note === 'p1' && fin.answers.q2.note === 'p2', 'conflit entre deux postes fusionné réponse par réponse');
  ok(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
